package com.naji.backend.auth;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({RefreshTokenProperties.class, RefreshCookieProperties.class})
public class AuthConfig {
}
