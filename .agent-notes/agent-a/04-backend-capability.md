# Pass 4 — backend capability

## Files read

- Route inventory: 95 files under `backend/src/routes/`, 772 handlers
  (`fastify.(get|post|put|patch|delete)`), plus handler lists per module.
- `services/invoice.service.ts` (create pipeline 788+, delete/reversal 1649+)
- `services/accounting/month-end.domain.ts` (full), `accounting.routes.ts:728-770`
- `services/base-currency.ts` (full)
- `services/authorization/authorization.domain.ts` (1-320), `role-capabilities.service.ts` (full), `sod.domain.ts` (1-70)
- `services/audit.service.ts` (1-80)
- `services/sync.service.ts` (1-90)
- `services/conflict/conflict.domain.ts` (1-70)
- `services/ai/ai-quota.service.ts` (1-90)
- `services/portability/snapshot.domain.ts` (1-45)
- `packages/ui/.../sync-center/backup-download-panel.tsx` (full)

## Facts proven

- **Invoice is one pipeline, not a form write**: create posts stock, cost layers,
  ledger, and derives totals server-side; delete/reverse has `reverseEffects`
  (invoice.service.ts). A reverse is a compensating document, not a row delete.
- **Month-end close** = 5 fixed steps in order (depreciation → FX revaluation →
  cost repost → year-end close → period lock), stops at first failure, never
  locks a known-bad period (`MONTH_END_ORDER`, `decideMonthEnd`). Route
  `POST /api/accounting/month-end`; UI tab `accounting?view=monthEnd`; keys
  `accounting.monthEnd.*`; guarded by `accounting-hub.test.ts:41`.
- **Roles**: owner / manager / seller. 25 capabilities with a minimum role each;
  owner-only: reverse a posted entry, lock a period, change stock costing,
  delete an invoice, approve a budget, manage members.
- **Record scope**: seller sees only own invoices/payments, all customers/products
  (`recordScope`). **Field scope**: seller never reads buy price, unit cost,
  COGS, margin, and cannot write sell price (`RESTRICTED_FIELDS`).
- **Per-workspace role edits** exist (`workspace_role_capabilities`); owner keeps
  `member.manage` + `workspace.manage` no matter what (`OWNER_LOCKED_CAPABILITIES`).
- **Separation of duties**: off by default, modes off/warn/strict, recorded
  override with a reason; same-person pairs on the same document (`sod.domain.ts`).
- **Activity trail**: who / when / what / before-after (`audit.service.ts`
  `WORKSPACE_AUDIT_COLUMNS`), read scoped to the workspace. Old rows written
  before the workspace column existed stay NULL — not backfilled.
- **Sync**: closed entity set (invoice, customer, product, transaction,
  time_entry, warehouse, branch, exchange_rate, product_stock); idempotent by
  `mutation_id` primary key; optimistic version check; per-row result; cursor.
  Financial columns are not client-writable (`WRITABLE` comment).
- **Conflict**: financial disagreement is never last-write-wins — both versions
  kept, reviewed, resolved by an authorized person, audited (`conflict.domain.ts`).
- **Books currency**: one per workspace, owner-only, changeable only while the
  books are empty (`BASE_CURRENCY_LOCKED`), read through `baseCurrencyOf`.
- **AI quota**: monthly allowance counted from the query log; plan value or an
  admin override; 0 means none (`ai-quota.service.ts`).
- **Backup**: download a full copy as Markdown or Excel, owner-only, Pro/
  Enterprise only, 402 otherwise (`backup-download-panel.tsx`). Export only —
  `restorable: false`, there is no import-back path (`snapshot.domain.ts:5-25`).
- **Bring-in-old-data**: inspect → map → dry run → commit → cancel → rollback
  plan → rollback, plus saved profiles and export (`migration.routes.ts`).
- **Bank**: statements, suggested matches, categories, reconcile, unmatch.
- **Assets**: register, schedule, run depreciation, dispose. **Budgets**:
  submit/approve/revise/archive/variance. **Dimensions** (cost centres).
- **POS**: open/close session, cash and bank movements, orders, void, opening
  capital, suspend/resume, labels, abandoned sessions.
- **Installments**: per-invoice schedule GET/PUT/DELETE.
- **Storefront**: public catalog, order by token, confirm/cancel/fulfill, turn an
  order into an invoice. **Customer portal**: token links, public read.
- **Tax**: config, components, rules, preview, drift per invoice, return.
- **Branch**: tree + assignments. **Currencies**: list + rates + revalue.

## Facts not proven

- Scheduled/automatic month-end: `POST /api/automations/month-end` exists, but no
  run log or scheduler test read → do not claim it runs by itself.
- Snapshot / point-in-time compare has no client hook (`/snapshots` absent from
  `packages/api/src`) → no screen; not sellable.
- Any restore from a backup: no route, explicitly refused.
- Marketplace = app/plugin directory with publisher review; whether any third
  party is published is unknown → do not claim an ecosystem.

## Deliberately skipped

- Body of `invoice.service.ts` beyond create/reverse sections; `payments/*` read
  in earlier pass; `admin-*.routes.ts` (Pass 8); `debug`, `sandbox`, `mcp`,
  `cms`, `blog`, `oauth` (not owner-facing sales claims).
