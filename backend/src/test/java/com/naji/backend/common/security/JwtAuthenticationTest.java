package com.naji.backend.common.security;

import com.naji.backend.customer.CustomerController;
import com.naji.backend.customer.CustomerService;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Real tokens through the real decoder: signature, issuer and expiry are all enforced. */
@WebMvcTest(CustomerController.class)
@Import(SecurityConfig.class)
class JwtAuthenticationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtEncoder jwtEncoder;

    @Autowired
    private JwtProperties jwtProperties;

    @Autowired
    private JwtAuthenticationConverter jwtAuthenticationConverter;

    @MockitoBean
    private CustomerService customerService;

    @Test
    void validToken_isAccepted() throws Exception {
        String token = encode(jwtEncoder, claims(jwtProperties.issuer(), Instant.now().plusSeconds(300)));

        mockMvc.perform(get("/api/customers").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void expiredToken_isRejected() throws Exception {
        // Beyond the 60 s clock skew tolerated by the decoder
        String token = encode(jwtEncoder, claims(jwtProperties.issuer(), Instant.now().minusSeconds(120)));

        expectInvalidToken(token);
    }

    @Test
    void tokenFromAnotherIssuer_isRejected() throws Exception {
        String token = encode(jwtEncoder, claims("https://evil.example.com", Instant.now().plusSeconds(300)));

        expectInvalidToken(token);
    }

    @Test
    void tokenSignedWithAnotherKey_isRejected() throws Exception {
        SecretKeySpec otherKey = new SecretKeySpec(
                "another-secret-of-at-least-thirty-two-bytes".getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        JwtEncoder forger = new NimbusJwtEncoder(new ImmutableSecret<>(otherKey));
        String token = encode(forger, claims(jwtProperties.issuer(), Instant.now().plusSeconds(300)));

        expectInvalidToken(token);
    }

    @Test
    void malformedToken_isRejected() throws Exception {
        expectInvalidToken("not-a-jwt");
    }

    @Test
    void rolesClaim_isMappedToAuthorities() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject("1")
                .claim(SecurityConfig.ROLES_CLAIM, List.of("USER", "ADMIN"))
                .build();

        List<String> authorities = jwtAuthenticationConverter.convert(jwt).getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(authority -> authority.startsWith("ROLE_")) // Spring Security 7 also adds FACTOR_BEARER
                .toList();

        assertThat(authorities).containsExactlyInAnyOrder("ROLE_USER", "ROLE_ADMIN");
    }

    private void expectInvalidToken(String token) throws Exception {
        mockMvc.perform(get("/api/customers").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, "Bearer error=\"invalid_token\""))
                .andExpect(jsonPath("$.detail").value("Invalid or expired access token"));
    }

    private static JwtClaimsSet claims(String issuer, Instant expiresAt) {
        return JwtClaimsSet.builder()
                .issuer(issuer)
                .subject("1")
                .issuedAt(expiresAt.minusSeconds(900))
                .expiresAt(expiresAt)
                .claim(SecurityConfig.ROLES_CLAIM, List.of("USER"))
                .build();
    }

    private static String encode(JwtEncoder encoder, JwtClaimsSet claims) {
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }
}
