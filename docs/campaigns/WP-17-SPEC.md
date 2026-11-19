# WP-17 — Recurring contracts: offline recording and bill-period proposal

**Baseline:** `b54636fae57806c6d75c710c7621a49c8a3132d0`.
**Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED`.

## What changed

`contracts_recurring` had a server service but `localEngine: null` (`SERVER_ONLY_NO_OFFLINE_ENGINE`).
Added:

- `local_contracts` + `local_contract_bills` tables (migration V35, `SCHEMA_VERSION=35`).
- `POST /local-contracts`, `/:id/activate`, `/:id/bill-period` using the shared rules
  `canBillContractPeriod` and `contractBillIdempotencyKey`. A repeated period is a no-op.
- No invoice and no journal on device — the server still issues the binding bill.

Tests: `offline-contracts.test.ts` (3/3): draft cannot bill, active can; idempotent period; no money
moved. Engine now declares its local route and `offlineStatus: 'partial'`; limitation →
`CONTRACT_BILL_INVOICE_SERVER_ONLY`, translated in fa/af/en.

## Out of scope

- Live PG/HTTP witness (environment blocked); no server route changes.
