# WP-06 — Gold: purity and making charge on the invoice line

**Baseline:** `b54636fae57806c6d75c710c7621a49c8a3132d0` (external review, commit `b54636fa`).
**Status after this package:** `IMPLEMENTED_NOT_LIVE_VERIFIED` (code + automated evidence; no live
Postgres/HTTP witness in this environment — see `docs/prompts/THE-LAST.md`).

## 1. The claim the review flagged, and what the code actually says

The external review stated that a gold shop still lacked «complete invoice-line price calculation
from purity and making charge», and the generated capability matrix repeated three limitations:

| Old limitation code                  | What it claimed                        | What the code actually does                                                                                                                                                                                                                                                                                                       |
| ------------------------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LINE_PRICING_FROM_PURITY_NOT_WIRED` | no invoice line is priced from purity  | `InvoiceService.withDerivedLineTotals` calls `quoteGoldItemPrice` for a line carrying a `goldSnapshot`; that calls `priceGoldLineWithSnapshot` (BigInt, integer mg × locked 24K snapshot × karat/24) and pushes the result through the single quote/floor/promotion engine (`backend/src/services/invoice.service.ts:2715-2750`). |
| `MAKING_CHARGE_NOT_COMPUTED_ON_LINE` | making charge not computed on the line | `priceGoldLineWithSnapshot` computes the charge (percentage / per-gram / fixed) and `buildItemRows` persists it in `making_charge_minor` next to `metal_rate_24k_minor`, `metal_purity_karat`, `metal_net_weight_mg`, `metal_rate_captured_at`, `metal_rate_captured_by` (`invoice.service.ts:2778-2786`).                        |
| `OLD_GOLD_TRADE_IN_NOT_ON_INVOICE`   | old-gold trade-in has no caller        | `POST /api/gold/second-hand-purchase` → `MetalRatesService.recordSecondHandPurchase` → `planSecondHandGoldPurchase` → RPC `gold_record_second_hand_purchase` (weight book **and** money book, KYC gate, idempotency key), with an HTTP test and a PG test.                                                                        |

A capability is complete only when the chain works across layers; here the chain is present in the
shared core, not a second gold-only billing engine:

```text
industry profile (jewellery / watches)
  → gold_purity + making_charges + gold_trade (capability resolver)
  → gold-jewellery.domain.ts (pure rules: deriveKaratGramRate, priceGoldLineWithSnapshot,
     planSecondHandGoldPurchase, validateGoldItemWeights, reconcileGoldLocationWeights)
  → quoteGoldItemPrice (pricing.ts — one price engine, carries locked snapshot)
  → invoice.schema.ts line.goldSnapshot + invoice-grid.ts mapping
  → InvoiceService.withDerivedLineTotals / buildItemRows (server derives, never trusts client total)
  → gold-01-migration.sql RPCs (gold_record_second_hand_purchase, gold_record_melt_scrap,
     gold_reconcile_location) — workspace_id on every write
  → metal-rates.routes.ts + local-engine metal-rates.ts + hooks/universal-core.ts
  → gold-rate-board-panel.tsx (UI) — fa / af (Dari) / en
  → gold-workflow.test.ts, gold-snapshot-pricing.test.ts, v59-1-gold-routes-http.test.ts,
     gold-01.pg.test.ts, universal-core-parity.test.ts
```

## 2. The one gap that is still real

`summarizeGoldReportByKarat` — the weight/value report by karat and operation type, with
«unknown profit is null, not zero» — is a **pure function with no production caller**: no backend
route, no hook, no screen. This is the remaining specialized-gold gap and the single honest
limitation kept for all three capabilities: `GOLD_WEIGHT_VALUE_REPORT_NOT_WIRED`, translated in
fa / af / en. It is a behaviour-level limitation of the kind the claims guard deliberately does
not try to disprove from a file graph (`capability-claims.domain.ts:16-21`).

The three old codes are removed from the registry and from all three locale catalogues so no
generated document repeats a claim the code contradicts. `PARTIAL_WITHOUT_LIMITATION` still holds
(each partial capability keeps one limitation), and `capability-composition.test.ts` — which asserts
`gold_purity` and `making_charges` stay in `result.partial` — is left untouched.

## 3. Files changed

- `packages/validation/src/schemas/business-capabilities.ts` — three gold entries: honest limitation + source comments.
- `packages/i18n/messages/{fa,af,en}/common.json` — replace three stale limitation texts with one Dari/Persian/English text for `GOLD_WEIGHT_VALUE_REPORT_NOT_WIRED`.
- this spec; regenerated campaign/architecture docs via their canonical scripts.

## 4. Exit criteria

- `capability-claims-match-code.test.ts` — zero violations; generator `--check` green.
- `i18n-keys-exist` and `dari-is-not-pashto` — green (`af` is Dari; no Pashto-only letters).
- `capability-composition.test.ts` — green, gold still resolves to `partial`.
- All generators reproducible with `--check`; generated docs record HEAD `b54636fa`.

## 5. Out of scope (honest)

- Wiring `summarizeGoldReportByKarat` to a route/hook/screen is a separate, follow-up change; the
  limitation above records that it is **not** done rather than pretending otherwise.
- No live Postgres/HTTP/browser witness: `postgres.exe` cannot start in this environment
  (`SeCreateGlobalPrivilege`), so the gold PG test is generated but unexecuted here.
