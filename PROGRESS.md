# InvoiceFlow — progress

> Single source of truth for project status. Updated at the end of every task (see `CLAUDE.md`, rule 7).
> Last update: **2026-10-17**

## Status legend

| Status | Meaning |
|--------|---------|
| ✅ Done | Merged into `main`, CI green |
| 🔍 In review | PR open, waiting for review / CI |
| 🚧 In progress | Branch exists, work ongoing |
| ❌ Failed | Tests or CI failing, needs a fix |
| ⏸️ Blocked | Waiting on a decision or another task |
| 📋 Planned | Not started |

## Next task

➡️ **Product entity and CRUD API** (phase 2) — follow the `customer` module.

---

## Phase 0 — Project setup

| # | Task | Status | Issue / PR | Notes |
|---|------|--------|------------|-------|
| 0.1 | Spring Boot backend skeleton | ✅ Done | — | Spring Boot 4, Java 17 source |
| 0.2 | Angular frontend skeleton | ✅ Done | — | Angular 21, Vitest |
| 0.3 | GitHub Actions CI (backend + frontend) | ✅ Done | #1 / #2 | H2 for backend tests |
| 0.4 | Claude Code conventions, best practices, progress tracking | ✅ Done | #5 / #6 | `CLAUDE.md`, `docs/claude-code/`, this file |
| 0.5 | PostgreSQL + Docker Compose + Flyway for local runtime | 🚧 In progress | #7 | Branch `7-feat/postgresql-setup` |
| 0.6 | Profiles (`dev`, `test`, `prod`) and `.env.example` | 🚧 In progress | #7 | Done in the same branch as 0.5 |

## Phase 1 — Customers

| # | Task | Status | Issue / PR | Notes |
|---|------|--------|------------|-------|
| 1.1 | Customer entity and CRUD API | ✅ Done | #3 / #4 | Reference module; 10 tests |
| 1.2 | Pagination and search on `GET /api/customers` | 📋 Planned | — | |
| 1.3 | Customers UI (list, form, details) | 📋 Planned | — | Needs 0.5 to test end to end |

## Phase 2 — Products & services

| # | Task | Status | Issue / PR | Notes |
|---|------|--------|------------|-------|
| 2.1 | Product entity and CRUD API (price, VAT rate, description) | 📋 Planned | — | `BigDecimal` for amounts |
| 2.2 | Products UI | 📋 Planned | — | |

## Phase 3 — Invoices

| # | Task | Status | Issue / PR | Notes |
|---|------|--------|------------|-------|
| 3.1 | Invoice and invoice line entities | 📋 Planned | — | Depends on 1.1, 2.1 |
| 3.2 | Subtotal / VAT / total calculation | 📋 Planned | — | Unit-tested business rules |
| 3.3 | Invoice numbering and status lifecycle | 📋 Planned | — | Draft → Issued → Paid / Overdue |
| 3.4 | Invoice CRUD API | 📋 Planned | — | |
| 3.5 | Payment tracking | 📋 Planned | — | |
| 3.6 | Invoices UI | 📋 Planned | — | |

## Phase 4 — Documents

| # | Task | Status | Issue / PR | Notes |
|---|------|--------|------------|-------|
| 4.1 | PDF generation and download | 📋 Planned | — | |
| 4.2 | E-invoicing format (Factur-X) preparation | 📋 Planned | — | |

## Phase 5 — Company, dashboard

| # | Task | Status | Issue / PR | Notes |
|---|------|--------|------------|-------|
| 5.1 | Company and billing information | 📋 Planned | — | |
| 5.2 | Dashboard (revenue, paid / pending / overdue, recent invoices) | 📋 Planned | — | |

## Phase 6 — Security

| # | Task | Status | Issue / PR | Notes |
|---|------|--------|------------|-------|
| 6.1 | Authentication (JWT / OAuth2 / OIDC) | 📋 Planned | — | |
| 6.2 | Role-based access | 📋 Planned | — | |

## Phase 7 — AI features

| # | Task | Status | Issue / PR | Notes |
|---|------|--------|------------|-------|
| 7.1 | Create invoices from natural language | 📋 Planned | — | LLM output validated by backend rules |
| 7.2 | Ask questions about invoices | 📋 Planned | — | |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-10-17 | PostgreSQL, Flyway and Spring profiles in progress (#7). |
| 2026-10-17 | Customer CRUD merged (#4). Claude Code conventions merged (#6). |
