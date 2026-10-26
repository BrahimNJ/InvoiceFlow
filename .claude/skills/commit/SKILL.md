---
name: commit
description: Create one conventional commit for the current coherent change after checking git status, sensitive files and tests. Use whenever a piece of work is ready to be committed.
argument-hint: [optional summary]
---

Commit the current change following the InvoiceFlow git workflow.

1. `git status --short` and `git diff --stat`: make sure the change is one coherent piece (one layer or concern).
   If it mixes concerns, stage and commit them separately.
2. Refuse to stage `.env*` (except `.env.example`), `*.pem`, `*.key`, `.idea/`, `*.iml`, `.vscode/` (except `frontend/.vscode/`)
   or `.claude/settings.local.json`. Stage files by name, never `git add -A`.
3. Run the checks for what changed and report the real result:
   - `backend/` → `cd backend && ./mvnw test`
   - `frontend/` → `cd frontend && npm run build && npm test -- --watch=false`
   - docs or config only → no test run, say so.
   Do not commit on a red build.
4. Get the issue number from the branch name (`<n>-<type>/<name>`).
5. Commit with a HEREDOC message:
   ```
   <type>(<scope>): <imperative summary, lower case, no period>

   <why, wrapped at 72 columns, only if not obvious>

   Refs #<n>

   Co-Authored-By: <attribution line from the session>
   ```
   Types: feat, fix, test, docs, build, ci, chore, refactor. Scope: the module or area.
6. Show `git log --oneline -1`. Never push.

$ARGUMENTS
