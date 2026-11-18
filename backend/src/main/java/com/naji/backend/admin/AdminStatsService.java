package com.naji.backend.admin;

import com.naji.backend.admin.dto.PlatformStatsResponse;
import com.naji.backend.customer.CustomerRepository;
import com.naji.backend.invoice.InvoiceRepository;
import com.naji.backend.invoice.InvoiceStatus;
import com.naji.backend.user.Role;
import com.naji.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.util.EnumSet;

/** Platform-wide aggregates for the back-office. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminStatsService {

    static final Duration RECENT_SIGN_UPS = Duration.ofDays(30);

    private final UserRepository userRepository;
    private final CustomerRepository customerRepository;
    private final InvoiceRepository invoiceRepository;
    private final AdminAccess adminAccess;
    private final Clock clock;

    public PlatformStatsResponse stats(Long adminId) {
        adminAccess.requireActiveAdmin(adminId);
        return new PlatformStatsResponse(
                userRepository.count(),
                userRepository.countByRole(Role.ADMIN),
                userRepository.countBySuspendedAtIsNotNull(),
                userRepository.countByCreatedAtGreaterThanEqual(clock.instant().minus(RECENT_SIGN_UPS)),
                customerRepository.count(),
                invoiceRepository.countByStatusIn(EnumSet.of(InvoiceStatus.ISSUED, InvoiceStatus.PAID)));
    }
}
