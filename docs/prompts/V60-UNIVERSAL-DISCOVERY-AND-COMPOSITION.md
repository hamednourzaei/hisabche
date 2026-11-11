# HISABCHE V60 — UNIVERSAL BUSINESS DISCOVERY & COMPOSITION

_A teaching brief for the implementation agent. Read it from the beginning to the end before you touch a file._

---

## 0. Read this first: why V60 exists

Up to V59 Hisabche grew trade by trade (clothing, salon, mobile, repair, gold, exchange). That gives six
good experiences and a list of 68 trade names. It does **not** give the real goal:

> Any business that arrives tomorrow, even one that is not on the list, must be able to describe how it works.
> Hisabche must then turn that description into needs, choose the existing engines that meet those needs,
> say honestly what is missing, and build the experience for that business. It must never pretend.

V60 does not add a seventh trade. V60 builds the **machine that produces trades**:
discovery → problems → capabilities → engines → experience → proof.

You are the student here; I am the teacher. Each section tells you **what**, **why**, **where in the code**,
**how**, and **which tests prove it**. When the code disagrees with this brief, the code wins. Record the
difference and continue.

---

## 1. Rules that do not change (inherited from V59; AGENTS.md is canonical)

- Read `AGENTS.md`, `CLAUDE.md` and `.claude/skills/hisabche-session-rules/SKILL.md` first.
- Never commit, push, stash, reset, rebase, run `checkout --` or `clean`. Never touch `.env`.
  Never run live SQL. No dependency or lockfile changes. No production builds. No subagents.
- Migrations live only in `docs/<name>-migration.sql`, each with a matching `docs/VERIFY-<name>.sql` and
  `backend/src/__tests__/<name>.pg.test.ts`. They are additive and idempotent, with a rollback block and
  `NOT VALID` → `VALIDATE`. Every new table gets
  `ENABLE ROW LEVEL SECURITY` + `REVOKE ALL … FROM PUBLIC, anon, authenticated, service_role` + an explicit
  `GRANT` to `service_role` (copy the block in `docs/salon-01-migration.sql` §"Privileges and RLS").
  **V58 forgot this on three tables; do not repeat it.**
  Status wording: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.
- Money is integer minor units. Unknown is not zero. `workspace_id` is the only tenant boundary. Multi-table
  writes go through Postgres functions called with `.rpc()`. Ledger writes only through
  `ledger.postDocument` / `reverseDocument`.
- No `any`, `@ts-ignore` or `eslint-disable`. `exactOptionalPropertyTypes` holds. Every i18n key goes into
  `packages/i18n/messages/{fa,af,en}/common.json`. Dari is not Persian copied: see `.claude/DARI-GLOSSARY.md`.
  V59 left en with 7 fewer keys than fa/af; `t()` throws on a missing key, so fix that first.
- **Execution model (same as V59):** implement every slice and write every test, but run **nothing** that
  verifies until §12. Static work is allowed: reading, `rg`, `pnpm code-intel` queries, `git status/diff --stat`,
  and the i18n parity script. After each slice, update `docs/architecture/V60-IMPLEMENTATION-PROGRESS.md`.
- **Three red lines (owner):**
  1. Unknown never becomes Retail or Physical Goods.
  2. Registered never means complete.
  3. No trade gets its own accounting, inventory, sales, sync or permission core.

---

## 2. Phase 0 — reconcile (static only)

1. **V59 is probably still uncommitted** (≈80 dirty files when this brief was written). Run `git status --short`.
   The local tree is authoritative. Read the five `docs/architecture/V59-*.md` files and re-verify each claim
   against source with `[VERIFIED path:symbol]`. A V59 claim with no source or test becomes a V60 gap.
2. Run `node scripts/audit-unwired-routes.mjs` (it is static and cheap) and save its output into the preflight.
   **When this brief was written it listed 123 backend routes with zero client callers.** That list is the
   single most important input to V60 (see §6).
3. Write `docs/architecture/V60-PREFLIGHT-AUDIT.md` with:
   - the evidence table in §3, re-checked;
   - the unwired-route list, grouped by family;
   - the capability × engine × consumer map (§4);
   - the risks and the `NEEDS_OWNER_DECISION` list.
     Then continue without asking.

---

## 3. What the teacher found in the code (verify each line; do not trust it blindly)

| #   | Finding                                                                                                                                                                                                                                                                                                                      | Evidence                                                                                                                                                                                        | Why it matters                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1  | The capability registry has **13** keys: 3 available, 5 partial, 5 planned                                                                                                                                                                                                                                                   | `packages/validation/src/schemas/business-capabilities.ts` → `CAPABILITY_KEYS`, `CAPABILITIES`                                                                                                  | Most real needs cannot even be named (resources, contracts, delivery, projects…)                                                                       |
| F2  | `recipe_bom` is **planned**, yet a BOM engine exists                                                                                                                                                                                                                                                                         | `manufacturing_save_bom` / `manufacturing_complete`, `services/manufacturing.service.ts`, `computeProductionCost` in `schemas/manufacturing-cost.ts`                                            | The registry under-reports. It drifts from the code; nothing ties a status to evidence                                                                 |
| F3  | `length_pricing` / `volume_pricing` are **planned**, yet the domains exist                                                                                                                                                                                                                                                   | `schemas/universal-core/area-dimension.domain.ts`, `roll-batch.domain.ts`                                                                                                                       | Same drift; check whether they have callers                                                                                                            |
| F4  | 68 industry keys, only **17** have a profile override (16 trades plus a shared `vocabulary` entry); the other 52 fall back to the generic profile                                                                                                                                                                            | `schemas/industry-profiles.ts` → `INDUSTRY_KEYS`, `OVERRIDES`                                                                                                                                   | "Registered" is currently reported as if it meant "supported"                                                                                          |
| F5  | **Two** models describe the same operating questions                                                                                                                                                                                                                                                                         | `industry-profiles.ts` → `operatingCharacteristicsSchema` (6 fields) **and** `operational-dna.ts` → `YES_NO_QUESTIONS` / `OperatingAnswers` (10 + locations + staffArrangement)                 | A parallel model: the rule "one model" is already broken                                                                                               |
| F6  | DNA has 9 axes; the docs say 8                                                                                                                                                                                                                                                                                               | `operationalDnaSchema` (`unitTracking` added in V55); `docs/architecture/OPERATIONAL-DNA-MATRIX.md`                                                                                             | The docs disagree with the code                                                                                                                        |
| F7  | DNA cannot express: pricing basis, who owns the asset, where the work happens, recurrence, approval depth, regulated domain                                                                                                                                                                                                  | `operational-dna.ts` enums                                                                                                                                                                      | Discovery cannot tell a rental from a sale, or a clinic from a salon                                                                                   |
| F8  | **Engines that exist with no client:** sales orders (`orders.routes.ts`: confirm/cancel/fulfill/invoice), freight trips, courier deliveries + COD, delivery notes (`transport.routes.ts`), livestock (`agriculture.routes.ts`), project members + time entries (`project.routes.ts`), package-credit grant, work-order PATCH | `scripts/audit-unwired-routes.mjs`                                                                                                                                                              | Pattern §7.1 of CLAUDE.md: "the rule exists and nobody calls it". Most of the "missing engines" in the owner's analysis are **unwired, not unwritten** |
| F9  | Pure engines already written: cash forecast, payment delay, stale opportunities                                                                                                                                                                                                                                              | `services/intelligence/forecast.domain.ts` (`forecastCash`, `averagePaymentDelay`)                                                                                                              | Owner command center (P10) has a base                                                                                                                  |
| F10 | Assets with depreciation, timesheets with billing, an approval gate, a conflict service, accounting dimensions                                                                                                                                                                                                               | `services/assets/depreciation.domain.ts`, `services/timesheets/billing.domain.ts`, `services/workflow/approval-gate.domain.ts`, `services/conflict/`, `services/dimensions/dimension.domain.ts` | These are the building blocks for rental, professional services, approvals and per-project profit                                                      |
| F11 | Exclusion-constraint booking already used                                                                                                                                                                                                                                                                                    | `docs/appointment-conflict-02-migration.sql` (`btree_gist`), salon `service_resources` + guard trigger (`docs/salon-01-migration.sql`)                                                          | The Resource & Capacity engine must **generalize** these, not add a third                                                                              |
| F12 | V59 added a presentation profile and `resolveCapabilityPlan` / `evaluateFeatureAccess`                                                                                                                                                                                                                                       | `operational-dna.ts` → `presentationProfileSchema`; `business-capabilities.ts:639, 756`                                                                                                         | V60 extends them; it does not write new ones                                                                                                           |
| F13 | Industry coverage generator, 43 status rows (37 VERIFIED_SUPPORTED, 6 PARTIALLY_SUPPORTED)                                                                                                                                                                                                                                   | `scripts/industry/coverage-data.mjs`, `generate-coverage-table.mjs`, guard `packages/validation/src/__tests__/industry-coverage-table.test.ts`                                                  | The one place to report honest status per trade                                                                                                        |

**Lesson for the student:** before writing "engine X is missing", search for it. In this repository, "missing"
usually means one of three things: a service with no route, a route with no hook, or a hook with no screen.
Each one has a different fix.

---

## 4. The target model, mapped onto real code

```
Layer 1  Foundation  workspace · branch · party · catalog · money · ledger · inventory · audit · permission · sync
Layer 2  Engines     sales · orders · appointments/resources · work orders · projects · production · procurement
                     · delivery · quality · contracts/recurring · workforce · settlement · costing · forecasting
Layer 3  Profile     DNA (+ new axes) · problem profile (P1–P10) · capability plan · terminology · KPIs · policies
Layer 4  Experience  role home · navigation · forms · dashboard · reports · alerts · guided onboarding (web/win/android)
```

Build the **engine registry** as data, not as new code paths. File: extend
`packages/validation/src/schemas/business-capabilities.ts` with an `ENGINES` record. Each engine records:
its owner service (`backend/src/services/...`), its local-engine route (`packages/local-engine/src/routes/...`)
or `null`, its client hook (`packages/api/src/hooks/...`) or `null`, its UI host (hub + `?tab=` + `?view=`) or
`null`, and its offline status taken from `offline-endpoint-matrix.ts`.

| Engine                   | Owner that already exists (verify)                                                                 | State today                 |
| ------------------------ | -------------------------------------------------------------------------------------------------- | --------------------------- |
| Sales/invoice            | `services/invoice.service.ts`, `invoice.routes.ts`                                                 | wired                       |
| Sales orders             | `services/orders/*`, `orders.routes.ts`                                                            | **unwired**                 |
| Appointments / resources | `services/service-delivery`, `salon`, `appointment.routes.ts`, appointment-conflict-02             | partly wired                |
| Work orders / repair     | `services/repair`, `manufacturing` work orders                                                     | wired (repair)              |
| Projects / time          | `services/project.service.ts`, `timesheets/`                                                       | partly unwired              |
| Production / BOM         | `manufacturing.service.ts`, `manufacturing-cost.ts`                                                | wired                       |
| Procurement              | `purchasing.service.ts`, `supplier/`                                                               | wired; planning missing     |
| Delivery / logistics     | `services/transport/transport.service.ts`                                                          | **unwired**                 |
| Quality / claims         | `sales/warranty.service.ts`, `universal-core/warranty.domain.ts`, `return-disposition.domain.ts`   | partial                     |
| Contracts / recurring    | `automation.service` (recurring invoice), `commerce/installment.service.ts`, `late-fee.service.ts` | partial, no contract object |
| Assets / rental          | `services/assets/`                                                                                 | no rental flow              |
| Agriculture / livestock  | `agriculture.routes.ts`                                                                            | **unwired**                 |
| Costing                  | `inventory-costing/`, `accounting/profit-report.domain.ts`, `dimensions/`                          | wired; no cost objects      |
| Forecast / insights      | `intelligence/forecast.domain.ts`, `insights/`                                                     | partly wired                |

---

## 5. Slice plan (in this order; each slice ends with a progress-doc update)

### Slice 1 — One operating-questions model (fix F5)

- **What:** make `OperatingAnswers` (`operational-dna.ts`) the **only** model. Rewrite
  `industry-profiles.ts → operatingCharacteristicsSchema` as a derived adapter: keep its public type and
  `resolveBusinessProfile(types, explicitPrimary?, characteristics?)` signature, and compute it from the answers.
  Keep the refine `CANNOT_PRODUCE_WITHOUT_STOCK`.
- **Why:** two models for one fact drift apart (lesson: "two formulas for one number").
- **Callers to re-check:** `rg "operatingCharacteristicsSchema|OperatingCharacteristics|DEFAULT_OPERATING_CHARACTERISTICS"`,
  backend `services/workspace-profile.ts`, onboarding UI under `packages/ui/src/components/ui/onboarding/`.
- **Tests:** extend `packages/validation/src/__tests__/industry-profiles.test.ts` (round trip: answers →
  characteristics is identical for every legacy stored value; `unknown` stays `unknown`); a source guard that
  no second `z.enum(['yes','no','unknown'])` operating schema exists outside `operational-dna.ts`.

### Slice 2 — Deeper DNA, backward compatible (fix F6, F7)

Add **optional** axes to `operationalDnaSchema`. A DNA saved earlier must still parse. Read a missing axis as
`UNRESOLVED`, never as a default business type.

| New axis          | Values                                                                                       | Feeds                                            |
| ----------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `pricingBasis`    | `UNIT, WEIGHT, LENGTH, AREA, VOLUME, TIME, RATE_BOARD, CONTRACT, TIERED, UNRESOLVED` (array) | pricing capabilities                             |
| `assetCustody`    | `OWN_STOCK, CUSTOMER_ASSET_IN_CUSTODY, RENTED_OUT_ASSET, NONE, UNRESOLVED`                   | repair (customer device ≠ inventory), rental     |
| `executionSite`   | `PREMISES, CUSTOMER_SITE, MOBILE_ROUTE, REMOTE, UNRESOLVED`                                  | delivery, field service, security/cleaning       |
| `recurrence`      | `ONE_OFF, RECURRING_SERVICE, SUBSCRIPTION, LEASE, UNRESOLVED`                                | contracts and recurring billing                  |
| `approvalDepth`   | `NONE, SINGLE, MULTI_STEP, UNRESOLVED`                                                       | workflow approval gate                           |
| `regulatedDomain` | `NONE, HEALTH_RECORDS, PRESCRIPTION, FINANCIAL_KYC, FOOD_SAFETY, UNRESOLVED`                 | a **compliance gap only**; never grants anything |

- Add questions to `YES_NO_QUESTIONS` / `OperatingQuestion` **only** where a yes/no works. Examples:
  `rentsOutAssets`, `worksAtCustomerSite`, `billsRecurring`, `holdsCustomerAssets`, `needsApprovals`.
  `operatingQuestionsFor(answers)` must stay **adaptive**: it asks a follow-up only when an earlier answer makes
  it relevant. A barber must never be asked about livestock.
- Extend `inferOperationalDna` and `setupGapsOf`. Every new `UNRESOLVED` becomes a setup gap with an i18n key.
- Server: `backend/src/services/workspace-profile.ts` + `routes/workspace-profile.routes.ts` keep
  `expectedVersion`. Local: `packages/local-engine/src/routes/workspace-profile.ts` must accept the same
  schema (V59 V23 table). No migration is needed if the DNA is stored as jsonb; **verify that** before
  writing one.
- Update `docs/architecture/OPERATIONAL-DNA-MATRIX.md` to the real axis count.
- **Tests:** `packages/validation/src/__tests__/operational-dna.test.ts`:
  - legacy DNA fixtures (with no new axes) parse, and resolve to the same capabilities as before;
  - each new axis maps to its capabilities;
  - `regulatedDomain` never adds an `available` capability;
  - the adaptive question set for at least 8 families (barber, rental, clinic, contractor, courier,
    farm, wholesaler, restaurant).
    Parity: `packages/local-engine/src/__tests__/workspace-profile.test.ts` accepts and round-trips the new axes.

### Slice 3 — Capability registry v2, with status computed from evidence (fix F1–F3)

- Extend `CAPABILITY_KEYS`. Add only keys whose owner you can name, or mark them `planned` with `engine: null`:
  `resource_capacity`, `work_queue_sla`, `sales_orders`, `procurement_planning`, `three_way_match`,
  `project_costing`, `timesheet_billing`, `contracts_recurring`, `deposits_liability`, `installments`,
  `package_credits`, `delivery_pod`, `fleet_dispatch`, `asset_rental`, `quality_inspection`,
  `warranty_claims`, `cost_allocation`, `approval_workflow`, `owner_forecast`, `livestock_register`,
  `crop_cycle`, `room_nights`, `area_pricing`, `roll_cutting`. Fix `recipe_bom`, `length_pricing` and
  `volume_pricing` against F2/F3.
- Add `engine: EngineKey | null` to `CapabilityDefinition`.
- **The honesty rule, enforced by a guard:** `available` requires all of the following:
  1. `evidence.sources` exist on disk;
  2. `evidence.tests` exist;
  3. the engine has a client hook **and** a UI host;
  4. the offline matrix has rows for its endpoints.
     `partial` must list `limitations`. Extend the existing guards
     `packages/validation/src/__tests__/capability-has-consumer.test.ts` and `capability-composition.test.ts`;
     do not write a parallel guard.
- Labels: one `capabilities.<key>.label` / `.limitation.*` key per capability in fa/af/en.
- Regenerate `docs/architecture/capability-matrix.csv` **only** with `node scripts/generate-capability-matrix-csv.mjs`
  (in §12).

### Slice 4 — Problem profile P1–P10 and the composition algorithm

Create **one** pure module. Do **not** write a second resolver: extend `resolveCapabilityPlan` in
`business-capabilities.ts` and put the problem data in a new sibling file
`packages/validation/src/schemas/business-problems.ts` (`[NEW]`, alongside `business-capabilities.ts`).

```ts
export const BUSINESS_PROBLEMS = [
  'P1_customer_revenue_visibility',
  'P2_pricing_and_true_cost',
  'P3_order_queue_and_capacity',
  'P4_stock_and_resource_location',
  'P5_procurement',
  'P6_workforce_productivity',
  'P7_cash_debt_settlement',
  'P8_true_profit',
  'P9_quality_warranty_obligations',
  'P10_owner_control',
] as const

// For each problem: which DNA conditions make it relevant, and which capabilities solve it.
export interface ProblemRule {
  problem: BusinessProblem
  appliesWhen: (dna: OperationalDna) => boolean | 'unknown'
  needs: (dna: OperationalDna) => readonly CapabilityKey[]
}
```

The pipeline is deterministic. **Every step is a pure function with its own test:**

1. `answers → inferOperationalDna` (exists).
2. `dna → problemsOf(dna)`: each problem is `applies`, `not_applicable` or `unknown`. `unknown` produces a
   question; it never produces a guess.
3. `problems → requirementsOf`: the union of capability needs, with a reason for each ("P3 because intake =
   APPOINTMENT_BOOKING").
4. `requirements → resolveCapabilityPlan(...)`: each requirement becomes `available | partial | planned |
unsupported`, with limitations. `requires`/`conflicts` are honoured.
5. `plan → resolvePresentationProfile` (V59): navigation, dashboard parts, quick actions, emptyState keys and
   KPIs from the plan. **Planned/unsupported capabilities never produce a live menu entry.**
6. Output a `CompositionPlan`: `{ dna, problems, requirements, plan, gaps, nextQuestions, presentation }`.

- **The `other` industry key:** it maps to a DNA where every unanswered axis is `UNRESOLVED`. The plan shows the
  base menu, setup-gap prompts and the next questions. It must never fall back to retail. Check
  `primaryIndustryKeyOf` and `resolveBusinessProfile` for any path that does.
- **Free-text description** ("we rent film cameras"): out of V60 scope for automatic parsing. If you add an
  AI suggestion, it may only **propose answers** through the existing AI pipeline
  (`services/ai/pipeline`), and the human must confirm each one (the rule in CLAUDE.md: "the model fills fields
  only"). Default: do not build it, and record it as `NEEDS_OWNER_DECISION`.
- **Tests** (`packages/validation/src/__tests__/business-composition.test.ts`, `[NEW]`): a fixture table of
  **25 families**, taken from the owner's analysis:
  supermarket, wholesale/distribution, clothing/fabric roll, electronics, hardware/timber, restaurant, bakery,
  hotel, cafe, salon, clinic, pharmacy, education, professional services, manufacturing, construction,
  auto repair, farm/livestock, courier/logistics, real estate, gold, exchange, travel agency, events venue,
  cleaning/security, **plus "film-equipment rental" as the unseen case**.
  For each family assert:
  - the problems that apply;
  - the required capabilities;
  - which of them are `available`, and that each listed gap is honest;
  - no retail fallback;
  - that `regulatedDomain` families (clinic, pharmacy) get a compliance gap and no available medical capability.
    Use plain fixture data. **No `fast-check`: it is not installed, and adding dependencies is forbidden.**

### Slice 5 — Three-level industry status (fix F4, red line 2)

- Extend `scripts/industry/coverage-data.mjs` (the generator source; never hand-edit the generated table) with
  three separate fields per industry key:
  `registered` (in `INDUSTRY_KEYS`), `profiled` (has an `OVERRIDES` entry or an archetype preset), and
  `workflowComplete` (the end-to-end acceptance tests in §8 exist and are listed).
- `packages/validation/src/__tests__/industry-coverage-table.test.ts`: assert that `workflowComplete ⇒ profiled ⇒
registered`, and that every `workflowComplete` row names test files that exist.
- UI: `packages/ui/src/__tests__/industry-support-note.test.ts` and the onboarding support note show the honest
  level. A generic-profile trade shows "supported with general tools" text, never a trade-specific promise.
  Check `landing-claims.test.ts`: no landing or FAQ claim may exceed `workflowComplete`.

### Slice 6 — Wire or delete the unwired engines (fix F8; the biggest real win)

For **each** route family that `audit-unwired-routes.mjs` lists, decide one of three things and record the
decision in the preflight:

- **WIRE:** hook + offline-matrix row + feature-registry entry + a section inside an **existing** hub + i18n +
  tests.
- **DELETE:** the route is dead code (§14 "no dead code"); remove the route and its service, and update
  `backend/src/__tests__/unwired-capability.test.ts`.
- **KEEP-INTERNAL:** it is called by a job, a webhook, the public API or MCP. Record the caller.

Priority families and their homes (no new top-level routes; see `hisabche-ux-consolidation`):

| Family                                       | Route file                  | Home                                                                                                                    | Notes                                                                                                                    |
| -------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Sales orders (confirm/fulfill/invoice)       | `orders.routes.ts`          | Sales hub `/invoices` → new `?tab=orders` or a `?view=`                                                                 | `invoiceFromOrder` already uses `InvoiceService.create`; `order.*` webhooks come from the state machine (CLAUDE.md rule) |
| Delivery notes, courier + COD, freight trips | `transport.routes.ts`       | Sales › orders → a delivery view; COD settles through `PaymentsService`                                                 | proof of delivery = an append-only event with actor and time                                                             |
| Project members, time entries                | `project.routes.ts`         | existing project hook `packages/api/src/hooks/projects.ts` → its screen                                                 | milestone billing via `timesheets/billing.domain.ts` → `InvoiceService.create`                                           |
| Livestock                                    | `agriculture.routes.ts`     | Warehouse hub as a register view, **only** if the owner wants farms now; otherwise mark it `planned` and DELETE or KEEP | `NEEDS_OWNER_DECISION`                                                                                                   |
| Package-credit grant                         | `package-credits.routes.ts` | Customers › sessions                                                                                                    | —                                                                                                                        |
| Work-order PATCH                             | `manufacturing.routes.ts`   | production screen                                                                                                       | `completed` stays refused (BUG-092)                                                                                      |

Each wired family needs:

- `packages/api/src/hooks/<family>.ts` with **literal** paths (the offline guard reads them);
- rows in `packages/validation/src/schemas/offline-endpoint-matrix.ts`. A family is `available` only with a
  local route, an outbox and sync; otherwise it is `online_required`, and **every endpoint of one feature shares
  one status** (the guard `offline-endpoint-matrix.test.ts`);
- `feature-registry.ts` entries, plus the closed counts in `packages/ui/src/__tests__/cloud-required.test.ts`
  (each new server feature +1, with a dated comment);
- `concurrency-safety-map.ts` entries for write routes;
- `requireWorkspaceContext` + `requireCapability` on every write route.

### Slice 7 — Resource & Capacity engine (generalize F11; do not add a third booking system)

- Read `docs/salon-01-migration.sql` (`service_resources`, guard trigger) and
  `docs/appointment-conflict-02-migration.sql` (`btree_gist` exclusion). Decide on paper which one is the
  canonical owner. Prefer: `service_resources` becomes the generic resource (kinds already in
  `schemas/salon.ts → RESOURCE_KINDS`: extend it to table, room, vehicle, machine, equipment, court), and
  **one** booking table with `tstzrange` + `EXCLUDE USING gist (resource_id WITH =, during WITH &&)` for
  exclusive resources.
- Migration `docs/resource-capacity-01-migration.sql` + VERIFY + pg test. The pg test proves: two concurrent
  bookings of the same exclusive resource → exactly one succeeds **and the error message is checked**; tenant
  isolation; run twice = no-op; maintenance blocks booking; releasing frees the slot.
- Salon sessions, appointments and (later) rentals and tables reference this one booking. Do not migrate old
  rows destructively; old rows without a booking stay as they are.
- Shared rule `packages/validation/src/schemas/resource-capacity.ts` (`[NEW]`): `freeSlots`, `overlaps`,
  `utilization`. It is used by the server, the local engine and the UI. Test it in validation.
- Reading: PostgreSQL range types and exclusion constraints —
  https://www.postgresql.org/docs/current/rangetypes.html#RANGETYPES-CONSTRAINT ;
  Martin Fowler, _Range_ — https://martinfowler.com/eaaDev/Range.html

### Slice 8 — Cost objects and true profit (P2, P8)

- **Do not build a cost-accounting engine.** Accounting dimensions already exist
  (`backend/src/services/dimensions/dimension.domain.ts`, tables `accounting_dimensions`, `dimension_values`,
  `dimension_requirements`). A **cost object** (project, work order, repair ticket, service session, trip,
  branch) is a dimension value on ledger lines.
- Direct costs (materials via `inventory-costing`, labour via timesheets/commission, trip costs) post with the
  dimension. Profit per cost object comes from `profit-report.domain.ts` grouped by dimension. Read it first;
  extend it; never write a second profit formula. A cost object with unknown cost shows profit `null`
  ("unknown is not zero").
- Overhead allocation is **owner policy**: implement only an explicit, configured allocation key (no invented
  percentages). If none is configured, show "overhead not allocated". Tag it `NEEDS_OWNER_DECISION`.
- **Tests:**
  - `backend/src/__tests__/profit-by-cost-object.test.ts`, with fixtures in two currencies and one object with
    unknown cost;
  - a guard that no new `profit =` formula appears outside `profit-report.domain.ts` (extend
    `packages/ui/src/__tests__/unknown-is-not-zero.test.ts` if it fits).
- Reading: activity-based costing, overview — https://en.wikipedia.org/wiki/Activity-based_costing

### Slice 9 — Contracts and recurring obligations (P7, P9)

- A contract = party + terms + a schedule of obligations (bill, deliver, inspect, renew) + an SLA. Build it **on**
  the existing pieces:
  - billing: the recurring invoice in `automation.service` (the one job runtime, `scheduler/index.ts`);
  - instalments and late fees: `commerce/installment.service.ts` and `late-fee.service.ts`;
  - deposits: the order-deposit domain (`universal-core/order-deposit.domain.ts`).
    **Deposits are a liability until earned**; follow the existing deposit posting and do not recognize revenue
    early.
- Migration `docs/contracts-01-migration.sql` only if no existing table fits. Check `subscription-order.service.ts`
  and `customer-profile` first, and record what you found.
- Lease / rental = contract + resource booking (Slice 7) + serial asset (`stock_serials`) + return inspection
  (`return-disposition.domain.ts`).
- **Tests:**
  - a schedule produces exactly one invoice per period (idempotent key per contract and period);
  - termination stops future invoices and keeps history;
  - an SLA breach is flagged and never auto-penalized unless a policy exists.
- Reading: IFRS 15 (contract liabilities and deposits) —
  https://www.ifrs.org/issued-standards/list-of-standards/ifrs-15-revenue-from-contracts-with-customers/

### Slice 10 — Procurement planning and three-way match (P5)

- Reorder suggestions from the existing stock insights (`local-engine/routes/stock-insights.ts`,
  `backend/src/services/insights/`) and `intelligence/forecast.domain.ts`. A **suggestion** creates a draft
  purchase order through `purchasing.service.ts`; nothing is ordered automatically.
- Three-way match: purchase order ↔ receipt ↔ purchase invoice, per line (product, variant, quantity, price).
  Put the pure rule in `packages/validation/src/schemas/procurement-match.ts` (`[NEW]`); a mismatch blocks
  payment approval through the existing approval gate (`workflow/approval-gate.domain.ts`). It is never silently
  corrected.
- Supplier scorecard: lateness and price variance, read from receipts. Reuse the supplier-risk weighting already
  in the code; keep the scale constants side by side (lesson: "two constants of one scale").
- **Tests:** match/mismatch matrix (partial receipt, over-receipt, price drift, a variant mismatch); reorder
  rounding to the purchase unit.

### Slice 11 — Quality, warranty and claims as one chain (P9)

- One append-only `quality_events` model attached to a document (receipt, work order, delivery, return, repair):
  check, pass/fail, defect, rework, actor, time. Before creating it, check `services/audit.service.ts` and the
  repair-ticket events table. If an append-only event table can be extended, extend it.
- A warranty claim = `warranty.domain.ts` + repair ticket + return disposition. A claim never moves stock or money
  by itself: its effects are explicit operations on the existing cores.
- **Tests:** a failed inspection on receipt routes the goods to quarantine through an existing movement type; a
  claim on an expired warranty is refused with a translated code; the history is immutable (trigger).

### Slice 12 — Owner command center (P10)

- Use the V59 role-start registry (`packages/ui/src/components/ui/dashboard/DashboardRegistry.ts`); add widgets,
  not pages.
- Each alert has: a reason code, the numbers behind it, a link to the place where the decision is made
  (lesson: "put the message where the decision is taken"), and an `unknown` state.
- Alerts:
  - cash forecast (`forecastCash`);
  - late payers (`averagePaymentDelay`);
  - stock-out risk;
  - capacity idle/overbooked (Slice 7);
  - projects over budget (Slice 8);
  - contracts due (Slice 9);
  - procurement mismatches (Slice 10);
  - open quality failures (Slice 11).
- **Tests:**
  - every widget is hidden when its capability is not `available`;
  - permission hides money from roles without it, both on the server (`dashboard-visibility.domain.ts`, `hidden`
    list) and in the UI;
  - forecast with too little history returns `insufficient_data`, never 0.

---

## 6. Offline, sync and platforms (applies to every slice)

- Every pure rule lives in `packages/validation`. The server and `packages/local-engine` both call it.
  `apps/desktop` and `apps/mobile` hold adapters only.
- An engine is `available` offline only with a local route, local persistence (`packages/app-bridge/src/local-migrations.ts`),
  an outbox mutation, sync application (`packages/app-shell/src/features/sync/sync-engine.ts`: each new status
  needs its own branch), a conflict policy (`conflict-state.ts`: `PENDING_REVIEW`) and a reconnect test.
  Otherwise it is `online_required`, shown with `<CloudRequiredNotice />`.
- Resource bookings, serial claims, currency positions and money conflicts become `PENDING_REVIEW`. There is
  never silent last-write-wins.
- Reading: Ink & Switch, _Local-first software_ — https://www.inkandswitch.com/local-first/ ;
  Stripe, idempotent requests — https://docs.stripe.com/api/idempotent_requests ;
  Supabase RLS — https://supabase.com/docs/guides/database/postgres/row-level-security ;
  PostgreSQL advisory locks — https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS

---

## 7. UI rules for every new surface

- `PageHub` / `HubTabs` + one `SegmentedControl`. Tabs live in `?tab=`, sections in `?view=`. A new route is the
  last resort; justify it in the preflight and add it to `apps/web/next.config.js` `moved`,
  `packages/app-shell/src/app/app.tsx`, `DESKTOP_ROUTES`, `navigation.ts` and `app/robots.ts`.
- Use `DataTable`, `TableFilterSelect`, `SelectField`, `apiErrorMessage()`, `asList<T>()`, `useLocalePush`,
  `useTerminology()` (V59), and `invalidateMoneyCaches` after money writes. The error state and the empty state
  are two separate branches. Use logical CSS and tokens only.
- Every new section gets a docs article in `DOCS_ARTICLES` (`docs-content.ts`) + `ROUTE_DOCS_MAP`.
- A planned or unsupported capability is never shown as a live button; show it as "not available yet", with
  its limitation text.

---

## 8. Acceptance: what "a family works" means

For each family in the Slice 4 table, `workflowComplete` may be set **only** when an HTTP test exists that drives
the real server with `buildServer()` + `app.inject()`. Copy the pattern in
`backend/src/__tests__/v59-http-routes.test.ts` and `http-e2e-business-day.test.ts`. The test must cover:
**intake → operation → delivery → payment → ledger → report**, with balances asserted (not row counts).
V60 is expected to raise `workflowComplete` for: wholesale (orders + delivery), professional services
(projects + time + milestone invoice), rental (contract + booking + serial + return), and courier (delivery +
COD). The remaining families stay honest `profiled` or `registered`.

Create `docs/architecture/V60-FAMILY-ACCEPTANCE-MATRIX.md`, with families as rows and P1–P10 as columns. Each
cell is `available / partial / planned / unsupported`, plus the test file that proves it.

---

## 9. Owner decisions (apply the safe default, tag it, continue)

| Decision                                 | Safe default                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| Livestock / crop                         | Do not build new UI. Wire only if the owner says yes; otherwise `planned` |
| Clinic records, prescriptions, insurance | `unsupported` + a compliance gap; build nothing medical                   |
| Hotel PMS (room nights, housekeeping)    | `room_nights` = planned; a room can be a resource (Slice 7)               |
| Overhead allocation key                  | none; show "not allocated"                                                |
| SLA penalties                            | flag only, no automatic penalty                                           |
| AI free-text discovery                   | not built                                                                 |
| Route optimization / fleet tracking      | planned; trips and POD only                                               |

---

## 10. Do-not-create list (repeat of V59 §3, plus)

No second capability resolver, problem engine, booking table, profit formula, contract billing job, approval
system, event log or onboarding flow. Before you create a file, write in the progress doc what you searched for
and why nothing fit.

---

## 11. Files you will most likely touch (verify each one first)

- `packages/validation/src/schemas/`: `operational-dna.ts`, `industry-profiles.ts`, `business-capabilities.ts`,
  `business-problems.ts` [NEW], `resource-capacity.ts` [NEW], `procurement-match.ts` [NEW], `salon.ts`,
  `feature-registry.ts`, `offline-endpoint-matrix.ts`, `index.ts` exports.
- `packages/validation/src/__tests__/`: `operational-dna.test.ts`, `industry-profiles.test.ts`,
  `capability-has-consumer.test.ts`, `capability-composition.test.ts`, `business-composition.test.ts` [NEW],
  `industry-coverage-table.test.ts`, `resource-capacity.test.ts` [NEW], `procurement-match.test.ts` [NEW].
- `packages/api/src/hooks/`: `orders.ts` [NEW], `transport.ts` [NEW], `projects.ts`, `workspace-profile.ts`, and
  the barrel `index.ts`.
- `packages/ui/src/components/ui/`: onboarding (adaptive questions), the Sales hub (orders/delivery views),
  `dashboard/DashboardRegistry.ts`, the project screen, and `business-packs/salon-sections.tsx` (resource
  migration).
- `packages/local-engine/src/routes/workspace-profile.ts` and the `__tests__` for it.
- `backend/src/routes/`: `orders`, `transport`, `project`, `agriculture`, `workspace-profile`; services as listed in §4.
- `backend/src/__tests__/`: `unwired-capability.test.ts`, `v60-http-families.test.ts` [NEW],
  `resource-capacity-01.pg.test.ts` [NEW], `profit-by-cost-object.test.ts` [NEW], and `contracts-01.pg.test.ts`
  [NEW, only if a migration is created].
- `docs/`: the new migrations + VERIFY files; `docs/architecture/V60-*.md`;
  `OPERATIONAL-DNA-MATRIX.md`; `UNIVERSAL-BUSINESS-ARCHITECTURE.md`.
- `scripts/industry/coverage-data.mjs` (source only).
- `packages/i18n/messages/{fa,af,en}/common.json`.

---

## 12. Final verification (run once, after all slices are written)

1. `git diff --check`, `git status --short`. No lockfile or `.env` change.
2. `node scripts/generate-capability-matrix-csv.mjs` and `node scripts/industry/generate-coverage-table.mjs`.
3. `npx tsc --noEmit` in: validation, api, store, ui, app-shell, local-engine, backend, apps/web, apps/desktop,
   apps/admin.
4. ESLint on changed files only, from each package folder.
5. New and changed test files first; then each full suite **one at a time** (never in parallel). Set
   `TMP/TEMP=C:/Users/hamed/Desktop/hisabche/.esbuild-tmp`. For the backend run
   `npx vitest run --exclude '**/*.pg.test.ts'`; desktop runs `npx jest`.
6. `*.pg.test.ts`: if `@embedded-postgres/windows-x64/native/bin/initdb.exe` is missing (it is, on this
   machine), mark them `BLOCKED` with that exact reason. Never mock them green.
7. `node scripts/audit-unwired-routes.mjs` again. Report the count before and after; every remaining route
   carries a decision (§5 Slice 6).
8. i18n parity across fa/af/en: equal counts, and the 7 missing en keys from V59 resolved.
9. At most 3 fix rounds per failure group, then record it as `BLOCKED` with evidence. Never weaken a guard. When a
   guard encodes an **old decision** that V60 changed on purpose, rewrite it with the new decision and the same
   strictness, and say so in the report.

---

## 13. Persian final report (after §12 only)

1. A decision: «آماده‌ی بررسی برای Production» / «آماده نیست» / «بخشی آماده است، بخشی مسدود است».
2. The baseline (HEAD, dirty files, V59 state).
3. The evidence table from §3, with what changed.
4. The DNA, problem and capability results, with the composition for the 25 families plus the unseen
   "film-equipment rental" case.
5. The family × P1–P10 matrix.
6. The unwired-route count before and after, with a decision per family.
7. The platform matrix (web / Windows / Android / local DB / backend / live).
8. The exact commands and their real numbers.
9. The migrations in run order, each with its VERIFY file and status `PENDING HUMAN CONFIRMATION`.
10. Remaining gaps and owner decisions.
11. Edit accounting.

Allowed statuses only: `VERIFIED_COMPLETE` · `IMPLEMENTED_NOT_LIVE_VERIFIED` · `VERIFIED_WITH_LIMITATIONS` ·
`BLOCKED` · `NOT_IMPLEMENTED`. Nothing is `VERIFIED_COMPLETE` without a real HTTP request or a real database.

---

## 14. Final directive

Start with Phase 0 now. Wire what already exists before you write anything new. Fix the one-model violations
before you add axes. Make every status come from evidence. Then compose. Do not run verification until §12. Do
not commit, push or build.
