package com.naji.backend.customer;

import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.common.persistence.SearchPatterns;
import com.naji.backend.common.web.PageResponse;
import com.naji.backend.customer.dto.CustomerRequest;
import com.naji.backend.customer.dto.CustomerResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Every operation is scoped to the owner: a customer of another user is reported as not found,
 * exactly like a missing id, so its existence is not disclosed.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CustomerService {

    public static final int MAX_PAGE_SIZE = 100;

    /** Alphabetical, then by id so that pages stay stable when names are equal. */
    private static final Sort SORT = Sort.by("name").ascending().and(Sort.by("id").ascending());

    private final CustomerRepository customerRepository;
    private final CustomerMapper customerMapper;

    /**
     * One page of the owner's customers whose name or email contains {@code search} (case-insensitive,
     * taken literally). A blank search returns every customer. Out-of-range page and size are clamped.
     */
    public PageResponse<CustomerResponse> search(Long ownerId, String search, int page, int size) {
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        PageRequest pageRequest = PageRequest.of(Math.max(page, 0), pageSize, SORT);
        return PageResponse.of(
                customerRepository.search(ownerId, SearchPatterns.contains(search), pageRequest),
                customerMapper::toResponse);
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
