# V55 — E2E VERIFICATION RUNBOOK

**Date:** 2026-11-11 · Companion to `V55-FINAL-COMPLETION-AUDIT.md`.

Separates what is ALREADY VERIFIED in this sandbox from what needs the
owner's environment. Nothing here was faked: every "verified" line names the
command and the real totals; every blocked line says exactly what to run.

Environment variable NAMES only are listed — never values. Never commit
`.env*`.

---

## A. Verified locally in this session (no owner action needed)

Every row below ran green in this sandbox; totals are in
`V55-FINAL-COMPLETION-AUDIT.md §7`.

| Chain (user path)                                                                                | Where it is proven                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offline pharmacy: batch receive → FEFO sale → cancel returns everything → restart keeps identity | `packages/local-engine/src/__tests__/offline-batch-identity.test.ts` (16 tests) + `offline-vertical-e2e.test.ts` (2 tests, the full variant→batch→serial→cancel walk)                           |
| One FEFO algorithm for server AND device                                                         | `packages/validation/src/__tests__/lot-allocation.test.ts` (9) — the shared core; `backend/src/__tests__/traceability-rules.test.ts` — the server side consuming the SAME re-exported functions |
| Offline serial/IMEI claim (v21)                                                                  | `packages/local-engine/src/__tests__/offline-serial-identity.test.ts` (6)                                                                                                                       |
| Offline variant identity (v20)                                                                   | `packages/local-engine/src/__tests__/offline-variant-identity.test.ts` (7)                                                                                                                      |
| Variant sale availability per variant                                                            | `packages/validation/src/__tests__/variant-sales-availability.test.ts` (8) + `backend/src/__tests__/invoice-variant-availability.test.ts` (4)                                                   |
| Purchase line names its variant (rule + wiring)                                                  | `backend/src/__tests__/purchase-variant-binding.test.ts` (10)                                                                                                                                   |
| Mobile shows the shared variant/serial pickers                                                   | `apps/mobile/src/__tests__/mobile-picker-wiring.test.ts` (6)                                                                                                                                    |
| Local migration v22 on a real SQLite file, run twice                                             | `packages/local-engine/src/__tests__/migration-v22.test.ts` (4)                                                                                                                                 |

## B. PostgreSQL (embedded) — runnable here, run again on the owner's machine

The pg slice proves the SERVER migration and SQL behaviour on a real
Postgres, not Supabase:

```bash
cd backend
npx vitest run src/__tests__/purchase-variant-binding-01.pg.test.ts
```

Expected: 3 passed — migration applied twice, `docs/VERIFY-purchase-variant-binding-01.sql`
all-true, a ghost variant refused by the FK. (Embedded Postgres occasionally
fails to bind a port — `EACCES`/`ECONNREFUSED`: rerun that one file before
concluding anything; AGENTS.md §7.)

## C. Live external E2E — BLOCKED_EXTERNAL_CREDENTIAL (owner-operated)

These steps need a live Supabase project and/or a device. Run them in order;
**deploy the backend BEFORE the web/desktop/mobile builds** (the backend now
serves `POST /api/operations/batches/issue`, and the clients call it).

### C1. Required environment (names only)

- `SUPABASE_URL`, Supabase service credentials — as the backend already reads them.
- A workspace with `batch_expiry` + `serialized_items` + `variants` enabled
  (onboarding: pharmacy archetype).
- One Android device/emulator with the offline edition installed, and one web
  session.

### C2. Schema (a person runs these; the agent never does)

1. `docs/purchase-variant-binding-01-migration.sql` (idempotent).
2. `docs/VERIFY-purchase-variant-binding-01.sql` — **every row must say
   `ok = true`.** The final line is
   `PENDING HUMAN CONFIRMATION` by design: a person confirms it.

No other DDL is required by V55 final completion: the batch tables
(`stock_batches`, `lot_allocations`) already exist in `docs/SETUP-COMPLETE.sql`,
and the local migrations (v20/v21/v22) are device-side SQLite.

### C3. Command sequence

```bash
# 1. Deploy backend (after C2).
pnpm --filter backend deploy        # per the repo's usual deploy path

# 2. Type/build gates on the shells (no production build unless authorised).
pnpm --filter @hisabche/app-shell exec tsc --noEmit
pnpm --filter web exec tsc --noEmit

# 3. Run the server locally against the live project and exercise:
#    POST /api/operations/batches                (receive B-1, 10 units, expiry soon)
#    POST /api/invoices                          (sell 4 of the product)
#    POST /api/operations/batches/issue          (claim: FEFO takes B-1, 4 left)
#    POST /api/operations/batches/issue  AGAIN   (replay → 400 BATCH_COUNT_MISMATCH)
#    POST /api/invoices/:id/cancel               (→ stock_batches.remaining_qty back to 10 server-side is NOT expected:
#                                                 the server restore path is releaseClaims for serials; batch
#                                                 restore on the server is part of Decision A/B scope — see audit §3)
```

### C4. Expected results (live)

- `GET /api/operations/batches?productId=…` lists the batch, soonest expiry first.
- The first issue returns the FEFO plan and `lot_allocations` gains one row
  per batch used, `consumer_type = 'invoice'`.
- The replayed issue answers `BATCH_COUNT_MISMATCH`.
- `GET /api/operations/expiry` buckets the batch; expired stock appears in the
  expired bucket with its write-off value.

### C5. Device (offline) — on the Android build

1. Turn network off. Receive batch `B-OFF-1` (10, expiry soonest) and
   `B-OFF-2` (10, later expiry) through the warehouse receive screen.
2. Sell 6 of the product at the till. Open the invoice detail: the batch
   claim took 6 from `B-OFF-1` (FEFO), the IMEI panel lists the claimed unit.
3. Kill the app, reopen (restart persistence): the batch still shows 4 on
   `B-OFF-1`, the allocation is still bound to the invoice.
4. Cancel the invoice: `B-OFF-1` back to 10, allocation rows gone, the IMEI
   back in stock.
5. Turn the network on and let sync drain: the invoice reaches the server
   through the domain road (as every financial entity does); the batch rows
   hydrate from the server pull (`WRITABLE_COLUMNS` includes `stock_batches`
   and `lot_allocations`). **Known, documented boundary:** an offline batch
   claim is device-local until an online claim/confirms it — the same
   reconciliation boundary the v21 serial slice accepted; recorded as the
   registry limitation and in the audit, not hidden.

### C6. Cleanup

Delete the test workspace (or the test batches/serials) created above; no
migration leaves test rows behind.

---

**Status of this runbook's section C: `BLOCKED_EXTERNAL_CREDENTIAL`.** No
result in section C may be claimed until the owner runs it.
