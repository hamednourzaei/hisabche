# 07 — Financial Integrity Audit Evidence

> **Standards:** ISO/IEC 25010:2023 (Safety, Functional Suitability), ISO/IEC/IEEE 29119, ISTQB CTFL v4.0.1
> **Execution Date:** 2026-11-25

## 1. Verified Invariants (Executed Suites)

| Invariant                                              | Verification Suite                                                                                | Result                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Double-entry debit = credit & period close             | `backend/src/__tests__/accounting-close-and-ledger.test.ts`                                       | `PASS` (included in `8/8`, `128/128` run) |
| Golden financial + inventory costing (FIFO/AVCO)       | `backend/src/__tests__/financial-and-inventory-golden.test.ts`, `inventory-costing-rules.test.ts` | `PASS`                                    |
| Unknown is never zero (`null` preserved, never `?? 0`) | `backend/src/__tests__/unknown-is-not-zero.test.ts`                                               | `PASS`                                    |
| No hardcoded currency (`'AFN'` never defaulted)        | `backend/src/__tests__/no-hardcoded-currency.test.ts`                                             | `PASS`                                    |
| AFN 0-decimal minor-unit enforcement                   | `packages/formatting/src/__tests__/currency-policy.test.ts`, `v59-http-routes.test.ts`            | `PASS`                                    |
| Financial reconciler in V76 Capacity suite             | `backend/src/__tests__/capacity-intelligence.test.ts`                                             | `PASS`                                    |

## 2. Limitations

- Live Postgres RPC transaction boundary tests (`*.pg.test.ts`) are `BLOCKED_EXTERNAL` on Windows (`embedded-postgres` `initdb` exit code `0xC0000142`) and must be executed on Linux/CI Postgres.
