# 0006. "Paper and ink" design tokens and self-hosted fonts

- Status: accepted
- Date: 2026-10-26

## Context and problem

The first interface used a generic palette (indigo and mint gradients, soft shadows, floating cards) that read as
template-generated. Colours were also hard-coded in about seventy places, which made a dark theme impractical. Fonts
were loaded from Google Fonts.

## Options considered

| Option | For | Against |
|--------|-----|---------|
| Component library (Angular Material, PrimeNG) | Many ready components | Recognisable look, heavy theming, more weight for a small app |
| Utility CSS framework | Fast styling | Adds a build dependency; identity still has to be designed |
| **Own design tokens in CSS custom properties** | A distinctive identity, a dark theme by redefining tokens, zero runtime | The UI kit is maintained in the project |

## Decision

- Identity: ivory paper, near-black ink, one bottle-green accent, hairline rules instead of shadows; Instrument Serif
  for display, Geist for text, Geist Mono with tabular figures for amounts. An invoicing product should look like a
  well-set financial document.
- Every colour comes from a token; tints are derived with `color-mix()`. The dark theme redefines the tokens under
  `[data-theme='dark']`, set before first paint by an inline script and then by `ThemeService`.
- Fonts are self-hosted with Fontsource, versions pinned.

## Consequences

- No visitor IP address is sent to a third-party font CDN (a German court fined a site for exactly that in 2022,
  LG München I, 3 O 17493/20), and the Content-Security-Policy needs no extra origin.
- No component needed a dark variant.
- The inline theme script must be allowed by hash once the CSP is added.
