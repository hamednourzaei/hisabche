---
name: hisabche-ux-consolidation
description: How to audit and improve the UX of Hisabche — one hub per intent, actions done in place («express») instead of on a new page, fewer frontend routes. Use before analysing a page, proposing a UX change, adding a route or a menu item, or merging screens. The per-page audit lives in .claude/ux-audit/.
---

# UX consolidation for Hisabche

The owner's instruction, in his words: everything that belongs to one job —
«صدور فاکتور خرید و فروش» — must not be scattered across pages; most things
should be done **express**, in place; and the number of frontend routes should
go **down**.

This skill is the method. The findings are in `.claude/ux-audit/`:

```
.claude/ux-audit/README.md          how the audit was made, the index of pages
.claude/ux-audit/00-PROPOSAL.md     the target structure and the phases — needs the owner's yes
.claude/ux-audit/pages/<page>.md    one file per page: facts, findings, proposal
```

## ⚠️ Before / after — the owner's rule for the whole redesign

The new UX is built **beside** the old one, not over it. A «قبل / بعد» switch sits
at the top of every app page. Until the whole redesign is finished and the
owner has compared the two:

- **Delete nothing of the old UX** — no page, no menu item, no component.
- Read the version only from `useUxVersion()` (`@hisabche/store`); the control is
  `<UxVersionSwitch />`, mounted in both shells. Default: `after`.
- A menu item that exists in one version only carries `ux: 'before' | 'after'`
  in `navigation.ts`; `visibleInUx()` is the one filter. A hub's new tabs render
  only in `after`.
- Both versions mount the **same containers and hooks**. «After» is an
  arrangement, never a second implementation of logic.
- No server-side redirect for a page still shown in «before»: the server does
  not know the version. (A page that was only ever a redirect has no «before».)
- At the end: compare → the owner chooses → delete the loser **and the switch**
  (`useUxVersion`, every `ux:` field, its keys).

This overrides step 4 of the merge checklist below while the comparison is on:
old addresses stay real pages; they become redirects only after the choice.

## The owner's taste — decided on `/invoices`, applies to every page

These came from his review of the first redesigned page (4 October 2026). They
are not suggestions; apply them without asking again.

### 1. One UI, used many times — never draw a second one

His first complaint: «تو اصلاً یکاری نمیکنی که با یک ui بشه چندین بار در چند صفحه استفاده کرد».
Before writing markup, use the part that exists. If a second screen needs
something a first screen drew inline, **extract it** and use it in both.

| Need                               | The one component                                                                      | File                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Tabs of a hub page                 | `HubTabs` + `useHubTab` (`?tab=`)                                                      | `components/ui/hub-tabs.tsx`                       |
| «Show this part» inside a page     | `SegmentedControl`                                                                     | `components/ui/segmented-control.tsx`              |
| **Any list of records**            | `DataTable` (search, saved views, column settings, sorting, selection)                 | `components/ui/data-table/`                        |
| A filter on a table                | `TableFilterSelect` (filter icon + the shared select), passed in the table's `actions` | `components/ui/data-table/table-filter-select.tsx` |
| Client-side search of a short list | `matchesSearch`                                                                        | `components/ui/data-table/match-search.ts`         |
| A dropdown                         | `SelectField`                                                                          | `components/ui/select-field.tsx`                   |
| A figure                           | `KpiCard` / `KpiGrid`                                                                  | `components/ui/kpi-card.tsx`                       |

A `<ul>` of bordered rows with a button on each is a table that has not been
written yet. Use `DataTable`.

### 2. Few tabs, small and centred

- A hub has as few tabs as possible — `/invoices` went from four to **two**.
  A tab must be a different job, not a different filter of the same records.
- The bar is only as wide as its items, **centred**, with **soft-square**
  corners (`--radius-md`) — never full-width, never pill-shaped. `HubTabs` does this.

### 3. One table per kind of record; switches change the data, not the table

- Sale and purchase invoices are ONE table. «همه / فروش / خرید» and the status
  filter change the query; the toolbar (search, saved views, columns) stays put.
- Filters go to the server when the table is paged. Offer only values the
  record can really have.

### 4. No parallel lines

If two pages hold «the same thing» in two tables and one of them cannot be
added to from the product, that page is removed and its address redirects to
the real one. `/purchasing` listed purchase orders nothing in the UI could
create, beside purchase invoices in `/invoices` — it is gone, on his explicit
instruction. **Check before building on a list page: can anything add to it?**

His explicit «حذف کن» for a page overrides the before/after rule for that page.

### 5. One thing on screen at a time

Two lists stacked on one page is «زشت». Put a `SegmentedControl` at the top and
show one section; the other mounts only when chosen. Actions of a section
(its «تازه» button, its note) show only with that section.

When the switch swaps one whole screen for another inside a hub tab, the
choice goes in the address with `useHubSection(offered, clears)` (`?view=`),
next to `useHubTab` (`?tab=`): it can be linked, and leaving the tab leaves
the section. `/warehouse` is the model: tabs «موجودی · انقضا», and inside
«موجودی» the switch «انبارها | کالاها».

Before folding a page into a hub, check that it is ONE job and that its list
can be added to. `/stock-count` was left out of the warehouse hub because no
screen can start a count (`useCreateCycleCount` has no caller); `/operations`
because it mixes reorder with till shifts and sales opportunities. Report
such a page — do not hide it behind a tab.

**If a page has room, bring its relatives in** (owner, 5 Oct 2026): anything
that belongs to the same job comes to the same page as a second tab with a
switch — `/customers` took «پیگیری» and «کمپین‌ها» this way. Its menu entry
then gets `ux: 'before'`.

**Shared data means one page** (owner, 5 Oct 2026, standing order): while
redesigning a page, compare its reads and writes with every other route
(`.claude/ux-audit/pages/*.md`). A route that reads or writes the same
records comes INTO this page as a tab or section — its own container, lazy,
behind the same module lock — and its menu entry gets `ux: 'before'`. The
goal is fewer routes. Report, do not hide, a page that is not one job or a
list nothing can add to.

### 6. A detail opens from its row

Pressing a row opens that record's detail under the table (or in a panel) —
not a separate «open» button per row, not a new route.

## Where the method comes from

Adapted from four public Claude skills (found on GitHub, October 2026), keeping
what fits an accounting product used on a phone at a shop counter:

| Source                                | What was taken                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| `szilu/ux-designer-skill` (MIT)       | review workflow, the modal / side panel / page decision tree, core numeric rules  |
| `wonjyou/design-audit`                | the six audit dimensions, the web-app criteria, What / Why / Suggestion findings  |
| `mastepanoski/claude-skills` (MIT)    | Nielsen 0–4 severity, the cognitive walkthrough's four questions                  |
| `mistyhx/frontend-design-audit` (MIT) | auditing from code: read the component, name the principle, give the concrete fix |

Nothing was copied verbatim; the rules below are rewritten for this codebase.

## The five principles — in order of priority

1. **One hub per intent.** A person comes with a job («بفروشم»، «ببینم چه کسی
   بدهکار است»، «انبار را بشمارم»). Everything for that job is one destination
   with tabs or sections — not five menu items.
2. **Express: do it where you are.** A create, edit, confirm or record action
   opens **in place** (inline, side panel, sheet) and returns the person to the
   same spot. Navigating away is the exception and needs a reason.
3. **A route is for a thing with an address.** A list, an entity (`/x/[id]`),
   a standing workplace (the till). Not a step, not a form, not a filter, not
   a hub that only lists links.
4. **Progressive disclosure.** The daily 20% is on the surface; the rest opens
   on demand and loads only then.
5. **Nothing is lost.** Every old address keeps working (redirect to the hub
   with `?tab=`), every capability stays reachable, every permission lock still
   hides what it hid.

## Decision trees

### Does this need a route?

```
Is it an entity someone links to, bookmarks or shares?        → /things/[id]
Is it a list people land on from the menu?                     → /things  (the hub)
Is it a place someone stands all day (till, builder)?          → its own route
Is it a step of a flow?                                        → state inside the flow's route (?step=)
Is it a second view of the same data?                          → a tab (?tab=)
Is it a form to create or edit?                                → panel / sheet / inline — no route
Is it a page that only links to other pages?                   → delete it; the hub's tabs are the links
```

### Where does an action open? (from `szilu/ux-designer-skill`, adapted)

```
1–3 fields or a confirmation                 → inline, or a small dialog
A form that needs the page behind it         → side panel (desktop) / bottom sheet (phone)
Needs the full width (invoice grid)          → full page, with a way back that keeps the draft
A multi-step flow with short steps           → one route, a stepper, steps as state
Destructive or financial                     → a second press that says what will happen, with the amount and currency
```

### Tab, section, or separate hub?

- Same data, different view → **tab**.
- Same job, different data → **tab**, lazy-loaded.
- More than 7 at one level (Hick's law) → group into 2 levels: sections on the
  side, tabs inside.
- Different job, different person, different permission module → another hub.

## How to audit a page (from code — nothing is rendered)

1. **Establish the job.** Read the container's header comment and its hooks.
   Write one Persian sentence: «این صفحه برای … است».
2. **Collect facts** with `node <scratchpad>/ux-scan.js` (route, container,
   reads, writes, tabs, dialogs, links in and out, menu membership, app-shell
   route, help article). Facts go in the page file as they are.
3. **Walk the main task** with the four questions (cognitive walkthrough):
   will the person try the right thing · will they see the control · will they
   connect it with what they want · will they see that it worked.
4. **Judge against six dimensions** (`wonjyou/design-audit`): information
   architecture · heuristics · UI patterns · human factors · UX copy · visual
   consistency. For Hisabche the first one weighs most.
5. **Write findings** as What / Why / Suggestion, each with a severity:

   |     | Meaning (Nielsen)                                         |
   | --- | --------------------------------------------------------- |
   | 4   | blocks the job, or shows a wrong number                   |
   | 3   | serious friction: the person must leave the page, or hunt |
   | 2   | noticeable friction                                       |
   | 1   | cosmetic                                                  |
   | 0   | not a problem — noted as a strength                       |

6. **Give the verdict** — exactly one of:

   `KEEP` · `KEEP_AS_ENTITY` · `MERGE_AS_TAB → /hub` · `MERGE_AS_STEP → /flow` ·
   `MERGE_AS_PANEL → /page` · `REMOVE_HUB` · `REDIRECT_ONLY` · `OUT_OF_SCOPE`

## What an audit must NOT claim

- A static scan cannot see rendering. «نشانه‌ای در کد دیده نشد» is the wording;
  never «این صفحه خطا را نشان نمی‌دهد».
- Do not invent usage numbers («کاربران کم استفاده می‌کنند»). There is no
  analytics in this repository. Argue from the job and the structure.
- Do not propose removing a capability. Consolidation moves it.

## Implementing a merge — the checklist

Nothing below is optional; each line has broken something here before.

1. **Mount, do not rewrite.** The hub renders the container that already owns
   the screen (`GovernanceHubContainer` is the model). No second implementation.
2. **Lazy-load every tab** that is not the default (`next/dynamic` / `React.lazy`)
   and mount it only when opened — bundle size and the performance gate.
3. **The tab is in the URL** (`?tab=`), read with the shared search-params hook,
   so a tab can be linked, bookmarked and reached by the back button.
4. **Old addresses redirect** to `hub?tab=…`. On the web: `redirects()` in
   `next.config.js` rather than a `page.tsx` per old route. In app-shell: a
   `<Navigate>` route. Keep them for at least the life of the docs and emails
   that link to them.
5. **Permission locks follow.** `NAV_MODULE` maps a path to a module; a merged
   tab must be hidden for a member whose module is blocked, and the hub must
   still open when one of its tabs is locked.
6. **Update the contract in one change:** `navigation.ts` (items, `NAV_MODULE`),
   `nav-items.ts`, app-shell `app.tsx` + sidebar list, `robots.ts`,
   `ROUTE_DOCS_MAP` / docs article links, command-palette paths, every
   `push('/old')` and `href="/old"` in `packages/ui` (grep), i18n keys ×3.
7. **Guards will go red on purpose** — `robots-dashboard-routes`,
   `dashboard-page-structure`, `business-os-screens-keys`, navigation tests,
   `docs-no-implementation-leak`. Fix the rule's data, never loosen the rule.
8. **Phone first.** Tabs scroll horizontally (`overflow-x-auto`, no wrap), the
   active tab is visible on load, a panel becomes a bottom sheet, targets ≥ 44px.
9. **RTL.** Logical properties only; panels open from the inline-end side.
10. **One phase at a time,** each ending in the full verify. Builds only when
    the owner asks or all approved phases are done.

## Core rules kept from the sources (numbers)

- Top level: 5–7 destinations on desktop, 3–5 on the phone's bottom bar.
- Current location always visible (hub title + active tab).
- Feedback within 100 ms; a spinner after 1 s; never a silent disabled button —
  say why.
- Labels above fields; validate on blur; errors inline next to the field.
- All states designed: loading, empty (with the next action), error, offline,
  forbidden, «not set up».
- Targets ≥ 24×24 px, 44 px for anything pressed at a counter.
- Text expansion: Dari and English labels can be 30–40% longer than Persian.

## Reporting

Per page: the file in `.claude/ux-audit/pages/`. Across pages: update
`00-PROPOSAL.md` — the table of «امروز → پیشنهاد», the route count before and
after, and the phase it belongs to. Implementation starts only after the owner
approves a phase by name.

## One UX (5 Oct 2026) — the comparison is over

The owner chose «after». The switch, `useUxVersion`, `visibleInUx` and the `ux:` field are deleted; do not
bring them back. Folding a page into a hub now means all of: mount its container as a tab/section, remove
its menu entry, delete its web `page.tsx` folder, add one pair to `moved` in `apps/web/next.config.js` and
the same `<Navigate>` in `packages/app-shell/src/app/app.tsx`, repoint links to the hub address, keep its
`NAV_MODULE` key (it is the section lock) and list it in `nav-module-locks.test.ts`. Then run the
`ui-contract` suite as well as `ui` — breadcrumbs, the work queue and the docs map read the menu.
