package com.naji.backend.company;

import com.naji.backend.company.dto.CompanyRequest;
import com.naji.backend.company.dto.CompanyResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The company (seller details) of the signed-in user, identified by the subject of the access token. */
@RestController
@RequestMapping("/api/company")
@RequiredArgsConstructor
public class CompanyController {

    private final CompanyService companyService;

    /** {@code GET /api/company}: 404 until the company has been saved once. */
    @GetMapping
    public CompanyResponse find(@AuthenticationPrincipal Jwt jwt) {
        return companyService.find(ownerId(jwt));
    }

    /** {@code PUT /api/company}: creates the company on the first call, replaces its details afterwards. */
    @PutMapping
    public CompanyResponse save(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CompanyRequest request) {
        return companyService.save(ownerId(jwt), request);
    }

    private static Long ownerId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
