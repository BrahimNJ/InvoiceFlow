package com.naji.backend.admin;

import com.naji.backend.admin.dto.AdminActionResponse;
import com.naji.backend.common.web.PageResponse;
import com.naji.backend.user.User;
import com.naji.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/** Reads the audit log, newest first. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminAuditService {

    public static final int MAX_PAGE_SIZE = 100;

    private final AdminActionRepository adminActionRepository;
    private final UserRepository userRepository;
    private final AdminAccess adminAccess;

    public PageResponse<AdminActionResponse> list(Long adminId, int page, int size) {
        adminAccess.requireActiveAdmin(adminId);
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Page<AdminAction> actions = adminActionRepository.findAllByOrderByCreatedAtDescIdDesc(
                PageRequest.of(Math.max(page, 0), pageSize));

        // One query for the emails of every account on the page
        Map<Long, String> emails = userRepository.findAllById(actions.stream()
                        .flatMap(action -> Stream.of(action.getAdminId(), action.getTargetUserId()))
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(User::getId, User::getEmail));

        Function<AdminAction, AdminActionResponse> toResponse = action -> new AdminActionResponse(
                action.getId(),
                action.getAction(),
                action.getAdminId(),
                action.getAdminId() == null ? null : emails.get(action.getAdminId()),
                action.getTargetUserId(),
                emails.get(action.getTargetUserId()),
                action.getDetails(),
                action.getCreatedAt());
        return PageResponse.of(actions, toResponse);
    }
}
