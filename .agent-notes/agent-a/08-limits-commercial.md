# Pass 8 — limits, admin, and the commercial shape

## Files read

- `apps/admin/app/[lang]/(admin)/**/page.tsx` — 25 pages listed (dashboard, users,
  workspaces, subscriptions, revenue, wallet, offline, security, servers,
  operations, ai, market, oauth-apps, content, cms/_, blog/_, customers, product,
  audit-logs).
- `apps/admin/.../subscriptions/plan-limits-panel.tsx` (grep, lines 1-176)
- `backend/src/services/plan-limits.service.ts` (full, 309)
- `backend/src/services/plan-limit-defaults.ts` (full)
- `backend/src/services/admin/admin-billing.service.ts` (1-50)
- `packages/app-shell/src/features/auth/offline-licence-screen.tsx` (1-80)
- `packages/app-shell/src/features/billing/billing-page.tsx` (1 line: re-export)

## Facts proven

- **Limits are three layers**: built-in default → platform admin's per-plan
  setting → admin's per-workspace override; `null` = unlimited, absent =
  inherit (`plan-limits.service.ts:6-11,43-49`).
- **Four limit keys only**: invoices (lifetime), invoicesDaily, users,
  aiMonthly. Nothing else is metered (`LIMIT_KEYS`).
- Enforcement is server-side and answers **402 with the numbers**, not a 500;
  drafts are not counted; a resent offline sale is never refused; a paid trial
  is never limited; a free trial is still capped (`assertWithinLimit`).
- Daily ceilings count in the workspace's stored time zone, not the device's.
- **Admin can edit both layers on screen** (`plan-limits-panel.tsx`:
  GET/PUT `/admin/plan-limits/:plan`, `/admin/workspace-limits/:id`) → every
  number is a setting, so the sales file must not quote one.
- **Admin billing** has versioned plan prices, an immutable billing ledger
  (charge / payment / refund / adjustment / credit), and maker-checker: the
  proposer and approver must differ (`admin-billing.service.ts:4-9,38-49`).
- **Offline edition** opens only after a licence code verifies on the device;
  refusals are named (not a code / tampered / expired / wrong device / wrong
  workspace / revoked / banned / clock rolled back). The device shows its own
  licence ID so the admin can issue a code for that machine.
- Offline plan defaults: 1 user, no AI allowance — the local edition is a
  single-user book by design.

## Facts not proven

- No card/online payment processor: an upgrade is a **request** that an admin
  approves (`billing.request.errors.UPGRADE_REQUEST_PENDING`, maker-checker) —
  never claim instant card payment or a self-serve checkout.
- Whether the admin's plan-limit tables are migrated in production is unknown;
  the service falls back to built-in defaults when the tables are absent.

## Deliberately skipped

- Admin CMS/blog/oauth-apps/market pages — platform content, not a customer
  capability; `admin-security.service.ts` body (no customer claim).
- `billing.service.ts` internals beyond the limit path.
