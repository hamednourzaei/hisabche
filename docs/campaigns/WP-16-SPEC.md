# WP-16 — Auto parts: core charge applied on the invoice line

**Baseline:** `b54636fae57806c6d75c710c7621a49c8a3132d0`.
**Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED`.

## What changed

The shared rules already existed but had no caller (`CORE_CHARGE_NOT_APPLIED`):

- `buildCoreDepositLine` — a separate `core_deposit` **liability** line (never revenue).
- `planCoreRefund` (new) — refunds a returned core once; a second refund returns 0 with
  `doubleRefundBlocked: true`; an unknown deposit stays `null`, never an invented zero.

Wired to the device on `/local-auto/core-deposit` and `/local-auto/core-refund` (fitments route).
Tests: `core-charge.test.ts` (3/3) + `offline-core-charge.test.ts` (3/3). No journal is posted on
the device — the invoice carries the line and the server owns the ledger posting.

Limitation → `CORE_REFUND_POSTING_SERVER_ONLY` (honest: refund posting is still server-side),
translated in fa/af/en.

## Out of scope

- Live PG/HTTP witness (environment blocked).
- No server-side core-deposit GL role changes.
