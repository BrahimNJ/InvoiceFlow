# Quality and testing

Tests are part of every feature, never a follow-up: a module is not merged until its service, controller,
repository and ownership tests pass in CI. At the time of writing the suites hold **252 backend tests** and
**232 frontend tests**, and the backend tests cover **97.5 % of lines and 91.7 % of branches** (JaCoCo).

## Test pyramid

| Layer | Tooling | What it proves | Examples |
|-------|---------|----------------|----------|
| Unit (backend) | JUnit 5, Mockito, AssertJ | Business rules in isolation: totals, rounding, readiness, numbering format, token rotation | `InvoiceCalculatorTest`, `InvoiceReadinessTest`, `RefreshTokenServiceTest` |
| Web slice | `@WebMvcTest` + Spring Security test (`jwt()`) | HTTP contract: status codes, validation errors as problem details, authentication required | `InvoiceControllerTest`, `CustomerControllerTest` |
| Persistence slice | `@DataJpaTest` on the Flyway schema | Queries, constraints and pagination against the real migrations | `InvoiceRepositoryTest` |
| Integration | `@SpringBootTest` | Whole flows: register → refresh → replay detection; invoice lifecycle; tenant isolation | `AuthFlowIntegrationTest`, `InvoiceLifecycleIntegrationTest`, `*OwnershipIntegrationTest` |
| Concurrency | Parallel threads on the real transaction boundaries | Gap-free numbering when invoices are issued at the same time | `InvoiceNumberGeneratorTest` |
| Frontend unit | Vitest, Angular `TestBed`, `HttpTestingController` | Services, interceptor (refresh-and-retry, no loops), guards, validators, money arithmetic, components | `auth.interceptor.spec.ts`, `invoice-calc.spec.ts` |
| Architecture | Spring Modulith on the compiled classes | Modules only use each other's public API, no dependency cycle, and the module diagram in the docs matches the code | `ModularityTest` |
| Contract | `@SpringBootTest` on `/v3/api-docs` | The published OpenAPI description covers the secured endpoints and marks the public ones | `ApiDocumentationIntegrationTest` |
| Tooling | `node:test` | The Claude Code commit guard blocks secrets however they are named | `.claude/hooks/guard-commit.test.mjs` |
| End to end | Playwright on the production build, real API and PostgreSQL | A new user signs up, adds a customer and a product, then issues invoice `F-<year>-0001`; on desktop and phone viewports | `invoice-journey.e2e.ts` |
| Accessibility | axe-core in every end-to-end test (WCAG 2.1 A and AA) | Every screen of the journey has no violation, and neither have the public pages in light and dark themes | `public-pages.e2e.ts`, `e2e/fixtures.ts` |
| Performance budget | Lighthouse CI on `/`, `/docs/overview` and `/login` | Category scores (accessibility 100, performance ≥ 85, best practices and SEO ≥ 95) and transferred bytes per page | `frontend/lighthouserc.json` |

## What makes the tests trustworthy

- **Same rules, tested twice.** Money arithmetic exists in Java and TypeScript; both suites assert the same cases
  (half-up per line, VAT once per rate), so drift is caught.
- **Real schema.** Repository tests run against the Flyway migrations, not a schema generated from entities.
- **Fixed time.** Services take an injected `Clock`, so due dates and overdue status are asserted on known dates.
- **Security in the loop.** Controller tests run with the real security configuration; integration tests use real
  signed tokens (expired, wrong issuer, wrong key).
- **Coverage cannot regress.** JaCoCo fails the build under 95 % of lines or 85 % of branches; Lombok-generated
  code is excluded so the figure only counts hand-written code.
- **The real stack end to end.** The browser tests drive the production build against the Spring Boot jar and
  PostgreSQL, not mocked HTTP: CORS, the refresh cookie, Flyway and numbering are all in the loop. Each test signs
  up its own user, so tests share no data and run in parallel.
- **Accessibility measured, not assumed.** axe-core runs after each step of the journey with reduced motion, so
  entrance animations cannot hide or fake a contrast failure. Its first run found low-contrast secondary text and
  scrollable regions unreachable by keyboard, fixed in the same lot.
- **Mutation-checked where it matters.** The "revocations survive an exception" rule was verified by deliberately
  breaking it and watching `AuthFlowIntegrationTest` fail.

## Continuous integration

| Workflow | Trigger | Steps |
|----------|---------|-------|
| `backend-ci.yml` | Push to `main` and issue branches, pull requests to `main` | Java 21, `./mvnw --batch-mode verify` (tests, modularity, coverage floor); coverage summary and HTML report published |
| `frontend-ci.yml` | Push to `main` and issue branches, pull requests to `main` | Node, `npm ci`, `npm run build` (renders these docs), `npm test` |
| `e2e.yml` | Push to `main` and issue branches, pull requests to `main` | PostgreSQL service, backend jar, `npm run build:e2e`, Playwright with axe-core, Lighthouse budget; reports published as artifacts |
| `deploy-backend.yml` / `deploy-frontend.yml` | Merge to `main` after CI | Deploy, then verify the running version ([Deployment](deployment.md)) |

## Running the tests

```bash
cd backend && ./mvnw test
cd frontend && npm run build && npm test -- --watch=false
node --test .claude/hooks/*.test.mjs
```

End-to-end tests and the Lighthouse budget need PostgreSQL and the API on `localhost:8080`, and Google Chrome:

```bash
docker compose up -d                      # PostgreSQL
cd backend && ./mvnw spring-boot:run      # API, dev profile (other terminal)
cd frontend && npm run build:e2e          # production build that calls localhost:8080
npx playwright test                       # serves the build on :4200 and runs the journey
npx --yes @lhci/cli@0.15.1 autorun        # Lighthouse budget, reports in .lighthouseci/
```

Lighthouse CI runs through `npx` with a pinned version instead of a dev dependency: its latest release pulls an
old Lighthouse and Puppeteer with known advisories into the lockfile, and it only ever audits our own local pages.
