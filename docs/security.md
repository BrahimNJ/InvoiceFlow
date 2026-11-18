# Security

Invoices, customers and amounts are confidential business data. This page is the threat model of the whole
application: what could go wrong, what stops it, and where in the code. Authentication has its own detailed page:
[Authentication](authentication.md).

## Threat model

| Threat | Defense | Where |
|--------|---------|-------|
| Another account reads or changes my data (IDOR) | Every repository query takes the authenticated owner id; a foreign id answers `404`, exactly like a missing one, so ids reveal nothing. Covered by an ownership integration test per module | `*Service`, `*OwnershipIntegrationTest` |
| An admin reads the businesses' data | The admin API manages accounts and returns counts only; no admin endpoint returns a customer, product, invoice or payment ([ADR 0010](adr/0010-role-based-access.md)) | `admin` module |
| A user reaches the back-office | `/api/admin/**` requires `ROLE_ADMIN` in the filter chain (`401` / `403`); every admin service also checks in the database that the caller is still an active admin, so a demoted or suspended admin loses access at once instead of when the token expires | `SecurityConfig`, `AdminAccess` |
| A user makes themselves admin | No endpoint grants the role to oneself. `ADMIN_EMAILS` promotes existing accounts at startup, only while no active admin exists, and never at sign-up (emails are not verified, so a listed address must not be claimable). Then admins promote others; an admin cannot change their own role or suspend themselves | `AdminBootstrap`, `AdminUserService` |
| The platform is left without an admin | Changes take a lock on the active admin rows and check the caller again under it, so two admins demoting or suspending each other at the same time cannot both succeed | `UserRepository.lockActiveAdminIds`, `AdminConcurrencyTest` |
| An abusive account keeps using the service | An admin suspends it: sign-in answers `403`, every refresh token is revoked and refused; its access token lives at most 15 more minutes outside the back-office. A concurrent sign-in cannot write the account back as active: `users` updates touch only the changed columns | `AdminUserService`, `AuthService`, `RefreshTokenService`, `UserConcurrentUpdateTest` |
| Admin actions cannot be traced | Append-only audit log written in the transaction of each change (who, what, whom, when), mapped to an immutable entity | `AuditLog`, `admin_actions` |
| Stolen session through XSS | Access token in memory only, refresh token in an `HttpOnly` cookie limited to `/api/auth`; Angular escapes template output and sanitizes bound HTML | `AuthService`, `RefreshTokenCookies` |
| Replayed refresh token | Rotation on every use; presenting a revoked token revokes every session of the account (RFC 9700) | `RefreshTokenService` |
| CSRF on cookie endpoints | `X-Requested-With` required on refresh / logout (cross-site forms cannot send it; scripts trigger a CORS preflight only allowed origins pass). Business endpoints use the bearer header, never cookies | `AuthController`, `CorsConfig` |
| Forged JWT | HS256 only, signature, issuer and expiry verified by Spring's resource server; secret ≥ 32 bytes checked at startup | `SecurityConfig`, `JwtProperties` |
| Password guessing on one account | 5 failures lock the account for 15 minutes (`429`); same answer and timing for unknown emails (no enumeration) | `AuthService` |
| One client trying many accounts, flooding sign-up or refresh | Token bucket per client on login, register and refresh (10 a minute by default, IPv6 grouped by /64), matched on the decoded path like the router, `429` with `Retry-After`; the client IP comes from `X-Forwarded-For` only when the request arrives through a trusted private-network proxy, so a client cannot choose it | `AuthRateLimitFilter`, `application-prod.properties` |
| Database leak | BCrypt password hashes, refresh tokens stored as SHA-256 hashes | `SecurityConfig`, `RefreshTokenService` |
| Invalid or hostile input | Bean Validation on every request record, custom validators (French VAT rates, strong passwords), parameterised queries through JPA / `JdbcTemplate` | `dto/`, `common/validation` |
| Tampered amounts | The server recomputes every total from lines; client totals are never trusted | `InvoiceCalculator` |
| An issued invoice altered afterwards | Issued invoices are immutable: customer and line values are copied, edits are refused (`409`) | `InvoiceService` |
| Information leaks in errors | RFC 9457 problem details with business messages only; no stack traces or SQL in responses | `GlobalExceptionHandler` |
| Secrets in the repository or logs | `.env` git-ignored, secrets in GitHub / Render / Vercel settings; `toString()` of tokens and passwords hides them; a Claude Code hook blocks staging secrets | `.gitignore`, DTOs, `.claude/hooks/guard-commit.mjs` |
| Undocumented or drifting API surface | The OpenAPI description is generated from the controllers and served publicly (contract only, never data); the Scalar page loads its script from the API itself | `OpenApiConfig`, `/scalar` |
| Clickjacking, MIME sniffing, caching of API responses | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` from Spring Security | `SecurityConfig` |

## Trusted HTML in this documentation

The documentation pages are rendered from the repository's own Markdown at build time and inserted as HTML with
Angular's `bypassSecurityTrustHtml`, because the default sanitizer would strip the inline colour variables of the
highlighted code. This is safe only because the content is produced from version-controlled files during the build;
no user input ever reaches this path. See [ADR 0007](adr/0007-docs-rendered-at-build-time.md).

## Known limits and next steps

| Gap | Plan |
|-----|------|
| Client IP behind the hosting proxy not yet checked in production | Confirm after deploy (the 429 log line shows the address the server sees) that Render's proxy is in Tomcat's trusted ranges. If not, every client shares one bucket: still no bypass, but one abusive client could block sign-in for everyone, so `server.tomcat.remoteip.internal-proxies` must then be set |
| No Content-Security-Policy or HSTS on the frontend host yet | Security headers in `vercel.json`, issue #33 lot 5 |
| No automated dependency and code scanning | Dependabot and CodeQL, issue #33 lot 5 |
| Refresh cookie is third-party in production (different domains) | Serve the API under the frontend domain, then `SameSite=Strict` ([Authentication](authentication.md)) |
| A suspended account keeps its access token for up to 15 minutes outside the back-office | Accepted in [ADR 0010](adr/0010-role-based-access.md); checking the account on every request would close it at one query per call |
| The last-admin lock is tested on H2 only | PostgreSQL concurrency test with Testcontainers, task 0.10 |
| No email verification | Needed before any feature trusts an email address; `ADMIN_EMAILS` therefore never acts at sign-up |
| No per-company team roles (owner, accountant) | Needs the company model, task 5.1 in [`PROGRESS.md`](../PROGRESS.md) |

To report a vulnerability, please open a private security advisory on GitHub rather than a public issue.
