package com.naji.backend.admin;

import com.naji.backend.admin.dto.AdminUserResponse;
import com.naji.backend.common.persistence.SearchPatterns;
import com.naji.backend.common.web.PageResponse;
import com.naji.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Account management for admins (ADR 0010). */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminUserService {

    public static final int MAX_PAGE_SIZE = 100;

    /** Newest accounts first, then by id so that pages stay stable. */
    private static final Sort SORT = Sort.by("createdAt").descending().and(Sort.by("id").descending());

    private final UserRepository userRepository;
    private final AdminUserMapper adminUserMapper;

    /**
     * One page of the accounts whose email or name contains {@code search} (case-insensitive, taken literally).
     * A blank search returns every account. Out-of-range page and size are clamped.
     */
    public PageResponse<AdminUserResponse> search(String search, int page, int size) {
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        PageRequest pageRequest = PageRequest.of(Math.max(page, 0), pageSize, SORT);
        return PageResponse.of(userRepository.search(SearchPatterns.contains(search), pageRequest),
                adminUserMapper::toResponse);
    }
}
