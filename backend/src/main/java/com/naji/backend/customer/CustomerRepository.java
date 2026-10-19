package com.naji.backend.customer;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CustomerRepository extends JpaRepository<Customer, Long> {

    List<Customer> findAllByOwnerId(Long ownerId);

    Optional<Customer> findByIdAndOwnerId(Long id, Long ownerId);
}
