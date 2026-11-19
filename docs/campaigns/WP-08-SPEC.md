# WP-08 — Tiered (quantity-break) pricing

**Baseline:** `b54636fae57806c6d75c710c7621a49c8a3132d0`.
**Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED` (shared rule; UI tier editor is still basic — the honest
limitation `QUANTITY_BREAK_UI_BASIC` is kept).

## The rule, not a second price engine

`packages/validation/src/schemas/universal-core/tier-pricing.domain.ts`:

- `tierUnitPrice(quantity, breaks)` — the highest `minQty` not above the quantity earns its
  unit price; an empty/invalid ladder returns `null` (never a silent zero).
- `quoteTieredPrice(...)` — substitutes the earned tier into `ProductPricing.baseUnitPrice` and
  delegates **everything else** (floor, promotion, drift) to the existing `quotePrice` engine.
  It never computes a line total and never applies a discount itself.

Client, server and local engine calling this with the same input receive the same number — the
exit criterion of WP-08. Tests: `tier-pricing.test.ts` — 1/10/50 units get 10/9/8; order-independent;
a 10% promotion on the 50-unit tier yields 720 minor from an 800 base; no tier means base stands.

## Still open (honest)

- The tier **editor UI** (`price-lists-panel`) is still basic — one price per product, no visible
  break grid. The rule exists and is server-authoritative; the screen is not yet wired to it.
- No live Postgres/HTTP witness in this environment.
