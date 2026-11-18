package com.naji.backend.admin;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Immutable;

import java.time.Instant;

/** One line of the audit log. Immutable: Hibernate never issues an update for it. */
@Entity
@Immutable
@Table(name = "admin_actions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AdminAction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** {@code null} for a promotion from {@code ADMIN_EMAILS}. */
    @Column(updatable = false)
    private Long adminId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 40)
    private AdminActionType action;

    @Column(nullable = false, updatable = false)
    private Long targetUserId;

    @Column(updatable = false)
    private String details;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public AdminAction(Long adminId, AdminActionType action, Long targetUserId, String details, Instant createdAt) {
        this.adminId = adminId;
        this.action = action;
        this.targetUserId = targetUserId;
        this.details = details;
        this.createdAt = createdAt;
    }
}
