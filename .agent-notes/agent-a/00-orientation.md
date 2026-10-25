# Pass 0 — orientation

## Files read

- `AGENTS.md` (full, via session prompt)
- `CLAUDE.md` lines 1–260 (§0–§8 header; §1 five laws, §2 guardrails, §3 structure)
- `README.md` (18 lines, stale — only npm commands)
- `PROJECT_STATE.md` (full, 170 lines)
- `.ai/codebase/CODEBASE_MAP.md` (full, 439 lines)
- `documents/PRODUCT.md` (full, 177 lines)
- `documents/DOMAIN_MODEL.md` (full, 131 lines)

## Facts proven

- Product is a Persian/Dari accounting + ERP for SMBs; primary users: shop owner,
  cashier, accountant, warehouse keeper (`documents/PRODUCT.md` §Target Users).
- Four apps: web (Next.js), Windows (Electron), mobile (Expo/Android), admin
  (`CODEBASE_MAP.md` §1 Apps). `packages/app-shell/src/app/app.tsx` is the shared
  route list for Windows/Android (`CLAUDE.md` §3, §0.6).
- Money is integer minor units on the money path; server derives totals from lines
  (`AGENTS.md` §1.3, `CLAUDE.md` §1.3).
- `workspace_id` is the only tenancy boundary (`CLAUDE.md` §1.1).
- Debt is derived: `debt = total − paid_amount` (`DOMAIN_MODEL.md` §3 Payment & Debt).
- Invoice total = subtotal − discount + tax, computed server-side (`DOMAIN_MODEL.md` §3).
- Every stock change is an inventory movement row; `min_stock_level` default 5
  (`DOMAIN_MODEL.md` §3 Product/Inventory).
- Roles: owner > admin > member > viewer; `record.delete` requires owner
  (`DOMAIN_MODEL.md` §3 Permission).
- Approval workflow: template → steps → instance → actions; wrong role gets 403
  (`DOMAIN_MODEL.md` §3 Approval).
- Four currency codes exist (AFN/USD/PKR/IRR) in `packages/store/src/slices/currency.slice.ts`
  (`DOMAIN_MODEL.md` §3). NOTE: this is the _old_ store slice; the newer rule is
  `baseCurrencyOf()` per books. Not used as a sales claim.

## Facts not proven (contradictions / open)

- `PROJECT_STATE.md` says the backend running in production still filters by `user_id`
  and "Not deployed" for tenancy work → **deployment state is unknown from the repo**.
  A sales claim of "your data is separated per business" must rest on code + RLS test,
  not on a live deploy.
- `PROJECT_STATE.md`: "mobile adapter integration NOT STARTED" for the sync engine,
  while `documents/PRODUCT.md` claims offline-first on every platform. Code wins;
  mobile offline must be treated as PARTIAL/UNCLEAR until the mobile adapter is read
  in Pass 3.
- `PROJECT_STATE.md`: 29 tables still tenancy-by-`user_id` (`warehouses`, `employees`,
  `purchase_orders`, `boms`, `crm_interactions`, `accounts`, `journal_entries`…).
  → any "team shares one book" claim for those modules is not provable. Recorded.
- `DOMAIN_MODEL.md` says Supplier has no dedicated table, but `backend/src/routes/supplier.routes.ts`
  exists per the manifest → verify in Pass 4.
- `README.md` is stale (npm, not pnpm) — ignored.

## Deliberately skipped

- `CLAUDE.md` lines 261–700 (technical traps, session caches) — not claim-bearing.
- `CODEBASE_MAP.md` §2 hazard file lists — platform classification only.
