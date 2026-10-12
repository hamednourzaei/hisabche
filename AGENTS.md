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
