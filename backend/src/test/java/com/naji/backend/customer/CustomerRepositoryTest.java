package com.naji.backend.customer;

import com.naji.backend.user.User;
import com.naji.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Runs the search query on the Flyway schema (V4): owner scoping, matching, escaping and paging. */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class CustomerRepositoryTest {

    private static final PageRequest FIRST_PAGE = PageRequest.of(0, 20, Sort.by("name"));

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private UserRepository userRepository;

    private Long ownerId;
    private Long otherOwnerId;

    @BeforeEach
    void setUp() {
        ownerId = user().getId();
        otherOwnerId = user().getId();
    }

    @Test
    void search_andFindById_onlyReachTheOwnersCustomers() {
        save(ownerId, "ACME", "contact@acme.fr");
        Long othersCustomer = save(otherOwnerId, "Globex", "hello@globex.com");

        assertThat(names(customerRepository.search(ownerId, "%", FIRST_PAGE))).containsExactly("ACME");
        assertThat(customerRepository.findByIdAndOwnerId(othersCustomer, ownerId)).isEmpty();
        assertThat(customerRepository.findByIdAndOwnerId(othersCustomer, otherOwnerId)).isPresent();
    }

    @Test
    void search_matchesNameOrEmail() {
        save(ownerId, "ACME", "contact@acme.fr");
        save(ownerId, "Globex", "billing@acme-group.com");
        save(ownerId, "Initech", "it@initech.com");

        assertThat(names(customerRepository.search(ownerId, "%acme%", FIRST_PAGE)))
                .containsExactly("ACME", "Globex");
    }

    @Test
    void search_ignoresTheCaseOfStoredValues() {
        save(ownerId, "Dupont SARL", "Compta@Dupont.FR");

        assertThat(names(customerRepository.search(ownerId, "%dupont.fr%", FIRST_PAGE)))
                .containsExactly("Dupont SARL");
    }

    @Test
    void search_treatsEscapedWildcardsLiterally() {
        save(ownerId, "100% Bio", "contact@bio.fr");
        save(ownerId, "1000 Bio", "hello@bio.fr");

        assertThat(names(customerRepository.search(ownerId, "%100!%%", FIRST_PAGE))).containsExactly("100% Bio");
    }

    @Test
    void search_returnsTheRequestedPage() {
        for (String name : List.of("Delta", "Alpha", "Echo", "Charlie", "Bravo")) {
            save(ownerId, name, name.toLowerCase() + "@acme.fr");
        }

        Page<Customer> page = customerRepository.search(ownerId, "%", PageRequest.of(1, 2, Sort.by("name")));

        assertThat(names(page)).containsExactly("Charlie", "Delta");
        assertThat(page.getTotalElements()).isEqualTo(5);
        assertThat(page.getTotalPages()).isEqualTo(3);
    }

    private Long save(Long owner, String name, String email) {
        Customer customer = new Customer();
        customer.setOwnerId(owner);
        customer.setName(name);
        customer.setEmail(email);
        return customerRepository.saveAndFlush(customer).getId();
    }

    private User user() {
        User user = new User();
        user.setEmail("user-" + UUID.randomUUID() + "@acme.fr");
        user.setPasswordHash("{bcrypt}$2a$10$hash");
        user.setFirstName("Jane");
        user.setLastName("Doe");
        return userRepository.saveAndFlush(user);
    }

    private static List<String> names(Page<Customer> page) {
        return page.getContent().stream().map(Customer::getName).toList();
    }
}
