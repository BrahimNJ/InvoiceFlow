package com.naji.backend.admin;

import com.naji.backend.auth.UserRegistered;
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
    void promotesTheListedUsers() {
        User jane = user(1L, "jane@acme.fr", Role.USER);
        when(userRepository.findByEmail("jane@acme.fr")).thenReturn(Optional.of(jane));

        List<User> promoted = bootstrap("jane@acme.fr").promote(List.of("jane@acme.fr"));

        assertThat(promoted).containsExactly(jane);
        assertThat(jane.getRole()).isEqualTo(Role.ADMIN);
        verify(auditLog).record(null, AdminActionType.PROMOTED_FROM_CONFIG, 1L, null);
    }

    @Test
    void isIdempotentForAnExistingAdmin() {
        User admin = user(1L, "admin@acme.fr", Role.ADMIN);
        when(userRepository.findByEmail("admin@acme.fr")).thenReturn(Optional.of(admin));

        assertThat(bootstrap().promote(List.of("admin@acme.fr"))).isEmpty();
        assertThat(admin.getRole()).isEqualTo(Role.ADMIN);
        verifyNoInteractions(auditLog);
    }

    @Test
    void skipsUnknownEmails() {
        when(userRepository.findByEmail("nobody@acme.fr")).thenReturn(Optional.empty());

        assertThat(bootstrap().promote(List.of("nobody@acme.fr"))).isEmpty();
    }

    @Test
    void run_usesTheConfiguredEmails() {
        User jane = user(1L, "jane@acme.fr", Role.USER);
        when(userRepository.findByEmail("jane@acme.fr")).thenReturn(Optional.of(jane));

        bootstrap(" Jane@ACME.fr ").run(null);

        assertThat(jane.getRole()).isEqualTo(Role.ADMIN);
    }

    @Test
    void onRegistered_promotesAListedEmail() {
        User jane = user(1L, "jane@acme.fr", Role.USER);
        when(userRepository.findByEmail("jane@acme.fr")).thenReturn(Optional.of(jane));

        bootstrap("jane@acme.fr").onRegistered(new UserRegistered(1L, "jane@acme.fr"));

        assertThat(jane.getRole()).isEqualTo(Role.ADMIN);
        verify(auditLog).record(null, AdminActionType.PROMOTED_FROM_CONFIG, 1L, null);
    }

    @Test
    void onRegistered_ignoresAnyOtherEmail() {
        bootstrap("admin@acme.fr").onRegistered(new UserRegistered(1L, "jane@acme.fr"));

        verifyNoInteractions(userRepository, auditLog);
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

    private static User user(Long id, String email, Role role) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setRole(role);
        return user;
    }
}
