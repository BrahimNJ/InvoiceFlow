package com.naji.backend.customer;

import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.customer.dto.CustomerRequest;
import com.naji.backend.customer.dto.CustomerResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomerServiceTest {

    private static final Long OWNER_ID = 7L;

    @Mock
    private CustomerRepository customerRepository;

    private CustomerService customerService;

    @BeforeEach
    void setUp() {
        customerService = new CustomerService(customerRepository, new CustomerMapper());
    }

    @Test
    void create_savesCustomerForTheOwner() {
        when(customerRepository.save(any(Customer.class))).thenAnswer(invocation -> {
            Customer saved = invocation.getArgument(0);
            saved.setId(1L);
            return saved;
        });

        CustomerResponse response = customerService.create(OWNER_ID, request("ACME"));

        ArgumentCaptor<Customer> saved = ArgumentCaptor.forClass(Customer.class);
        verify(customerRepository).save(saved.capture());
        assertThat(saved.getValue().getOwnerId()).isEqualTo(OWNER_ID);
        assertThat(response.id()).isEqualTo(1L);
        assertThat(response.name()).isEqualTo("ACME");
    }

    @Test
    void findById_throwsWhenMissingOrOwnedBySomeoneElse() {
        when(customerRepository.findByIdAndOwnerId(42L, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> customerService.findById(OWNER_ID, 42L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("42");
    }

    @Test
    void update_changesExistingCustomer() {
        Customer existing = customer(1L, "Old name");
        when(customerRepository.findByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.of(existing));
        when(customerRepository.saveAndFlush(existing)).thenReturn(existing);

        CustomerResponse response = customerService.update(OWNER_ID, 1L, request("New name"));

        assertThat(response.name()).isEqualTo("New name");
        assertThat(existing.getOwnerId()).isEqualTo(OWNER_ID);
    }

    @Test
    void update_throwsWhenOwnedBySomeoneElse() {
        when(customerRepository.findByIdAndOwnerId(1L, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> customerService.update(OWNER_ID, 1L, request("New name")))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(customerRepository, never()).saveAndFlush(any());
    }

    @Test
    void delete_throwsWhenMissingOrOwnedBySomeoneElse() {
        when(customerRepository.findByIdAndOwnerId(42L, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> customerService.delete(OWNER_ID, 42L))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(customerRepository, never()).delete(any());
    }

    private static CustomerRequest request(String name) {
        return new CustomerRequest(name, "contact@acme.fr", null, null, null, null, null, null, null);
    }

    private static Customer customer(Long id, String name) {
        Customer customer = new Customer();
        customer.setId(id);
        customer.setOwnerId(OWNER_ID);
        customer.setName(name);
        customer.setEmail("contact@acme.fr");
        return customer;
    }
}
