# Hisabche — rules for any coding agent working in this repository

Persian/Dari accounting + ERP. pnpm + Turbo monorepo. Web, Windows (Electron), Android share one UI
package. The owner is a solo founder; **talk to him in Persian**, write code and comments in English.

Your work is reviewed line by line by a second reviewer before it is pushed. A change that cannot be
verified is sent back. Read this file fully before the first edit.

The long form of every rule here — with the real bug behind it — is in `CLAUDE.md` (root) and
`.claude/`. When a rule here is not enough, open those; do not guess.

---

## 0. Never do these

1. **Never `git commit`, `git push`, `git reset`, `git checkout -- <file>`, `git stash`, or rebase.**
   The owner commits and pushes himself. Leave your work in the working tree.
2. **Never run DDL or any write against the live Supabase database.** You produce files only:
   `docs/<name>-migration.sql` + `docs/VERIFY-<name>.sql`. A person runs them.
   Never write «PASS» for a migration; write
   `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.
3. **Never read, print or edit `.env*` files.** Never put a secret in code, a test, a log or a reply.
4. **Never run a build** (`next build`, electron-builder, Gradle) unless the task says so.
5. **Never install, upgrade or remove a dependency** unless the task names it.
6. **Never run any `.exe` under `C:\Users\hamed\AppData\Local\Python\`** — that install is infected.
   Do not download or execute software. Do not change antivirus or system settings.
7. **Never edit a file the task did not ask for.** No drive-by refactors, no reformatting.
   `prettier --write` only on files you edited, named one by one — never a directory.
8. **Never weaken a test to make it pass.** If a guard test goes red, the rule it guards is the
   thing to satisfy. If you believe the guard is wrong, stop and say so.
9. **No `any`, no `@ts-ignore`, no `eslint-disable`, no dead code, no unused imports.**
10. **No fake data, mock APIs or placeholder UI.** Real data, or an explicit empty state.

---

## 0.5. ERROR-FIRST RESOLUTION — highest priority

When a task contains a bug, error, exception, stack trace, failed assertion, TypeScript
diagnostic, Supabase/Postgres error, HTTP error, route error, or runtime failure, enter
**ERROR-FIRST MODE**. The failure — not the domain it happens to live in — decides where you
look first.

Never begin with broad repository exploration.

### Resolution order

```text
error
↓
exact file / line if available
↓
exact error string
↓
exact symbol
↓
containing function
↓
direct callers
↓
direct dependencies
↓
relevant test
↓
minimal root-cause subgraph
```

### If a file and line are provided

Open that exact file and line **first**.

Do not inspect the repository map, unrelated domains, or neighbouring packages before
inspecting the reported location.

### If only an error string is provided

Search the indexed source/symbol graph (`graphify-out/`, §7) for:

1. exact error string
2. exact symbol
3. relevant route/function
4. known dependency edge

Then open the highest-confidence result.

### If a stack trace is provided

Parse every application-owned frame.

Rank frames:

1. exact application frame with line number
2. nearest application frame
3. direct caller
4. direct dependency

Ignore framework internals unless the application frame does not explain the failure.

### Root-cause expansion

After opening the primary source, only expand the graph one edge at a time:

```text
PRIMARY FILE
    ↓
FUNCTION
    ↓
CALLER / DEPENDENCY
    ↓
DATA CONTRACT / SCHEMA
    ↓
TEST
```

Do not recursively inspect unrelated consumers.

Stop expanding as soon as the root cause is established with sufficient evidence.

### Bug investigation does NOT have a fixed file-read limit

The feature-mode read discipline (§10) does not apply to debugging.

For bugs:

- Start with the exact failure location.
- Expand only when evidence requires it.
- Never read files merely because they are in the same domain.
- Never read the entire domain by default.

### Confidence

For every bug investigation, classify the source candidate internally:

```text
HIGH
MEDIUM
LOW
```

HIGH means:

- exact stack frame
- exact line
- exact symbol
- direct failing operation

MEDIUM means:

- direct caller/dependency strongly implicated

LOW means:

- inferred from indirect evidence

Never claim a root cause as certain when confidence is LOW.

### Example

Given:

```text
TypeError: Cannot read properties of undefined
    at reserveStockTransaction
    at src/lib/inventory.ts:87
```

Correct:

```text
1. Open src/lib/inventory.ts:87
2. Identify reserveStockTransaction
3. Inspect its immediate inputs
4. Inspect direct caller
5. Inspect relevant schema/test
6. Fix root cause
```

Incorrect:

```text
1. Read CODEBASE_MAP
2. Read inventory domain
3. Read all inventory routes
4. Read all admin pages
5. Read all API routes
6. Read unrelated packages
```

### Feature mode remains separate

For normal feature requests use:

```text
Task
→ domain classification
→ index lookup
→ existing implementation
→ minimal dependency graph
→ implementation
```

For bugs use:

```text
Error
→ exact source
→ minimal root-cause graph
→ fix
→ verification
```

These are intentionally different workflows.

### Final rule

The repository index is a navigation accelerator.

It must reduce repository exploration, not become another reason to explore the entire
repository.

When an exact source location is available:

> TRUST THE ERROR LOCATION FIRST.
> THEN USE THE INDEX TO UNDERSTAND ONLY WHAT SURROUNDS IT.

---

## 0.6. CODEBASE INTELLIGENCE & NAVIGATION SYSTEM — permanent laws

### The Index

Two artifacts live in `.ai/codebase/` and are the **single source of truth** for navigation:

- `CODEBASE_MAP.md` — human-readable, <300 lines, read first every session
- `graph.json` — machine-readable symbol/dependency index (git hash + timestamp for staleness)

Regenerate with: `node scripts/build-ai-index.mjs` (<2s).

### LAW 1: CACHE-FIRST & STALENESS CHECK

1. At the start of **ANY** task, read `.ai/codebase/CODEBASE_MAP.md` FIRST.
2. If files changed significantly since the git commit recorded in `graph.json`, run `node scripts/build-ai-index.mjs` instead of scanning manually.

### LAW 2: BUG-FIRST RESOLUTION PROTOCOL (Stack-Trace & Symbol Jump)

When given a bug, error message, TypeScript error, or crash (e.g., `Android import crashes with Buffer is not defined`):

1. **If a file:line is in the stack trace:** OPEN THAT EXACT FILE AND LINE FIRST. Zero exploration.
2. **If an error string or symbol is given:** Query `.ai/codebase/graph.json` or run scoped `rg -n "exact_symbol"` ONLY inside the relevant domain/platform path identified in `CODEBASE_MAP.md`.
3. Trace ONLY the minimal subgraph: `Error File → Direct Caller → Direct Callee → Schema/Type → Platform Adapter`.
4. **HARD READ CAP:** Never open more than **5 source files** before diagnosing the root cause.

### LAW 3: FEATURE-FIRST RESOLUTION PROTOCOL

When asked to add or modify a feature:

1. Classify the Domain and Platform (`SHARED` vs `WEB_ONLY` vs `MOBILE_ONLY` vs `WINDOWS_ONLY` vs `SERVER_ONLY` vs `PLATFORM_ADAPTER` vs `OFFLINE_ENGINE`) using `CODEBASE_MAP.md`.
2. Check `graph.json` for existing hooks, services, Zod schemas, or components before creating anything new (**Reuse > Extend > Duplicate**).
3. Business rules MUST live in shared/domain packages; platform-specific code must remain a thin adapter.
4. Before reading or editing code, output an internal shortlist:
   - `PRIMARY FILES` (max 2-3 files to open first)
   - `SECONDARY FILES` (inspect only if contract changes)
5. **HARD EDIT CAP:** Target changing **≤ 2-3 files** for normal work. Explain why before expanding the change surface.

### LAW 4: INCREMENTAL UPDATE & HONEST VERIFICATION

1. After modifying code, run `node scripts/build-ai-index.mjs` to keep the index fresh.
2. Never claim `fixed`, `verified`, or `production-ready` without running the actual check. Explicitly label status as: `IMPLEMENTED` | `TYPECHECKED` | `UNIT TESTED` | `EMULATOR/LIVE VERIFIED`.

---

## 1. Five rules everything rests on

1. **`workspace_id` is the only security boundary.** `user_id` says who did something; it is never
   a filter. Services take a `TenancyContext`, not a `userId`. Every `.eq('id', …)` on a tenant
   table also has `.eq('workspace_id', …)`. Every row you insert carries `workspace_id`.
2. **Read the role from `request.tenancy.role`**, never `request.userRole`. A route that writes
   needs `requireWorkspaceContext` and the right `requireCapability(...)`.
3. **Money is integer minor units on the money path. No floats.** The server derives amounts from
   lines; it never trusts a total the client sent.
4. **supabase-js has no transactions.** A multi-table write is a Postgres function called with
   `.rpc()`. A compensating `DELETE` is forbidden.
5. **A green test is not proof.** Proof is real HTTP (`buildServer()` + `app.inject`) or a real
   Postgres (`*.pg.test.ts` with embedded-postgres).

---

## 2. One of everything — extend, never duplicate

Before writing anything, find what already exists and extend it. A second model, component, store,
service or formula beside the first one is a rejected change.

| Need                                         | The one place                                                                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Profit / margin / cost of a sale             | `AccountingService.getProfitReport` / `getInvoiceMargins` / `explainInvoiceProfit` → `backend/src/services/accounting/profit-report.domain.ts` |
| Posting to the ledger                        | `ledger.postDocument` / `reverseDocument` (`services/accounting`). Never insert into `journal_lines`                                           |
| Cost layers (FIFO/AVCO)                      | `costing` (`services/inventory-costing`). Never price from `products.buy_price` at sale time                                                   |
| Books currency                               | `baseCurrencyOf()` (`services/base-currency.ts`) · UI: `useBookCurrency()`                                                                     |
| Creating an invoice / product / customer     | `InvoiceService.create` / `ProductService.create` / `CustomerService.create` — also for imports and automations                                |
| Payments and allocations                     | `services/payments`                                                                                                                            |
| A list on screen                             | `DataTable` · filter: `TableFilterSelect` · dropdown: `SelectField` (raw `<select>` is banned)                                                 |
| A page                                       | a hub: `PageHub` / `HubTabs` + one `SegmentedControl`. A new route is the last resort                                                          |
| Formatting money, dates, digits              | `packages/formatting` · in components `useDateFormat()`                                                                                        |
| Reading a server error                       | `apiErrorMessage()` / `apiErrorFields()` from `@hisabche/api`                                                                                  |
| Rendering a list from an API                 | pass it through `asList<T>()` (`packages/api/src/lib/as-list.ts`)                                                                              |
| Navigation in shared UI                      | `useLocalePush` / `useLocaleReplace` — never bare `router.push('/…')`                                                                          |
| Cache invalidation after money/stock changes | `invalidateMoneyCaches(workspaceId)`                                                                                                           |

---

## 3. Values that must never be invented

- **Unknown is not zero.** A cost, price, balance or count that could not be read or does not exist
  is `null`, and the screen says «cannot be calculated» / «could not be read». Never write
  `profit ?? 0`, `marginPercent || 0`, `cost ?? 0`. (Guard: `unknown-is-not-zero.test.ts`.)
- **Error and empty are two branches.** `if (error || rows.length === 0) return empty` is a bug:
  a failed read must throw, never render as «you have no data», never be cached.
- **No hardcoded currency.** Not `'AFN'`, not a default in a zod schema, not in a store. The server
  fills it from the books currency. (Guard: `no-hardcoded-currency.test.ts`.)
- **Never sum money across currencies.** Group by currency, or filter to one.
- **No capped reads feeding a number someone decides on.** No `.limit(N)` under a total; use
  `selectAllPages` / `count: 'exact', head: true`.
- **No guessed backfill.** Old incomplete data stays unknown and is reported.
- **Currency, warehouse and branch are never assumed** in an import or an automation.

---

## 4. Layout

```
backend/            Fastify + supabase-js + zod + vitest        routes → services → *.domain.ts (pure)
packages/api        React Query hooks (one hook per endpoint)
packages/ui         every shared component (web + desktop + mobile shell)
packages/validation zod schemas + domain rules shared by server and client
packages/formatting money, dates, digits, CSV
packages/store      zustand
packages/i18n       messages/{fa,af,en}/common.json
packages/app-shell  the desktop/mobile shell and its routes
apps/web            Next.js App Router, `[lang]` prefix
apps/desktop        Electron
apps/mobile         Expo (cannot import packages/ui)
hisabche-promo-reel 9:16 vertical SaaS promo film engine (rules: PROMO_REEL_WORKFLOW.md, .claude/reel-plugin/)
docs/               SQL files only: migrations, VERIFY, FINDING
```

A capability is finished when it exists in: migration (if needed) → pg test → service → route →
hook → shared UI → three languages → guard test → both shells (web route **and**
`packages/app-shell/src/app/app.tsx`).

---

## 5. Things that break silently here

**i18n** — `fa`, `af`, `en` are all live. Every new key goes in all three files; `t()` on a missing
key throws and takes the whole page down. Dari wording: `.claude/DARI-GLOSSARY.md`.
A message with `{placeholder}` needs its values passed.

**Types** — `exactOptionalPropertyTypes` is on: write `prop?: string | undefined`.
A type annotation is not a runtime check; read the real response shape from the service before
typing it (`GET /api/employees` returns snake_case rows).

**Styling** — design tokens only: `hsl(var(--color-primary))`. No hex, no Tailwind palette colours.
RTL logical properties only: `ms-`/`me-`/`ps-`/`pe-`/`text-start`/`border-e`. Never `left`/`right`.

**React** — no hook after an early return. No `document`/`window` during render.
A web page file is `metadata + <XContainer />` — no `'use client'`, no second `<main>`.

**Backend**

- A new request header must be added to `allowedHeaders` in `backend/src/index.ts` in the same change.
- Fastify response schemas drop any field they do not name, and turn `null` into `""` on
  `{type:'string'}`. Nullable = `['string','null']`.
- A route that maps the body field by field drops every field it does not name — add the new field
  to the mapping, not only to the schema.
- `.eq('col', null)` matches nothing. Use `.is('col', null)`.
- Read column names and types from the migration SQL, not from memory
  (`journal_entries.source_id` is `uuid`; `invoices` has no `deleted_at`).
- A new mutating route must be added to `backend/src/utils/concurrency-safety-map.ts`, and a POST
  route in a file listed in `reversal-ledger.test.ts` must be registered there with its way back.
- Do not import a shared constant from a service (module cycles): constants live in a file that
  imports nothing.

**Database**

- Migrations are additive and idempotent, with a Rollback block. `NOT VALID` then `VALIDATE`.
  No constraint before a read-only `docs/FINDING-*.sql` has shown how many rows break it.
- On Supabase every new table is born with ALL granted to `anon`/`authenticated`/`service_role`:
  `REVOKE ALL` first, then grant what is needed. Functions: `SET search_path = public, pg_temp`
  and revoke EXECUTE from `PUBLIC, anon, authenticated`.
- Every `docs/*-migration.sql` and every `docs/FINDING-*.sql` gets a `*.pg.test.ts` that runs the
  file on a real Postgres — the migration **twice** — and, for each rule, sends the write it must
  refuse and the write it must allow.

---

## 6. Tests

- Write the test from the path a real user takes, not the path that is easiest to set up.
- Assert the number a person reads, not the warning flag beside it.
- Money fixtures have at least **two currencies**; «more than one» features are tested with two
  (workspaces, warehouses, branches).
- A reverse/delete test checks **balances**, not row counts.
- Compute expected numbers by hand and add one scale assertion beside the exact one.
- Source-assertion tests strip comments first and flatten whitespace before `toContain`.
- After writing a guard, undo the fix once and confirm the test goes red; then restore it.
- In `src/__tests__`, `vi.mock` paths resolve from the test file. Import services dynamically
  (`await import(...)`) when the mocked `db` is filled in `beforeAll`.

---

## 7. Shell and tooling (Windows, Git Bash)

- Write scripts to a file and run `node file.js`. Heredocs and `node -e "…"` containing a backtick,
  `$` or a backslash get mangled by the shell and corrupt files silently.
- A formatter rewrites files on save: re-read a file before a second exact-match edit.
- Do not edit backend source while a `vitest run` is in progress.
- `embedded-postgres` tests occasionally fail to bind a port (`EACCES` / `ECONNREFUSED`); rerun
  that one file before concluding anything.
- The code graph is in `graphify-out/`. Query it before a wide grep:
  `C:/Users/hamed/AppData/Local/Programs/Python/Python313/Scripts/graphify.exe explain "<Symbol>"`
  (always that full path — a bare `graphify` on PATH resolves to the infected install).

---

## 8. Verification — run before you say «done»

From the package you changed:

```bash
cd backend      && npx tsc --noEmit && npx vitest run
cd packages/ui  && npx tsc --noEmit && npx vitest run
cd packages/api && npx tsc --noEmit
cd apps/web     && npx tsc --noEmit
```

Then `npx eslint <each file you changed>` from that package's folder: **0 errors**.

Known red tests that are not yours (do not «fix» them, do not count them):
`backend … sales-chart-window.test.ts` (1) · `packages/ui` — 9 tests: `i18n-keys-exist` (3),
`customers-hub` (1), `sales-funnel` (1), `personal-view` (1), `sales-hub` (1), `warehouse-hub` (2)
— measured 12 Oct 2026. Any other red test is yours.

---

## 9. Your final message for each task

In Persian, in this order:

1. **Status** — exactly one of: `IMPLEMENTED_NOT_LIVE_VERIFIED` · `BLOCKED_BY_EXISTING_SYSTEM` ·
   `BLOCKED_EXTERNAL_CREDENTIAL` · `FAILED`. Never `VERIFIED_COMPLETE` (you have no live database).
2. **Files changed** — every path, one line each on what changed and why.
3. **Numbers you measured** — the exact commands you ran and their real totals. If you did not run
   something, write «اجرا نشد». Never report a number you did not see.
4. **What you did not do** — anything from the task left out, and why.
5. **Assumptions** — every decision the task did not make for you.
6. **For the owner** — migrations to run, in order, and anything that must be deployed first
   (backend before web).

If the task is ambiguous, or doing it correctly needs a schema change, a new dependency, or
touching a file outside its scope: **stop and ask**. A correct question is worth more than a
plausible guess.

---

## 10. Editing discipline (WORKING RULE for every task)

Editing discipline applies to every task: read each file once, one edit per file, no verify re-reads, batch tsc/tests at the end. Report files edited / edit operations.

1. **Read once, plan once.** Before editing a file, read ALL the parts you need in one pass (whole file if < 800 lines; otherwise every relevant range at once). Write down in your head the complete list of changes for that file. Do NOT start editing until the full change list for the file is known.
2. **One write per file.** Apply all changes to a file in ONE edit operation (a single multi-part edit, or one full-file write when more than ~30% of the file changes). Never: read → edit 10 lines → re-read the whole file → edit 10 lines.
3. **No re-reading to "verify".** After a successful edit, do not re-read the file to check it. The edit tool already confirms success; tsc/tests are the check. Re-read only if the edit tool reports a failure — and then only the failing range.
4. **Many files with the same change → one script.** Write a node script (Write tool, run with `node file.mjs`) that applies all replacements to all files and asserts the match count of each replacement (insertions too). One run, one report.
5. **Batch the work:** finish ALL edits of the step, THEN run tsc, THEN tests — not tsc after every file.
6. **Formatter note:** a formatter may rewrite the file after save. If an exact-match edit then fails, re-read ONLY the region you need, never the whole file again.
7. **In each report, add one line:** «files edited: N, total edit operations: M». M should be close to N. If M is much larger than N, explain why.
