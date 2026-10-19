package com.naji.backend.customer;

import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.customer.dto.CustomerRequest;
import com.naji.backend.customer.dto.CustomerResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Every operation is scoped to the owner: a customer of another user is reported as not found,
 * exactly like a missing id, so its existence is not disclosed.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final CustomerMapper customerMapper;

    public List<CustomerResponse> findAll(Long ownerId) {
        return customerRepository.findAllByOwnerId(ownerId).stream()
                .map(customerMapper::toResponse)
                .toList();
    }

    public CustomerResponse findById(Long ownerId, Long id) {
        return customerMapper.toResponse(getCustomer(ownerId, id));
    }

    @Transactional
    public CustomerResponse create(Long ownerId, CustomerRequest request) {
        Customer customer = customerMapper.toEntity(request);
        customer.setOwnerId(ownerId);
        return customerMapper.toResponse(customerRepository.save(customer));
    }

    @Transactional
    public CustomerResponse update(Long ownerId, Long id, CustomerRequest request) {
        Customer customer = getCustomer(ownerId, id);
        customerMapper.updateEntity(customer, request);
        return customerMapper.toResponse(customerRepository.saveAndFlush(customer));
    }

    @Transactional
    public void delete(Long ownerId, Long id) {
        customerRepository.delete(getCustomer(ownerId, id));
    }

    private Customer getCustomer(Long ownerId, Long id) {
        return customerRepository.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", id));
    }
}
