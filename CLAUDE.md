# InvoiceFlow — instructions for Claude Code

Fullstack invoicing platform for the French e-invoicing reform. Modular monolith.
Read `PROGRESS.md` first to know the current state and the next task.
Full workflow guide: `docs/claude-code/best-practices.md`. Agents, skills and hooks: `docs/claude-code/agents.md`.

Stack-specific rules load on demand from `backend/CLAUDE.md` and `frontend/CLAUDE.md`.

## Stack
- Backend: Java 21 (CI) / source level 17, Spring Boot 4, Spring Data JPA, Flyway, PostgreSQL (H2 in tests).
- Frontend: Angular 21, TypeScript 5.9, Vitest, npm.
- CI/CD: GitHub Actions; frontend on Vercel, backend on Render, database on Neon.

## Commands
- Backend tests: `cd backend && ./mvnw test` (CI runs `./mvnw --batch-mode verify`)
- Frontend build/tests: `cd frontend && npm run build && npm test -- --watch=false`

## Working with agents
- The main session orchestrates: it plans, delegates bounded tasks, integrates and commits.
- Delegate wide searches to `explorer` (cheap, read-only); never re-read in the main session what an agent summarized.
- Run `reviewer` on the staged diff before each non-trivial commit.
- Spawn agents only for independent or context-heavy work; small edits stay in the main session.

## Git workflow
- One GitHub issue per feature, created before any code.
- Branch: `<issue-number>-<type>/<short-name>` (e.g. `3-feat/customer-crud`), from an up-to-date `main`.
- Conventional commits: `<type>(<scope>): <summary>` + `Refs #<issue>` in the body. Types: feat, fix, test, docs, build, ci, chore, refactor.
- One commit per coherent piece of code (one layer/concern). Code must compile and tests pass at each commit.
- PR description in English, detailed, with `Closes #<issue>` (or `Refs #<issue>` for an intermediate lot).

## Rules (non-negotiable)
1. **Never push, merge, open a PR or close an issue unless the user explicitly asks in the current request.** The user reviews every commit.
2. Never commit secrets, `.env` files, IDE metadata or `.claude/settings.local.json`. Check `git status` before each commit.
3. Never use destructive git commands (`push --force`, `reset --hard`, history rewrite) without explicit approval.
4. Verify before claiming: run the relevant tests/build and report the real result. Say clearly when something was not verified.
5. Stay in scope: do only what the issue asks; list follow-ups instead of doing them.
6. Ask one focused question when a decision belongs to the user; otherwise choose the conventional option and state it.
7. Update `PROGRESS.md` at the end of each task (status, date, issue/PR links).
8. Communicate with the user in French; code, commits, issues, PRs and docs in English.
