package com.naji.backend.company;

import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.common.security.SecurityConfig;
import com.naji.backend.company.dto.CompanyRequest;
import com.naji.backend.company.dto.CompanyResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.math.BigDecimal;
import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CompanyController.class)
@Import(SecurityConfig.class)
class CompanyControllerTest {

    private static final String VALID_BODY = """
            {"legalName": "Acme SAS", "legalForm": "SAS", "shareCapital": 10000, "street": "1 rue de la Paix",
             "postalCode": "75002", "city": "Paris", "country": "France", "siret": "73282932000074",
             "vatNumber": "FR44732829320", "vatRegime": "STANDARD", "registration": "RCS Paris"}
            """;

    private static final Long OWNER_ID = 7L;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CompanyService companyService;

    @Test
    void find_returnsTheCompanyOfTheSignedInUser() throws Exception {
        when(companyService.find(OWNER_ID)).thenReturn(response());

        mockMvc.perform(get("/api/company").with(owner()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.legalName").value("Acme SAS"))
                .andExpect(jsonPath("$.siren").value("732829320"))
                .andExpect(jsonPath("$.legalForm").value("SAS"))
                .andExpect(jsonPath("$.vatRegime").value("STANDARD"));
    }

    @Test
    void find_returns404BeforeTheFirstSave() throws Exception {
        when(companyService.find(OWNER_ID)).thenThrow(new ResourceNotFoundException("No company details recorded yet"));

        mockMvc.perform(get("/api/company").with(owner()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("No company details recorded yet"));
    }

    @Test
    void save_returnsTheSavedCompany() throws Exception {
        when(companyService.save(eq(OWNER_ID), any(CompanyRequest.class))).thenReturn(response());

        mockMvc.perform(put("/api/company").with(owner()).contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(3));
    }

    @Test
    void save_returns400WithTheFieldErrors() throws Exception {
        String body = """
                {"legalName": "Acme SAS", "legalForm": "SAS", "street": "1 rue de la Paix", "postalCode": "75002",
                 "city": "Paris", "country": "France", "siret": "73282932000075", "vatRegime": "STANDARD"}
                """;

        mockMvc.perform(put("/api/company").with(owner()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.siret").value("must be a valid SIRET (14 digits)"))
                .andExpect(jsonPath("$.errors.shareCapital").value("is required for this legal form"))
                .andExpect(jsonPath("$.errors.vatNumber").value("is required under the standard VAT regime"));
        verify(companyService, never()).save(any(), any());
    }

    @Test
    void requiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/company")).andExpect(status().isUnauthorized());
        mockMvc.perform(put("/api/company").contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isUnauthorized());
    }

    private static RequestPostProcessor owner() {
        return jwt().jwt(token -> token.subject(OWNER_ID.toString()));
    }

    private static CompanyResponse response() {
        return new CompanyResponse(3L, "Acme SAS", null, LegalForm.SAS, new BigDecimal("10000.00"),
                "1 rue de la Paix", "75002", "Paris", "France", "73282932000074", "732829320", "FR44732829320",
                VatRegime.STANDARD, "RCS Paris", null, null, null, null, Instant.EPOCH, Instant.EPOCH);
    }
}
