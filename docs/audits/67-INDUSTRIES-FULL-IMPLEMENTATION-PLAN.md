# 67-INDUSTRIES FULL SHARED-CORE IMPLEMENTATION PLAN (WAVE 1–6)

> **Governance:** Strictly subordinate to `AGENTS.md` (Single-Core Doctrine — zero parallel engines; `workspace_id` boundary; minor-unit integer math; `fa`/`af`/`en` i18n; `exactOptionalPropertyTypes`; no `any`/`@ts-ignore`/`eslint-disable`; no live Supabase DDL).
> **Target:** Convert all `52` unique gaps (`NOT_IMPLEMENTED` & `PARTIAL`) in `docs/sales/67-INDUSTRIES-PAIN-AND-GAP-MATRIX.md` to genuinely implemented, tested `SUPPORTED` shared-core capabilities.

## CHECKPOINT LEDGER

| Wave     | Scope                                                                                                                                                              | Status        | Verification                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ---------------------------------------------------------------------------------------------------- |
| `WAVE-1` | Till Z-Report (`G31`), Device PIN Lock (`G91`), Volume Tier Pricing (`G98`), Gift Cards & Store Credit (`G01/G02`), Loyalty Points (`G65`)                         | `DONE`        | `pos-z-report` 2/2, `wave1-loyalty-credit` 2/2, `wave1-tier-pricing` 1/1, `offline-matrix` 7/7 + 5/5 |
| `WAVE-2` | FEFO (`G57`), Waste/Yield Loss (`G55`), Recipes/MRP (`G54/G53`), Barcode Labels (`G60`), RMA/IMEI/Trade-in/VIN (`G44/G45/G46/G47`)                                 | `IN_PROGRESS` | —                                                                                                    |
| `WAVE-3` | Tips/Service/Split (`G04/G05/G06`), Table Map/KDS (`G07/G08`), QR/Online/WhatsApp (`G09/G10/G62/G63`), Layaway/Subscriptions/Capacity/Waitlist (`G03/G15/G68/G69`) | `PENDING`     | —                                                                                                    |
| `WAVE-4` | VAT/Moadian (`G33/G34`), Bank Matching Rules (`G23/G24`), FX KYC/AML (`KYC/AML`)                                                                                   | `PENDING`     | —                                                                                                    |
| `WAVE-5` | COD/Pick-Pack (`G14/G59`), Fleet/Fuel/Insurance (`G49/G50/G100`), Procurement (`G72/G73/G74/G76`), Docs/Guarantees (`G22/G28`), Partial Engines                    | `PENDING`     | —                                                                                                    |
| `WAVE-6` | Full `tsc`, `vitest`, `eslint`, `git diff --check`, `pnpm code-intel update`, regenerate `67-INDUSTRIES-PAIN-AND-GAP-MATRIX.md`                                    | `PENDING`     | —                                                                                                    |
