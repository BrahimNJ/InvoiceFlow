# Frontend rules (loaded when working under `frontend/`)

Angular 21, standalone components, signals, Vitest (`@angular/build:unit-test`), Prettier (100 cols, single quotes).

## Conventions
- Standalone components with `ChangeDetectionStrategy.OnPush`, `inject()` instead of constructor injection,
  signals and `computed()` for state, new control flow (`@if`, `@for`, `@defer`).
- Feature folders mirror backend modules: `<feature>/<feature>.service.ts`, `<feature>.models.ts`,
  `<feature>.fixtures.ts`, one folder per screen. Specs sit next to the file they test.
- Routes are lazy (`loadComponent`) in `app.routes.ts`, protected by `authGuard`; page titles end with `· InvoiceFlow`.
- Reuse the shared kit before writing UI: `shared/ui` (page header, empty state, help tip, confirm dialog,
  toasts, autocomplete), `shared/icon`, `shared/forms`, `shared/format/money` for euros and percentages.
- API errors are RFC 9457 problem details: display them with `errorMessage()` from `core/http/problem-detail`.
- Styles: plain CSS, design tokens in `src/styles.css`; component styles stay in the component.
- Accessibility: semantic HTML, labelled controls, visible focus, keyboard reachable dialogs.

## Checks
- `npm run build && npm test -- --watch=false` from `frontend/`; report the real pass/fail counts.
- Unit tests do not prove a screen works: check visual changes in a real browser (ui-auditor agent / Playwright).
