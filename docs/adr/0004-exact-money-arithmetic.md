# 0004. Exact money arithmetic, one rounding rule

- Status: accepted
- Date: 2026-10-24

## Context and problem

Invoices show line totals, VAT per rate and a grand total. The editor previews totals live in the browser; the
server computes the totals that are stored and issued. With floating point (`0.1 + 0.2 = 0.30000000000000004`)
and different rounding choices, the preview and the issued invoice could differ by a cent, which is unacceptable on
a legal document.

## Options considered

| Option | For | Against |
|--------|-----|---------|
| `double` / JavaScript `number` everywhere | Simple | Binary floating point cannot represent most cents exactly |
| Server only, no live preview | One implementation | Poor editing experience: totals appear only after saving |
| **Exact decimals on both sides with the same rules** | Live preview that matches the issued invoice to the cent | Two implementations to keep aligned |

## Decision

- Server: `BigDecimal` with scale 2 for amounts, `NUMERIC` columns; `@FrenchVatRate` restricts rates to
  20, 10, 5.5, 2.1 and 0 %.
- Browser: integer arithmetic with `BigInt` (quantities in thousandths, prices in cents, rates in hundredths of a
  percent) in `invoice-calc.ts`.
- One rule on both sides: each line rounded half up to the cent; VAT computed **once per rate** on the sum of the
  lines at that rate; total = subtotal + VAT.
- The server always recomputes; client totals are display only.

## Consequences

- The preview, the issued invoice and the stored totals agree to the cent; the landing page's sample invoice uses the
  same code.
- Both test suites assert the same cases, so a divergence fails CI.
