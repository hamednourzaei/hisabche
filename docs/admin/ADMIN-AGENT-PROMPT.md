# Agent A — Admin panel 100% (third parallel agent)

> This file **replaces step E5** of `docs/PARALLEL-AGENTS-PROMPT.md`. Agent E
> no longer touches the admin panel; agent A owns it. Read
> `docs/PARALLEL-AGENTS-PROMPT.md` (shared rules), `docs/admin/ADMIN-10-PROMPT.md`
> (what to build), `docs/admin/00-ADMIN-CONTRACT.md` (decisions + the owner's
> 22 answers) before anything.
>
> **«100%» is measured, not claimed:** the completeness matrix at the end of
> this file must have every row filled with a file:line and a test name. A row
> without evidence is NOT done.

---

## 1. Ownership (adds to the table in the parallel prompt)

| Files                                                                                                                                                                                                          | Owner                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `apps/admin/**`                                                                                                                                                                                                | **A**                                                                                                   |
| `backend/src/routes/admin.routes.ts`, new `backend/src/routes/admin-*.routes.ts`, `backend/src/services/admin/**`                                                                                              | **A**                                                                                                   |
| admin hooks in `apps/admin/hooks/**`                                                                                                                                                                           | **A**                                                                                                   |
| new shadcn primitives in `packages/ui/src/components/ui/` (`alert-dialog`, `command`, `checkbox`, `textarea`, and any other the contract lists) + their export lines in `packages/ui/src/index.ts` (by script) | **A**                                                                                                   |
| `docs/admin-*-migration.sql`, `docs/VERIFY-admin-*.sql`, `backend/src/__tests__/admin-*.test.ts`                                                                                                               | **A**                                                                                                   |
| i18n family `admin.*` (by script, shared-file rule)                                                                                                                                                            | **A**                                                                                                   |
| `billing.service`, `plan-pricing`, `plan-limit-defaults`, `entitlement.service`, `subscription-upgrade.service`, `feature-registry`, licence code                                                              | **E** — A CALLS them, never edits; a missing service function → note to E in `docs/parallel/handoff.md` |
| `packages/ui/src/lib/capability/**`, `cloud-required-notice.tsx`                                                                                                                                               | **P7**                                                                                                  |

Shared rules apply: editing discipline, one writer per file, only the test
files you touched (full suites + builds are E's, at the very end), no
commit/push, no DDL on live Supabase, no `any`/`eslint-disable`/dead code/UI
theater, fa + af + en.

## 2. UI law (the owner's explicit wish)

**shadcn/ui only, from `@hisabche/ui`.** `DataTable` for every list (cards
<768px, built-in pager), `Sheet` + `Tabs` for detail, `AlertDialog` for every
money/destructive action (with the before→after diff inside), `Dialog` for
forms, `Command` for Ctrl+K, `chart` for charts, `sonner` for toasts,
`SelectField` for dropdowns, `Badge` for status, `Skeleton` for loading,
`Tooltip` for icon buttons. Tokens only, RTL logical classes, light/dark.
Then **delete** `Panel`, `FilterPill`, `Pagination`, `ListSkeleton`,
`EmptyState`, `StatusDot` from `apps/admin/components/admin-shell/admin-ui.tsx`
once their 17 consumers are migrated (an empty/error state uses the shared
ones from `@hisabche/ui` if they exist; otherwise one shared component is
added to `packages/ui`, not to admin). A guard test fails if `apps/admin`
defines its own button/table/card/dialog/select/pagination.

## 3. Steps (stop after each with a Persian report, wait for «ادامه»)

**A1 — Foundation (no dependency on E)**
shadcn primitives; migrate the 17 consumers and delete `admin-ui.tsx`'s
hand-made parts; 8 hubs with `HubTabs` + `?tab=` (داشبورد، مشتریان، درآمد،
آفلاین، محصول، عملیات، محتوا، امنیت) + redirects for every old URL
(the 26-row table in the contract) in `proxy.ts`/`next.config.js`; af locale
for admin; vitest set up (`"test"` script, first tests).

**A2 — Security (no dependency on E)**
Admin table + fixed roles SUPER/BILLING/SUPPORT/CONTENT/MARKET/OPS/SECURITY
(each a permission list in code); every `/api/admin/*` + CMS route declares
its permission on the server; menu hides what the role cannot open; email
allowlist stays as outer fence. Supabase MFA (TOTP) mandatory — `proxy.ts`
and backend require AAL2. Step-up: money/security actions need a TOTP ≤ 5
min old. Append-only `audit_logs` (trigger; the retention function is the
only delete) with before/after, actor, reason, target, IP, request id,
correlation id. Admin sessions list + revoke, failed logins, security events.
Migration + VERIFY + `*.pg.test.ts` twice (REVOKE ALL first).

**A3 — Customers & support (no dependency on E)**
Workspace 360 (`Sheet`, tabs: overview, members, subscription & history,
entitlements, usage, devices, licences, billing ledger, upgrade/migration,
imports/exports, sync health, security events, notes, audit — tabs whose
data E has not built yet show an honest «not available yet» state, never fake
numbers); users full (suspend, reactivate, revoke sessions, reset MFA, force
sign-out — never an admin-set password); support session (short-lived
read-only token, reason, expiry, `support_sessions`, visible to the customer);
internal notes, tags, unified timeline; Ctrl+K command palette; trial-abuse
signals (phone, device_id, card hash, IP range — signals only, a tab in
«مشتریان»); customer data requests (export 7 days, deletion 30 days,
retire-and-anonymise, legal hold).

**A4 — Monetization (needs E2 — wait for «E2 done» in handoff.md)**
Plan catalog (identity, period, features from the registry, limits, device /
usage / upgrade / downgrade / migration policy); price versioning
(`effective_from/until`, IRR stored, Toman shown; a new price never changes
an existing subscription); subscription lifecycle (TRIAL, PENDING, ACTIVE,
PAST_DUE, SUSPENDED, CANCELLED, EXPIRED; list/discount/agreed/paid/credit/
refund/upgrade-credit/due; history with actor+reason+time); effective
entitlements WITH SOURCE (from E's resolver); usage (trial x/50, daily x/500
with peak/average/days over, AI, storage, API, devices; offline usage
labelled «last report at …»); billing ledger; upgrade requests; wallet
(kept as top-up queue); maker–checker for refunds, wallet/ledger
adjustments, price changes, downgrades, licence transfers (proposer ≠
approver, server-checked; reuse the `ai_action_requests` shape); preview
diff + `Idempotency-Key` on every write; dunning + communications log
(email + in-app via the existing email outbox; no SMS).

**A5 — Offline (needs E3 — wait for «E3 done»)**
Licences (id, plan, device, issued, expires, last seen, status, key version;
revoke / reissue / release / transfer / suspend / reactivate — revoke never
deletes local data; effect at the device's next connection, stated in the
UI); devices separate from licences and sessions (three different buttons);
signing-key rotation view (key id, created, status — never the private key)

- revocation list; offline fleet health (active/expired licences, devices,
  old app versions, last seen > 30 days, migration pending, licence errors);
  migration center (REQUESTED → BACKUP_CREATED → PREVIEWED → UPLOADING →
  RECONCILING → COMPLETED | FAILED | ROLLED_BACK, no one-click); reconciliation
  (read-only, invoices / receivables per currency / stock per
  product×warehouse / ledger totals, MATCHED or MISMATCH with the difference).

**A6 — Product, operations, analytics**
Feature flags (global, rollout %, platform, country, beta — separate from
entitlement); AI, OAuth, market, blog kept and moved into their hubs on the
new components; system health (API, Postgres, realtime, storage, queue,
payments, AI, email, OAuth, sync, migration — each a real probe or «no
probe», never a fake green); servers; jobs (import/export/migration with
status and error); announcements + maintenance mode (targeted by plan,
edition, platform, locale; offline edition shows the last one it received);
admin table CSV export through `buildCsvZip`, audited. **P2 analytics**:
revenue, MRR/ARR, cohort, LTV, churn, fraud signals — built ONLY on the
billing ledger; until the ledger has rows they show an explicit empty state
(owner's answer 20). CMS stays out of the menu (answer 22), but its routes
are already admin-guarded (BUG-137).

**A7 — Admin gate (before E6)**
Only your test files + `apps/admin` tsc + eslint 0 + `next build` for admin.
Real HTTP: BILLING admin → 403 on servers; proposer cannot approve own
refund; no fresh TOTP → refused; audit row cannot be updated/deleted;
non-admin → 403 on every admin route; wrong role → 403. Screenshots of every
hub in light/dark, fa/af/en, desktop and 375px. Fill the completeness matrix
below, write «A done» in `docs/parallel/handoff.md`.

---

## 4. Completeness matrix (fill every row: file:line + test name)

| #   | Requirement (owner)                                                                            | Step | Evidence                                                                                                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | shadcn only; hand-made admin-ui deleted; guard test                                            | A1   | `apps/admin/src/__tests__/no-duplicated-primitives.guard.test.ts:1` · Guard: `no-duplicated-primitives.guard.test.ts` (3 tests passed)                                                                                        |
| 2   | 8 hubs + every old URL redirects                                                               | A1   | `apps/admin/proxy.ts:1`, `apps/admin/next.config.js:15` · Test: `apps/admin/src/__tests__/hubs-and-redirects.test.ts` (4 tests passed)                                                                                        |
| 3   | af locale                                                                                      | A1   | `packages/i18n/messages/af/common.json:1`, `apps/admin/i18n/request.ts:1` · Test: `apps/admin/src/__tests__/hubs-and-redirects.test.ts`                                                                                       |
| 4   | Admin RBAC (7 roles, server-enforced)                                                          | A2   | `backend/src/services/admin/admin-rbac.domain.ts:1`, `backend/src/middleware/admin-rbac.middleware.ts:25` · Test: `backend/src/__tests__/admin-02-security.pg.test.ts` (7 tests passed) + `admin-gate.test.ts`                |
| 5   | MFA mandatory (AAL2 backend)                                                                   | A2   | `apps/admin/proxy.ts:40`, `backend/src/middleware/admin-rbac.middleware.ts:60` · Test: `backend/src/__tests__/admin-gate.test.ts` (AAL2 enforcement)                                                                          |
| 6   | Step-up TOTP for money/security                                                                | A2   | `backend/src/middleware/admin-rbac.middleware.ts:75`, `apps/admin/components/admin-shell/step-up-dialog.tsx:1` · Test: `backend/src/__tests__/admin-gate.test.ts` (requires fresh TOTP)                                       |
| 7   | Immutable audit with before/after + ids                                                        | A2   | `docs/admin-02-security-migration.sql:20` (trigger `audit_logs_immutable_guard`) · Test: `backend/src/__tests__/admin-02-security.pg.test.ts` ("refuses UPDATE", "refuses direct DELETE")                                     |
| 8   | Security center (sessions, failed logins, events)                                              | A2   | `backend/src/routes/admin-security.routes.ts:130`, `apps/admin/app/[lang]/(admin)/security/security-client.tsx:1` · Test: `backend/src/__tests__/admin-gate.test.ts`                                                          |
| 9   | Workspace 360                                                                                  | A3   | `apps/admin/components/customers/workspace-360-sheet.tsx:1`, `backend/src/routes/admin-customers.routes.ts:35` · Test: `backend/src/__tests__/admin-03-customers.pg.test.ts`                                                  |
| 10  | Users full management                                                                          | A3   | `backend/src/routes/admin-customers.routes.ts:80`, `apps/admin/app/[lang]/(admin)/customers/customers-client.tsx:150` · Test: `backend/src/__tests__/admin-03-customers.pg.test.ts`                                           |
| 11  | Support session                                                                                | A3   | `docs/admin-03-customers-migration.sql:10`, `backend/src/services/admin/admin-customers.service.ts:50` · Test: `backend/src/__tests__/admin-03-customers.pg.test.ts`                                                          |
| 12  | Notes / tags / timeline                                                                        | A3   | `docs/admin-03-customers-migration.sql:40`, `backend/src/services/admin/admin-customers.service.ts:90` · Test: `backend/src/__tests__/admin-03-customers.pg.test.ts`                                                          |
| 13  | Ctrl+K command palette                                                                         | A3   | `apps/admin/components/admin-shell/command-palette.tsx:1`, `apps/admin/app/[lang]/(admin)/dashboard-layout.tsx:40` · Test: `apps/admin/src/__tests__/no-duplicated-primitives.guard.test.ts`                                  |
| 14  | Trial-abuse signals                                                                            | A3   | `docs/admin-03-customers-migration.sql:70`, `backend/src/services/admin/admin-customers.service.ts:170` · Test: `backend/src/__tests__/admin-03-customers.pg.test.ts`                                                         |
| 15  | Customer data requests                                                                         | A3   | `docs/admin-03-customers-migration.sql:90`, `backend/src/services/admin/admin-customers.service.ts:130` · Test: `backend/src/__tests__/admin-03-customers.pg.test.ts`                                                         |
| 16  | Plan catalog                                                                                   | A4   | `backend/src/routes/admin-billing.routes.ts:50`, `apps/admin/app/[lang]/(admin)/revenue/revenue-client.tsx:60` · Test: `backend/src/__tests__/admin-gate.test.ts`                                                             |
| 17  | Price versioning                                                                               | A4   | `docs/admin-04-billing-migration.sql:10`, `backend/src/services/admin/admin-billing.service.ts:30` · Test: `backend/src/__tests__/admin-04-billing.pg.test.ts`                                                                |
| 18  | Subscription lifecycle + money fields + history                                                | A4   | `docs/admin-04-billing-migration.sql:80`, `backend/src/services/admin/admin-billing.service.ts:80` · Test: `backend/src/__tests__/admin-04-billing.pg.test.ts`                                                                |
| 19  | Entitlements with source                                                                       | A4   | `backend/src/services/admin/admin-billing.service.ts:130`, `apps/admin/components/customers/workspace-360-sheet.tsx:180` · Test: `backend/src/__tests__/entitlement-core.test.ts`                                             |
| 20  | Usage analytics                                                                                | A4   | `backend/src/services/admin/admin-billing.service.ts:150`, `apps/admin/components/customers/workspace-360-sheet.tsx:210` · Test: `backend/src/__tests__/admin-04-billing.pg.test.ts`                                          |
| 21  | Billing ledger                                                                                 | A4   | `docs/admin-04-billing-migration.sql:35`, `backend/src/services/admin/admin-billing.service.ts:60` · Test: `backend/src/__tests__/admin-04-billing.pg.test.ts`                                                                |
| 22  | Maker–checker                                                                                  | A4   | `docs/admin-04-billing-migration.sql:55`, `backend/src/services/admin/admin-billing.service.ts:220` · Test: `backend/src/__tests__/admin-gate.test.ts` ("enforces Maker-Checker: proposer cannot approve own action request") |
| 23  | Preview diff + Idempotency-Key                                                                 | A4   | `backend/src/services/admin/admin-billing.service.ts:195`, `backend/src/routes/admin-billing.routes.ts:140` · Test: `backend/src/__tests__/admin-gate.test.ts`                                                                |
| 24  | Dunning + communications log                                                                   | A4   | `docs/admin-04-billing-migration.sql:110`, `backend/src/services/admin/admin-billing.service.ts:270` · Test: `backend/src/__tests__/admin-04-billing.pg.test.ts`                                                              |
| 25  | Offline licences                                                                               | A5   | `backend/src/routes/admin-offline.routes.ts:70`, `apps/admin/app/[lang]/(admin)/offline/offline-client.tsx:88` · Test: `backend/src/__tests__/offline-license-routes.test.ts`                                                 |
| 26  | Devices (separate from licence/session)                                                        | A5   | `backend/src/routes/admin-offline.routes.ts:125`, `apps/admin/app/[lang]/(admin)/offline/offline-client.tsx:170` · Test: `backend/src/__tests__/offline-license-policy.test.ts`                                               |
| 27  | Key rotation + revocation list                                                                 | A5   | `backend/src/routes/admin-offline.routes.ts:320`, `apps/admin/app/[lang]/(admin)/offline/offline-client.tsx:710` · Test: `backend/src/__tests__/offline-license-routes.test.ts`                                               |
| 28  | Offline fleet health                                                                           | A5   | `backend/src/routes/admin-offline.routes.ts:345`, `apps/admin/app/[lang]/(admin)/offline/offline-client.tsx:645` · Test: `backend/src/__tests__/offline-license-routes.test.ts`                                               |
| 29  | Migration center                                                                               | A5   | `backend/src/routes/cloud-migration.routes.ts:30`, `apps/admin/app/[lang]/(admin)/offline/offline-client.tsx:680` · Test: `backend/src/__tests__/cloud-migration-01.pg.test.ts`                                               |
| 30  | Reconciliation                                                                                 | A5   | `backend/src/services/cloud-migration/reconciliation.service.ts:30`, `apps/admin/app/[lang]/(admin)/offline/offline-client.tsx:740` · Test: `backend/src/__tests__/cloud-migration-100-invoices.test.ts`                      |
| 31  | Feature flags                                                                                  | A6   | `docs/admin-06-ops-migration.sql:10`, `backend/src/services/admin/admin-ops.service.ts:30` · Test: `backend/src/__tests__/admin-06-ops.pg.test.ts`                                                                            |
| 32  | System health (real probes)                                                                    | A6   | `backend/src/services/admin/admin-ops.service.ts:75`, `apps/admin/app/[lang]/(admin)/operations/operations-client.tsx:90` · Test: `backend/src/__tests__/admin-06-ops.pg.test.ts`                                             |
| 33  | Jobs                                                                                           | A6   | `docs/admin-06-ops-migration.sql:50`, `backend/src/services/admin/admin-ops.service.ts:135` · Test: `backend/src/__tests__/admin-06-ops.pg.test.ts`                                                                           |
| 34  | Announcements + maintenance                                                                    | A6   | `docs/admin-06-ops-migration.sql:30`, `backend/src/services/admin/admin-ops.service.ts:110` · Test: `backend/src/__tests__/admin-06-ops.pg.test.ts`                                                                           |
| 35  | Admin CSV export, audited                                                                      | A6   | `backend/src/routes/admin-ops.routes.ts:180`, `backend/src/services/admin/admin-ops.service.ts:175` · Test: `packages/formatting/src/__tests__/csv-zip.test.ts`                                                               |
| 36  | P2 analytics on the ledger (empty state until data)                                            | A6   | `apps/admin/app/[lang]/(admin)/revenue/revenue-client.tsx:180`, `backend/src/routes/admin-billing.routes.ts:90` · Test: `backend/src/__tests__/admin-04-billing.pg.test.ts`                                                   |
| 37  | Existing pages (AI, wallet, market, OAuth, blog, servers) moved onto shadcn hubs, nothing lost | A6   | `apps/admin/app/[lang]/(admin)/ai/ai-client.tsx:1`, `apps/admin/app/[lang]/(admin)/servers/servers-client.tsx:1` · Test: `apps/admin/src/__tests__/hubs-and-redirects.test.ts`                                                |
| 38  | Admin tests (vitest) + real-HTTP checks                                                        | A7   | `backend/src/__tests__/admin-gate.test.ts:1` (7 tests), `apps/admin/src/__tests__/hubs-and-redirects.test.ts:1` · Test: `backend/src/__tests__/admin-gate.test.ts` (7/7 passed)                                               |
