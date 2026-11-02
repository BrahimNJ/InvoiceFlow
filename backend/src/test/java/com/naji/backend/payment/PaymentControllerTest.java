package com.naji.backend.payment;

import com.naji.backend.common.exception.ConflictException;
import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.common.exception.UnprocessableException;
import com.naji.backend.common.security.SecurityConfig;
import com.naji.backend.payment.dto.PaymentRequest;
import com.naji.backend.payment.dto.PaymentResponse;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PaymentController.class)
@Import(SecurityConfig.class)
class PaymentControllerTest {

    private static final String VALID_BODY = """
            {"amount": 450.5, "date": "2026-10-28", "method": "BANK_TRANSFER", "reference": "VIR ACME 0042"}
            """;

    /** Id of the signed-in user, carried by the access token subject. */
    private static final Long OWNER_ID = 7L;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PaymentService paymentService;

    @Test
    void findByInvoice_returnsThePayments() throws Exception {
        when(paymentService.findByInvoice(OWNER_ID, 3L)).thenReturn(List.of(response()));

        mockMvc.perform(get("/api/invoices/3/payments").with(owner()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(11))
                .andExpect(jsonPath("$[0].amount").value(450.5))
                .andExpect(jsonPath("$[0].date").value("2026-10-28"))
                .andExpect(jsonPath("$[0].method").value("BANK_TRANSFER"));
    }

    @Test
    void findByInvoice_returns404ForAMissingInvoice() throws Exception {
        when(paymentService.findByInvoice(OWNER_ID, 42L)).thenThrow(new ResourceNotFoundException("Invoice", 42L));

        mockMvc.perform(get("/api/invoices/42/payments").with(owner()))
                .andExpect(status().isNotFound());
    }

    @Test
    void record_returns201WithLocationAndExactAmount() throws Exception {
        when(paymentService.record(eq(OWNER_ID), eq(3L), any(PaymentRequest.class))).thenReturn(response());

        mockMvc.perform(post("/api/invoices/3/payments").contentType(MediaType.APPLICATION_JSON).content(VALID_BODY)
                        .with(owner()))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/invoices/3/payments/11"))
                .andExpect(jsonPath("$.invoiceId").value(3));

        ArgumentCaptor<PaymentRequest> request = ArgumentCaptor.forClass(PaymentRequest.class);
        verify(paymentService).record(eq(OWNER_ID), eq(3L), request.capture());
        assertThat(request.getValue().amount()).isEqualByComparingTo("450.5");
        assertThat(request.getValue().date()).isEqualTo(LocalDate.of(2026, 10, 28));
    }

    @Test
    void record_returns400OnAnUnknownMethod() throws Exception {
        mockMvc.perform(post("/api/invoices/3/payments").contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY.replace("BANK_TRANSFER", "BITCOIN")).with(owner()))
                .andExpect(status().isBadRequest());
        verify(paymentService, never()).record(any(), any(), any());
    }

    @Test
    void record_returns400WithEachInvalidField() throws Exception {
        String invalidBody = """
                {"amount": 10.001, "reference": "%s"}
                """.formatted("x".repeat(101));

        mockMvc.perform(post("/api/invoices/3/payments").contentType(MediaType.APPLICATION_JSON).content(invalidBody)
                        .with(owner()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.amount").exists())
                .andExpect(jsonPath("$.errors.date").exists())
                .andExpect(jsonPath("$.errors.method").exists())
                .andExpect(jsonPath("$.errors.reference").exists());
        verify(paymentService, never()).record(any(), any(), any());
    }

    @Test
    void record_returns409WhenTheInvoiceIsNotWaitingForPayment() throws Exception {
        when(paymentService.record(eq(OWNER_ID), eq(3L), any(PaymentRequest.class)))
                .thenThrow(new ConflictException("Invoice F-2026-0001 is already paid"));

        mockMvc.perform(post("/api/invoices/3/payments").contentType(MediaType.APPLICATION_JSON).content(VALID_BODY)
                        .with(owner()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Invoice F-2026-0001 is already paid"));
    }

    @Test
    void record_returns422WithTheBalanceWhenTheAmountIsTooHigh() throws Exception {
        when(paymentService.record(eq(OWNER_ID), eq(3L), any(PaymentRequest.class)))
                .thenThrow(new UnprocessableException("The payment is more than the balance due on invoice F-2026-0001",
                        Map.of("balance", new BigDecimal("200.00"))));

        mockMvc.perform(post("/api/invoices/3/payments").contentType(MediaType.APPLICATION_JSON).content(VALID_BODY)
                        .with(owner()))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.balance").value(200.0));
    }

    @Test
    void delete_returns204() throws Exception {
        mockMvc.perform(delete("/api/invoices/3/payments/11").with(owner()))
                .andExpect(status().isNoContent());

        verify(paymentService).delete(OWNER_ID, 3L, 11L);
    }

    @Test
    void delete_returns404ForAPaymentOfAnotherInvoice() throws Exception {
        doThrow(new ResourceNotFoundException("Payment", 11L)).when(paymentService).delete(OWNER_ID, 4L, 11L);

        mockMvc.perform(delete("/api/invoices/4/payments/11").with(owner()))
                .andExpect(status().isNotFound());
    }

    @Test
    void requiresAnAccessToken() throws Exception {
        mockMvc.perform(get("/api/invoices/3/payments"))
                .andExpect(status().isUnauthorized());
        verify(paymentService, never()).findByInvoice(any(), any());
    }

    private static RequestPostProcessor owner() {
        return jwt().jwt(token -> token.subject(OWNER_ID.toString()));
    }

    private static PaymentResponse response() {
        return new PaymentResponse(11L, 3L, new BigDecimal("450.50"), LocalDate.of(2026, 10, 28),
                PaymentMethod.BANK_TRANSFER, "VIR ACME 0042", null, null);
    }
}
