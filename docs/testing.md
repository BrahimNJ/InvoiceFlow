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

Planned (issue #33 lot 4): Playwright end-to-end tests on the main journey, axe-core accessibility checks and a
Lighthouse performance budget in CI.

## What makes the tests trustworthy

- **Same rules, tested twice.** Money arithmetic exists in Java and TypeScript; both suites assert the same cases
  (half-up per line, VAT once per rate), so drift is caught.
- **Real schema.** Repository tests run against the Flyway migrations, not a schema generated from entities.
- **Fixed time.** Services take an injected `Clock`, so due dates and overdue status are asserted on known dates.
- **Security in the loop.** Controller tests run with the real security configuration; integration tests use real
  signed tokens (expired, wrong issuer, wrong key).
- **Coverage cannot regress.** JaCoCo fails the build under 95 % of lines or 85 % of branches; Lombok-generated
  code is excluded so the figure only counts hand-written code.
- **Mutation-checked where it matters.** The "revocations survive an exception" rule was verified by deliberately
  breaking it and watching `AuthFlowIntegrationTest` fail.

## Continuous integration

| Workflow | Trigger | Steps |
|----------|---------|-------|
| `backend-ci.yml` | Push to `main` and issue branches, pull requests to `main` | Java 21, `./mvnw --batch-mode verify` (tests, modularity, coverage floor); coverage summary and HTML report published |
| `frontend-ci.yml` | Push to `main` and issue branches, pull requests to `main` | Node, `npm ci`, `npm run build` (renders these docs), `npm test` |
| `deploy-backend.yml` / `deploy-frontend.yml` | Merge to `main` after CI | Deploy, then verify the running version ([Deployment](deployment.md)) |

## Running the tests

```bash
cd backend && ./mvnw test
cd frontend && npm run build && npm test -- --watch=false
node --test .claude/hooks/*.test.mjs
```
