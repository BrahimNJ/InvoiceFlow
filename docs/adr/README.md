# Architecture decisions

Significant choices are recorded as Architecture Decision Records in the
[MADR](https://adr.github.io/madr/) format: the context, the options that were considered, the decision and its
consequences. A record is never rewritten once accepted; a new record supersedes it.

| ADR | Decision | Status |
|-----|----------|--------|
| [0001](0001-modular-monolith.md) | One Spring Boot application split into business modules | Accepted |
| [0002](0002-jwt-with-rotating-refresh-tokens.md) | Short-lived JWT in memory, rotating refresh token in an HttpOnly cookie | Accepted |
| [0003](0003-gap-free-invoice-numbering.md) | Gap-free numbering with a locked counter row in the issuing transaction | Accepted |
| [0004](0004-exact-money-arithmetic.md) | Exact decimal arithmetic on both sides, one rounding rule | Accepted |
| [0005](0005-problem-details.md) | RFC 9457 problem details for every API error | Accepted |
| [0006](0006-visual-identity-and-self-hosted-fonts.md) | "Paper and ink" design tokens, self-hosted fonts | Accepted |
| [0007](0007-docs-rendered-at-build-time.md) | Documentation rendered from the repository at build time | Accepted |

## Template

```text
# NNNN. Title

- Status: proposed | accepted | superseded by NNNN
- Date: YYYY-MM-DD

## Context and problem
## Options considered
## Decision
## Consequences
```
