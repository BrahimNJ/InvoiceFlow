package com.naji.backend.company;

import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.company.dto.CompanyRequest;
import com.naji.backend.company.dto.CompanyResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CompanyServiceTest {

    private static final Long OWNER_ID = 7L;

    @Mock
    private CompanyRepository companyRepository;

    private CompanyService companyService;

    @BeforeEach
    void setUp() {
        companyService = new CompanyService(companyRepository, new CompanyMapper());
    }

    @Test
    void find_returnsTheOwnersCompany() {
        when(companyRepository.findByOwnerId(OWNER_ID)).thenReturn(Optional.of(company("Acme SAS")));

        assertThat(companyService.find(OWNER_ID).legalName()).isEqualTo("Acme SAS");
    }

    @Test
    void find_reportsNotFoundBeforeTheFirstSave() {
        when(companyRepository.findByOwnerId(OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> companyService.find(OWNER_ID))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("No company details recorded yet");
    }

    @Test
    void save_createsTheCompanyForTheOwnerOnTheFirstCall() {
        when(companyRepository.findByOwnerId(OWNER_ID)).thenReturn(Optional.empty());
        when(companyRepository.saveAndFlush(any(Company.class))).thenAnswer(call -> call.getArgument(0));

        CompanyResponse response = companyService.save(OWNER_ID, request("Acme SAS"));

        ArgumentCaptor<Company> saved = ArgumentCaptor.forClass(Company.class);
        verify(companyRepository).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getOwnerId()).isEqualTo(OWNER_ID);
        assertThat(response.legalName()).isEqualTo("Acme SAS");
        assertThat(response.siren()).isEqualTo("732829320");
    }

    @Test
    void save_updatesTheExistingCompanyInPlace() {
        Company existing = company("Old name");
        existing.setId(3L);
        when(companyRepository.findByOwnerId(OWNER_ID)).thenReturn(Optional.of(existing));
        when(companyRepository.saveAndFlush(existing)).thenReturn(existing);

        CompanyResponse response = companyService.save(OWNER_ID, request("Acme SAS"));

        assertThat(response.id()).isEqualTo(3L);
        assertThat(existing.getLegalName()).isEqualTo("Acme SAS");
        assertThat(existing.getOwnerId()).isEqualTo(OWNER_ID);
    }

    private static CompanyRequest request(String legalName) {
        return new CompanyRequest(legalName, null, LegalForm.SAS, new BigDecimal("10000"), "1 rue de la Paix",
                "75002", "Paris", "France", "73282932000074", "FR44732829320", VatRegime.STANDARD, "RCS Paris",
                null, null, null, null);
    }

    private static Company company(String legalName) {
        Company company = new Company();
        company.setOwnerId(OWNER_ID);
        company.setLegalName(legalName);
        company.setLegalForm(LegalForm.SAS);
        company.setSiret("73282932000074");
        company.setVatRegime(VatRegime.STANDARD);
        return company;
    }
}
