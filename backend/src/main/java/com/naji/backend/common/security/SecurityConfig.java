package com.naji.backend.common.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.web.servlet.HandlerExceptionResolver;

/**
 * Stateless API security: every request is authenticated by a signed JWT access token
 * (Spring OAuth2 resource server support, Nimbus), except the public endpoints below.
 */
@Configuration
@EnableConfigurationProperties({JwtProperties.class, RateLimitProperties.class})
public class SecurityConfig {

    /** Claim holding the user roles, e.g. {@code ["USER"]}. */
    public static final String ROLES_CLAIM = "roles";

    /** Endpoints reachable without an access token. */
    private static final String[] PUBLIC_AUTH_ENDPOINTS = {
            "/api/auth/register", "/api/auth/login", "/api/auth/refresh", "/api/auth/logout"
    };

    /** OpenAPI description and the Scalar reference: public, read-only documentation of the API contract. */
    private static final String[] API_DOCUMENTATION = {"/v3/api-docs", "/v3/api-docs/**", "/scalar", "/scalar/**"};

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            RateLimitProperties rateLimit,
            @Qualifier("handlerExceptionResolver") HandlerExceptionResolver exceptionResolver) throws Exception {
        // Created here rather than as a bean: a Filter bean would also be registered by Spring Boot outside security
        if (rateLimit.enabled()) {
            http.addFilterBefore(new AuthRateLimitFilter(rateLimit, exceptionResolver), BearerTokenAuthenticationFilter.class);
        }
        // 401 and 403 go through GlobalExceptionHandler, like every other API error (RFC 9457 ProblemDetail)
        AuthenticationEntryPoint entryPoint = (request, response, ex) ->
                exceptionResolver.resolveException(request, response, null, ex);
        AccessDeniedHandler accessDeniedHandler = (request, response, ex) ->
                exceptionResolver.resolveException(request, response, null, ex);

        return http
                // No cookie authenticates API calls (bearer token only), so CSRF tokens are not needed.
                // The refresh cookie endpoints have their own CSRF defense (see AuthController).
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, PUBLIC_AUTH_ENDPOINTS).permitAll()
                        .requestMatchers("/actuator/health", "/actuator/info", "/error").permitAll()
                        .requestMatchers(HttpMethod.GET, API_DOCUMENTATION).permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
                        .authenticationEntryPoint(entryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(entryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .build();
    }

    @Bean
    JwtEncoder jwtEncoder(JwtProperties properties) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(properties.secretKey()));
    }

    /** Accepts only HS256 tokens signed with our key, from our issuer, not expired (60 s clock skew). */
    @Bean
    JwtDecoder jwtDecoder(JwtProperties properties) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(properties.secretKey())
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(properties.issuer()));
        return decoder;
    }

    /** Maps the {@code roles} claim to {@code ROLE_*} authorities (used by role-based access, task 6.2). */
    @Bean
    JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter authorities = new JwtGrantedAuthoritiesConverter();
        authorities.setAuthoritiesClaimName(ROLES_CLAIM);
        authorities.setAuthorityPrefix("ROLE_");

        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(authorities);
        return converter;
    }

    /** BCrypt today; hashes carry an {@code {id}} prefix so the algorithm can change without a migration. */
    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }
}
