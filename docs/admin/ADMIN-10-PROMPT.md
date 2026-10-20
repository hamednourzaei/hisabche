# Hisabche Admin Panel → 10/10 (prompt for Antigravity)

> Read first: `CLAUDE.md`, `.claude/skills/hisabche-session-rules/SKILL.md`,
> `hisabche-ui`, `hisabche-auth`, `hisabche-backend`, `hisabche-migrations`,
> `hisabche-ux-consolidation`, and `docs/offline/ENTITLEMENT-PROMPT.md`
> (plans FREE / OFFLINE / ONLINE_500 / ONLINE_1000 / ONLINE_1500, the feature
> registry, the signed licence). This prompt is the admin half of that work.
>
> **One step per session. After each step: Persian report (files, real command
> output, table of real numbers, status label) and wait for «ادامه».**
> No commit/push. No DDL on live Supabase (migration + VERIFY in `docs/`, the
> owner runs them). No `any`, `eslint-disable`, dead code, UI theater, or
> hard-coded text/currency. No secret ever shown, logged or put in code.

---

## A. The three laws

1. **Admin is a control plane, not a second brain.**
   `Admin UI → /api/admin/* → existing services → DB`. Every admin action
   calls the SAME service the product uses (`billing.service`,
   `subscription-upgrade.service`, `entitlement.service`,
   `plan-limits.service`, `plan-pricing`, wallet, market, oauth, ai). No admin
   route writes a business table directly, no admin-only plan table, no copy
   of a rule. Subscription ≠ Entitlement ≠ Licence ≠ Device ≠ Session ≠ Usage:
   separate concepts, separate tables/services, never merged.
2. **shadcn/ui only, from ONE place.** Every component comes from
   `@hisabche/ui` (re-exported by `apps/admin/components/ui/index.ts`).
   Available today in `packages/ui/src/components/ui`: accordion, badge,
   breadcrumb, button, card, chart, dialog, dropdown-menu, input, label,
   progress, select, sheet, skeleton, sonner, switch, table, tabs, toast,
   tooltip, plus the shared `DataTable`. A primitive that is missing
   (alert-dialog, command, popover, checkbox, textarea, form, avatar,
   separator, scroll-area, hover-card, calendar, radio-group, toggle-group)
   is added ONCE to `packages/ui` with the standard shadcn source (Radix),
   tokens only (`hsl(var(--…))`), RTL logical classes — never inside
   `apps/admin`, never a hand-drawn look-alike. Every list = `DataTable`
   (cards under 768px, built-in pager). Every dropdown = `SelectField`.
   Destructive or money action = `AlertDialog`. Detail = `Sheet` (side
   drawer) with `Tabs`. Toasts = `sonner`. Charts = `chart` (Recharts wrapper).
   The current hand-made `Panel`/`FilterPill`/`Pagination` in
   `admin-ui.tsx` are migrated to these and then deleted (no two systems).
3. **Few pages, deep drawers.** The menu grows from 11 to at most 8 groups
   (below); most new things are a tab inside an existing page or a tab of the
   Workspace 360 drawer. No page that only links elsewhere.

## B. Navigation (target)

```
داشبورد
مشتریان        → کسب‌وکارها · کاربران · دستگاه‌ها · نشست‌های پشتیبانی
درآمد          → پلن‌ها و قیمت · اشتراک‌ها · پرداخت‌ها و دفتر · درخواست‌های ارتقا · کیف پول
آفلاین          → لایسنس‌ها · ناوگان دستگاه · انتقال به آنلاین · تطبیق
محصول          → فیچرها (رجیستری + Feature Flag) · هوش مصنوعی · اپ‌های OAuth · بازار
عملیات          → سلامت سیستم · سرورها · کارها (import/export/migration jobs)
محتوا          → وبلاگ · CMS   (CMS joins the menu or is deleted — decide in Step 0)
امنیت          → لاگ ممیزی · نقش‌های ادمین · نشست‌های ادمین · رویدادهای امنیتی
```

Each group is ONE route with `HubTabs` (`?tab=`), per the hub rule in
CLAUDE.md §0.6; old URLs (`/subscriptions`, `/wallet`, …) redirect to their
tab. fa, af AND en (admin currently has only fa/en — add af).

---

## C. What the panel gets (owner's list, P0 → P2)

**P0 — before selling**

1. **Workspace 360** — `Sheet` from any workspace row/search hit, tabs:
   overview (plan, state, expiry, trial `37/50`, today `438/500`, lifetime
   invoices), members, subscription & history, effective entitlements,
   usage, devices, offline licences, billing ledger, upgrade/migration,
   imports/exports, sync health, security events, notes, audit.
2. **Plan catalog** — FREE, OFFLINE, ONLINE_*: identity, billing period,
   features (from the registry), limits, device policy, usage policy,
   upgrade/downgrade/migration policy. Edits write the settings the core
   reads — nothing admin-only.
3. **Price versioning** — price, currency, period, `effective_from/until`.
   A new price never changes an existing subscription: the subscription
   stores the price version it was sold at.
4. **Subscription lifecycle** — states TRIAL, PENDING, ACTIVE, PAST_DUE,
   SUSPENDED, CANCELLED, EXPIRED; money fields list price, discount, agreed,
   paid, credit, refund, upgrade credit, due, currency; history of every
   transition with actor + reason + time. Transitions only through the
   service's state machine.
5. **Effective entitlements with SOURCE** — per feature: allowed/denied and
   why (`plan`, `workspace override`, `admin grant`, `not in plan`,
   `requires online`, `exhausted`, `expired`). Read from the one resolver.
6. **Offline licences** — id, plan, device, issued, expires, last seen,
   status, signature/key version. Actions: revoke, reissue, release device,
   transfer, suspend, reactivate. **Revoke never deletes local data.**
7. **Devices** — separate from licences and sessions: OS, app version,
   first activated, last seen, licence, status. Actions: revoke session /
   revoke licence / release device — three different buttons, three
   different effects.
8. **Usage** — trial `x/50`, online daily `x/500` with peak/average/days over
   limit, AI, storage, API, devices. Offline usage is labelled «last report
   from device at …», never shown as live.
9. **Billing ledger** — purchase, upgrade, downgrade, credit, refund, manual
   adjustment, payment; each traceable to the subscription and the payment.
   Wallet stays the top-up queue; the ledger is the record.
10. **Upgrade / migration center** — OFFLINE → ONLINE as a state machine
    (REQUESTED → BACKUP_CREATED → PREVIEWED → UPLOADING → RECONCILING →
    COMPLETED | FAILED | ROLLED_BACK). No one-click «make online».
11. **Reconciliation** — read-only: invoices, receivables per currency,
    stock per product×warehouse, ledger totals, device vs cloud,
    MATCHED/MISMATCH with the exact difference. Never «fixes» anything.
12. **Admin RBAC** — roles SUPER, BILLING, SUPPORT, CONTENT, MARKET, OPS,
    SECURITY; every `/api/admin/*` route declares the permission it needs
    (server-side, like `requireCapability`); the menu hides what the role
    cannot open, and the server refuses it anyway. Replaces the email
    allowlist as the source of truth (the allowlist stays as an outer fence).
13. **Admin MFA mandatory** (TOTP via Supabase MFA), enforced in `proxy.ts`
    AND by the backend guard (AAL2), not just a screen.
14. **Immutable audit for money and access** — before/after, actor, reason,
    target, IP, request id, correlation id; append-only by trigger.
15. **Support session** — «View as customer»: reason required, expires,
    read-only by default, write needs a separate permission and is audited;
    never the customer's password; the customer can see that it happened.

**P1** — feature flags (separate from entitlement: rollout %, platform,
country, beta), offline fleet health, full system health (API, Postgres,
realtime, storage, queue, payments, AI, email, OAuth, sync, migration),
import/export/migration jobs, security center, full user management
(suspend, reactivate, revoke sessions, reset MFA, force sign-out — never an
admin-set password).

**P2** — revenue, cohort/LTV/churn, fraud signals, advanced dashboards.

---

## D. Ten things the list above still misses (added by Claude)

1. **Maker–checker (two-person rule)** for refunds, manual wallet/ledger
   adjustments, price changes, plan downgrades and licence transfers: one
   admin proposes, a different admin approves; the same person can never do
   both (checked on the server). Pattern already exists for MCP/AI actions
   (`ai_action_requests`) — reuse the shape, not a third approval system.
2. **Step-up re-authentication** — even with an MFA session, money and
   security actions ask for a fresh TOTP code (≤ 5 minutes old).
3. **Preview + diff before apply, idempotent apply** — every admin write shows
   «before → after» (plan, entitlements that change, amount due) in the
   `AlertDialog`, and sends an `Idempotency-Key`; a double click is one action.
4. **Trial-abuse detection** — the same phone, email domain pattern, device
   id or payment card creating many FREE workspaces to farm 50-invoice
   trials: a list with the linked accounts, and an action to merge the trial
   allowance. Signals only; never auto-ban.
5. **Licence signing-key rotation and revocation list** — key versions
   (public key id inside each licence), rotate without breaking issued
   licences, and a signed revocation list that devices pick up whenever they
   are online. The private key is never displayed; the panel shows only its
   id, creation time and status.
6. **Dunning and customer communications log** — renewal reminders before
   expiry, past-due notices, grace period status; every email/SMS/in-app
   message sent to a workspace listed with time and result (through the
   existing email outbox — no second sender).
7. **Internal notes and timeline per workspace** — admin-only notes, tags
   (VIP, reseller, at-risk), and a single timeline merging subscription,
   payment, licence, support-session and audit events.
8. **Command palette (⌘K / Ctrl+K)** with shadcn `Command`: search
   workspaces, users, phone, invoice-licence id, payment reference; open
   the 360 drawer directly.
9. **Announcements and maintenance mode** — a banner or in-app message
   targeted by plan/edition/platform/locale, scheduled start/end, and a
   maintenance switch that the apps show honestly (offline edition keeps
   working; it is told, not blocked).
10. **Customer data requests** — export-on-request and account-deletion
    requests as a queue with SLA, legal hold, and retention rules; deletion is
    retire-and-anonymise per the repo's «no compensating DELETE» rule, and an
    expired customer's export is always allowed (principle 6).

Also: admin tables export to CSV through the shared `buildCsvZip`, and every
admin export is itself audited.

---

## E. Steps

**Step 0 — contract and map (documents only, NO code).**
`docs/admin/00-ADMIN-CONTRACT.md`: for every item in C and D — which
existing service/table it extends, which new table (additive) it needs, the
admin permission it requires, the shadcn components it uses, the page/tab/
drawer it lives in, and its API. List the shadcn primitives to add to
`packages/ui`. Decide CMS (menu or delete). Ask the owner every open question.
Stop.

**Step 1 — foundation:** shadcn primitives in `packages/ui`; migrate
`admin-ui.tsx` lists to `DataTable` and delete the hand-made ones; hub
routes + redirects; af locale; admin RBAC + MFA + step-up + immutable audit
(migration + VERIFY + `*.pg.test.ts` run twice; `REVOKE ALL` first).

**Step 2 — monetization:** plan catalog, price versioning, subscription
lifecycle, entitlements with source, usage, billing ledger, maker–checker,
preview/diff, dunning log.

**Step 3 — offline:** licences, devices, key rotation + revocation list,
fleet health, migration center, reconciliation.

**Step 4 — customers & support:** Workspace 360, user management, support
session, notes/timeline, command palette, trial-abuse signals, data requests.

**Step 5 — product & ops:** feature flags, system health, jobs,
announcements/maintenance, security center.

**Step 6 — gate:** full suites one at a time (backend, ui, admin, api,
validation), tsc everywhere, eslint 0 on changed files, `next build` for
admin. Real HTTP: a BILLING admin gets 403 on `/api/admin/servers/*`; a
refund by its proposer is refused; an action without fresh TOTP is refused;
an audit row cannot be updated or deleted. Screenshots of every page in
light/dark, fa/af/en, desktop and 375px.

**Every admin route:** `platformAdminGuard` + its RBAC permission, every
`.eq('id')` also scoped, a non-admin → 403 test, a wrong-role → 403 test.
