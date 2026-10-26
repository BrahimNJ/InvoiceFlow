# 0002. JWT access tokens with rotating refresh tokens

- Status: accepted
- Date: 2026-10-18

## Context and problem

The Angular app (Vercel) and the API (Render) are on different domains. Users must stay signed in across reloads
for days, sessions must be revocable, and a script injected in the page must not be able to steal a long-lived
credential.

## Options considered

| Option | For | Against |
|--------|-----|---------|
| Server sessions (`JSESSIONID`) | Revocable, simple | State on the server, cross-site cookie on every API call, CSRF protection needed on every endpoint |
| Long-lived JWT in `localStorage` | Stateless, simple | Readable by any injected script; impossible to revoke before expiry |
| **Short JWT in memory + opaque refresh token in an `HttpOnly` cookie, rotated** | Stateless API calls, revocable sessions, nothing long-lived readable by JavaScript | More moving parts: interceptor, rotation, reuse detection |

## Decision

- Access token: JWT (HS256), 15 minutes, kept in an Angular signal, sent as `Authorization: Bearer`.
- Refresh token: opaque 256-bit value, 7 days sliding, `HttpOnly` cookie restricted to `/api/auth`, stored server
  side as a SHA-256 hash, **rotated on every use**.
- Reuse detection (RFC 9700): presenting a revoked refresh token revokes every session of the account.
- Cookie endpoints require an `X-Requested-With` header (CSRF).

## Consequences

- A stolen access token is useful for at most 15 minutes; a stolen refresh token is detected the first time both
  parties use it.
- The interceptor refreshes once and retries on `401`, without loops (tested).
- In production the refresh cookie is third-party; browsers that block such cookies end the session on reload.
  Serving the API under the frontend domain is the planned fix. Full details: [Authentication](../authentication.md).
