package com.naji.backend.admin;

import com.naji.backend.admin.dto.PlatformStatsResponse;
import com.naji.backend.customer.CustomerRepository;
import com.naji.backend.invoice.InvoiceRepository;
import com.naji.backend.invoice.InvoiceStatus;
import com.naji.backend.user.Role;
import com.naji.backend.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.Clock;
import java.time.ZoneOffset;
import java.util.EnumSet;

import static com.naji.backend.admin.AdminUserServiceTest.NOW;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminStatsServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private CustomerRepository customerRepository;

    @Mock
    private InvoiceRepository invoiceRepository;

    @Mock
    private AdminAccess adminAccess;

    @Test
    void stats_countsAccountsCustomersAndIssuedInvoices() {
        when(userRepository.count()).thenReturn(12L);
        when(userRepository.countByRole(Role.ADMIN)).thenReturn(2L);
        when(userRepository.countBySuspendedAtIsNotNull()).thenReturn(1L);
        when(userRepository.countByCreatedAtGreaterThanEqual(NOW.minus(AdminStatsService.RECENT_SIGN_UPS)))
                .thenReturn(4L);
        when(customerRepository.count()).thenReturn(30L);
        when(invoiceRepository.countByStatusIn(EnumSet.of(InvoiceStatus.ISSUED, InvoiceStatus.PAID))).thenReturn(57L);

        assertThat(service().stats(1L)).isEqualTo(new PlatformStatsResponse(12, 2, 1, 4, 30, 57));
    }

    @Test
    void stats_checksTheCallerFirst() {
        when(adminAccess.requireActiveAdmin(1L)).thenThrow(new AccessDeniedException("no"));

        assertThatThrownBy(() -> service().stats(1L)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(userRepository, customerRepository, invoiceRepository);
    }

    private AdminStatsService service() {
        return new AdminStatsService(userRepository, customerRepository, invoiceRepository, adminAccess,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }
}
