package com.naji.backend.invoice;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDate;
import java.util.UUID;

import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Two real accounts through the real stack (tokens, Flyway schema, numbering): from draft to cancelled. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class InvoiceLifecycleIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void anInvoiceGoesFromDraftToIssuedToCancelledAndOnlyItsOwnerReachesIt() throws Exception {
        String alice = register();
        String bob = register();
        int customerId = create(alice, "/api/customers", """
                {"name": "Acme SAS", "email": "billing@acme.fr", "street": "12 rue de la Paix",
                 "postalCode": "75002", "city": "Paris", "siret": "73282932000074"}
                """);
        int productId = create(alice, "/api/products", """
                {"type": "SERVICE", "name": "Web development", "unitPrice": 650, "vatRate": 20, "unit": "DAY"}
                """);
        String draftBody = """
                {"customerId": %d, "paymentTerms": "NET_30", "lines": [
                  {"productId": %d, "type": "SERVICE", "label": "Web development", "quantity": 2.5,
                   "unit": "DAY", "unitPrice": 650, "vatRate": 20},
                  {"type": "GOODS", "label": "Keyboard", "quantity": 1, "unit": "UNIT", "unitPrice": 49.9, "vatRate": 5.5}
                ]}
                """.formatted(customerId, productId);

        // An empty draft is accepted but cannot be issued
        int emptyId = create(alice, "/api/invoices", """
                {"paymentTerms": "ON_RECEIPT", "lines": []}
                """);
        perform(alice, post("/api/invoices/" + emptyId + "/issue"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.missing[0]").value("CUSTOMER"));

        // Draft with totals computed by the backend
        MvcResult created = perform(alice, post("/api/invoices").contentType(MediaType.APPLICATION_JSON).content(draftBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.customer.name").value("Acme SAS"))
                .andExpect(jsonPath("$.subtotal").value(1674.9))
                .andExpect(jsonPath("$.vatTotal").value(327.74))
                .andExpect(jsonPath("$.total").value(2002.64))
                .andExpect(jsonPath("$.operationNature").value("MIXED"))
                .andReturn();
        int id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");
        String url = "/api/invoices/" + id;

        // Bob neither sees nor changes it
        perform(bob, get(url)).andExpect(status().isNotFound());
        perform(bob, post(url + "/issue")).andExpect(status().isNotFound());
        perform(bob, post(url + "/duplicate")).andExpect(status().isNotFound());
        perform(bob, put(url).contentType(MediaType.APPLICATION_JSON).content("""
                {"paymentTerms": "NET_30", "lines": []}
                """)).andExpect(status().isNotFound());
        perform(bob, post("/api/invoices").contentType(MediaType.APPLICATION_JSON).content(draftBody))
                .andExpect(status().isNotFound());
        perform(bob, get("/api/invoices")).andExpect(jsonPath("$.totalElements").value(0));
        perform(bob, get("/api/invoices/summary")).andExpect(jsonPath("$.drafts.count").value(0));

        // Issued: numbered, dated, frozen
        String year = String.valueOf(LocalDate.now(InvoiceService.ZONE).getYear());
        perform(alice, post(url + "/issue"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ISSUED"))
                .andExpect(jsonPath("$.number").value("F-" + year + "-0001"))
                .andExpect(jsonPath("$.issueDate").value(matchesPattern("\\d{4}-\\d{2}-\\d{2}")));
        perform(alice, put(url).contentType(MediaType.APPLICATION_JSON).content(draftBody)).andExpect(status().isConflict());
        perform(alice, delete(url)).andExpect(status().isConflict());
        perform(alice, post(url + "/issue")).andExpect(status().isConflict());

        perform(alice, get("/api/invoices").param("status", "ISSUED"))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].customerName").value("Acme SAS"));
        perform(alice, get("/api/invoices/summary"))
                .andExpect(jsonPath("$.drafts.count").value(1))
                .andExpect(jsonPath("$.outstanding.total").value(2002.64))
                .andExpect(jsonPath("$.issuedThisMonth.count").value(1));

        // Editing the customer afterwards does not change the issued invoice
        perform(alice, put("/api/customers/" + customerId).contentType(MediaType.APPLICATION_JSON).content("""
                {"name": "Acme Renamed", "email": "billing@acme.fr"}
                """)).andExpect(status().isOk());
        perform(alice, get(url)).andExpect(jsonPath("$.customer.name").value("Acme SAS"));

        // A duplicate is a new draft with the current customer details; issuing it takes the next number
        int copyId = create(alice, url + "/duplicate", null);
        perform(alice, get("/api/invoices/" + copyId))
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.customer.name").value("Acme Renamed"))
                .andExpect(jsonPath("$.lines.length()").value(2));

        // Cancelled: keeps its number
        perform(alice, post(url + "/cancel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.number").value("F-" + year + "-0001"));
        perform(alice, post(url + "/cancel")).andExpect(status().isConflict());

        // Drafts can be deleted
        perform(alice, delete("/api/invoices/" + emptyId)).andExpect(status().isNoContent());
    }

    private ResultActions perform(String authorization, MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.header(HttpHeaders.AUTHORIZATION, authorization));
    }

    /** POSTs {@code body} (none when {@code null}), expects 201 and returns the new id. */
    private int create(String authorization, String url, String body) throws Exception {
        MockHttpServletRequestBuilder request = post(url);
        if (body != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(body);
        }
        MvcResult result = perform(authorization, request).andExpect(status().isCreated()).andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.id");
    }

    /** Signs up a new user and returns its {@code Authorization} header value. */
    private String register() throws Exception {
        String body = """
                {"firstName": "Jane", "lastName": "Doe", "email": "user-%s@acme.fr", "password": "Correct-horse-42"}
                """.formatted(UUID.randomUUID());
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn();
        return "Bearer " + JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
    }
}
