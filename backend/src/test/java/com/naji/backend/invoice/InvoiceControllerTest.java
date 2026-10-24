package com.naji.backend.invoice;

import com.naji.backend.common.exception.ConflictException;
import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.common.exception.UnprocessableException;
import com.naji.backend.common.security.SecurityConfig;
import com.naji.backend.common.web.PageResponse;
import com.naji.backend.invoice.dto.InvoiceLineResponse;
import com.naji.backend.invoice.dto.InvoiceListItem;
import com.naji.backend.invoice.dto.InvoiceRequest;
import com.naji.backend.invoice.dto.InvoiceResponse;
import com.naji.backend.invoice.dto.InvoiceSummaryResponse;
import com.naji.backend.invoice.dto.InvoiceTotals;
import com.naji.backend.product.ProductType;
import com.naji.backend.product.ProductUnit;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(InvoiceController.class)
@Import(SecurityConfig.class)
class InvoiceControllerTest {

    private static final String VALID_BODY = """
            {"customerId": 3, "paymentTerms": "NET_30", "notes": "Thank you",
             "lines": [{"productId": 5, "type": "SERVICE", "label": "Web development", "quantity": 1.5,
                        "unit": "DAY", "unitPrice": 650.5, "vatRate": 20}]}
            """;

    /** Id of the signed-in user, carried by the access token subject. */
    private static final Long OWNER_ID = 7L;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private InvoiceService invoiceService;

    @Test
    void search_passesEveryFilter() throws Exception {
        InvoiceSearch expected = new InvoiceSearch("acme", InvoiceStatusFilter.OVERDUE, 3L, LocalDate.of(2026, 10, 1),
                LocalDate.of(2026, 10, 31), InvoiceSort.DUE_DATE, Sort.Direction.ASC);
        when(invoiceService.search(OWNER_ID, expected, 1, 10))
                .thenReturn(new PageResponse<>(List.of(listItem()), 1, 10, 11, 2));

        mockMvc.perform(get("/api/invoices").with(owner())
                        .param("search", "acme").param("status", "OVERDUE").param("customerId", "3")
                        .param("issuedFrom", "2026-10-01").param("issuedTo", "2026-10-31")
                        .param("sort", "DUE_DATE").param("direction", "ASC").param("page", "1").param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].number").value("F-2026-0001"))
                .andExpect(jsonPath("$.content[0].overdue").value(true))
                .andExpect(jsonPath("$.content[0].dueDate").value("2026-10-20"))
                .andExpect(jsonPath("$.content[0].total").value(780.0))
                .andExpect(jsonPath("$.totalElements").value(11));
    }

    @Test
    void search_defaultsToNoFilterOnTheFirstPageOf20() throws Exception {
        when(invoiceService.search(OWNER_ID, InvoiceSearch.all(), 0, 20)).thenReturn(new PageResponse<>(List.of(), 0, 20, 0, 0));

        mockMvc.perform(get("/api/invoices").with(owner()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty());
    }

    @Test
    void search_returns400OnAnUnknownStatusOrADateThatIsNotIso() throws Exception {
        mockMvc.perform(get("/api/invoices").param("status", "PAID").with(owner()))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/invoices").param("issuedFrom", "01/10/2026").with(owner()))
                .andExpect(status().isBadRequest());

        verify(invoiceService, never()).search(any(), any(), anyInt(), anyInt());
    }

    @Test
    void search_returns401WithoutToken() throws Exception {
        mockMvc.perform(get("/api/invoices"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void summary_returnsTheKeyFigures() throws Exception {
        when(invoiceService.summary(OWNER_ID)).thenReturn(new InvoiceSummaryResponse(
                totals(3, "2400.00"), totals(12, "18950.00"), totals(2, "3120.00"), totals(7, "9800.00")));

        mockMvc.perform(get("/api/invoices/summary").with(owner()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.drafts.count").value(3))
                .andExpect(jsonPath("$.overdue.total").value(3120.0))
                .andExpect(jsonPath("$.issuedThisMonth.count").value(7));
    }

    @Test
    void findById_returnsTheInvoiceWithItsBreakdownAndChecks() throws Exception {
        when(invoiceService.findById(OWNER_ID, 1L)).thenReturn(response(1L, InvoiceStatus.ISSUED));

        mockMvc.perform(get("/api/invoices/1").with(owner()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ISSUED"))
                .andExpect(jsonPath("$.customer.name").value("Acme SAS"))
                .andExpect(jsonPath("$.lines[0].quantity").value(1.5))
                .andExpect(jsonPath("$.vatBreakdown[0].rate").value(20.0))
                .andExpect(jsonPath("$.vatBreakdown[0].amount").value(195.0))
                .andExpect(jsonPath("$.checks[0].code").value("CUSTOMER"))
                .andExpect(jsonPath("$.operationNature").value("SERVICES"));
    }

    @Test
    void findById_returns404WhenMissing() throws Exception {
        when(invoiceService.findById(OWNER_ID, 42L)).thenThrow(new ResourceNotFoundException("Invoice", 42L));

        mockMvc.perform(get("/api/invoices/42").with(owner()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Invoice with id 42 not found"));
    }

    @Test
    void create_returns201WithLocationAndExactAmounts() throws Exception {
        when(invoiceService.create(eq(OWNER_ID), any(InvoiceRequest.class))).thenReturn(response(1L, InvoiceStatus.DRAFT));

        mockMvc.perform(post("/api/invoices").contentType(MediaType.APPLICATION_JSON).content(VALID_BODY).with(owner()))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/invoices/1"))
                .andExpect(jsonPath("$.status").value("DRAFT"));

        ArgumentCaptor<InvoiceRequest> request = ArgumentCaptor.forClass(InvoiceRequest.class);
        verify(invoiceService).create(eq(OWNER_ID), request.capture());
        assertThat(request.getValue().customerId()).isEqualTo(3L);
        assertThat(request.getValue().lines().get(0).quantity()).isEqualByComparingTo("1.5");
        assertThat(request.getValue().lines().get(0).unitPrice()).isEqualByComparingTo("650.5");
    }

    @Test
    void create_returns400WithTheFieldOfEachInvalidLine() throws Exception {
        String invalidBody = """
                {"notes": "%s", "lines": [
                  {"type": "SERVICE", "label": "Fine", "quantity": 1, "unit": "DAY", "unitPrice": 1, "vatRate": 20},
                  {"type": null, "label": " ", "quantity": 0, "unit": "DAY", "unitPrice": 1.234, "vatRate": 19.6}
                ]}
                """.formatted("x".repeat(2001));

        mockMvc.perform(post("/api/invoices").contentType(MediaType.APPLICATION_JSON).content(invalidBody).with(owner()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.paymentTerms").exists())
                .andExpect(jsonPath("$.errors.notes").exists())
                .andExpect(jsonPath("$.errors['lines[1].type']").exists())
                .andExpect(jsonPath("$.errors['lines[1].label']").exists())
                .andExpect(jsonPath("$.errors['lines[1].quantity']").exists())
                .andExpect(jsonPath("$.errors['lines[1].unitPrice']").exists())
                .andExpect(jsonPath("$.errors['lines[1].vatRate']").exists())
                .andExpect(jsonPath("$.errors['lines[0].label']").doesNotExist());
        verify(invoiceService, never()).create(any(), any());
    }

    @Test
    void create_returns400OnAQuantityWithMoreThanThreeDecimals() throws Exception {
        String body = VALID_BODY.replace("\"quantity\": 1.5", "\"quantity\": 1.5005");

        mockMvc.perform(post("/api/invoices").contentType(MediaType.APPLICATION_JSON).content(body).with(owner()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors['lines[0].quantity']").exists());
    }

    @Test
    void update_returns409OnceIssued() throws Exception {
        when(invoiceService.update(eq(OWNER_ID), eq(1L), any(InvoiceRequest.class)))
                .thenThrow(new ConflictException("Only a draft can be edited: invoice F-2026-0001 is issued"));

        mockMvc.perform(put("/api/invoices/1").contentType(MediaType.APPLICATION_JSON).content(VALID_BODY).with(owner()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Only a draft can be edited: invoice F-2026-0001 is issued"));
    }

    @Test
    void delete_returns204() throws Exception {
        mockMvc.perform(delete("/api/invoices/1").with(owner()))
                .andExpect(status().isNoContent());

        verify(invoiceService).delete(OWNER_ID, 1L);
    }

    @Test
    void delete_returns409OnceIssued() throws Exception {
        doThrow(new ConflictException("Only a draft can be deleted: invoice F-2026-0001 is issued"))
                .when(invoiceService).delete(OWNER_ID, 1L);

        mockMvc.perform(delete("/api/invoices/1").with(owner()))
                .andExpect(status().isConflict());
    }

    @Test
    void issue_returnsTheIssuedInvoice() throws Exception {
        when(invoiceService.issue(OWNER_ID, 1L)).thenReturn(response(1L, InvoiceStatus.ISSUED));

        mockMvc.perform(post("/api/invoices/1/issue").with(owner()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value("F-2026-0001"));
    }

    @Test
    void issue_returns422WithTheMissingChecks() throws Exception {
        when(invoiceService.issue(OWNER_ID, 1L)).thenThrow(new UnprocessableException(
                "This invoice cannot be issued yet: some mandatory details are missing",
                Map.of("missing", List.of("CUSTOMER_ADDRESS", "LINES"))));

        mockMvc.perform(post("/api/invoices/1/issue").with(owner()))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.detail").value("This invoice cannot be issued yet: some mandatory details are missing"))
                .andExpect(jsonPath("$.missing[0]").value("CUSTOMER_ADDRESS"))
                .andExpect(jsonPath("$.missing[1]").value("LINES"));
    }

    @Test
    void cancel_returnsTheCancelledInvoice() throws Exception {
        when(invoiceService.cancel(OWNER_ID, 1L)).thenReturn(response(1L, InvoiceStatus.CANCELLED));

        mockMvc.perform(post("/api/invoices/1/cancel").with(owner()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @Test
    void duplicate_returns201WithTheLocationOfTheNewDraft() throws Exception {
        when(invoiceService.duplicate(OWNER_ID, 1L)).thenReturn(response(2L, InvoiceStatus.DRAFT));

        mockMvc.perform(post("/api/invoices/1/duplicate").with(owner()))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/invoices/2"));
    }

    private static RequestPostProcessor owner() {
        return jwt().jwt(token -> token.subject(OWNER_ID.toString()));
    }

    private static InvoiceTotals totals(long count, String total) {
        return new InvoiceTotals(count, new BigDecimal(total));
    }

    private static InvoiceListItem listItem() {
        return new InvoiceListItem(1L, "F-2026-0001", InvoiceStatus.ISSUED, true, 3L, "Acme SAS",
                LocalDate.of(2026, 9, 20), LocalDate.of(2026, 10, 20), new BigDecimal("650.00"), new BigDecimal("780.00"),
                null, null);
    }

    private static InvoiceResponse response(Long id, InvoiceStatus status) {
        boolean draft = status == InvoiceStatus.DRAFT;
        return new InvoiceResponse(id, draft ? null : "F-2026-0001", status, false, 3L,
                new InvoiceResponse.BilledCustomer("Acme SAS", "billing@acme.fr", "12 rue de la Paix", "75002", "Paris",
                        "France", null, null),
                PaymentTerms.NET_30, null, null, null, OperationNature.SERVICES,
                List.of(new InvoiceLineResponse(10L, 5L, ProductType.SERVICE,
                        "Web development", null, new BigDecimal("1.500"), ProductUnit.DAY,
                        new BigDecimal("650.00"), new BigDecimal("20.00"), new BigDecimal("975.00"))),
                new BigDecimal("975.00"), new BigDecimal("195.00"), new BigDecimal("1170.00"),
                List.of(new InvoiceResponse.VatBreakdown(new BigDecimal("20.00"), new BigDecimal("975.00"),
                        new BigDecimal("195.00"))),
                List.of(new InvoiceResponse.ReadinessCheck("CUSTOMER", true, true)),
                null, null, null, null);
    }
}
