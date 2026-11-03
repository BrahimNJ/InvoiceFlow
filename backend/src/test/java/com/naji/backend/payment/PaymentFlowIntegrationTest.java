package com.naji.backend.payment;

import com.jayway.jsonpath.JsonPath;
import com.naji.backend.invoice.InvoiceService;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Two real accounts through the real stack (tokens, Flyway schema, both modules in one transaction): an issued invoice
 * paid in two instalments, a payment deleted, and another user who reaches none of it.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PaymentFlowIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void anIssuedInvoiceIsPaidInInstalmentsAndOnlyItsOwnerReachesThePayments() throws Exception {
        String alice = register();
        String bob = register();
        String today = LocalDate.now(InvoiceService.ZONE).toString();
        int customerId = create(alice, "/api/customers", """
                {"name": "Acme SAS", "email": "billing@acme.fr", "street": "12 rue de la Paix",
                 "postalCode": "75002", "city": "Paris"}
                """);
        // 1 day at 650.00 excl. VAT, 20 % VAT: 780.00
        int invoiceId = create(alice, "/api/invoices", """
                {"customerId": %d, "paymentTerms": "NET_30", "lines": [
                  {"type": "SERVICE", "label": "Web development", "quantity": 1, "unit": "DAY",
                   "unitPrice": 650, "vatRate": 20}]}
                """.formatted(customerId));
        String invoice = "/api/invoices/" + invoiceId;
        String payments = invoice + "/payments";

        // A draft takes no payment
        perform(alice, post(payments).contentType(MediaType.APPLICATION_JSON).content(payment("100", today)))
                .andExpect(status().isConflict());
        perform(alice, post(invoice + "/issue")).andExpect(status().isOk());

        // First instalment: still issued, the balance and the outstanding figure go down
        int first = create(alice, payments, payment("300", today));
        perform(alice, get(invoice))
                .andExpect(jsonPath("$.status").value("ISSUED"))
                .andExpect(jsonPath("$.amountPaid").value(300.0))
                .andExpect(jsonPath("$.balance").value(480.0));
        perform(alice, get("/api/invoices/summary"))
                .andExpect(jsonPath("$.outstanding.count").value(1))
                .andExpect(jsonPath("$.outstanding.total").value(480.0));

        // More than the balance, or a future date, is refused; nothing changes
        perform(alice, post(payments).contentType(MediaType.APPLICATION_JSON).content(payment("480.01", today)))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.balance").value(480.0));
        perform(alice, post(payments).contentType(MediaType.APPLICATION_JSON)
                        .content(payment("10", LocalDate.parse(today).plusDays(1).toString())))
                .andExpect(status().isUnprocessableContent());
        // An invoice with payments cannot be cancelled
        perform(alice, post(invoice + "/cancel")).andExpect(status().isConflict());

        // Bob neither sees, records nor deletes anything
        perform(bob, get(payments)).andExpect(status().isNotFound());
        perform(bob, post(payments).contentType(MediaType.APPLICATION_JSON).content(payment("480", today)))
                .andExpect(status().isNotFound());
        perform(bob, delete(payments + "/" + first)).andExpect(status().isNotFound());

        // The rest: paid, out of the outstanding figure, in the Paid tab
        create(alice, payments, payment("480", today));
        perform(alice, get(invoice))
                .andExpect(jsonPath("$.status").value("PAID"))
                .andExpect(jsonPath("$.balance").value(0))
                .andExpect(jsonPath("$.paidAt").isNotEmpty());
        perform(alice, get(payments))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(first));
        perform(alice, get("/api/invoices/summary")).andExpect(jsonPath("$.outstanding.count").value(0));
        perform(alice, get("/api/invoices").param("status", "PAID")).andExpect(jsonPath("$.totalElements").value(1));
        perform(alice, post(payments).contentType(MediaType.APPLICATION_JSON).content(payment("1", today)))
                .andExpect(status().isConflict());

        // Deleting a payment reopens the invoice
        perform(alice, delete(payments + "/" + first)).andExpect(status().isNoContent());
        perform(alice, get(invoice))
                .andExpect(jsonPath("$.status").value("ISSUED"))
                .andExpect(jsonPath("$.balance").value(300.0))
                .andExpect(jsonPath("$.paidAt").isEmpty());
        perform(alice, get(payments)).andExpect(jsonPath("$.length()").value(1));
    }

    private static String payment(String amount, String date) {
        return """
                {"amount": %s, "date": "%s", "method": "BANK_TRANSFER"}
                """.formatted(amount, date);
    }

    private ResultActions perform(String authorization, MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.header(HttpHeaders.AUTHORIZATION, authorization));
    }

    /** POSTs {@code body}, expects 201 and returns the new id. */
    private int create(String authorization, String url, String body) throws Exception {
        MvcResult result = perform(authorization, post(url).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn();
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
