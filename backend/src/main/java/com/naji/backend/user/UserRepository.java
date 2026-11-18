package com.naji.backend.user;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    /** Expects an email already normalized with {@link User#normalizeEmail(String)}. */
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    /**
     * Every account whose email, first name or last name matches a lower-case {@code LIKE} pattern
     * ({@code !} escapes {@code %}, {@code _} and itself). Admin back-office only (ADR 0010).
     */
    @Query("""
            select u from User u
            where lower(u.email) like :pattern escape '!'
               or lower(u.firstName) like :pattern escape '!'
               or lower(u.lastName) like :pattern escape '!'
            """)
    Page<User> search(@Param("pattern") String pattern, Pageable pageable);

    long countByRole(Role role);

    long countBySuspendedAtIsNotNull();

    long countByRoleAndSuspendedAtIsNull(Role role);

    long countByCreatedAtGreaterThanEqual(Instant since);

    /**
     * Ids of the active admins, with their rows locked until the transaction ends ({@code SELECT … FOR UPDATE}).
     * Every change of a role or a suspension takes this lock first, so two admins acting on each other run one after
     * the other and the platform always keeps an active admin (ADR 0010). Ids rather than entities, so that the result
     * is read from the database even when the accounts are already loaded in the persistence context.
     */
    @Query(value = "select id from users where role = 'ADMIN' and suspended_at is null order by id for update",
            nativeQuery = true)
    List<Long> lockActiveAdminIds();
}
