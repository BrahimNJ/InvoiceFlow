package com.naji.backend.admin;

import com.naji.backend.admin.dto.AdminUserResponse;
import com.naji.backend.auth.RefreshTokenService;
import com.naji.backend.common.exception.ConflictException;
import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.common.web.PageResponse;
import com.naji.backend.user.Role;
import com.naji.backend.user.User;
import com.naji.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminUserServiceTest {

    static final Instant NOW = Instant.parse("2026-11-18T10:00:00Z");

    @Mock
    private UserRepository userRepository;

    @Mock
    private AdminAccess adminAccess;

    @Mock
    private RefreshTokenService refreshTokenService;

    @Mock
    private AuditLog auditLog;

    private AdminUserService service;

    static final Long ADMIN_ID = 9L;

    @BeforeEach
    void setUp() {
        service = new AdminUserService(userRepository, new AdminUserMapper(), adminAccess, refreshTokenService,
                auditLog, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void search_returnsAccountsWithoutSecrets() {
        User jane = user(1L, "jane@acme.fr", Role.USER);
        jane.setSuspendedAt(NOW);
        when(userRepository.search(eq("%acme%"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(jane), PageRequest.of(0, 20), 1));

        PageResponse<AdminUserResponse> page = service.search(ADMIN_ID, "ACME", 0, 20);

        assertThat(page.totalElements()).isEqualTo(1);
        assertThat(page.content()).containsExactly(new AdminUserResponse(
                1L, "jane@acme.fr", "Jane", "Doe", Role.USER, NOW, jane.getCreatedAt()));
    }

    @Test
    void search_clampsThePageAndSortsNewestFirst() {
        when(userRepository.search(eq("%"), any(Pageable.class))).thenReturn(new PageImpl<>(List.of()));

        service.search(ADMIN_ID, null, -3, 1000);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(userRepository).search(eq("%"), pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isZero();
        assertThat(pageable.getValue().getPageSize()).isEqualTo(AdminUserService.MAX_PAGE_SIZE);
        assertThat(pageable.getValue().getSort())
                .isEqualTo(Sort.by("createdAt").descending().and(Sort.by("id").descending()));
    }

    @Test
    void search_checksTheCallerFirst() {
        when(adminAccess.requireActiveAdmin(ADMIN_ID)).thenThrow(new AccessDeniedException("no"));

        assertThatThrownBy(() -> service.search(ADMIN_ID, null, 0, 20)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(userRepository);
    }

    @Test
    void changeRole_promotesAnotherAccount() {
        User jane = user(2L, "jane@acme.fr", Role.USER);
        when(userRepository.lockActiveAdminIds()).thenReturn(List.of(ADMIN_ID));
        when(userRepository.findById(2L)).thenReturn(Optional.of(jane));

        AdminUserResponse response = service.changeRole(ADMIN_ID, 2L, Role.ADMIN);

        assertThat(jane.getRole()).isEqualTo(Role.ADMIN);
        assertThat(response.role()).isEqualTo(Role.ADMIN);
        verify(auditLog).record(ADMIN_ID, AdminActionType.ROLE_CHANGED, 2L, "USER -> ADMIN");
    }

    @Test
    void changeRole_demotesAnotherAdmin() {
        User other = user(2L, "other@acme.fr", Role.ADMIN);
        when(userRepository.lockActiveAdminIds()).thenReturn(List.of(ADMIN_ID, 2L));
        when(userRepository.findById(2L)).thenReturn(Optional.of(other));

        service.changeRole(ADMIN_ID, 2L, Role.USER);

        assertThat(other.getRole()).isEqualTo(Role.USER);
    }

    @Test
    void changeRole_toTheSameRoleChangesAndLogsNothing() {
        givenTarget(user(2L, "jane@acme.fr", Role.USER));

        service.changeRole(ADMIN_ID, 2L, Role.USER);

        verifyNoInteractions(auditLog);
    }

    @Test
    void changeRole_refusesTheCallersOwnAccount() {
        assertThatThrownBy(() -> service.changeRole(ADMIN_ID, ADMIN_ID, Role.USER))
                .isInstanceOf(ConflictException.class)
                .hasMessage(AdminUserService.OWN_ROLE);
        verify(userRepository, never()).lockActiveAdminIds();
    }

    @Test
    void changeRole_refusesACallerDemotedWhileWaitingForTheLock() {
        when(userRepository.lockActiveAdminIds()).thenReturn(List.of(2L));

        assertThatThrownBy(() -> service.changeRole(ADMIN_ID, 2L, Role.USER))
                .isInstanceOf(AccessDeniedException.class);
        verify(userRepository, never()).findById(any());
    }

    @Test
    void changeRole_reportsAnUnknownAccount() {
        when(userRepository.lockActiveAdminIds()).thenReturn(List.of(ADMIN_ID));
        when(userRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.changeRole(ADMIN_ID, 404L, Role.ADMIN))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void suspend_stampsTheAccountAndEndsItsSessions() {
        User jane = givenTarget(user(2L, "jane@acme.fr", Role.USER));

        AdminUserResponse response = service.suspend(ADMIN_ID, 2L);

        assertThat(jane.getSuspendedAt()).isEqualTo(NOW);
        assertThat(response.suspendedAt()).isEqualTo(NOW);
        verify(refreshTokenService).revokeAll(2L);
        verify(auditLog).record(ADMIN_ID, AdminActionType.ACCOUNT_SUSPENDED, 2L, null);
    }

    @Test
    void suspend_keepsTheFirstDateOfAnAlreadySuspendedAccount() {
        User jane = user(2L, "jane@acme.fr", Role.USER);
        jane.setSuspendedAt(NOW.minusSeconds(86400));
        givenTarget(jane);

        service.suspend(ADMIN_ID, 2L);

        assertThat(jane.getSuspendedAt()).isEqualTo(NOW.minusSeconds(86400));
        verifyNoInteractions(auditLog);
    }

    @Test
    void suspend_refusesTheCallersOwnAccount() {
        assertThatThrownBy(() -> service.suspend(ADMIN_ID, ADMIN_ID))
                .isInstanceOf(ConflictException.class)
                .hasMessage(AdminUserService.OWN_SUSPENSION);
        verifyNoInteractions(refreshTokenService);
    }

    @Test
    void suspend_refusesACallerSuspendedWhileWaitingForTheLock() {
        when(userRepository.lockActiveAdminIds()).thenReturn(List.of(2L));

        assertThatThrownBy(() -> service.suspend(ADMIN_ID, 2L)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(refreshTokenService);
    }

    @Test
    void reactivate_clearsTheSuspension() {
        User jane = user(2L, "jane@acme.fr", Role.USER);
        jane.setSuspendedAt(NOW.minusSeconds(60));
        givenTarget(jane);

        AdminUserResponse response = service.reactivate(ADMIN_ID, 2L);

        assertThat(jane.isSuspended()).isFalse();
        assertThat(response.suspendedAt()).isNull();
        verify(auditLog).record(ADMIN_ID, AdminActionType.ACCOUNT_REACTIVATED, 2L, null);
    }

    @Test
    void reactivate_anActiveAccountLogsNothing() {
        givenTarget(user(2L, "jane@acme.fr", Role.USER));

        service.reactivate(ADMIN_ID, 2L);

        verifyNoInteractions(auditLog);
    }

    private User givenTarget(User target) {
        when(userRepository.lockActiveAdminIds()).thenReturn(List.of(ADMIN_ID));
        when(userRepository.findById(target.getId())).thenReturn(Optional.of(target));
        return target;
    }

    static User user(Long id, String email, Role role) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setFirstName("Jane");
        user.setLastName("Doe");
        user.setRole(role);
        user.setCreatedAt(NOW.minusSeconds(3600));
        return user;
    }
}
