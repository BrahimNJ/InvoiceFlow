package com.naji.backend.admin;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AuditLogTest {

    private static final Instant NOW = Instant.parse("2026-11-18T10:00:00Z");

    @Mock
    private AdminActionRepository adminActionRepository;

    @Test
    void record_savesTheActionAtTheCurrentTime() {
        new AuditLog(adminActionRepository, Clock.fixed(NOW, ZoneOffset.UTC))
                .record(1L, AdminActionType.ROLE_CHANGED, 2L, "USER -> ADMIN");

        ArgumentCaptor<AdminAction> saved = ArgumentCaptor.forClass(AdminAction.class);
        verify(adminActionRepository).save(saved.capture());
        assertThat(saved.getValue())
                .extracting(AdminAction::getAdminId, AdminAction::getAction, AdminAction::getTargetUserId,
                        AdminAction::getDetails, AdminAction::getCreatedAt)
                .containsExactly(1L, AdminActionType.ROLE_CHANGED, 2L, "USER -> ADMIN", NOW);
    }
}
