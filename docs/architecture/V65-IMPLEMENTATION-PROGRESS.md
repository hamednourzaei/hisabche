# V65 — Implementation progress

Contract: `docs/architecture/V64-PROMPT.md`. Baseline: `docs/architecture/V65-PREFLIGHT.md`.
Every status word below is one of: `IMPLEMENTED_NOT_LIVE_VERIFIED`, `VERIFIED_*`, `NOT_IMPLEMENTED`,
`BLOCKED`, `NEEDS_OWNER_DECISION`.

> **No live verification exists for this change.** There is no running backend, no browser and no
> Postgres on this machine. «Verified» below means: a generated artefact that a `--check` reproduces
> byte for byte, or a test that fails when the fix is undone.

---

## 1. Deliverables

| #   | Deliverable                                              | Status                                           | Evidence                                                         |
| --- | -------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| D1  | Multi-activity Operational DNA (`tradeKeys`)             | `IMPLEMENTED_NOT_LIVE_VERIFIED`                  | `dna-multi-industry.test.ts` — 12 tests                          |
| D2  | `branches` / `warehouses` split, legacy `locations` read | `IMPLEMENTED_NOT_LIVE_VERIFIED`                  | same suite, group «warehouses and branches are independent»      |
| D3  | First Value Checklist derived from the domain            | `IMPLEMENTED_NOT_LIVE_VERIFIED`                  | `first-value.test.ts` — 8 tests                                  |
| D4  | `profiled` column derived from code, not a hand list     | `VERIFIED` (generator `--check`)                 | `generate-coverage-table.mjs --check` → `OK: 118 rows`           |
| D5  | `sellable-industries.json`                               | `VERIFIED` (generator `--check` + guard)         | `sellable-industries.test.ts` — 6 tests                          |
| D6  | `ENGINE-WIRING.csv` from disk                            | `VERIFIED` (generator `--check`)                 | `wiring-matrix.mjs --check` → `OK: 20 engines … 38 capabilities` |
| D7  | Claim guard + the false serial claim corrected           | `VERIFIED` (guard + injection)                   | `capability-claims-match-code.test.ts` — 20 tests                |
| D8  | 5-band business size (`solo / 2-5 / 6-20 / 21-50 / 50+`) | `NEEDS_OWNER_DECISION`                           | see §5.1                                                         |
| D9  | 53 hooks with no consumer                                | `NEEDS_OWNER_DECISION`                           | generated ledger, see §5.2                                       |
| D10 | Migration                                                | none produced — see `docs/MIGRATIONS-PENDING.md` | —                                                                |

---

## 2. What changed, and why

### 2.1 `packages/validation/src/schemas/operational-dna.ts`

- **`inferSingleTradeDna`** is the old body, renamed: one activity, unchanged behaviour.
- **`inferOperationalDna`** is the entry point. One activity → byte-identical to before. Two or more
  → one inference per activity, then `composeOperationalDna`.
- **Why the union and not the primary trade:** `resolveCapabilityPlan` matches _concrete_ axis values
  (`COUNTER_POS`, `JOB_TICKET`, `SPARE_PARTS`, …). Keeping only the primary activity's axes would
  silently switch the other trade's modules off — a shop that also repairs would lose its workshop.
- **Composition rules** (each covered by a test): concrete value beats `UNRESOLVED`; two different
  party kinds become the existing `MIXED_PROFILE`; `SINGLE_LOCATION` is dropped when another topology
  exists; unit tracking combines to `BOTH` / `SERIAL_NUMBERS` / `EXPIRY_DATES` / `NONE`; scalar axes
  (custody, execution site, recurrence, approval depth, regulated domain) keep the primary's value;
  pricing basis is a union. The primary activity controls terminology and `archetypeHint` only —
  never entitlement.
- **`branches` / `warehouses`**: a branch and a warehouse are different facts. `warehouses: 'multiple'`
  sets `WAREHOUSE_NETWORK`; `branches: 'multiple'` sets `MULTI_BRANCH`; neither implies the other.
  The pre-V65 answer key `locations` is still read (`branches` wins when both exist).
- **`tradesWithDnaHints()` + `suggestedOperatingAnswersFor(tradeKeys)`**: the pre-fill for every
  selected activity, where a «yes» from any activity beats a «no».
- A real bug found by the first test run: the single-trade path through `tradeKeys: [x]` dropped
  `tradeKey`, so the trade's own defaults vanished. Fixed by normalising `tradeKey: selected[0]`.

### 2.2 `packages/validation/src/schemas/first-value.ts` (new)

Pure `firstValueSteps(dna, activeModules?)`. Replaces an `archetypeHint` switch inside a component
that fell through to Retail, so a consultant was told to add a product and open the warehouse.
Steps: catalogue (goods / service / mixed), party, appointment (only when bookings are the business),
document (sale or job). A module that is not active produces **no step**, and a business with
`inventory: ['NONE']` never receives a `/warehouse` route.

Every destination is one that exists today:
`/warehouse?add=true` (opens the add-product dialog), `/warehouse?view=products`,
`/customers?add=true`, `/customers?tab=sessions`, `/invoices/new`.

### 2.3 `packages/validation/src/schemas/capability-claims.domain.ts` (new)

Pure rules for «may the registry say this?». Split out so the same rules run against the real
registry (green) and against a deliberately broken copy (red) — the injection test.

It asserts only what the repository can disprove: status/limitation shape, the engine's offline row,
«no route answers this» (a route importing the capability's own evidence disproves it), and
«online only» / «no offline engine». Behaviour-level codes (`*_NOT_WIRED`, `*_UI_BASIC`) are
explicitly **not** asserted — no file graph can disprove a missing behaviour inside a present screen,
and pretending otherwise would be the same dishonesty in the other direction.

### 2.4 `packages/validation/src/schemas/business-capabilities.ts`

`serialized_items` claimed `OFFLINE_SERIAL_IDENTITY_MISSING` — false on this HEAD (the device issues
unit serials offline; see `V65-PREFLIGHT.md` §3.1). Replaced with
`SERIAL_HOLDS_AND_RETURNS_ONLINE_ONLY`, which is what the offline matrix actually says.

### 2.5 UI

- `dashboard/first-value-checklist.tsx` — renders `firstValueSteps(...)`, no archetype switch, no raw
  key fallback, and a new `unavailable` state: a read that **failed** is said, never shown as
  «nothing created yet».
- `dashboard/containers/dashboard-container.tsx` — passes `unavailable` from the three core reads.
- `onboarding/operating-questions.tsx` — per-question options; `branches` and `warehouses` are asked
  separately and «no warehouse» is a real answer.
- `onboarding/containers/onboarding-container.tsx` — `selectedTrades` memo, multi-trade suggestion,
  `inferOperationalDna({ tradeKey, tradeKeys, primaryTradeKey, ...answers })`.

### 2.6 i18n (`fa` / `af` / `en`)

`firstValue.*` (title, unavailable, catalogue goods/service/mixed, party, appointment, document
sale/job), `onboarding.operating.questions.{branches,warehouses}`,
`onboarding.operating.answers.{branch_*,warehouse_*}`, `capabilities.limitations.
SERIAL_HOLDS_AND_RETURNS_ONLINE_ONLY` (added) and `OFFLINE_SERIAL_IDENTITY_MISSING` (removed — it said
something untrue). `onboarding.storeSize` and the three size labels reworded to «business size»;
**the persisted enum is unchanged**, see §5.1.

### 2.7 Generators

- `scripts/capability/wiring-matrix.mjs` (new) → `docs/architecture/universal-core/ENGINE-WIRING.csv`.
  One row per `ENGINE_KEYS` and one per `CAPABILITY_KEYS`, 19 columns, every value read from disk:
  service file, route files that import it, the plugin functions `backend/src/index.ts` actually
  registers, local-engine route, client hook and its re-export, UI host, evidence files present.
  Deterministic (no timestamp) so `--check` compares bytes.
- `scripts/industry/generate-sellable.mjs` (new) → `docs/architecture/industry/sellable-industries.json`.
  `sellable` requires registered **and** profiled **and** workflow-complete **and** every acceptance
  test passed **and** the acceptance evidence recorded at this HEAD. It is not — `0b68fe4` ≠
  `fa4fd32` — so **0 industries are sellable** and every row carries
  `ACCEPTANCE_EVIDENCE_STALE`.
- `scripts/industry/generate-coverage-table.mjs` — `profiled` is derived from
  `operational-dna.ts` + `industry-profiles.ts`, filtered to `INDUSTRY_KEYS`; the hand list (which
  named the non-registry `hotel`) is gone.
- `docs/architecture/capability-matrix.csv` — regenerated; 33 file:line citations were stale.

---

### 2.8 Four more defects the last verification sweep caught

Running the suites at the end (not only at the start) found these. Three were mine and are fixed; one
was already red at HEAD.

1. **Settings → «پروفایل کاری» re-inferred the DNA from the primary trade only.**
   `operating-profile-settings.tsx:90` called `inferOperationalDna({ tradeKey: trade, ...answers })`.
   A shop that also repairs therefore lost the workshop's axes the first time someone pressed
   «ذخیره» — silent data loss in the second consumer of the decision V64 §5 is about. Fixed with
   `tradeKeys: trades, primaryTradeKey: trade` and `suggestedOperatingAnswersFor(trades)`.
   `operating-profile-wiring.test.ts` now asserts both, and gains a new test that fails if either
   consumer pre-fills from one trade.
2. **The first-value arrow did not flip in RTL.** The repository's convention is `rtl:rotate-180`
   on a directional icon (10 other places); the checklist lacked it. Added.
3. **`af` (Dari) limitation string was written in Pashto.**
   `«د سریال لرونکي جنس هولد کول او بیرته راګرځول یوازې آنلاین کار کوي.»` contains four
   Pashto-only letters and `dari-is-not-pashto.test.ts` refused it. Rewritten in Dari:
   «رزرو یک جنس سریالدار و برگشت آن تنها با انترنت انجام میشود.» This is the guard working: a
   Pashto string is a perfectly valid string, so nothing else would have noticed.
4. **`packages/api/src/hooks/useOfflineActivities.ts` imported its own package barrel**
   (`from '@hisabche/api'`), which `no-import-cycles.test.ts` refuses. Already red at HEAD
   (`git show HEAD:…` contains the same line), so it was not caused here — but it blocked a clean
   run, and the guard names the rule to satisfy. Fixed by naming the module (`'./activity'`, which
   exports both `useActivities` and `activityKeys`). Nothing else in that legacy file was touched;
   its `any`s and stale header remain and are listed as remaining defects.

---

## 3. Verification actually run

| Command                                                     | Result                                                                                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit` — `packages/validation`                  | **exit 0**, no diagnostics                                                                                                              |
| `npx tsc --noEmit` — `packages/ui`                          | **exit 0**, no diagnostics                                                                                                              |
| `npx tsc --noEmit` — `packages/api`                         | **exit 0**, no diagnostics                                                                                                              |
| `npx tsc --noEmit` — `packages/app-shell`                   | **exit 0**, no diagnostics                                                                                                              |
| `npx tsc --noEmit` — `packages/local-engine`                | **exit 0**, no diagnostics                                                                                                              |
| `npx tsc --noEmit` — `packages/store`                       | **exit 0**, no diagnostics                                                                                                              |
| `npx tsc --noEmit` — `backend`                              | **exit 0**, no diagnostics                                                                                                              |
| `npx tsc --noEmit` — `apps/web`                             | **exit 0**, no diagnostics                                                                                                              |
| `npx vitest run` — `packages/validation`                    | **84 files, 1064 tests passed**, 0 failed (before V65: 80 files, 1024 tests; before the second round: 82 / 1052)                        |
| `npx vitest run` — `packages/ui`                            | **222 files (221 passed, 1 skipped), 2798 passed, 0 failed** (before V65: 9 red tests)                                                  |
| `npx vitest run` — `packages/api`                           | **39 files, 302 tests passed**, 0 failed                                                                                                |
| `npx eslint` — 12 changed source files + 4 changed tests    | **0 errors, 0 warnings** (the 13 pre-existing warnings were all in `packages/api/src/hooks/useOfflineActivities.ts`, rewritten in §6.5) |
| `node scripts/capability/wiring-matrix.mjs --check`         | `OK: 20 engines (available=1 not_verified=1 partial=15 unwired=3) · 38 capabilities (available=3 partial=30 planned=5)`                 |
| `node scripts/industry/generate-sellable.mjs --check`       | `OK: 67 registered · 37 profiled · 13 workflow-verified · 0 sellable`                                                                   |
| `node scripts/industry/generate-coverage-table.mjs --check` | `OK: 118 rows match the repository.`                                                                                                    |
| `node scripts/generate-capability-matrix-csv.mjs --check`   | `OK: capability-matrix.csv is up to date` (674 rows)                                                                                    |
| `node scripts/migrations/pending-ledger.mjs --check`        | `OK: 279 migrations · 160 with VERIFY · 170 with a PG test`                                                                             |
| `node scripts/api/unused-hooks.mjs --check`                 | `OK: 685 exported hooks · 53 with no consumer`                                                                                          |
| Injection: the false serial code restored                   | the guard went **red** (3 failures), then green again after the restore                                                                 |
| Injection: `af` limitation written in Pashto                | `dari-is-not-pashto.test.ts` went **red** on `messages/af/common.json`, then green after the Dari rewrite                               |

### 3.1 Localisation parity, measured

A leaf-key walk of `packages/i18n/messages/{fa,af,en}/common.json`:

| Language | Leaf keys |
| -------- | --------- |
| `fa`     | 11847     |
| `af`     | 11847     |
| `en`     | 11847     |

Union 11847, and **zero** keys missing in any language — the three catalogues are exactly equal, so
no key this change added can throw at render time. `firstValue.*` (16 leaves),
`onboarding.operating.questions.{branches,warehouses,locations}`,
`onboarding.operating.answers.{branch_*,warehouse_*}` and
`capabilities.limitations.SERIAL_HOLDS_AND_RETURNS_ONLINE_ONLY` are present in all three.

### 3.2 Stored-profile size, measured

`pg_column_size(operational_dna) < 4096` is a real constraint (`MIGRATIONS-PENDING.md` §6), so the
composed profile was serialised and counted:

| Profile                              | Bytes   |
| ------------------------------------ | ------- |
| All 67 registered activities at once | **862** |
| `beautySalon` + `retail`             | 554     |
| `manufacturing` + `wholesale`        | 485     |
| `restaurant` + `courier`             | 467     |
| `retail` + `wholesale`               | 462     |
| Single `retail`                      | 434     |

The worst case the code can produce is 21% of the limit.

---

## 4. Verification that is missing

| Gate                                               | State                                                                                          |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Real Postgres (`*.pg.test.ts`)                     | `BLOCKED` — no `initdb.exe` on this machine                                                    |
| Live Supabase / real HTTP against a running server | `BLOCKED` — not available here                                                                 |
| Browser E2E of the onboarding → dashboard path     | `BLOCKED_EXTERNAL` — Playwright not installed                                                  |
| `next build` / Electron / Gradle                   | not run — forbidden by the task                                                                |
| Native round-trip of the DNA into SQLite/JSONB     | not run — the write path is unchanged and the schema is versioned; see `MIGRATIONS-PENDING.md` |

---

## 5. Decisions the task did not make

### 5.1 Business size — `NEEDS_OWNER_DECISION`

V64 §5.1 asks for five bands (`solo / 2-5 / 6-20 / 21-50 / 50+`). The persisted value today is
`StoreSize = 'small' | 'medium' | 'large'` (`packages/store/src/slices/onboarding.slice.ts:14`,
`packages/validation/src/schemas/auth.schema.ts:108`).

**Corrected during V65:** an earlier assumption in this task said five bands need a database enum
migration. Measured, that is false — `store_size` is plain `text` with no CHECK constraint
(`docs/onboarding-server-state-migration.sql:27`; `MIGRATIONS-PENDING.md` §6). The change is
code-only.

It is still `NEEDS_OWNER_DECISION`, for the reasons the code cannot decide: existing rows hold
`small` / `medium` / `large`, and mapping them onto five bands would silently change what those
stored values **mean** for every existing customer; and V64 does not say whether a band is headcount,
revenue or invoice volume, which the label and the analytics event both depend on. V65 therefore
**only changed the wording** («business size», not «store size») and left the values alone.

### 5.2 The hooks with no consumer — now a measured ledger, still `NEEDS_OWNER_DECISION`

V64 phase 0 names `useExchangeInvoice`, `useSalesOrder`, `useSerialHolds` and the project-task hooks,
and asks that each be wired or logged with a reason. They are still unused (measured at HEAD: **685**
exported hooks, **53** with no consumer). Wiring them is a product decision per hook (which screen,
which menu, which capability gate), not a mechanical change; doing it blind would create the fake UI
the repository forbids.

They are no longer an assertion in a report: `docs/architecture/universal-core/UNUSED-HOOKS.csv` is
generated by `scripts/api/unused-hooks.mjs` (one row per hook, with the file that defines it, any
second definition, and the server route its own request path matches, with `file:line` evidence), and
`unused-hooks-ledger.test.ts` fails when the ledger goes stale. Every row says
`NEEDS_OWNER_DECISION` — the generator refuses to decide, on purpose.

### 5.3 `suggestedOperatingAnswers` vs `suggestedOperatingAnswersFor`

The single-trade function is kept and unchanged; the multi-trade function composes it. Both live in
the same module so a future trade hint is added in one place.

---

## 6. Second round — closing the verification gaps

The owner accepted the report as the end of _implementation_, not of verification, and asked for the
six open items in his own order. This section is that round; nothing above changed except where noted.

### 6.1 Acceptance evidence, re-recorded against HEAD

`docs/architecture/industry/acceptance-results.json` was recorded at `0b68fe4…` while HEAD is
`fa4fd32…`, which is why the sellable count was zero. A runner now exists:
`scripts/industry/run-acceptance.mjs` is the **only** writer of that file. It reads the file→industry
map from `coverage-data.mjs` (no second copy), runs the mapped files once with vitest's JSON reporter,
and records one row per file with `status`, `tests`, `passed`, `failed`, `skipped`, `durationMs` and
`date`.

- Files: **10**. Tests: **54**. All passed.
- `commit`: the real `git rev-parse HEAD`.
- `worktreeDirty` + `dirtyFiles`: the runner says whether the tree it tested was the commit it named.
  It was dirty (the owner commits himself), so the file records that instead of implying a clean run.
- A file vitest did not report is written as `not_run` with a reason. The runner exits non-zero when
  anything failed or did not run, and writes nothing at all when vitest produced no JSON — no report
  means no evidence.

### 6.2 The sellable predicate was wrong, and re-recording exposed it

`generate-sellable.mjs` wrote `sellable` as its own expression that omitted `POSTGRES_EVIDENCE`, while
the same row's `missingEvidence` still contained it. Refreshing the acceptance commit alone would have
flipped 13 industries to `SELLABLE` on HTTP-injection tests — the exact claim this mission forbids.

`sellable` is now derived from one place: `missingEvidence.length === 0`. Two more evidence codes were
added — `POSTGRES_EVIDENCE` (V64 §13.17) and `EVIDENCE_NOT_ON_COMMITTED_TREE` — and the report carries
limitations read off the measured counts (`POSTGRES_EVIDENCE_MISSING`,
`BROWSER_VERIFICATION_NOT_RUN`, `ACCEPTANCE_EVIDENCE_STALE`, `EVIDENCE_NOT_ON_COMMITTED_TREE`).

Proof that the guard is real: with the old predicate restored the generator wrote **13 sellable** and
`sellable-industries.test.ts` failed in three places (retail sold without Postgres evidence, a
non-empty `missingEvidence` on a "sellable" row, and selling on a dirty tree). Restored, it is green.

Measured after the re-record: **67 registered · 37 profiled · 13 workflow-verified · 0 sellable ·
0 with Postgres evidence**. The evidence is fresh; the industries are still not sellable, and now the
report says why in machine-readable form.

### 6.3 The migration ledger is generated and complete

`docs/MIGRATIONS-PENDING.md` is now produced by `scripts/migrations/pending-ledger.mjs` from the tree:

| Measured                           | Count   |
| ---------------------------------- | ------- |
| `docs/*-migration.sql`             | **279** |
| with a `VERIFY-*` companion        | **160** |
| with a `*.pg.test.ts` that runs it | **170** |
| without a verification query       | **119** |
| without a PostgreSQL test          | **109** |

Every row is `PENDING HUMAN CONFIRMATION`, because which migration a database received is recorded in
that database. §2 of the ledger holds the read-only `supabase_migrations.schema_migrations` query that
converts the ledger into an answer, and §3 says plainly that the table order is not a dependency
order. `migrations-ledger.test.ts` fails if the file goes stale, if a migration is missing or
duplicated, if any row claims another status, or if the owner's query is removed.

### 6.4 The unused hooks are a ledger, not a to-do list

`scripts/api/unused-hooks.mjs` measures every hook `packages/api` exports and every file that mentions
it (including the api package itself — one hook calling another is a consumer) and writes
`docs/architecture/universal-core/UNUSED-HOOKS.csv`.

| Measured                                              | Count   |
| ----------------------------------------------------- | ------- |
| exported hooks                                        | **685** |
| with no consumer anywhere                             | **53**  |
| of those, whose own request path matches a real route | **36**  |

Each row carries the defining file, a second definition if one exists, the matched route, and
`file:line` evidence. The evidence comes from the hook's own `apiClient` path, not from its name —
name matching produced nonsense (`useLogin` matching a wall-logout route). Every row says
`NEEDS_OWNER_DECISION`; the generator has no opinion, because «wire them all» is exactly what the
owner ruled out.

### 6.5 `useOfflineActivities.ts`

The file was named as a remaining defect. What was actually there:

- a header claiming it lived at `packages/ui/src/hooks/activity/`, where a **second 308-line copy**
  of the same hook also lived;
- an `OfflineActivityService` whose every method was a TODO returning nothing, so the "offline" feed
  was empty by construction and lost everything on refresh;
- `any` in five places, a placeholder `'current-user-id'`, an unused `useTranslation`, raw `fetch`
  calls to a relative path (which cannot work in the desktop or mobile shells), an untyped merge of
  group DTOs with item DTOs followed by a sort on a field groups do not have, and two
  `set-state-in-effect` warnings from a 30-second "sync" that synced nothing.

Both copies had zero consumers. The api copy is now the one implementation: typed, over the real
`useActivities` / `useUnreadCount` / mark-read mutations in `activity.ts`, with `unreadCount` typed
`number | null` (an unknown count is not zero), no local store to lie about, and the connectivity
listener calling the refresh instead of an effect calling `setState`. The UI file re-exports it, so
the old import path still resolves and the fabricated DTOs are gone. `eslint` on that file: **13
warnings before, 0 after**.

### 6.6 What this round did not close

| Item                             | Status                 | Why                                                                                                                                                                                                                                                  |
| -------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL journeys              | `BLOCKED`              | `embedded-postgres` is installed but the platform binary package (`@embedded-postgres/windows-x64`) is not; `initdb.exe`, `psql`, Docker and `C:\Program Files\PostgreSQL` are all absent. Fixing it is a dependency install the owner must approve. |
| Browser journeys                 | `BLOCKED_EXTERNAL`     | `@playwright/test` and `playwright` are not installed; adding them is a new dependency.                                                                                                                                                              |
| 5-band business size             | `NEEDS_OWNER_DECISION` | needs no migration (`store_size` is plain `text`), needs the mapping of existing `small\|medium\|large` rows and a decision on what the bands measure. Recorded as `D-01` in `docs/architecture/OPEN-DECISIONS.md` (`Blocks: none`).                 |
| 53 unused hooks                  | `NEEDS_OWNER_DECISION` | ledger delivered; each hook needs a product answer, not a wire. Recorded as `D-02` in `docs/architecture/OPEN-DECISIONS.md` (`Blocks: none`).                                                                                                        |
| 279 migrations applied/unapplied | owner action           | read-only query in `MIGRATIONS-PENDING.md` §2.                                                                                                                                                                                                       |

### 6.7 Verification run for this round

Sequential, from each package, on the final tree:

| Command                                    | Result                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `npx tsc --noEmit` — `packages/validation` | **exit 0**                                                                                             |
| `npx tsc --noEmit` — `packages/api`        | **exit 0**                                                                                             |
| `npx tsc --noEmit` — `packages/ui`         | **exit 0**                                                                                             |
| `npx tsc --noEmit` — `packages/app-shell`  | **exit 0** (after the api barrel gained one export)                                                    |
| `npx tsc --noEmit` — `apps/web`            | **exit 0**                                                                                             |
| `npx vitest run` — `packages/validation`   | **84 files, 1064 tests passed**, 0 failed                                                              |
| `npx vitest run` — `packages/api`          | **39 files, 302 tests passed**, 0 failed                                                               |
| `npx vitest run` — `packages/ui`           | **222 files (221 passed, 1 skipped), 2798 passed, 2 skipped**, 0 failed                                |
| `npx eslint` — 6 files this round          | **0 errors, 0 warnings**                                                                               |
| `node scripts/industry/run-acceptance.mjs` | **10/10 files, 54/54 tests**, commit `fa4fd32`, worktree dirty                                         |
| six `--check` generators                   | all green (wiring matrix, sellable, coverage table, capability matrix, migration ledger, unused hooks) |
| `git diff --check`                         | **exit 0**                                                                                             |

The two new ledger guards are not decorative: undoing the sellable predicate made
`sellable-industries.test.ts` fail in three places (13 industries sold on HTTP evidence), and the
registries stay stale-proof through their `--check` runs inside the suites.

---

## 7. The two open product decisions, recorded

`docs/architecture/OPEN-DECISIONS.md` is now the register: `D-01` (three business-size bands versus
the five-band scale) and `D-02` (the 53 hooks with no consumer). Each row carries the decision, the
code that would change, the reversible default the repository already runs on, and one more field
that matters more than the rest: **`Blocks: none`**.

«Blocks: none» is not a sentence in a document — it is asserted.
`packages/validation/src/__tests__/open-decisions.test.ts` (7 tests) checks that:

- the register has exactly `D-01` and `D-02`, with the columns the parser reads;
- every `Status` is `NEEDS_OWNER_DECISION` and every `Blocks` cell is `none`;
- every repository path the document names exists on disk, so «the code that would change» is real;
- the band count matches the `z.enum` in `packages/validation/src/schemas/auth.schema.ts` **and** the
  `StoreSize` union in `packages/store/src/slices/onboarding.slice.ts` — two sources that must agree
  before the document may claim a number;
- the hook count matches the data-row count of `UNUSED-HOOKS.csv`, and the row links that file;
- no file under `scripts/` and no `package.json` script mentions `OPEN-DECISIONS` — the requirement
  itself: a pending decision cannot become a build input or a test gate.

Measured at this HEAD: **3 bands** (`small`, `medium`, `large`) in both packages, **53** data rows
in the CSV. Neither row needs a migration — `store_size` is `text` with no `CHECK`
(`docs/onboarding-server-state-migration.sql:27`), and the hooks are code, not schema. The guard was
proved red once before being left green: changing `D-02`'s `Blocks` cell to `the test suite` failed
exactly the test «leaves both decisions to the owner and blocks nothing», and the cell was restored.

### 7.1 Verification for the register

| Command                                                                       | Result                                    |
| ----------------------------------------------------------------------------- | ----------------------------------------- |
| `npx vitest run src/__tests__/open-decisions.test.ts` — `packages/validation` | **1 file, 7 tests passed**                |
| `npx tsc --noEmit` — `packages/validation`                                    | **exit 0**                                |
| `npx vitest run` — `packages/validation` (whole package)                      | **85 files, 1072 tests passed**, 0 failed |
| `npx eslint` — the new test file                                              | **0 errors, 0 warnings**                  |
