package com.naji.backend.admin;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminActionRepository extends JpaRepository<AdminAction, Long> {

    /** Newest first; the id breaks ties between actions recorded in the same instant. */
    Page<AdminAction> findAllByOrderByCreatedAtDescIdDesc(Pageable pageable);
}
