# Customers / Revenue Unification — Audit

## Preflight

- HEAD: `13666cf2146adabba9ae98c12c91686e049d2cd6`
- Branch: `main`
- Working tree: 3 pre-existing modifications preserved (`apps/admin/app/[lang]/layout.tsx`, `apps/admin/proxy.ts`, `apps/admin/next-env.d.ts`).
- `pnpm code-intel status` unavailable in this environment (`code-intel` command not found) → fallback to scoped repository search. Limitation recorded, not treated as proof of absence.
- No live browser inspection was assumed; screenshots supplied by the owner were used as the visual requirement.

## Route inventory (all 19 directories under `apps/admin/app/[lang]/(admin)/`)

| Route                           | Renders            | Decision                                                    | Evidence                                               |
| ------------------------------- | ------------------ | ----------------------------------------------------------- | ------------------------------------------------------ |
| `/customers`                    | `CustomersClient`  | **canonical hub**                                           | `customers-client.tsx`                                 |
| `/revenue`                      | `RevenueClient`    | **canonical financial hub**                                 | `revenue-client.tsx`                                   |
| `/dashboard`                    | `DashboardClient`  | KEEP_SEPARATE                                               | cross-hub overview                                     |
| `/offline`                      | `OfflineClient`    | KEEP_SEPARATE                                               | licence fleet, not customer subscription               |
| `/product`                      | `ProductClient`    | KEEP_SEPARATE                                               | feature flags / AI / OAuth / market                    |
| `/operations`                   | `OperationsClient` | KEEP_SEPARATE                                               | system health / jobs                                   |
| `/content`                      | `ContentClient`    | KEEP_SEPARATE                                               | blog + CMS                                             |
| `/security`                     | `SecurityClient`   | KEEP_SEPARATE                                               | audit / RBAC / sessions                                |
| `/workspaces`                   | `redirect()`       | REDIRECT → `/customers?tab=workspaces`                      | `workspaces/page.tsx`                                  |
| `/users`                        | `redirect()`       | REDIRECT → `/customers?tab=users`                           | `users/page.tsx`                                       |
| `/subscriptions`                | `redirect()`       | REDIRECT → **`/customers?tab=workspaces`** (was `/revenue`) | `subscriptions/page.tsx`, `proxy.ts`, `next.config.js` |
| `/wallet`                       | `redirect()`       | REDIRECT → `/revenue?tab=wallet`                            | `wallet/page.tsx`                                      |
| `/servers`                      | `redirect()`       | REDIRECT → `/operations?tab=servers`                        | `servers/page.tsx`                                     |
| `/ai`, `/oauth-apps`, `/market` | `redirect()`       | REDIRECT → product                                          | respective `page.tsx`                                  |
| `/blog`                         | `redirect()`       | REDIRECT → `/content?tab=blog`                              | `blog/page.tsx`                                        |
| `/audit-logs`                   | `redirect()`       | REDIRECT → `/security?tab=audit`                            | `audit-logs/page.tsx`                                  |
| `/cms/*`                        | real pages         | KEEP_SEPARATE                                               | content hub deep links                                 |

All legacy shims are redirect-only — no duplicate UI was found in them. They are retained for deep-link compatibility.

## Feature matrix

| Feature                                 | Current route                 | Owner before         | Implementation                          | Decision                                                  | Final destination                   | Evidence                                          |
| --------------------------------------- | ----------------------------- | -------------------- | --------------------------------------- | --------------------------------------------------------- | ----------------------------------- | ------------------------------------------------- |
| Workspace list + 360                    | `/customers?tab=workspaces`   | Customers            | `WorkspacesClient`, `Workspace360Sheet` | KEEP                                                      | Customers / workspaces              | `customers-client.tsx`                            |
| User lifecycle                          | `/customers?tab=users`        | Customers            | `UsersClient`, `useManageUser`          | KEEP                                                      | Customers / users                   | `customers-client.tsx`                            |
| Subscription list + plan/status changes | `/revenue?tab=subscriptions`  | Revenue              | `SubscriptionsClient`                   | **MERGE**                                                 | **workspace card (workspaces tab)** | `workspace-row.tsx`, `use-admin-subscriptions.ts` |
| Upgrade requests                        | `/revenue?tab=subscriptions`  | Revenue (and nested) | `UpgradeRequestsPanel`                  | MERGE + DE-DUPLICATE                                      | Customers / upgrade_requests        | `customers-client.tsx`                            |
| Plan limits                             | `/revenue?tab=plans` + nested | Revenue              | `PlanLimitsPanel`                       | MERGE + DE-DUPLICATE                                      | Customers / plan_limits             | `customers-client.tsx`                            |
| Trial abuse                             | `/customers?tab=trial_abuse`  | Customers            | `useTrialAbuseSignals`                  | KEEP                                                      | Customers / trial_abuse             | `customers-client.tsx`                            |
| Devices                                 | `/customers?tab=devices`      | Customers            | empty state                             | INCOMPLETE (kept honest)                                  | Customers / devices                 | `customers-client.tsx`                            |
| Support                                 | `/customers?tab=support`      | Customers            | empty state + real sessions in 360      | PARTIAL                                                   | Customers / support                 | `workspace-360-sheet.tsx`                         |
| Plans & price history                   | `/revenue?tab=plans`          | Revenue              | `PlanPricesCatalog`                     | KEEP                                                      | Revenue / plans                     | `revenue-client.tsx`                              |
| Billing ledger                          | `/revenue?tab=ledger`         | Revenue              | `useAdminBillingLedger`                 | KEEP_SEPARATE (money)                                     | Revenue / ledger                    | `revenue-client.tsx`                              |
| Maker-checker                           | `/revenue?tab=maker_checker`  | Revenue              | `useAdminActionRequests`                | KEEP_SEPARATE (approval)                                  | Revenue / maker_checker             | `revenue-client.tsx`                              |
| Wallet                                  | `/revenue?tab=wallet`         | Revenue              | `WalletClient`                          | KEEP_SEPARATE                                             | Revenue / wallet                    | `wallet-client.tsx`                               |
| Gateways + analytics                    | `/revenue?tab=gateways`       | Revenue              | `GatewaysPanel`                         | KEEP_SEPARATE                                             | Revenue / gateways                  | `revenue-client.tsx`                              |
| Offline device fleet                    | `/offline`                    | Offline              | `OfflineClient`                         | KEEP_SEPARATE — licence domain, not customer subscription | Offline                             | `offline-client.tsx`                              |
| Audit log                               | `/security?tab=audit`         | Security             | `SecurityClient`                        | KEEP_SEPARATE                                             | Security                            | `security-client.tsx`                             |

## Defects found and fixed

1. **DUPLICATED** — `SubscriptionsClient` rendered `UpgradeRequestsPanel` and `PlanLimitsPanel`; `RevenueClient` rendered both again in different tabs. Each now has exactly one owner in Customers.
2. **STALE LINK** — header bell and dashboard alert pointed to `/revenue?tab=subscriptions&status=past_due`, a tab that no longer exists → changed to the unified `/customers?tab=workspaces`.
3. **STALE REDIRECT** — `/subscriptions/page.tsx` redirected to the removed Revenue tab → changed to Customers workspaces.
4. **MISLEADING FALLBACK** — Workspace 360 showed literal `'PLAN'` / `'active'` for missing values → replaced with `UNKNOWN_VALUE`.
5. **EXPIRED STATE** — status was stored server-side while expiry was derived from `period_end`; the card could look expired while the select showed `active`. The workspace card now derives an effective `expired` status, paints the border red, shows a destructive alert, and exposes reset + plan-change controls.
6. **TWO URLs** — workspaces and subscriptions had separate tabs. Collapsed into one: subscription identity, lifecycle, plan, trial, period end and controls are now on the workspace card. Obsolete `subscriptions-client.tsx` deleted after a repository-wide reference check.

## Remaining gaps (not hidden behind fake UI)

- Date-bucketed expiry filters ("expires in 3/7/30 days") remain absent: backend has no date-range filter. Documented, not faked.
- Customer **Devices** hub tab remains an explicit empty state — no device endpoint is wired. Marked `NOT_IMPLEMENTED`.
- Support sessions exist in Workspace 360 only; the hub-level Support tab is still an empty state. Marked `PARTIAL`.
- "Reset subscription" is implemented as the existing audited `PATCH /admin/subscriptions/:id/status` with status `active` and a reason — there is no dedicated reset endpoint, and none was invented.
- No live production verification: the owner runs the panel locally; automated checks are recorded in the coverage document.
