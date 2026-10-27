# InvoiceFlow — progress

> Single source of truth for project status. Updated at the end of every task (see `CLAUDE.md`, rule 7).
> Last update: **2026-10-26**

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

➡️ **Showcase** (#33): review lot 3 (backend tooling, branch `33-feat/backend-tooling`), then lot 4 (Playwright E2E, axe-core accessibility, Lighthouse budget). After #33: payments (3.5) or company details (5.1).

---

## Phase 0 — Project setup

| # | Task | Status | Issue / PR | Notes |
|---|------|--------|------------|-------|
| 0.1 | Spring Boot backend skeleton | ✅ Done | — | Spring Boot 4, Java 17 source |
| 0.2 | Angular frontend skeleton | ✅ Done | — | Angular 21, Vitest |
| 0.3 | GitHub Actions CI (backend + frontend) | ✅ Done | #1 / #2 | H2 for backend tests |
| 0.4 | Claude Code conventions, best practices, progress tracking | ✅ Done | #5 / #6 | `CLAUDE.md`, `docs/claude-code/`, this file |
| 0.5 | PostgreSQL + Docker Compose + Flyway for local runtime | ✅ Done | #7 / #9 | |
| 0.6 | Profiles (`dev`, `test`, `prod`) and `.env.example` | ✅ Done | #7 / #9 | Same PR as 0.5 |
| 0.7 | Continuous deployment: Vercel (frontend), Render + Neon (backend) | ✅ Done | #8 / #10, #11 / #12 | Live, checked 2026-10-17: frontend, `/actuator/health` UP, `/api/customers` reads Neon. See `docs/deployment.md` |
| 0.8 | Deployment guide + end-to-end check of automatic deploy on merge | ✅ Done | #13 / #14 | First automatic run: backend deployed, frontend failed (fixed in 0.8.1) |
| 0.8.1 | Fix frontend deploy: run Vercel CLI from repo root (Root Directory `frontend`) | ✅ Done | #15 / #16 | Reproduced locally; validated on `main` by the merge of this fix |
| 0.9 | CORS + frontend API base URL (dev and prod) | ✅ Done | #17 / #18 | `CORS_ALLOWED_ORIGINS`, Angular `environments/`; cross-origin calls verified in production on 2026-10-18 |
| 0.11 | Landing page (product presentation, live API status) | ✅ Done | #17 / #18 | Same PR as 0.9; plain CSS, no UI library. Follow-up: French translation |
| 0.13 | Multi-agent Claude Code workflow: subagents, scoped `CLAUDE.md`, skills, hook scripts, Playwright MCP | ✅ Done | #33 / #34 | Branch `33-chore/claude-workflow`. Hook scripts covered by `node --test .claude/hooks/*.test.mjs` (26 cases); activation in `.claude/settings.json` left to the maintainer |
| 0.14 | Showcase: visual identity, in-app docs, ADRs, backend tooling, E2E/a11y/Lighthouse, supply-chain security | 🚧 In progress | #33 | One PR per lot |
| 0.10 | Integration tests on real PostgreSQL (Testcontainers) | 📋 Planned | — | Tests currently run on H2 |
| 0.12.1 | Deploy wait step: keep polling when the backend times out during a deploy | ✅ Done | #25 / #26 | Run for #24 failed after 38 s although production served the commit. *Deploy backend* green on the merge commit `f6bebad` |
| 0.12 | Verified backend deploy: hook check, deploy pinned to the CI commit, wait for `/actuator/info`, smoke test; professional README | ✅ Done | #21 / #22 | Production had silently stayed on #12 for a day: the hook secret held a Vercel hook, then the Blueprint sync URL |
| 0.15 | Showcase lot 1: paper-and-ink identity, self-hosted fonts, landing rewrite, dark theme, view transitions | ✅ Done | #33 / #35 | Branch `33-feat/visual-identity`. Landing and sign-in checked in Chrome (1280 / 390 px, light and dark); signed-in screens not checked in a browser yet (needs the API) |
| 0.16 | Showcase lot 2: in-app docs at `/docs` (build-time Markdown with marked + Shiki, lazy Mermaid), overview, architecture, security model, testing, 7 ADRs | ✅ Done | #33 / #36 | Branch `33-feat/in-app-docs`, stacked on lot 1. Checked in Chrome (1280 / 390 px, light and dark). Prerendering deferred: `@angular/ssr` needs the Angular packages aligned on one patch first |
| 0.17 | Showcase lot 3: Spring Modulith (verified boundaries, generated diagram), OpenAPI + Scalar reference, per-IP rate limiting (Bucket4j), JaCoCo coverage floor | 🚧 In progress | #33 | Branch `33-feat/backend-tooling`, stacked on lot 2. 252 backend tests, 97.5 % lines / 91.7 % branches. To check after deploy: client IP behind Render's proxy |

## Phase 1 — Customers

| # | Task | Status | Issue / PR | Notes |
|---|------|--------|------------|-------|
| 1.1 | Customer entity and CRUD API | ✅ Done | #3 / #4 | Reference module; 10 tests |
| 1.2 | Customers scoped to their owner; pagination and search on `GET /api/customers` | ✅ Done | #23 / #24 | Flyway V4 deletes the customers created before authentication |
| 1.3 | Customers UI (list, search, pagination, create/edit form, delete) | ✅ Done | #23 / #24 | Same PR as 1.2. Follow-up: details page with invoices |
| 1.4 | Customers screens on the shared UI kit (help tips, icons, confirmation dialog, toasts, cards on phones) | ✅ Done | #28 / #30 | |

## Phase 2 — Products & services

| # | Task | Status | Issue / PR | Notes |
|---|------|--------|------------|-------|
| 2.1 | Product entity and CRUD API (type, price, VAT rate, unit), scoped to the owner | ✅ Done | #27 / #29 | Flyway V5, `@FrenchVatRate` (20 / 10 / 5.5 / 2.1 / 0), `BigDecimal` amounts |
| 2.2 | Products UI and shared UI kit (page header, help tips, empty states, confirmation dialog, toasts, responsive tables) | ✅ Done | #27 / #29 | Same PR as 2.1 |

## Phase 3 — Invoices

| # | Task | Status | Issue / PR | Notes |
|---|------|--------|------------|-------|
| 3.1 | Invoice and invoice line entities | ✅ Done | #31 / #32 | Flyway V6; customer details copied onto the invoice, frozen once issued |
| 3.2 | Subtotal / VAT / total calculation | ✅ Done | #31 / #32 | Half up per line, VAT once per rate; same rules in the frontend preview |
| 3.3 | Invoice numbering and status lifecycle | ✅ Done | #31 / #32 | Draft → Issued → Cancelled, overdue derived; `F-<year>-<0001>` gap-free, tested concurrently. Paid comes with 3.5 |
| 3.4 | Invoice CRUD API | ✅ Done | #31 / #32 | Plus issue (422 when a mention is missing), cancel, duplicate, summary |
| 3.5 | Payment tracking | 📋 Planned | — | |
| 3.6 | Invoices UI | ✅ Done | #31 / #32 | Cockpit list, editor workspace with checklist and A4 preview, detail page. Real-browser check planned in #33 (Playwright) |

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
| 6.1 | Authentication: JWT access tokens, rotating refresh tokens, sign-up/sign-in pages | ✅ Done | #19 / #20 | Verified in production on 2026-10-18 (register, me, refresh, CSRF, logout). See `docs/authentication.md`. Follow-up: Safari third-party cookies |
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
| 2026-10-26 | Showcase lot 3 (backend tooling) on `33-feat/backend-tooling` (#33): 252 backend tests pass, coverage 97.5 % of lines. |
| 2026-10-26 | Showcase lot 2 (in-app docs, ADRs) on `33-feat/in-app-docs` (#33): 232 frontend tests pass. |
| 2026-10-26 | Showcase lot 1 (visual identity) on `33-feat/visual-identity` (#33): 222 frontend tests pass. |
| 2026-10-26 | Invoices merged (#32). Showcase issue #33 opened; lot 6 (multi-agent workflow, see `docs/claude-code/agents.md`) on `33-chore/claude-workflow`. |
| 2026-10-24 | Invoices implemented on `31-feat/invoices` (#31): 235 backend and 217 frontend tests pass. Business rules and screens: `docs/invoicing.md`. |
| 2026-10-24 | Products (#29) and customers restyle (#30) merged. Invoices started on `31-feat/invoices` (#31). |
| 2026-10-21 | Customers screens restyled with the shared UI kit on `28-feat/customer-ui-restyle` (#28), stacked on #27: 148 frontend tests pass. |
| 2026-10-21 | Deploy wait-step fix merged (#26), production deploy green. Products & services and shared UI kit implemented on `27-feat/product-catalogue` (#27): 147 backend and 147 frontend tests pass. |
| 2026-10-19 | Customer management merged (#24); production serves it. Deploy wait-step fix in review (#25 / #26). |
| 2026-10-19 | Customer management end to end in review (#23 / #24): per-user customers, paginated search, customers UI. |
| 2026-10-18 | Verified backend deploy and README rewrite in review (#21 / #22). |
| 2026-10-18 | Production deployed for the first time since #12 after fixing `RENDER_DEPLOY_HOOK_URL`; authentication and CORS verified live. |
| 2026-10-18 | Authentication merged (#19 / #20): API secured, sign-up/sign-in pages, protected dashboard. |
| 2026-10-17 | CORS, API base URL per environment and landing page merged (#17 / #18). |
| 2026-10-17 | Frontend deploy fix: Vercel CLI from repo root (#15). |
| 2026-10-17 | Frontend, backend and database live; deployment guide rewritten (#14). Automatic backend deploy validated. |
| 2026-10-17 | Render build fix: Docker context resolved as `backend/backend` (#11). |
| 2026-10-17 | Continuous deployment merged (#10); CI now also runs on issue branches. |
| 2026-10-17 | PostgreSQL, Flyway and Spring profiles merged (#9). |
| 2026-10-17 | Customer CRUD merged (#4). Claude Code conventions merged (#6). |
