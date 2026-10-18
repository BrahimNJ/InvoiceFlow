package com.naji.backend.auth;

import com.naji.backend.auth.dto.LoginRequest;
import com.naji.backend.auth.dto.RegisterRequest;
import com.naji.backend.common.config.ClockConfig;
import com.naji.backend.common.exception.ConflictException;
import com.naji.backend.common.security.SecurityConfig;
import com.naji.backend.user.Role;
import com.naji.backend.user.dto.UserResponse;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;

import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, AuthConfig.class, RefreshTokenCookies.class, ClockConfig.class})
// Production cookie settings (frontend and API on different sites)
@TestPropertySource(properties = {
        "app.security.refresh-cookie.secure=true",
        "app.security.refresh-cookie.same-site=None"
})
class AuthControllerTest {

    private static final String REGISTER_BODY = """
            {"firstName": "Jane", "lastName": "Doe", "email": "jane@acme.fr", "password": "Correct-horse-42"}
            """;
    private static final String LOGIN_BODY = """
            {"email": "jane@acme.fr", "password": "Correct-horse-42"}
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @Test
    void register_returns201WithAccessTokenAndRefreshCookie() throws Exception {
        when(authService.register(any(RegisterRequest.class))).thenReturn(session("new-refresh"));

        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(REGISTER_BODY))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, "/api/auth/me"))
                .andExpect(jsonPath("$.accessToken").value("access-token"))
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.expiresIn").isNumber())
                .andExpect(jsonPath("$.user.email").value("jane@acme.fr"))
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, allOf(
                        containsString("refresh_token=new-refresh"),
                        containsString("Path=/api/auth"),
                        containsString("HttpOnly"),
                        containsString("Secure"),
                        containsString("SameSite=None"),
                        containsString("Max-Age="))));
    }

    @Test
    void register_returns400WithFieldErrors() throws Exception {
        String invalid = """
                {"firstName": "", "lastName": "Doe", "email": "not-an-email", "password": "weak"}
                """;

        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(invalid))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.firstName").exists())
                .andExpect(jsonPath("$.errors.email").exists())
                .andExpect(jsonPath("$.errors.password").exists());
        verifyNoInteractions(authService);
    }

    @Test
    void register_returns409WhenEmailIsTaken() throws Exception {
        when(authService.register(any(RegisterRequest.class)))
                .thenThrow(new ConflictException("An account already exists with this email"));

        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(REGISTER_BODY))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("An account already exists with this email"));
    }

    @Test
    void login_returns200WithTokens() throws Exception {
        when(authService.login(any(LoginRequest.class))).thenReturn(session("new-refresh"));

        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("access-token"))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("refresh_token=new-refresh")));
    }

    @Test
    void login_returns401WithGenericMessage() throws Exception {
        when(authService.login(any(LoginRequest.class)))
                .thenThrow(new BadCredentialsException("Invalid email or password"));

        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Invalid email or password"))
                .andExpect(header().doesNotExist(HttpHeaders.SET_COOKIE));
    }

    @Test
    void login_returns429WhenTheAccountIsLocked() throws Exception {
        when(authService.login(any(LoginRequest.class))).thenThrow(new LockedException("Too many failed sign-in attempts"));

        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.detail").value("Too many failed sign-in attempts"));
    }

    @Test
    void refresh_rotatesTheCookie() throws Exception {
        when(authService.refresh("old-refresh")).thenReturn(session("new-refresh"));

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie("refresh_token", "old-refresh"))
                        .header("X-Requested-With", "XMLHttpRequest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("access-token"))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("refresh_token=new-refresh")));
    }

    @Test
    void refresh_isForbiddenWithoutTheCsrfHeader() throws Exception {
        mockMvc.perform(post("/api/auth/refresh").cookie(new Cookie("refresh_token", "old-refresh")))
                .andExpect(status().isForbidden());
        verify(authService, never()).refresh(any());
    }

    @Test
    void refresh_returns401WhenTheTokenIsRejected() throws Exception {
        when(authService.refresh(any())).thenThrow(new BadCredentialsException("Invalid or expired refresh token"));

        mockMvc.perform(post("/api/auth/refresh").header("X-Requested-With", "XMLHttpRequest"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Invalid or expired refresh token"));
    }

    @Test
    void logout_revokesTheTokenAndClearsTheCookie() throws Exception {
        mockMvc.perform(post("/api/auth/logout")
                        .cookie(new Cookie("refresh_token", "current"))
                        .header("X-Requested-With", "XMLHttpRequest"))
                .andExpect(status().isNoContent())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, allOf(
                        containsString("refresh_token="), containsString("Max-Age=0"))));
        verify(authService).logout("current");
    }

    @Test
    void logout_isForbiddenWithoutTheCsrfHeader() throws Exception {
        mockMvc.perform(post("/api/auth/logout").cookie(new Cookie("refresh_token", "current")))
                .andExpect(status().isForbidden());
        verifyNoInteractions(authService);
    }

    @Test
    void me_returnsTheAuthenticatedUser() throws Exception {
        when(authService.currentUser(1L)).thenReturn(user());

        mockMvc.perform(get("/api/auth/me").with(jwt().jwt(token -> token.subject("1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("jane@acme.fr"))
                .andExpect(jsonPath("$.role").value("USER"));
    }

    @Test
    void me_returns401WithoutToken() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(authService);
    }

    private static AuthService.Session session(String refreshToken) {
        Instant now = Instant.now();
        return new AuthService.Session(user(),
                new IssuedToken("access-token", now.plusSeconds(900)),
                new IssuedToken(refreshToken, now.plusSeconds(604800)));
    }

    private static UserResponse user() {
        return new UserResponse(1L, "jane@acme.fr", "Jane", "Doe", Role.USER, Instant.parse("2026-10-18T10:00:00Z"));
    }
}
