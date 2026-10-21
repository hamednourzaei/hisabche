# Prompt: Always-Local + Server Sync (Windows & Android)

> Read this whole file before doing anything. A "MEASURE" section is read-and-report only; a "DO" section changes code. Never mix them.

---

## ⭐ Two governing principles (they override every other rule here)

**Principle 1 — Existing first, nothing new by default.**
If the current architecture already provides the primitive you need, do not build a future one. Reuse the existing local DB, outbox, sync engine, change log (`sync_change_log` / `sync_mutations` / cursor pull / `pg_notify`), conflict queue, domain functions, invoice numbering and reconciliation. Extend only the smallest existing path that is necessary. Every new abstraction must be justified in the report with "why the existing one was not enough" (file:line). Unjustified = rejected.

**Principle 2 — The first milestone is NOT "complete Always-Local".**
The first milestone is proving that **one existing screen**, while **ONLINE**, switches from API-read to Local-DB-read without creating a second domain engine. Do not start the next phase until this is proven.

**The centre of the whole job:**

```
ONLINE  ≠ API READ
ONLINE  = Local DB READ + Background Sync
OFFLINE = Local DB READ + Queued Mutations
```

```
PostgreSQL  (FINAL AUTHORITY)
     ▲
     │  Sync / Reconcile
     ▼
Local SQLite  (operational mirror + local projections + outbox)
     ▲
     │  ALL UI READS
     ▼
Android / Windows app-shell
```

Scope: the Windows and Android shells (app-shell) only. The web app is not touched.

---

## 0. Fixed rules (breaking any one = work rejected)

- **Do not commit or push.** Never run DDL on live Supabase. Migrations only as `docs/*-migration.sql` + `docs/VERIFY-*.sql` + a `*.pg.test.ts` that runs the migration **twice** on real Postgres. Write: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.
- Do not read `.env`; never print secrets. Never run any `.exe` under `C:\Users\hamed\AppData\Local\Python\` (infected). Graphify only via `C:/Users/hamed/AppData/Local/Programs/Python/Python313/Scripts/graphify.exe`.
- **Graph first, files second:** before any broad grep use `graphify.exe explain "<symbol>"` / `path "<A>" "<B>"` / `query "<words>" --budget 800`. Read only the lines you need.
- Write scripts to a file and run `node file.mjs`; `node -e` and heredocs break on backticks in this shell.
- Every new i18n key goes into **fa, af and en** (`t()` throws on a missing key). No `any`, `@ts-ignore`, `eslint-disable`, dead code, or UI theater (no fake data/mock APIs).
- **G2 — no parallel architecture:** extend `packages/local-engine`, the `/sync-center` page (`packages/app-shell/src/features/sync/sync-page.tsx`) and the existing oversell conflict (M2.4); never build a second one.
- Money is always integer minor units. `workspace_id` is the only security boundary.
- Lessons go into `.claude/lessons-learned.md` (numbering continues from 218) and the count into `CLAUDE.md`.
- Final report is in **Persian**.

---

## 1. One financial engine (Domain Core)

| Layer                                                                             | Where it runs                                                                             |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Pure calculation** (FIFO/AVCO, COGS, profit, party balance, ledger effect, KPI) | **One implementation** in the shared core; server and device import the same code         |
| Persistence, authorization, authoritative validation, official numbering          | **Server only**                                                                           |
| Local projection                                                                  | Only the **result** of that same core applied to local data; no independent business rule |

- If a function you need is tied to the DB: extract its pure core **and rewire the server to the same core**. A copied client-side version is forbidden.
- Guard: a test proving no file under app-shell/local-engine holds its own financial formula (it imports the shared core instead) — injection-tested.

---

## 2. Phase 0 — MEASURE (no code changes)

Write `docs/offline/ALWAYS-LOCAL-00-FINDING.md` containing:

1. Why do customers not load in the invoice builder when offline? Trace the product path and the customer path side by side: component → hook → cache/SQLite, with file:line. Show exactly where the two paths diverge.
2. A table: each entity (customer, product, stock per warehouse, invoice, invoice line, payment, accounts/journal, employee, warehouse, branch, book currency, exchange rates) → does it have a local table? Who fills it? Where does the UI read it from (API / persisted-query-cache / SQLite)?
3. **Existing sync:** which tables do `sync_change_log` and cursor pull cover today? How are deletes propagated? Which entities from the table above are not covered?
4. Which financial functions are pure and which are bound to Supabase.
5. **Current invoice numbering:** exactly where it comes from (`nextval`? series? branch? fiscal period?), and how an offline invoice number is produced today.
6. What logout does today when the outbox is not empty.
7. Size: how large the local DB gets for a workspace with 100k invoices — by formula, not a guess.

**No code changes until this file exists.**

---

## 3. Execution order (each step has its own proof; the next starts only after the previous is proven)

```
F0 measure
 ↓ proof: current product and customer paths documented
F1 fix offline customers
 ↓ proof: one existing screen reads from Local DB while ONLINE (Principle 2 milestone)
F2 operational dataset
 ↓ proof: online and offline share one read path
F3 local invoice transaction + projection
 ↓
F4 conflicts and reconciliation
 ↓
full verification
```

### F1 — DO: fix offline customers

- Read customers through **the same path** products use. Do not build a second path.
- Offline test (network cut) + injection test.
- Then the Principle 2 milestone: switch one screen (suggested: the customer list) to read from Local DB while online too; test that the screen makes no direct network request for that data.

### F2 — DO: Local Operational Dataset

- **Do not download the whole database.** Operational set: active customers and products, stock of the warehouses the user may access, open invoices + last N days (explicit constant, default 90), open balances, active employees, book currency and rates. Data outside the set ⇒ an explicit "not available offline" message, never an empty list.
- **Sync mechanism:** if the existing `sync_change_log` can cover this set, it **is** the canonical mechanism. A per-table cursor is allowed only if Phase 0 showed coverage is missing — with the reason in the report.
- **Staged bootstrap:** login ⇒ essential data ⇒ app usable ⇒ the rest in the background. Progress ("Preparing data: 87%", "Last sync: 20:08 · 3 changes waiting to send") on the **existing** indicator / sync center.
- Always filter by `workspace_id`; a branch-restricted member never pulls another branch's data.
- A number a decision is based on (stock while invoicing) is read locally, but **the server re-validates at commit**; the client's "I already checked" is never accepted as proof.
- A new pull endpoint (only if needed): `requireWorkspaceContext`, `selectAllPages`, no `.limit` on financial reads.

### F3 — DO: local transaction and projection

- An offline invoice is written in **one SQLite transaction**: invoice + lines + stock movement + party balance + KPI projection + outbox row. No partial writes.
- Every calculation comes from the shared core (§1).
- **Local KPI = server-synced data + pending projections with an explicit label** ("includes 2 invoices awaiting confirmation", key in all three languages). Equality with the server is not expected before reconciliation; **after a full sync** it must be equal.
- Unknown cost is `null`, never `0`. After commit, the server's value replaces the projection.
- **The official number comes only from the server's canonical numbering mechanism** (the one Phase 0 found; if it is `nextval`, use that). Do not build a second numbering system. Offline gets only a temporary id (e.g. `OFF-<device>-<seq>`), printed with a "temporary" label.
- Idempotency key is derived from the document's local id, not from the send attempt.

### F4 — DO: conflicts and owner decision

- States: `PENDING_REVIEW` → `ACCEPTED` | `REJECTED` | `RESOLVED`. Forward-only transitions enforced by a trigger; "runs once" = state in the WHERE clause. If the existing conflict queue already has states, extend those.
- **Reject is not delete.** Kept forever: the document, the decision, the reason, the decider, the time, the original mutation. If nothing was posted on the server, no effect is created; if it was, reverse via `reverseEffects` (`invoice.service.ts`). The device's projection is rolled back.
- **Accept** = commit with the official number; insufficient stock ⇒ the same M2.4 rule.
- Only the owner / an authorized role decides, read from `request.tenancy.role` on the server. The seller sees their own invoice's state and reason.
- Extend the existing conflict screen; no new route or page.
- Migration: additive, idempotent, `REVOKE ALL … FROM service_role` on every new table/function, rollback block, VERIFY file, pg test run twice.

---

## 4. Logout with unsynced changes

- **Never silently destroy an unsynced financial change.**
- Empty outbox ⇒ normal logout and wipe of that owner's local data (`user:workspace`).
- Non-empty outbox and online ⇒ try to sync first, then log out.
- Non-empty outbox and offline ⇒ destructive logout is blocked; an explicit dialog shows the number of pending changes. Local data is kept for that same owner until they log in again and sync. No path may wipe data without explicit confirmation and safe retention of the outbox.
- Switching workspace: each workspace's data is kept separately; one workspace's outbox is never sent to another.

---

## 5. Tests (test behaviour, not implementation; each one injection-tested)

1. Offline: the invoice builder shows customers and products.
2. Online, switched screens read from Local DB too (zero direct requests for that data).
3. **Two devices:** server stock 5, both offline sell 3 ⇒ the outcome is **deterministic** (same every run) and the M2.4 rule is applied. Invariants: no invoice disappears without a record, and server stock/ledger are consistent with M2.4 (assert balances, not row counts). Do not hard-code a state like `PENDING_REVIEW` unless that is exactly what M2.4 defines.
4. Reject ⇒ the document, reason, decider and original mutation remain.
5. KPI: before sync = server + labelled pending; after full sync = server KPI (fixture with two currencies).
6. A temporary id never becomes the server's official number; the official number comes from the canonical mechanism.
7. Re-sending the same outbox entry ⇒ one invoice.
8. Logout with a non-empty outbox while offline ⇒ no mutation is lost.
9. A branch-restricted member does not pull another branch's data.
10. The one-financial-engine guard (§1).

---

## 6. Finishing

Order: full verification (tsc in every package, backend vitest, ui vitest, desktop jest, mobile jest) → eslint on changed files from each package's own folder → Windows build (`electron-builder --win --publish never -c.electronDist=node_modules/electron/dist`, probe `better_sqlite3` with `ELECTRON_RUN_AS_NODE=1`, expect `RESULT=LOADED`) and Android build (`pnpm --filter @hisabche/mobile android:release`, **check the APK file timestamp**, not the Gradle message) → lessons → `graphify.exe . --update`.

The report (in Persian) includes: every new abstraction with its "why the existing one was not enough", a table of real numbers, and exactly one status: `VERIFIED_COMPLETE` · `IMPLEMENTED_NOT_LIVE_VERIFIED` · `BLOCKED_EXTERNAL_CREDENTIAL` · `BLOCKED_BY_EXISTING_SYSTEM` · `NOT_APPLICABLE` · `FAILED`. Nothing is `VERIFIED_COMPLETE` without real HTTP or a real database. Claiming PASS without command output is forbidden.

**If at any point the work grows beyond one step, stop there, report the finished step, and do not continue.**
