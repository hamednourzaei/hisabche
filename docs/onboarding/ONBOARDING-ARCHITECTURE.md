# Onboarding Information Architecture & Ten Business Scenarios

**Baseline:** `b54636fa` · **Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED` (architecture + server gate),
the UX surface and the ten end-to-end scenario runs remain `NOT_IMPLEMENTED` without a browser/device
witness. English technical identifiers; user-facing strings in `fa`, `af`, `en`.

## 1. Stages (adaptive, one wizard — no second engine)

| #   | Stage                                | Purpose                                          | Can skip?                    |
| --- | ------------------------------------ | ------------------------------------------------ | ---------------------------- |
| 1   | Account and identity                 | email, credential, full name                     | no                           |
| 2   | Business identity and location       | business name, trade(s), store size, note        | no                           |
| 3   | Operating model and industry         | primary trade key → operational DNA              | no                           |
| 4   | Operational DNA and capabilities     | 8-axis answers, derived composition              | answer = trade default       |
| 5   | Financial configuration              | books currency (AFN zero-decimal), fiscal day    | no                           |
| 6   | Conditional operational settings     | goods vs service vs production                   | only when relevant           |
| 7   | Optional team invitation             | member invite + role                             | yes                          |
| 8   | Initial data strategy and activation | optional product/customer/invoice, then activate | data optional, activation no |

## 2. Field governance

Legend: **M** mandatory · **C** conditional · **O** optional · **A** advanced (outside onboarding).

| Field id           | Type          | Status | Validation                                                                          | Default                                 | Visibility       | Persistence                                                                                  | Affects                          | Editable                      | i18n key                      |
| ------------------ | ------------- | ------ | ----------------------------------------------------------------------------------- | --------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------- | ----------------------------- |
| `email`            | string(email) | M      | `emailSchema`                                                                       | —                                       | always           | `auth.users`                                                                                 | identity                         | no                            | `auth.email`                  |
| `password`         | string        | M      | ≥8, upper/lower/digit                                                               | —                                       | always           | auth provider                                                                                | identity                         | via reset                     | `validation.minLength`        |
| `fullName`         | string        | M      | `nonEmptyStringSchema`                                                              | —                                       | always           | `profiles.full_name`                                                                         | gate IDENTITY                    | yes                           | `auth.fullName`               |
| `businessName`     | string\|null  | M      | max 200                                                                             | —                                       | always           | `profiles.business_name` + `workspaces.name`                                                 | gate WORKSPACE_PROFILE           | yes                           | `auth.businessName`           |
| `businessTypes`    | string[]      | M      | canonical registry keys only, ≤12 (`MAX_INDUSTRY_SELECTION`), duplicates normalised | —                                       | always           | `profiles.business_types` + `workspaces.business_types` (same canonical rule on both writes) | capability resolution            | owner only                    | `capabilities.*`              |
| `primaryTradeKey`  | string\|null  | C      | known industry key, deterministic replacement on removal (`primaryIndustryKeyOf`)   | registry-order rule (ADR-001)           | trade step       | `workspaces.onboarding_progress.answers.primaryTradeKey` + local store                       | vocabulary/display order only    | owner only                    | `onboarding.primaryIndustry`  |
| `storeSize`        | enum          | O      | solo\|small\|medium\|large                                                          | —                                       | business step    | `profiles.store_size`                                                                        | reporting size                   | yes                           | `onboarding.storeSize`        |
| `businessNote`     | string        | C      | max 2000; **mandatory when `other` is selected**                                    | —                                       | business step    | `profiles.business_note` + `workspaces.onboarding_progress.answers.businessNote`             | —                                | yes                           | `onboarding.aboutBusiness`    |
| `operatingAnswers` | closed object | C      | `operatingAnswersSchema`                                                            | trade default                           | DNA step         | `workspaces.onboarding_progress.answers.operating`                                           | capabilities/KPI                 | yes                           | `onboarding.operating.<axis>` |
| `defaultCurrency`  | CurrencyCode  | M      | `CURRENCY_CODES`                                                                    | **none** (button disabled until picked) | finance step     | `workspaces.base_currency`; fallback `onboarding_progress.answers.defaultCurrency`           | all money, gate DEFAULT_CURRENCY | owner, only while books empty | `onboarding.currency`         |
| `hasGoods`         | derived bool  | C      | from DNA `holdsStock`                                                               | false                                   | conditional step | DNA                                                                                          | inventory capability             | via DNA                       | `onboarding.hasGoods`         |
| `hasStaff`         | derived bool  | C      | from DNA                                                                            | false                                   | conditional step | DNA                                                                                          | payroll/roles                    | via DNA                       | `onboarding.hasStaff`         |
| `needsApprovals`   | derived bool  | C      | from DNA                                                                            | false                                   | conditional step | DNA                                                                                          | approval workflow                | via DNA                       | `onboarding.needsApprovals`   |
| `inviteMember`     | email+role    | O      | `emailSchema` + role enum                                                           | —                                       | team step        | `workspace_members`                                                                          | permissions                      | admin                         | `onboarding.invite`           |
| `initialProducts`  | rows          | O      | product schema                                                                      | empty                                   | data step        | `product`                                                                                    | stock/costing                    | yes                           | `onboarding.products`         |
| `initialCustomers` | rows          | O      | customer schema                                                                     | empty                                   | data step        | `customer`                                                                                   | receivables                      | yes                           | `onboarding.customers`        |
| `initialInvoice`   | draft         | O      | invoice rules                                                                       | none                                    | data step        | `invoice`                                                                                    | money                            | finalized = immutable         | `onboarding.invoice`          |
| `chartOfAccounts`  | full COA      | A      | accounting rules                                                                    | system defaults                         | **outside**      | `account`                                                                                    | accounting                       | admin                         | `accounting.*`                |
| `kpiCustomization` | layout        | A      | KPI registry                                                                        | role defaults                           | **outside**      | `user-dashboard-kpis`                                                                        | dashboard                        | yes                           | `dashboard.kpis.*`            |

**Rules enforced in code:** no hardcoded currency; AFN never divided by 100; unknown values stay
unknown (never `0`); finalized financial documents are not silently mutated; order deposits are
liabilities; refunds use `payment.record` with a reason and audit.

## 3. Hard access gate (server authoritative)

States (reuse `ONBOARDING_STATES`, no second machine): `NOT_STARTED` → `IN_PROGRESS` →
`REQUIRES_CONFIGURATION` → `READY_TO_ACTIVATE` → `ACTIVE`; `PAUSED` for suspension.

- `evaluateOnboardingActivation(facts)` — pure predicate; mandatory: IDENTITY, WORKSPACE,
  WORKSPACE_PROFILE, DEFAULT_CURRENCY. Unknown ≠ satisfied.
- `PATCH /api/auth/profile` writes `onboarding_completed_at` **only** when the server gate passes;
  otherwise `422 ONBOARDING_PREREQUISITES_MISSING`. A read failure writes nothing.
- `GET /api/analytics/dashboard` runs `requireOnboardingComplete` **before** the cache: `428
ONBOARDING_REQUIRED` for an incomplete account, `503 ONBOARDING_STATE_UNAVAILABLE` on DB failure.
- `docs/onboarding-server-state-migration.sql` remains **PENDING HUMAN CONFIRMATION**; a missing
  column is treated as «not complete», never as «done».

## 4. Ten acceptance scenarios (fixtures, not ten implementations)

All ten run the same wizard, the same `businessTypes` → DNA resolver, the same currency and gate.
`unknown/unsupported` trade must stay `NOT_OFFERED` — never silently fall back to Retail.

| #   | Scenario               | trade key            | Goods? | DNA highlights                        | Mandatory fields              | Conditional step          | Offline path                   | Acceptance                                |
| --- | ---------------------- | -------------------- | ------ | ------------------------------------- | ----------------------------- | ------------------------- | ------------------------------ | ----------------------------------------- |
| 1   | Clothing retail        | `retail_apparel`     | yes    | variants, size/color, returns         | identity, shop, AFN           | variants + stock          | `local-engine` product/invoice | invoice survives restart                  |
| 2   | Grocery store          | `grocery`            | yes    | batches, expiry, FEFO                 | identity, shop, AFN           | stock_batches             | expo-sqlite + device sale      | FEFO consumes correct batch               |
| 3   | Service business       | `services`           | no     | time, sessions                        | identity, firm, currency      | service delivery sessions | service delivery offline       | session recorded offline                  |
| 4   | Language school (CEFR) | `education_language` | no     | levels, lesson/package credits        | identity, school, currency    | package credits           | `local-package-credits/grant`  | grant idempotent, one spend               |
| 5   | Manufacturing          | `manufacturing`      | yes    | BOM, WIP, waste, batches              | identity, factory, currency   | BOM + work center         | production routes              | consumption posted once                   |
| 6   | Wholesale/distribution | `wholesale`          | yes    | pack sizing, price lists              | identity, warehouse, currency | tiered pricing + pack     | `draft-po-rounded`             | rounds up to whole packs                  |
| 7   | Pharmacy               | `pharmacy`           | yes    | prescription, expiry, regulated audit | identity, pharmacy, currency  | batches + script refs     | offline sale (regulated flags) | **no compliance claim**; audit rows exist |
| 8   | Currency exchange      | `currency_exchange`  | no     | FX rates, dual currency, confirmation | identity, bureau, currency    | FX trade drafts           | `fx-trade-drafts`              | confirmation online-only limitation shown |
| 9   | Gold business          | `gold_jewelry`       | yes    | purity, weight, making charge         | identity, shop, AFN           | `quoteGoldItemPrice`      | offline gold line              | weight/value reported, not invented       |
| 10  | Project-based company  | `projects`           | mixed  | milestones, timesheets                | identity, firm, currency      | project milestones        | `local-projects`               | milestone invoice server-only             |

## 5. Still required for `VERIFIED_COMPLETE`

1. Server gate rolled out to every protected entry (not only the dashboard KPI route).
2. Real browser/device runs of the ten scenarios and the five owner acceptance tests.
3. Live PostgreSQL run of the pending migrations.
4. Save/resume + idempotent submission UX wired into the existing onboarding container.
5. A test file that exercises the ten fixtures through `app.inject`/device engine rather than the
   documentation above.

## 6. Canonical lifecycle — 2026-11-22 forensic remediation

Audit of record: `docs/audit/ONBOARDING-FORENSIC-AUDIT.md` (120 findings).
Plan of record: `docs/audit/ONBOARDING-REMEDIATION-PLAN.md`.

```
Onboarding Draft → Validated Business Profile → Operational DNA →
Capability Composition → Workspace Configuration → Server Activation →
Industry-Aware Application
```

### 6.1 One contract per concept (no parallel engines)

| Concept                 | Single source                                                                            | Consumers                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Industry registry       | `validation/industry-profiles.ts` `INDUSTRY_KEYS`                                        | ui-contract catalogue (derived ids), wizard, settings, backend |
| Selection normalisation | `canonicalIndustryTypes` (dedupe, casing, registry order, legacy/unknown classification) | store setter, both profile writes, draft restore               |
| Selection limit         | `MAX_INDUSTRY_SELECTION` (12)                                                            | UI, `updateProfileSchema`, workspace route                     |
| Primary industry        | `primaryIndustryKeyOf` (ADR-001)                                                         | wizard display, DNA inference, profile resolver                |
| Sales model vs trade    | `SALES_MODEL_KEYS`                                                                       | review summary rows, primary decision                          |
| DNA inference           | `inferOperationalDna` (per-trade + compose)                                              | wizard, settings                                               |
| Capability truth        | `resolveCapabilityPlan` / `resolveCapabilities` (evidence statuses)                      | server view, composition summary                               |
| Activation              | `evaluateOnboardingActivation` + `profiles.onboarding_completed_at`                      | PATCH profile gate, middleware, offline decision               |

### 6.2 Completion order (server-authoritative, idempotent)

1. Books currency (`workspaces.base_currency`) — refusal stops the chain, local rollback.
2. Workspace business profile (`workspaces.business_types`) — canonical, owner-managed.
3. Operational DNA (RPC `workspace_set_operational_dna`, optimistic version; one conflict retry with the refetched version, then stop).
4. Onboarding progress — client may write `NOT_STARTED | IN_PROGRESS | PAUSED` only; `READY_TO_ACTIVATE | ACTIVE` are derived server-side from gate facts.
5. **Activation LAST**: `PATCH /auth/profile { onboardingCompleted: true }` — the gate gathers its own facts; the first timestamp is kept on replay (idempotent).
6. Navigation only after the server answer positively carries `onboardingCompleted: true`.

When the database lacks the profile/DNA migrations (`configurable: false`), steps 2–4
run in documented degraded mode: the device copy is kept, the person is told exactly
what was not saved and why, and activation still requires the server gate.

### 6.3 Draft persistence ownership

- Device: Zustand `hisabche-onboarding`, **versioned (v2) with migrate**, bound to one
  account (`claimForUser`), carries every wizard field incl. `businessNote`,
  `primaryTradeKey`, `savedAt`, `completedAt`.
- Workspace: `workspaces.onboarding_progress` (strict schema, additive fields
  `businessNote`, `primaryTradeKey`, `savedAt`), autosaved debounced with a sequence
  guard; failures are visible and retried, never claimed as saved.
- Reconciliation: server draft restored when strictly newer (`savedAt`) and the local
  wizard is untouched or older; reset re-arms resume; a stale offline server answer
  never erases local completion.

### 6.4 Online/offline parity

- The same pure predicates decide both runtimes: `evaluateOnboardingActivation`
  (server facts) and `evaluateOfflineOnboarding` (device facts).
- `RequireAuth` feeds the verified server answer as `cloudActivated` and the real
  local `completedAt`; `COMPLETE_OFFLINE` is a working state, never a cloud claim.
- Workspace-scoped query keys (`workspaceId`) prevent cross-workspace cache reads.
