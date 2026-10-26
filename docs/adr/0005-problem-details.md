# 0005. RFC 9457 problem details for every API error

- Status: accepted
- Date: 2026-10-17

## Context and problem

The frontend must show precise messages: which field is invalid, why an invoice cannot be issued, that an email is
already taken. Ad hoc error bodies per endpoint make that fragile.

## Options considered

| Option | For | Against |
|--------|-----|---------|
| Spring Boot's default error body | No code | Not a standard, inconsistent between validation and business errors |
| Custom error envelope | Full control | One more format to document and keep consistent |
| **RFC 9457 `ProblemDetail`** (built into Spring) | Standard `application/problem+json`, extensible with fields such as `errors` or `missing` | Clients must know the standard (small cost) |

## Decision

All errors go through `GlobalExceptionHandler` and are returned as `ProblemDetail`: `400` with field errors for
validation, `401` / `403` for security, `404` for missing or foreign resources (`ResourceNotFoundException`), `409`
for state conflicts (`ConflictException`, e.g. editing an issued invoice), `422` for business rules
(`UnprocessableException`, e.g. issuing an invoice that misses a mandatory mention, with the list of what is
missing), `429` for a locked account.

## Consequences

- One parser in the frontend (`core/http/problem-detail.ts`) maps errors to form fields and messages.
- Responses never contain stack traces or SQL.
- Controller tests assert the status and the problem body, so the contract is covered.
