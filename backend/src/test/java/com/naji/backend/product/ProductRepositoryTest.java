package com.naji.backend.product;

import com.naji.backend.user.User;
import com.naji.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Runs the search query on the Flyway schema (V5): owner scoping, type filter, matching, escaping and paging. */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class ProductRepositoryTest {

    private static final PageRequest FIRST_PAGE = PageRequest.of(0, 20, Sort.by("name"));

    @Autowired
    private ProductRepository productRepository;

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
    void search_andFindById_onlyReachTheOwnersProducts() {
        save(ownerId, ProductType.SERVICE, "Consulting", null);
        Long othersProduct = save(otherOwnerId, ProductType.SERVICE, "Audit", null);

        assertThat(names(productRepository.search(ownerId, null, "%", FIRST_PAGE))).containsExactly("Consulting");
        assertThat(productRepository.findByIdAndOwnerId(othersProduct, ownerId)).isEmpty();
        assertThat(productRepository.findByIdAndOwnerId(othersProduct, otherOwnerId)).isPresent();
    }

    @Test
    void search_matchesNameOrDescriptionIgnoringCase() {
        save(ownerId, ProductType.SERVICE, "Web Design", "Landing PAGE and branding");
        save(ownerId, ProductType.SERVICE, "Page layout", null);
        save(ownerId, ProductType.GOODS, "Keyboard", "Mechanical keyboard");

        assertThat(names(productRepository.search(ownerId, null, "%page%", FIRST_PAGE)))
                .containsExactly("Page layout", "Web Design");
    }

    @Test
    void search_filtersByType() {
        save(ownerId, ProductType.SERVICE, "Consulting", null);
        save(ownerId, ProductType.GOODS, "Keyboard", null);

        assertThat(names(productRepository.search(ownerId, ProductType.GOODS, "%", FIRST_PAGE)))
                .containsExactly("Keyboard");
        assertThat(names(productRepository.search(ownerId, ProductType.SERVICE, "%", FIRST_PAGE)))
                .containsExactly("Consulting");
    }

    @Test
    void search_treatsEscapedWildcardsLiterally() {
        save(ownerId, ProductType.GOODS, "100% cotton shirt", null);
        save(ownerId, ProductType.GOODS, "1000 cotton shirts", null);

        assertThat(names(productRepository.search(ownerId, null, "%100!%%", FIRST_PAGE)))
                .containsExactly("100% cotton shirt");
    }

    @Test
    void search_returnsTheRequestedPage() {
        for (String name : List.of("Delta", "Alpha", "Echo", "Charlie", "Bravo")) {
            save(ownerId, ProductType.GOODS, name, null);
        }

        Page<Product> page = productRepository.search(ownerId, null, "%", PageRequest.of(1, 2, Sort.by("name")));

        assertThat(names(page)).containsExactly("Charlie", "Delta");
        assertThat(page.getTotalElements()).isEqualTo(5);
        assertThat(page.getTotalPages()).isEqualTo(3);
    }

    @Test
    void storesAmountsWithTwoDecimals() {
        Long id = save(ownerId, ProductType.GOODS, "Keyboard", null);

        Product product = productRepository.findById(id).orElseThrow();

        assertThat(product.getUnitPrice()).isEqualByComparingTo("49.90");
        assertThat(product.getVatRate()).isEqualByComparingTo("5.5");
    }

    @Test
    void rejectsAVatRateThatIsNotAFrenchRate() {
        Product product = product(ownerId, ProductType.GOODS, "Keyboard", null);
        product.setVatRate(new BigDecimal("19.60"));

        assertThatThrownBy(() -> productRepository.saveAndFlush(product))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private Long save(Long owner, ProductType type, String name, String description) {
        return productRepository.saveAndFlush(product(owner, type, name, description)).getId();
    }

    private static Product product(Long owner, ProductType type, String name, String description) {
        Product product = new Product();
        product.setOwnerId(owner);
        product.setType(type);
        product.setName(name);
        product.setDescription(description);
        product.setUnitPrice(new BigDecimal("49.90"));
        product.setVatRate(new BigDecimal("5.50"));
        product.setUnit(ProductUnit.UNIT);
        return product;
    }

    private User user() {
        User user = new User();
        user.setEmail("user-" + UUID.randomUUID() + "@acme.fr");
        user.setPasswordHash("{bcrypt}$2a$10$hash");
        user.setFirstName("Jane");
        user.setLastName("Doe");
        return userRepository.saveAndFlush(user);
    }

    private static List<String> names(Page<Product> page) {
        return page.getContent().stream().map(Product::getName).toList();
    }
}
