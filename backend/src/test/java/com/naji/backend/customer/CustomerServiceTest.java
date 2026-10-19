package com.naji.backend.customer;

import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.common.web.PageResponse;
import com.naji.backend.customer.dto.CustomerRequest;
import com.naji.backend.customer.dto.CustomerResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
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
    void search_returnsAPageSortedByName() {
        Pageable expected = PageRequest.of(1, 20, Sort.by("name").ascending().and(Sort.by("id").ascending()));
        Page<Customer> page = new PageImpl<>(List.of(customer(1L, "ACME")), expected, 21);
        when(customerRepository.search(OWNER_ID, "%", expected)).thenReturn(page);

        PageResponse<CustomerResponse> response = customerService.search(OWNER_ID, null, 1, 20);

        assertThat(response.content()).extracting(CustomerResponse::name).containsExactly("ACME");
        assertThat(response.page()).isEqualTo(1);
        assertThat(response.size()).isEqualTo(20);
        assertThat(response.totalElements()).isEqualTo(21);
        assertThat(response.totalPages()).isEqualTo(2);
    }

    @Test
    void search_buildsACaseInsensitiveLiteralPattern() {
        when(customerRepository.search(eq(OWNER_ID), anyString(), any(Pageable.class))).thenReturn(Page.empty());

        customerService.search(OWNER_ID, "  100%_Bio! ", 0, 20);

        verify(customerRepository).search(eq(OWNER_ID), eq("%100!%!_bio!!%"), any(Pageable.class));
    }

    @Test
    void search_treatsABlankSearchAsNoFilter() {
        when(customerRepository.search(eq(OWNER_ID), anyString(), any(Pageable.class))).thenReturn(Page.empty());

        customerService.search(OWNER_ID, "   ", 0, 20);

        verify(customerRepository).search(eq(OWNER_ID), eq("%"), any(Pageable.class));
    }

    @Test
    void search_clampsPageAndSize() {
        when(customerRepository.search(eq(OWNER_ID), anyString(), any(Pageable.class))).thenReturn(Page.empty());
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);

        customerService.search(OWNER_ID, null, -3, 5000);
        customerService.search(OWNER_ID, null, 0, 0);

        verify(customerRepository, times(2)).search(eq(OWNER_ID), eq("%"), pageable.capture());
        assertThat(pageable.getAllValues().get(0).getPageNumber()).isZero();
        assertThat(pageable.getAllValues().get(0).getPageSize()).isEqualTo(CustomerService.MAX_PAGE_SIZE);
        assertThat(pageable.getAllValues().get(1).getPageSize()).isEqualTo(1);
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
