package com.naji.backend.admin;

import com.naji.backend.admin.dto.AdminUserResponse;
import com.naji.backend.common.exception.ConflictException;
import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.common.persistence.SearchPatterns;
import com.naji.backend.common.web.PageResponse;
import com.naji.backend.user.Role;
import com.naji.backend.user.User;
import com.naji.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Account management for admins (ADR 0010). */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminUserService {

    public static final int MAX_PAGE_SIZE = 100;
    static final String OWN_ROLE = "You cannot change your own role";

    /** Newest accounts first, then by id so that pages stay stable. */
    private static final Sort SORT = Sort.by("createdAt").descending().and(Sort.by("id").descending());

    private final UserRepository userRepository;
    private final AdminUserMapper adminUserMapper;
    private final AdminAccess adminAccess;

    /**
     * One page of the accounts whose email or name contains {@code search} (case-insensitive, taken literally).
     * A blank search returns every account. Out-of-range page and size are clamped.
     */
    public PageResponse<AdminUserResponse> search(Long adminId, String search, int page, int size) {
        adminAccess.requireActiveAdmin(adminId);
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        PageRequest pageRequest = PageRequest.of(Math.max(page, 0), pageSize, SORT);
        return PageResponse.of(userRepository.search(SearchPatterns.contains(search), pageRequest),
                adminUserMapper::toResponse);
    }

    /**
     * Gives {@code role} to another account. Setting the role it already has changes nothing. An admin cannot change
     * their own role, so the platform always keeps the caller as an active admin.
     */
    @Transactional
    public AdminUserResponse changeRole(Long adminId, Long userId, Role role) {
        User target = startChange(adminId, userId, OWN_ROLE);
        target.setRole(role);
        return adminUserMapper.toResponse(target);
    }

    /**
     * Common start of every change made to an account: refuses a change on the caller's own account, takes the admin
     * lock, then checks the caller again under that lock. Two admins demoting or suspending each other at the same time
     * run one after the other, and the second one is refused because it is no longer an active admin.
     */
    private User startChange(Long adminId, Long userId, String ownAccountMessage) {
        if (adminId.equals(userId)) {
            throw new ConflictException(ownAccountMessage);
        }
        if (!userRepository.lockActiveAdminIds().contains(adminId)) {
            throw new AccessDeniedException(AdminAccess.NOT_AN_ACTIVE_ADMIN);
        }
        return userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User", userId));
    }
}
