# Session cache — Offline Edition, Phase 1 (audit only)

**Date:** 19 Oct 2026
**Scope:** `docs/offline/OFFLINE-EDITION-PROMPT.md` → Phase 1 (Audit → `docs/offline/01-CAPABILITY-MATRIX.md`)
**Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED` — Gate 1 is **pending owner approval of the L/C split**.
**Branch:** `main`. Nothing committed, nothing pushed.

---

## 1. What was produced

| File | Purpose |
| --- | --- |
| `docs/offline/01-CAPABILITY-MATRIX.md` | The Gate 1 artefact: 72 route entries, 34 capability rows across 10 areas, the L/C split, the startup-network section, and Appendix A (every route → hook → endpoint). |
| `.claude/SESSION-CACHE-2026-10-19-OFFLINE-PHASE-1.md` | This file. |
| `.claude/lessons-learned.md` | Entries **186–190** appended. |
| `.claude/BUG-REGISTRY.md` | **BUG-125 … BUG-129** appended (findings from reading, none reproduced on the live database). |

No product code changed. No migration. No build, no lint, no test run — there was nothing to run.

---

## 2. Numbers measured (all from this session)

```
path: keys in app.tsx                         → 71
index routes (index: true)                    → 1
total route entries                           → 72
route entries inside the layout               → 70   (33 path: pages + 1 index + 36 redirects)
rendered screens (33 + index + /login)         → 35
redirect-only entries                         → 36   (34 inline <Navigate> + 2 legacy id components)
<Navigate> elements in app.tsx                → 36
lazy(() => import(…)) page modules            → 34   (/login is a static import)
path: keys declared twice                     → 1    ('inventory', lines 148 and 193)

hook rows listed in Appendix A                → 443
@hisabche/api hook mounts on path: pages      → 429
distinct hook export names                    → 311
distinct method+path strings from a page      → 308  (300 through hooks + 8 direct calls)
distinct sync endpoints (sync-center engine)  → 15
distinct method+path in the whole document    → 321
backend route files (backend/src/routes/*.ts) → 89
backend handler registrations                 → 717  (711 fastify.* + 1 fastify.options + 5 server.*)

docs/offline/01-CAPABILITY-MATRIX.md          → see §3 of this file
```

Route → hook → endpoint mapping was **generated**, not hand-written: screens.ts
export table → app.tsx lazy map → 4-level local import walk → `@hisabche/api`
barrel resolution → per-hook-body `apiClient` slice. Generators were throwaway
scripts outside the repo (Phase 1 may not add code).

---

## 3. The five findings that decide Phase 2

### F1-01 — `inventory` is declared twice in the router
`app.tsx:148` and `app.tsx:193`. Same key, same target. Harmless today (first
match wins), invisible to the route-parity guard. Phase 2 deletes one; Phase 1
did not.

### F1-02 — device money is `REAL`, server money is integer minor units
`packages/app-bridge/src/local-schema.ts` stores `subtotal REAL`, `total REAL`,
`paid_amount REAL`, `buy_price REAL`, `sell_price REAL`, `unit_price REAL`,
`amount REAL`. `AGENTS.md` §1.3 requires integer minor units on the money path.
Every offline total is therefore a different number from the server's. Fixing it
is `SCHEMA_VERSION` 2 → 3 plus a migration of existing device rows.

### F1-03 — the device schema hardcodes `'AFN'` twice
`invoice.currency TEXT NOT NULL DEFAULT 'AFN'` (line 64) and
`"transaction".currency TEXT NOT NULL DEFAULT 'AFN'` (line 95). `AGENTS.md` §3
forbids a hardcoded currency anywhere. It is masked today only because the one
local write path (a queued invoice) carries the user's chosen currency.

### F1-04 — three device tables are decoration
`transaction`, `inventory_movement`, `employee` are created, indexed, listed in
`WRITABLE_COLUMNS`, and **never pulled and never written**. They read as offline
coverage and provide none. Phase 2 either fills them or drops them.

### F1-05 — the shell fails **open** when it cannot reach the server
`useMyCapabilities()` and `useSubscriptionLocked()` both return `undefined` on a
failed read, and both gates are written as «no data = no restriction». Offline,
every route renders, including ones the role excludes. The local IPC handlers
(`authenticateAndAuthorize`) also take their capability from that same
server-provided list, so an offline app cannot authorize a local write either.

---

## 4. The three questions the owner must answer before Phase 2

1. **What does «offline» mean?** Today: one queued write (invoice create).
   The spec: run the business offline. The second needs §4.2 create/edit/delete,
   §4.3 stock, §4.5 ledger, §4.6 till extracted — four extractions, not one.
2. **Does the device move to integer minor units?** If not, every local total can
   disagree with the server by a cent, permanently.
3. **Is an offline invoice numbered at queue time or at push time?** Queue time
   needs a per-device reserved range. Push time means the printed receipt has no
   number.

Until these are answered, Phase 2's first commit cannot be scoped.

---

## 5. Where the work actually is (ranked by risk, not by size)

| Rank | Extraction | Why it is first |
| --- | --- | --- |
| 1 | Invoice create pipeline (`applyTax`, `applyCosting`, `generateInvoiceNumber`, `createAccountingEntries`, `reverseEffects`) | Without it «offline invoicing» is a pending request, not a document. Stock is not moved, cost is not consumed, no number exists. |
| 2 | `costing.domain.ts` (`planConsumption`, `fifoOrder`, `mayIssue`, `grossProfit`) | Every margin, every COGS, every manufacturing cost. Also the only place «unknown cost» is expressed correctly. |
| 3 | `payments.domain.ts` (`settlesInCurrency`, `paymentPosting`, `partyBalancesByCurrency`) | A payment recorded offline against an already-settled invoice is a double payment. Per-currency balances are non-negotiable. |
| 4 | Startup session (§6 of the matrix): workspace, capabilities, subscription, books currency | The app currently cannot cold-start offline at all. |
| 5 | `warehouse-summary.domain.ts` (`stockEditWarehouse`, `checkAssign`) | The file's own comment records the exact bug this prevents (product says 20, warehouse says -10). |

`computeInvoiceMoney` in `packages/validation/src/schemas/invoice.schema.ts:157`
is **already shared** — it is the one rule that does not need extracting. Start
there to establish the pattern.

---

## 6. Traps found while reading (for the next session)

- `submitInvoice()` queues only when `idempotencyKey` **exists** and
  `isOffline()` is true; without a key it never queues (by design — a replay
  would become a second sale). Any new offline write needs the same rule.
- `useBackgroundSync` runs `runSync` on mount **before** the workspace has
  loaded, so its pull cannot record a cursor; the run the workspace arrival
  triggers is the real one. Do not «fix» this by removing the first run.
- `sync-engine.ts` `routeFor()` decides between the domain route and the row
  writer. Invoices must always take the domain route; a total written straight
  to the table moves no stock.
- `stream-client.ts` carries **no data** — it is a wake-up only. Losing it
  degrades to «slower», never «wrong». Do not put correctness in it.
- The four `public-*` / `portal` / `my-attendance` routes bypass `apiClient`
  entirely and call `fetch()` against `NEXT_PUBLIC_API_URL`. They have no token,
  no workspace header and no offline queue. Do not «fix» them by routing them
  through `apiClient` — they are meant to work for a stranger.
- `local-schema.ts` is the **single** schema for both hosts (Electron SQLite and
  `expo-sqlite`). A schema change is a change on both platforms in one commit.
- `db:setWorkspace` is gated as `record.delete` because it can discard the whole
  cached dataset, and it refuses while unsynced mutations are queued. Any Phase 2
  purge must respect that refusal.

---

## 7. Pre-existing working-tree state (not mine, untouched)

`git status --porcelain` before Phase 1 listed **32** entries (25 modified, 4 deleted,
3 untracked): modified `CLAUDE.md`, `.claude/lessons-learned.md`, two backend services
plus one backend test, three i18n bundles, twelve `packages/ui` components/tests plus
`packages/api/src/index.ts`, `packages/ui/src/index.ts` and `packages/ui/src/screens.ts`,
four deleted files (`packages/api/src/hooks/snapshots.ts`,
`data-snapshots-panel.tsx`, `governance-container.tsx`, `governance-view.tsx`), and three
untracked files. Those are the owner's in-flight work; nothing in this phase read them for
a decision or modified them.

This phase added four entries of its own: `docs/offline/` (the matrix, new; the folder also
held the pre-existing untracked `OFFLINE-EDITION-PROMPT.md`), the new
`.claude/SESSION-CACHE-2026-10-19-OFFLINE-PHASE-1.md`, and appended lines in
`.claude/lessons-learned.md` and `.claude/BUG-REGISTRY.md` — the owner asked for the
`.claude/` phase record after each phase.

---

## 8. Next session starts here

1. Owner approves or edits the L/C split in `docs/offline/01-CAPABILITY-MATRIX.md` §5.
2. Answer the three questions in §4 above.
3. Phase 2, first task: extract `computeInvoiceMoney` usage into a device-callable
   module and prove, with a test, that the device total equals the server total
   to the minor unit for the same input — **before** touching the device schema.
