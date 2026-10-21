package com.naji.backend.product;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long> {

    /**
     * Products of an owner whose name or description matches a lower-case {@code LIKE} pattern
     * ({@code !} escapes {@code %}, {@code _} and itself), optionally of one type ({@code null}: every type).
     * The pattern {@code %} matches every product.
     */
    @Query("""
            select p from Product p
            where p.ownerId = :ownerId
              and (:type is null or p.type = :type)
              and (lower(p.name) like :pattern escape '!' or lower(p.description) like :pattern escape '!')
            """)
    Page<Product> search(
            @Param("ownerId") Long ownerId,
            @Param("type") ProductType type,
            @Param("pattern") String pattern,
            Pageable pageable);

    Optional<Product> findByIdAndOwnerId(Long id, Long ownerId);
}
