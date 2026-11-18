# 0010. Two platform roles, and an admin who never reads business data

- Status: accepted
- Date: 2026-11-18

## Context and problem

Issue #46 gives the platform an administrator. Every account already carries a role (`USER` or `ADMIN`, Flyway V2)
and the access token copies it into its `roles` claim, but nothing reads it yet: every endpoint is scoped to the
signed-in owner and nobody can manage accounts. Someone must be able to suspend an abusive account, hand the admin
role to a colleague and see how the platform is used, without being able to read the invoices of the businesses that
trust it with their accounting.

Access tokens live 15 minutes and are not looked up on each request (ADR 0002), so a role change or a suspension
cannot reach a token that was already issued.

## Options considered

| Option | For | Against |
|--------|-----|---------|
| **Two platform roles, admin limited to accounts and aggregates** | Uses the existing column and claim; least privilege; nothing new to explain to users | No per-company team roles yet |
| Admin who can open any user's data ("support mode") | Handy for support | Breaks the promise that an account's data is private; every read would need consent and audit |
| Company teams with per-company roles (owner, accountant, member) | What a growing business eventually needs | Needs the company model (task 5.1) first; much larger change |
| Fine-grained permissions stored in the database | Flexible | Far more than two roles need; harder to test and to reason about |

## Decision

- Two roles. `USER` reaches only its own data, as today. `ADMIN` reaches `/api/admin/**` as well, which the security
  filter chain reserves for the `ROLE_ADMIN` authority (401 without a token, 403 for a user).
- The admin API manages **accounts**: list and search users, change a role, suspend and reactivate. It reports
  **aggregates** only (number of users, invoices, customers). No admin endpoint returns a customer, a product, an
  invoice or a payment.
- The first admins come from configuration: `ADMIN_EMAILS` promotes the listed accounts at startup, and a listed
  email that signs up later as soon as it registers (a synchronous listener of the registration event, so its first
  token already says `ADMIN`). It is idempotent and never demotes anyone; there is no endpoint to become admin.
- Admin endpoints check the role and the suspension **in the database** as well as in the token, so a demoted or
  suspended admin loses access at once, not 15 minutes later.
- The platform always keeps one active admin: an admin cannot demote or suspend themselves, and the last active admin
  cannot be demoted or suspended. The check locks the admin rows, so two admins demoting each other at the same time
  cannot both succeed.
- A suspended account cannot sign in or refresh, and its refresh tokens are revoked when it is suspended.
- Every admin action is written to an append-only audit log, in the same transaction as the change.

## Consequences

- A suspended user keeps a working access token for at most 15 minutes on non-admin endpoints. Checking the account on
  every request would close that window at the cost of one query per call; we accept the window.
- A promoted user sees the admin area after their next token refresh, at most 15 minutes later, or at once after
  signing in again.
- A new `admin` module depends on `user`, `auth` (to revoke sessions) and on small count queries of the business
  modules; no business module depends on it (verified by `ModularityTest`).
- Support cases that need to look at a user's invoices are out of scope; they would need the user's consent and a
  separate decision.
- Company teams and per-company roles stay possible later, on top of these two platform roles.
