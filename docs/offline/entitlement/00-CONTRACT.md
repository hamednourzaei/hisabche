# Entitlement Contract — Plans, Features and the Offline Licence

> Offline Edition, gate 9 (Step 0). **Document only — no code in this step.**
> Programme: `docs/offline/ENTITLEMENT-PROMPT.md` (the owner's ten-step prompt).
> Earlier gates: `docs/offline/gates/1.md` … `docs/offline/gates/5.md`.
> This document is the contract the owner approves before Step 1 writes a line.
>
> Every answer below names the file it EXTENDS. Nothing here introduces a
> second plan table, a second billing path, or a second permission system.

---

## 0. The shape of the whole thing

### 0.1 Three axes, never merged

| Axis                 | Question                                  | Owner (existing → extended)                                                                                                                                                                                                       |
| -------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Role permission**  | May THIS PERSON do it, in this workspace? | `backend/src/services/authorization/authorization.domain.ts` (`CAPABILITIES`, `can`, `holds`) + `backend/src/middleware/authorize.middleware.ts` (`requireCapability` → 403 `CAPABILITY_REQUIRED`) + custom roles — **unchanged** |
| **Plan entitlement** | Has THIS WORKSPACE paid for it?           | `backend/src/services/entitlement.service.ts` (`Entitlements`, `canPerformAction`, `ActionResult`) → extended by a shared resolver over the feature registry                                                                      |
| **Execution mode**   | Can it run HERE (device vs server)?       | the registry's `execution` column + the offline prompt's Phase-7 action requirements                                                                                                                                              |

⚠️ **The word «capability» already means role permission in this repository**
(`requireCapability`, `holds`, `/governance/my-capabilities`,
`packages/ui/src/lib/authorization-message.ts`). The plan axis is therefore
called **feature / entitlement** everywhere. No existing role check is
renamed, and no role check is loosened by anything in this document.

⚠️ **`entitlement.service.ts` is not a state machine today.** It is a
plan → flags table (`canUseAI`, `canExportPDF`, `canCreateTeam`, `canUseSSO`,
`canManageUsers`, `canViewReports`, `canExportData`, `maxUsers`,
`maxWorkspaces`, `maxInvoices`) with a trial override
(`getFullEntitlements()`), and `canPerformAction(ctx, action)` over five
actions. **The seven states of §1 do not exist in the code** — they are what
this contract adds, derived from what is already there.

### 0.2 The registry — one file, one row per feature

`packages/validation/src/schemas/feature-registry.ts` (new; shared rules live
in `packages/validation` — no second package).

```ts
'invoice.create':        { execution: 'local',  plans: ['FREE','OFFLINE','ONLINE_*'] },
'cloud.sync':            { execution: 'server', plans: ['ONLINE_*'] },
'ai.cashflow_forecast':  { execution: 'server', plans: ['ONLINE_*'] },
'reports.analytics':     { execution: 'hybrid', plans: [...], local: 'basic', server: 'cross-device' },
```

- `execution`: `local` (the local engine runs it), `server` (the cloud runs
  it), `hybrid` (a local part and a server part, both named).
- **Plan → feature** mapping lives in the registry. Admin overrides per plan
  and per workspace still layer on top through `plan-limits.service.ts`.
- A feature row never imports a plan constant and never reads
  `subscription.type` or `isOffline` — the registry is DATA; the resolver is
  the only place a plan is compared.

### 0.3 One resolver, three callers

One pure function answers, for (workspace state, device mode, feature):

```
AVAILABLE | REQUIRES_ONLINE | NOT_ENTITLED | REQUIRES_UPGRADE(plan) | EXHAUSTED | EXPIRED
```

plus **the cheapest plan that unlocks the feature** — the first plan in the
row's `plans` list that includes the feature, so the registry lists them
cheapest-first. It is called by:

| Caller           | File                                                                      | What it does with the verdict                                                                       |
| ---------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| The server       | `backend/src/services/entitlement.service.ts` (extended)                  | `requireEntitlement(feature)` on the route → `403 FEATURE_NOT_ENTITLED` or `402 PLAN_LIMIT_REACHED` |
| The local engine | `packages/local-engine` (the same shared function)                        | refuses the write with the same verdict vocabulary                                                  |
| The UI           | `packages/ui/src/lib/capability/` (the Phase-7/9 seam, **not built yet**) | `useActionAvailability(feature)` at the button — **display only**                                   |

None of the three re-derives the answer. A fourth copy is a bug.

⚠️ **Two things the resolver needs that the service does not have today:**

1. **The state must be derived per WORKSPACE.** `entitlement.service.ts` reads
   the subscription by **user** (`getCurrentSubscription(userId)`), and
   `getEntitlements(userId)` is cached per user. A plan belongs to a
   workspace (`subscriptions.workspace_id` is `NOT NULL`), and one person can
   be in several workspaces with different plans. The resolver therefore
   takes the **workspace**, and the user-keyed cache is not enough.
2. **The plan names change.** Today the code knows three plans —
   `planEnum` (`packages/validation/src/schemas/billing.schema.ts`) and the
   `CHECK (plan IN ('free','pro','enterprise'))` on `plan_limit_settings`
   agree on `free | pro | enterprise`. The owner's commercial model
   (`FREE`, `OFFLINE`, `ONLINE_500`, `ONLINE_1000`, `ONLINE_1500`) is a
   **different set**, so the enum, the CHECK, `PLAN_PRICING`,
   `plan-limit-defaults.ts`, `PLANS` in `billing.service.ts` and the admin
   panel's plan list all move together (§13.1).

### 0.3.1 The limits today: three copies, one truth

| Copy                      | Where                                                                                                            | Today                                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **The authoritative one** | `plan-limit-defaults.ts` → `plan_limit_settings` → `workspace_limit_overrides`, read by `plan-limits.service.ts` | `free: { invoices: 10, users: 1, aiMonthly: 20 }`, `pro`/`enterprise`: `null` (unlimited). Keys: `invoices`, `users`, `aiMonthly` |
| A hardcoded copy          | `entitlement.service.ts` (`maxInvoices: 10 / null / null`)                                                       | drifts from the settings                                                                                                          |
| A third copy              | `PLANS[plan].limits` in `billing.service.ts`                                                                     | reconciled only inside `getUsageReport`                                                                                           |

**Step 1 makes the first one the only truth.** The other two are derived from
it or deleted — a second place that decides a ceiling is a second ceiling.

⚠️ **`invoicesDaily` does not exist.** `LIMIT_KEYS` is `invoices | users |
aiMonthly` and `EnforcedLimit` is `invoices | users`. The daily ceiling of §4
is a **new limit key** in the same jsonb (no DDL needed for the value
itself — but the `plan` CHECK of the table does need extending, §13.1).

⚠️ **A trial is never limited today**: `assertWithinLimit` returns
immediately when `subscriptions.is_trial` is true. The owner's `FREE` is a
**plan** with a 50-invoice lifetime cap, not a time-boxed trial, so it must
not carry `is_trial` — otherwise the cap is not enforced. The 7-day
`is_trial` pro trial (`TRIAL_DAYS`) is a different thing and keeps its
bypass.

### 0.4 The extension rule, as a procedure

Adding a feature that only the cloud may use means, in total:

1. **one row** in `packages/validation/src/schemas/feature-registry.ts`;
2. **one guard** on its route: `requireEntitlement('ai.cashflow_forecast')`
   (beside the existing role guard — a write route always carries both);
3. **one hook** at its button: `useActionAvailability('ai.cashflow_forecast')`;
4. **one label per language** (fa/af/en) for the feature id.

**Nothing in the offline architecture, the local engine, the sync engine or
any `plan ===` branch is touched.** §14.3 walks one through, file by file.

### 0.5 Guards that keep it that way (Step 1)

| Guard                                                                                              | What it forbids                                                                                                              |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Two guards on every write route**                                                                | a write route with a role check but no entitlement check, or the reverse                                                     |
| **No `plan ===` / `subscription.type` / `isOffline` outside the resolver and the billing screens** | a plan comparison smuggled into a feature                                                                                    |
| **Every registry key used by a route, hook or button exists in the registry**                      | a typo'd feature id silently allowing everything                                                                             |
| **Every registry key has fa/af/en labels**                                                         | a feature with no name in one language                                                                                       |
| **A test with a fake online-only feature**                                                         | proves the whole path (offline refused, FREE refused, ONLINE allowed, with the right reason) without touching any other file |

---

## 1. States and lifecycle

### 1.1 The seven states

| State             | Meaning                                             | Where it comes from (today's columns)                                                                    |
| ----------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `FREE`            | Cloud trial: 50 invoices **lifetime** per workspace | a `subscriptions` row on the `FREE` plan (today: no row, or a `free` plan) — **not** `is_trial` (§0.3.1) |
| `FREE_EXHAUSTED`  | The 50 invoices are used                            | the counter, derived from rows — never a stored number                                                   |
| `OFFLINE_ACTIVE`  | The local edition, signed licence valid             | a signed licence on the device, `expires_at` in the future                                               |
| `OFFLINE_EXPIRED` | The licence term is over                            | `expires_at` passed, or the licence was revoked by an admin                                              |
| `ONLINE_ACTIVE`   | The cloud, plan paid, within the daily ceiling      | `subscriptions.status = 'active'` + the daily counter                                                    |
| `ONLINE_PAST_DUE` | The payment failed; a grace period is running       | `subscriptions.status = 'past_due'` (the enum already has it)                                            |
| `ONLINE_EXPIRED`  | The subscription is over                            | `status = 'expired'                                                                                      | 'cancelled'`, or `period_end`passed —`isSubscriptionExpired()`in`billing.service.ts` is the one definition of expiry and stays the one |

The state is **derived**, never stored twice: the subscription row, the
licence on the device, the invoice counter and the workspace's local day
decide it. `backend/src/services/entitlement.service.ts` is where that
derivation lives today; this contract adds the states it does not have.

⚠️ **No new state column is needed on the server.** `subscriptions` already
carries `plan`, `status`, `period_start`, `period_end`, `is_trial`,
`trial_used`, `workspace_id` — everything `FREE` / `ONLINE_*` need. What is
missing is a place for the **offline licence** and for the **device**
(§5, §6) — that is the migration of §13.1.

### 1.2 Allowed transitions

| From              | To                | Trigger                                                                                                                                                                                           | Forward-only?                                                |
| ----------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| —                 | `FREE`            | A new workspace, or a signup that chose the free trial                                                                                                                                            | —                                                            |
| `FREE`            | `FREE_EXHAUSTED`  | The 50th invoice was created (the counter is derived, so this happens at creation time)                                                                                                           | yes (the trial is not given back)                            |
| `FREE_EXHAUSTED`  | `ONLINE_ACTIVE`   | A payment for an `ONLINE_*` plan                                                                                                                                                                  | yes (money in)                                               |
| `FREE_EXHAUSTED`  | `OFFLINE_ACTIVE`  | A payment for the `OFFLINE` plan + a licence issued and activated                                                                                                                                 | yes (money in)                                               |
| `FREE`            | `ONLINE_ACTIVE`   | A payment for an `ONLINE_*` plan                                                                                                                                                                  | yes                                                          |
| `FREE`            | `OFFLINE_ACTIVE`  | A payment for the `OFFLINE` plan + licence activation                                                                                                                                             | yes                                                          |
| `ONLINE_ACTIVE`   | `ONLINE_PAST_DUE` | A renewal payment failed, or was not made by the due date                                                                                                                                         | yes                                                          |
| `ONLINE_PAST_DUE` | `ONLINE_ACTIVE`   | The outstanding payment arrived                                                                                                                                                                   | yes (money in)                                               |
| `ONLINE_PAST_DUE` | `ONLINE_EXPIRED`  | The grace period ended                                                                                                                                                                            | yes                                                          |
| `ONLINE_ACTIVE`   | `ONLINE_EXPIRED`  | The term ended, or a refund closed the subscription                                                                                                                                               | yes                                                          |
| `ONLINE_EXPIRED`  | `ONLINE_ACTIVE`   | A new payment (a renewal)                                                                                                                                                                         | yes (money in) — the data is never touched by the transition |
| `ONLINE_ACTIVE`   | `OFFLINE_ACTIVE`  | A downgrade to the offline edition: the cloud subscription is closed, a licence is issued, unused time becomes credit (§8)                                                                        | yes (the old period ends)                                    |
| `OFFLINE_ACTIVE`  | `OFFLINE_EXPIRED` | `expires_at` passed, or an admin revoked the licence                                                                                                                                              | yes                                                          |
| `OFFLINE_EXPIRED` | `OFFLINE_ACTIVE`  | A renewal: a new licence is issued and activated                                                                                                                                                  | yes (money in)                                               |
| `OFFLINE_EXPIRED` | `ONLINE_ACTIVE`   | An upgrade to the cloud, with the credit of §8                                                                                                                                                    | yes (money in)                                               |
| any               | any               | An **admin action** (change plan, extend expiry, revoke licence, release device, manual payment/refund) — every one of them is written to `audit_logs` with a reason and an explicit `created_at` | yes (money in)                                               |

⚠️ **No transition ever destroys data.** A plan ending locks the _writes_; the
books stay readable, printable and exportable (principle 6 of the offline
prompt). There is no transition that deletes, hides or freezes anything the
person owns.

---

## 2. What each state may do

The columns are the states of §1.1; the rows are the features. `✓` = allowed,
`✗` = refused, and the refusal always carries a **reason** and, where one
exists, **the cheapest plan that unlocks it** (§0.3).

| Feature                                            | FREE       | FREE_EXHAUSTED | OFFLINE_ACTIVE | OFFLINE_EXPIRED | ONLINE_ACTIVE             | ONLINE_PAST_DUE | ONLINE_EXPIRED |
| -------------------------------------------------- | ---------- | -------------- | -------------- | --------------- | ------------------------- | --------------- | -------------- |
| read every screen                                  | ✓          | ✓              | ✓              | ✓               | ✓                         | ✓               | ✓              |
| print an invoice / receipt                         | ✓          | ✓              | ✓              | ✓               | ✓                         | ✓               | ✓              |
| backup (JSON / xlsx / csv-zip)                     | ✓          | ✓              | ✓              | ✓               | ✓                         | ✓               | ✓              |
| **export own data**                                | ✓          | ✓              | ✓              | ✓               | ✓                         | ✓               | ✓              |
| create invoice                                     | ✓ until 50 | ✗              | ✓              | ✗               | ✓ until the daily ceiling | ✓               | ✗              |
| edit invoice                                       | ✓          | ✗              | ✓              | ✗               | ✓                         | ✓               | ✗              |
| cancel invoice                                     | ✓          | ✗              | ✓              | ✗               | ✓                         | ✓               | ✗              |
| record / cancel payment                            | ✓          | ✗              | ✓              | ✗               | ✓                         | ✓               | ✗              |
| inventory move (sale, purchase, transfer, count)   | ✓          | ✗              | ✓              | ✗               | ✓                         | ✓               | ✗              |
| import from file (customers, products, invoices)   | ✓          | ✓              | ✓              | ✗               | ✓                         | ✓               | ✗              |
| cloud sync (device ⇄ cloud)                        | ✓          | ✓              | ✗              | ✗               | ✓                         | ✓               | ✗              |
| multi-device (same books on two devices)           | ✓          | ✓              | ✗              | ✗               | ✓                         | ✓               | ✗              |
| manufacturing (BOM, produce, report)               | ✓          | ✓              | ✗              | ✗               | ✓                         | ✓               | ✗              |
| approvals / workflows on a document                | ✓          | ✓              | ✗              | ✗               | ✓                         | ✓               | ✗              |
| governance (permissions, members, devices)         | ✓          | ✓              | ✗              | ✗               | ✓                         | ✓               | ✗              |
| customer documents, portal links, business stamp   | ✓          | ✓              | ✗              | ✗               | ✓                         | ✓               | ✗              |
| recurring invoice, period lock, peer benchmark     | ✓          | ✓              | ✗              | ✗               | ✓                         | ✓               | ✗              |
| storefront / marketplace / developer keys          | ✓          | ✓              | ✗              | ✗               | ✓                         | ✓               | ✗              |
| **AI (insight card, assistant, forecast) and OCR** | ✗          | ✗              | ✗              | ✗               | ✓                         | ✓               | ✗              |

The table is **derived from the registry** (§14.2), not written beside it: one
source of truth, and the matrix in this section is what the registry's rows
mean for a workspace in each state. The rules behind it:

- **`FREE` is the cloud trial**: everything the cloud can run is available;
  the only limit is 50 invoices for the life of the workspace. **The owner
  decided (20 Oct 2026): the trial also gets AI and OCR**, inside the
  existing small quota (`aiMonthly: 20`) — past that quota they are refused
  like any other limit.
- **`OFFLINE` is the local edition**: the features the local engine
  implements are available; the `C` features are refused with
  `REQUIRES_ONLINE` — not hidden, and their data is not taken away.
- **The expired and exhausted states** lock the operational writes and keep
  reading, printing, backup and export working (principle 6 — the data is
  never held hostage).

⚠️ **Two rows in that table are a CHANGE to today's code, and they are
principle 6, not a nicety:**

- `entitlement.service.ts` gives the `free` plan
  `canExportData: false` and `canExportPDF: false` today. **Export of the
  workspace's own data, and printing an invoice, must be available in every
  state** — including `FREE_EXHAUSTED` and every expired state. Step 1
  changes those two flags; the guard tests it.
- `planLimitMessage` (`packages/ui/src/lib/plan-limit-message.ts`) knows only
  two features (`invoices`, `users`) and collapses **everything else** into
  the invoices sentence. The daily ceiling of §4 needs a third
  (`invoices_daily`), and the helper must also read the **normalised**
  `ApiError` (`error.limit.feature`) — today it reads the raw server body
  while the API client hands it `error.limit = { feature, limit, used }`. Both
  are fixed in Step 1, because a wrong message about a ceiling is how a
  person ends up believing they have invoices they do not.

Three decisions in that table are now **decided** (20 Oct 2026); they are
listed with the answers in §15:

1. **DECIDED — AI and OCR are in the trial**, inside the `aiMonthly: 20`
   quota. Their registry rows carry `FREE, ONLINE_*`.
2. **Import stays available in `FREE_EXHAUSTED`.** The usage policy (§3) says
   an imported invoice does not burn the trial, so refusing the import would
   contradict the policy. It is refused in the _expired_ states, because
   those lock operational writes.
3. **Team members are `ONLINE_*` only** — the local engine has one owner
   (`local_user`, role always `owner`), so an offline workspace is a
   single-person business. If the owner wants offline teams later, that is a
   new local-engine capability, not a plan row.

---

## 3. Usage Policy — what counts as one invoice

**One definition, one pure function**, in `packages/validation`
(`src/schemas/entitlement-usage.ts`, new), imported by the backend **and** the
local engine. The server decides; the local engine applies the same rule
offline; the UI only displays what it is told.

### 3.1 The rule (the owner confirmed it on 20 Oct 2026)

| A document …                                                  | counts as an invoice?  | why                                                                  |
| ------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------- |
| a **sale** invoice created                                    | **yes**                | one document                                                         |
| a **purchase** invoice created                                | **yes**                | one document                                                         |
| in any final status (paid, unpaid, partially paid, cancelled) | **yes**                | the slot is not given back                                           |
| cancelled or deleted                                          | **still yes**          | otherwise create → delete would bypass the trial                     |
| a draft that was never finalised                              | no                     | it never was a document (confirmed)                                  |
| a quotation                                                   | no                     | it is not an invoice                                                 |
| a late-fee invoice generated by the system                    | no                     | the system made it, not the person                                   |
| a return / credit note                                        | **yes — one document** | the owner decided (20 Oct 2026)                                      |
| an invoice brought in by **file import**                      | **no**                 | decided: the import must not burn the trial                          |
| an invoice pushed from a device by a sync                     | no                     | it was counted on the device that made it, or it came from an import |

### 3.2 How the counter is derived

- `count: 'exact', head: true` over the invoice rows that match §3.1 —
  **never** a cached number, never a counter column that can drift. This is
  already how `assertWithinLimit` counts (`plan-limits.service.ts`).
- For the lifetime trial: the count is over the workspace's invoices, ever.
- For the daily ceiling: the same count, restricted to the workspace's local
  day (§4).
- The check happens **inside** `InvoiceService.create`
  (`backend/src/services/invoice.service.ts`) and inside the local engine's
  create handler (`packages/local-engine/src/routes/invoices.ts`), in the same
  transaction as the write. The UI lock is **display only**.
- Every other path that creates an invoice is checked against the same
  policy, not skipped: recurring invoices, the AI pipeline, late fees and the
  migration import. (The exact creation paths are listed in §13.3.)

⚠️ **Three facts about the existing check that the policy must respect:**

1. **It is already in the right place.** `assertWithinLimit(workspaceId,
'invoices')` runs inside `InvoiceService.create` **after** the
   idempotent-replay check — so a sale recorded offline and merely re-sent by
   a device is never refused. The new policy keeps that order.
2. **It is a pre-check, not a transaction.** `InvoiceService.create` has no
   Postgres transaction of its own (supabase-js has none), so two concurrent
   creates can both pass the check and overshoot by one. The contract does
   not pretend otherwise: the ceiling is «at most N», and the count is
   re-read on every attempt.
3. **The table is named differently on the two sides.** The server's table is
   `invoices`; the local engine's SQLite table is `invoice` (singular, like
   its other tables: `payment`, `product`, `customer`). The policy function
   takes the **rows**, not the table name, so both sides use it unchanged.

### 3.3 The boundary (decided, tested both sides)

A limit of **50** means: invoices 1 … 50 are allowed, the **51st** is refused.
The check is therefore `used >= limit → refuse`, i.e. the counter is read
**before** the write. The same rule for the daily ceiling: at 500 invoices
today, the 501st is refused; at 499, the 500th is allowed. Both boundaries
are tested on both sides.

---

## 4. The daily ceiling for `ONLINE_*`

- The «day» is the **workspace's** local day — `backend/src/utils/local-day.ts`
  (`startOfLocalDayISO(timeZone, now)`, DST-corrected), the same function the
  app uses to decide «today» — not the server's day and not the device's.
- The count is of invoices **created** in that local day (§3.1's rule).
- **DECIDED (20 Oct 2026): the creation time** — the server's clock — not
  the invoice's business date: a backdated invoice would otherwise move the
  day's count into another day and the ceiling would not be a ceiling. The
  business date still decides which _day the books_ the invoice belongs to.
- Over the ceiling → `402 PLAN_LIMIT_REACHED` with
  `feature: 'invoices_daily'`, rendered by
  `packages/ui/src/lib/plan-limit-message.ts` — which today knows only two
  features and would mis-render this one (§2).
- The ceiling **never** applies to `OFFLINE`: the offline edition is a
  licensed product, not a metered one.
- The ceiling is per plan: `ONLINE_500` → 500, `ONLINE_1000` → 1,000,
  `ONLINE_1500` → 1,500, per workspace, per local day.
- The boundary is the one of §3.3, and it is tested on both sides.

**DECIDED (20 Oct 2026): the zone comes from the workspace's stored
setting** (`workplace-time-zone.ts`), **never** from the request's `?tz=`.
A ceiling decided by a parameter the client sends is a ceiling the client can
dodge: the same person would get 500 invoices today by sending a different
`?tz=`. When the workspace has **no** zone set, the day is **UTC** — and the
answer says so explicitly, in the response and on the screen, instead of
guessing.

---

## 5. The signed offline licence

### 5.1 Payload

```jsonc
{
  "license_id": "…", // uuid, issued by the server
  "workspace_id": "…",
  "account_id": "…",
  "plan": "OFFLINE",
  "issued_at": "2026-10-20T00:00:00Z",
  "expires_at": "2027-10-20T00:00:00Z",
  "device_id": "…", // the device this licence was activated on
  "features": ["invoice.create", "…"],
  "version": 1,
}
```

Signed with **Ed25519**. The signature travels with the payload.

### 5.2 The keys

| Key             | Where it lives                          | Why                                                                                                                                    |
| --------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Private key** | the **server's secret store only**      | never in the repository, never in Electron, never in the APK, never in a build artefact, never in a log, never in a committed env file |
| **Public key**  | shipped in the apps (desktop + Android) | verification must work with no internet                                                                                                |

If the server has no key configured → `503 LICENSE_SIGNING_NOT_CONFIGURED`.
**Never** a fallback key, never a development key in production.

⚠️ **The repository has no secret store yet.** The only secret it reads
today is `SENTRY_DSN` from the environment (`backend/src/services/monitoring.ts`),
and the deployment reads its env from the platform. The licence key follows
the same rule — read from the environment/secret manager at runtime, never
written to a file in the repository — but the contract states it explicitly,
because "the private key lives only in the secret store" is only true if
somebody decides where the secret store is. The status of Step 2 is
`BLOCKED_EXTERNAL_CREDENTIAL` until the owner sets the key.

### 5.3 Verification

- One function in `packages/validation` (public key + payload → verdict),
  used by the local engine and by both hosts. It answers: valid / expired /
  wrong workspace / wrong device / tampered.
- Verification is **offline**: no server call, no periodic check-in. An annual
  licence works for its whole term with the internet switched off.
- `last_verified_at` is recorded **whenever the device happens to be
  online** — an opportunity, never an obligation.

**DECIDED (20 Oct 2026): the verifier lives in `packages/validation`** and
uses **`@noble/curves`** — a pure-JS implementation, because **Hermes** (the
Android runtime) has **no WebCrypto Ed25519**. One implementation for every
runtime: the local engine, the desktop and the phone answer the same way.
**The version of `@noble/curves` is reported before it is added**, and the
owner runs the install — a new dependency is never added silently.

---

## 6. Device binding

- `device_id` = a random id, created at the first activation, stored in the
  app's **private storage** (the desktop's OS credential store —
  `bridge().secure` / `apps/desktop/electron/main/services/secure-store.ts`;
  the Android app's private storage / `expo-secure-store`). It is not a
  hardware id.
- **TPM (Windows) / Android Keystore is an optional hardening layer, never a
  condition.** A device without it still activates, and a device with it does
  not get locked out of the product.
- Moving to a new device: the owner releases the old one from the web panel
  (or an admin does it — §11). **No hardware lock-out.**
- A released device stops verifying (the licence is bound to the old
  `device_id`); the books on that device stay readable and exportable.
- The device also records **the highest time it has ever seen** (§7) in the
  device database's own `meta` table (the key/value table the schema already
  has — `schema_version`, `workspace_id` live there today).

---

## 7. Expiry behaviour

| Situation                                              | What happens                                                                                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The offline licence is past `expires_at`               | the local engine refuses **new operational writes** with a clear message; reading, printing, backup and export keep working                             |
| The cloud subscription is past due (`ONLINE_PAST_DUE`) | the same: writes are refused after the grace period, reading/export never                                                                               |
| The cloud subscription is expired                      | the same, plus the sync stops                                                                                                                           |
| The clock on the device is moved backwards             | the device records **the highest time it has ever seen** (in `meta`); a licence is judged against that, so a rolled-back clock does not extend anything |
| The device has no clock at all / an absurd clock       | the highest-seen time governs, and the licence is treated as expired rather than as valid                                                               |

⚠️ **The server already has a grace period** — `GRACE_PERIOD_DAYS = 7` in
`billing.service.ts`, applied by `isSubscriptionExpired(sub, now)`. The
`ONLINE_PAST_DUE` state of §1.1 is that grace period, and the one definition
of expiry stays where it is: `isSubscriptionExpired`.

The message shown to the person is fixed in the three languages (§13.2) and
always says the same three things: **their data is safe and not deleted**, a
**read/export** path exists, and a **plan** unlocks the writes.

---

## 8. Upgrade OFFLINE → ONLINE, with credit

1. The server computes the credit from the amount **actually paid** — the
   money the business really paid, not the plan's list price — × unused days
   ÷ term days.
2. The rounding is the **currency's own rule** (`packages/formatting`'s
   precision per currency) in the currency the money was paid in (§15
   question 1 decides which currency that is).
3. The breakdown is **shown before the payment** — what was paid, the term,
   the unused days, the credit, the new price, the total.
4. The local data moves to the cloud **only** through the safe-migration
   phase of the offline programme (Phase 8): reconcile, then `edition =
'cloud'`. Until then the device keeps the books.
5. **Nothing is lost**: the local database is kept read-only as an archive
   for 90 days, and the transfer is idempotent.

⚠️ **What the code has today, and what it does not:**

| The prompt says                             | The code has                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| «the amount actually paid (from `billing`)» | **There is no `billing` table.** The amounts that were really paid live in `subscription_upgrade_requests.amount_minor` and `subscription_events.amount_minor` (both written when an admin approves the request); `checkout_sessions` carries **no** amount at all, and `admin.service.ts` says it outright: «There is no authoritative pricing source in this database… Any revenue figure here would be invented.» |
| a refund / a credit                         | **Neither exists.** `subscription_events.event` may only be `upgrade_requested                                                                                                                                                                                                                                                                                                                                       | upgrade_approved | upgrade_rejected | upgrade_cancelled | cancel_scheduled | cancelled | expired`— there is no`refunded`, no `downgraded`, no `credit_issued`. |
| a downgrade                                 | **Impossible today.** `requested_plan` is `CHECK (… IN ('pro','enterprise'))` — never to `free`, never from `enterprise` down, and `OFFLINE` is not a plan the schema knows.                                                                                                                                                                                                                                         |

So the credit arithmetic of this section is **new work**, not an extension of
an existing ledger: Step 1 needs a payments ledger (or the upgrade rows must
become the ledger, with the event vocabulary extended) before the credit can
be exact. Until then, the credit is computed from what the approved upgrade
rows say was paid, and the breakdown says so.

⚠️ **The upgrade path only knows two plans.** The Postgres functions
(`create_subscription_upgrade_request`, `approve_subscription_upgrade`, …)
and their `CHECK` constraints are written for `pro | enterprise`. The owner's
five plans (§1) need those constraints extended — part of §13.1.

---

## 9. Signing in on Windows / Android, per state

| Situation                                                                | What the person sees                                                                                                                                                                           |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A new account on a device                                                | welcome → login/register → **new user?** → choose **Free (50) / Online / Offline** → Free starts the trial; Online and Offline go to `/billing` (the existing screen — no second billing page) |
| An `OFFLINE` account signing in on a device                              | «حساب شما روی نسخه‌ی آفلاین است — ادامه با نسخه‌ی آفلاین؟» with **[ادامه]** and **[ارتقا به آنلاین]**                                                                                          |
| An `OFFLINE` account on the **web**                                      | the portal only: licence status, devices, billing, upgrade, and **export**                                                                                                                     |
| A device that was used on the free trial, whose account became `OFFLINE` | the cloud session ends; the person continues in the local edition, with the data rules of §8                                                                                                   |
| `FREE_EXHAUSTED` or an expired state                                     | the lock screen of the offline prompt's Phase 7, with links to read/export and to `/billing`                                                                                                   |

---

## 10. The landing page

- Above the pricing section: two boxes — **آنلاین** / **آفلاین**. Choosing
  one shows that edition's tariffs.
- **Every number on the page comes from `backend/src/services/plan-pricing.ts`**,
  and it reaches the page through the API, not by importing the backend file:
  `pricing-scene.tsx` → `usePlans()` → `GET /api/billing/plans` →
  `PLAN_PRICING[key].monthly / .yearly / .currency`. The guard
  `packages/ui/src/__tests__/landing-claims.test.ts` forbids a price of the
  page's own (`expect(code).not.toMatch(/\bprice:\s*\d/)`) and forbids a
  hard-coded currency label under the amount.
- The prices are the owner's table (§15 question 1 decides the currency);
  until the owner answers, the page shows the numbers the code holds and the
  contract does not invent a currency.

---

## 11. The admin panel

Extended, not duplicated: `apps/admin/app/[lang]/(admin)/subscriptions/`
(`page.tsx`, `subscriptions-client.tsx`, `plan-limits-panel.tsx`,
`upgrade-requests-panel.tsx`) and `.../workspaces/` (`page.tsx`,
`workspaces-client.tsx`) + `backend/src/routes/admin.routes.ts` and the
admin routes that live in `backend/src/routes/billing.routes.ts`
(`/api/admin/plan-limits`, `/api/admin/workspace-limits/…`,
`/api/admin/upgrade-requests…`).

- See, per workspace: the state, the plan, the expiry, the invoices used
  (lifetime trial and today), the devices and the licences.
- Act, each with a reason, each written to `audit_logs` with an explicit
  `created_at` (the live column has no default — `AuditService` already
  writes it):
  change plan · extend expiry · grant extra trial invoices (an **override** in
  `workspace_limit_overrides`, never an edited counter) · revoke a licence ·
  release a device · record a manual payment or refund · issue upgrade credit.
- Edit plan prices and limits — writing the same settings the core reads
  (`plan_limit_settings`), never a second table.
- Every admin route behind `platformAdminGuard`; every `.eq('id')` also
  scoped; a test proves a non-admin gets 403.

⚠️ **The plan-limit and upgrade admin routes write NO audit row today.**
They live in `billing.routes.ts` (not `admin.routes.ts`) and never call
`AuditService`; only the two subscription mutations
(`PATCH /api/admin/subscriptions/:id/plan` and `…/status`) are audited,
through `admin.service.ts`'s `auditedSubscriptionUpdate`. **Every new
admin action of §11 must be audited the same way** — otherwise the admin
panel becomes the one place in the product where a change leaves no trace.

⚠️ **The admin's plan list is a fourth copy of the plan names.** The admin
hook (`apps/admin/hooks/use-admin-subscriptions.ts`) has
`PLANS = ['free','pro','enterprise']`, and `plan_limit_settings.plan` has a
`CHECK` on the same three. When the plans change (§0.3), these move with
them — and the `CHECK` needs a migration (§13.1).

---

## 12. Threat model, honestly

| Attack                             | Online                                                                                                           | Offline                                                                                                                                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Using more than the plan allows    | **Impossible.** The server counts the rows and refuses the write. The UI lock is a convenience, not the control. | The local engine applies the same rule; a patched client could ignore it — see below.                                                                                                                           |
| Forging a licence                  | n/a                                                                                                              | **Impossible** without the private key: the payload is signed with Ed25519 and the public key is in the app. Tampering with one byte invalidates the signature.                                                 |
| Moving the clock backwards         | The server's clock is the truth.                                                                                 | The device records the highest time it has ever seen; a rolled-back clock does not extend the licence.                                                                                                          |
| Copying the app to another machine | The account and the data live on the server.                                                                     | The licence is bound to a `device_id`; the copy does not verify. The books on the old device remain readable there.                                                                                             |
| **Patching the app binary**        | The server still enforces the plan; a patched UI only changes what is displayed.                                 | **Possible — this is true of every piece of client software.** A patched copy loses: updates, cloud backup, the exchange-rate feed, AI/OCR, upgrades, and support. It keeps only what is already on the device. |

The last row is the honest answer: the offline edition protects the **price**,
not the **data**. The data is the person's, and it is always exportable.

---

## 13. Migrations, creation paths and i18n

### 13.1 Migrations (names only; additive; the owner runs them)

**Order matters — one of these is already waiting:**

| #   | File                                              | What it adds                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | `docs/plan-limits-migration.sql`                  | **ALREADY WRITTEN, NOT YET RUN** (its own header says «NOT YET RUN … PENDING HUMAN CONFIRMATION»). It creates `plan_limit_settings` and `workspace_limit_overrides`. **The owner must run it first** — everything below builds on those two tables. ⚠️ It has **no** `docs/VERIFY-plan-limits.sql`; the verification query is commented inside the migration. The entitlement work should add that VERIFY file.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 1   | `docs/entitlement-01-migration.sql`               | (a) the new plan names in the `plan_limit_settings.plan` **CHECK** (`free,pro,enterprise` → the owner's five) and in `subscription_upgrade_requests.requested_plan`; (b) the new event kinds in `subscription_events.event` (`refunded`, `downgraded`, `credit_issued`, `licence_issued`, `licence_revoked`, `device_released`); (c) the **offline licence** table (`license_id`, `workspace_id`, `account_id`, `plan`, `issued_at`, `expires_at`, `device_id`, `features`, `version`, `revoked_at`); (d) the **device** table (`device_id`, `label`, `activated_at`, `released_at`, `last_verified_at`). **The workspace's time zone is NOT here**: it already exists — `backend/src/services/workplace-time-zone.ts` (`GET /api/workplace/time-zone`) — and the ceiling only has to start reading it instead of the request's `?tz=` (§4) |
| 2   | `docs/VERIFY-entitlement-01.sql`                  | the verification queries for the above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 3   | `backend/src/__tests__/entitlement-01.pg.test.ts` | the migration run **twice** on a real Postgres, `REVOKE ALL` first, per `CLAUDE.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

Rules that apply: additive and idempotent, `REVOKE ALL` from
`PUBLIC/anon/authenticated` then grant what is needed, functions with
`SET search_path = public, pg_temp` and no `EXECUTE` for the public roles.
`plan_limit_settings` and `workspace_limit_overrides` are **read**, not
replaced. No second plan table.

⚠️ **The `invoicesDaily` limit needs no DDL.** The limits live in a `jsonb`
column, so a new key is a new key in the JSON — but the **shape** of
`PlanLimitValues` (`plan-limit-defaults.ts`: `invoices`, `users`,
`aiMonthly`) and the enforced set (`EnforcedLimit`: `invoices`, `users`) are
TypeScript, and they move with it.

### 13.2 The i18n key families (fa/af/en — all three, every new key)

There is **no `plan.*` family and no `planLimit.*` family** in the catalogs
today. The existing homes are extended instead of a parallel set being
invented:

| Family                                                                                                                | Status                                                                 | Used for                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `billing.limitReached.*`                                                                                              | **extended** — `invoices` and `users` exist; `invoices_daily` is added | the ceiling messages (rendered by `packages/ui/src/lib/plan-limit-message.ts`)                                                                                      |
| `billing.plans.*`                                                                                                     | **extended** — one entry per plan, with its `features` list            | the plan names on the billing screen and the landing page                                                                                                           |
| `billing.usage.*`                                                                                                     | **extended** — the usage block gains the daily count                   | the usage report on the billing screen                                                                                                                              |
| `billing.request.*`                                                                                                   | **extended**                                                           | the upgrade request flow, plus the credit breakdown of §8                                                                                                           |
| `billingHub.*`                                                                                                        | **extended**                                                           | the billing hub's sections and tabs                                                                                                                                 |
| `pricing.*`                                                                                                           | **extended**                                                           | the landing pricing block, plus the two **آنلاین / آفلاین** boxes                                                                                                   |
| `subscriptionLock.*`                                                                                                  | **extended**                                                           | the lock screen of the exhausted / expired states                                                                                                                   |
| `admin.limits.*`, `admin.plan.*`, `admin.status.*`, `admin.subscriptions.*`, `admin.upgrades.*`, `admin.workspaces.*` | **extended**                                                           | the admin screens of §11                                                                                                                                            |
| `entitlement.*`                                                                                                       | **new family**                                                         | the **verdicts**: not entitled, requires online, requires upgrade (with the plan), exhausted, expired — one key per verdict, plus the lock screen's three sentences |
| `feature.*`                                                                                                           | **new family**                                                         | one label per registry key (the guard requires all three languages)                                                                                                 |

⚠️ `billing.plans.free.features.*` and `admin.limits.*` name the **numbers**
(`invoices_10`, `user_1`). When the free plan becomes 50 invoices, those
labels change with the plan — a number in a key is a number that goes stale.

### 13.3 Every place an invoice is created (each one checked against §3)

Seven real call sites, and they all funnel through `InvoiceService.create`:

| #   | Path                                   | File:line                                                                                              |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | **HTTP create** (`POST /api/invoices`) | `backend/src/routes/invoice.routes.ts` → `InvoiceService.create`                                       |
| 2   | **Recurring invoice** (the automation) | `backend/src/services/automation/automation.service.ts`                                                |
| 3   | **Late fee**                           | `backend/src/services/commerce/late-fee.service.ts`                                                    |
| 4   | **AI / ingest purchase**               | `backend/src/services/ingest/ingest.service.ts`                                                        |
| 5   | **Migration import**                   | `backend/src/services/migration/migration.service.ts`                                                  |
| 6   | **Storefront order → invoice**         | `backend/src/services/orders/orders.service.ts`                                                        |
| 7   | **AI pipeline** (`create_invoice`)     | `backend/src/services/ai/pipeline/pipeline.domain.ts` — it calls the **HTTP route**, so it inherits #1 |

Plus the **local engine**: `packages/local-engine/src/routes/invoices.ts` —
`POST /invoices` (the transaction opens at `:419`; the check goes **before**
it, right after the schema parse and the exchange-rate resolution, so a
refused write never consumes an invoice number).

⚠️ **Two of those seven are NOT counted by the policy of §3.1** — the
late-fee invoice (#3) and the ingested document (#4) are system-made, and the
migration import (#5) is a file import. The policy says they do not count, so
the check they hit must be the _policy_ and not the raw ceiling: a
system-made invoice must not be refused because the person is at 50, and it
must not push the count over either. The policy function therefore
answers **two** questions — «does this document count?» and «may this write
happen?» — and the two are not the same question.

---

## 14. The feature registry, first version

### 14.1 The rows (today's features, from the capability matrix)

The classes are the L / L\* / C / X classes of
`docs/offline/01-CAPABILITY-MATRIX.md` (§3, §4, §5 — as audited on 19 Oct
2026 and approved by the owner with three amendments). **109 capability
rows**: 24 `L`, 59 `L\*`, 26 `C`; the four `public-*` / `portal` /
`my-attendance` routes are `X` at page level and are **not** registry rows
(they are addressed by someone who is not the business's device).

The mapping rules that turn a matrix row into a registry row:

- `L` / `L\*` → `execution: 'local'` — the local engine can run it (Gate 4
  built the handlers) → available in **every** plan: `FREE` (on the cloud),
  `OFFLINE` (on the device), `ONLINE_*`.
- `C` → `execution: 'server'` — the cloud runs it → available in the **cloud
  plans** (`FREE`, `ONLINE_*`) and **refused in the offline edition** with
  `REQUIRES_ONLINE`.
- The owner decided (20 Oct 2026): the trial **does** get the paid-provider
  features — AI and OCR — inside the existing small quota (`aiMonthly: 20`
  on the free plan). Past that quota they are refused like any other limit.
- A capability that is `L` offline **and** `C` online is `hybrid`: both parts
  are named (e.g. `data.backup`: a local backup on the device, a cloud
  snapshot in the cloud).

### 14.2 The table

> ⚠️ **«Manufacture from product» (§4.3) and «Produce» (§4.7) are the SAME
> capability** — the matrix lists it under both areas. The registry
> (`packages/validation/src/schemas/feature-registry.ts`) has ONE row for it
> (`manufacturing.produce`); two rows would be two verdicts for one button.
> The table below keeps both, because the matrix does — read it as one.

| feature id                                                           | capability (matrix)                                                | route                           | class | execution                              | plans                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------- | ----- | -------------------------------------- | ------------------------ |
| **§4.1 Dashboard**                                                   |                                                                    |                                 |       |                                        |                          |
| `dashboard.kpi`                                                      | KPI tiles                                                          | `/`                             | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `dashboard.sales_chart`                                              | Sales chart                                                        | `/`                             | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `dashboard.activity`                                                 | Recent activity                                                    | `/`                             | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `dashboard.work_queue`                                               | Work queue                                                         | `/`                             | L\*   | hybrid (local queue, server approvals) | FREE, OFFLINE, ONLINE_\* |
| `dashboard.ai_insight`                                               | AI insight card                                                    | `/`                             | C     | server                                 | FREE, ONLINE_\*          |
| `dashboard.manufacturing_card`                                       | Manufacturing card                                                 | `/`                             | C     | server                                 | FREE, ONLINE_\*          |
| `dashboard.currency_rates`                                           | Currency rate dialog                                               | `/`                             | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| **§4.2 Invoices**                                                    |                                                                    |                                 |       |                                        |                          |
| `invoice.list`                                                       | Invoice list                                                       | `invoices`                      | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `invoice.detail`                                                     | Invoice detail                                                     | `invoices/:id`                  | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `invoice.related`                                                    | Related documents                                                  | `invoices/:id`                  | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `invoice.create`                                                     | Create invoice (draft → finalize)                                  | `invoices/new`                  | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `invoice.edit`                                                       | Edit invoice                                                       | `invoices/:id`                  | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `invoice.delete`                                                     | Delete invoice                                                     | `invoices`                      | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `invoice.number`                                                     | Number the invoice                                                 | —                               | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `invoice.print`                                                      | Print / PDF                                                        | `invoices/:id`                  | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `payment.record`                                                     | Record payment                                                     | `invoices/:id`, `customers/:id` | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `payment.cancel`                                                     | Cancel payment                                                     | `invoices/:id`, `customers/:id` | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `invoice.installment`                                                | Installment plan                                                   | `invoices/:id`                  | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `invoice.late_fee`                                                   | Late fee                                                           | `invoices/:id`                  | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `accounting.post_to_ledger`                                          | Post to ledger                                                     | `invoices/:id`                  | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `invoice.recurring`                                                  | Recurring invoice                                                  | `invoices/new/preview`          | C     | server                                 | FREE, ONLINE_\*          |
| `invoice.approval`                                                   | Approval on an invoice                                             | `invoices/:id`                  | C     | server                                 | FREE, ONLINE_\*          |
| **§4.3 Inventory**                                                   |                                                                    |                                 |       |                                        |                          |
| `product.list`                                                       | Product list                                                       | `warehouse`                     | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| `product.detail`                                                     | Product detail                                                     | `warehouse/:id`                 | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `product.upsert`                                                     | Create / edit product                                              | `warehouse`                     | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `product.opening_stock`                                              | Opening stock / stock edit                                         | `warehouse/:id`                 | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `product.barcode`                                                    | Barcodes                                                           | `warehouse/:id`                 | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| `product.barcode_lookup`                                             | Barcode lookup                                                     | `invoices/new`                  | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| `product.images`                                                     | Product images                                                     | `warehouse/:id`                 | L     | hybrid (local bytes, server storage)   | FREE, OFFLINE, ONLINE_\* |
| `unit.manage`                                                        | Units                                                              | `warehouse`                     | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `warehouse.overview`                                                 | Warehouse overview                                                 | `warehouse`                     | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `warehouse.detail`                                                   | Warehouse detail                                                   | `warehouse/:id`                 | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `warehouse.upsert`                                                   | Create / edit warehouse                                            | `warehouse`                     | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| `stock.transfer`                                                     | Transfer stock                                                     | `warehouse`                     | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `stock.assign_unassigned`                                            | Assign unassigned stock                                            | `warehouse`                     | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `stock.placement`                                                    | Stock placement                                                    | `warehouse`                     | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| `stock.storage_locations`                                            | Storage locations                                                  | `warehouse/:id`                 | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `stock.history`                                                      | Stock history                                                      | `warehouse/:id`                 | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| `stock.batches`                                                      | Expiry batches                                                     | `warehouse/:id`                 | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `inventory.costing_method`                                           | Costing method                                                     | `warehouse`                     | L\*   | local (read), server (change)          | FREE, OFFLINE, ONLINE_\* |
| `product.notes`                                                      | Product notes / custom fields                                      | `warehouse/:id`                 | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| `manufacturing.produce`                                              | Manufacture from product                                           | `warehouse/:id`                 | C     | server                                 | FREE, ONLINE_\*          |
| **§4.4 Customers**                                                   |                                                                    |                                 |       |                                        |                          |
| `customer.list`                                                      | Customer list                                                      | `customers`                     | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| `customer.detail`                                                    | Customer detail                                                    | `customers/:id`                 | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `customer.upsert`                                                    | Create / edit customer                                             | `customers`                     | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| `customer.accounting`                                                | Customer accounting                                                | `customers/:id`                 | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `customer.risk`                                                      | Customer risk / insights                                           | `customers/:id`                 | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `customer.crm`                                                       | CRM panel                                                          | `customers`                     | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| `customer.terms`                                                     | Terms                                                              | `customers/:id`                 | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| `customer.documents`                                                 | Documents                                                          | `customers/:id`                 | C     | server                                 | FREE, ONLINE_\*          |
| `customer.portal_link`                                               | Portal link                                                        | `customers/:id`                 | C     | server                                 | FREE, ONLINE_\*          |
| **§4.5 Accounting**                                                  |                                                                    |                                 |       |                                        |                          |
| `accounting.chart`                                                   | Chart of accounts                                                  | `accounting`                    | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `accounting.journal`                                                 | Journal entries                                                    | `accounting`                    | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `accounting.trial_balance`                                           | Trial balance                                                      | `accounting`                    | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `accounting.reports`                                                 | Balance sheet / income statement                                   | `accounting`                    | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `accounting.profit_report`                                           | Profit report                                                      | `accounting`                    | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `accounting.general_ledger`                                          | General ledger                                                     | `accounting`                    | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `accounting.evidence`                                                | Evidence / journey                                                 | `accounting`                    | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `accounting.unvalued_stock`                                          | Unvalued stock                                                     | `accounting`                    | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `accounting.financing`                                               | Financing                                                          | `accounting`                    | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| `accounting.period_close`                                            | Month-end / year-end                                               | `accounting`                    | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `accounting.period_lock`                                             | Period lock                                                        | —                               | C     | server                                 | FREE, ONLINE_\*          |
| **§4.6 Till (POS)**                                                  |                                                                    |                                 |       |                                        |                          |
| `till.session`                                                       | Current session                                                    | `till`                          | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `till.open_close`                                                    | Open / close session                                               | `till`                          | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `till.cash_movement`                                                 | Cash movement                                                      | `till`                          | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `till.order`                                                         | Record order                                                       | `till`                          | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `till.opening_capital`                                               | Opening capital                                                    | `till`                          | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `till.ledger`                                                        | Session ledger / cash flow                                         | `till`                          | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `till.labels`                                                        | Till labels                                                        | `till`                          | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| `till.suspend`                                                       | Suspend / resume / remove                                          | `till`                          | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `till.shift_history`                                                 | Shift history                                                      | `operations`                    | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| **§4.7 Manufacturing** (C in v1 — the owner's 19 Oct 2026 amendment) |                                                                    |                                 |       |                                        |                          |
| `manufacturing.bom`                                                  | BOM list                                                           | `manufacturing`                 | C     | server                                 | FREE, ONLINE_\*          |
| `manufacturing.definition`                                           | Production definition                                              | `manufacturing`                 | C     | server                                 | FREE, ONLINE_\*          |
| `manufacturing.produce`                                              | Produce                                                            | `manufacturing`                 | C     | server                                 | FREE, ONLINE_\*          |
| `manufacturing.runs`                                                 | Production runs                                                    | `manufacturing`                 | C     | server                                 | FREE, ONLINE_\*          |
| `manufacturing.work_orders`                                          | Work orders                                                        | `manufacturing`                 | C     | server                                 | FREE, ONLINE_\*          |
| `manufacturing.report`                                               | Manufacturing report                                               | `manufacturing`                 | C     | server                                 | FREE, ONLINE_\*          |
| **§4.8 Stock count**                                                 |                                                                    |                                 |       |                                        |                          |
| `stockcount.list`                                                    | Count list / detail                                                | `stock-count`                   | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `stockcount.create`                                                  | Create count                                                       | `stock-count`                   | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `stockcount.record_line`                                             | Record a line                                                      | `stock-count`                   | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `stockcount.complete`                                                | Complete count                                                     | `stock-count`                   | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `stockcount.cancel`                                                  | Cancel count                                                       | `stock-count`                   | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| **§4.9 Team and payroll**                                            |                                                                    |                                 |       |                                        |                          |
| `employee.list`                                                      | Employee list / detail                                             | `team-and-payroll`              | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| `employee.upsert`                                                    | Create / edit / delete employee                                    | `team-and-payroll`              | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| `hr.attendance`                                                      | Attendance sheet                                                   | `team-and-payroll`              | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `hr.shifts`                                                          | Shifts                                                             | `team-and-payroll`              | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| `hr.leaves`                                                          | Leaves                                                             | `team-and-payroll/:id`          | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| `hr.payroll`                                                         | Payroll                                                            | `team-and-payroll/:id`          | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `governance.permission_matrix`                                       | Permission matrix                                                  | `governance`                    | C     | server                                 | FREE, ONLINE_\*          |
| `hr.attendance_devices`                                              | Attendance devices                                                 | `team-and-payroll`              | C     | server                                 | FREE, ONLINE_\*          |
| `hr.attendance_links`                                                | Attendance links                                                   | `team-and-payroll`              | C     | server                                 | FREE, ONLINE_\*          |
| `team.members`                                                       | Member management                                                  | `team-and-payroll`              | C     | server                                 | FREE, ONLINE_\*          |
| **§4.10 Settings, onboarding, sync, data**                           |                                                                    |                                 |       |                                        |                          |
| `settings.books_currency`                                            | Books currency                                                     | `settings`, `onboarding`        | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `settings.time_zone`                                                 | Workspace time zone                                                | `settings`                      | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `settings.workspace_profile`                                         | Workspace profile                                                  | `settings`                      | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| `settings.business_stamp`                                            | Business stamp                                                     | `settings`                      | C     | server                                 | FREE, ONLINE_\*          |
| `settings.hardware`                                                  | Hardware (printers, scanner)                                       | `settings`                      | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| `settings.currencies`                                                | Currencies list                                                    | `onboarding`                    | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| `data.backup`                                                        | Backup                                                             | `settings`                      | C     | hybrid (local export, cloud snapshot)  | FREE, OFFLINE, ONLINE_\* |
| `sync.queue`                                                         | Sync queue                                                         | `sync-center`                   | L     | local                                  | FREE, OFFLINE, ONLINE_\* |
| `sync.push_pull`                                                     | Sync push / pull                                                   | `sync-center`                   | C     | server                                 | FREE, ONLINE_\*          |
| `sync.overview`                                                      | Sync overview                                                      | `data-and-sync`                 | C     | server                                 | FREE, ONLINE_\*          |
| `sync.conflicts`                                                     | Conflicts                                                          | `data-and-sync`                 | C     | server                                 | FREE, ONLINE_\*          |
| `data.migration`                                                     | Data migration                                                     | `data-and-sync`                 | C     | hybrid (local import, server import)   | FREE, OFFLINE, ONLINE_\* |
| `activity.feed`                                                      | Activities                                                         | `activities`                    | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `audit.trail`                                                        | Audit trail                                                        | `audit`                         | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `approvals.workflows`                                                | Approvals / workflows                                              | `approvals`                     | C     | server                                 | FREE, ONLINE_\*          |
| `analysis.reports`                                                   | Analysis                                                           | `analysis`                      | L\*   | local                                  | FREE, OFFLINE, ONLINE_\* |
| `analysis.benchmark`                                                 | Peer benchmark                                                     | `analysis`                      | C     | server                                 | FREE, ONLINE_\*          |
| **§4.11 pages that are C or X by nature**                            |                                                                    |                                 |       |                                        |                          |
| `ai.assistant`                                                       | AI assistant                                                       | `assistant`                     | C     | server                                 | FREE, ONLINE_\*          |
| `ai.cashflow_forecast`                                               | AI cashflow forecast (a new feature — the worked example of §14.3) | `assistant`                     | C     | server                                 | FREE, ONLINE_\*          |
| `developer.keys`                                                     | OAuth apps, webhooks, API keys                                     | `developers`                    | C     | server                                 | FREE, ONLINE_\*          |
| `marketplace.apps`                                                   | Apps published by other people                                     | `marketplace`                   | C     | server                                 | FREE, ONLINE_\*          |
| `storefront.public`                                                  | A public storefront another device visits                          | `market-seller`                 | C     | server                                 | FREE, ONLINE_\*          |
| `billing.portal`                                                     | Subscriptions, wallet, upgrade, trial status                       | `billing`                       | C     | server                                 | FREE, ONLINE_\*          |
| `ocr.receipt`                                                        | OCR (receipt → invoice)                                            | —                               | C     | server                                 | FREE, ONLINE_\*          |
| `bank.import`                                                        | Bank statement → ledger                                            | `accounting`                    | C     | server                                 | FREE, ONLINE_\*          |

**Not registry rows (page class `X`):** `public-task/:token`,
`public-invoice/:token`, `portal/:token`, `my-attendance/:token` — the matrix's
own words: «No route is class X for a technical reason… they are pages a
_customer or employee_ opens, and they cannot work on a device that holds no
data for that token.»

### 14.3 A worked example: adding an online-only feature

**Feature:** «AI cashflow forecast» — a forecast the cloud computes from the
whole workspace, shown on the dashboard.

**1. The registry row** — `packages/validation/src/schemas/feature-registry.ts`:

```ts
'ai.cashflow_forecast': { execution: 'server', plans: ['ONLINE_*'] },
```

**2. The route guard** — the new route, in
`backend/src/routes/ai.routes.ts`, beside the role guard that is already
there:

```ts
preHandler: [
  authenticate,
  requireWorkspaceContext,
  requireCapability('ai.use'),
  requireEntitlement('ai.cashflow_forecast'),
]
```

**3. The button hook** — in `packages/ui`, at the button that opens the
forecast:

```ts
const availability = useActionAvailability('ai.cashflow_forecast')
// availability.reason === 'offline_edition' → the existing «نیاز به اینترنت» notice
```

**4. The label** — `feature.ai.cashflow_forecast` in fa, af and en.

**Files changed: four.** Not touched: the local engine, the offline
architecture, the sync engine, `entitlement.service.ts`'s logic (it reads the
registry), the billing screens, the offline prompt's phases. The feature is
refused offline because its row says `execution: 'server'` — a data change,
not a code change.

---

## 15. The answers (the owner, 20 Oct 2026)

The six questions this contract could not answer on its own, and the owner's
decisions. **These are the contract now**; the questions stay on the record so
the reasoning behind each decision is not lost.

| #      | Question                                | The answer                                                                                                                                                                                                                       |
| ------ | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1** | The currency of the prices              | **IRR (ISO): stored in IRR, displayed in تومان.** An AFN price **version** may be added later through price versioning — the price is a row with a currency, not a constant.                                                     |
| **Q2** | The invoice-counting rules              | (a) an invoice brought in by **file import does not count**; (b) a **return / credit note counts as one**; (c) a **draft that was never finalised does not count**, and a **cancelled** invoice **does** count.                  |
| **Q3** | The daily ceiling's clock               | **The creation time** (the server's clock), inside the **workspace's** day.                                                                                                                                                      |
| **Q4** | AI and OCR in the trial                 | **The trial gets them**, inside the existing small quota (`aiMonthly: 20` on the free plan).                                                                                                                                     |
| **Q5** | The workspace's time zone on the server | **The workspace's stored setting** (`workplace-time-zone.ts`), never the request's `?tz=`. Unset → **UTC**, and the answer says so explicitly.                                                                                   |
| **Q6** | Where the licence verifier lives        | **`packages/validation`**, with **`@noble/curves`** (pure JS — Hermes has no WebCrypto Ed25519), so **one** implementation serves every runtime. The package version is reported before it is added; the owner runs the install. |

### 15.1 The questions as they were asked

1. **The currency of the prices** — تومان (IRR) or افغانی (AFN)?
   → _IRR, stored; displayed in تومان; an AFN price version may come later._
2. **The invoice-counting rules** — (a) does a file import count? (b) does a
   return count? (c) do drafts and cancelled invoices count?
   → _(a) no, (b) yes, one document, (c) drafts no, cancelled yes._
3. **The daily ceiling's clock** — the creation time or the business date?
   → _The creation time, in the workspace's day._
4. **AI and OCR in the trial** — inside the trial or not?
   → _Inside, within the existing `aiMonthly: 20` quota._
5. **The workspace's time zone on the server** — a new column, or the
   workplace settings? → _The stored setting; unset → UTC, stated explicitly._
6. **Where the Ed25519 verifier lives** — in `packages/validation` with a
   dependency, or in a host-side module?
   → _`packages/validation` with `@noble/curves`; the version is reported
   before it is added._

---
