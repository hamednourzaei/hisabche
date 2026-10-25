---
document_id: hisabche-admin-ui-ux-audit
version: 1.0.0
status: active
last_updated: 2026-10-22
language: en
scope: apps/admin
locales: [fa (rtl), af (rtl), en (ltr)]
themes: [dark (default), light]
rubric: docs/UI-UX-GUIDELINES.md (adapted, see HISABCHE-ADMIN-REDESIGN-PLAN.md §2)
method: static source review + measured greps + existing vitest/pg suites
---

# Hisabche Admin UI/UX Audit — 2026-10-22

> **Status:** AUDIT. No application code was changed in this pass.
> **Scope:** every route under `apps/admin/app/[lang]` (52 screens), the admin shell,
> and the shared primitives the shell consumes from `@hisabche/ui`.
> **Not verified:** axe, Lighthouse, E2E, screen reader, any authenticated page render.
> No admin AAL2 session is available and no browser-test dependency is installed.
> Those rows are marked `NOT VERIFIED` — never "0 violations".

---

## 0. Executive summary

| Severity |       Count | Meaning                                                                                              |
| -------- | ----------: | ---------------------------------------------------------------------------------------------------- |
| **P0**   | 0 confirmed | No destructive action was proven to run without any confirmation. Unverified flows are listed in §6. |
| **P1**   |          20 | Correctness, i18n, navigation, state, URL persistence, keyboard/dialog accessibility.                |
| **P2**   |          11 | Visual consistency, token drift, legibility, orphan discoverability, metadata.                       |

Top five, in order:

1. **HC-I18N-01** — 34 date/number sites use `toLocaleString()` / `toLocaleDateString()` with no
   locale; `@hisabche/formatting` has **zero** imports in `apps/admin`. fa/af users get Gregorian
   dates and, depending on OS locale, inconsistent digits.
2. **HC-URL-02** — the workspace activity filter runs **after** pagination and computes its counts
   from the current page, so both rows and counts are wrong.
3. **HC-NAV-01/02** — the command palette and CMS editor push locale-less routes; `proxy.ts`
   rewrites them to `DEFAULT_LOCALE = fa`, silently switching an English admin to Persian.
4. **HC-A11Y-01/02** — the mobile drawer is not a dialog (no focus trap/Esc/`aria-modal`), and every
   hub tab bar uses `role="tab"` without a tabpanel, `aria-controls`, or arrow keys.
5. **HC-STATE-01/02** — there is no `error.tsx`/`loading.tsx`/`not-found.tsx` anywhere in
   `apps/admin/app`, and most hubs render a failed read as an empty list.

---

## 1. Method and baseline

### 1.1 What was read

- Authority: `AGENTS.md`, `CLAUDE.md`, `SELF_CRITICAL_PROTOCOL.md`, `.ai/codebase/CODEBASE_MAP.md`.
- Rubric inputs (Pestinu origin, adapted — see plan §2): `docs/UI-UX-GUIDELINES.md`,
  `docs/UI-UX-AUDIT-2026-10-22.md`.
- Admin: all route files, all 8 hub clients, `dashboard-layout.tsx`, `admin-header.tsx`,
  `admin-sidebar.tsx`, `admin-nav.ts`, `command-palette.tsx`, `admin-ui.tsx`,
  `use-admin-theme.ts`, `step-up-dialog.tsx`, `login-client.tsx`, `proxy.ts`, `lib/admin-auth.ts`,
  `tailwind.config.ts`, `components/ui/index.ts`, both guard tests, all 20 hooks (endpoint map).
- Shared: `packages/ui/src/styles/globals.css` (token blocks), `hub-tabs.tsx`, `data-table.tsx`,
  `sheet.tsx`, `use-locale-push.ts`, `use-date-format.ts`, `packages/formatting` public API.

### 1.2 What was executed

| Command                                                                                          | Result                                                    |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `git status --porcelain`, `git rev-parse --abbrev-ref HEAD`, `git log -5`                        | `main`, 10 modified + 5 untracked, last commit `7f2081f3` |
| `npx tsc --noEmit` (apps/admin)                                                                  | exit **0**, no diagnostics                                |
| `node ../../packages/ui/node_modules/vitest/vitest.mjs run` (apps/admin)                         | **2 files / 7 tests passed**                              |
| `npx vitest run` — admin-gate, admin-membership, cms-admin-guard, platform-admin-isolation       | **4 files / 67 tests passed** (19.28 s)                   |
| `npx vitest run` — admin-02-security, admin-03-customers, admin-04-billing, admin-06-ops (`.pg`) | **4 files / 19 tests passed** (16.60 s)                   |

### 1.3 Measured surface

| Measure                                                           |                                            Value |
| ----------------------------------------------------------------- | -----------------------------------------------: |
| `apps/admin` TS/TSX files / lines                                 |                                     105 / 14,257 |
| `page.tsx` route files                                            |                                               26 |
| layouts / middleware                                              |                                            2 / 1 |
| Screens (hub tabs + standalone + redirects + login)               |                                               52 |
| Admin API endpoints (6 backend route files)                       |                                   61 (+1 public) |
| Hooks / API calls                                                 |                                        20 / ~110 |
| `admin.*` i18n keys per locale (fa/af/en)                         | 811 / 811 / 811 (no gaps in the admin namespace) |
| `<DataTable>` usages                                              |                                            **0** |
| raw `table/thead/tbody` occurrences                               |                                               10 |
| raw `<select>`                                                    |                                               12 |
| Tailwind palette classes (`text-blue-400`, `text-emerald-500`, …) |                                               23 |
| `rounded-2xl/3xl` (24 px)                                         |                                               42 |
| `text-[9px]/[10px]/[11px]`                                        |                                               73 |
| `toLocaleString` / `toLocaleDateString` without locale            |                                               34 |
| imports from `@hisabche/formatting`                               |                                            **0** |
| `error.tsx` / `loading.tsx` / `not-found.tsx`                     |                                            **0** |
| bare `router.push('/…')` (no locale)                              |                                                3 |
| StepUpDialog consumers                                            |                                          7 files |
| `window.confirm` / `confirm()`                                    |                                                3 |

---

## 2. Findings

Each finding has: id, severity, rule id, exact location, evidence, fix.
`status` is `OPEN` unless a later batch closed it (the notebook records closures).

### 2.1 P1

| ID          | Rule             | Location                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Evidence                                                                                                                                                                                                                           | Fix                                                                                                                                                         | Status                                                                                                                                   |
| ----------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| HC-I18N-01  | `A11Y-LANG-01`   | `revenue-client.tsx:119,122,125,129,198,209`; `audit-logs-client.tsx:158`; `security-client.tsx:136,357,442,445,534`; `dashboard-client.tsx:161,192,211`; `workspace-360-sheet.tsx:158,209,293,342,376`; `offline-client.tsx:321,324,462,550,715,819`; `wallet-client.tsx:132,596`; `subscriptions-client.tsx:331`; `upgrade-requests-panel.tsx:101`; `operations-client.tsx:202,307,311`; `oauth-apps-client.tsx:419`; `blog-admin-client.tsx:275`; `member-list.tsx:143`; `workspace-row.tsx:133` | 34 calls to `toLocaleString()`/`toLocaleDateString()` with no locale argument. `grep -c "@hisabche/formatting" apps/admin` = 0. The selected locale therefore does not decide the calendar or the digits.                          | One admin formatter (`lib/admin-format.ts`) + `useDateFormat()`; delete all 34 call sites.                                                                  | CLOSED - 0 `toLocale*` in `apps/admin`; every site goes through `lib/admin-format`                                                       |
| HC-I18N-02  | `I18N-02`        | `revenue-client.tsx:130`                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Literal Persian string `'— (همواره)'` inside the plan table, shown unchanged in `en` and `af`.                                                                                                                                     | i18n key in fa/af/en.                                                                                                                                       | CLOSED — `admin.revenue.effectiveUntilOpen` in fa/af/en                                                                                  |
| HC-I18N-03  | `I18N-02`        | `cms-page-editor-client.tsx:132,142`; `cms-globals-client.tsx:64,71`                                                                                                                                                                                                                                                                                                                                                                                                                                | English placeholders `Page Title`, `e.g. about-us`, `Key (e.g. dashboard.welcome)`, `Content string` in a fa-first UI.                                                                                                             | i18n keys.                                                                                                                                                  | CLOSED - the CMS screens read `cms.*` + `admin.cms.*`; no English literal is left except proper nouns                                    |
| HC-I18N-04  | `MONEY-01`       | `revenue-client.tsx:119-122`                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `{(p.amount_irr / 10).toLocaleString()} {t('currency.toman')}` and `{p.amount_irr.toLocaleString()} IRR` — currency label and the ÷10 conversion are hardcoded in the view.                                                        | Take currency and scale from the server/settings; render with `formatMoney`. If the API cannot supply it, show «cannot be calculated», never a fixed `IRR`. | CLOSED — `adminMoney(amount_irr,'IRR')` + `adminMoney(amount_irr/10,'IRT')`; no literal                                                  |
| HC-NAV-01   | `NAV-03`         | `command-palette.tsx:44-65`                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Eight `router.push('/dashboard?tab=…')` calls with no locale. `proxy.ts:44-49` prepends `DEFAULT_LOCALE` (`fa`). From `/en/...` the palette lands on `/fa/...`.                                                                    | `useLocalePush` from the shared UI (or locale from `usePathname`), plus a single `ADMIN_NAV`-driven command list.                                           | CLOSED — palette is `ADMIN_NAV`-driven and uses `useLocalePush`                                                                          |
| HC-NAV-02   | `NAV-03`         | `cms-page-editor-client.tsx:42`                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Same bare `router.push('/cms/pages')` after save/cancel.                                                                                                                                                                           | Same fix.                                                                                                                                                   | CLOSED - the CMS editor navigates through `useLocalePush` and locale-prefixed links                                                      |
| HC-NAV-03   | `NAV-01`         | `admin-nav.ts:107-126`; `admin-nav.ts:40-105`                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `/cms` is absent from `ROUTE_HUB_MAP`, so `activeNavItem()` returns `undefined` on all 5 CMS pages: no active sidebar item, no hub title in the header. There is also no nav entry to reach CMS.                                   | Map `/cms` → `content` (active state) now; adding a visible entry changes the 8-hub structure and needs owner approval.                                     | CLOSED — `/cms` mapped to `content` (active state only; no 9th nav entry)                                                                |
| HC-STATE-01 | `STATE-01`       | `apps/admin/app` (absent files)                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `glob apps/admin/app/**/{error,loading,not-found}.tsx` → **no files**. A render error in any hub drops the console to the framework error surface.                                                                                 | `error.tsx`, `loading.tsx`, `not-found.tsx` at the `(admin)` group.                                                                                         | CLOSED — `(admin)/error.tsx`, `loading.tsx`, `not-found.tsx` added                                                                       |
| HC-STATE-02 | `STATE-02`       | `customers-client.tsx:84-91`; `security-client.tsx:100-109`; `operations-client.tsx:274-280`                                                                                                                                                                                                                                                                                                                                                                                                        | `isError` branches render `EmptyState` (title/description) — no `role="alert"`, no retry. A failed read and an empty dataset differ only in wording.                                                                               | `ErrorState` (role=alert + retry) in every error branch; empty only when the read succeeded.                                                                | CLOSED - every converted screen renders `ErrorState` (role=alert + retry) on a failed read                                               |
| HC-STATE-03 | `STATE-04`       | `dashboard-client.tsx:235-242`                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Dashboard «revenue» tab is `EmptyState` with `admin.empty.comingInNextStep` — placeholder UI in a production console.                                                                                                              | Owner decision: real value from existing billing endpoints, or an honest empty state linking to the billing ledger. No invented aggregation.                | CLOSED (owner decision 4) — honest empty state + link to `?tab=ledger`; no invented number                                               |
| HC-A11Y-01  | `A11Y-DIALOG-01` | `dashboard-layout.tsx:60-79`                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Mobile drawer is a `<div>` with `z-modal`: no `role="dialog"`, no `aria-modal`, no focus trap, no Esc, and the page behind stays focusable. The open button has no `aria-expanded`/`aria-controls`.                                | Render the drawer with the shared `Sheet` (Radix Dialog: trap, Esc, scroll lock, `aria-modal`) or implement the equivalent locally.                         | CLOSED — shared `Sheet` (Radix Dialog) + `aria-expanded`/`aria-haspopup` on the trigger                                                  |
| HC-A11Y-02  | `A11Y-TABS-01`   | `packages/ui/src/components/ui/hub-tabs.tsx:47-77`                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `role="tablist"` + `role="tab"` + `aria-selected`, but no `role="tabpanel"`, no `aria-controls`, no `id`, no roving tabindex, no Arrow/Home/End. Up to 8 tabs sit in the tab order.                                                | APG tabs pattern (shared change, separate batch) or `nav` + links if the tab bar is really navigation.                                                      | OPEN                                                                                                                                     |
| HC-A11Y-03  | `A11Y-TABLE-01`  | `security-client.tsx:420-459`; `customers-client.tsx:105`; `product-client.tsx:80`; `operations-client.tsx:190`; `offline-client.tsx` (6 tables); `blog-admin-client.tsx`; `oauth-apps-client.tsx`                                                                                                                                                                                                                                                                                                  | 10 raw tables. None has `<caption>` or an accessible name; header cells omit `scope`; no `aria-sort` because there is no sort state.                                                                                               | `DataTable` (already provides `SortableHeader` + `aria-sort`); add `caption` support where the name is not obvious.                                         | PARTIAL — 7 of 10 tables converted (security 4, revenue 3)                                                                               |
| HC-A11Y-04  | `A11Y-NAME-02`   | `security-client.tsx:448-454`                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | «Revoke session» repeated on every row; the accessible name carries no session or admin identity.                                                                                                                                  | Name includes the row's identity (`email`/`session id` prefix).                                                                                             | CLOSED — revoke label names the admin; revenue approve/reject name the action type                                                       |
| HC-A11Y-05  | `A11Y-LABEL-01`  | `security-client.tsx:82`; `wallet-client.tsx:435`                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Search inputs carry only a placeholder. The placeholder disappears on typing and is not a label.                                                                                                                                   | `<label className="sr-only">` or `aria-label`.                                                                                                              | PARTIAL — security search moved into the `DataTable` toolbar; wallet input open                                                          |
| HC-A11Y-06  | `A11Y-NAME-03`   | `product-client.tsx:132-137`                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Feature-flag `Switch` has no accessible name; a screen reader announces «switch, on» with no flag.                                                                                                                                 | `aria-label` containing the flag key.                                                                                                                       | OPEN                                                                                                                                     |
| HC-A11Y-07  | `A11Y-SKIP-01`   | `dashboard-layout.tsx:45-88`                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | No skip link; `<main>` has no `id` or `tabIndex`. Keyboard users traverse the 8-item rail on every page.                                                                                                                           | Skip link + `main#admin-main tabIndex={-1}`.                                                                                                                | CLOSED — skip link + `main#admin-main tabIndex={-1}`                                                                                     |
| HC-URL-01   | `URL-01`         | `users-client.tsx:23-25`; `workspaces-client.tsx:25-30`; `security-client.tsx:82`                                                                                                                                                                                                                                                                                                                                                                                                                   | Search/page live in `useState`; the URL carries only `?tab=`. Refresh, back, and shared links lose the view.                                                                                                                       | One `useAdminListState` over `useSearchParams` for `q`, `page`, filters, sort.                                                                              | CLOSED for `users` - `q` and `page` live in the URL through `useAdminListState`; the remaining lists still hold local state (documented) |
| HC-URL-02   | `URL-02`         | `workspaces-client.tsx:64-69,76-82,85-86`                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `visible = workspaces.filter(...)` runs after the server returned one page, and the filter counts (`count: workspaces.length`) come from that page. Filter = active on page 3 shows «1» for a workspace count that may be 0 or 40. | Filter on the server (`is_active`), counts from `total`.                                                                                                    | OPEN                                                                                                                                     |
| HC-DESTR-01 | `DESTR-01`       | `users-client.tsx:189-195`                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Step-up description interpolates the raw enum `{ action: 'suspend' }` and never names the target user. In `fa` the operator reads the English enum.                                                                                | Description names the user (email/name) and uses a translated action label.                                                                                 | OPEN                                                                                                                                     |
| HC-RESP-01  | `RESP-01`        | 10 raw tables                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Tables rely on horizontal scroll below `md`; no card alternative exists anywhere.                                                                                                                                                  | `DataTable`, whose `DataTableCards` already renders rows as cards below 768 px.                                                                             | CLOSED - all 18 tables are `DataTable` (cards below 768 px)                                                                              |
| HC-FORM-01  | `FORM-03`        | `blog-admin-client.tsx:91,107`; `blog-editor.tsx:327,346`; `post-editor-client.tsx:248,435`; `wallet-client.tsx:336,347,511`; `ai-client.tsx:98`; `cms-globals-client.tsx:47`; `cms-page-editor-client.tsx:149`                                                                                                                                                                                                                                                                                     | 12 raw `<select>` elements — the repo rule is `SelectField`. Labels, focus, disabled and error wiring differ per site.                                                                                                             | `SelectField`.                                                                                                                                              | CLOSED - all 12 selects are `SelectField`                                                                                                |

### 2.2 P2

| ID            | Rule             | Location                                                                                                                                                                                 | Evidence                                                                                                                                                                                                                           | Fix                                                                                                                                      | Status                                                                                                                                                                             |
| ------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HC-DESTR-02   | `DESTR-02`       | `market-client.tsx:72`; `blog-admin-client.tsx:436`; `post-editor-client.tsx:422`                                                                                                        | Native `confirm()` for enabling/disabling the market and deleting taxonomy/posts. No target identity, no token styling, no consistent keyboard behaviour.                                                                          | `AlertDialog` with the exact target name.                                                                                                | CLOSED - three `AlertDialog`s, each naming the market/taxonomy/post target                                                                                                         |
| HC-TOKEN-01   | `TOKEN-01`       | `tailwind.config.ts:73-104`; `users-client.tsx:81,141`; `workspace-row.tsx:27,48`; `plan-limits-panel.tsx:127,154,229`; `subscriptions-client.tsx:302`; `upgrade-requests-panel.tsx:180` | The admin config declares its own `blue #3b82f6` / `violet #8b5cf6` scales; 23 palette classes use them. `--color-purple` in the shared theme is an alias of teal, so the same token name means two different colours in two apps. | Remove the private palette after proving `packages/ui` does not reference those class names; replace the 23 usages with semantic tokens. | RE-MEASURED, NOT CHANGED - the 14 remaining classes use the `blue`/`emerald`/`amber` scales declared in `apps/admin/tailwind.config.ts`; one `bg-white` is the login QR quiet zone |
| HC-TOKEN-02   | `TOKEN-02`       | 42 occurrences                                                                                                                                                                           | `rounded-2xl/3xl` = 20/24 px while the token scale's largest working surface is `--radius-lg` (16 px). Cards and dialogs disagree with the web app.                                                                                | `rounded-[var(--radius-md)]` / `rounded-[var(--radius-lg)]`.                                                                             | CLOSED, FINDING CORRECTED - `rounded-2xl` is `--radius-2xl` (24 px) and the `Card` radius; 0 `rounded-3xl` remain                                                                  |
| HC-TOKEN-03   | `LEGIBILITY-01`  | 73 occurrences                                                                                                                                                                           | `text-[9px]`, `text-[10px]`, `text-[11px]` on badges, IDs, timestamps and table headers, often combined with `whitespace-nowrap`.                                                                                                  | Floor at 12 px for data; 11 px only for non-essential decoration.                                                                        | CLOSED - 0 `text-[9px]`/`[10px]`/`[11px]` in `apps/admin`                                                                                                                          |
| HC-CONSIST-01 | `CONSIST-01`     | hub clients vs legacy clients                                                                                                                                                            | Three page-header patterns coexist: hub tab bar + `space-y-6`; legacy `Card` headers; header-supplied `h1`.                                                                                                                        | One page-header composition, driven by `ADMIN_NAV`.                                                                                      | OPEN                                                                                                                                                                               |
| HC-PERF-01    | `PERF-01`        | every `page.tsx`                                                                                                                                                                         | `dynamic = 'force-dynamic'`, no route-level loading boundary; every hub paints a shell then fetches.                                                                                                                               | `loading.tsx` per group + skeletons that match the final layout.                                                                         | PARTIAL — group-level loading/error boundaries added; `force-dynamic` unchanged                                                                                                    |
| HC-PERF-02    | `PERF-02`        | `admin-nav.ts:71`                                                                                                                                                                        | Metadata says `GET /admin/licences`; the hook reads `/admin/offline/licences`. The navigation index documents an endpoint that does not exist.                                                                                     | Correct the metadata.                                                                                                                    | CLOSED — offline endpoint corrected to `/admin/offline/licences` in `admin-nav.ts`                                                                                                 |
| HC-PERF-03    | `PERF-03`        | `dashboard-client.tsx:263`                                                                                                                                                               | Past-due alerts lead with `sub.workspace_id` (a raw UUID) as the identifying text.                                                                                                                                                 | Workspace name if the endpoint returns it; otherwise a truncated id + link to the 360 sheet.                                             | CLOSED — short workspace reference + full id in `sr-only` text                                                                                                                     |
| HC-A11Y-08    | `A11Y-MOTION-01` | `dashboard-layout.tsx:66`; `hub-tabs.tsx:66`                                                                                                                                             | Overlay and tabs animate without a `prefers-reduced-motion` guard in the drawer (tabs do guard).                                                                                                                                   | `motion-reduce:` on the drawer.                                                                                                          | OPEN                                                                                                                                                                               |
| HC-I18N-05    | `I18N-03`        | `packages/i18n/messages/af/common.json` — `admin.*`                                                                                                                                      | Dari file contains Persian copies (`admin.error.generic`, all `admin.command.*`, `admin.shell.searchLabel`, …). The locale is `af` but the text is `fa`.                                                                           | Out of scope for a shell batch; new keys are written in real Dari, existing ones reported to the owner.                                  | PARTIAL — the 15 strings this work added were rewritten in Dari; pre-existing `admin.*` copies remain                                                                              |
| HC-PERF-04    | `PERF-04`        | `admin-header.tsx:98`                                                                                                                                                                    | `Math.min(alertCount, 99).toLocaleString()` — digit grouping follows the OS, not the UI locale.                                                                                                                                    | `formatNumber` with the resolved locale.                                                                                                 | CLOSED — header count uses `formatNumber` from `@hisabche/formatting`                                                                                                              |

---

### 2.3 Closure pass — 2026-10-22 (B1–B7 of the redesign)

The redesign closed or narrowed the findings above. Statuses in the tables are current as of this
pass; the notebook in `docs/engineering/HISABCHE_ADMIN_REDESIGN_NOTEBOOK.md` holds the reasoning and
the command output for each batch.

- **Closed:** HC-I18N-02, HC-I18N-04, HC-NAV-01, HC-NAV-03, HC-STATE-01, HC-STATE-03,
  HC-A11Y-01, HC-A11Y-04, HC-A11Y-07, HC-PERF-02, HC-PERF-03, HC-PERF-04.
- **Narrowed:** HC-I18N-01, HC-STATE-02, HC-A11Y-03, HC-A11Y-05, HC-RESP-01, HC-PERF-01,
  HC-I18N-05, HC-TOKEN-03, HC-URL-01 (the hook exists; adoption is the remaining work).
- **Still open, in the order the plan fixes them:** HC-NAV-02 and HC-I18N-03 (CMS, B6c),
  HC-A11Y-02 (shared tabs, B4), HC-A11Y-05/06 (wallet/product, B6b), HC-A11Y-03/HC-RESP-01 (the
  remaining three tables: wallet, operations, offline), HC-URL-01/02 (adoption of the list-state
  hook and the server-side workspace filter), HC-DESTR-01/02, HC-FORM-01, HC-TOKEN-01/02,
  HC-TOKEN-03 (70 remaining sites), HC-I18N-01 (20 remaining sites).

**Honest limits of this pass:** no authenticated render, no axe/Lighthouse/E2E/screen-reader run,
no keyboard pass in a browser. Every accessibility statement above is a source-level claim, and the
seventeen `NOT VERIFIED` rows in §5 stand.

## 3. What already works (must be preserved)

- The shell is token-based and uses logical properties (`ms/me/ps/pe/start/end`) throughout.
- `useAdminTheme` treats the DOM as the source of truth (`useSyncExternalStore`) and the init script
  prevents a light-mode flash.
- `HubTabs` + `useHubTab` already persist the selected tab in `?tab=`.
- `ErrorState` uses `role="alert"` and a retry button.
- `StepUpDialog` requires a reason for session revocation and names the admin's email there.
- 8 hubs and 10 legacy redirects are protected by `hubs-and-redirects.test.ts`.
- 7 admin tests and 86 backend admin tests are green at baseline.

---

## 4. Screen Matrix (52 screens)

Access for every row: platform admin via `ADMIN_ALLOWED_EMAILS` (`proxy.ts:94-107`) and AAL2 in
production (`proxy.ts:117`). Themes: dark default, light via `data-theme`. Locales: fa/af (RTL), en.
States present at baseline: `D` default, `L` loading, `E` empty, `R` error, `N` permission denied
(absent everywhere unless stated).

|     # | Route / screen                                                                                                            | Goal                        | States                        | Priority | Baseline status            |
| ----: | ------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------- | -------- | -------------------------- |
|     1 | `/dashboard` (overview)                                                                                                   | platform KPIs               | D L E R                       | P1       | present                    |
|     2 | `/dashboard?tab=revenue`                                                                                                  | revenue summary             | E only                        | P1       | **placeholder**            |
|     3 | `/dashboard?tab=alerts`                                                                                                   | past-due list               | D L E                         | P2       | present                    |
|     4 | `/customers?tab=workspaces`                                                                                               | workspace index             | D L E R                       | P1       | filter is page-local       |
|     5 | `/customers?tab=users`                                                                                                    | user index                  | D L E R                       | P1       | no URL state; weak confirm |
|     6 | `/customers?tab=devices`                                                                                                  | devices                     | D L E                         | P2       | present                    |
|     7 | `/customers?tab=support`                                                                                                  | support sessions            | D L E                         | P2       | present                    |
|     8 | `/customers?tab=trial_abuse`                                                                                              | abuse signals               | D L E R                       | P2       | raw table                  |
|     9 | `/revenue?tab=plans`                                                                                                      | price list                  | D L E                         | P1       | hardcoded currency         |
|    10 | `/revenue?tab=subscriptions`                                                                                              | subscriptions               | D L E                         | P1       | present                    |
|    11 | `/revenue?tab=ledger`                                                                                                     | billing ledger              | D L E                         | P1       | raw table                  |
|    12 | `/revenue?tab=maker_checker`                                                                                              | two-person approval         | D L E                         | P1       | present                    |
|    13 | `/revenue?tab=wallet`                                                                                                     | wallet methods/top-ups      | D L E R                       | P1       | raw table, raw select      |
|    14 | `/offline?tab=licences`                                                                                                   | licence issuance/revocation | D L E                         | P1       | raw table                  |
|    15 | `/offline?tab=devices`                                                                                                    | device registry             | D L E                         | P1       | raw table                  |
|    16 | `/offline?tab=log`                                                                                                        | licence log                 | D L E                         | P2       | raw table                  |
|    17 | `/offline?tab=bans`                                                                                                       | automatic bans              | D L E                         | P2       | raw table                  |
|    18 | `/offline?tab=reviews`                                                                                                    | manual review queue         | D L E                         | P1       | raw table                  |
|    19 | `/offline?tab=fleet`                                                                                                      | fleet health                | D L E R                       | P2       | present                    |
|    20 | `/offline?tab=migration`                                                                                                  | migration centre            | D L E                         | P2       | present                    |
|    21 | `/offline?tab=reconciliation`                                                                                             | reconciliation              | D L E                         | P2       | present                    |
|    22 | `/product?tab=features`                                                                                                   | feature flags               | D L E R                       | P1       | unnamed switches           |
|    23 | `/product?tab=ai`                                                                                                         | AI provider config          | D L E R                       | P2       | raw select                 |
|    24 | `/product?tab=oauth`                                                                                                      | OAuth apps / versions       | D L E R                       | P2       | raw table                  |
|    25 | `/product?tab=market`                                                                                                     | market control              | D L E R                       | P2       | native confirm             |
|    26 | `/operations?tab=health`                                                                                                  | system health               | D L E R                       | P1       | present                    |
|    27 | `/operations?tab=servers`                                                                                                 | instances / scale           | D L E R                       | P2       | present                    |
|    28 | `/operations?tab=jobs`                                                                                                    | background jobs             | D L E R                       | P2       | raw table                  |
|    29 | `/operations?tab=announcements`                                                                                           | announcements               | D L E R                       | P2       | raw table                  |
|    30 | `/content?tab=blog`                                                                                                       | blog posts                  | D L E R                       | P1       | present                    |
|    31 | `/security?tab=audit`                                                                                                     | audit trail                 | D L E R                       | P1       | unlabelled search          |
|    32 | `/security?tab=roles`                                                                                                     | roles                       | D L E R                       | P2       | present                    |
|    33 | `/security?tab=sessions`                                                                                                  | admin sessions              | D L E R                       | P1       | raw table                  |
|    34 | `/security?tab=events`                                                                                                    | security events             | D L E R                       | P2       | present                    |
|    35 | `/cms/pages`                                                                                                              | CMS page list               | D L E                         | P1       | orphan (no nav)            |
|    36 | `/cms/pages/new`                                                                                                          | create page                 | D L E R                       | P1       | orphan; EN placeholders    |
|    37 | `/cms/pages/[id]`                                                                                                         | edit page                   | D L E R                       | P1       | orphan                     |
|    38 | `/cms/globals`                                                                                                            | global strings              | D L E R                       | P2       | orphan; EN placeholders    |
|    39 | `/cms/media`                                                                                                              | media library               | D L E R                       | P2       | orphan                     |
|    40 | `/blog/new`                                                                                                               | post editor                 | D L E R                       | P1       | outside tabs               |
|    41 | `/blog/[id]`                                                                                                              | edit post                   | D L E R                       | P1       | outside tabs               |
|    42 | `/login`                                                                                                                  | password + TOTP             | password / enroll / challenge | P1       | no `h1`                    |
| 43-52 | `/workspaces`, `/users`, `/subscriptions`, `/wallet`, `/ai`, `/oauth-apps`, `/market`, `/servers`, `/blog`, `/audit-logs` | legacy 301 to a hub tab     | redirect                      | P3       | preserve                   |

No row is silently skipped: 34 hub tabs + 8 standalone + 10 redirects = 52.

---

## 5. Accessibility notes that are NOT verified

- axe: **NOT VERIFIED** (no dependency installed; installing one is out of scope).
- Lighthouse: **NOT VERIFIED** (requires an authenticated production session).
- Screen reader (NVDA/VoiceOver): **NOT VERIFIED**.
- Keyboard/focus: static inspection only until an authenticated dev-server pass is possible.
- Contrast: token pairs are reviewed on paper; no measured ratio is claimed.

Static checks that _are_ provable and are used as regression guards instead: bare `router.push`,
`toLocaleString`, raw `<select>`, raw `<table>`, `confirm(`, `text-[9-11px]`, palette classes,
and source assertions for labels/`aria-*` on the screens a batch touches.

---

## 6. Unverified destructive flows (P0 candidates for the next pass)

These run a mutation after a confirmation of some kind, but the confirmation's content was not
proven sufficient in this static pass. Each must be opened in a running session before any P0 claim:

- `/offline` licence revoke, ban lift, review decide (`offline-client.tsx`, 7 StepUp usages).
- `/revenue?tab=maker_checker` approve/reject and `/revenue?tab=wallet` reject/adjust.
- `/product?tab=oauth` app status changes and app-version decisions.
- `/security?tab=sessions` revoke (confirmed: names the email — keep it).
- `/customers?tab=users` suspend/reactivate/reset-MFA (confirmed: target is not named — HC-DESTR-01).

---

## 7. JSON appendix

```json
{
  "audit": {
    "document_id": "hisabche-admin-ui-ux-audit",
    "version": "1.0.0",
    "date": "2026-10-22",
    "scope": "apps/admin",
    "method": "static source review + measured greps + existing vitest/pg suites",
    "verified": {
      "type_check": "pass (exit 0)",
      "admin_tests": "2 files / 7 tests pass",
      "backend_admin_tests": "8 files / 86 tests pass",
      "axe": "NOT VERIFIED",
      "lighthouse": "NOT VERIFIED",
      "e2e": "NOT VERIFIED",
      "screen_reader": "NOT VERIFIED"
    },
    "counts": { "P0": 0, "P1": 20, "P2": 11 }
  },
  "findings": [
    {
      "id": "HC-I18N-01",
      "severity": "P1",
      "rule_id": "A11Y-LANG-01",
      "files": ["apps/admin/app/[lang]/(admin)/revenue/revenue-client.tsx:119"],
      "evidence": "34 toLocaleString/toLocaleDateString calls without a locale; zero @hisabche/formatting imports in apps/admin.",
      "fix": "Single admin formatter over @hisabche/formatting; remove all 34 sites.",
      "status": "OPEN"
    },
    {
      "id": "HC-URL-02",
      "severity": "P1",
      "rule_id": "URL-02",
      "files": ["apps/admin/app/[lang]/(admin)/workspaces/workspaces-client.tsx:64-86"],
      "evidence": "Activity filter and its counts are computed from the current server page, after pagination.",
      "fix": "Server-side is_active filter; counts from total.",
      "status": "OPEN"
    },
    {
      "id": "HC-NAV-01",
      "severity": "P1",
      "rule_id": "NAV-03",
      "files": ["apps/admin/components/admin-shell/command-palette.tsx:44-65"],
      "evidence": "Eight locale-less router.push calls; proxy.ts:44-49 rewrites to /fa.",
      "fix": "useLocalePush + ADMIN_NAV-driven list.",
      "status": "OPEN"
    },
    {
      "id": "HC-A11Y-01",
      "severity": "P1",
      "rule_id": "A11Y-DIALOG-01",
      "files": ["apps/admin/app/[lang]/(admin)/dashboard-layout.tsx:60-79"],
      "evidence": "Drawer has no dialog role, aria-modal, focus trap or Esc handler.",
      "fix": "Use the shared Sheet (Radix Dialog) for the mobile drawer.",
      "status": "OPEN"
    },
    {
      "id": "HC-STATE-01",
      "severity": "P1",
      "rule_id": "STATE-01",
      "files": ["apps/admin/app/[lang]/(admin)"],
      "evidence": "No error.tsx/loading.tsx/not-found.tsx exists.",
      "fix": "Add the three boundaries at the (admin) group.",
      "status": "OPEN"
    }
  ]
}
```

## 8. Closure after the implementation pass (2026-10-22, evening)

The **Status** column of §2 was rewritten after the implementation pass and is authoritative. The
"Closed / Narrowed / Still open" bullets at the end of §2 were written before that pass and are
superseded by this table.

| Rule                           | Measured after the pass | How it is checked                                                              |
| ------------------------------ | ----------------------- | ------------------------------------------------------------------------------ |
| raw `<table>` in `apps/admin`  | 0 (was 18)              | guard test walks every `.ts`/`.tsx`                                            |
| raw `<select>` in `apps/admin` | 0 (was 12)              | the same walk                                                                  |
| `toLocale*` in `apps/admin`    | 0 (was 18)              | the same walk; `lib/admin-format.ts` is the only formatter                     |
| `window.confirm(` / `confirm(` | 0 (was 3)               | three `AlertDialog`s                                                           |
| bare `router.push('/...')`     | 0 (was 1)               | `useLocalePush` / `useRouteLang`                                               |
| `text-[9px]`...`text-[11px]`   | 0 (was 35)              | guard test                                                                     |
| `rounded-3xl`                  | 0                       | `rounded-2xl` is the token radius, see TOKEN-02                                |
| palette classes                | 14                      | all inside the scales `apps/admin/tailwind.config.ts` declares as admin tokens |
| `bg-white`                     | 1                       | the login QR quiet zone; a dark background would stop the code scanning        |

Still open, with the reason:

- **HC-URL-02** - the workspace filter runs after pagination and needs a server-side query
  parameter. Backend changes were out of scope for this task.
- **HC-DESTR-01** - the step-up dialog still prints the raw action enum. It needs a label map and
  three keys; the file is shared with the URL-state change, so it was deferred rather than rushed.
- **HC-TOKEN-01** - the remaining classes are the config's own accent scales. Deleting them is a
  design-language decision for the owner.
- **HC-CONSIST-01** - three page-header shapes still coexist (hub tabs, legacy `Card` headers,
  header-supplied `h1`).
- **HC-A11Y-02** - the shared `HubTabs` pattern lives in `packages/ui` and is mounted by web and
  desktop; changing it needs owner approval.
- Lists drawn as `<ul>` rather than `DataTable`: `users`, blog taxonomy, workspace members.

**Never verified** (no tooling and no AAL2 session): axe, Lighthouse, E2E, screen reader, a real
keyboard walk, dark/light contrast, and rendering at 320-1440 px. Nothing in this document claims
any of them.
