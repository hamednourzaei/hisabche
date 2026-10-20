# Hisabche — Offline Edition (Windows + Android), one codebase, UI unchanged

> Paste this whole file into the coding agent, run in the repository root
> (`C:\Users\hamed\Desktop\hisabche`). It is long on purpose: it is a programme
> of work in ten phases, each ending in a gate the owner checks before the
> next one starts. **Run with three agents (§0.5) — Lead/Domain, Platforms, Verifier. Do one phase per session.** Never start a phase whose
> previous gate is not green. Order (locked by the owner):
> Audit → shared domain rules → real offline → hardening → **STOP: customer
> validation** → cloud MVP (only what was paid for) → safe migration.

---

## 0. What is being built — read twice

Hisabche today is an online product with an offline fallback: Windows
(Electron) and Android (Expo WebView) render the same shared UI
(`packages/ui` through `packages/app-shell`), keep a small device database, and
can queue ONE kind of write (creating an invoice) while offline.

The goal is an **Offline Edition**: the SAME application, installed on one
Windows PC or one Android phone, that runs a business **with no server at
all** — no sign-up, no internet, ever — and that can later be **connected to
the cloud** (a paid plan) without reinstalling and without losing a record.

Non-negotiable product rules (the owner's decisions):

1. **The UI does not change.** Same pages, same layout, same components, same
   texts, same navigation, same URLs. No page is redesigned, no new screen is
   added except the three named in Phase 8 (an «نیاز به اینترنت» notice, the
   «اتصال به ابر» flow, and the local first-run). Every visual element stays
   pixel-identical; only WHERE its data comes from changes.
2. **One codebase.** No second app, no `offline/` copy of a page, no second
   accounting engine. The offline edition is a _data source_, not a product.
3. **Every financial rule that holds online holds offline** — the same
   functions compute it (see §2). Money is integer minor units; a sale moves
   stock; a payment allocates to an invoice of its own currency; an invoice of
   another currency carries a rate; unknown cost is `null`, never `0`.
4. **Features that truly need a server stay visible** and say so at the action
   («برای این عملیات به اینترنت نیاز دارید»), never hidden, never faked.
5. **No fake success.** Nothing says «ذخیره شد» / «همگام شد» that was not.
6. **No data hostage.** No licence, plan or subscription state — active,
   expired, cancelled, unverifiable — ever blocks a person from opening,
   reading, printing or exporting their own records. Expiry may disable
   paid capabilities; it never locks the books.
7. **The business model is not decided and the code must not depend on it.**
   Free, monthly subscription, one-time (perpetual) licence and
   offline-plus-cloud must all be possible later WITHOUT touching the
   financial engine. Entitlement is a separate layer that only answers
   «may this capability run?» (Phase 9); the engine never reads it.
8. **No artificial limits** (invoice counts, user counts, record caps) in
   any phase. Limits that come from a real technical dependency only.

What «offline» does NOT mean here: it does not mean the web site works offline
(the browser has no device database — leave it as it is), and it does not mean
removing the server. The server remains the cloud edition.

---

## 0.5. How the work is split between agents (2 or 3, run in Antigravity)

Run **three agents**. If only two are available, merge Agent C into Agent A
and keep the rules below. One agent is the **lead**; the others never start a
phase the lead has not opened.

### The three roles

| Agent                 | Role                                                                                                                                                                                                          | Owns (only it writes here)                                                                                                                                                                                                                                                  | Never writes                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **A — Lead / Domain** | Phase plan, the capability matrix, extracting shared rules, the local engine handlers, the final report                                                                                                       | `docs/offline/**`, `packages/validation/src/schemas/**` (new rule files), `packages/local-engine/**`, the import lines in `backend/src/services/**` that switch a service to a shared rule                                                                                  | `apps/**`, `packages/app-shell/**`, `packages/ui/src/components/**`           |
| **B — Platforms**     | Device schema, Windows (Electron) and Android (Expo) hosts, transport adapters, first run, builds, device proof                                                                                               | `packages/app-bridge/src/local-*.ts`, `apps/desktop/**`, `apps/mobile/**`, `packages/app-shell/src/app/providers.tsx`, `packages/app-shell/src/features/sync/**`, `packages/api/src/lib/{client,tokenProvider,persisted-query-cache,offline-queue}.ts`, `packages/store/**` | `packages/local-engine/src/routes/**`, `packages/validation/**`, `backend/**` |
| **C — Verifier**      | Writes and runs every test the gates name, the parity comparison (engine JSON vs backend JSON), the currency tests, the network-isolation logs; reviews A's and B's diffs for rule duplication and UI changes | `**/__tests__/**`, `packages/local-engine/src/__tests__/**`, `docs/offline/gates/**`                                                                                                                                                                                        | Product code. C reports defects to A or B; it does not fix them               |

Phase 7 (notice at the action) touches `packages/ui/src/lib/capability/**`,
`packages/ui/src/components/ui/cloud-required-notice.tsx` and the action
handlers of C-class rows: it belongs to **Agent A**, and B does not touch
`packages/ui` in that phase. i18n keys (`packages/i18n/messages/*/common.json`)
are written by **one agent per phase** — the lead names which at the start of
the phase.

### Who does what, phase by phase

| Phase           | A (lead / domain)                                            | B (platforms)                                                                                                                    | C (verifier)                                                                                                    |
| --------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1 Audit         | writes the matrix (routes, hooks, services, rules)           | lists every network call at START on Windows and Android, every device-DB table and IPC/bridge message → a section of the matrix | checks every route in `app.tsx` is a row; checks nothing outside `docs/offline/` changed                        |
| 2 Extract rules | moves each rule, switches the backend import                 | — (waits)                                                                                                                        | backend suite before/after (same counts), two-currency tests per rule, injection tests, `one-rule-each.test.ts` |
| 3 Device schema | reviews the column list against the server rows the UI reads | writes `local-schema.ts`, `local-migrations.ts`, Windows + Android migration runs                                                | v1→v2 migration test on a real device-DB copy                                                                   |
| 4 Local engine  | writes the handlers                                          | provides the `LocalDb` implementation for both hosts (in memory for tests)                                                       | parity tests (engine vs backend JSON), reverse tests, 501 for unimplemented routes                              |
| 5 Transport     | answers B's questions on the engine contract                 | wires IPC (Windows), bridge (Android), client adapter, token readiness, cache/sync off                                           | Gate 5 Test A + Test B on both platforms, with logs                                                             |
| 6 First run     | —                                                            | local first-run, offline session in the store                                                                                    | clean-install / restart / reinstall tests                                                                       |
| 7 Notices       | capability table, notice, action guards                      | —                                                                                                                                | `cloud-required.test.ts`; clicks every C action offline                                                         |
| ⛔ STOP         | final report                                                 | builds                                                                                                                           | gate summary                                                                                                    |

### Rules between agents (break one and the phase is void)

1. **One writer per file.** Before writing, an agent checks the ownership table.
   A file outside its column → it writes a note in
   `docs/offline/handoff/<phase>.md` addressed to the owner of that file and
   waits. Two agents never edit the same file in the same phase.
2. **The contract first.** At the start of Phase 4, A writes
   `docs/offline/handoff/engine-contract.md`: the `LocalDb` interface, the
   `request(req) → res` shape, the error shape. B and C build against that
   file only. Changing the contract = A edits the file and tells B and C in
   the handoff note; nobody codes to an unstated contract.
3. **C never fixes; C reports.** A failing test goes into
   `docs/offline/gates/<phase>.md` with the command, the output and the file it
   points at. The owner of that file fixes it. C re-runs. (A tester that edits
   product code until its test passes proves nothing.)
4. **No shortcuts to pass a gate.** Loosening a test, adding a fixture that
   only exists in the test, catching an error into an empty list, skipping a
   currency — any of these voids the gate. C checks the diff of every test file
   for loosened assertions.
5. **Same branch, sequential merges.** All agents work on the same working
   tree, no commits (the owner commits). Each agent finishes its part of the
   phase, says «done» in `docs/offline/handoff/<phase>.md` with the files it
   touched, and only then the next agent in that phase starts writing.
   Parallel work is allowed only when the file sets do not overlap
   (e.g. Phase 4: A writes handlers while B writes the `LocalDb` hosts).
6. **Tests run one suite at a time.** Never two vitest/jest suites at once
   (the repo's tree-reading guards time out in parallel — CLAUDE.md).
7. **Builds only by B, only at the end of a phase, only the ones the gate
   names.** No agent runs a build mid-phase.
8. **The lead closes the phase.** A reads C's gate file; only when every
   line is green does A write the phase report (Persian, table of real
   numbers, status label) and stop. The next phase starts when the owner
   says so.

### What each agent reads before starting

All three: `CLAUDE.md`, `.claude/skills/hisabche-session-rules/SKILL.md`, this
file. Plus:

- A: `.claude/skills/hisabche-backend/SKILL.md`, `hisabche-database`,
  `.claude/accounting-integrity/00-SPEC.md`,
  `.claude/reverse-and-import/01-CURRENCY-AUDIT.md`.
- B: `hisabche-desktop`, `hisabche-mobile`, `hisabche-offline`,
  `hisabche-release-build`.
- C: `hisabche-testing`, `.claude/DEBUG-PLAYBOOK.md`, `.claude/BUG-REGISTRY.md`.

---

## 1. Repository rules you must follow (from `CLAUDE.md`, binding)

- Read `CLAUDE.md`, `.claude/skills/hisabche-session-rules/SKILL.md`,
  `.claude/skills/hisabche-offline/SKILL.md`,
  `.claude/skills/hisabche-desktop/SKILL.md`,
  `.claude/skills/hisabche-mobile/SKILL.md`,
  `.claude/skills/hisabche-scripted-edits/SKILL.md` **before any edit**.
- **No DDL on the live Supabase database.** Any server migration goes in
  `docs/<name>-migration.sql` + `docs/VERIFY-<name>.sql` + a
  `backend/src/__tests__/<name>.pg.test.ts` that runs it twice on real
  Postgres. The owner runs it. Write «PENDING HUMAN CONFIRMATION» until he
  reports the result.
- **No commit, no push.** The owner commits.
- **No builds until a phase is finished**; then the gate's builds only.
- `exactOptionalPropertyTypes` is on: `prop?: T | undefined`.
- No `any`, no `@ts-ignore`, no `eslint-disable`, no dead code, no mock data
  in product code (G1).
- Every new user-facing string: `t(key)` with the key in **fa, af and en**
  (`packages/i18n/messages/{fa,af,en}/common.json`); `t()` on a missing key
  throws. Dari terms: `.claude/DARI-GLOSSARY.md`.
- Edits containing backticks, `$` or backslashes: write a node script with the
  file tool and run `node file.mjs`; heredocs break in this shell.
- Never run `.exe` files from `C:\Users\hamed\AppData\Local\Python\`.
- Do not upgrade Expo (51) or React Native (0.74); do not enable the New
  Architecture. Do not upgrade Electron.
- Report in Persian with a table of real numbers; statuses only from:
  `VERIFIED_COMPLETE · IMPLEMENTED_NOT_LIVE_VERIFIED · BLOCKED_EXTERNAL_CREDENTIAL
· BLOCKED_BY_EXISTING_SYSTEM · NOT_APPLICABLE · FAILED`. Nothing is
  `VERIFIED_COMPLETE` without running it on a real device.

---

## 2. The map — what exists today (verified in the code, 19 Oct 2026)

| Concern                     | File(s)                                                                                                | Today                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Shared UI (every page)      | `packages/ui/src/components/ui/**`                                                                     | Reads data ONLY through hooks from `@hisabche/api`                                                                   |
| Data hooks                  | `packages/api/src/hooks/*.ts`                                                                          | React Query → `apiClient` (axios) → HTTPS to the backend                                                             |
| HTTP client                 | `packages/api/src/lib/client.ts`                                                                       | Adds token, `x-workspace-id`, `Idempotency-Key`                                                                      |
| Offline seam (the ONLY one) | `packages/api/src/lib/offline-queue.ts`                                                                | `OfflineQueue`: `isOffline`, `enqueue` (**invoice/create only**), `readRows('product'\|'customer')`, `findByBarcode` |
| Shell (Windows + Android)   | `packages/app-shell/src/**` (`app/app.tsx` routes, `app/providers.tsx`)                                | Same UI under react-router                                                                                           |
| Sync engine                 | `packages/app-shell/src/features/sync/sync-engine.ts`, `outbox-stage.ts`, `use-sync.ts`                | Drains `sync_queue` to the SAME routes; pulls rows with `sync_cursor`                                                |
| Device DB schema (shared)   | `packages/app-bridge/src/local-schema.ts`, `local-migrations.ts`                                       | Tables: `meta, sync_queue, sync_cursor, product, customer, invoice, invoice_item, inventory_movement, employee`      |
| Windows DB                  | `apps/desktop/electron/main/db/database.ts` (+ `__tests__/migrations.test.ts`)                         | SQLite in the main process, reached over IPC (`main/ipc/register.ts`)                                                |
| Android DB                  | `apps/mobile/src/host/local-db.ts`                                                                     | `expo-sqlite` (`hisabche.db`) behind the native bridge (`host/native-bridge.ts`)                                     |
| Persisted read cache        | `packages/api/src/lib/persisted-query-cache.ts`                                                        | Last server answers on the device (NOT a database)                                                                   |
| Money / domain rules        | `packages/validation/src/schemas/**` (`pricing.ts`, `manufacturing-cost.ts`, …), `packages/formatting` | Pure; usable on the device                                                                                           |
| Server-only rules           | `backend/src/services/**` (`invoice.service.ts`, `accounting/*`, `inventory/*`, `payments*`)           | Run only on the server today                                                                                         |
| Auth                        | `packages/auth-core`, `packages/store` (`useAuthStore`), `packages/api/src/lib/tokenProvider.ts`       | Supabase session — needs a server to start                                                                           |

**The central fact.** Almost every rule the owner cares about (invoice totals,
stock movement, cost layers FIFO/AVCO, ledger posting, payment allocation,
FX, invoice numbers via `nextval`) lives in `backend/src/services/**` and runs
inside Postgres functions. An offline edition therefore needs those rules to
run **on the device** too. That is the real work; everything else is plumbing.

---

## 3. The architecture to build (decide nothing else)

**A local backend behind the same seam.**

```
packages/ui  ──hooks──▶  packages/api (React Query)
                              │
                     apiClient.request(...)
                              │
             ┌────────────────┴─────────────────┐
     edition = 'cloud'                    edition = 'offline'
     HTTPS → backend (today)        LocalTransport → local engine
                                     (same routes, same JSON shapes)
```

- Add a **transport switch** in `packages/api/src/lib/client.ts`: an axios
  adapter registered by the host (`registerLocalTransport(adapter)`), used
  when the device's edition is `offline`. The UI and the hooks do not change —
  they still call `/invoices`, `/products`, … and get the same JSON.
- ⚠️ **The local engine is NOT an HTTP server.** No localhost port, no
  Express/Fastify on the device, no socket. It is an in-process function
  `request(req) → res` called through the axios adapter (Windows: one IPC
  call; Android: one bridge message). The route-shaped interface exists only
  so the hooks and the UI stay untouched — it is a contract, not a server.
  Inside the engine, handlers call the shared domain rules and the local
  persistence directly. **One business rule, many runtimes** — never
  «server rules + local server rules».
- The **local engine** is a new package `packages/local-engine/` (TypeScript,
  no React, no DOM, no Node-only APIs) that implements the routes the offline
  edition supports, against the device SQLite, returning **exactly** the
  response shapes the backend returns. It runs:
  - **Windows:** in the Electron main process (where SQLite already is), reached
    through one IPC channel `local-api:request` added in
    `apps/desktop/electron/main/ipc/register.ts` and exposed in
    `apps/desktop/electron/preload/*`.
  - **Android:** in the React Native host (where `expo-sqlite` already is),
    reached through the existing WebView bridge (`apps/mobile/src/host/native-bridge.ts`)
    with one new message type `local-api`.
- **The rules are not rewritten in the engine — they are moved.** Every pure
  rule the engine needs is extracted from `backend/src/services/**` into a
  `*.domain.ts` in `packages/validation` (or `packages/local-engine/src/domain/`)
  and BOTH the backend service and the engine import it. A rule that exists
  twice is the bug this repository has fixed a hundred times (CLAUDE.md
  «دو فرمول برای یک عدد»). The guard in Phase 2 enforces this.
- **Writes that Postgres functions do atomically** (`invoice create`,
  `payment record`, `ledger post`, `manufacturing_complete`, …) become ONE
  SQLite transaction in the engine (`BEGIN IMMEDIATE … COMMIT`), never several
  calls. No compensating DELETE.
- **Identity offline:** a local owner profile (`local_user` row: id = UUID v4
  generated on first run, name typed by the person) and a local workspace
  (`local_workspace`: id UUID v4, name, base currency, time zone). Role is
  always `owner`. No password is required to open the app (it is his own
  device); an OPTIONAL PIN lock may be added in Phase 9 — do not invent one
  earlier.
- **Edition** is a value in the device `meta` table: `edition = 'offline' |
'cloud'`. It is never read from a client flag for anything the SERVER
  decides (§9).

---

## 4. Phase plan — one phase per session, gate at the end of each

Each phase lists **files to create (C)**, **files to change (M)**, the tests,
and the gate. File paths are exact; if a path differs in the tree, stop and
report instead of guessing.

### Phase 1 — Audit (no product code)

Produce `docs/offline/01-CAPABILITY-MATRIX.md`: for every route in
`packages/app-shell/src/app/app.tsx`, every hook it mounts
(`packages/api/src/hooks/*`) and every endpoint those hooks call, one row:

| Page | Hook | Method + path | Backend service + Postgres function | Writes which tables | Rule files | Class |

And for EVERY row, these fields (in a block under the table, one per row):

```
Current implementation:   (what runs today, in one sentence)
Actual files:             (exact paths: route, service, hook, page)
Current dependency:       (server route / Postgres function / third party)
Why server is required:   (or «not required»)
Can become local:         yes / after extracting <rule> / no
Required refactor:        (the rule to extract, the table to add)
Risk:                     (what breaks if done wrong — money, stock, numbering)
Test required:            (the test that proves it, incl. two currencies)
```

Group the rows as a tree per area (Invoices → view / create / edit draft /
finalize / print / cancel; Inventory → view / sale movement / purchase
movement / transfer; …).

Class is one of: **L** (can run on the device), **L*** (can run on the device
after a rule is extracted — name it), **C** (needs a server by nature:
invitations, other members, multi-device, cloud backup, public storefront,
webhooks, AI provider, email/SMS, OAuth, billing), **X** (not in the offline
edition — say why).

Also list every place the shell needs the network to START:
`packages/app-shell/src/app/providers.tsx`, auth guard, `useWorkspaces`,
`useMyCapabilities`, `BookCurrencySync`, token refresh, notifications,
realtime/stream (`packages/sync/src/stream-client.ts`).

⚠️ **Phase 1 changes NO file outside `docs/offline/`.** No refactor, no
rename, no «small fix while I'm here». `git status` at the end of the phase
must list only files under `docs/offline/`.

**Gate 1:** the matrix covers 100% of routes (`grep -c "path:" app.tsx` = rows
grouped). The owner reviews and approves the L/C split. **No code.**

### Phase 2 — Extract the rules (server behaviour unchanged)

For each L* row, move the pure part of the rule out of the backend service
into a pure module and make the backend import it. Minimum set:

| Rule                                                                         | From                                                         | To (C)                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| Invoice totals, line rounding, discount, tax, currency rate (`exchangeRate`) | `backend/src/services/invoice.service.ts`                    | `packages/validation/src/schemas/invoice-math.ts` |
| Stock movement per warehouse (`stockEditWarehouse`)                          | `backend/src/services/inventory/warehouse-summary.domain.ts` | `packages/validation/src/schemas/stock.ts`        |
| Cost layers FIFO / AVCO (sale cost, `coverSoldUnits`)                        | `backend/src/services/inventory/costing*`                    | `packages/validation/src/schemas/costing.ts`      |
| Ledger lines for invoice / payment / FX gain-loss (`paymentPosting`)         | `backend/src/services/accounting/*`                          | `packages/validation/src/schemas/posting.ts`      |
| Payment allocation by currency (`settlesInCurrency`)                         | `backend/src/services/payments*`                             | `packages/validation/src/schemas/allocation.ts`   |
| Profit report, `costStatus`                                                  | `backend/src/services/accounting/profit-report.domain.ts`    | already pure — import it                          |
| Party balances by currency                                                   | `partyBalancesByCurrency`                                    | already pure — import it                          |

(M) each backend service: replace the inline rule with the import. **No
behaviour change** — the whole backend suite must stay exactly as green as
before (`cd backend && npx vitest run`).

(C) `packages/ui/src/__tests__/one-rule-each.test.ts`: for each rule above,
assert the function body exists in exactly one file in the repo (by a
distinctive line), and that both `backend/src/services/...` and
`packages/local-engine/...` (later) import it.

**Gate 2:** backend suite same counts as before; validation tests for each
moved rule with **two currencies** in every money fixture; injection test
(break the rule → both sides' tests go red).

### Phase 3 — Device schema v2 (Windows + Android together)

(M) `packages/app-bridge/src/local-schema.ts` and `local-migrations.ts`: add
the tables the L rows need, mirroring the server columns the UI reads
(snake_case, same names): `local_user, local_workspace, warehouse,
product_stock (product_id, warehouse_id, qty), cost_layer, cost_consumption,
payment, payment_allocation, account, journal_entry, journal_line,
exchange_rate, branch, shelf, invoice_counter (prefix, next)`, plus the
columns `invoice`/`invoice_item`/`product`/`customer` lack today compared with
the server rows the UI reads (read the backend `*_COLUMNS` constants).

Rules:

- Money columns `INTEGER` (minor units). Quantities `TEXT` decimal or
  `INTEGER` × scale — the same scale the server uses; say which.
- Every table has `workspace_id`, `id` (UUID text), `created_at`,
  `updated_at`, `deleted_at` (soft delete), `origin` (`'local' | 'cloud'`),
  `sync_state` (`'local_only' | 'pending' | 'synced' | 'conflict'`).
- `journal_line`: a CHECK that debit ≥ 0, credit ≥ 0, not both; a trigger
  that refuses an unbalanced posted entry (deferred to COMMIT — SQLite: check
  inside the engine's transaction before COMMIT and abort).
- Migrations are forward-only and idempotent; the schema version lives in
  `meta.schema_version`.

(M) `apps/desktop/electron/main/db/database.ts` and
`apps/mobile/src/host/local-db.ts`: run the shared migrations; nothing
platform-specific in the SQL.

(M) `apps/desktop/electron/main/db/__tests__/migrations.test.ts`: v1 → v2 on a
database that already holds rows (the cache tables of today) keeps every row.

**Gate 3:** migrations run twice on a copy of a real device DB (owner provides
one) with zero loss; `cd apps/desktop && npx jest` green.

### Phase 4 — The local engine (core routes)

(C) `packages/local-engine/package.json`, `tsconfig.json`,
`src/index.ts` (`createLocalEngine(db: LocalDb): { request(req): Promise<res> }`),
`src/router.ts` (method + path → handler, the same path strings as
`backend/src/routes/*.ts`), `src/db.ts` (the `LocalDb` interface:
`all/get/run/transaction` — implemented by each host), `src/errors.ts`
(same `{ error, code, message }` shape and HTTP status as the backend, so
`apiErrorMessage()` and `apiErrorFields()` work unchanged).

Handlers (C), one file each under `src/routes/`, each returning the backend's
JSON shape **byte-for-byte for the fields the UI reads** (verify against the
backend service's select list):

- `products.ts` — list/search/barcode/get/create/update/archive, stock per
  warehouse, opening stock (with cost layer only when a buy price is given).
- `customers.ts` — list/get/create/update, balances by currency.
- `invoices.ts` — create (sale/purchase; stock movement; cost layers;
  ledger; invoice number from `invoice_counter` in the same transaction),
  list, get, cancel/delete via the same reverse rules (`reverseEffects`).
- `payments.ts` — record, allocate (same currency only), list.
- `warehouses.ts`, `shelves.ts`, `transfers.ts` (stock transfer between
  warehouses — same rule as BUG-102 fix).
- `accounting.ts` — accounts, trial balance (`debitBalance`/`creditBalance`),
  profit report, journal.
- `exchange-rates.ts`, `settings.ts` (base currency — changeable only while no
  financial document exists, same rule as `services/base-currency.ts`),
  `workspace.ts` (`/workspaces`, `/workspaces/:id`, logo/stamp/signature as
  data URLs), `me.ts` (`/me/capabilities` → role `owner`, every module),
  `dashboard.ts` (the same `*_v2` figures, computed in SQL on the device).
- `backup.ts` — `/workspaces/backup` JSON/xlsx/csv-zip built with
  `@hisabche/formatting` (`buildXlsx`, `buildCsvZip`) — the same files the
  cloud produces, so the import screen reads them back.
- `import.ts` — `/migrations/inspect` + commit for customers/products/invoices
  using the SAME domain files (`backend/src/services/migration/*.domain.ts` —
  move them to `packages/validation` in this phase if needed).

Every route NOT implemented returns **HTTP 501** with
`{ code: 'OFFLINE_NOT_AVAILABLE', feature: '<matrix id>' }` — never a fake
empty list (§7.3 of CLAUDE.md: error and empty are two branches).

(C) `packages/local-engine/src/__tests__/*.test.ts` — run each handler
against `better-sqlite3` in memory; for each, a twin test that sends the
same request to the backend service with the existing fake supabase helper
(`backend/src/__tests__/helpers/fake-supabase`) and **compares the JSON**
field by field for the fields the UI reads. Two currencies in every money
fixture. A reverse test for every write (create → cancel → balances back to
start, CLAUDE.md «تست رفت سبز است و برگشت نوشته نشده»).

**Gate 4:** parity tests green for every handler; `tsc` clean in every
package; injection test per handler.

### Phase 5 — Wiring the transport (Windows first, then Android)

(M) `packages/api/src/lib/client.ts`: `registerLocalTransport(adapter)`;
when registered **and** `edition === 'offline'`, axios uses it; headers
(`Idempotency-Key`, `x-workspace-id`) are passed through so the engine can
de-duplicate. Token code is skipped in offline edition (no 401 → refresh
loop).
(M) `packages/api/src/lib/tokenProvider.ts`: offline edition calls
`markTokenReady()` with no token (CLAUDE.md: the readiness signal must not
wait 2 s).
(C) `apps/desktop/electron/main/services/local-api.ts`: owns
`createLocalEngine(desktopDb)`; (M) `main/ipc/register.ts`: `local-api:request`;
(M) `apps/desktop/electron/preload/*`: expose `localApi.request`; (M)
`packages/app-shell/src/app/providers.tsx`: on desktop, register the adapter
that calls `window.localApi.request`.
(C) `apps/mobile/src/host/local-api.ts`: same engine over `expo-sqlite`;
(M) `apps/mobile/src/host/native-bridge.ts` + `shell-webview.tsx`: message
type `local-api` with request id → response; (M) the shell side adapter.
(M) `packages/api/src/lib/persisted-query-cache.ts`: in offline edition the
device cache is NOT persisted (the database is the truth; a stale cache over
it would show old numbers).
(M) `packages/app-shell/src/features/sync/sync-engine.ts`: in offline
edition the engine does not run at all (no pull, no push, no timers).
(M) realtime / stream client (`packages/sync/src/stream-client.ts`),
notifications polling, `BookCurrencySync`: not started in offline edition.

**Gate 5 — two separate proofs, on Windows AND Android, both required.**

**Test A — Functional offline** (airplane mode, fresh install):
create business (base currency AFN) → chart of accounts exists → customer →
products with opening stock (one with a buy price, one without) → purchase
invoice in **USD** with a rate → purchase invoice in **EUR** with a rate →
sale invoice in **AFN** → sale invoice in **USD** → partial payment in USD →
payment in AFN → stock transfer between two warehouses → cancel one invoice
→ trial balance balances → customer balance **per currency** → stock per
(product, warehouse) → COGS (FIFO and AVCO) → profit report (known /
estimated / unknown cost shown correctly, never 0 for unknown) → print an
invoice (logo, stamp, signature) → export backup (JSON, xlsx, csv-zip) →
close the app → reopen → every figure above identical.

Currency checks that MUST hold (write each as an automated test too):

- a USD invoice's ledger lines carry its rate to the AFN books; nothing is
  posted at an implied rate of 1;
- no screen, report or total ever adds AFN + USD + EUR into one number
  without converting at the stored rates or showing them per currency;
- a USD payment settles only USD invoices; an FX difference posts to
  `fx_gain_loss`;
- an invoice without a rate in a foreign currency is refused, not posted.

**Test B — Network isolation** (the same run as Test A, recorded):

```
DNS requests       = 0
HTTP requests      = 0
HTTPS requests     = 0
WebSocket          = 0
Supabase           = 0
Render / API host  = 0
Telemetry / Sentry = 0
Remote auth        = 0
Fonts / CDN        = 0
Update check       = 0
```

Windows: log every request in the main process (`session.defaultSession.webRequest.onBeforeRequest`)
and in Node (`net`/`dns` hooks) during the run, plus a Windows firewall
rule that BLOCKS the app — the run must still pass. Android: run behind a
logging proxy with airplane mode, plus `adb shell dumpsys netstats`. Attach
both logs. «It worked without internet» and «it never tried to reach the
internet» are two different facts; Gate 5 needs both.

### Phase 6 — First run without a server

(C) a local first-run inside the EXISTING onboarding screens
(`packages/app-shell/src/features/onboarding/*`, shared
`packages/ui/src/components/ui/onboarding*`): when there is no network or the
person picks «بدون اینترنت شروع کن», the same steps (business name, base
currency, time zone) write `local_user` + `local_workspace` through the
engine. The login screen gains ONE link «شروع بدون حساب کاربری» (texts in
fa/af/en). Nothing else in the UI changes.
(M) `packages/store` (`useAuthStore`, workspace slice): an offline session
object `{ kind: 'local', userId, workspaceId }` that satisfies every reader
that today expects a Supabase session (grep every `useAuthStore(` reader and
list them in the report).

**Gate 6:** clean install, never online, reaches the dashboard; a restart
lands on the dashboard; uninstall → reinstall shows first-run (data lives in
the app's data folder — say the exact path on Windows and Android).

### Phase 7 — «نیاز به اینترنت» at the action, not the page

(C) `packages/ui/src/lib/capability/requirement.ts`: one table
`ACTION_REQUIREMENTS: Record<ActionId, 'local' | 'cloud'>` generated from the
Phase-1 matrix, and `useActionAvailability(actionId)` →
`{ available: true } | { available: false, reason: 'offline_edition' | 'no_connection' | 'plan' }`.
Reuse `useMyCapabilities` / `requireCapability` names; do NOT build a second
permission system.
(C) `packages/ui/src/components/ui/cloud-required-notice.tsx`: the existing
`Dialog` with title `t('cloud.required.title')` = «برای این عملیات به اینترنت
نیاز دارید» and body per reason:

- `offline_edition`: «این کار در نسخه‌ی آفلاین نیست. با اتصال به حسابچه‌ی
  ابری فعال می‌شود.» + button «اتصال به ابر» (Phase 8).
- `no_connection` (cloud edition, offline right now): «به اینترنت وصل شوید و
  دوباره امتحان کنید.» — **no upgrade button**.
- `plan`: «این قابلیت در پلن فعلی شما نیست.» + «مشاهده‌ی پلن‌ها».
  (M) only the ACTION handlers of C rows (e.g. «کارمند جدید»/دعوت in
  `team-and-payroll`, «دسترسی‌ها» save in `permissions`, storefront, developers
  keys/webhooks, AI assistant send, campaigns send, marketplace): before the
  mutation, `if (!availability.available) return openNotice(reason)`. The
  button stays where it is and looks the same.
  (M) a page whose whole content is C (e.g. `/developers`, `/marketplace`)
  renders its normal header and, in place of the list, the same notice inline.
  (C) `packages/ui/src/__tests__/cloud-required.test.ts`: every C action in
  the matrix goes through `useActionAvailability`; every L action does not;
  the `no_connection` reason never shows the upgrade button.

**Gate 7:** owner clicks every C action on Windows offline and every one
shows the notice; every L action works.

### ⛔ STOP after Gate 7

The offline edition is complete here. **Do not start Phase 8 on your own.**
The owner now tests the market: which customers pay, for which model
(free / monthly / one-time / offline + cloud), and for which cloud
capability. Phase 8 builds only the cloud capabilities customers actually
paid for, and the owner will say which.

### Phase 8 — «اتصال به ابر» (offline → cloud), the dangerous one

Only after Gates 1–7, after the market test, and only when the owner says the
cloud plan is for sale and names the capabilities in it.

Flow (one screen, inside settings, `packages/ui/src/components/ui/settings/`):
sign in (existing auth screens) → server confirms a paid plan
(`GET /api/billing/subscription` — the server decides; never a local flag) →
choose «کسب‌وکار تازه در ابر» (the only option in v1) → **automatic local
backup** (`backup.ts`, saved file path shown) → **preview**: counts per table
and per currency totals, side by side «روی دستگاه / بعد از انتقال» → confirm
→ upload → **reconcile** (re-read from the server and compare counts, sums
per currency, stock per (product, warehouse), receivables per customer) →
only if every number matches: `edition = 'cloud'`.

Server side (C): `backend/src/routes/offline-import.routes.ts` +
`services/offline-import/*` — one endpoint that takes the device export in
chunks (reuse the chunked, resumable pattern of
`services/migration/migration.service.ts` — `claimRun`, `IMPORT_LIMITS`),
writes **through the existing services** (`ProductService.create`,
`CustomerService.create`, `InvoiceService.create`,
`PaymentsService.recordPayment` — CLAUDE.md «ورود از فایل از سرویسِ همان
موجودیت رد می‌شود، نه از جدول»), idempotency key = `offline-<local id>`, keeps
the local invoice number as `external_number` (new migration in `docs/`) while
the server assigns its own `invoice_number`, and keeps the local id ↔ server
id map in a table `offline_import_map` (migration + VERIFY + pg test).

Rules: nothing is overwritten or deleted on either side; an interrupted
upload resumes from the map; a mismatch at reconcile leaves `edition =
'offline'` and shows which numbers differ; the local database is kept
read-only as an archive for 90 days after a successful switch.

v1 does NOT merge into an existing cloud workspace that already has data —
the button says so. (Merging two ledgers is a separate project.)

**Gate 8:** run on a copy of a real device DB with ≥ 500 invoices in two
currencies, cancelled invoices, partial payments, purchases with cost layers;
reconcile all green; kill the app mid-upload, restart, resume, still green.

### Phase 9 — Entitlement layer (model-independent)

The commercial model of the offline edition is not final, and the
architecture must not depend on any of Free / Subscription / Perpetual
licence / Offline + Cloud. Build ONE seam:

- (C) `packages/ui/src/lib/capability/entitlement.ts`:
  `entitlementOf(capability) → 'allowed' | 'not_in_plan' | 'expired' | 'unverified'`,
  fed by a provider the host registers. v1 provider: «everything allowed»
  (free). Later providers: a signed licence file (Ed25519; public key in the
  app, private key never in the repo), or the cloud subscription the SERVER
  confirms.
- `useActionAvailability` (Phase 7) consults it; the financial engine
  (`packages/local-engine`, `packages/validation`) never imports it — a guard
  test asserts that.
- Expired / unverified: every record stays readable, printable and
  exportable; only the capabilities the plan sells are paused (principle 6).
- No limit counters (invoices, users, records) — principle 8.

Do not wire a paid provider until the owner names the model.

### Phase 10 — Builds and device proof

Windows: `pnpm run build:shell` then the desktop build
(`electron-builder --win -c.electronDist=node_modules/electron/dist`).
Android: `pnpm run android:release` (shell first, then Gradle; check the APK
file date, not Gradle's message). Run Gate 5's script on **one real Windows PC
and one real Android phone**, in airplane mode, and attach the request log.

---

## 5. Things that will tempt you — do not

- Do not copy a backend service into the engine and edit it. Extract, import.
- Do not return `[]` for a route the engine does not implement — 501.
- Do not keep a second invoice number sequence on the server for offline
  devices; the device numbers locally, the server keeps its own, the mapping
  is stored.
- Do not mark anything `synced` that the server did not confirm.
- Do not use `Date.now()` minus offsets for «today»: `local_workspace.time_zone`
  (CLAUDE.md «امروز = نیمه‌شب محلی»).
- Do not trust `edition` for anything the server authorizes.
- Do not change a single className, layout or text of an existing screen.

## 6. Report after each phase (Persian)

Files created/changed with one line each; which rule was moved where; the
parity table (route → fields compared → equal?); test counts before/after for
backend, ui, local-engine, desktop jest, mobile jest; tsc per package; device
proof (or «انجام نشد»); open blockers; status label.
