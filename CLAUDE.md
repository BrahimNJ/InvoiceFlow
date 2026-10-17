# InvoiceFlow — instructions for Claude Code

Fullstack invoicing platform for the French e-invoicing reform. Modular monolith.
Read `PROGRESS.md` first to know the current state and the next task.
Full workflow guide: `docs/claude-code/best-practices.md`.

## Stack
- Backend: Java 21 (CI) / source level 17, Spring Boot 4, Spring Data JPA, Bean Validation, Lombok, Maven wrapper. Package root `com.naji.backend`.
- Frontend: Angular 21, TypeScript 5.9, Vitest, npm.
- DB: PostgreSQL (planned), H2 for tests only.
- CI: GitHub Actions (`.github/workflows/backend-ci.yml`, `frontend-ci.yml`).

## Commands
- Backend tests: `cd backend && ./mvnw test` (CI runs `./mvnw --batch-mode verify`)
- Frontend build/tests: `cd frontend && npm run build && npm test -- --watch=false`

## Backend structure (one package per business module)
```
com.naji.backend.<module>/        entity, repository, service, controller, mapper
com.naji.backend.<module>/dto/    request/response records with validation
com.naji.backend.common/          cross-cutting code (exceptions, handler, config)
```
Reference implementation: `customer` module. New modules follow the same layout:
- Never expose JPA entities from controllers; use DTO records + mapper.
- Errors go through `GlobalExceptionHandler` (RFC 9457 `ProblemDetail`); throw `ResourceNotFoundException` for missing ids.
- Every module ships with a Mockito service test and a `@WebMvcTest` controller test.

## Git workflow
- One GitHub issue per feature, created before any code.
- Branch: `<issue-number>-<type>/<short-name>` (e.g. `3-feat/customer-crud`), from an up-to-date `main`.
- Conventional commits: `<type>(<scope>): <summary>` + `Refs #<issue>` in the body. Types: feat, fix, test, docs, build, ci, chore, refactor.
- One commit per coherent piece of code (one layer/concern). Code must compile and tests pass at each commit.
- PR description in English, detailed, with `Closes #<issue>`.

## Rules (non-negotiable)
1. **Never push, merge, open a PR or close an issue unless the user explicitly asks in the current request.** The user reviews every commit.
2. Never commit secrets, `.env` files, IDE metadata or `.claude/settings.local.json`. Check `git status` before each commit.
3. Never use destructive git commands (`push --force`, `reset --hard`, history rewrite) without explicit approval.
4. Verify before claiming: run the relevant tests/build and report the real result. Say clearly when something was not verified.
5. Stay in scope: do only what the issue asks; list follow-ups instead of doing them.
6. Ask one focused question when a decision belongs to the user; otherwise choose the conventional option and state it.
7. Update `PROGRESS.md` at the end of each task (status, date, issue/PR links).
8. Communicate with the user in French; code, commits, issues, PRs and docs in English.
