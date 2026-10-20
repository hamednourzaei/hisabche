# Agent M — Offline → Online migration (Phase 8), with full tests and debugging

> Fourth parallel agent. Read first, in this order: `CLAUDE.md`,
> `.claude/skills/hisabche-session-rules/SKILL.md`, `hisabche-backend`,
> `hisabche-database`, `hisabche-migrations`, `hisabche-offline`,
> `hisabche-testing`, `hisabche-debugging`, `.claude/DEBUG-PLAYBOOK.md`,
> `docs/PARALLEL-AGENTS-PROMPT.md` (shared rules, ownership — E, P7, A run in
> parallel), Phase 8 of `docs/offline/OFFLINE-EDITION-PROMPT.md`,
> `docs/offline/entitlement/00-CONTRACT.md` (upgrade credit),
> `.claude/reverse-and-import/00-SPEC.md` (the file-import runner this reuses),
> `.claude/accounting-integrity/00-SPEC.md` («unknown is not zero»).
>
> **One step per session. After each step: Persian report (files, real
> command output, table of real numbers, status label, «files edited / edit
> operations»), then wait for «ادامه».** Until M5 is green the owner does NOT
> sell the OFFLINE→ONLINE upgrade.

---

## 0. Non-negotiable rules for this work

1. **The device stays offline until the server is proven right.** No step
   changes the device's edition, deletes, locks or rewrites device data. The
   switch to cloud happens only after reconciliation says MATCHED **and** the
   owner of the workspace confirms. On MISMATCH or FAILED the device keeps
   working exactly as before.
2. **Reconciliation reads Postgres, not call results.** Counting successful
   calls proves nothing. Re-read the stored rows and compare balances, stock,
   ledger, documents.
3. **Two numbers, never confused.** `local_number` (what was printed on the
   device) and the cloud's official number are separate fields. The printed
   history stays findable by its local number. Reusing the local number as
   the cloud number is allowed only if M0 proves it cannot collide with the
   cloud sequence and its uniqueness constraint.
4. **Re-running is safe at the database level.** Idempotency keys are derived
   from the LOCAL record id (never from the attempt or the job id), and each
   service already de-duplicates on its key; where a service has no such
   guarantee, M reports it and the owner of that service adds it — M never
   adds a client-side «already done?» check as the only protection.
5. **Every financial effect through its existing service.** Customer →
   `CustomerService.create`; product + opening stock → `ProductService.create`
   / `recordOpeningStock`; invoice → `InvoiceService.create`; payment →
   `PaymentsService.recordPayment`; cancel → `InvoiceService` (`reverseEffects`);
   transfer → the warehouse transfer service; cost → the costing service. **If
   no service can recreate an effect, STOP and report it** — never write a
   business table directly (CLAUDE.md: «import goes through the entity's
   service, not the table»; no compensating DELETE; supabase-js has no
   transactions → multi-table writes are Postgres functions).
6. **Workspace, owner, members, permissions first.** The data lands in a NEW
   cloud workspace owned by the licence's account, with `has_access` written
   explicitly, base currency = the device's base currency, time zone = the
   device's stored zone. Never merge into an existing workspace that has data.
7. Shared rules from the parallel prompt: one writer per file, editing
   discipline, only your test files while working (full suites + builds are
   E's at the end), no commit/push, no DDL on live Supabase, no `any` /
   `eslint-disable` / dead code / UI theater, fa + af + en.

## 1. Ownership

| Files                                                                                                                                           | Owner                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `packages/local-engine/src/export/**` (new)                                                                                                     | **M**                                                                                                                              |
| `backend/src/services/cloud-migration/**`, `backend/src/routes/cloud-migration.routes.ts` (new)                                                 | **M**                                                                                                                              |
| `docs/cloud-migration-01-migration.sql`, `docs/VERIFY-cloud-migration-01.sql`, `backend/src/__tests__/cloud-migration*.test.ts`, `*.pg.test.ts` | **M**                                                                                                                              |
| `docs/offline/migration/**`                                                                                                                     | **M**                                                                                                                              |
| i18n family `cloudMigration.*` (by script)                                                                                                      | **M**                                                                                                                              |
| Customer/Product/Invoice/Payments/ledger/costing/transfer services                                                                              | owners per the parallel prompt — **M calls, never edits**; a missing guarantee → note in `docs/parallel/handoff.md`                |
| Device «اتصال به ابر» screen                                                                                                                    | **P7** owns `packages/ui/src/lib/capability/**`; the screen itself is M's, built from shared `@hisabche/ui` shadcn components only |
| Admin migration center (A5)                                                                                                                     | **A** — M provides the API and documents it in handoff.md                                                                          |
| Upgrade credit / payment                                                                                                                        | **E**                                                                                                                              |

---

## M0 — Survey the code, then the contract (NO product code)

**M0.a Survey (write findings with file:line, nothing assumed):**

- The file-import runner: `claimRun`, `IMPORT_LIMITS`, `MIGRATION_RUNNING`
  lease, 2-minute takeover, `MIGRATION_INTERRUPTED`, `reconcileInvoices`,
  `mig-inv-<hash(identity)>` keys (`backend/src/services/migration/**`).
  M reuses this runtime; it does not build a second job system
  (`job-authority-guard.test.ts`).
- For EACH service in rule 5: its signature, how it de-duplicates
  (Idempotency-Key? unique constraint? none?), what it writes (ledger,
  movements, cost layers), whether it accepts a historical date and a frozen
  exchange rate, whether it can set the document number or only `nextval`.
- The local schema (`packages/app-bridge/src/local-schema.ts`, version) and
  the engine's tables: every table → «moved by service X» or «not moved,
  because …».
- Workspace creation path and membership (`has_access` explicit,
  `x-workspace-id`).
  Produce `docs/offline/migration/00-SURVEY.md`. **Any effect without a
  service = a blocker listed at the top.**

**M0.b Contract** `docs/offline/migration/00-CONTRACT.md`:

- State machine: REQUESTED → BACKUP_CREATED → PREVIEWED → UPLOADING →
  RECONCILING → AWAITING_CONFIRMATION → COMPLETED | FAILED | ROLLED_BACK, with
  every transition, who triggers it, what is stored, and what the device shows.
- Order of recreation (time-ordered): workspace/members → accounts → units →
  warehouses → customers → products (+ opening stock with buy price → cost
  layer; without → no layer, cost stays unknown) → exchange rates → invoices
  in creation order (purchase before the sales that consume them) → payments
  → transfers → cancellations → manual journal entries.
- Numbering decision (rule 3) with the uniqueness analysis.
- Frozen rates: each invoice keeps its own rate; never today's rate.
- Costing: rebuilt by the workspace's method (FIFO / AVCO) in time order;
  expected result = the device's figures.
- ROLLED_BACK: what it means on the server (the new workspace is retired —
  never DELETE of business rows) and on the device (nothing to undo).
- Open questions for the owner. Stop.

---

## M1 — Device export

- `packages/local-engine/src/export/`: a versioned package (format version,
  schema version, device id, licence id, created at) containing every table
  listed in the contract, in order, with a SHA-256 checksum per section and
  for the whole. Read-only on the device: nothing deleted, nothing locked.
- A local **preview** from the SAME numbers the reconciliation will compare:
  counts per entity; receivables/payables **per currency**; stock per
  product×warehouse; trial balance totals; profit per invoice with cost status
  (known/estimated/partial/unknown — `null`, never 0).
- Tests: package round-trip; checksum detects a flipped byte; preview equals
  the engine's own reports.

## M2 — Server import (resumable, idempotent)

- Upload in chunks; the job runs on the existing runner (lease, takeover,
  interrupted state). One request processes one chunk.
- Every record through its service, key = `cmig-<entity>-<hash(licence_id,
local_id)>`. A record that fails stops its dependants and is reported with
  the local id, the service error code and the input — the job continues with
  independent records, then ends FAILED with a list, not a silent partial.
- The mapping table (local id → cloud id) is written in the SAME Postgres
  function/transaction as the effect, or recoverable from the idempotency
  record — never a separate write that can be lost between two calls.
- Migration `docs/cloud-migration-01-migration.sql` (job state, id mapping,
  differences), additive, idempotent, `REVOKE ALL` first, forward-only state
  trigger; `VERIFY-cloud-migration-01.sql`; `cloud-migration-01.pg.test.ts`
  runs it twice on real Postgres. Status for the owner:
  «Post-migration verification query generated — PENDING HUMAN CONFIRMATION».

## M3 — Reconciliation and switch

- Re-read from Postgres (rule 2): count per entity; invoice totals and
  receivables **per currency**; payments and allocations; stock per
  product×warehouse; cost layers remaining; trial balance (debit = credit and
  equal to the device); profit report per invoice with the same cost status.
- Result stored per check: `MATCHED` or `MISMATCH` with expected, actual,
  difference and the local ids involved.
- MATCHED → AWAITING_CONFIRMATION → the workspace owner confirms on the device
  → COMPLETED: subscription becomes ONLINE (E's service), the device switches
  to the cloud edition, the local DB is kept as a read-only backup file.
- MISMATCH/FAILED → nothing switches; the device stays offline; the admin
  sees the differences (A5).

---

## M4 — Tests (the owner's question: «100 invoices, does it work?»)

### Fixture — built through the LOCAL ENGINE, never by inserting rows

A device DB created by calling the engine's routes, with expected numbers
**computed by hand in the test file** next to each assertion (CLAUDE.md:
«calculate the expected number by hand»), plus a scale assert:

- base currency AFN; 2 warehouses; 30 products (20 with buy price, 10
  without); 40 customers;
- purchases: 10 in USD (rates 70.5, 71.2, …), 5 in EUR (rates 76, 77) —
  each rate different and frozen;
- sales: 60 in AFN, 20 in USD, 5 that consume a product with no buy price
  (cost unknown → profit `null`);
- payments: 25 full, 15 partial (some in USD against USD invoices only);
- 5 cancelled invoices (after payment on 2 of them → reverse effects);
- 3 transfers between warehouses; total 100 sales+purchase invoices.
- Two variants: FIFO workspace and AVCO workspace.

### Must-pass cases (real Postgres via the embedded-postgres helpers)

| #   | Case                                                                   | Must be true                                                                                                                                    |
| --- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Happy path FIFO                                                        | MATCHED on every check; every figure equals the device and the hand-computed value                                                              |
| 2   | Happy path AVCO                                                        | same, with average cost                                                                                                                         |
| 3   | Kill at invoice 60, resume                                             | exactly 100 invoices, no duplicate payment/ledger line/movement/cost layer; MATCHED                                                             |
| 4   | Kill inside one invoice (after the invoice row, before its ledger)     | resume completes that invoice once; trial balance balanced                                                                                      |
| 5   | Whole migration run twice                                              | second run creates nothing; MATCHED                                                                                                             |
| 6   | Two workers take the same job (lease)                                  | one wins, the other gets the lease error; result identical to #1 (assert the winner's result AND the loser's error message)                     |
| 7   | Corrupted package (flipped byte)                                       | refused at upload by checksum; nothing written                                                                                                  |
| 8   | Record the server refuses (e.g. foreign invoice without rate injected) | job FAILED with that local id and error code; dependants skipped; device untouched                                                              |
| 9   | MISMATCH forced (alter one cloud row in the test after import)         | reconciliation reports the exact difference; nothing switched                                                                                   |
| 10  | Unknown cost preserved                                                 | the 5 sales keep cost status unknown and profit `null` in the cloud — never 0                                                                   |
| 11  | Currencies never summed                                                | no total adds AFN + USD + EUR; receivables per currency equal the device                                                                        |
| 12  | Frozen rates                                                           | each USD/EUR invoice's ledger lines use its own rate; changing today's rate before migration changes nothing                                    |
| 13  | Numbering                                                              | every local number findable; no unique-constraint violation; cloud sequence continues after the max                                             |
| 14  | Target workspace                                                       | new workspace, owner = licence account, `has_access` true, base currency and zone from the device; an existing workspace with data is refused   |
| 15  | Device after every case                                                | device DB byte-identical (checksum) to before the migration                                                                                     |
| 16  | Injection                                                              | for 3, 5 and 9: remove the protection (idempotency key, checksum, reconciliation read) → the test goes red; restore → green. Paste both outputs |

## M5 — Debugging protocol (when anything is red)

Follow `.claude/DEBUG-PLAYBOOK.md` and `hisabche-debugging`:

1. Reproduce with the smallest fixture that fails (one invoice if possible);
   paste the failing assertion and the full error.
2. Read the Postgres state directly in the test (the rows, not the service's
   answer). Check the five repeating patterns in CLAUDE.md §7 first: unused
   rule, type ≠ runtime check, error and empty merged, silently wrong number
   (`.limit`, estimated count), absence of a signal.
3. Name the root cause with file:line before changing code. Fix in the file's
   owner (handoff note if not M). No loosened assertion, no fixture that only
   exists to pass, no catch into an empty list.
4. Re-run the single test, then the whole M4 set; injection-test the fix.
5. Record the bug in `docs/parallel/handoff.md` (E copies it into
   `.claude/BUG-REGISTRY.md` and lessons at the end).

## M6 — Report and handoff

- Persian report: every M4 case with its real output line, numbers table
  (invoices, payments, balances per currency, stock checks, trial balance,
  duration of the 100-invoice migration, chunk count, resume count).
- Device hand checklist for the owner (after E's final build): create ~20
  invoices offline in 2 currencies → buy ONLINE (test payment) → watch the
  states → compare 5 printed invoices, receivables per currency and stock
  with the cloud → confirm → device now online.
- «M done» in `docs/parallel/handoff.md` with files, edit operations, test
  numbers. Full suites and builds stay with E (E6 waits for M too).
