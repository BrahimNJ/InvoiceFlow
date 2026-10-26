# Claude Code — best practices for InvoiceFlow

This guide defines how InvoiceFlow is developed with an AI coding agent (Claude Code).
The goal is professional-grade use of LLMs: **the human owns every decision that leaves the machine,
the agent produces small, verified, reviewable increments**.

`CLAUDE.md` holds the short, always-loaded rules. This document explains the *why* and the *how*.

---

## 1. Principles

| Principle | In practice |
|-----------|-------------|
| Human in the loop | The agent commits locally; the human reviews, pushes and merges. Push/PR/merge only on explicit request. |
| Small increments | One issue → one branch → one commit per coherent piece of code → one PR. |
| Verify, don't trust | Every change is compiled and tested before it is committed. Unverified claims are flagged as such. |
| Explicit context | Conventions live in files (`CLAUDE.md`, `PROGRESS.md`, this guide), not in chat history. |
| Least privilege | `.claude/settings.json` allows safe commands, asks for outward-facing ones, denies destructive ones and secrets. |
| Traceability | Every commit references its issue (`Refs #n`), every PR closes it (`Closes #n`). |

---

## 2. Feature workflow (single agent)

```
 PROGRESS.md ──► issue ──► branch ──► code + test ──► commit ──► ... ──► PR ──► CI ──► human review ──► merge
   (next task)   (gh)     (from main)   (per layer)    (local)              (on request)               (human)
```

1. **Start of session** — the agent reads `PROGRESS.md` and `CLAUDE.md`; the user names the task in one sentence
   (e.g. *"Implement Product CRUD like Customer"*).
2. **Issue** — created with goal, scope and acceptance criteria before writing code.
3. **Branch** — `<issue>-<type>/<name>` from an up-to-date `main`.
4. **Implementation** — layer by layer (build → entity/repository → DTO/mapper → service → controller → tests),
   compiling after each step and committing once the step is green.
5. **Verification** — full test suite run; results reported with real numbers.
6. **Progress update** — `PROGRESS.md` updated in the same branch.
7. **Review** — the user reviews commits locally (`git log -p main..HEAD`), then asks for push/PR or does it.
8. **After merge** — `git checkout main && git pull`, delete the branch, `/clear`, next task.

### Commit conventions
```
feat(customer): add REST controller for /api/customers

Refs #3
```
- Types: `feat`, `fix`, `test`, `docs`, `build`, `ci`, `chore`, `refactor`.
- Scope: the module (`customer`, `invoice`, ...) or the area (`backend`, `frontend`, `claude`).
- Each commit compiles and keeps tests green, so any commit can be checked out or reverted safely.

---

## 3. Context and token management

LLM cost and quality both depend on context. Less noise = cheaper and more accurate answers.

| Practice | Why |
|----------|-----|
| `/clear` between features | Every message re-sends the whole conversation. A fresh session per feature keeps it small. |
| Keep `CLAUDE.md` short | It is loaded in every session. Put long explanations here, in `docs/`. |
| Use `PROGRESS.md` instead of asking "where are we?" | One file read instead of git/CI exploration. |
| Precise first prompt | Scope, constraints and expected output up front avoid clarification round-trips. |
| Reference files by path | `backend/src/.../CustomerService.java` beats "the customer service file". |
| Point to a reference implementation | "Like the `customer` module" reuses existing patterns without re-explaining them. |
| `/compact` on long sessions | Summarizes history when a task genuinely needs a long session. |
| Untrack noise | IDE files and build outputs out of Git = smaller diffs for the agent to read. |
| Use `!` for your own shell commands | `! gh auth login` runs interactively in the session; output lands in context. |

---

## 4. Quality and verification

- The agent never says "done" without running the relevant tests; it reports pass/fail counts.
- CI (GitHub Actions) is the final gate: a PR is merged only when CI is green.
- Tests are part of the feature, not a follow-up: service unit tests (Mockito) + controller tests (`@WebMvcTest`).
- Generated code follows existing patterns; when the agent introduces a new pattern it explains why in the PR.
- The human reviews diffs as if written by a junior colleague: correctness, naming, scope, security.
- Useful commands: `/code-review` (bug-focused review of the current diff), `/security-review` (security review of the branch).

---

## 5. Security and confidentiality

- Secrets (`.env`, keys, tokens) never enter the repository nor the agent context; reading them is denied in `.claude/settings.json`.
- Configuration that differs per machine goes into `.env` (ignored) with a committed `.env.example`.
- Personal settings stay local: `.claude/settings.local.json` and `CLAUDE.local.md` are git-ignored.
- Destructive git commands (`push --force`, `reset --hard`, `clean -fd`) are denied.
- Outward-facing actions (push, PR, merge, closing issues) always require confirmation.
- No real customer data in tests or fixtures; use obviously fake values (`ACME`, `contact@acme.fr`).

### What is versioned

| Versioned | Not versioned |
|-----------|---------------|
| `CLAUDE.md`, `PROGRESS.md`, `docs/` | `CLAUDE.local.md` |
| `.claude/settings.json` (team permissions) | `.claude/settings.local.json` (personal) |
| `frontend/.vscode/*.json` (Angular defaults: extensions, tasks, launch, MCP) | `.idea/`, `*.iml`, other editor files |
| `mvnw`, `.mvn/wrapper/maven-wrapper.properties` | `target/`, `node_modules/`, `dist/`, `.angular/cache` |
| `.env.example` | `.env`, `*.pem`, `*.key` |

---

## 6. Prompting patterns

Good prompts state **task, scope, constraints, output**:

> Implement issue #6 (Product CRUD) following the `customer` module.
> Fields: name, description, unit price (BigDecimal), VAT rate. One commit per layer, no push.

Other useful patterns:
- **Plan first** for non-trivial work: ask for a plan (or use plan mode) and validate it before code is written.
- **Explain then change**: "Explain why this test fails, then propose a fix" avoids blind fixes.
- **Bounded review**: "Review the diff of this branch for correctness only".

Anti-patterns: vague requests ("improve the backend"), mixing several features in one session,
accepting code without reading the diff, asking the agent to push before reviewing.

---

## 7. Multi-agent workflow

The project works with an orchestrating main session and specialized subagents, project skills, hooks and
MCP servers. Details, rationale and the token strategy: [`agents.md`](agents.md).

| Stage | Setup | Status |
|-------|-------|--------|
| 1. Single agent | One session, one feature | Used for phases 0 to 3 |
| 2. Specialized subagents | `.claude/agents/*.md`: explorer, backend-dev, frontend-dev, reviewer, ui-auditor | In place |
| 3. Parallel agents | One git worktree and one branch per agent | In place for independent lots |
| 4. Automation | Hooks (`.claude/hooks/`), skills (`.claude/skills/`), CI | In place |
| 5. Programmatic agents | Claude Agent SDK | Planned for the AI features (phase 7) |

Rules for multi-agent work:
- Each agent has one clear responsibility and the minimum tools it needs (e.g. a reviewer is read-only).
- Only the main session changes git state: agents report, the orchestrator commits.
- Parallel agents never share a working tree: one worktree and one branch per agent.
- Agent outputs are reviewed like human contributions; the human remains the merge gate.
- Spawning agents costs tokens: use them only when the work is truly independent or needs an isolated context.

---

## 8. Session checklist

**Start**
- [ ] `main` is up to date, previous branch deleted
- [ ] `PROGRESS.md` read, next task chosen
- [ ] Fresh session (`/clear`)

**End**
- [ ] Tests green, results reported
- [ ] One commit per piece, each with `Refs #n`
- [ ] `PROGRESS.md` updated
- [ ] `git status` clean, no unwanted files
- [ ] User reviews, then pushes / opens PR (or asks the agent explicitly)
