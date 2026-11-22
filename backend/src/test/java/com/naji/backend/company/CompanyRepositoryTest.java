package com.naji.backend.company;

import com.naji.backend.user.User;
import com.naji.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Runs on the Flyway schema (V12): one company per owner, owner lookup and database constraints. */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class CompanyRepositoryTest {

    @Autowired
    private CompanyRepository companyRepository;

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
    void findByOwnerId_onlyReachesTheOwnersCompany() {
        companyRepository.saveAndFlush(company(ownerId, "Acme SAS"));
        companyRepository.saveAndFlush(company(otherOwnerId, "Globex SARL"));

        assertThat(companyRepository.findByOwnerId(ownerId)).get()
                .extracting(Company::getLegalName).isEqualTo("Acme SAS");
        assertThat(companyRepository.findByOwnerId(user().getId())).isEmpty();
    }

    @Test
    void storesTheDetailsAndDerivesTheSiren() {
        Long id = companyRepository.saveAndFlush(company(ownerId, "Acme SAS")).getId();

        Company company = companyRepository.findById(id).orElseThrow();

        assertThat(company.getShareCapital()).isEqualByComparingTo("10000.00");
        assertThat(company.getLegalForm()).isEqualTo(LegalForm.SAS);
        assertThat(company.getVatRegime()).isEqualTo(VatRegime.STANDARD);
        assertThat(company.getSiren()).isEqualTo("732829320");
        assertThat(company.getCreatedAt()).isNotNull();
        assertThat(company.getUpdatedAt()).isEqualTo(company.getCreatedAt());
    }

    @Test
    void rejectsASecondCompanyForTheSameOwner() {
        companyRepository.saveAndFlush(company(ownerId, "Acme SAS"));

        assertThatThrownBy(() -> companyRepository.saveAndFlush(company(ownerId, "Acme bis")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsANegativeShareCapital() {
        Company company = company(ownerId, "Acme SAS");
        company.setShareCapital(new BigDecimal("-1"));

        assertThatThrownBy(() -> companyRepository.saveAndFlush(company))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void sirenIsNullWithoutAFullSiret() {
        Company company = new Company();
        assertThat(company.getSiren()).isNull();

        company.setSiret("1234567890");
        assertThat(company.getSiren()).isNull();
    }

    @Test
    void onlyCommercialCompaniesRequireAShareCapital() {
        assertThat(LegalForm.SAS.requiresShareCapital()).isTrue();
        assertThat(LegalForm.SARL.requiresShareCapital()).isTrue();
        assertThat(LegalForm.EI.requiresShareCapital()).isFalse();
        assertThat(LegalForm.EI_MICRO.requiresShareCapital()).isFalse();
    }

    private static Company company(Long owner, String legalName) {
        Company company = new Company();
        company.setOwnerId(owner);
        company.setLegalName(legalName);
        company.setLegalForm(LegalForm.SAS);
        company.setShareCapital(new BigDecimal("10000"));
        company.setStreet("1 rue de la Paix");
        company.setPostalCode("75002");
        company.setCity("Paris");
        company.setCountry("France");
        company.setSiret("73282932000074");
        company.setVatNumber("FR44732829320");
        company.setVatRegime(VatRegime.STANDARD);
        company.setRegistration("RCS Paris");
        return company;
    }

    private User user() {
        User user = new User();
        user.setEmail("user-" + UUID.randomUUID() + "@acme.fr");
        user.setPasswordHash("{bcrypt}$2a$10$hash");
        user.setFirstName("Jane");
        user.setLastName("Doe");
        return userRepository.saveAndFlush(user);
    }
}
