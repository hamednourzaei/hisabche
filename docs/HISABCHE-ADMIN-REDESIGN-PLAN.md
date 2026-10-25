---
document_id: hisabche-admin-redesign-plan
version: 1.0.0
status: active
last_updated: 2026-10-22
scope: apps/admin
owner_decisions:
  - 'Work on top of the existing uncommitted tree; never stage, commit, revert, stash or checkout.'
  - 'Back test = backend/API regression + UI verification with existing tooling only.'
  - 'No new dependency. axe/Lighthouse/E2E/screen-reader are recorded as NOT VERIFIED.'
  - 'Dashboard revenue tab: no invented numbers; honest empty state + link, recorded P2/Deferred.'
  - 'Hub/nav structure may not change without approval.'
---

# Hisabche Admin Redesign — Plan

> Companion documents:
> [`HISABCHE-ADMIN-UI-UX-AUDIT-2026-10-22.md`](./HISABCHE-ADMIN-UI-UX-AUDIT-2026-10-22.md) ·
> [`engineering/HISABCHE_ADMIN_REDESIGN_NOTEBOOK.md`](./engineering/HISABCHE_ADMIN_REDESIGN_NOTEBOOK.md)

---

## 1. Goal and non-goals

**Goal.** Make the platform console trustworthy for daily financial/operational work: dense but
legible, correct in fa/af/en and dark/light, keyboard-complete, and honest about state
(default / loading / empty / error / permission).

**Non-goals.**

- No backend contract change, no schema change, no permission-model change.
- No new dependency, no test framework, no CSS framework change.
- No change to the 8 hubs, their ids/order, or the 10 legacy redirects.
- No visual re-skin for its own sake; every change traces to a finding in the audit.

---

## 2. Adaptation Map — Pestinu rule → Hisabche decision

The two UI-UX documents describe **Pestinu**, a storefront built on Next.js + Tailwind 4 +
`src/components/ui`, with a pistachio/cream/gold brand. They are used as a **rubric**, never as a
specification. Every rule was re-pointed at Hisabche source.

|   # | Pestinu rule (source)                        | Hisabche equivalent                                                 | Decision                                                                                              |
| --: | -------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
|   1 | Tokens live in one `globals.css`             | `packages/ui/src/styles/globals.css` (dark default, light override) | Adopt the rule, point at the shared file. Admin never defines colour.                                 |
|   2 | shadcn primitives in `src/components/ui`     | `@hisabche/ui`, re-exported by `apps/admin/components/ui/index.ts`  | Adopt; a missing primitive is added to `packages/ui` once, never locally (guard test enforces it).    |
|   3 | Tailwind 4 `@theme` syntax                   | Tailwind 3.4 + `theme.extend`                                       | Keep 3.4. No syntax migration.                                                                        |
|   4 | `fa-IR` + `en`                               | `fa` (RTL), `af` (RTL), `en` (LTR)                                  | Extend to three locales; every new key in three files.                                                |
|   5 | Pistachio / cream / gold palette             | teal `--color-primary` + neutral surfaces + semantic states         | **Do not import.** Brand stays Hisabche. Light mode's warm neutral surface already exists as a token. |
|   6 | Storefront pages (home, PDP, cart, checkout) | 8 control-plane hubs, 34 tabs, 8 standalone screens                 | Not applicable. Data-table, form, dialog and state rules are carried over.                            |
|   7 | `framer-motion` motion system                | CSS transitions only, `motion-reduce:` guards                       | Keep. No motion dependency.                                                                           |
|   8 | «Add a page under `src/app`»                 | A hub tab behind `?tab=`; a new route is the last resort            | Adopt; CMS routes are the exception and are reported, not restructured.                               |
|   9 | «Every page appears in navigation»           | 8 hubs in `ADMIN_NAV` (guard test) + legacy redirects               | Adopt for hubs. CMS discoverability is reported as HC-NAV-03; adding a 9th nav item needs approval.   |
|  10 | URL-persisted list state (`UX-LIST-03`)      | `HubTabs`/`useHubTab` already persist `?tab=`                       | Adopt and generalise to `q`, `page`, filters, sort.                                                   |
|  11 | axe/Lighthouse gates in CI                   | No such tooling installed                                           | Replace with static guards + source assertions + manual keyboard pass; record `NOT VERIFIED`.         |
|  12 | «One table component»                        | `DataTable` exists with sortable headers, cards and selection       | Adopt. Extend with an optional `caption`, and drive server pagination externally.                     |
|  13 | Brand voice / marketing copy                 | Persian/Dari operational copy, `.claude/DARI-GLOSSARY.md`           | Adopt the glossary; no marketing tone in the console.                                                 |

**Rules that do not fit, with reason.** Storefront-specific rules (cart, checkout, product gallery,
promo banners) have no equivalent and are dropped. The single-`globals.css` _ownership_ rule is
inverted: the admin consumes the design system, it does not own it. The «every route in nav» rule is
suspended for CMS until the owner decides where CMS belongs.

---

## 3. Token map (no new colours)

| Need                 | Token                                                                                | Admin usage after redesign                            |
| -------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Page surface         | `--surface-base`                                                                     | app background                                        |
| Card / panel         | `--surface-elevated`                                                                 | cards, sheets, table container                        |
| Muted / header strip | `--surface-muted`                                                                    | table head, filter bar, skeleton                      |
| Overlay              | `--surface-overlay`                                                                  | dialogs, command palette                              |
| Text                 | `--fg-primary` / `--fg-secondary` / `--fg-tertiary`                                  | headings / body / metadata                            |
| Border               | `--border-default` / `--border-strong`                                               | separators / focusable inputs                         |
| Brand & interaction  | `--color-primary`, `-hover`, `-fg`                                                   | primary button, active nav, selection, focus ring     |
| State                | `--color-success`, `--color-warning`, `--color-destructive`, `--color-info` (+`-fg`) | status only, never decoration                         |
| Focus                | `--focus-ring`, `ring-ring`                                                          | every interactive element, unchanged weight           |
| Radius               | `--radius-sm` (8) / `--radius-md` (12) / `--radius-lg` (16)                          | controls / cards / dialogs; `rounded-2xl/3xl` retired |
| Type                 | `--text-body` (0.875–1rem), `--text-caption` (0.813rem)                              | data floor 12 px; `text-[9-11px]` retired             |
| Z-index              | `--z-sticky` (20), `--z-modal` (40), `--z-cmdk` (55)                                 | header / drawer / palette                             |
| Numerals             | `font-variant-numeric: tabular-nums`                                                 | every amount, count, date, id                         |

Admin's private `blue`/`violet` scales (`tailwind.config.ts:73-104`) are removed **only after**
proving no `packages/ui` file references `blue-*`/`violet-*` classes; the 23 usages move to tokens.

---

## 4. Two design directions

### 4.1 Direction A — «Ledger» (recommended)

A dense operational ledger, in the tradition of IBM Carbon and GitHub Primer.

- 13 px base, 12.5–13 px table text, `tabular-nums` everywhere, 32 px compact / 40 px comfortable
  row height with a persisted density switch.
- Separation by border + one surface step; no shadows or gradients on working surfaces.
- teal reserved for interaction; success/warning/destructive only for state.
- Sticky table head, end-aligned numeric columns, mono ids/amounts, filter bar above the table,
  sort and page visible.
- 240 px sidebar with group labels (same 8 items), 56 px header with hub title + context + ⌘K.

**Why.** This is a one-operator console used for long audit sessions. Scan speed and number
alignment beat breathing room. It also maps 1:1 onto the tokens that already exist, so the diff is
small and reviewable.

### 4.2 Direction B — «Console» (alternative)

A Polaris-style workspace: 14 px base, a page header with description and one primary action, a
filter card, record detail in a side `Sheet`, comfortable density by default.

**Trade-off.** More discoverable for occasional users and better for record-by-record work, but it
shows fewer rows per screen, adds chrome to 34 tabs, and touches far more files for the same
correctness fixes. For a solo founder who lives in the audit log, it is the wrong default.

### 4.3 Decision

**A as the base, borrowing two patterns from B**: a real page header (title, one-line purpose,
primary action) and a right-side `Sheet` for record detail instead of inline expansion. Combined
principles: Carbon (density, tabular numerals, 8 px grid), Polaris (resource index: header → filter
→ table → bulk), Primer (semantic colour restraint, visible focus, progressive disclosure).

---

## 5. Batches

Every batch is independently reviewable and revertible. No batch starts before the previous batch's
type-check and lint are green. No commit, stage, stash or checkout at any point.

### Batch status — measured 2026-10-22

Commands and totals for every row are in `docs/engineering/HISABCHE_ADMIN_REDESIGN_NOTEBOOK.md`.
"Done" means type-checked, linted and covered by the tests listed there — not "verified in a browser".

| Batch | Status | Done                                                                                            | Not done                                                                                     |
| ----- | ------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| B0    | DONE   | the three documents                                                                             | —                                                                                            |
| B1    | DONE   | shell, nav model, palette, drawer, route boundaries, 14 keys                                    | keyboard/focus pass (`NOT VERIFIED`)                                                         |
| B2    | DONE   | `admin-format`, `use-admin-list-state` (adopted by `users`), `useAdminLocale`, `useAdminTableT` | -                                                                                            |
| B3    | DONE   | all 18 tables on `DataTable` + `TableColumn` + `ErrorState`, cards below 768 px                 | -                                                                                            |
| B4    | DONE   | 12 `SelectField`; 3 `AlertDialog`s naming their target; new keys in fa/af/en                    | keyboard/focus pass (`NOT VERIFIED`)                                                         |
| B5    | DONE   | dashboard formatters, honest revenue tab, past-due row identity                                 | —                                                                                            |
| B6a   | DONE   | revenue hub: 3 tables, IRR/IRT, maker-checker labels                                            | -                                                                                            |
| B6b   | DONE   | offline (5 tables), 18 date/count sites, 35 sub-12px labels                                     | -                                                                                            |
| B6c   | DONE   | product, operations, OAuth apps, market, AI, servers                                            | -                                                                                            |
| B6d   | DONE   | blog (posts/comments/taxonomy) and CMS pages/globals/editor rewritten and typed                 | the CMS section editor has no backend API, so its dead buttons were removed instead of faked |
| B7    | DONE   | 14 guards including repo-wide scans; 21 admin tests; 8 files / 86 backend tests                 | axe / Lighthouse / E2E (`NOT VERIFIED`)                                                      |
| B8    | DONE   | `next build` `EXIT=0`, 27 routes; rebuilt after B6                                              | -                                                                                            |

### B0 — Documents (this batch)

- Files: the three documents in this set.
- Risk: none.
- Test: content matches measured evidence; no claim without a command.
- Rollback: delete the files.
- Acceptance: audit has file:line + severity + rule id for every finding; screen matrix covers 52
  screens; notebook has a SELF_CRITICAL entry per B1 file.

### B1 — Shell and foundation

- Files: `apps/admin/components/admin-shell/{admin-nav.ts,admin-header.tsx,admin-sidebar.tsx,command-palette.tsx}`, `apps/admin/app/[lang]/(admin)/dashboard-layout.tsx`, `apps/admin/app/[lang]/(admin)/{error,loading,not-found}.tsx`, `packages/i18n/messages/{fa,af,en}/common.json`, `apps/admin/components/ui/index.ts` (only if an export is missing).
- Risk: medium — every screen renders through the shell.
- Test: `tsc --noEmit`; `eslint` on the changed files; both guard tests; static grep guards
  (no bare `router.push('/`, no palette class in the shell); manual keyboard pass when a session
  exists.
- Rollback: revert the batch's files.
- Acceptance: skip link reaches `main`; drawer is a real dialog with Esc and focus return; palette
  keeps the current locale; sidebar marks the active hub with `aria-current`; header shows the
  current hub; error/loading/not-found boundaries exist; all new strings in fa/af/en.

### B2 — Shared admin patterns

- Files: `apps/admin/lib/admin-format.ts` (new), `apps/admin/hooks/use-admin-list-state.ts` (new),
  `apps/admin/components/admin-shell/admin-ui.tsx` (extend, no new primitive).
- Risk: low.
- Test: tsc; source-assertion tests for locale usage and URL persistence; guard test still bans
  local primitives.
- Rollback: revert the new files and the `admin-ui.tsx` extension.
- Acceptance: one place formats money/date/number by locale; one hook owns `q/page/filter/sort` in
  the URL; `ErrorState` remains the only error surface.

### B3 — Tabular data

- Files: 10 hub/legacy clients; `packages/ui/src/components/ui/data-table/data-table.tsx` for an
  optional `caption` prop (single shared addition).
- Risk: medium — shared primitive.
- Test: `packages/ui` tsc + vitest; admin tsc; DOM assertions for `caption`/`aria-sort`; below-md
  card rendering.
- Rollback: revert both sides.
- Acceptance: every data table is `DataTable`; sortable headers expose `aria-sort`; server-paged
  lists use `paginate={false}` + external `PaginationBar`; card view below 768 px; no raw `<table>`.

### B4 — Forms and destructive actions

- Files: the 12 raw-select sites, `users-client.tsx`, `market-client.tsx`,
  `blog-admin-client.tsx`, `post-editor-client.tsx`, CMS clients, `offline-client.tsx`.
- Risk: low–medium (writes unchanged; presentation and confirmation only).
- Test: tsc; lint; source guards: no `<select`, no `confirm(`, every StepUp description contains a
  target placeholder; manual pass on one flow per page when a session exists.
- Rollback: revert.
- Acceptance: labels and inline errors wired with `aria-invalid`/`aria-describedby`; first invalid
  field focused; destructive dialogs name the target and translate the action.

### B5 — Dashboard

- Files: `dashboard-client.tsx`.
- Risk: low; **no API change**.
- Test: tsc; eslint; visual check when possible.
- Rollback: revert.
- Acceptance: revenue tab becomes an honest empty state that explains what will appear and links to
  the billing ledger; no invented KPI; past-due rows no longer lead with a bare UUID.

### B6 — Page families (four sub-batches)

- B6a customers + revenue (workspaces, users, subscriptions, wallet, plans, ledger, maker-checker).
- B6b offline (8 tabs, largest surface).
- B6c product + operations (features, AI, OAuth, market, health, servers, jobs, announcements).
- B6d content + security (blog, CMS, audit, roles, sessions, events).
- Risk: medium per sub-batch.
- Test: per sub-batch tsc/lint + the source guards; each page's default/loading/empty/error states
  reviewed; accepted only when every table in the sub-batch is converted.
- Rollback: sub-batch granularity.
- Acceptance: URL state on every list; locale formatting everywhere; no palette class, no
  sub-12 px data text; `ErrorState` on every failed read; destructive actions name their target.

### B7 — Backend/API regression

- Files: `apps/admin/src/__tests__/*.test.ts` (new guard tests), no production backend file.
- Risk: none.
- Test: the 8 existing admin test files (86 tests) re-run; new guards assert the UI rules that
  depend on backend contracts (audit-log shape, permission gate, step-up requirement) without
  touching them.
- Rollback: delete the new tests.
- Acceptance: 86/86 existing tests still green; no endpoint path, payload or permission changed in
  the diff (proved by `git diff --stat` on `backend/`).

### B8 — Build

- Files: none.
- Command: `pnpm --filter @hisabche/admin build`, only after B1–B7.
- Acceptance: build exits 0; report the real result. If it fails, the failure is reported, not
  hidden.

---

## 6. Verification contract

| Check                                  | How                                                         | Honest status vocabulary      |
| -------------------------------------- | ----------------------------------------------------------- | ----------------------------- |
| Types                                  | `npx tsc --noEmit` in `apps/admin`                          | pass/fail with exit code      |
| Lint                                   | `npx eslint <changed files>` from `apps/admin`              | error count                   |
| Unit/guard                             | `node ../../packages/ui/node_modules/vitest/vitest.mjs run` | files/tests                   |
| Backend regression                     | 8 admin test files                                          | files/tests, before and after |
| Build                                  | `pnpm --filter @hisabche/admin build` at B8                 | pass/fail                     |
| axe / Lighthouse / E2E / screen reader | not installed, no AAL2 session                              | **NOT VERIFIED**              |
| Keyboard/focus                         | manual dev-server pass if a session is provided             | else **NOT VERIFIED**         |
| Responsive/theme/locale matrix         | manual screenshots if a session is provided                 | else **NOT VERIFIED**         |

No sentence in the final report may say «verified», «production-ready» or «fully redesigned» unless
the corresponding row above was actually executed.

---

## 7. Open decisions (owner)

1. Dashboard revenue tab — honest empty state (default) vs. implement from existing billing
   endpoints. No third option.
2. CMS placement — keep orphan routes (default) vs. add an entry to the content hub.
3. `af` locale contains Persian copies in `admin.*`; fixing all 811 keys is a separate translation
   task, not part of this redesign.
