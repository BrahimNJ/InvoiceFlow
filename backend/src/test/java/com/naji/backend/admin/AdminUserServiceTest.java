package com.naji.backend.admin;

import com.naji.backend.admin.dto.AdminUserResponse;
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

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminUserServiceTest {

    static final Instant NOW = Instant.parse("2026-11-18T10:00:00Z");

    @Mock
    private UserRepository userRepository;

    private AdminUserService service;

    @BeforeEach
    void setUp() {
        service = new AdminUserService(userRepository, new AdminUserMapper());
    }

    @Test
    void search_returnsAccountsWithoutSecrets() {
        User jane = user(1L, "jane@acme.fr", Role.USER);
        jane.setSuspendedAt(NOW);
        when(userRepository.search(eq("%acme%"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(jane), PageRequest.of(0, 20), 1));

        PageResponse<AdminUserResponse> page = service.search("ACME", 0, 20);

        assertThat(page.totalElements()).isEqualTo(1);
        assertThat(page.content()).containsExactly(new AdminUserResponse(
                1L, "jane@acme.fr", "Jane", "Doe", Role.USER, NOW, jane.getCreatedAt()));
    }

    @Test
    void search_clampsThePageAndSortsNewestFirst() {
        when(userRepository.search(eq("%"), any(Pageable.class))).thenReturn(new PageImpl<>(List.of()));

        service.search(null, -3, 1000);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(userRepository).search(eq("%"), pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isZero();
        assertThat(pageable.getValue().getPageSize()).isEqualTo(AdminUserService.MAX_PAGE_SIZE);
        assertThat(pageable.getValue().getSort())
                .isEqualTo(Sort.by("createdAt").descending().and(Sort.by("id").descending()));
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
