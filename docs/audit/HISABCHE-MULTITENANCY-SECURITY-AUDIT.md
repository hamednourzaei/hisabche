# Hisabche — Multi-Tenancy and Security Audit

Audit date 2026-11-08, commit `b546d5df`. Read-only. `.env` and secrets were not read. No penetration test or live request was made; every finding below is from source.

## 1. Isolation model (FACT)

- Backend uses the **service-role** key (`backend/src/db.ts:92`; self-check `:37-40`) → Postgres RLS does not apply to backend queries. Isolation = application filters on `workspace_id`.
- RLS still matters for any direct client/anon access: `docs/*.sql` contains 521 `ENABLE ROW LEVEL SECURITY` statements and 266 `CREATE POLICY` statements (grep counts, includes repeats across files).
- Global authentication: every path except an allow-list is authenticated (`backend/src/index.ts:353-410`; prefix list incl. `/api/public/`, `/api/auth/login|signup|refresh|forgot-password|reset-password|verify-email`; exact list `/api/billing/plans`, `/api/oauth/token`, `/api/oauth/revoke`, `/mcp`).
- Workspace context: `requireWorkspaceContext` (`backend/src/middleware/workspace.middleware.ts:67`) builds `request.tenancy`, chooses the workspace from `x-workspace-id` (client sends it, `packages/api/src/lib/client.ts:232,464`) and applies the expired-subscription lock (`:117`).
- Capabilities: `requireCapability` (`backend/src/middleware/authorize.middleware.ts:26`); in-handler `requireRole(tenancy, 'manager')` (`services/tenancy.service.ts`) and `holds()` (`services/authorization/authorization.domain.ts:263`).

## 2. Route guard census (FACT, extractor run this session)

853 endpoints; guards resolved through per-file guard arrays:

| Metric                                                       |                                                                                      Count |
| ------------------------------------------------------------ | -----------------------------------------------------------------------------------------: |
| Endpoints with `requireWorkspaceContext`                     |                                                                                        618 |
| Endpoints with a capability/role/admin guard in `preHandler` |                                                                                        607 |
| Platform-admin endpoints (`platformAdminGuard`)              |                                                                                        156 |
| Endpoints with a route-level `rateLimit` config              |                                                                                         24 |
| Tenant/user **writes** (non-admin, non-public)               |                                                                                        324 |
| … without `requireWorkspaceContext`                          | 21 (billing, email-OTP, guide-progress, notifications, `/mcp`, 10 `/api/workspaces/:id/*`) |
| … with workspace context but no `preHandler` capability      |                                                                                         58 |

The 10 `/api/workspaces/:id/*` writes authorise inside the service (`services/workspace.service.ts:285,407,424,500,579,674,698,739` → `requireRole(userId, workspaceId, 'admin'|'owner')`) — verified by reading. Of the 58 "no preHandler capability" writes, most call `requireRole(tenancy,'manager')` or `holds()` in the handler (sampled: attendance `routes/attendance.routes.ts:84`, projects `routes/project.routes.ts:80`, campaigns `routes/campaigns.routes.ts:85`, custom-fields `:80,115,151`, ai-pipeline `:123`, snapshots `:53`); `/api/sync/push` checks per mutation (`services/sync.service.ts:673`).

CLAUDE.md states "`POST /api/invoices` and `POST|PATCH|DELETE /api/customers` have no `requireCapability`". **FACT: that is no longer true** — `routes/invoice.routes.ts:154-160` and `routes/customer.routes.ts:110` now carry it. Doc drift.

## 3. Findings

| ID   | Severity                                                         | file:line                                                                                                                                                                                         | Observed behaviour                                                                                                                                                | Why it matters                                                                                                                                                                           | Cores / platforms                                                |
| ---- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| F-01 | High                                                             | `packages/app-shell/src/features/auth/offline-license.ts:102-109`; `packages/app-shell/src/shared/lib/api.ts:23-24`                                                                               | Without a build-time public key the device trusts a key kept in its own storage or fetched on first use                                                           | Offline licence can be forged by anyone who controls device storage/network on first fetch                                                                                               | Offline licence; Windows, Android                                |
| F-02 | High — **ACCEPTED RISK** (owner, 9 Nov 2026: «در دیتابیس بماند») | `backend/src/services/offline-license.service.ts:250-256`                                                                                                                                         | Ed25519 **private** key generated at runtime and stored in a DB table column `private_key_hex`                                                                    | A DB read (backup, leaked service key, SQL editor) = ability to sign licences for every workspace                                                                                        | Offline licence; all                                             |
| F-03 | Medium                                                           | `backend/src/routes/product-images.routes.ts:27` (guard `[authenticate, requireWorkspaceContext]`), handlers `:49,62,74,90`; no role check in `services/product-images/product-images.service.ts` | Any workspace member can add, reorder, re-caption or delete product images                                                                                        | Custom roles that hide products do not protect them; violates "permission > personal view"                                                                                               | Products; all                                                    |
| F-04 | Medium                                                           | `backend/src/services/notification.service.ts:69-78,99-131`                                                                                                                                       | Notifications are listed and modified by `user_id` only, across all workspaces                                                                                    | A suspended/removed member keeps reading that workspace's notifications (titles, bodies, amounts); breaks rule "workspace_id is the only boundary"                                       | Notifications; all                                               |
| F-05 | Medium                                                           | `backend/src/services/subscription-order.service.ts:246`                                                                                                                                          | Ownership check skipped when `created_by_user_id` is null                                                                                                         | Paid unowned order can be provisioned by any signed-in user with the order id, without claim token                                                                                       | Billing; web                                                     |
| F-06 | Medium                                                           | `backend/src/services/permission.service.ts:215-226`                                                                                                                                              | `updateRole` ignores the update error, then DELETE all `role_permissions` and re-INSERT, three separate calls, no error check                                     | A failure between delete and insert leaves a role with **no** permissions silently (rule 4: multi-table writes must be one RPC). Platform-admin only (`routes/permission.routes.ts:187`) | Roles; admin                                                     |
| F-07 | Medium (INFERENCE, verify)                                       | e.g. `routes/project.routes.ts:80`, `routes/campaigns.routes.ts:85`, `routes/attendance.routes.ts:84`                                                                                             | ~50 writes are gated by base role `requireRole(...,'manager')`, not by a capability                                                                               | A workspace custom role (which replaces capability sets, CLAUDE.md) may not restrict these routes as the owner expects                                                                   | Projects, campaigns, attendance, AI pipeline, custom fields; all |
| F-08 | Low                                                              | `backend/src/services/inventory/cycle-count.service.ts:122`                                                                                                                                       | Compensating `DELETE` of the count header after a line-insert failure                                                                                             | Forbidden pattern (rule 4); a failed delete leaves an empty count                                                                                                                        | Stock count                                                      |
| F-09 | Low                                                              | `backend/src/index.ts:380`                                                                                                                                                                        | `/api/auth/verify-email` public prefix with no route                                                                                                              | Dead allow-list entry; any future route under that prefix is public by accident                                                                                                          | Auth                                                             |
| F-10 | Low                                                              | `backend/src/routes/billing.routes.ts:938-942`                                                                                                                                                    | 500 responses echo `err.message`                                                                                                                                  | Leaks internal DB/RPC messages                                                                                                                                                           | Billing                                                          |
| F-11 | Low                                                              | `backend/src/workers/trial-expiration.worker.ts:133`                                                                                                                                              | Logs user e-mail addresses                                                                                                                                        | PII in logs                                                                                                                                                                              | Billing                                                          |
| F-12 | Info                                                             | `backend/src/index.ts:679-695`                                                                                                                                                                    | Global limiter 100 req/min per user or IP; login/signup have no stricter per-account limiter in app code (only `refresh` has a route limit, `auth.routes.ts:468`) | Brute force relies on Supabase Auth's own limits                                                                                                                                         | Auth                                                             |

## 4. Controls that look correct (FACT)

- Webhook SSRF guard: `backend/src/services/developer/developer.domain.ts:225-281` (`isPrivateAddress`), applied after DNS resolution `developer.service.ts:124`; payload signature `developer.service.ts:221-225`.
- CORS: browser origin allow-list `backend/src/index.ts:584`; storefront publishable-key CORS without credentials `:614-622`.
- Sync push: column allow-list excludes `workspace_id`, `user_id`, `version` (`services/sync.service.ts:122-160`); money entities refused (`:462`); version-guarded update includes `workspace_id` (`:118-119`).
- Workspace invites: email match + expiry (`services/workspace.service.ts:605-623`).
- Admin routes: all 62 endpoints in `routes/admin*.ts` carry `authenticate, platformAdminGuard` (+ `requireAdminPermission`), e.g. `admin-billing.routes.ts:70`.
- Heuristic IDOR scan (update/delete by `id` without `workspace_id` in the same chain): 40 hits; reviewed tenant ones (`project.service.ts:395` — protected by `assertProjectOwned`; `workspace.service.ts:623` — invite id from token lookup; `developer.repository.ts:180` — key id from authenticated key). No confirmed cross-workspace IDOR found. The other hits are global tables (blog, CMS, oauth apps, profiles) behind admin or own-user guards — not individually re-read; status IMPLEMENTED_NOT_LIVE_VERIFIED.

## 5. Not covered

Live RLS state, Supabase grants, rate-limit behaviour under load, dependency CVEs (`pnpm audit` not run — network), secret scanning of git history.

---

## 6. WP-13 — advance, deposit and reservation functions (measured 23 Nov 2026)

Method: `.pgtest/audit-rpc-security.mjs` reads the effective definition of each function across the
applied migration chain. Grants are looked for in **every** file, not only the defining one:
`CREATE OR REPLACE FUNCTION` never changes an ACL, so a repair migration can grant what the original
forgot — searching one file is what hid F-13. Live behaviour was proven on PostgreSQL 18.4 with
`.pgtest/run-advances-05-manual.mjs` (11 assertions passed) and `.pgtest/run-stock-02-manual.mjs`
(17 assertions passed).

### Callable functions

| Function                    | Defined in                                             | Rights  | search_path `public, pg_temp` | anon/auth revoked in                                 | service_role granted in                              | Body names workspace_id |
| --------------------------- | ------------------------------------------------------ | ------- | ----------------------------- | ---------------------------------------------------- | ---------------------------------------------------- | ----------------------- |
| `order_deposit_apply`       | `order-deposit-apply-refund-01-migration.sql`          | DEFINER | yes                           | order-deposit-apply-refund-01-migration.sql          | order-deposit-apply-refund-01-migration.sql          | yes                     |
| `order_deposit_balance`     | `order-deposit-apply-refund-01-migration.sql`          | DEFINER | yes                           | order-deposit-apply-refund-01-migration.sql          | order-deposit-apply-refund-01-migration.sql          | yes                     |
| `order_deposit_balances`    | `order-deposit-balances-01-migration.sql`              | DEFINER | yes                           | order-deposit-balances-01-migration.sql              | order-deposit-balances-01-migration.sql              | yes                     |
| `order_deposit_refund`      | `order-deposit-apply-refund-01-migration.sql`          | DEFINER | yes                           | order-deposit-apply-refund-01-migration.sql          | order-deposit-apply-refund-01-migration.sql          | yes                     |
| `stock_available`           | `stock-reservations-02-grants-and-scope-migration.sql` | invoker | yes                           | stock-reservations-02-grants-and-scope-migration.sql | stock-reservations-02-grants-and-scope-migration.sql | yes                     |
| `stock_release_reservation` | `stock-reservations-01-migration.sql`                  | invoker | yes                           | stock-reservations-02-grants-and-scope-migration.sql | stock-reservations-02-grants-and-scope-migration.sql | yes                     |
| `stock_reserve`             | `stock-reservations-01-migration.sql`                  | invoker | yes                           | stock-reservations-02-grants-and-scope-migration.sql | stock-reservations-02-grants-and-scope-migration.sql | yes                     |
| `stock_settle_reservation`  | `stock-reservations-01-migration.sql`                  | invoker | yes                           | stock-reservations-02-grants-and-scope-migration.sql | stock-reservations-02-grants-and-scope-migration.sql | yes                     |
| `supplier_advance_apply`    | `advances-05-supplier-advance-party-migration.sql`     | DEFINER | yes                           | advances-05-supplier-advance-party-migration.sql     | advances-05-supplier-advance-party-migration.sql     | yes                     |
| `supplier_advance_refund`   | `advances-05-supplier-advance-party-migration.sql`     | DEFINER | yes                           | advances-05-supplier-advance-party-migration.sql     | advances-05-supplier-advance-party-migration.sql     | yes                     |

Result: **10 callable functions, 2 trigger functions, 0 failing at least one control.**

### F-13 — the server could not execute the stock reservation functions (P0, FIXED)

`docs/stock-reservations-01-migration.sql` revoked EXECUTE from `PUBLIC, anon, authenticated` and
never granted it to `service_role`. PostgreSQL grants EXECUTE to PUBLIC when a function is created, so
the REVOKE removed the only grant that existed: every backend call failed with
`42501 permission denied for function stock_available`. `transition_sales_order` and
`deliver_sales_order_partial` (`docs/sales-orders-02-migration.sql`) call these functions, so
confirming a sales order was the first thing to break.

Measured on PostgreSQL 18.4: `service_role` is refused with 42501 before
`docs/stock-reservations-02-grants-and-scope-migration.sql` and answers after it; `anon` and
`authenticated` are refused on all four functions before and after.

### F-14 — available-to-promise ignored the tenant (High, FIXED)

`stock_available` read `warehouse_stock` with `warehouse_id` and `product_id` only. A caller who knew
another workspace's warehouse id read that workspace's on-hand quantity. Measured: workspace A asking
workspace B's warehouse answered **20** before and **0** after; a stock row whose `workspace_id` is
NULL is not counted for any workspace (it is listed by `docs/FINDING-db-integrity.sql`).

Fix: `docs/stock-reservations-02-grants-and-scope-migration.sql` +
`docs/VERIFY-stock-reservations-02-grants-and-scope.sql` +
`backend/src/__tests__/stock-reservations-02-grants-and-scope.pg.test.ts`.
Status: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.

### Accepted, not a defect

`order_deposits_document_frozen` (`advances-03`) pins `SET search_path = public` without `pg_temp`.
Its body reads no relation — it compares `NEW.document` with `OLD.document` and raises — so there is
nothing for a caller to shadow. No change made.

### Cross-workspace refusals proven on real PostgreSQL

- `advances-05`: an unresolved party is refused on apply and on refund; another workspace's advance is
  unreachable; the historical row whose supplier sits in `customer_id` still applies.
- `stock-reservations-02`: another workspace's warehouse answers 0; reserving against it is refused
  with `STOCK_RESERVATION_NO_STOCK`.
