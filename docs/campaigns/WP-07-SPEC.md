# WP-07 — Exchange: offline trade drafts and currency-position honesty

**Baseline:** `b54636fae57806c6d75c710c7621a49c8a3132d0` (external review).
**Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED`.

## 1. What existed, and the real gap

The online exchange engine was already complete: `backend/src/services/exchange/exchange.service.ts`
sets up FX GL roles once, computes exact BigInt amounts with `convertAtRate`, enforces KYC with
`identityRequired`, and posts book-currency journal entries exclusively through atomic RPCs
(`docs/exchange-03-migration.sql`). `currency-exchange.ts` even shipped a domain rule
`resolveOfflineFxConflict` for a queued sell whose server position fell short.

What was missing was the **device side**: an agent with no signal could not write a trade at all.
The capability therefore honestly carried `FX_TRADES_ONLINE_ONLY` and the `exchange` engine declared
`localEngine: null`.

## 2. What this package adds — one shared core, no second money engine

```text
industry profile (currencyExchange, travelAgency)
  → currency_exchange capability (pricing_rates/exchange engine)
  → fx-drafts.domain.ts (PURE: same convertAtRate, 4-state draft machine, review rule)
  → local fx_trade_drafts table (migration V34) + /local-fx/trade-drafts routes
  → useFxTradeDrafts / useCreateFxTradeDraft / useSubmitFxTradeDraft / useCancelFxTradeDraft
  → existing server /api/exchange/trades still owns KYC, position and the GL posting
```

**Hard invariants (tested):**

- A draft moves **no** cash, changes **no** currency position and posts **no** journal entry.
  `journal_entry` stays empty after create and after submit.
- The rate is locked in the draft; the book amount reuses `convertAtRate` (USD cents × 70.25 →
  70,250 AFN minor, AFN zero decimals). No `/100`, no float-derived money.
- `Idempotency-Key` (or `id`) returns the SAME draft — a retried sync cannot create two trades.
- `submit` only marks `pending`; a queued **sell** with an unknown/short server position is flagged
  `needs_review` using the existing `fxDraftNeedsReview` rule, never silently applied.
- `invoice.create` capability is enforced locally; a `viewer` is refused with 403.
- Editing after submission is impossible — only the four declared transitions exist.

## 3. Files changed

- new: `packages/validation/src/schemas/universal-core/fx-drafts.domain.ts` + test
- new: `packages/local-engine/src/routes/fx-trade-drafts.ts` + offline test
- new: `packages/api/src/hooks/fx-trade-drafts.ts`
- `packages/app-bridge`: `FX_TRADE_DRAFT_STATEMENTS`, migration `V34`, `SCHEMA_VERSION = 34`
- registrations in local-engine/validation/api index files
- capability limitation `FX_TRADES_ONLINE_ONLY` → `FX_TRADE_CONFIRMATION_ONLINE_ONLY`
  (drafts are offline; **confirmation** is still online — the engine remains `online_required`,
  so the claims guard does not contradict this)
- this spec.

## 4. Exit criteria

- pure-rule test + offline route test green; `tsc` and `eslint` clean on changed packages.
- `capability-claims-match-code` zero violations; generators `--check` green.
- No live Postgres in this environment: the existing `exchange-02/03.pg.test.ts` remain generated
  but unexecuted here.
