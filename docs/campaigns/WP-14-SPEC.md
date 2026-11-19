# WP-14 — Procurement: pack rounding and three-way match on device

**Baseline:** `b54636fae57806c6d75c710c7621a49c8a3132d0`.
**Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED`.

## What changed

The shared rules already existed but the Local Engine only used the simple `planDraftPurchaseOrders`:

- `POST /inventory/reorder-suggestions/draft-po-rounded` — calls `planReordersWithPackRounding`:
  deficits round UP to whole purchase packs, open PO stock is subtracted, and a human must approve.
- `POST /inventory/three-way-match/preview` — calls `evaluateThreeWayMatch`: a short receipt yields
  `QTY_SHORT`, `matched: false`, `mayApprovePayment: false`. **Preview only** — no PO changed, no
  money posted; the server still owns the binding match and the approval gate.

Tests: `offline-procurement-match.test.ts` (3/3): 18 units in 3 packs, short receipt refused, matched
set accepted.

Limitations → `PACK_ROUNDING_ON_DEVICE_PREVIEW` + `THREE_WAY_FINAL_MATCH_SERVER_ONLY` (honest;
binding decisions stay server-side), translated in fa/af/en.

## Out of scope

- Live PG/HTTP witness (environment blocked); no server route/permission changes.
