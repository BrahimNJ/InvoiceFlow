package com.naji.backend.admin;

import com.naji.backend.admin.dto.AdminActionResponse;
import com.naji.backend.common.web.PageResponse;
import com.naji.backend.user.Role;
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
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Set;

import static com.naji.backend.admin.AdminUserServiceTest.NOW;
import static com.naji.backend.admin.AdminUserServiceTest.user;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminAuditServiceTest {

    private static final Long ADMIN_ID = 1L;

    @Mock
    private AdminActionRepository adminActionRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private AdminAccess adminAccess;

    private AdminAuditService service;

    @BeforeEach
    void setUp() {
        service = new AdminAuditService(adminActionRepository, userRepository, adminAccess);
    }

    @Test
    void list_namesTheAdminAndTheTargetOfEachAction() {
        AdminAction change = new AdminAction(ADMIN_ID, AdminActionType.ROLE_CHANGED, 2L, "USER -> ADMIN", NOW);
        AdminAction startup = new AdminAction(null, AdminActionType.PROMOTED_AT_STARTUP, ADMIN_ID, null, NOW);
        when(adminActionRepository.findAllByOrderByCreatedAtDescIdDesc(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(change, startup), PageRequest.of(0, 20), 2));
        when(userRepository.findAllById(Set.of(ADMIN_ID, 2L))).thenReturn(List.of(
                user(ADMIN_ID, "admin@acme.fr", Role.ADMIN), user(2L, "jane@acme.fr", Role.ADMIN)));

        PageResponse<AdminActionResponse> page = service.list(ADMIN_ID, 0, 20);

        assertThat(page.content()).extracting(AdminActionResponse::adminEmail, AdminActionResponse::targetEmail,
                        AdminActionResponse::details)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("admin@acme.fr", "jane@acme.fr", "USER -> ADMIN"),
                        org.assertj.core.groups.Tuple.tuple(null, "admin@acme.fr", null));
    }

    @Test
    void list_clampsThePage() {
        when(adminActionRepository.findAllByOrderByCreatedAtDescIdDesc(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        service.list(ADMIN_ID, -1, 500);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(adminActionRepository).findAllByOrderByCreatedAtDescIdDesc(pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isZero();
        assertThat(pageable.getValue().getPageSize()).isEqualTo(AdminAuditService.MAX_PAGE_SIZE);
    }

    @Test
    void list_checksTheCallerFirst() {
        when(adminAccess.requireActiveAdmin(ADMIN_ID)).thenThrow(new AccessDeniedException("no"));

        assertThatThrownBy(() -> service.list(ADMIN_ID, 0, 20)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(adminActionRepository);
    }
}
