package com.naji.backend.auth;

import com.naji.backend.common.security.JwtProperties;
import com.naji.backend.user.Role;
import com.naji.backend.user.User;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

class AccessTokenServiceTest {

    private static final JwtProperties PROPERTIES = new JwtProperties(
            "test-only-secret-not-for-production-32-bytes", "invoiceflow", Duration.ofMinutes(15));

    private final Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
    private final AccessTokenService service = new AccessTokenService(
            new NimbusJwtEncoder(new ImmutableSecret<>(PROPERTIES.secretKey())),
            PROPERTIES,
            Clock.fixed(now, ZoneOffset.UTC));

    @Test
    void issue_signsTokenWithUserClaims() {
        IssuedToken token = service.issue(user());

        Jwt jwt = NimbusJwtDecoder.withSecretKey(PROPERTIES.secretKey())
                .macAlgorithm(MacAlgorithm.HS256)
                .build()
                .decode(token.value());

        assertThat(jwt.getHeaders()).containsEntry("alg", "HS256");
        assertThat(jwt.getSubject()).isEqualTo("7");
        assertThat(jwt.getClaimAsString("iss")).isEqualTo("invoiceflow");
        assertThat(jwt.getClaimAsString("email")).isEqualTo("jane@acme.fr");
        assertThat(jwt.getClaimAsStringList("roles")).containsExactly("USER");
        assertThat(jwt.getId()).isNotBlank();
        assertThat(jwt.getIssuedAt()).isEqualTo(now);
        assertThat(jwt.getExpiresAt()).isEqualTo(now.plus(Duration.ofMinutes(15)));
        assertThat(token.expiresAt()).isEqualTo(jwt.getExpiresAt());
    }

    @Test
    void issue_givesEachTokenAUniqueId() {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(PROPERTIES.secretKey()).build();

        String first = decoder.decode(service.issue(user()).value()).getId();
        String second = decoder.decode(service.issue(user()).value()).getId();

        assertThat(first).isNotEqualTo(second);
    }

    @Test
    void issuedToken_toStringHidesTheValue() {
        IssuedToken token = service.issue(user());

        assertThat(token.toString()).doesNotContain(token.value());
    }

    private static User user() {
        User user = new User();
        user.setId(7L);
        user.setEmail("jane@acme.fr");
        user.setRole(Role.USER);
        return user;
    }
}
