package com.naji.backend.admin;

import com.naji.backend.user.User;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;
import java.util.Objects;

/**
 * Admin settings ({@code app.admin.*}).
 *
 * @param emails accounts promoted to admin at startup and at sign-up ({@code ADMIN_EMAILS}, comma-separated); normalized,
 *               blanks dropped
 */
@ConfigurationProperties("app.admin")
public record AdminProperties(List<String> emails) {

    public AdminProperties {
        emails = emails == null ? List.of() : emails.stream()
                .filter(Objects::nonNull)
                .map(User::normalizeEmail)
                .filter(email -> !email.isEmpty())
                .distinct()
                .toList();
    }
}
