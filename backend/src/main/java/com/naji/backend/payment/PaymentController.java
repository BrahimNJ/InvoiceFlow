package com.naji.backend.payment;

import com.naji.backend.payment.dto.PaymentRequest;
import com.naji.backend.payment.dto.PaymentResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;

/** Payments of an invoice of the signed-in user, identified by the subject of the access token. */
@RestController
@RequestMapping("/api/invoices/{invoiceId}/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    /** Oldest first; 404 when the invoice is missing or someone else's. */
    @GetMapping
    public List<PaymentResponse> findByInvoice(@AuthenticationPrincipal Jwt jwt, @PathVariable Long invoiceId) {
        return paymentService.findByInvoice(ownerId(jwt), invoiceId);
    }

    /**
     * 409 when the invoice is not waiting for payment (draft, paid, cancelled); 422 when the amount is more than the
     * balance due ({@code balance}) or the date is outside the issue date to today ({@code issueDate}).
     */
    @PostMapping
    public ResponseEntity<PaymentResponse> record(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long invoiceId, @Valid @RequestBody PaymentRequest request) {
        PaymentResponse payment = paymentService.record(ownerId(jwt), invoiceId, request);
        return ResponseEntity.created(URI.create("/api/invoices/%d/payments/%d".formatted(invoiceId, payment.id())))
                .body(payment);
    }

    @DeleteMapping("/{paymentId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long invoiceId, @PathVariable Long paymentId) {
        paymentService.delete(ownerId(jwt), invoiceId, paymentId);
        return ResponseEntity.noContent().build();
    }

    private static Long ownerId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
