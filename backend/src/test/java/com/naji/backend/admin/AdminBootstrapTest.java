package com.naji.backend.admin;

import com.naji.backend.user.Role;
import com.naji.backend.user.User;
import com.naji.backend.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminBootstrapTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private AuditLog auditLog;

    @Test
    void promotesTheListedAccountsWhileThereIsNoActiveAdmin() {
        User jane = user(1L, "jane@acme.fr");
        when(userRepository.countByRoleAndSuspendedAtIsNull(Role.ADMIN)).thenReturn(0L);
        when(userRepository.findByEmail("jane@acme.fr")).thenReturn(Optional.of(jane));

        List<User> promoted = bootstrap().promote(List.of("jane@acme.fr"));

        assertThat(promoted).containsExactly(jane);
        assertThat(jane.getRole()).isEqualTo(Role.ADMIN);
        verify(auditLog).record(null, AdminActionType.PROMOTED_FROM_CONFIG, 1L, null);
    }

    @Test
    void ignoresTheListOnceAnActiveAdminExists() {
        when(userRepository.countByRoleAndSuspendedAtIsNull(Role.ADMIN)).thenReturn(1L);

        // A listed account that an admin demoted stays demoted after a restart
        assertThat(bootstrap().promote(List.of("jane@acme.fr"))).isEmpty();
        verify(userRepository, never()).findByEmail(any());
        verifyNoInteractions(auditLog);
    }

    @Test
    void skipsAddressesWithoutAnAccount() {
        when(userRepository.findByEmail("nobody@acme.fr")).thenReturn(Optional.empty());

        assertThat(bootstrap().promote(List.of("nobody@acme.fr"))).isEmpty();
        verifyNoInteractions(auditLog);
    }

    @Test
    void doesNothingWithoutAList() {
        assertThat(bootstrap().promote(List.of())).isEmpty();
        verifyNoInteractions(userRepository, auditLog);
    }

    @Test
    void run_usesTheConfiguredEmails() {
        User jane = user(1L, "jane@acme.fr");
        when(userRepository.findByEmail("jane@acme.fr")).thenReturn(Optional.of(jane));

        bootstrap(" Jane@ACME.fr ").run(null);

        assertThat(jane.getRole()).isEqualTo(Role.ADMIN);
    }

    @Test
    void properties_normalizeAndDropBlankOrDuplicateEmails() {
        AdminProperties properties = new AdminProperties(Arrays.asList(" Jane@ACME.fr", "", null, "jane@acme.fr  "));

        assertThat(properties.emails()).containsExactly("jane@acme.fr");
        assertThat(new AdminProperties(null).emails()).isEmpty();
    }

    private AdminBootstrap bootstrap(String... emails) {
        return new AdminBootstrap(new AdminProperties(List.of(emails)), userRepository, auditLog);
    }

    private static User user(Long id, String email) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setRole(Role.USER);
        return user;
    }
}
