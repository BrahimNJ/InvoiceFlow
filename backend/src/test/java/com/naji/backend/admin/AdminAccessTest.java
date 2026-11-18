package com.naji.backend.admin;

import com.naji.backend.user.Role;
import com.naji.backend.user.User;
import com.naji.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.Optional;

import static com.naji.backend.admin.AdminUserServiceTest.NOW;
import static com.naji.backend.admin.AdminUserServiceTest.user;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminAccessTest {

    @Mock
    private UserRepository userRepository;

    private AdminAccess adminAccess;

    @BeforeEach
    void setUp() {
        adminAccess = new AdminAccess(userRepository);
    }

    @Test
    void acceptsAnActiveAdmin() {
        User admin = user(1L, "admin@acme.fr", Role.ADMIN);
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));

        assertThat(adminAccess.requireActiveAdmin(1L)).isSameAs(admin);
    }

    @Test
    void refusesAnAdminDemotedSinceTheTokenWasIssued() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user(1L, "admin@acme.fr", Role.USER)));

        assertThatThrownBy(() -> adminAccess.requireActiveAdmin(1L)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void refusesASuspendedAdmin() {
        User admin = user(1L, "admin@acme.fr", Role.ADMIN);
        admin.setSuspendedAt(NOW);
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));

        assertThatThrownBy(() -> adminAccess.requireActiveAdmin(1L)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void refusesADeletedAccount() {
        when(userRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminAccess.requireActiveAdmin(1L))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessage(AdminAccess.NOT_AN_ACTIVE_ADMIN);
    }
}
