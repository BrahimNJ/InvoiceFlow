---
name: progress
description: Update PROGRESS.md at the end of a task or lot (status, date, issue and PR links, changelog entry, next task) and commit it. Use when a task is finished or its state changes.
---

Update `PROGRESS.md` (rule 7 of `CLAUDE.md`).

1. Read `PROGRESS.md`, `git log --oneline main..HEAD` and the branch name for the issue number.
   Check the real state of related pull requests with `gh pr view <n> --json state` instead of assuming it.
2. Update, keeping the existing table formats:
   - `Last update` date (absolute date, today).
   - The task rows touched: status from the legend, `#issue / #PR`, short factual notes.
   - Rows whose pull request was merged since the last update → ✅ Done.
   - `Next task`.
   - One changelog line at the top: date + what changed, with real test counts if tests ran.
3. Commit with the `commit` skill as `docs: update progress ...`. Never push.
