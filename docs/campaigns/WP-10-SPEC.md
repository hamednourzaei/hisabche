# WP-10 — Table service on the shared sales-order core

**Baseline:** `b54636fae57806c6d75c710c7621a49c8a3132d0`.
**Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED`.

## What changed

`table_service` was `planned` with no evidence. It is now `partial` on the shared order core —
no second sales engine:

- `table-service.domain.ts` (pure): table occupancy (one open order per table), forward-only KDS
  stages, kitchen gate (only a confirmed order), and a bill split that must foot to the total.
- `/local-tables/orders`, `/:id/stage`, `/:id/split` — device routes; no money/posting here.
- Capability promoted planned → partial; limitation `TABLE_FINAL_INVOICE_SERVER_ONLY`
  (the binding invoice is still the server's), translated fa/af/en.

Tests: `table-service.test.ts` (4/4), `offline-table-service.test.ts` (4/4).
The injection test in `capability-claims-match-code.test.ts` now uses `livestock_register` (still
genuinely planned) as its «planned capability» example — same rule, valid fixture.

## Out of scope

- Live PG/HTTP witness (environment blocked); no server route or schema changes.
- Recipes/ingredient consumption of the kitchen remain a separate production chain.
