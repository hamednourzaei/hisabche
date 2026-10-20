# Hisabche — Plans, Entitlement and Offline Licence (prompt for Antigravity)

> Read first: `CLAUDE.md`, `.claude/skills/hisabche-session-rules/SKILL.md`,
> `hisabche-backend`, `hisabche-auth`, `hisabche-migrations`, `hisabche-ui`,
> `hisabche-offline`, and `docs/offline/OFFLINE-EDITION-PROMPT.md` (its
> principles 6–8 and §0.5 agent roles apply here unchanged).
>
> **Do one step per session. Stop after each step with a Persian report
> (files, real command output, a table of real numbers, status label) and wait
> for the owner's «ادامه».** Step 0 changes no code at all.

---

## Why this exists

The owner decided the commercial model (20 Oct 2026):

| Plan          | Price             | What it means                                                                      |
| ------------- | ----------------- | ---------------------------------------------------------------------------------- |
| `FREE`        | 0                 | Trial: a **lifetime** allowance of 50 invoices per workspace (not per month)       |
| `OFFLINE`     | 12,000,000 / year | Windows + Android, local engine, signed licence, no internet needed for daily work |
| `ONLINE_500`  | 30,000,000 / year | Cloud; up to 500 invoices per day                                                  |
| `ONLINE_1000` | 40,000,000 / year | up to 1,000 / day                                                                  |
| `ONLINE_1500` | 45,000,000 / year | up to 1,500 / day                                                                  |

Currency of these prices: **ask the owner in Step 0** (Toman/IRR or AFN?).
`plan-pricing.ts` currently says USD; never guess it.

## The one rule: extend, never add a parallel system

These already exist and are the ONLY places this work goes:

| Concern                          | Existing owner                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Plan price                       | `backend/src/services/plan-pricing.ts` (imports nothing — keep it so)                                       |
| Limits per plan, admin overrides | `plan-limit-defaults.ts` → `plan_limit_settings` → `workspace_limit_overrides` via `plan-limits.service.ts` |
| What a workspace may do          | `backend/src/services/entitlement.service.ts`                                                               |
| Payments, activation             | `backend/src/services/billing.service.ts`, `billing.routes.ts`                                              |
| Plan change                      | `backend/src/services/subscription-upgrade.service.ts`                                                      |
| «Ceiling reached» to the user    | `PLAN_LIMIT_REACHED` (402) + `packages/ui/src/lib/plan-limit-message.ts`                                    |
| Admin screens                    | `apps/admin/app/[lang]/(admin)/subscriptions`, `/workspaces` + `backend/src/routes/admin.routes.ts`         |
| Offline seam already planned     | Phase 9 of `OFFLINE-EDITION-PROMPT.md`: `entitlementOf(capability)` in `packages/ui/src/lib/capability/`    |

No second plan table, no second billing, no `licence.service` that decides
access on its own, no `if (plan === 'offline')` scattered in UI. Every
decision is `can(capability)` answered by the entitlement core.

---

## The extension rule: a future feature is ONE registry row

A feature is built once; who may use it, and where it runs, is data. Adding
«AI cashflow forecast — online only» later must mean: one row in the registry,
one `requireEntitlement('ai.cashflow_forecast')` on its route, one
`useActionAvailability('ai.cashflow_forecast')` at its button — and no edit to
the offline architecture, the local engine, or any plan `if`.

**Three separate axes — never merged into one check:**

| Axis             | Question                                 | Owner (existing → extended)                                                               |
| ---------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| Role permission  | May THIS PERSON do it in this workspace? | `requireCapability` / `CAPABILITIES` in `authorization.domain` + custom roles — unchanged |
| Plan entitlement | Has THIS WORKSPACE paid for it?          | `entitlement.service.ts` → a shared `entitlementOf(feature)`                              |
| Execution mode   | Can it run HERE (device vs server)?      | the registry's `execution` + the Phase-7 `ACTION_REQUIREMENTS` of the offline prompt      |

⚠️ The word «capability» already means role permission in this repo
(`requireCapability`, `/governance/my-capabilities`). The plan axis uses the
word **feature / entitlement** so the two are never confused, and no existing
role check is renamed or loosened.

**The registry** — one file, `packages/validation/src/schemas/feature-registry.ts`
(shared rules already live in `packages/validation`; do NOT create a second
package for it unless Step 0 shows a real dependency reason):

```ts
'invoice.create':        { execution: 'local',  plans: ['FREE','OFFLINE','ONLINE_*'] },
'cloud.sync':            { execution: 'server', plans: ['ONLINE_*'] },
'ai.cashflow_forecast':  { execution: 'server', plans: ['ONLINE_*'] },
'reports.analytics':     { execution: 'hybrid', plans: [...], local: 'basic', server: 'cross-device' },
```

- `execution`: `local` (runs in the local engine), `server` (needs the cloud),
  `hybrid` (a local part and a server part — both named).
- Plan → features mapping lives here (or in `plan-limit-defaults.ts` if Step 0
  finds that is the better existing home); admin overrides per plan and per
  workspace still layer on top through `plan-limits.service`.
- **One resolver** returns, for (workspace state, device mode, feature):
  `AVAILABLE | REQUIRES_ONLINE | NOT_ENTITLED | REQUIRES_UPGRADE(plan) |
EXHAUSTED | EXPIRED` plus the cheapest plan that unlocks it. The backend
  (`requireEntitlement` → `403 FEATURE_NOT_ENTITLED` / `402
PLAN_LIMIT_REACHED`), the local engine, and the UI hook all call it — none
  re-derives the answer.
- Features never import plans: no `plan ===`, `subscription.type`,
  `isOffline` inside a feature (guard test greps for these outside the
  resolver and the billing screens).
- Moving a feature from online-only to offline later = change its row
  (`execution`, `plans`) and implement its local handler; nothing else.

**Guards (Step 1):** every write route carries both a role check and a
`requireEntitlement`; every registry key has fa/af/en labels; every key used
by a route, hook or button exists in the registry; a test adds a fake
online-only feature and proves it is refused offline, refused on FREE, allowed
on ONLINE, with the right reason — without touching any other file.

---

## Step 0 — Production contract (documents only, NO code)

Write `docs/offline/entitlement/00-CONTRACT.md`. It must answer, with the
existing file each answer extends:

1. **States and lifecycle.** `FREE`, `FREE_EXHAUSTED`, `OFFLINE_ACTIVE`,
   `OFFLINE_EXPIRED`, `ONLINE_ACTIVE`, `ONLINE_PAST_DUE`, `ONLINE_EXPIRED`.
   A table of every allowed transition and what triggers it (payment, expiry,
   admin action, refund, upgrade). Forward-only where money is involved.
2. **Capability matrix** per state: create/edit/cancel invoice, payments,
   inventory moves, read, print, backup, **export (always allowed)**, import,
   cloud sync, multi-device, AI, OCR, bank import, team members. Expired and
   exhausted states: operational writes locked; read, print, backup and export
   **always available** (principle 6 — data is never held hostage).
3. **Usage Policy — what counts as one invoice** (ONE definition, a pure
   function in `packages/validation`, imported by the backend AND the local
   engine). Propose, owner confirms:
   - counts: a sale or purchase invoice that was **created** (any final status);
   - cancelling or deleting it does **not** give the slot back (otherwise
     create→delete loops bypass the trial);
   - does not count: drafts that were never finalised, quotations, late-fee
     invoices generated by the system, invoices brought in by **file import**
     (import must not burn the trial — say if the owner disagrees);
   - returns: count as one document (owner confirms).
     The counter is derived from rows with `count: 'exact', head: true`, never a
     cached number, and checked **inside** `InvoiceService.create` (server) and
     the local engine's create handler — the UI lock is display only.
4. **Daily ceiling for ONLINE\_*:** the «day» is the workspace's local day
   (`utils/local-day.ts`), counted the same way; over the ceiling →
   `PLAN_LIMIT_REACHED` with `feature: 'invoices_daily'`. Never applies to
   OFFLINE.
5. **Signed offline licence.** Payload fields (`license_id`, `workspace_id`,
   `account_id`, `plan`, `issued_at`, `expires_at`, `device_id`, `features`,
   `version`), signature Ed25519. **The private key lives only in the server's
   secret store** — never in the repo, Electron, Android, a build artifact, a
   log, or an env file committed anywhere. The public key ships in the apps.
   Verification is offline. **No forced periodic check-in**: an annual licence
   works without internet for its whole term. `last_verified_at` is recorded
   whenever the device happens to be online.
6. **Device binding.** `device_id` = a random id created at first activation
   and stored in the app's private storage. TPM (Windows) / Android Keystore is
   an **optional hardening layer**, never a condition — a device without it
   still activates. Moving to a new device = the owner releases the old one
   from the web panel (or the admin does); no hardware lock-out.
7. **Expiry behaviour.** Offline licence past `expires_at`: local engine
   refuses new operational writes with a clear message; everything readable,
   printable, exportable. Clock tampering: record the highest time ever seen
   on the device; a clock moved backwards does not extend the licence.
8. **Upgrade OFFLINE → ONLINE with credit.** Credit = amount **actually paid**
   (from `billing`, not from the plan name) × unused days / term days, rounded
   by the currency rule. Show the breakdown before payment. The local data
   moves to the cloud only through the safe-migration phase (Phase 8) — the
   contract says what happens to the device data, nothing is lost.
9. **Login on Windows / Android for each state** (the owner's flow):
   welcome → login/register → new user? choose **Free (50) / Online / Offline**
   → Free starts the trial; Online/Offline go to `/billing`. An account whose
   subscription is OFFLINE logging in on a device sees «حساب شما روی نسخه‌ی
   آفلاین است — ادامه با نسخه‌ی آفلاین؟» with **[ادامه]** and
   **[ارتقا به آنلاین]**. On the **web**, an OFFLINE account sees only the
   portal: licence status, devices, billing, upgrade, and **export**.
   A device that was used on the free trial and whose account became OFFLINE:
   the cloud session ends; the user continues in the local edition (data
   transfer rules from item 8).
10. **Landing page.** Above the pricing section, two boxes **آنلاین** /
    **آفلاین**; choosing one shows that edition's tariffs. Every number on the
    page comes from `plan-pricing.ts` (guard: `landing-claims.test.ts` — a
    claim without code behind it is forbidden).
11. **Admin panel** (see Step 4).
12. **Threat model, honestly.** Online limits cannot be bypassed (server
    decides). Offline: a forged licence is impossible without the private key;
    a patched app binary is possible on any client software — state it, and
    list what a patched copy loses (updates, cloud backup, exchange-rate feed,
    AI/OCR, upgrade, support).
13. **Migrations needed** (names only, additive), and every i18n key family.
14. **Feature registry, first version:** every feature of today's product as
    a row (execution + plans), taken from `docs/offline/01-CAPABILITY-MATRIX.md`
    (L/C classes) — and a worked example of adding one online-only feature
    end to end, listing exactly which files change (target: registry row,
    route guard, button hook, i18n — nothing in the offline architecture).

Stop. The owner approves the contract before Step 1.

---

## Step 1 — Core (backend + validation)

- Plans and prices in `plan-pricing.ts`; limits in `plan-limit-defaults.ts`
  (`free.invoices = 50` lifetime, `ONLINE_*.invoicesDaily`), admin overrides
  still win.
- `entitlement.service.ts` answers `can(workspace, capability)` from the
  state machine; `requireCapability` / `holds()` reuse it.
- The usage policy function in `packages/validation`; the backend counter in
  `InvoiceService.create` (and every other path that creates an invoice:
  recurring, AI pipeline, late fee, migration import — each checked against
  the policy, not skipped).
- `docs/entitlement-01-migration.sql` + `VERIFY-entitlement-01.sql` +
  `entitlement-01.pg.test.ts` (run twice on real Postgres; `REVOKE ALL` first,
  per CLAUDE.md). **Do not run it on Supabase** — the owner runs it.
- Tests with **two currencies** and the boundary exactly at 50 and at 500
  (`<`, not `<=`, is decided in the contract and tested both sides).
  Injection-test every guard.

## Step 2 — Signed licence (server issues, apps verify)

- Issue: `POST /api/billing/offline-license` (authenticated, workspace
  context, plan OFFLINE active) signs with the server key read from the secret
  store. If the key is not configured → `503 LICENSE_SIGNING_NOT_CONFIGURED`,
  never a fallback key. Status: `BLOCKED_EXTERNAL_CREDENTIAL` until the owner
  sets it.
- Verify: one function in `packages/validation` (public key + payload →
  verdict), used by the local engine and both hosts.
- Device activation / release endpoints; release from the web portal.
- Tests: valid, expired, wrong workspace, wrong device, tampered byte,
  clock moved back, missing hardware key (still activates).

## Step 3 — User side (web + Windows + Android, one shared UI)

- First-run choice after login (Free / Online / Offline) — reuse the existing
  onboarding and `/billing` screens; no second billing page.
- Lock screen when exhausted/expired: the message
  «اطلاعات کسب‌وکار شما محفوظ است و حذف نشده است. برای ادامه‌ی فعالیت یکی از
  اشتراک‌های حسابچه را انتخاب کنید.» with links to read/export and to
  `/billing`. Writes refused by the server show `planLimitMessage`.
- OFFLINE account on a device: the «continue offline / upgrade» prompt.
  OFFLINE account on the web: portal only (licence, devices, billing,
  upgrade, export).
- Upgrade screen with the credit breakdown from the server.
- Landing: online/offline boxes above pricing, numbers from `plan-pricing.ts`.
- Every new key in fa, af, en. No hard-coded currency, no hard-coded Persian.

## Step 4 — Admin panel (`apps/admin`)

Extend `subscriptions` and `workspaces`; do not add a parallel section.

- See each workspace's state, plan, expiry, invoices used (trial and today),
  devices and licences.
- Actions, each with a reason, written to `audit_logs` (with `created_at`
  set explicitly — the live column has no default): change plan, extend
  expiry, grant extra trial invoices (an override in
  `workspace_limit_overrides`, not an edited counter), revoke a licence,
  release a device, record a manual payment / refund, issue upgrade credit.
- Edit plan prices and limits (writes the same settings the core reads).
- Every admin route behind `platformAdminGuard`; every `.eq('id')` also
  scoped; tests for a non-admin getting 403.

## Step 5 — Gate and builds

- Full suites one at a time (backend, ui, validation, local-engine, api,
  admin, desktop jest, mobile jest), tsc everywhere, eslint 0 on changed files.
- Real HTTP: trial exhausted at 50 → 402; export still 200; ONLINE_500 at
  invoice 500 of the day → 402; offline licence tampered → refused.
- Windows + Android builds (commands in the offline prompt), then a numbered
  hand checklist for the owner.

**Never:** commit/push, DDL on live Supabase, any key or secret in code or
chat, `any`/`eslint-disable`, a lock that hides the user's own data, a UI-only
limit, or a number on the landing page that the code does not enforce.
