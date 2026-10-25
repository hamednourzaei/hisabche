# Hisabche Admin Redesign — Engineering Notebook

> Every file created or modified for the admin redesign gets one entry here, in the
> `SELF_CRITICAL_PROTOCOL.md` shape: current state, proposed change, alternatives, pros/cons,
> five pre-passes, the benefit question, five post-passes, evidence, final decision.
> A batch is not finished until its entries are complete and its verification rows are filled.

Status vocabulary: `DECIDED` → `IMPLEMENTED` → `TYPECHECKED` → `LINTED` → `TESTED`.
`NOT VERIFIED` is used wherever a browser/session/tool was unavailable.

---

## 0. Owner decisions this work is bound by (2026-10-22)

1. Work on the existing uncommitted tree. Never stage, commit, reset, stash or `checkout --`.
   If a target file overlaps existing changes, stop and ask.
2. «Back test» = backend/API regression + UI verification with the tooling already installed.
3. No new dependency. axe/Lighthouse/E2E/screen-reader are `NOT VERIFIED`.
4. Dashboard revenue tab: no invented numbers. Honest empty state + link; recorded P2/Deferred.
5. Hub/nav structure is frozen without approval.

---

## B0. Documents

### docs/HISABCHE-ADMIN-UI-UX-AUDIT-2026-10-22.md

- **Current state:** no Hisabche admin audit exists. `docs/UI-UX-AUDIT-2026-10-22.md` describes
  Pestinu and cannot be reused as findings.
- **Proposed:** a findings document with `file:line`, severity, rule id, evidence and fix; a 52-row
  Screen Matrix; a JSON appendix; explicit `NOT VERIFIED` rows for axe/Lighthouse/E2E.
- **Alternatives:** (a) copy the Pestinu audit and swap names — rejected, invents findings;
  (b) keep findings only in chat — rejected, not reviewable or diffable.
- **Pros/cons:** + traceable, reviewable, drives batches; − one more document to maintain.
- **Pre-passes:** (1) are line numbers from real reads? yes, each cited from a read or a counted
  grep; (2) is every P1 reproducible from the evidence column? yes; (3) are unverified areas marked?
  yes, §5 and §6; (4) does it avoid claiming axe/Lighthouse? yes; (5) does it cover all 52 screens?
  yes, §4.
- **Benefit question:** does this document let a reviewer reject a change by pointing at a row?
  Yes — each batch maps to finding ids.
- **Post-passes:** (1) counts match the measured table (20 P1 / 11 P2); (2) no `file:line` invented;
  (3) no Pestinu colour or route leaked; (4) JSON appendix parses; (5) status vocabulary honest.
- **Evidence:** `npx tsc --noEmit` exit 0; 7 admin tests; 86 backend admin tests; measured greps in
  §1.3.
- **Final decision:** `IMPLEMENTED` (content), verification of the document itself is review-only.

### docs/HISABCHE-ADMIN-REDESIGN-PLAN.md

- **Current state:** no plan links the rubric to Hisabche; Pestinu rules would otherwise be applied
  blindly.
- **Proposed:** Adaptation Map (13 rules), token map (no new colours), two design directions with a
  recommendation, nine batches with files/risk/test/rollback/acceptance, verification contract.
- **Alternatives:** (a) apply the Pestinu guidelines verbatim — rejected, wrong brand/stack;
  (b) skip the adaptation map and design ad hoc — rejected, unreviewable.
- **Pros/cons:** + every later edit has a stated reason; − the plan can drift, so each batch must
  update the notebook.
- **Pre-passes:** (1) are tokens read from `globals.css`, not guessed? yes; (2) is the 8-hub
  constraint respected? yes; (3) does each batch have a rollback? yes; (4) is the build limited to
  `@hisabche/admin`? yes, B8; (5) are axe/E2E marked unavailable? yes, §6.
- **Benefit question:** can another engineer execute B1 without asking a question? Yes.
- **Post-passes:** (1) batch boundaries match the audit; (2) no dependency is introduced;
  (3) no API/schema change is hidden; (4) acceptance is testable; (5) owner decisions quoted.
- **Evidence:** measured baseline and file inventory in the audit; `package.json` scripts.
- **Final decision:** `IMPLEMENTED`.

### docs/engineering/HISABCHE_ADMIN_REDESIGN_NOTEBOOK.md

- **Current state:** absent.
- **Proposed:** this file; one entry per changed file, appended per batch.
- **Alternatives:** commit messages — rejected, the owner commits and the process requires a file.
- **Pros/cons:** + auditable reasoning; − must be kept current (enforced per batch).
- **Pre-passes / benefit / post-passes:** the protocol is applied to every entry below.
- **Evidence:** `SELF_CRITICAL_PROTOCOL.md` §structure.
- **Final decision:** `IMPLEMENTED`.

---

## B1. Shell and foundation

### packages/ui/src/index.ts — export `useLocalePush`

- **Current state:** `useLocalePush`/`useLocaleReplace`/`useRouteLang` exist in
  `packages/ui/src/hooks/use-locale-push.ts` but are **not exported** from the package root. Admin
  therefore calls `router.push('/dashboard?tab=…')` without a locale and `proxy.ts` rewrites it to
  `fa` (HC-NAV-01/02).
- **Proposed:** add one export line in the Navigation section.
- **Alternatives:** (a) reimplement the locale prefix in the admin — rejected: AGENTS §2 names
  `useLocalePush` as the one navigation helper; a second implementation is the exact duplication the
  repo forbids; (b) import the deep path — rejected: internal path, not a public surface.
- **Pros/cons:** + one canonical navigation helper everywhere, zero behaviour change for existing
  consumers; − a shared package gains an export (additive only).
- **Pre-passes:** (1) is the hook already used by web/desktop? yes, 20+ files; (2) is the export
  additive? yes; (3) does it import next/navigation only? yes; (4) can it run in admin (client
  component)? yes, `'use client'`; (5) does it handle an already-prefixed route? yes,
  `localizePath` leaves it alone.
- **Benefit question:** does this remove the silent language switch with one line? Yes.
- **Post-passes:** (1) `tsc` for `packages/ui` and `apps/admin`; (2) no name collision in the index;
  (3) admin's `components/ui/index.ts` re-exports it; (4) no consumer changed; (5) grep shows no
  bare `router.push('/` left in the shell.
- **Evidence:** `use-locale-push.ts:30`; `proxy.ts:44-49`; `command-palette.tsx:44-65`.
- **Final decision:** `IMPLEMENTED` — type-checked and linted; runtime keyboard behaviour `NOT VERIFIED` (no AAL2 session).

### apps/admin/components/ui/index.ts — re-export `useLocalePush`

- **Current state:** the admin's single allowed primitive surface re-exports components only.
- **Proposed:** add `useLocalePush` (and `useLocaleReplace`) to the re-export list.
- **Alternatives:** import from `@hisabche/ui` directly in each file — rejected: the admin guard
  expects one surface, and the file's own header says so.
- **Pros/cons:** + keeps imports uniform; − none.
- **Pre-passes:** (1) does the guard forbid local definitions only? yes; (2) is a hook a "primitive"
  the guard counts? no, it bans Button/Table/Card/Dialog/Select/Pagination; (3) is the symbol
  exported from the root after the previous change? yes; (4) type-only or value export? value;
  (5) any naming clash in the barrel? no.
- **Benefit question:** can every admin file now navigate correctly without a second helper? Yes.
- **Post-passes:** (1) `tsc`; (2) eslint; (3) palette and CMS editor use it; (4) no deep import;
  (5) no duplicate helper added in admin.
- **Evidence:** `components/ui/index.ts:1-6` (comment) and the export list.
- **Final decision:** `IMPLEMENTED` — type-checked and linted; runtime keyboard behaviour `NOT VERIFIED` (no AAL2 session).

### admin-nav.ts — one nav model for the shell and the palette

- **Current state:** `ADMIN_NAV` holds id/path/icon/title/description/endpoint. The command palette
  duplicates all eight paths and their target tabs. The offline endpoint is documented as
  `GET /admin/licences` (does not exist; the hook reads `/admin/offline/licences`). `/cms` is absent
  from `ROUTE_HUB_MAP`, so CMS pages have no active hub.
- **Proposed:** add `group` (`overview | customers | platform | governance`) and `defaultTab` to the
  eight items; add `/cms` → `content` to the route map; correct the offline endpoint.
- **Alternatives:** (a) a second `COMMAND_ITEMS` array — rejected: two lists drift; (b) derive group
  from the path — rejected: `/revenue` belongs with customers, which the path cannot express;
  (c) add a 9th nav item for CMS — rejected: frozen nav structure, needs approval.
- **Pros/cons:** + palette and sidebar read one model; + CMS gets an active state; − `AdminNavItem`
  grows two optional fields (no consumer breaks).
- **Pre-passes:** (1) does the guard test depend only on ids/order/labels? yes; (2) are the eight
  ids untouched? yes; (3) is `defaultTab` a real tab in each client? checked against each
  `*_TABS` array; (4) does `activeNavItem` still prefer the exact hub? yes, map lookup precedes
  path scan; (5) is `/cms/pages` covered by a prefix match? yes, `startsWith('/cms/')` via the map
  key.
- **Benefit question:** does this delete the palette's duplicated route table? Yes.
- **Post-passes:** (1) guard test; (2) `tsc`; (3) palette uses `item.path` + `defaultTab`; (4) no
  `GET /admin/licences` left; (5) `/cms` resolves to content.
- **Evidence:** `admin-nav.ts:40-126`; `command-palette.tsx:44-65`; `hooks/use-admin-offline.ts:57`.
- **Final decision:** `IMPLEMENTED` — type-checked and linted; runtime keyboard behaviour `NOT VERIFIED` (no AAL2 session).

### admin-sidebar.tsx — grouped rail with token radii

- **Current state:** eight flat links, active state via `bg-[hsl(var(--color-primary)/0.12)]`, 44 px
  targets, logical properties already correct. Radii are Tailwind `rounded-xl`.
- **Proposed:** group the eight links under four labels, keep order and ids, switch to
  `rounded-[var(--radius-md)]`, keep `aria-current`, keep the theme/sign-out controls.
- **Alternatives:** (a) leave flat — rejected: eight peer items hide the customers/revenue
  relationship; (b) collapsible groups — rejected: hidden items cost a click and need persisted
  state; (c) `Collapsible` primitive — rejected for the same reason.
- **Pros/cons:** + faster scanning, + keyboard order unchanged; − four extra labels, slight visual
  noise in a 240 px rail.
- **Pre-passes:** (1) are the labels translated in three locales? yes, added in this batch;
  (2) does grouping change tab order? no; (3) is the active item still one? yes;
  (4) does the mobile drawer render the same component? yes; (5) do all links keep the locale
  prefix? yes.
- **Benefit question:** can an operator find "which hub owns billing" without reading all eight?
  Yes.
- **Post-passes:** (1) `tsc`/eslint; (2) `aria-current` intact; (3) min 44 px targets; (4) no
  palette class; (5) no physical `left/right`.
- **Evidence:** `admin-sidebar.tsx:63-95`; design token scale in `globals.css`.
- **Note:** the brand letter used `--color-primary-foreground`, a token that does not exist (the scale
  defines `--color-primary-fg`), so the «ح» was painted in the inherited colour. Fixed in the same
  edit.
- **Final decision:** `IMPLEMENTED` — type-checked and linted; runtime keyboard behaviour `NOT VERIFIED` (no AAL2 session).

### admin-header.tsx — locale-aware count, palette trigger, disclosure state

- **Current state:** hub `h1` + description, workspace search form, bell with
  `Math.min(count,99).toLocaleString()` (OS digits), no visible way to open the palette, menu button
  without `aria-expanded`.
- **Proposed:** format the badge with `formatNumber` + `resolveIntlLocale`; add a palette button
  (`aria-keyshortcuts`, `aria-haspopup="dialog"`) wired to the layout's palette state; add
  `aria-expanded`/`aria-haspopup` to the menu button; keep the search form and `h1`.
- **Alternatives:** (a) keep the count unformatted — rejected: HC-PERF-04; (b) let the palette own
  a global event — rejected: hidden coupling; (c) put the palette trigger only in the sidebar —
  rejected: it must be reachable on mobile where the rail is closed.
- **Pros/cons:** + discoverability and correct digits; − header gains one control (still fits at
  360 px: menu, title, bell, palette).
- **Pre-passes:** (1) does the header receive the locale? yes, from `pathname`; (2) is
  `formatNumber`'s locale argument an Intl locale string? yes; (3) does the palette state live above
  both? yes, in the layout; (4) does the button have an accessible name? yes, new i18n key;
  (5) does `h1` stay the only h1? yes.
- **Benefit question:** can a keyboard-only operator open the palette without knowing the shortcut?
  Yes.
- **Post-passes:** (1) `tsc`; (2) no `toLocaleString`; (3) `aria-expanded` toggles; (4) 44 px
  target; (5) fa/af/en keys exist.
- **Evidence:** `admin-header.tsx:82-102`; `globals.css` number tokens; audit HC-PERF-04.
- **Final decision:** `IMPLEMENTED` — type-checked and linted; runtime keyboard behaviour `NOT VERIFIED` (no AAL2 session).

### command-palette.tsx — locale-safe, nav-driven, icon-consistent

- **Current state:** eight hardcoded `router.push('/…')` calls (locale-less), emoji icons, no
  relationship to `ADMIN_NAV`.
- **Proposed:** controlled `open`/`onOpenChange` props; items generated from `ADMIN_NAV`; navigation
  through `useLocalePush`; Lucide icons from the same model; keep ⌘K/Ctrl+K.
- **Alternatives:** (a) keep hardcoded list and only prefix the locale — rejected: fixes the bug but
  keeps the duplication; (b) server-driven commands — rejected: no such endpoint, would invent one.
- **Pros/cons:** + one source of truth, + correct locale, + icons match the rail; − the palette can
  no longer offer targets that are not nav hubs (none exist today).
- **Pre-passes:** (1) does `useLocalePush` preserve a query string? `localizePath` prefixes the
  path; the query is part of the route string and must be checked; (2) is `defaultTab` present for
  all eight? yes; (3) does the controlled prop keep ⌘K working? yes, listener stays; (4) does
  `CommandDialog` require a title for a11y? checked, it renders one; (5) are emoji removed? yes.
- **Benefit question:** does this make the palette correct in `en` and maintainable? Yes.
- **Post-passes:** (1) no bare `router.push('/`; (2) palette navigates to `/<locale>/...` in all
  three locales; (3) `tsc`; (4) guard tests; (5) keyboard handler removed on unmount.
- **Evidence:** `command-palette.tsx:44-65`; `proxy.ts:44-49`; `localizePath` behaviour.
- **Final decision:** `IMPLEMENTED` — type-checked and linted; runtime keyboard behaviour `NOT VERIFIED` (no AAL2 session).

### dashboard-layout.tsx — skip link, real dialog drawer, palette state

- **Current state:** desktop rail + a mobile `<div>` overlay with no dialog semantics; `<main>`
  without an id; palette mounted without shared state; sign-out is correct.
- **Proposed:** skip link to `#admin-main`; `<main id="admin-main" tabIndex={-1}>`; mobile drawer
  rendered through the shared `Sheet` (Radix Dialog: focus trap, Esc, scroll lock, `aria-modal`) with
  `showCloseButton={false}` and the sidebar's own close button; palette open state lifted here;
  `motion-reduce` respected by the primitive.
- **Alternatives:** (a) hand-rolled focus trap — rejected: a new local implementation of a solved
  problem, and the guard disallows local dialog primitives; (b) `<dialog>` element — rejected: no
  RTL slide, no token integration, more code; (c) keep the div and add `role="dialog"` only —
  rejected: role without trap/Esc is worse than honest absence.
- **Pros/cons:** + correct keyboard/AT behaviour with no new dependency; − the shared Sheet's own
  close button is bypassed (its label is hardcoded Persian), so we render our own; − the drawer is
  now portalled.
- **Pre-passes:** (1) does `SheetContent` support `side="start"` and hiding its close button? yes
  (`sheet.tsx:45-48,77`); (2) does Radix restore focus to the trigger? yes by default;
  (3) does the sidebar still close on link click? yes, `onClose`; (4) does the desktop rail stay
  non-modal? yes, rendered outside the Sheet; (5) does the skip link respect RTL? yes, logical
  classes.
- **Benefit question:** can a keyboard user open the menu, move within it, close with Esc and land
  back on the trigger? Yes, by construction of Radix Dialog.
- **Post-passes:** (1) `tsc`; (2) `aria-expanded`/`aria-haspopup` on the trigger; (3) `main` focus
  target exists; (4) no `bg-black/60` raw colour left (Sheet overlay uses a token); (5) palette
  state does not remount on navigation.
- **Evidence:** `dashboard-layout.tsx:60-88`; `sheet.tsx:74-123`; audit HC-A11Y-01/07.
- **Final decision:** `IMPLEMENTED` — type-checked and linted; runtime keyboard behaviour `NOT VERIFIED` (no AAL2 session).

### app/[lang]/(admin)/error.tsx

- **Current state:** absent (HC-STATE-01). A render error replaces the console with the framework
  surface.
- **Proposed:** `'use client'` boundary rendering the existing `ErrorState` inside the shell, with
  `reset` as the retry.
- **Alternatives:** (a) reuse `@hisabche/ui/error-boundary` — considered; it is class-based and
  takes a fallback, but the admin needs the translated shell surface; (b) a plain `<div>` —
  rejected: duplicate error UI.
- **Pros/cons:** + one recovery path; − Next requires a client boundary file (small).
- **Pre-passes:** (1) is the boundary inside the admin layout (shell persists)? yes; (2) does
  `ErrorState` accept `onRetry`? yes; (3) does `useTranslations` work here? yes, provider is above;
  (4) are error messages leaked? no, generic only; (5) is `reset` stable? provided by Next.
- **Benefit question:** does a thrown render error still leave a usable console? Yes.
- **Post-passes:** (1) `tsc`; (2) `role="alert"` present via `ErrorState`; (3) three locale keys;
  (4) no `console.log`; (5) retry resets.
- **Evidence:** `admin-ui.tsx:11-25`; absent files.
- **Final decision:** `IMPLEMENTED` — type-checked and linted; runtime keyboard behaviour `NOT VERIFIED` (no AAL2 session).

### app/[lang]/(admin)/loading.tsx

- **Current state:** absent; each hub paints its own skeletons after hydration (HC-PERF-01).
- **Proposed:** a group-level skeleton that matches the hub layout (title line, tab bar, card rows).
- **Alternatives:** per-page `loading.tsx` — deferred: 26 files for the same outcome; the group
  boundary covers all.
- **Pros/cons:** + instant feedback on navigation; − a generic skeleton can differ from a specific
  page (accepted; better than a blank shell).
- **Pre-passes:** (1) does a group-level file apply to child routes? yes; (2) are skeletons
  `aria-hidden`? they must be, and a status text carries the announcement; (3) any layout shift?
  sizing mirrors the real blocks; (4) locale keys exist; (5) no client hook needed.
- **Benefit question:** does navigation stop showing an empty content area? Yes.
- **Post-passes:** (1) `tsc`; (2) `role="status"` + `aria-live="polite"` label; (3) tokens only;
  (4) three keys; (5) no `window`.
- **Evidence:** audit HC-PERF-01.
- **Final decision:** `IMPLEMENTED` — type-checked and linted; runtime keyboard behaviour `NOT VERIFIED` (no AAL2 session).

### app/[lang]/(admin)/not-found.tsx

- **Current state:** absent; unknown admin URLs render the framework 404 outside the console.
- **Proposed:** a client boundary with translated message and a locale-aware link back to the
  dashboard.
- **Alternatives:** a server component with `params` — rejected: `not-found.tsx` does not receive
  route params; a client component reads the locale from the pathname.
- **Pros/cons:** + keeps the operator inside the console; − one more client file.
- **Pre-passes:** (1) is `usePathname` available? yes; (2) does `localeOf` handle the prefix? yes;
  (3) is the link locale-correct? yes; (4) `h1`? the page renders below the header's h1, so it uses
  `h2`; (5) three keys? yes.
- **Benefit question:** does a mistyped admin URL recover without losing the language? Yes.
- **Post-passes:** (1) `tsc`; (2) no bare push; (3) no palette class; (4) 44 px link; (5) keys in
  three locales.
- **Evidence:** absent files; `proxy.ts` passes unknown paths through.
- **Final decision:** `IMPLEMENTED` — type-checked and linted; runtime keyboard behaviour `NOT VERIFIED` (no AAL2 session).

### packages/i18n/messages/{fa,af,en}/common.json

- **Current state:** 811 `admin.*` keys per locale, no gaps in the namespace; Dari file contains
  Persian copies in some admin keys (reported, not fixed here).
- **Proposed:** add 14 keys used by B1 (`admin.shell.skipToContent`, `admin.shell.menuDialog`,
  four `admin.navGroup.*`, `admin.command.label`, `admin.command.open`, three `admin.notFound.*`,
  `admin.loading.label`, two `admin.error.*`), real Dari wording, no placeholders left empty.
- **Alternatives:** (a) reuse existing keys — rejected: `admin.empty.*` cannot label a skip link;
  (b) English fallback at call sites — rejected: `t()` throws on missing keys and the guard forbids
  untranslated UI.
- **Pros/cons:** + no runtime throws, + three locales stay in sync; − translation effort (small,
  bounded).
- **Pre-passes:** (1) does any new key already exist? checked all five groups; (2) is JSON valid
  after insertion? verified by parsing; (3) does the guard test read `admin.nav`? our keys are under
  `admin.navGroup`, no clash; (4) are placeholders correct? only `{count}` exists already;
  (5) Dari wording was **not** correct: 15 strings used Pashto-only letters and were caught by
  `dari-is-not-pashto` in B7. Corrected there; see the B7 entry.
- **Benefit question:** can B1 ship without a single missing-key crash? Yes.
- **Post-passes:** (1) parse all three files; (2) key parity across locales; (3) no duplicate keys;
  (4) no Persian text in `en`; (5) `tsc` unaffected.
- **Evidence:** measured 811 keys/locale; `t()` throws on missing keys (AGENTS §5).
- **Final decision:** `IMPLEMENTED` — type-checked and linted; runtime keyboard behaviour `NOT VERIFIED` (no AAL2 session).

## B8. Build

### `pnpm --filter @hisabche/admin` build

- **Current state:** the console had never been built as part of this work; type-checking does not
  prove that the App Router tree, the client/server boundaries and the new route files compile.
- **Proposed:** one production build of the admin package only, as the owner allowed.
- **Alternatives:** build the whole monorepo — forbidden by the owner (B8 is admin only).
- **Pros/cons:** + proves the route boundaries and the barrel exports in a real Next build; − it
  regenerates `.next` and `next-env.d.ts` (both already ignored/modified artefacts).
- **Pre-passes:** (1) is `tsc` green first? yes; (2) are the three new boundary files in the route
  group? yes; (3) does any new file import a server-only module into a client component? no
  (`admin-format` and the hooks are client-safe); (4) does the build need a secret? no — no env var was
  read or written; (5) is only `@hisabche/admin` filtered? yes.
- **Benefit question:** does a reviewer know the console still builds after eight batches of shell and
  screen changes? Yes, from the command output.
- **Post-passes:** (1) exit code captured explicitly (`EXIT=0`), not inferred; (2) the log was searched
  for "Failed to compile"; (3) all 27 routes are present, including the three new boundary files;
  (4) nothing was deployed; (5) no build warning was suppressed.
- **Evidence:** `✓ Compiled successfully in 14.8s`; route table lists `/[lang]/security`,
  `/[lang]/revenue`, `/[lang]/dashboard` and `/_not-found`.
- **Final decision:** `BUILT` — the redesign itself is **not** complete (B3/B4/B6b–d are partial or
  not started); this row records the build only.

---

## Verification ledger

| Batch    | Command                                                                                    | Result                                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline | `npx tsc --noEmit` (apps/admin)                                                            | exit 0                                                                                                                                                      |
| Baseline | admin vitest                                                                               | 2 files / 7 tests pass                                                                                                                                      |
| Baseline | backend admin tests                                                                        | 8 files / 86 tests pass                                                                                                                                     |
| B1       | `npx tsc --noEmit` (apps/admin)                                                            | exit 0                                                                                                                                                      |
| B1       | `npx tsc --noEmit` (packages/ui)                                                           | exit 0                                                                                                                                                      |
| B1       | `npx eslint` on the 9 changed TS/TSX files                                                 | 0 errors                                                                                                                                                    |
| B1       | admin vitest (`node ../../packages/ui/node_modules/vitest/vitest.mjs run`)                 | 2 files / 7 tests pass                                                                                                                                      |
| B1       | static greps (shell + `(admin)` group)                                                     | 0 `toLocaleString`, 0 `primary-foreground`; 1 bare `router.push('/` remains in `cms-page-editor-client.tsx` (B6d)                                           |
| B1       | keyboard/focus, theme, locale matrix in a browser                                          | `NOT VERIFIED` — no AAL2 session                                                                                                                            |
| B2       | `npx tsc --noEmit` (apps/admin)                                                            | exit 0                                                                                                                                                      |
| B2       | `npx eslint` (admin-format, use-admin-list-state, use-admin-locale, admin-ui, ui/index.ts) | 0 errors                                                                                                                                                    |
| B3       | `npx tsc --noEmit` (apps/admin)                                                            | exit 0                                                                                                                                                      |
| B3       | `npx eslint` (security-client, ui/index.ts)                                                | 0 errors                                                                                                                                                    |
| B3       | admin vitest                                                                               | 3 files / 16 tests pass (7 baseline + 9 new guards)                                                                                                         |
| B3       | backend admin regression (8 files)                                                         | 8 files / 86 tests pass — identical to baseline                                                                                                             |
| B5       | `npx tsc --noEmit` (apps/admin)                                                            | exit 0                                                                                                                                                      |
| B5       | `npx eslint` (dashboard-client)                                                            | 0 errors                                                                                                                                                    |
| B6a      | `npx tsc --noEmit` (apps/admin)                                                            | exit 0                                                                                                                                                      |
| B6a      | `npx eslint` (revenue-client)                                                              | 0 errors                                                                                                                                                    |
| B7       | `packages/ui` vitest, first run                                                            | 1 file / 1 test failed — `dari-is-not-pashto` (15 strings I added)                                                                                          |
| B7       | `packages/ui` vitest, after the Dari fix (default 5 s timeout)                             | 172 files passed, 1 skipped; 2346 tests passed, 2 skipped — `one-ux.test.ts` hit its 5 s timeout                                                            |
| B7       | `one-ux.test.ts` alone                                                                     | 1 file / 18 tests pass in 2.8 s — the timeout is a load artifact of the full parallel run                                                                   |
| B7       | `packages/ui` vitest with `--testTimeout=15000`                                            | 172 files passed, 1 skipped; 2346 passed, 2 skipped — **0 failed**                                                                                          |
| B8       | `pnpm --filter @hisabche/admin build`                                                      | `EXIT=0`; "✓ Compiled successfully in 14.8s"; 27 routes emitted                                                                                             |
| B1–B7    | axe / Lighthouse / E2E / screen-reader / keyboard pass                                     | `NOT VERIFIED` — no AAL2 session, no browser tooling installed                                                                                              |
| B3b      | `npx tsc --noEmit` (apps/admin), after every table conversion                              | exit 0 each time                                                                                                                                            |
| B3b      | guard "no screen draws a raw table or a native select"                                     | 0 offenders (was 10 tables)                                                                                                                                 |
| B4       | `npx tsc --noEmit` (apps/admin)                                                            | exit 0                                                                                                                                                      |
| B4       | guard "no screen asks a question through window.confirm"                                   | 0 offenders (was 3)                                                                                                                                         |
| B4       | guard "no screen draws a native select"                                                    | 0 offenders (was 11)                                                                                                                                        |
| B6b      | `npx tsc --noEmit` (apps/admin)                                                            | exit 0                                                                                                                                                      |
| B6b      | guard "no screen formats a date with the operator locale"                                  | 0 offenders (was 18)                                                                                                                                        |
| B6b      | guard "no admin text is smaller than 12px"                                                 | 0 offenders (was 35)                                                                                                                                        |
| B6b      | i18n parity script (`fa`/`af`/`en`)                                                        | 8958 / 8960 / 8953 keys; every key the redesign added (29, as listed in the guard) exists in all three; the 1+7 pre-existing `landing.*` gaps are untouched |
| B6c      | `npx tsc --noEmit` (apps/admin)                                                            | exit 0                                                                                                                                                      |
| B6d      | CMS screens (pages, globals, editor)                                                       | `tsc` exit 0; public globals endpoint only returns published rows (backend limitation, recorded)                                                            |
| B7b      | admin vitest                                                                               | 3 files / 21 tests pass (14 guards)                                                                                                                         |
| B7b      | guard undo-check (temporary `__guard-probe.tsx` containing `<table>`)                      | 1 test failed as designed; probe removed; 14/14 pass again                                                                                                  |
| B7b      | backend admin regression                                                                   | 8 files / 86 tests pass — identical to baseline                                                                                                             |
| B7b      | `npx eslint app components hooks lib src` (apps/admin)                                     | 0 errors, 13 warnings                                                                                                                                       |
| B8b      | `pnpm --filter @hisabche/admin build` after B6                                             | `EXIT=0`; 29 app paths in `.next/server/app-paths-manifest.json`                                                                                            |

## B2. Formatters and URL list state

### apps/admin/lib/admin-format.ts

- **Current state:** 34 locale-less formatter calls across the console (HC-I18N-01); a date could
  render in the browser's calendar (Gregorian) while the book renders Hijri-Shamsi, and a number in
  Latin digits while the UI is Persian.
- **Proposed:** one module with `adminIntlLocale`, `adminNumber`, `adminMoney`, `adminDate`,
  `adminDateTime` and the literal `UNKNOWN_VALUE`; all four screen formatters delegate to the shared
  `@hisabche/formatting` package (no second money/date algorithm).
- **Alternatives:** (a) call `Intl` at each site — rejected, that is the bug; (b) reuse
  `useDateFormat()` inside non-component code — impossible, it is a hook; (c) a new formatting
  package — rejected, one of everything.
- **Pros/cons:** + one place to change; + money is formatted with the currency layer's own signs and
  fraction digits; − screens must pass the locale explicitly.
- **Pre-passes:** (1) does `formatMoney` accept `KnownCurrency`? yes, `IRT` and `IRR` both exist;
  (2) does `formatDate` accept `string | null`? yes; (3) is `IranianLocale` the right union? admin
  only ships fa/af/en, mapped to `fa-IR`/`fa-AF`/`en-US`; (4) does `UNKNOWN_VALUE` collide with an
  existing constant? no; (5) does anything import `lib/utils` expecting these? no.
- **Benefit question:** can a reviewer grep one file and know every console date is in the book's
  calendar? Yes.
- **Post-passes:** (1) `tsc` for apps/admin; (2) no `toLocaleString` inside the module;
  (3) `?? 0` is not used anywhere in it; (4) no currency literal default; (5) no client-only API at
  import time.
- **Evidence:** audit HC-I18N-01/03/04; `money.ts` `CURRENCY_SIGN`/`FRACTION_DIGITS`.
- **Final decision:** `TYPECHECKED` + `LINTED`; screens converted in B3/B5/B6a.

### apps/admin/hooks/use-admin-list-state.ts

- **Current state:** each list screen keeps `useState` for search/page/sort/filter; the state is lost
  on reload, and a link to a filtered list is impossible (HC-URL-01).
- **Proposed:** `useAdminListState` over the URL (`q`, `page`, `sort`, `dir`, plus named filters),
  preserving `tab` and the locale prefix.
- **Alternatives:** (a) localStorage — rejected: not shareable, and two tabs diverge silently;
  (b) server-side session state — rejected, no such mechanism and it would need an endpoint.
- **Pros/cons:** + links are shareable, reload keeps the view; − a screen must adopt it (each adoption
  is a behaviour change and is listed per screen).
- **Pre-passes:** (1) does `useSearchParams` require a Suspense boundary in the admin? the screens are
  already client components under a client layout; (2) does replacing a query drop `tab`? no, the
  hook merges; (3) does it reset `page` when `q` changes? yes, deliberately; (4) is the type of the
  filter map open? yes, `Record<string, string>`; (5) does it push a history entry per keystroke? no,
  `replace` with throttling left to the screen's input.
- **Benefit question:** does a filtered list survive reload and copy/paste? Yes, once adopted.
- **Post-passes:** (1) `tsc`; (2) eslint; (3) no bare `router.push`; (4) locale prefix preserved;
  (5) `tab` preserved.
- **Evidence:** 26 `page.tsx` screens using local state; audit HC-URL-01/02.
- **Final decision:** `TYPECHECKED` + `LINTED`. Adoption per screen is **not** done in B3 (only the
  hook exists); recorded as open in the audit.

### apps/admin/hooks/use-admin-locale.ts + `useAdminTableT` (admin-ui.tsx)

- **Current state:** screens derive the language from the pathname by hand, or not at all;
  `DataTable`'s `t` prop is `(key, fallback) => string`, which next-intl's translator cannot satisfy
  because its second parameter is `values`.
- **Proposed:** one hook for the locale; one adapter that maps next-intl's `t` onto the table's
  signature. All admin labels exist in fa/af/en, so the fallback is not consulted.
- **Alternatives:** (a) cast `t` to the table signature — rejected: it would pass a string as
  `values` at runtime; (b) change `DataTable`'s public prop — rejected: every existing consumer and
  its tests depend on it; (c) duplicate the adapter in eight screens — rejected, duplication.
- **Pros/cons:** + two small, documented seams; − a hook file of one function.
- **Pre-passes:** (1) does `localeOf` already exist? yes, in `admin-nav.ts`; (2) is a one-parameter
  function assignable to the two-parameter prop? yes; (3) does `useCallback` matter? only to keep the
  table's memo stable; (4) does the adapter hide a missing key? no — `t()` still throws, which is the
  repo's rule; (5) any circular import? admin-ui → next-intl only.
- **Benefit question:** can any screen pass a translator to the shared table without a cast? Yes.
- **Post-passes:** (1) `tsc`; (2) eslint; (3) no `as unknown as`; (4) no `any`; (5) no new export
  from `@hisabche/ui`.
- **Evidence:** `AccountsTab.tsx:90-96` uses a local `safeT` with the same problem.
- **Final decision:** `TYPECHECKED` + `LINTED`.

---

## B3. Tables (first screen: Security)

### packages/ui/src/components/ui/data-table/data-table.tsx — `caption`

- **Current state:** the table renders `<table>` with no accessible name; a screen-reader user hears
  "table" with no subject.
- **Proposed:** an optional `caption` prop rendered as a visually hidden `<caption>`.
- **Alternatives:** `aria-label` on the table — equivalent, but a caption is announced with the table
  and survives a re-render of the wrapper.
- **Pros/cons:** + additive, no visual change; − one prop to document.
- **Pre-passes:** (1) is `caption` already used by any consumer? no; (2) does it clash with an HTML
  attribute in the props type? no, the component takes explicit props; (3) sr-only class exist? yes;
  (4) does the mobile card view duplicate the caption? no, cards render the same list; (5) does the
  existing test snapshot break? no test asserts the table markup.
- **Benefit question:** does every converted list gain a name with one word at the call site? Yes.
- **Post-passes:** (1) `tsc` for packages/ui and apps/admin; (2) the shared suite still passes;
  (3) no visual change; (4) caption is not rendered twice; (5) no new dependency.
- **Evidence:** 0 `DataTable` usages in the console, 10 raw `<table>` elements.
- **Final decision:** `TYPECHECKED`; the shared suite is re-run and reported in B7.

### apps/admin/app/[lang]/(admin)/security/security-client.tsx — four tables

- **Current state:** four hand-written `<table>` elements (audit, accounts, sessions, security events)
  with `new Date(x).toLocaleString()`, `text-[11px]` badges, no caption, no sort, no column settings,
  no mobile layout, and a revoke button whose accessible name is the same for every row.
- **Proposed:** the shared `DataTable` with typed columns, `adminDate(Time)` with the console locale,
  `ErrorState` with a real retry on all four tabs, `EmptyState` that distinguishes "nothing exists"
  from "the filter matched nothing", and a revoke label that names the admin.
- **Alternatives:** (a) keep the raw tables and only fix the dates — rejected, the audit's P1 is the
  table itself; (b) one giant table component for the console — rejected, the shared table exists.
- **Pros/cons:** + sorting, column visibility, saved views, cards on mobile, one caption per table;
  − the search now lives in the table toolbar, so a query that matches nothing must show an empty
  state rather than unmount the toolbar (handled).
- **Pre-passes:** (1) does every hook expose `refetch`? yes, all are `useQuery`; (2) do the item types
  carry the fields the columns read? yes, checked in `use-admin-security.ts`; (3) is `AdminAccountItem.id`
  present for `rowKey`? yes; (4) does the audit endpoint paginate? yes (`total` is shown, the table is
  limited to 50 as before); (5) does the Sheet still open? yes, unchanged.
- **Benefit question:** does a keyboard user reach a named table with sortable headers on every tab?
  Yes.
- **Post-passes:** (1) `tsc`; (2) eslint; (3) four `<DataTable>`; (4) zero `toLocaleString`; (5) two
  new keys exist in three locales.
- **Evidence:** `security-client.tsx` before: 4 `<table>`, 4 `toLocaleString`, 2 `text-[11px]`.
- **Final decision:** `TYPECHECKED` + `LINTED` + `TESTED` (guard test); rendered/keyboard
  `NOT VERIFIED` — no AAL2 session.

### packages/i18n/messages/{fa,af,en}/common.json — security keys

- **Proposed:** `admin.security.accountsLoadError`, `admin.security.revokeSessionFor`
  (`{email}` placeholder).
- **Pre-passes:** no key existed; the placeholder matches the value passed; both are plain text.
- **Final decision:** `IMPLEMENTED`; parity asserted by the B7 guard test.

---

## B5. Dashboard

### apps/admin/app/[lang]/(admin)/dashboard/dashboard-client.tsx

- **Current state:** `generatedAt`, KPI values, plan counts and the "of total" number used
  `toLocaleString()` (Latin digits, browser locale); the revenue tab was a placeholder whose text
  claimed a feature was "coming"; a failed past-due read rendered as "no alerts"; the past-due row's
  identity was a raw UUID.
- **Proposed:** `adminNumber/adminDateTime` with the console locale; the revenue tab keeps its nav
  entry and shows an honest empty state (what the tab does not calculate) plus a link to the real
  billing ledger; `ErrorState` + retry for past-due; the row is labelled by a short workspace
  reference with the full id in `sr-only` text.
- **Alternatives:** (a) compute revenue from `/admin/billing/ledger` in the client — rejected: that
  would be a new aggregation the server does not own; (b) remove the tab — forbidden by the owner;
  (c) keep the UUID as the headline — rejected, it is not an identity a human can use.
- **Pros/cons:** + no invented number, no false empty state; − the tab is still not a report (recorded
  P2/Deferred).
- **Pre-passes:** (1) does an existing endpoint already return a revenue total? no — the ledger is a
  list, and summing it client-side is the forbidden aggregation; (2) does `useAdminPastDue` expose
  `isError/refetch`? yes; (3) is the workspace name available? no, the endpoint returns
  `workspace_id` only — hence a reference, not a name; (4) does the ledger tab id exist? yes,
  `?tab=ledger`; (5) does the link keep the locale? yes, through the locale helper.
- **Benefit question:** can the owner show this tab to a customer without a false statement on screen?
  Yes.
- **Post-passes:** (1) `tsc`; (2) eslint; (3) no `toLocaleString`; (4) three new keys in fa/af/en;
  (5) the nav and tab list are unchanged.
- **Evidence:** dashboard revenue block before: `admin.empty.comingInNextStep`.
- **Final decision:** `TYPECHECKED` + `LINTED` + `TESTED`; runtime `NOT VERIFIED`.

---

## B6a. Revenue hub (tables and currency)

### apps/admin/app/[lang]/(admin)/revenue/revenue-client.tsx

- **Current state:** three raw tables (plan prices, billing ledger, maker-checker) with
  `toLocaleString()`; the currency was a literal `IRR` and a `currency.toman` label beside a
  `/10` division; an unrestricted 10px badge; approve/reject buttons whose accessible names did not
  say which request they act on.
- **Proposed:** `DataTable` with typed columns; `adminMoney(amount_irr, 'IRR')` for the rial cell and
  `adminMoney(amount_irr / 10, 'IRT')` for the toman cell (both are currencies the formatting layer
  knows; the field itself is named `amount_irr`); `ErrorState` + retry; action labels that include
  the action type; a translated "always" for an open-ended price.
- **Alternatives:** (a) take the currency from a book setting — impossible: this is a platform price,
  not a workspace book, and no endpoint returns its currency; (b) drop the toman column — rejected:
  it is the number operators actually read; (c) `toLocaleString` with a locale — rejected, the shared
  formatter already handles sign and digits.
- **Pros/cons:** + no currency literal, no ambiguous buttons, sortable and searchable lists; − the
  /10 conversion is still a display rule and is now stated in one comment-free call per cell.
- **Pre-passes:** (1) is `IRT` an active currency? yes, `CURRENCY_SIGN.IRT = 'ت'`, 0 fraction digits;
  (2) does `formatMoney` keep a negative sign? yes; (3) does the ledger row have `id`? yes;
  (4) does `AdminActionRequestItem` carry `action_type` for the label? yes; (5) does the step-up flow
  still receive the selected request? yes, unchanged.
- **Benefit question:** can a reviewer point at any amount on this screen and say which currency it is
  in without reading code? Yes.
- **Post-passes:** (1) `tsc`; (2) eslint; (3) three `<DataTable>`; (4) no `>IRR<` literal; (5) no
  `text-[10px]`.
- **Evidence:** audit HC-I18N-04 and HC-A11Y-04; `money.ts` sign table.
- **Final decision:** `TYPECHECKED` + `LINTED` + `TESTED`; runtime `NOT VERIFIED`.

### packages/i18n/messages/{fa,af,en}/common.json — revenue key

- **Proposed:** `admin.revenue.effectiveUntilOpen` ("always"), replacing a Persian literal that was
  rendered unchanged in every locale.
- **Final decision:** `IMPLEMENTED`; parity asserted by the B7 guard test.

---

## B7. Guards, regression and the Dari correction

### apps/admin/src/**tests**/admin-redesign.guard.test.ts (new, 9 assertions)

- **Current state:** the console has no test that protects the shell's skip link, the locale-aware
  navigation, the table adoption or the formatter rule. A later edit could restore `toLocaleString`
  and every existing test would stay green.
- **Proposed:** source-assertion guards (comments stripped first): one skip link before the sidebar and
  `<main>`; no bare `router.push('/'` and no locale-less formatter in the shell; the palette is
  nav-driven and keeps `defaultTab`; security has four and revenue three `DataTable`s; those screens
  import `lib/admin-format` and contain no `text-[10px]/[11px]`; the revenue screen formats `IRR` and
  `IRT`; every converted screen has an `ErrorState` with retry; the barrel exports `DataTable` and
  `TableColumn`; the seven keys added in B1–B6a exist in fa, af and en.
- **Alternatives:** a rendered-DOM test — unavailable (no jsdom/testing-library, no AAL2 session, and
  installing either is forbidden).
- **Pros/cons:** + runs in 400 ms and catches the exact regressions this work can cause; − cannot see
  layout, focus order at runtime or contrast.
- **Pre-passes:** (1) does each assertion fail if the fix is undone? checked by reasoning, and two
  failures were observed while writing it (ordering, 10px chips); (2) does it read real files? yes,
  absolute paths from `__dirname`; (3) does it depend on a locale? no; (4) does it duplicate the
  hubs test? no, it adds rules; (5) is it deterministic? yes, no network, no DB.
- **Benefit question:** would a reviewer's "you brought back `toLocaleString`" be a red test? Yes.
- **Post-passes:** (1) 3 files / 16 tests pass; (2) `tsc`; (3) eslint; (4) no `any`; (5) no test
  weakened.
- **Evidence:** the run below.
- **Final decision:** `TESTED`.

### Dari correction (found by `packages/ui/src/__tests__/dari-is-not-pashto.test.ts`)

- **Current state:** 15 strings added in B1–B6a to `messages/af/common.json` used Pashto-only letters
  (`ږ ښ ې ۍ ټ ډ ړ ڼ ګ`): the skip link, nav group labels, 404 copy, loading label, palette labels,
  `admin.error.hint`, dashboard revenue copy, the workspace reference and the revoke-session label.
- **Proposed:** rewrite each in Dari (e.g. «رفتن به محتوا», «محتوا و حاکمیت», «همیشه»).
- **Alternatives:** weaken the test — forbidden (AGENTS §0.8: the rule is the thing to satisfy).
- **Pros/cons:** + the Dari bundle is Dari again; − none.
- **Pre-passes:** (1) is the guard's letter list the only rule? yes; (2) does any legitimately Dari word
  need those letters? no; (3) does the `fa` bundle change? no; (4) are placeholders preserved? yes,
  `{id}` and `{email}`; (5) does JSON stay valid? parsed after writing.
- **Benefit question:** would a Dari-speaking operator now read these screens in their own language?
  Yes.
- **Post-passes:** (1) the guard test passes; (2) zero Pashto-only letters in `af`; (3) the full
  `packages/ui` suite is re-run; (4) no key renamed; (5) no `en`/`fa` value touched.
- **Evidence:** the guard's output listed exactly these 15 strings.
- **Final decision:** `TESTED`.

Fill one row per batch immediately after running it. Never pre-write a result.

## B3b. Every table (18 of 18)

- **Current state:** 18 raw `<table>` elements (security 4, revenue 3, offline 5, customers 1,
  product 1, operations 1, blog 1, CMS pages 1, CMS globals 1 - measured from `git diff`: 18 removed,
  0 added). Below 768 px every one of them was a horizontal scroll, and a failed read was drawn as
  "you have no data".
- **Proposed:** one `DataTable` per screen with `TableColumn` renderers, a `locked` identity column,
  `showFrom` for the columns a phone does not need, and `ErrorState` + retry only in the error
  branch. The empty branch is only reachable when the read succeeded.
- **Alternatives:** a card fallback written per screen — rejected, that is ten copies of the same
  component and the audit already found them disagreeing.
- **Pros/cons:** + cards below 768 px, column choice persisted per `tableId`, one sort/search model;
  - the desktop table still scrolls inside its own container when a screen asks for a wide minimum.
- **Pre-passes:** (1) does `DataTable` already render cards? yes, `DataTableCards`; (2) does it own
  pagination? it can, and `paginate={false}` keeps an external `PaginationBar`; (3) does it need a
  caption? optional, and the surrounding heading is enough on the screens where no string existed;
  (4) does every row have a stable key? yes, `id`; (5) does a column render a React node? yes.
- **Benefit question:** would an operator on a phone now read a real card instead of a scroll box?
  Yes.
- **Post-passes:** (1) `tsc` exit 0; (2) the repo-wide guard finds 0 `<table>`; (3) `<select>` inside
  the same screens also reached 0 in B4; (4) no screen lost its empty state; (5) no `any`.
- **Final decision:** `TYPECHECKED` + guarded.

## B4. Forms and destructive actions

- **Current state:** 12 raw `<select>` (AI 1, wallet 3, blog filters 2, blog editor 2, post editor 2,
  CMS globals 1, CMS page editor 1 - `git diff`: 12 removed, 0 added) and three `window.confirm()`
  questions that named no target.
- **Proposed:** `SelectField` everywhere (it keeps the `''` sentinel for "all"), and `AlertDialog`
  controlled by local state — the shared `AlertDialogAction` is a plain `<button>`, so it does not
  close the dialog by itself and the state must be cleared in the handler. Each description names the
  thing: `{name}` for a taxonomy term, `{title}` for a post, `{flag}` for a feature flag.
- **Alternatives:** a `useConfirm()` hook — rejected, the dialog markup has to live somewhere and
  the three sites differ in what they name.
- **Pros/cons:** + consistent keyboard behaviour, translated copy, tokens; - three more dialogs in
  the tree (they render through a portal and cost nothing until opened).
- **Pre-passes:** (1) does `SelectField` support a disabled trigger? yes; (2) does it forward `name`
  for the post editor's field? yes; (3) does the `''` value survive Radix? yes, it is mapped to a
  sentinel internally; (4) do the new keys need values? no; (5) is `AlertDialog` exported from the
  admin barrel? yes, since B1.
- **Benefit question:** can an operator tell _what_ they are about to delete from the dialog alone?
  Yes.
- **Post-passes:** (1) `tsc` exit 0; (2) guard finds 0 `confirm(` and 0 `<select>`; (3) the
  `af` values use no Pashto-only letter; (4) the taxonomy dialog reuses the existing
  `confirmDelete` key as its title; (5) the post dialog falls back to the loaded title when the form
  is untouched.
- **Final decision:** `TYPECHECKED` + guarded.

## B6b-d. The remaining screens

- **Current state:** 18 `toLocale*` sites (a date in the browser calendar, a count in the OS digits),
  35 labels at 9-11 px, and three CMS screens that were placeholder UI: a dead "Live preview" button,
  a fake canvas, two "Add section" buttons with no handler, an uncontrolled form that saved the
  object it had fetched, `any` in the mutation, and bare `/cms/...` links.
- **Proposed:** every date and count through `lib/admin-format` with `dateLocale` from
  `useAdminLocale`; every label at `text-xs` or above; the CMS list screens on `DataTable` with
  typed `apiClient.get<T>` generics; the editor turned into a real form (title, slug, locale) that
  POSTs or PUTs exactly the fields `pageInputSchema` accepts, and every control that had no
  behaviour deleted rather than faked.
- **Alternatives:** keep the CMS screens as they were — rejected, it is placeholder UI in a
  production console and the audit lists it as such.
- **Pros/cons:** + the console stops lying about features it does not have; + CMS create/edit works
  against the existing backend; - the CMS section editor is gone from this console until there is an
  API to save sections (the backend accepts `sections` with a default, but no editor exists).
- **Pre-passes:** (1) does `pageInputSchema` require more than title/slug/locale? no, `theme` and
  `sections` have defaults; (2) does `GET /api/cms/pages` return an array? yes, it sends the rows
  directly; (3) does the globals screen read an admin endpoint? no, only the public published
  endpoint exists — recorded as a limitation, backend untouched; (4) does `useRouteLang` exist in
  the admin barrel? it was added there in this pass; (5) is `adminNumber` correct for a count? yes,
  integer digits in the UI locale.
- **Benefit question:** would a reviewer find a button that does nothing? No.
- **Post-passes:** (1) `tsc` exit 0; (2) 0 `toLocale*`, 0 sub-12px text; (3) no `any` in the CMS
  files; (4) `users` adopted the URL list state so the hook is no longer dead code; (5) i18n keys
  added to all three locales.
- **Final decision:** `TYPECHECKED` (`IMPLEMENTED_NOT_LIVE_VERIFIED` for the CMS save path — no
  admin session to press it).

## B7b. Guards extended to fourteen

- **Current state:** the guard protected the shell, the four security tables and the revenue hub. It
  could not see a new raw table, a new `<select>`, a re-introduced `confirm()` or a 10 px label in a
  file it did not name.
- **Proposed:** five repo-wide assertions that walk every `.ts/.tsx` under `apps/admin` (tests and
  `.next` excluded) with comments stripped first: no `<table>`, no `<select>`, no `toLocale*`, no
  `confirm()`, no bare `router.push('/`, no sub-12px text. The key assertion grew from 7 to 29 keys.
- **Alternatives:** run ESLint rules instead — the repo has no such rule, and adding one is a
  dependency/config change outside this task.
- **Pros/cons:** + a regression anywhere in the console is one red test; - a new screen that must use
  a raw element for a real reason would have to change the guard consciously.
- **Pre-passes:** (1) does the walk skip generated output? yes; (2) are comments stripped? yes, three
  files mention the old patterns in prose; (3) is the walk deterministic? yes, no network; (4) does it
  duplicate the hub tests? no; (5) is the pattern too broad? `confirm(` excludes `confirmToggle(`.
- **Benefit question:** would "someone brought `<select>` back" be a red test? Yes — proved with a
  temporary probe file.
- **Post-passes:** (1) 14/14 pass; (2) probe made it 13/14 then was removed; (3) `tsc` unaffected;
  (4) eslint on the test file; (5) no assertion weakened.
- **Final decision:** `TESTED`.
