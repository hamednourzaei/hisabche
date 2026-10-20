# Admin Contract — the control plane

> Admin Panel programme, step 0 of 6. **Document only — no code in this step.**
> Programme: `docs/admin/ADMIN-10-PROMPT.md` (the owner's six-step prompt).
> Companion: `docs/offline/entitlement/00-CONTRACT.md` — the plans, the feature
> registry, the signed licence, the usage policy. This document is the admin
> half of that work: **who may do what in the panel, on which data, through
> which service, and where it lives on screen.**
>
> Every row below names the existing service or table it extends. Nothing here
> introduces a second plan table, a second billing path, a second permission
> system, or a second component library.

---

## 0. The three laws, as contracts

### 0.1 Admin is a control plane, not a second brain

`Admin UI → /api/admin/* → the SAME service the product uses → the database`.

No admin route writes a business table directly. No admin-only plan table.
No copy of a rule. The panel **calls** `billing.service`,
`subscription-upgrade.service`, `entitlement.service`, `plan-limits.service`,
`plan-pricing`, the wallet, the market, the OAuth and AI services — the same
functions the customer-facing routes call, so a change made by an admin is
the same change a payment would have made.

⚠️ **THE ADMIN'S ERROR ENVELOPE HAS NO `code` TODAY.** `admin.routes.ts`'s
`send()` answers `{ error }` only, while the panel reads errors with the
product's `apiErrorMessage`, which needs `{ error, code }`. Every admin route
added from now on answers **with a code**, or the panel cannot say _why_
something was refused.

⚠️ **Six concepts, six homes, never merged:**

| Concept          | What it is                                    | Its home                                     |
| ---------------- | --------------------------------------------- | -------------------------------------------- |
| **Subscription** | the money relationship (plan, period, status) | `subscriptions` + `billing.service`          |
| **Entitlement**  | what the workspace may _do_                   | `entitlement.service` + the feature registry |
| **Licence**      | the signed offline right to run               | the licence table + the licence service      |
| **Device**       | one installation of the app                   | the device table + the device service        |
| **Session**      | one signed-in browser/app                     | the session store + the auth core            |
| **Usage**        | what was consumed                             | the counts, derived from the rows            |

The panel shows all six; it never merges them into one row called «status».

### 0.2 shadcn/ui only, from one place

Every component comes from `@hisabche/ui` (re-exported by
`apps/admin/components/ui/index.ts`). A primitive that does not exist yet is
added **once** to `packages/ui` with the standard shadcn source, tokens only
(`hsl(var(--…))`), RTL logical classes — never inside `apps/admin`, never a
hand-drawn look-alike.

| Concern                       | The component                                    |
| ----------------------------- | ------------------------------------------------ |
| any list                      | `DataTable` (cards under 768 px, built-in pager) |
| any dropdown                  | `SelectField` (a raw `<select>` is banned)       |
| a destructive or money action | `AlertDialog` (with the before → after diff)     |
| a detail view                 | `Sheet` (side drawer) with `Tabs`                |
| a toast                       | `sonner`                                         |
| a chart                       | `chart` (the Recharts wrapper)                   |
| a menu                        | `command` (⌘K)                                   |

The hand-made `Panel` / `FilterPill` / `Pagination` in `admin-ui.tsx` are
migrated to these and then **deleted** — no two systems.

### 0.3 Few pages, deep drawers

The menu grows from 11 groups to at most **8**, and most new things are a tab
inside an existing page or a tab of the Workspace 360 drawer. No page that
only links elsewhere.

---

## 1. Navigation (target) and the redirects

| Group       | One route     | Tabs (`?tab=`)                                                                 |
| ----------- | ------------- | ------------------------------------------------------------------------------ |
| **داشبورد** | `/dashboard`  | overview · revenue · alerts                                                    |
| **مشتریان** | `/customers`  | workspaces · users · devices · support sessions                                |
| **درآمد**   | `/revenue`    | plans & prices · subscriptions · payments & ledger · upgrade requests · wallet |
| **آفلاین**  | `/offline`    | licences · device fleet · offline → online · reconciliation                    |
| **محصول**   | `/product`    | features (registry + flags) · AI · OAuth apps · market                         |
| **عملیات**  | `/operations` | system health · servers · jobs (import/export/migration)                       |
| **محتوا**   | `/content`    | blog _(the CMS is **not** in the menu — §6 and Q17)_                           |
| **امنیت**   | `/security`   | audit log · admin roles · admin sessions · security events                     |

Old URLs (`/subscriptions`, `/wallet`, …) **redirect to their tab** — a
`301` to the new route with the right `?tab=`, never a 404 and never a second
copy of the page.

### 1.1 The redirect table (every current admin route)

| Today                                              | →   | Target                                                                                                         |
| -------------------------------------------------- | --- | -------------------------------------------------------------------------------------------------------------- |
| `/dashboard`                                       | →   | `/dashboard?tab=overview`                                                                                      |
| `/workspaces`                                      | →   | `/customers?tab=workspaces`                                                                                    |
| `/users`                                           | →   | `/customers?tab=users`                                                                                         |
| `/subscriptions`                                   | →   | `/revenue?tab=subscriptions`                                                                                   |
| `/wallet`                                          | →   | `/revenue?tab=wallet`                                                                                          |
| `/ai`                                              | →   | `/product?tab=ai`                                                                                              |
| `/oauth-apps`                                      | →   | `/product?tab=oauth`                                                                                           |
| `/market`                                          | →   | `/product?tab=market`                                                                                          |
| `/servers`                                         | →   | `/operations?tab=servers`                                                                                      |
| `/blog`                                            | →   | `/content?tab=blog`                                                                                            |
| `/cms`, `/cms/pages`, `/cms/media`, `/cms/globals` |     | **no menu item** — the screens stay reachable until Q17 is answered (§6)                                       |
| `/audit-logs`                                      | →   | `/security?tab=audit`                                                                                          |
| _(new)_ `/customers?tab=devices`                   |     | the device fleet (offline) — the **customer** tab lists the devices; the **offline** group owns the fleet (§2) |
| _(new)_ `/revenue?tab=plans`                       |     | the plan catalog and the price versions                                                                        |
| _(new)_ `/revenue?tab=payments`                    |     | the payments and the ledger                                                                                    |
| _(new)_ `/revenue?tab=upgrades`                    |     | the upgrade requests                                                                                           |
| _(new)_ `/offline?tab=licences`                    |     | the signed licences                                                                                            |
| _(new)_ `/offline?tab=fleet`                       |     | the device fleet                                                                                               |
| _(new)_ `/offline?tab=migration`                   |     | the offline → online migration centre                                                                          |
| _(new)_ `/offline?tab=reconciliation`              |     | the read-only reconciliation                                                                                   |
| _(new)_ `/product?tab=features`                    |     | the feature registry and the flags                                                                             |
| _(new)_ `/operations?tab=health`                   |     | the system health                                                                                              |
| _(new)_ `/operations?tab=jobs`                     |     | the import/export/migration jobs                                                                               |
| _(new)_ `/security?tab=roles`                      |     | the admin roles                                                                                                |
| _(new)_ `/security?tab=sessions`                   |     | the admin sessions                                                                                             |
| _(new)_ `/security?tab=events`                     |     | the security events                                                                                            |

Every label in fa, **af** and en. The admin app has only fa and en today; af
is added in Step 1.

---

---

## 2. The items, one by one

Each row: **what it extends** (the existing service/table), **the new table it
needs**, **the permission**, **the shadcn components**, **where it lives**,
**its API**.

### 2.1 P0 — before selling

| #   | Item                                     | Extends                                                                                                                                                                                                                                                                                            | New table                                                                                                                 | Permission                                           | shadcn                                                                   | Where                                                                                   | API                                                                                                                                                                                                                                                                                                                   |
| --- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Workspace 360**                        | `admin.service` (the workspace read) + `billing.service` (the subscription) + `plan-limits.service` (the usage counts) + the entitlement resolver                                                                                                                                                  | none (it **reads** the six concepts of §0.1)                                                                              | `customers.workspaces.read`                          | `Sheet` + `Tabs` + `DataTable` + `AlertDialog`                           | a `Sheet` opened from any workspace row, from any search hit, and from the ⌘K palette   | `GET /api/admin/workspaces/:id` (+ the subscription, the members, the usage, the devices, the licences, the ledger — one payload, composed by a service, not by the page)                                                                                                                                             |
| 2   | **Plan catalog**                         | `plan-pricing.ts` (the prices) + `plan-limit-defaults.ts` (the limits) + the feature registry (the features)                                                                                                                                                                                       | `plan_prices` (the price versions)                                                                                        | `billing.plans.read` / `billing.plans.write`         | `DataTable` + `Sheet` + `Tabs` + `SelectField` + `AlertDialog`           | `/revenue?tab=plans`                                                                    | `GET /api/billing/plans` (read, public today) → extended; `GET /api/admin/plans` (the whole catalog: identity, period, features, limits, device policy, usage policy, upgrade policy) — for the owner's **five** plans: `FREE`, `OFFLINE`, `ONLINE_500`, `ONLINE_1000`, `ONLINE_1500` (the entitlement contract §0.3) |
| 3   | **Price versioning**                     | `plan-pricing.ts` — the prices become **rows** with `effective_from / effective_until`; the subscription keeps the price version it was sold at. **DECIDED: a new price never changes an existing subscription; the limits are separate from the price and are never reduced during a paid term.** | `plan_prices`                                                                                                             | `billing.prices.write`                               | `DataTable` + `Sheet` + `AlertDialog`                                    | `/revenue?tab=plans` → the «prices» tab                                                 | `GET /api/admin/plan-prices`, `POST /api/admin/plan-prices` (a new price never edits an old one)                                                                                                                                                                                                                      |
| 4   | **Subscription lifecycle**               | `billing.service` (`getCurrentSubscription`, `isSubscriptionExpired`, `upgrade`, `cancel`, `extendSubscriptionRow`, `setSubscriptionRowStatus`) + `subscription_events` (the history)                                                                                                              | the **two new states** (PENDING, SUSPENDED) need a `CHECK` extension on `subscriptions.status`; a payments ledger (below) | `billing.subscriptions.plan` / `.status` / `.extend` | `DataTable` + `Sheet` + `Tabs` + `AlertDialog` + `Textarea` (the reason) | `/revenue?tab=subscriptions`                                                            | `GET /api/admin/subscriptions`, `GET /api/admin/subscriptions/:id`, `PATCH /api/admin/subscriptions/:id/plan`, `…/status` — **extended, not replaced**; the transitions go through `billing.service`, never a direct table write                                                                                      |
| 5   | **Entitlements with SOURCE**             | the **one resolver** of the entitlement contract (§0.3) — the admin reads the same answer the product reads                                                                                                                                                                                        | none                                                                                                                      | `billing.subscriptions.read`                         | `DataTable` + `Badge` + `Sheet`                                          | a tab of the Workspace 360 drawer                                                       | `GET /api/admin/workspaces/:id/entitlements` → `{ feature, allowed, reason, source }` per feature, straight from the resolver                                                                                                                                                                                         |
| 6   | **Offline licences**                     | the licence table of the entitlement contract + the licence service (issue/verify)                                                                                                                                                                                                                 | `licences` (from the entitlement migration)                                                                               | `offline.licences.*`                                 | `DataTable` + `Sheet` + `Tabs` + `AlertDialog`                           | `/offline?tab=licences`                                                                 | `GET /api/admin/licences`, `POST /api/admin/licences/:id/revoke`, `…/reissue`, `…/transfer` — **revoke never deletes local data**                                                                                                                                                                                     |
| 7   | **Devices**                              | the device table of the entitlement contract — **separate** from the licence and from the session                                                                                                                                                                                                  | `devices`                                                                                                                 | `offline.devices.read` / `offline.devices.release`   | `DataTable` + `Sheet` + `Tabs`                                           | `/offline?tab=fleet` (and the `customers?tab=devices` list)                             | `GET /api/admin/devices`, `POST /api/admin/devices/:id/release` — **three different buttons with three different effects**: revoke session, revoke licence, release device                                                                                                                                            |
| 8   | **Usage**                                | the counts that `plan-limits.service` already derives (`count: 'exact', head: true`) — the trial total, today's count, the AI quota (`ai_workspace_quota`), the storage, the API, the devices                                                                                                      | none                                                                                                                      | `billing.subscriptions.read`                         | `DataTable` + `Progress` + `Chart`                                       | a tab of the Workspace 360 drawer; the plan's own usage in `/revenue?tab=subscriptions` | `GET /api/admin/workspaces/:id/usage` — the offline edition's numbers are labelled «last report from device at …», never shown as live                                                                                                                                                                                |
| 9   | **Billing ledger**                       | the wallet (the **top-up queue**, today: `/admin/wallet/topups`, approve/reject, search, per-workspace transactions) + the upgrade rows (the amounts actually paid)                                                                                                                                | `billing_ledger_entries`                                                                                                  | `billing.ledger.read` / `.write`                     | `DataTable` + `Sheet` + `Chart`                                          | `/revenue?tab=payments`                                                                 | `GET /api/admin/ledger`, `POST /api/admin/ledger` (a manual adjustment — **maker–checker**, §7)                                                                                                                                                                                                                       |
| 10  | **Upgrade / migration centre**           | the offline edition's safe-migration phase (Phase 8 of the offline prompt) — the admin drives it, it does not implement it                                                                                                                                                                         | the migration's own state row                                                                                             | `offline.migration.read` / `.run`                    | `DataTable` + `Sheet` + `Tabs` + `Progress` + `AlertDialog`              | `/offline?tab=migration`                                                                | `GET /api/admin/migrations`, `POST /api/admin/migrations/:id/run` — the steps are REQUESTED → BACKUP_CREATED → PREVIEWED → UPLOADING → RECONCILING → COMPLETED / FAILED / ROLLED_BACK. **No one-click «make online».**                                                                                                |
| 11  | **Reconciliation**                       | the cloud's figures and the device's report — **read-only**                                                                                                                                                                                                                                        | none                                                                                                                      | `offline.reconciliation.read`                        | `DataTable` + `Sheet` + `Badge`                                          | `/offline?tab=reconciliation`                                                           | `GET /api/admin/reconciliation/:workspaceId` — invoices, receivables per currency, stock per product×warehouse, ledger totals, device vs cloud, MATCHED / MISMATCH with the exact difference. **It never «fixes» anything.**                                                                                          |
| 12  | **Admin RBAC**                           | `platformAdminGuard` (the outer fence) + `requireCapability`'s pattern (the inner fence) — **DECIDED: an admin table with a role; the email allowlist stays the outer fence**                                                                                                                      | `admin_accounts`, `admin_permissions`                                                                                     | `security.roles.read` / `.write`                     | `DataTable` + `Sheet` + `SelectField` + `AlertDialog`                    | `/security?tab=roles`                                                                   | `GET /api/admin/roles`, `PUT /api/admin/roles/:role/permissions`                                                                                                                                                                                                                                                      |
| 13  | **Admin MFA**                            | **DECIDED: Supabase MFA (TOTP); the backend enforces AAL2.** Greenfield — there is no MFA, no AAL2 and no step-up anywhere in the repository today                                                                                                                                                 | none (the secret lives in Supabase's MFA tables)                                                                          | — (it guards everything)                             | —                                                                        | the login page + `proxy.ts`                                                             | `POST /api/admin/auth/…`? **No**: the MFA is Supabase's own (`supabase.auth.mfa`), enforced in `proxy.ts` **and** by a backend guard that reads the session's AAL — a new `requireAdminAal2` in front of the money routes                                                                                             |
| 14  | **Immutable audit for money and access** | `audit_logs` + `AuditService` (which already writes `created_at` explicitly)                                                                                                                                                                                                                       | the **columns** the prompt asks for (`reason`, `request_id`, `correlation_id`) and the append-only **trigger**            | `security.audit.read`                                | `DataTable` + `Sheet` + `Textarea` (the reason)                          | `/security?tab=audit`                                                                   | `GET /api/admin/audit-logs` — **extended** with server-side filters (the hook today fetches 50 rows with no filter) and the before/after snapshots the table already holds                                                                                                                                            |
| 15  | **Support session**                      | **DECIDED: a short-lived READ-ONLY support token**, with a row in `support_sessions`; the customer sees it in their **activity feed**. The auth core (a session) + `audit_logs`                                                                                                                    | `support_sessions`                                                                                                        | `customers.support_sessions.read` / `.open`          | `Sheet` + `Tabs` + `AlertDialog` + `Textarea`                            | a button in the Workspace 360 drawer                                                    | `POST /api/admin/support-sessions` (reason required, expires, read-only by default) — a write inside it needs `customers.support_sessions.open` **and** is audited; **never the customer's password**                                                                                                                 |

### 2.2 P1 and P2

| #    | Item                                               | Extends                                                                                                                                                                                                                                                                                                                                   | New table                                                              | Permission                      | shadcn                                                    | Where                    | API                                                                                                           |
| ---- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| P1-1 | **Feature flags**                                  | **separate** from the entitlement (the prompt says so). **DECIDED: global flags with a rollout % first; a per-workspace override comes later.** There is **no flag system today** — the nearest thing is `platform_settings` (a key/value jsonb with one key in use) and the AI pipeline's own kill switch; neither can carry a rollout % | `feature_flags`, `feature_flag_overrides`                              | `product.flags.read` / `.write` | `DataTable` + `Sheet` + `Tabs` + `Switch` + `SelectField` | `/product?tab=features`  | `GET /api/admin/feature-flags`, `PUT /api/admin/feature-flags/:key`                                           |
| P1-2 | **Offline fleet health**                           | the device table + the licence table                                                                                                                                                                                                                                                                                                      | none                                                                   | `offline.devices.read`          | `DataTable` + `Chart`                                     | `/offline?tab=fleet`     | `GET /api/admin/offline/fleet-health`                                                                         |
| P1-3 | **System health**                                  | the instances/scale endpoints the admin already calls (`/admin/instances`, `/admin/instances/scale`) + the queues, the payments, the AI, the email, the OAuth, the sync, the migration                                                                                                                                                    | none                                                                   | `operations.health.read`        | `DataTable` + `Card` + `Progress`                         | `/operations?tab=health` | `GET /api/admin/health` (one composed payload — a service, not the page)                                      |
| P1-4 | **Import/export/migration jobs**                   | `background-jobs-claim-migration.sql`'s job table                                                                                                                                                                                                                                                                                         | none                                                                   | `operations.jobs.read` / `.run` | `DataTable` + `Sheet`                                     | `/operations?tab=jobs`   | `GET /api/admin/jobs`, `POST /api/admin/jobs/:id/retry`                                                       |
| P1-5 | **Security centre**                                | `audit_logs` + the auth core's sessions                                                                                                                                                                                                                                                                                                   | the security events (or a view over the existing session/event tables) | `security.events.read`          | `DataTable` + `Sheet`                                     | `/security?tab=events`   | `GET /api/admin/security-events`                                                                              |
| P1-6 | **Full user management**                           | the auth core (suspend, revoke sessions, reset MFA) — **never an admin-set password**                                                                                                                                                                                                                                                     | none                                                                   | `customers.users.*`             | `DataTable` + `Sheet` + `AlertDialog` + `Textarea`        | `/customers?tab=users`   | `PATCH /api/admin/users/:id` (suspend/reactivate), `POST /api/admin/users/:id/revoke-sessions`, `…/reset-mfa` |
| P2-1 | **Revenue, cohort, LTV, churn, fraud, dashboards** | the **ledger** (item 9) — there is **no** revenue figure in the database today (`admin.service.ts` says so: «Any revenue figure here would be invented»). **DECIDED: no revenue numbers until the billing ledger exists**                                                                                                                 | none                                                                   | `billing.ledger.read`           | `Chart` + `DataTable`                                     | `/dashboard?tab=revenue` | `GET /api/admin/revenue` — **only after** the ledger exists; before that the dashboard shows no money         |

### 2.3 The ten additions (D)

| #    | Item                                    | Extends                                                                                                                                                                                                                                              | New table                                                                                | Permission                                 | shadcn                                   | Where                                                                                                 | API                                                                                                                                                                                                                                              |
| ---- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D-1  | **Maker–checker**                       | `ai_action_requests` — **the same shape**, a new table. **DECIDED: the checker is any OTHER admin holding the permission; the proposer can never approve (server-checked)**                                                                          | `admin_action_requests`                                                                  | the permission of the **proposed** action  | `AlertDialog` + `Textarea` + `DataTable` | the queue inside the action's own page (a tab of `/revenue?tab=payments`, `/offline?tab=licences`, …) | `GET /api/admin/action-requests`, `POST /api/admin/action-requests`, `POST /api/admin/action-requests/:id/approve` (403 when the proposer approves)                                                                                              |
| D-2  | **Step-up re-authentication**           | the admin's Supabase session (AAL2)                                                                                                                                                                                                                  | none                                                                                     | the permission of the money action         | `AlertDialog` + an OTP field             | inside the money action's dialog                                                                      | the step-up is checked by the **backend** guard, not by the screen: the request carries the fresh TOTP, the guard verifies it and its age (≤ 5 minutes)                                                                                          |
| D-3  | **Preview + diff, idempotent apply**    | the service that performs the change (the diff is computed by the service, not by the page)                                                                                                                                                          | none                                                                                     | the permission of the action               | `AlertDialog`                            | inside the action's dialog                                                                            | `POST /api/admin/<action>/preview` → the before → after; the apply sends an `Idempotency-Key`                                                                                                                                                    |
| D-4  | **Trial-abuse signals**                 | the workspaces, the users, the devices, the payments. **DECIDED: the signals are phone, device id, card hash and IP range; they live in a tab of the Customers hub**                                                                                 | none (the signals are **derived**, not stored)                                           | `customers.workspaces.read`                | `DataTable` + `Badge` + `Sheet`          | a tab of `/customers?tab=workspaces`                                                                  | `GET /api/admin/trial-abuse` — signals only, **never an auto-ban**; the action is «merge the trial allowance» (an override in `workspace_limit_overrides`)                                                                                       |
| D-5  | **Key rotation + revocation list**      | the licence signing key (the private key is **never** displayed). **DECIDED: a revocation takes effect when the device next comes online; a device that is always offline runs to the end of its term — and that is written into the terms of sale** | the key versions (the public key id inside each licence) + the revocation list           | `offline.licences.issue`                   | `DataTable` + `Sheet` + `AlertDialog`    | `/offline?tab=licences` → a «keys» tab                                                                | `POST /api/admin/licence-keys/rotate` (the old licences keep verifying), `GET /api/admin/licence-revocations` (the signed list the devices fetch when they are online)                                                                           |
| D-6  | **Dunning and customer communications** | the **existing email outbox** (`email_outbox` + `enqueueEmail` / `claimEmails` / `deliverClaimed`) — no second sender. **DECIDED: email and in-app only; no SMS**                                                                                    | none (the log is the outbox; the in-app messages need a channel column or a small table) | `billing.subscriptions.read`               | `DataTable` + `Sheet`                    | `/revenue?tab=subscriptions` → a «messages» tab                                                       | `GET /api/admin/dunning` (what was sent, when, and the result)                                                                                                                                                                                   |
| D-7  | **Internal notes and timeline**         | `audit_logs` + the subscription/payment/licence events (the timeline **merges** them) + the product's `entity_notes` (which the customer can see — the admin's own notes are **not** those)                                                          | `admin_notes`                                                                            | `customers.workspaces.read`                | `Sheet` + `Tabs` + `Textarea`            | a tab of the Workspace 360 drawer                                                                     | `GET /api/admin/workspaces/:id/timeline`, `POST /api/admin/workspaces/:id/notes`                                                                                                                                                                 |
| D-8  | **Command palette (⌘K)**                | the shared `CommandPalette` (built on `cmdk`)                                                                                                                                                                                                        | none                                                                                     | — (it searches what the role may open)     | `Command` (the primitive)                | global, in the admin shell                                                                            | the palette calls the same read endpoints (workspaces, users, phone, licence id, payment reference) and opens the 360 drawer directly                                                                                                            |
| D-9  | **Announcements and maintenance mode**  | the apps' configuration (the apps must fetch it). **DECIDED: yes** — the apps read it from the server, and the offline edition shows the last one it received and keeps working                                                                      | `announcements`                                                                          | `admin.announcements.read` / `.write`      | `Sheet` + `DataTable` + `Switch`         | `/dashboard?tab=announcements`                                                                        | `GET /api/admin/announcements`, `POST /api/admin/announcements`; the public read: `GET /api/announcements` (the apps read it; the offline edition shows the **last** one it received, and keeps working — it is told, not blocked)               |
| D-10 | **Customer data requests**              | the export services (the customer's own data) + the anonymisation rules. **DECIDED: an export within 7 days, a deletion within 30 days; the financial records are retained as the law requires (legal hold)**                                        | `admin_data_requests`                                                                    | `customers.data_requests.read` / `.decide` | `DataTable` + `Sheet` + `AlertDialog`    | a tab of `/customers?tab=workspaces`                                                                  | `GET /api/admin/data-requests`, `POST /api/admin/data-requests` (export / delete), `POST /api/admin/data-requests/:id/close` — deletion is retire-and-anonymise, never a compensating DELETE; an expired customer's **export** is always allowed |

### 2.4 The two cross-cutting items the prompt lists separately

| Item                                                              | Extends                                                                                                                                                                                                                                                                                                                                                                                                           | New table | Permission                            | shadcn                    | Where                            | API                                                                         |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------- | ------------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| **Admin tables export to CSV** (through the shared `buildCsvZip`) | `packages/formatting`'s `buildCsvZip` / `buildXlsx` — **already built, and no admin screen uses them today**. ⚠️ The product's own CSV export (`GET /api/migrations/export`) covers **customers and products only** — invoices throw `MIGRATION_EXPORT_UNSUPPORTED` — so the panel's export is its **own** endpoint, not that one                                                                                 | none      | the permission of the list it exports | `Button` + `DropdownMenu` | every `DataTable`'s actions slot | `GET /api/admin/<list>/export.csv` — and **every export is itself audited** |
| **The `admin-ui.tsx` migration** (law 2)                          | `Panel` → `Card`; `FilterPill` → `TableFilterSelect` / `SegmentedControl`; `Pagination` → the `DataTable`'s own pager with `paginate={false}` (the admin's lists are server-paged); `EmptyState` → the shared `EmptyState` (it exists in `packages/ui`); `ErrorState` / `ListSkeleton` / `StatusDot` → **no shared equivalent exists** — they move into `packages/ui` or stay in the admin (a decision in Step 1) | none      | —                                     | —                         | 17 files                         | —                                                                           |

---

---

## 3. The data model — what exists, what is added

### 3.1 The tables the panel already reads (nothing new)

| Concept                                            | Table                                                                                                                                                                                                                                                                                | Written by                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| the subscription                                   | `subscriptions` (`docs/base-schema-migration.sql`)                                                                                                                                                                                                                                   | `billing.service`                                                                         |
| the plan's limits (and the per-workspace override) | `plan_limit_settings`, `workspace_limit_overrides` (`docs/plan-limits-migration.sql`)                                                                                                                                                                                                | `plan-limits.service`                                                                     |
| the upgrade requests and their history             | `subscription_upgrade_requests`, `subscription_events` (`docs/subscription-upgrade-requests-migration.sql`)                                                                                                                                                                          | `subscription-upgrade.service` (through Postgres functions)                               |
| the wallet — **and its own append-only ledger**    | `wallets`, `wallet_transactions`, `wallet_topup_requests`, `wallet_payment_methods` (`docs/wallet-01-migration.sql`); `wallet_transactions` is already protected by a `BEFORE UPDATE OR DELETE` trigger (`WALLET_LEDGER_APPEND_ONLY`) with signed `amount_minor` and `balance_after` | `wallet.service.ts` (`walletService`)                                                     |
| the maker–checker pattern to copy                  | `ai_action_requests` (`docs/ai-action-requests-01-migration.sql`) — **forward-only trigger** (`AI_REQUEST_IMMUTABLE`, `AI_REQUEST_ALREADY_DECIDED`), a **24-hour TTL** on a pending request, and the rule «a request made with an API key is never self-approved»                    | `mcp-request.service.ts` (`mcpRequestService`)                                            |
| the email outbox                                   | `email_outbox` (`docs/email-outbox-migration.sql`) — durable: `enqueueEmail` → `claimEmails` → `deliverClaimed`; the campaigns ride the same outbox                                                                                                                                  | `email.service.ts` (the Resend sender) + `email-outbox.ts`                                |
| the audit                                          | `audit_logs`                                                                                                                                                                                                                                                                         | `AuditService` (with an explicit `created_at`)                                            |
| the AI quota                                       | `ai_workspace_quota` (`docs/phase-t13-ai-provider-migration.sql`); the usage is **counted from `ai_query_log`**, never stored                                                                                                                                                        | `ai-quota.service.ts` (`AiQuotaService`)                                                  |
| the content                                        | `blog_posts`, `blog_categories`, `blog_tags`, `blog_comments` (`docs/blog-migration.sql`); `cms_pages`, `cms_globals`, `cms_media`, `cms_navigation`, `cms_page_versions` (`docs/cms-foundation-migration.sql` — the page versions are already immutable)                            | the blog / CMS services                                                                   |
| the developer surface                              | `oauth_apps`, `app_publishers`, `app_versions`, `app_installations`, `app_reviews`, `app_reports`, `api_keys`, `webhook_endpoints`, `webhook_deliveries` (`docs/developer-platform-0*-migration.sql`)                                                                                | `market.service.ts`, `oauth.service.ts`, `marketplace.service.ts`, `developer.service.ts` |
| the jobs                                           | the background-jobs claim table (`docs/background-jobs-claim-migration.sql`)                                                                                                                                                                                                         | the background worker                                                                     |
| the admin's own **users**                          | the **Supabase Auth directory** — there is no `users` table; the panel pages the directory                                                                                                                                                                                           | `admin.service.ts`                                                                        |
| the referrals                                      | `referral-system-migration.sql`                                                                                                                                                                                                                                                      | the referral service                                                                      |

### 3.2 The new tables (additive, one migration file each)

| Table                                      | Why it is needed                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Migration                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `admin_accounts`                           | who is an admin and in which role — the email allowlist stays the **outer fence**, this is the inner one                                                                                                                                                                                                                                                                                                                                                                     | `docs/admin-01-migration.sql`                                                  |
| `admin_permissions`                        | the catalogue: role → permission (`billing.refund`, `licence.revoke`, …). One row per (role, permission)                                                                                                                                                                                                                                                                                                                                                                     | same file                                                                      |
| `admin_action_requests`                    | **the maker–checker queue** — the same shape as `ai_action_requests`, a new table, not a third approval system                                                                                                                                                                                                                                                                                                                                                               | same file                                                                      |
| `plan_prices`                              | **price versioning**: a price row with `effective_from / effective_until`; a subscription stores the price version it was sold at                                                                                                                                                                                                                                                                                                                                            | `docs/admin-02-migration.sql`                                                  |
| `billing_ledger_entries`                   | **the PLATFORM's ledger** — the record of every money movement (purchase, upgrade, downgrade, credit, refund, adjustment, payment). The wallet keeps **its own** ledger (`wallet_transactions` — already append-only, signed amounts, `balance_after`); what does not exist is a ledger the **company's** money feeds, which is why the platform's revenue is still not computable and the dashboard deliberately shows none. The new table copies the wallet ledger's shape | same file                                                                      |
| `admin_notes`                              | the admin's **internal** notes on a workspace (not the customer's `entity_notes`)                                                                                                                                                                                                                                                                                                                                                                                            | same file                                                                      |
| `support_sessions`                         | «View as customer»: admin, workspace, reason, expiry, mode, revoked_at                                                                                                                                                                                                                                                                                                                                                                                                       | same file                                                                      |
| `feature_flags` + `feature_flag_overrides` | the **flags** (rollout %, platform, country, beta) — separate from the entitlement; the overrides are per workspace                                                                                                                                                                                                                                                                                                                                                          | `docs/admin-03-migration.sql`                                                  |
| `announcements`                            | the banner and the maintenance switch, targeted by plan/edition/platform/locale, with a scheduled start and end                                                                                                                                                                                                                                                                                                                                                              | same file                                                                      |
| `admin_data_requests`                      | the customer-data queue: export-on-request and account-deletion, with SLA, legal hold and retention                                                                                                                                                                                                                                                                                                                                                                          | same file                                                                      |
| `licences` + `devices`                     | the **offline licence and the device fleet** (from the entitlement contract §13.1)                                                                                                                                                                                                                                                                                                                                                                                           | `docs/entitlement-01-migration.sql` (the same migration — one table, one home) |
| the migration centre's state               | the OFFLINE → ONLINE migration steps (REQUESTED → BACKUP_CREATED → PREVIEWED → UPLOADING → RECONCILING → COMPLETED/FAILED/ROLLED_BACK)                                                                                                                                                                                                                                                                                                                                       | `docs/admin-04-migration.sql`                                                  |

⚠️ **Nothing here is a second copy of an existing table.** The plan, the
limits, the subscription, the licence and the usage are all read from where
they already live (§3.1). The tables above are the things that do not exist
yet — not a parallel plan table, not a parallel billing table.

---

---

## 4. The permissions

### 4.1 Two fences, in this order

| Fence                                       | Today                                                                                                           | After                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Outer** — is this person an admin at all? | `platformAdminGuard` — the `ADMIN_ALLOWED_EMAILS` env allowlist (401 unauthenticated, 403 `ADMIN_UNAUTHORIZED`) | **unchanged**, and it stays the outer fence                                        |
| **Inner** — may this admin do THIS?         | nothing: every admin route is all-or-nothing                                                                    | `requireAdminPermission(permission)` — a new guard, always **after** the outer one |
| **Who is an admin**                         | the email allowlist only                                                                                        | **an admin table with a role**; the allowlist stays the **outer fence**            |

The inner fence is the prompt's «every `/api/admin/*` route declares the
permission it needs (server-side, like `requireCapability`)». The menu hides
what the role cannot open — and **the server refuses it anyway**.

### 4.2 The roles and what they carry

Seven roles, named by the prompt:

| Role         | Carries                                             | Reads / writes                                                                         |
| ------------ | --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **SUPER**    | everything                                          | every route, including the roles themselves                                            |
| **BILLING**  | `billing.*`                                         | the plans, the prices, the subscriptions, the ledger, the wallet, the upgrade requests |
| **SUPPORT**  | `customers.*` (read + support sessions)             | the workspaces, the users, the support sessions, the data requests                     |
| **CONTENT**  | `content.*`                                         | the blog, the CMS                                                                      |
| **MARKET**   | `product.market.*`, `product.oauth.*`               | the market, the OAuth apps                                                             |
| **OPS**      | `operations.*`, `product.ai.*`, `offline.devices.*` | the health, the servers, the jobs, the AI quota, the device fleet                      |
| **SECURITY** | `security.*`, `customers.users.revoke_sessions`     | the audit, the admin roles, the admin sessions, the security events                    |

**DECIDED (20 Oct 2026): the roles are FIXED IN CODE** — each one is a
permission list, defined once, and owner-editable roles come later. The
catalogue is therefore data (`admin_permissions`) with the **role → list**
seeded from the code, not a table the operator edits by hand.

### 4.3 The permission catalogue (the vocabulary every route names)

| Group                          | Permissions                                                                |
| ------------------------------ | -------------------------------------------------------------------------- |
| `billing.plans.*`              | `read`, `write`                                                            |
| `billing.prices.*`             | `read`, `write`                                                            |
| `billing.subscriptions.*`      | `read`, `plan`, `status`, `extend`, `override_limits`                      |
| `billing.ledger.*`             | `read`, `write` (a manual adjustment or a refund)                          |
| `billing.wallet.*`             | `read`, `adjust`                                                           |
| `billing.upgrade_requests.*`   | `read`, `decide`                                                           |
| `offline.licences.*`           | `read`, `issue`, `revoke`, `reissue`, `transfer`                           |
| `offline.devices.*`            | `read`, `release`                                                          |
| `offline.migration.*`          | `read`, `run`                                                              |
| `offline.reconciliation.*`     | `read`                                                                     |
| `customers.workspaces.*`       | `read`, `suspend`                                                          |
| `customers.users.*`            | `read`, `suspend`, `revoke_sessions`, `reset_mfa`, `force_signout`         |
| `customers.support_sessions.*` | `read`, `open` (a write inside a support session needs its own permission) |
| `customers.data_requests.*`    | `read`, `decide`                                                           |
| `product.features.*`           | `read`, `write` (the registry)                                             |
| `product.flags.*`              | `read`, `write`                                                            |
| `product.ai.*`                 | `read`, `quota`                                                            |
| `product.oauth.*`              | `read`, `write`                                                            |
| `product.market.*`             | `read`, `write`                                                            |
| `operations.*`                 | `health.read`, `servers.read`, `jobs.read`, `jobs.run`                     |
| `content.blog.*`               | `read`, `write`                                                            |
| `content.cms.*`                | `read`, `write`                                                            |
| `security.audit.*`             | `read`                                                                     |
| `security.roles.*`             | `read`, `write`                                                            |
| `security.sessions.*`          | `read`, `revoke`                                                           |
| `security.events.*`            | `read`                                                                     |
| `admin.announcements.*`        | `read`, `write`                                                            |

The catalogue is **data** in `admin_permissions` — the same shape as the
feature registry in the entitlement contract: a route names a permission, and
the table says who has it. No route compares a role by hand.

---

## 5. The shadcn surface

### 5.1 In `packages/ui`, but the admin cannot reach them

`packages/ui/package.json` has an **`exports` map**, so a deep import
(`@hisabche/ui/src/components/ui/tabs`) is **blocked** — the admin can only
consume what the root barrel (`packages/ui/src/index.ts`) exports, and what
`apps/admin/components/ui/index.ts` re-exports.

Two gaps, and they are different:

| Gap                                                   | What                                                                                                                                                                                | Fix                                                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Not in the root barrel**                            | `SelectField`, `Tabs*`, `Progress*`, `Label`, `Switch`, `Accordion*`, `Chart*`, `SegmentedControl`, `HubTabs`, `PageHub`, `TableFilterSelect`                                       | **add the export lines** to `packages/ui/src/index.ts` — no new component                        |
| **In the root barrel, but not in the admin's barrel** | `Sheet*` (exported at `packages/ui/src/index.ts:38-45`), `Table*`, `Toaster` (sonner), `Tooltip*`, `Breadcrumb`, `DataTable` + the family, `EmptyState`, `ToastProvider`/`useToast` | **add the re-exports** to `apps/admin/components/ui/index.ts` — the file exists for exactly this |

⚠️ **The `packages/ui` barrel is the only door.** A deep import is blocked
by the `exports` map, so «just import it from the path» is not an option —
and it would break the law anyway.

⚠️ **`Breadcrumb` is not the shadcn breadcrumb.** It derives the crumbs from
`NAV_CONTRACT` and hardcodes `['fa','af','en']` — it is a product component,
not a primitive. The panel's breadcrumb is its own (the admin has no product
navigation).

### 5.2 Missing — added ONCE to `packages/ui`

Only what the panel actually needs, with the standard shadcn source, tokens
only, RTL logical classes, and the same file convention as the primitives
that are already there.

| Primitive          | The dependency it needs                                                                               | Why                                                                                                                                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`alert-dialog`** | **`@radix-ui/react-alert-dialog` — NOT installed today**                                              | **every money or destructive action** (a refund, a price change, a downgrade, a licence transfer, a manual adjustment) — and the «before → after» preview of D.3 lives in it. A `Dialog` that can be dismissed by accident is not a confirmation. |
| **`command`**      | `cmdk` — **already installed** (`packages/ui/package.json`) and already used by `command-palette.tsx` | the ⌘K palette of D.8. The product's `CommandPalette` is a **product** component; the primitive is what the admin's palette is built on.                                                                                                          |
| **`checkbox`**     | `@radix-ui/react-checkbox` — **already installed**                                                    | the row selection the lists need (the dunning list, the device fleet, the trial-abuse list)                                                                                                                                                       |
| **`textarea`**     | none (a plain element with the same tokens)                                                           | **every audited action asks for a reason** — a one-line input is too small for «why are you refunding this?»                                                                                                                                      |

### 5.3 Deliberately NOT added

| Primitive                      | Why not                                                                                                                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `form`                         | the repo's form convention is **react-hook-form + zod** (`@hookform/resolvers`), used across the product and already a dependency of `apps/admin`. shadcn's `form` wraps react-hook-form — adding it would be a second way to write a form. |
| `calendar`                     | the repo already has a **Jalali** date picker (`jalali-datepicker.tsx`) and a date-range picker; `react-day-picker` is **not** installed, and shadcn's calendar is Gregorian. The dunning and ledger filters use the existing one.          |
| `popover`                      | `@radix-ui/react-popover` is installed and used directly by `search-input.tsx`; for the panel, `dropdown-menu` and `SelectField` cover every case. A primitive added «just in case» is a primitive that drifts.                             |
| `avatar`                       | the audit log shows the actor's **name**; a picture is decoration.                                                                                                                                                                          |
| `separator`                    | borders do the job.                                                                                                                                                                                                                         |
| `scroll-area`                  | the `Sheet` scrolls natively; `@radix-ui/react-scroll-area` is not installed and would be a new dependency for nothing.                                                                                                                     |
| `hover-card`                   | not installed, not needed.                                                                                                                                                                                                                  |
| `radio-group` / `toggle-group` | `SelectField` and `SegmentedControl` cover every choice the panel makes; `radio-group`'s Radix package is installed but unused elsewhere.                                                                                                   |

⚠️ **Two of the primitives the prompt lists as «available today» are not
exactly that.** `Progress` is built on **`@base-ui/react/progress`**, not
Radix; and `Breadcrumb` is a product component. Neither blocks the panel —
both are exported or exportable — but «the standard shadcn source (Radix)»
is a description of the _style_, not a promise about the library.

---

## 6. The CMS: menu or delete — **the decision**

**The CMS does NOT join the menu. The blog does.**

**The measured reason** (this is why the decision is not a preference):

- The CMS's **public** read routes exist — `GET /api/public/cms/pages/:locale/:slug`
  and `GET /api/public/cms/globals/:locale` (`backend/src/routes/cms.routes.ts`) —
  but **nothing reads them**: no route in `apps/web`, no component in
  `packages/ui`, and in the backend the only reader of `cms_pages`,
  `cms_globals` and `cms_media` is the CMS's own repository
  (`backend/src/services/cms/cms.repository.ts`).
- The CMS is therefore a **closed loop**: an operator writes content that
  nothing renders. Putting it in the menu would be a screen that manages
  something nobody sees — the «UI theater» the prompt forbids.
- The **blog** is the opposite: it has three routes, a menu entry, real
  endpoints, comments, taxonomy and a working AI pipeline, and the public
  blog reads it. The blog becomes `/content?tab=blog`.

**What happens to the CMS itself:**

| Part                        | Decision                                                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the menu                    | **no entry** — the content group holds the blog                                                                                                                                                                           |
| the admin screens           | they stay in the repository (unreachable from the menu) **until the owner decides their fate** (Q17) — but their five defects are fixed in Step 1 anyway, because broken code in the repo is broken code, menu or no menu |
| the public API + the tables | **untouched** — no DDL, no data loss. The content is the operator's; deleting a table is not a menu decision.                                                                                                             |

⚠️ **The five defects the CMS's screens carry today** (fixed in Step 1
whatever the menu decision is):

| #   | Defect                                                                                                                                                                                                 | Where                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| 1   | **a double `/api` in every CMS call** → `…/api/api/cms/…`                                                                                                                                              | `cms-pages-client.tsx:18`, `cms-page-editor-client.tsx:25,34,37`, `cms-globals-client.tsx:19,26` |
| 2   | **an explicit `any`**                                                                                                                                                                                  | `cms-pages-client.tsx:86`                                                                        |
| 3   | **links without the locale prefix** → they leave the `/[lang]` tree and are bounced by `proxy.ts`                                                                                                      | `cms-pages-client.tsx:33,57,118`                                                                 |
| 4   | **a dead upload button** (no handler) and hardcoded English                                                                                                                                            | `cms-media-client.tsx:19-23,31-32`                                                               |
| 5   | **hand-written `<table>` markup** instead of `DataTable`, and raw `hsl(var(--…))` classes instead of the Tailwind semantic tokens                                                                      | `cms-pages-client.tsx:65-127`                                                                    |
| 6   | ⚠️ **the CMS's «admin» routes are not admin routes**: `/api/cms/*` sits behind `[authenticate, requireWorkspaceContext]`, so **any workspace member can edit the site's pages** — not a platform admin | `backend/src/routes/cms.routes.ts:15`                                                            |

**Q17 asks the one question that would flip this decision:** is the landing
page going to be CMS-driven? If yes, the CMS joins the menu in the same
release that wires the reader — a menu entry for content nobody renders is
never right, and a menu entry for content that renders is right.

---

## 7. The shared concerns (once, for the whole panel)

### 7.1 The audit — one table, one service

The product already has `audit_logs` and `AuditService` (which writes
`created_at` explicitly, because the live column has no default). The admin
does **not** get a second audit table:

- the **columns** the prompt asks for — `reason`, `request_id`,
  `correlation_id` — are **added** to `audit_logs` (additive migration);
- the **append-only trigger** (a `BEFORE UPDATE OR DELETE` trigger that
  raises) is added to the same table — **DECIDED: yes** (an additive
  migration + its VERIFY file; the owner runs them);
- ⚠️ **THE RETENTION PATH DECIDES WITH IT.** `audit_logs` has **no trigger
  today**, and `AuditService.cleanup(daysToKeep)` **deletes** rows — it writes
  a marker row first and refuses to proceed if the marker cannot be written.
  A trigger that refuses every DELETE would break
  `POST /api/audit/cleanup`. The contract's answer: the trigger allows the
  **retention** delete — one named function, the only writer allowed to
  delete — and refuses every other UPDATE and DELETE. The cleanup becomes
  auditable instead of invisible.
- every admin action goes through `AuditService`, with the **before** and
  **after** rows the service already writes (`old_data`, `new_data`).

⚠️ **The admin's audit list does not show what it should today.** The hook
(`use-admin-audit-logs.ts`) reads `{ id, user_id, action, entity_type,
entity_id, ip_address, created_at }` — **no before/after**, and **no
server-side filters** (it fetches 50 rows). The `/security?tab=audit` screen
needs the columns and the filters, so the endpoint grows (and the hook with
it).

### 7.2 The admin's own session — MFA, AAL2, step-up

| Requirement                                    | Where it is enforced                                    | Today                                                                               |
| ---------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| «is this person an admin?»                     | `proxy.ts` + `platformAdminGuard` (the email allowlist) | ✅ exists (in two independent implementations)                                      |
| «has this admin proved a second factor?»       | `proxy.ts` **and** a backend guard                      | ❌ **nothing** — no MFA, no AAL2, no `supabase.auth.mfa` anywhere in the repository |
| «is this action worth a fresh code?» (step-up) | the **backend** guard of the money routes               | ❌ nothing                                                                          |
| «may this admin do this?»                      | `requireAdminPermission(permission)`                    | ❌ nothing — every admin route is all-or-nothing today                              |

The rule that keeps this honest: **the screen is not the guard.** The panel
hides what the role cannot open; the server refuses it anyway. A test proves
a BILLING admin gets 403 on `/api/admin/servers/*`, and a SUPER admin gets
403 on an action that needs a fresh TOTP.

### 7.3 The maker–checker

The shape already exists: `ai_action_requests` (its own migration, its own
service, its own approve/reject flow) — **including three rules the admin's
queue copies**: the row is **forward-only** (a trigger raises
`AI_REQUEST_IMMUTABLE` if the tool, the arguments or the requester change,
and `AI_REQUEST_ALREADY_DECIDED` if a decided row is decided again); a pending
request **expires after 24 hours**; and **a request made with an API key is
never self-approved** (the requester may only approve their own _in-app_
request).

The admin's queue is the **same shape** in a **new table**
(`admin_action_requests`) — not a third approval system, and not a second one
inside the AI service. It adds one rule: **the proposer can never approve.**

The server check is the point: that refusal is enforced in the service (or
the Postgres function), not in the button.

### 7.4 The preview/diff and the idempotency

Every admin write that changes money, a plan, a licence or a limit shows
**before → after** in an `AlertDialog` and sends an `Idempotency-Key`. A
double click is one action, not two. The diff is computed by the **service**
(the same service that will apply it) — the page never compares two plans by
hand.

### 7.5 The i18n

- The admin has **fa and en only** today (`i18n-config.ts`, `i18n/request.ts`,
  `proxy.ts`'s `LOCALES`); the shared catalogs have **fa, af, en** and the
  `admin` block already exists in all three. Adding `af` touches **three
  admin files** — and `admin-nav.ts`'s helpers already accept `af`.
- Every new key goes into `packages/i18n/messages/{fa,af,en}/common.json` under
  the existing `admin.*` families, plus the new `entitlement.*` / `feature.*`
  families of the entitlement contract.
- **No hard-coded Persian and no hard-coded English** in the admin: the CMS's
  two hardcoded English strings (§6) are fixed in the same pass.

### 7.6 The tests

⚠️ **The admin app has no test suite at all**: `package.json`'s `test` script
is `echo "no tests yet"`. Step 1 adds it, because the panel is where money
moves:

| What                                      | Where                                                 |
| ----------------------------------------- | ----------------------------------------------------- |
| a non-admin → 403; a wrong role → 403     | the backend's route tests (one per permission family) |
| an audit row cannot be updated or deleted | the `*.pg.test.ts` (the trigger)                      |
| a refund by its proposer is refused       | the service test                                      |
| an action without a fresh TOTP is refused | the backend guard test                                |
| the admin's own pages                     | **vitest** (the owner's decision, 20 Oct 2026)        |

### 7.7 The tokens, the theme and the barrel

- The admin already uses the **same** design system (`@hisabche/ui/globals.css`
  — one file, 50 KB, the tokens live in `packages/ui/src/styles/globals.css`).
  The panel's own `tailwind.config.ts` maps the semantic names onto those
  tokens. **Nothing new is themed.**
- ⚠️ `darkMode: 'class'` in the admin's tailwind config, but the system is
  **`data-theme`**-driven. One `dark:` class survives in
  `subscriptions-client.tsx` and therefore never fires. Step 1 fixes the
  config (or removes the class).
- The **barrel** is the only door (§5.1): `packages/ui/src/index.ts` and
  `apps/admin/components/ui/index.ts` are the two files that decide what the
  panel can use.

---

## 8. The answers (the owner, 20 Oct 2026)

The seventeen questions this contract could not answer on its own, and the
owner's decisions. **They are the contract now**; the questions stay on the
record so the reasoning behind each decision is not lost.

| #       | Question                                     | The answer                                                                                                                                                        |
| ------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1**  | The currency of the prices                   | **IRR (ISO)**: stored in IRR, displayed in تومان. An AFN price **version** may be added later.                                                                    |
| **Q2**  | The roles: a fixed set or a composable list? | **Fixed roles defined in code**, each one a permission list. **Owner-editable roles come later.**                                                                 |
| **Q3**  | Who is an admin, and where does that live?   | **An admin table with a role**; the email allowlist stays the **outer fence**.                                                                                    |
| **Q4**  | MFA: Supabase or the panel's own?            | **Supabase MFA (TOTP)**; the **backend enforces AAL2**.                                                                                                           |
| **Q5**  | The maker–checker approvers                  | **Any other admin holding the permission** — never the proposer (server-checked).                                                                                 |
| **Q6**  | The support session («View as customer»)     | A **short-lived read-only support token**, with a row in `support_sessions`; the customer sees it in their **activity feed**.                                     |
| **Q7**  | The audit's append-only trigger              | **Yes** — an additive migration + VERIFY on `audit_logs`; the owner runs it.                                                                                      |
| **Q8**  | The trial-abuse signals                      | **Phone, device id, card hash, IP range** — a tab in the **Customers hub**.                                                                                       |
| **Q9**  | The revocation list and the offline devices  | A revocation takes effect when the device **next comes online**; a device that is always offline runs to the end of its term. **It goes into the terms of sale.** |
| **Q10** | The dunning messages                         | **Email and in-app only. No SMS.**                                                                                                                                |
| **Q11** | The data requests' retention                 | **Export within 7 days, deletion within 30 days**; the financial records are retained as the law requires (legal hold).                                           |
| **Q12** | The maintenance switch and the announcements | **Yes** — the apps read it from the server; the offline edition shows the last one it received and keeps working.                                                 |
| **Q13** | The feature flags' scope                     | **Global flags with a rollout % first**; a per-workspace override comes later.                                                                                    |
| **Q14** | The plan prices as versions                  | **Yes — a new price never changes an existing subscription.** The limits are separate from the price, and **never reduced during a paid term**.                   |
| **Q15** | The revenue dashboard before the ledger      | **Yes — no revenue numbers until the billing ledger exists.**                                                                                                     |
| **Q16** | The admin app's test runner                  | **vitest.**                                                                                                                                                       |
| **Q17** | Is the landing page going to be CMS-driven?  | **No — the CMS stays out of the menu, and its data is untouched.**                                                                                                |

---
