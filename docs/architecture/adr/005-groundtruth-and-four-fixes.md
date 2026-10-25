# ADR-005 — Ground-truth corrections and the four named fixes (25 Oct 2026)

## Status

Accepted.

## Context

The implementation prompt (`LOCAL-FIRST-CORE-PROMPT.md`) told this session to re-verify every
line of its §1 against the repo and correct it here if the repo disagrees. It also named four
specific fixes:

1. `evidence` and `server_reason` in `docs/architecture/capability-matrix.csv` must be built
   **from real code**.
2. Golden and property tests must call the **real core functions** (`rowTotal`, `summarize`, …)
   instead of recomputing the answer beside it.
3. The shadow service must be **actually wired to routes**.
4. The RLS policy must follow the **workspace membership chain**, with a **double-run** pg test.

## The prompt's §1 vs the repo (verified 25 Oct 2026)

| Claim in the prompt                        | Measured                  | Verdict                     |
| :----------------------------------------- | :------------------------ | :-------------------------- |
| 462 client endpoints                       | 462                       | ✅                          |
| `available` 159                            | **160**                   | ❌ off by one               |
| `online_required` 288                      | **287**                   | ❌ off by one               |
| `not_supported` 15                         | 15                        | ✅                          |
| `SCHEMA_VERSION = 7`                       | (LOCAL-FIRST scope)       | not re-checked this session |
| Shared core lives in `packages/validation` | confirmed                 | ✅                          |
| No `packages/domain` exists                | 0 packages match `domain` | ✅                          |

The counts are now measured by the generator itself and asserted by
`capability-matrix-csv.test.ts`, so they cannot drift silently again.

## Decision 1 — `evidence` and `server_reason` are derived from source

**What was wrong.** The generator had two fabrications:

- `evidence` fell back to a hard-coded `offline-endpoint-matrix.ts:41` — the line the array opens
  on. **273 of 462 rows** cited it. It proves nothing about the row it sits on.
- `server_reason` was classified by substring-matching the endpoint NAME. **392 of 462 rows**
  came out `other`, including every AI row (the clearest cloud-only capability in the product).

**What it does now** (`scripts/generate-capability-matrix-csv.mjs`):

- `evidence` = `matrix@<file>:<line>` — the row's **own** line, asserted by a test to contain
  that endpoint — plus `server@<file>:<line>` of the registering route, plus
  `engine@<file>:<line>` when a local route serves it, plus `reason@<file>:<line>` when a cloud
  reason was proven.
- Route evidence now applies **plugin mount prefixes read from `backend/src/index.ts`**
  (`server.register(accountingRoutes, { prefix: '/api/accounting' })`). Without them 108
  endpoints reported «no server route» while the route existed.
- `server_reason` comes from **proof rules** over the real service files (an AI provider
  `fetch`, a `resend.emails.send`, `supabase.storage.from(`, a signed webhook delivery, a
  Supabase auth call, a plan gate). The proof's `file:line` is written into the row. A row that
  cannot be proven is **`unproven`**, not `other` — the gap is visible instead of hidden.
- Comments are skipped when proving: the first AI «proof» was a doc comment _mentioning_
  `openrouter.ai`, not a call.

**Measured outcome** (462 rows):

| `server_reason`        | rows | meaning                                          |
| :--------------------- | ---: | :----------------------------------------------- |
| `none`                 |  160 | runs locally today                               |
| `unproven`             |  205 | not proven cloud-only — a localisation CANDIDATE |
| `webhook-delivery`     |   40 | signed delivery to a customer URL                |
| `file-storage`         |   23 | remote object storage                            |
| `ai-provider`          |   15 | external AI provider                             |
| `subscription-billing` |   14 | server-authoritative plan gate                   |
| `auth`                 |    5 | cloud identity owns the credential               |

One row has **no server route at all**: `POST /auth/validate` — a client call the backend never
registered. Recorded, not hidden.

## Decision 2 — the tests call the core, not a copy of it

**What was wrong.**

- `backend/.../golden-vectors.test.ts` and `local-engine/.../golden-vectors.test.ts` each
  re-implemented line subtotal, discount, tax, payment allocation and ledger balance inline and
  compared that against the corpus.
- `core-invariants.property.test.ts` was **tautological**:
  `const totalMinor = subtotal - discount + tax; expect(totalMinor).toBe(subtotal - discount + tax)`.
  That passes if the product is deleted.

**What it does now.** One runner — `packages/validation/src/__golden__/run-vectors.ts` — exported
from the package barrel, called by all four runtimes (Node, backend, local engine; desktop
mobile follow the same entry). Invoice vectors go through **`summarize` + `rowTotal`**; payments
through **`validateAllocations`**; costing through **`planConsumption`/`averageUnitCost`**;
ledger through **`reverseLines`**; period locks through **`evaluatePeriodLock`**.

**Proof the tests can fail** (mutation checks, run this session):

| Injected regression                                            | Caught by                            |
| :------------------------------------------------------------- | :----------------------------------- |
| `payments.domain.ts`: `take = remaining + 1` (over-allocation) | property test — 1 failed             |
| `costing.domain.ts`: `quantity = … + 1` (AVCO denominator)     | golden vectors (COST-002) — 1 failed |

Both files were restored byte-for-byte (`git diff --stat` empty).

**A product truth the corpus forced into the open.** `COST-003` expects
`consumedTotalCostMinor: null` for stock with no cost layers. The core returns `totalCost: 0`
with `isEstimated: true` — deliberately, and `costing-rule.test.ts` already asserts that
(«costs nothing, and admits it, when no price is known at all»). The honest answer is the zero,
with the estimate flag carried; «unknown» belongs to `buildProfitReport`, which does return
`null`. The runner reports the corpus verdict from the core's own `isEstimated` flag instead of
inventing a second arithmetic.

## Decision 3 — shadow verification runs on `/api/payments`, NOT `/api/sync/push`

**Why not sync.** `POST /api/sync/push` is an allow-list that **cannot carry money**:
`sync.service.ts` WRITABLE gives an invoice only `notes, reference, due_date`, and
`warehouse`/`branch`/`exchange_rate`/`product_stock` are read-only arrays. A money comparison
there compares nothing, every time, and passes — imitation of the thing shadow mode exists to
catch.

**Why payments.** `POST /api/payments` accepts money from a client and validates its INPUT
through the core; what nothing compared is what was **stored** against what the core derives
from the same facts. `verifyPaymentPosting` (`backend/src/services/core-shadow.ts`) now does
that and records a divergence through the existing, previously-uncalled
`CoreDivergenceService`, via an `onPosted` hook the route passes.

**Two traps found by actually running it:**

1. **`round2` returns `0` for a non-finite input** (`schemas/money.ts` line 46). A `NaN` amount
   therefore derives a spotless **zero posting** — not a throw, not `NaN` — which would have
   been recorded as a divergence the check itself invented. The facts are now checked before
   the core is called.
2. A diagnostic must never break the payment it inspects: the hook is called **after** the
   write, and its failure is logged, never raised.

**Shadow mode never changes the answer.** It records; the kill switch returns the capability to
`SERVER_LEGACY`.

## Decision 4 — the RLS policy follows the membership chain

**What was wrong.** `docs/core-divergence-migration.sql` keyed its policy on
`current_setting('app.current_workspace_id')` — a setting that appears **nowhere** in this
codebase. On Postgres it creates cleanly, so a migration test would pass while every real read
was denied (it evaluates to NULL). It also `GRANT`ed to `authenticated` without first revoking
the ALL-privileges Supabase gives every new table, and `anon` was left reachable.

**What it does now.** The same chain every other table uses — `accounts`, `invoices`,
`cost_layers`, `warehouse_stock`:

```sql
workspace_id IN (
  SELECT wm.workspace_id FROM public.workspace_members wm
  WHERE wm.user_id = (SELECT auth.uid())
    AND wm.has_access = true AND wm.suspended_at IS NULL
)
```

`REVOKE ALL` from `PUBLIC`, `anon`, `authenticated`, `service_role` **before** granting
`SELECT, INSERT`. No `DELETE`/`TRUNCATE`: evidence must not be erasable by the party it
implicates.

**Run twice against a real Postgres** (`backend/src/__tests__/core-divergence.pg.test.ts`,
executed here via `.agent-notes/run-divergence-pg.mjs` because the backend's vitest config
cannot load in this sandbox): 13/13 checks pass, including «a suspended membership grants
nothing» and «a member cannot write into another business».

**The double run caught a real bug:** `CREATE POLICY` has no `IF NOT EXISTS`, so the second run
failed with «policy already exists». Fixed with `DROP POLICY IF EXISTS`.

## Consequences

- `capability-matrix.csv` is now a code-derived artefact with a CI staleness check
  (`node scripts/generate-capability-matrix-csv.mjs --check`).
- Every customer-facing claim about offline capability traces to a `file:line` that a test
  asserts contains the thing claimed.
- Shadow mode has a caller, a kill switch that was exercised, and a proof that a wrong posting
  produces exactly one divergence row.
- The remaining `unproven` rows are the honest backlog for localisation, not a verdict.

## Open questions

See `docs/architecture/OPEN-QUESTIONS.md`.

---

## ?? CORRECTIONS (25 Oct 2026, round 2) � see ADR-006

Three claims in this ADR did not survive a review that ran the project's **own**
vitest instead of the harnesses described above:

1. **�Shadow mode ... 6 tests executed�** � the tests were run through a
   `.agent-notes` harness, not vitest. In real vitest **all 10 failed** (a class
   spread in `vi.mock` drops static methods). Fixed; now 10/10 in vitest.
2. **�13/13 checks on real embedded Postgres�** � true of the harness, but the
   vitest test could not start Postgres in this environment at all. The migration
   is still verified (13/13), but status is `IMPLEMENTED_NOT_LIVE_VERIFIED`.
3. **The `server_reason` table above (40 `webhook-delivery`, 205 `unproven`)** �
   the webhook proof scanned a whole service directory, so it covered operations
   that never deliver a webhook. Scoping it per endpoint gives **10
   `webhook-delivery` / 235 `unproven`**.
4. The golden runner was exported from the barrel, creating an import cycle that
   `no-import-cycles.test.ts` rejects. It is no longer exported.
5. `domain-ports.ts` / `domain-events.ts` were dead code and have been deleted.
6. `MEASUREMENTS.md` in this round was still fabricated; it has been rewritten
   with measured numbers only.
