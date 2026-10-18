package com.naji.backend.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    /** Expects an email already normalized with {@link User#normalizeEmail(String)}. */
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);
}
