package com.naji.backend.common.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI description generated from the controllers (springdoc), browsable with Scalar at {@code /scalar}.
 * Every operation requires the bearer access token except the public authentication endpoints, which declare so.
 */
@Configuration
public class OpenApiConfig {

    static final String BEARER = "bearer-jwt";

    @Bean
    OpenAPI invoiceFlowOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("InvoiceFlow API")
                        .version("v1")
                        .description("""
                                Invoicing for the French e-invoicing reform. Every resource belongs to the signed-in \
                                account: another account's id answers 404. Errors are RFC 9457 problem details \
                                (`application/problem+json`). Sign in with `POST /api/auth/login`, then send the \
                                access token as `Authorization: Bearer <token>`.""")
                        .license(new License().name("Source on GitHub").url("https://github.com/BrahimNJ/InvoiceFlow")))
                .components(new Components().addSecuritySchemes(BEARER, new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")
                        .description("Access token from /api/auth/login, valid 15 minutes")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER));
    }
}
