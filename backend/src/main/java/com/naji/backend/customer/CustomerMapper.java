package com.naji.backend.customer;

import com.naji.backend.customer.dto.CustomerRequest;
import com.naji.backend.customer.dto.CustomerResponse;
import org.springframework.stereotype.Component;

@Component
public class CustomerMapper {

    public Customer toEntity(CustomerRequest request) {
        Customer customer = new Customer();
        updateEntity(customer, request);
        return customer;
    }

    public void updateEntity(Customer customer, CustomerRequest request) {
        customer.setName(request.name());
        customer.setEmail(request.email());
        customer.setPhone(request.phone());
        customer.setStreet(request.street());
        customer.setPostalCode(request.postalCode());
        customer.setCity(request.city());
        customer.setCountry(request.country());
        customer.setSiret(request.siret());
        customer.setVatNumber(request.vatNumber());
    }

    public CustomerResponse toResponse(Customer customer) {
        return new CustomerResponse(
                customer.getId(),
                customer.getName(),
                customer.getEmail(),
                customer.getPhone(),
                customer.getStreet(),
                customer.getPostalCode(),
                customer.getCity(),
                customer.getCountry(),
                customer.getSiret(),
                customer.getVatNumber(),
                customer.getCreatedAt(),
                customer.getUpdatedAt()
        );
    }
}
