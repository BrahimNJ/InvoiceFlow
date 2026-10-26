---
name: new-module
description: Scaffold a new backend business module (and optionally its frontend feature) following the customer/product reference implementations, layer by layer with one commit per layer. Use when starting a new domain module such as payments or company details.
argument-hint: <module-name> [issue-number]
---

Create the InvoiceFlow module `$ARGUMENTS` end to end, following `backend/CLAUDE.md` and `frontend/CLAUDE.md`.

1. **Check the ground**: an issue exists and the current branch is `<issue>-feat/<name>`; otherwise stop and say so.
   Ask the `explorer` agent for the files of the `product` module (backend and frontend) as a path list; do not read them all in the main session.
2. **Plan**: list the fields, validation rules, owner scoping and endpoints; ask the user only if a business rule is ambiguous.
3. **Backend, one commit per layer**, tests green at each step:
   1. Flyway migration `V<next>__create_<name>_table.sql` + entity + repository + `@DataJpaTest`.
   2. DTO records with Bean Validation + mapper.
   3. Service scoped to the owner + Mockito test (other owner's id → `ResourceNotFoundException`).
   4. Controller + `@WebMvcTest` test + ownership integration test.
   Delegate a layer to `backend-dev` only when it is large; small layers stay in the main session.
4. **Frontend** (if requested): models, service + spec, list and form screens on the shared UI kit, lazy routes.
   Then ask `ui-auditor` to check the screens at phone and desktop widths.
5. **Review**: run `reviewer` on the branch diff, fix what is confirmed.
6. **Close the task** with the `progress` skill.

Commit each step with the `commit` skill. Never push.
