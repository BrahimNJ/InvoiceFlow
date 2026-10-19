package com.naji.backend.customer;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CustomerRepository extends JpaRepository<Customer, Long> {

    /**
     * Customers of an owner whose name or email matches a lower-case {@code LIKE} pattern
     * ({@code !} escapes {@code %}, {@code _} and itself). The pattern {@code %} matches every customer.
     */
    @Query("""
            select c from Customer c
            where c.ownerId = :ownerId
              and (lower(c.name) like :pattern escape '!' or lower(c.email) like :pattern escape '!')
            """)
    Page<Customer> search(@Param("ownerId") Long ownerId, @Param("pattern") String pattern, Pageable pageable);

    Optional<Customer> findByIdAndOwnerId(Long id, Long ownerId);
}
