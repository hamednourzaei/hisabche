# 25 — OWNER DECISIONS CATALOG & SAFE DEFAULTS

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION  
**Location**: `docs/architecture/universal-business-core/25-OWNER-DECISIONS.md`

<!-- target-vocabulary -->

> **Vocabulary note (M0, 1 Nov 2026):** commands, events, tables and function names in this document that do not
> exist in the repository are **target** names of a design, not claims about current code.
> `node scripts/audit/verify-spec-references.mjs` keeps checking every file path here.

---

## 1. Catalog of Open Product & Architectural Decisions

| Decision ID | Question / Problem                                                                                                               | Alternatives                                                                                                                        | Trade-offs & Risks                                                                                                              | Safe Default (Implemented until Approved)                                                                                                             |
| :---------- | :------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OD-01`     | **Offline Cash Refund Cap**<br>How much cash should an unverified offline device be allowed to refund?                           | A) Pre-allocated lease quota (e.g. 5,000 AFN)<br>B) Zero offline cash payouts (record request only)<br>C) Unrestricted local refund | Option C risks duplicate cash payouts across devices.<br>Option B causes friction if cashier has no signal.                     | **Option B**: Without a valid cryptographic server lease, record the return and refund request locally, but **do not dispense physical cash**.        |
| `OD-02`     | **Package Credit Expiration Accounting**<br>What happens to unredeemed package credits when the validity period expires?         | A) Forfeit to Breakage / Other Income<br>B) Automatically roll over indefinitely<br>C) Auto-refund to customer debt balance         | Option A may cause customer complaints.<br>Option B accumulates permanent liabilities on balance sheet.                         | **Option A**: Unredeemed credits transition to `expired`; revenue recognized as Breakage Income after 30-day grace period.                            |
| `OD-03`     | **Negative Stock Default Policy**<br>Should offline sales be blocked if local inventory reads 0?                                 | A) `refuse` (Hard block)<br>B) `warn` (Allow sale, flag red warning)<br>C) `allow` (Allow silently)                                 | Option A halts checkout if physical stock exists but wasn't entered.<br>Option B may distort AVCO costing if buy price unknown. | **Option B**: Display prominent warning and allow sale; mark unit cost `cost_unknown` until purchase bill entered.                                    |
| `OD-04`     | **Local Database Auto-Restore**<br>Should the desktop app offer an automated one-click SQLite database restore from backup file? | A) Automated drop & restore<br>B) Manual product inspection only                                                                    | Option A risks catastrophic accidental loss of un-synced outbox mutations.                                                      | **Option B (`REQUIRES_PRODUCT_DECISION`)**: Export backup is fully supported; restore requires manual confirmation and warning of outbox queue flush. |
| `OD-05`     | **Offline Fiscal Period Lock Override**<br>Can an offline device post or backdate transactions into a locked accounting period?  | A) Owner PIN unlock offline<br>B) Strictly blocked until online                                                                     | Option A risks audit divergence across devices.                                                                                 | **Option B**: Strictly blocked offline; period unlock requires server authorization.                                                                  |
