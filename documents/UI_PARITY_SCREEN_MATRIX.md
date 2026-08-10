# UI PARITY SCREEN MATRIX

Execution checklist for the Web → Desktop → Mobile parity programme.
Companion to [UI_PARITY_EXECUTION.md](./UI_PARITY_EXECUTION.md), which holds the
architecture and the route-level ledger.

**Verification levels used below.** Do not upgrade one without doing the work:

- `DOM-VERIFIED` — the web page was rendered at `localhost:3039`, and its
  geometry/typography read from computed styles.
- `SOURCE-VERIFIED` — read from the implementation; not rendered.
- `PIXEL-VERIFIED` — side-by-side screenshots compared. **Nothing is at this
  level yet**: the Browser pane could not composite frames in this environment,
  so `computer{screenshot}` times out. Mobile and desktop have not been rendered
  at all — no simulator, and the Electron window is not scriptable from here.

---

## How desktop renders each screen

Desktop mounts the shared container for 12 of 14 screens — it is not a
reimplementation. The audit's job was finding the ones that had drifted.

| Screen           | Desktop implementation                        | Verdict                            |
| ---------------- | --------------------------------------------- | ---------------------------------- |
| Dashboard        | ~~private, 133 lines~~ → `DashboardContainer` | **fixed this pass**                |
| Invoices         | `InvoicesContainer`                           | shared                             |
| Invoice detail   | `InvoiceDetailContainer`                      | shared                             |
| Quick invoice    | `QuickInvoiceContainer`                       | shared                             |
| Purchasing       | `PurchasingContainer`                         | shared                             |
| Warehouse        | `WarehouseContainer`                          | shared                             |
| Warehouse detail | `ProductDetailContainer`                      | shared                             |
| Customers        | `CustomersContainer`                          | shared                             |
| Customer detail  | `CustomerDetailContainer`                     | shared                             |
| Accounting       | `AccountingPage`                              | shared                             |
| Activities       | `ActivitiesPage`                              | shared                             |
| Settings         | private, 124 lines                            | **open** — see gaps                |
| Sync centre      | private, 102 lines                            | **legitimate** — IPC/SQLite outbox |
| Login            | private, 100 lines                            | **open** — see gaps                |

---

## Screen matrix

| Screen           | Web       | Desktop       | Mobile   | Workflow | States     | Tables  | Forms    | Dialogs    | Priority | Status                      |
| ---------------- | --------- | ------------- | -------- | -------- | ---------- | ------- | -------- | ---------- | -------- | --------------------------- |
| Dashboard        | canonical | shared ✓      | native ✓ | ✓        | L/E/P/Err  | —       | —        | date range | P0       | labels + activities aligned |
| Invoices         | canonical | shared ✓      | native ✓ | ✓        | L/E/P/Err  | 9 cols  | —        | —          | P0       | header + export aligned     |
| Invoice detail   | canonical | shared ✓      | native   | ✓        | L/E/P/Err  | items   | —        | actions    | P0       | not yet audited             |
| Quick invoice    | canonical | shared ✓      | native ✓ | ✓        | submitting | items   | full     | sheets     | P0       | `?type=` aligned (phase 1)  |
| Purchasing       | canonical | shared ✓      | native ✓ | ✓        | L/E/P/Err  | 6 cols  | —        | —          | P0       | built phase 1               |
| Warehouse        | canonical | shared ✓      | native   | ✓        | L/E/P/Err  | table   | —        | add modal  | P1       | not yet audited             |
| Warehouse detail | canonical | shared ✓      | native   | ✓        | L/E/P/Err  | —       | edit     | —          | P1       | not yet audited             |
| Customers        | canonical | shared ✓      | native   | ✓        | L/E/P/Err  | table   | —        | add modal  | P1       | not yet audited             |
| Customer detail  | canonical | shared ✓      | native   | ✓        | L/E/P/Err  | tx list | —        | —          | P1       | not yet audited             |
| Accounting       | canonical | shared ✓      | native   | ✓        | L/E/P/Err  | tx list | —        | —          | P2       | not yet audited             |
| Activities       | canonical | shared ✓      | native ✓ | ✓        | L/E/P/Err  | feed    | —        | —          | P2       | built phase 1               |
| Settings         | canonical | private       | native   | ~        | —          | —       | prefs    | —          | P2       | desktop + mobile subset     |
| Sync centre      | canonical | private (IPC) | native   | ~        | —          | queue   | —        | —          | P3       | platform-specific by design |
| Login            | canonical | private       | native   | ✓        | submitting | —       | 2 fields | —          | P3       | not yet audited             |

L/E/P/Err = loading / empty / populated / error, all four present via
`QueryList` on mobile and the shared views on web.

---

## Canonical measurements — Invoices (DOM-VERIFIED)

Read from computed styles at 1280×720, `fa` locale, dark theme.

| Element             | Value                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| Sidebar width       | 224px                                                                      |
| Main padding        | 16px (`p-4`), no max-width                                                 |
| Page title `h1`     | 30px/36px w700 `fg-primary` — responsive `text-xl → sm:2xl → lg:3xl`       |
| Page subtitle       | 14px/20px w400 `fg-secondary`                                              |
| Primary action      | h40, radius 9999px (pill), padding 0/20px, 14px w700, `min-h-[44px]` floor |
| Filter tab (active) | h32, radius 16px, padding 6/16px, 14px w500, bg primary, fg `#0C141D`      |
| Filter tab (idle)   | same box, transparent bg, `fg-secondary`                                   |
| Export button       | h34, radius 20px, 0.8px border, padding 6/12px, gap 6px, 14px w500         |
| Icon button         | 36×36, radius 20px                                                         |

**Mobile consequence.** At the mobile breakpoint the web `h1` renders at
`text-xl` = 20px bold. `mobile-ui`'s `title` variant is `fontSize.xl` = 22px
bold — within one step, and both are the top of their own scale, so the
hierarchy matches. No token change needed.

**Invoices table columns** (SOURCE-VERIFIED, `invoices-view.tsx`): type,
invoice number, date, party («طرف حساب», neutral), company, total, currency,
status, payment date.

Mobile card coverage after this pass: party, invoice number, date, type, total,
currency (as the money sign), status, and settlement date. **Company is absent
on every platform** — `invoices-mappers.ts` maps it to `""` with a TODO,
because `customers` has no `company` column. That is a shared schema gap, not a
mobile gap; the mobile card deliberately does not render an always-blank field.

---

## Fixed this pass

1. **Desktop dashboard was a different product.** Private 133-line page with its
   own KPI set, its own quick-action card, copy from a desktop-only i18n
   namespace, and two buttons pointing at `/sales/new` and `/inventory` — paths
   the router only keeps as redirects. Replaced with `DashboardContainer`;
   `metric-tile.tsx` and `sales-chart.tsx` deleted as orphans. Required a
   `next/dynamic` shim, which preserves the code-splitting intent: recharts
   still lands in its own 899 kB chunk and the dashboard chunk is 7 kB.

2. **Export was DOM-bound and duplicated.** CSV serialisation moved to
   `@hisabche/formatting/csv` (`toCSV`, `csvFilename`) — no DOM, so all three
   platforms emit identical bytes including the UTF-8 BOM that stops Excel
   mangling Persian. The invoice column set moved to
   `@hisabche/ui-contract/export-columns`, so a purchase cannot be exported as a
   sale on one platform and correctly on another.

3. **Mobile invoices had no export at all** — a capability gap against web.
   Added via `shareAsCSV` (write to cache + system share sheet), consuming the
   same contract and serialiser web uses.

4. **Settlement date was a view detail on web and absent on mobile.** "Which
   invoices count as settled" moved to `settlementDate()` in
   `@hisabche/validation/invoice.schema` — beside `computeItemTotal`, the file
   that already holds the money rule. Web's mapper and the mobile card now read
   the same helper, and the mobile card shows «تاریخ تسویه» when it exists.

5. **Mobile invoices was titled from a private key.** Now `nav.getPaid` +
   `nav.getPaid_description` — the exact words web shows — plus the subtitle it
   was missing. `useCommonT` adapts i18next's `t` to the `(key, fallback)` shape
   the shared contract helpers expect, so mobile calls those helpers rather than
   growing mobile-shaped copies.

---

## Dashboard (DOM-VERIFIED web, SOURCE-VERIFIED mobile)

Web anatomy: greeting header (`h1` time-of-day + subtitle) → KPI grid
(`grid-cols-2 lg:grid-cols-4`, so **two columns on a phone**) → sales chart with
date-range picker + AI insights → recent activities.

KPI set is identical on both: total sales, today's sales, customer debt,
warehouse value. Mobile renders them as a hero card plus tiles rather than a
uniform 2×2 grid — a deliberate priority treatment, recorded below.

**Terminology drift found and fixed.** Mobile captioned the same numbers
differently, from a private `home.*` namespace:

| KPI            | Web               | Mobile (before) |
| -------------- | ----------------- | --------------- |
| totalSales     | فروش کل           | کل فروش         |
| warehouseValue | ارزش کل انبار     | ارزش انبار      |
| insights       | پیشنهادهای هوشمند | تحلیل هوشمند    |

Mobile now reads `dashboard.*` from the shared catalog. All keys verified
present in `fa`, `af` and `en`.

**Missing panel added.** Mobile had no recent-activities section. Now
`RecentActivitiesCard` — same `useActivities` hook, same flatten-and-sort rule,
same copy keys, same tap target (the entity behind the activity).

Still open on mobile: the chart's date-range picker. Web can rescope the chart;
mobile's is fixed at the default range. P1.

---

## Bugs found and fixed

Both were dead links in the **canonical web reference**, so they were failing on
every platform — a 404 on web, a silent bounce to the dashboard on desktop's
catch-all route.

1. `dashboard-view.tsx` — the sales chart's "view full report" button pushed
   `/reports`. That route has never existed. Now `/accounting`, which is what
   the navigation contract gives for revenue detail.
2. `permissions-view.tsx` — "manage members" pushed `/workspace`. Also never a
   route; `WorkspacePage` is exported from `packages/ui` but mounted nowhere.
   Now `/settings`, which is where workspace membership is actually managed.

**Regression guard:** `packages/ui/src/lib/menu/__tests__/no-dead-links.test.ts`
scans every shared component for literal `onNavigate`/`router.push` targets and
asserts each resolves to a nav-contract path or a known auth route. It includes
a self-check that the scan finds targets at all, so a regex that stops matching
cannot turn the file into a silent no-op.

---

## Verified-correct, deliberately not changed

Audited against the sale/purchase requirements and found already correct. Per
"verify → preserve → document", these were not rewritten:

| Area                           | Finding                                                                                                                                                  | Evidence               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Dashboard revenue vs purchases | `analytics.service.ts` splits `totalSales` from `totalPurchases`; legacy null-type invoices count as sales, preserving their original meaning            | CODE-VERIFIED          |
| Customer role                  | Derived from invoices, never from `customers.type` (which is cash/credit payment terms); `customerFiltersSchema` rejects `cash`/`credit`/`both` as roles | CODE-VERIFIED + tested |
| Invoice party column           | Web uses neutral «طرف حساب», with a source comment explaining that «خریدار» would be wrong on a purchase row                                             | CODE-VERIFIED          |
| Mobile invoice detail          | Already branches party label on type, and renders unit, unitLabel, weightGrams and nested details                                                        | CODE-VERIFIED          |
| Sync centre (desktop)          | Private implementation is correct — it inspects the Electron SQLite outbox over IPC, which the shared web sync page has no concept of                    | CODE-VERIFIED          |

## Share-link workflow (CODE-VERIFIED end to end)

```
mobile invoice detail
  → buildInvoiceShareUrl(WEB_BASE_URL, locale, id, publicToken)   [ui-contract]
  → https://<web>/{fa|af|en}/public-invoice/{token}
  → apps/web/app/[lang]/public-invoice/[token]/page.tsx           (outside the auth group)
  → PublicInvoiceContainer
  → GET /api/public/invoices/:token                               (token, never id)
```

Falls back to `/{lang}/invoices/{id}` for invoices predating the public-token
migration — the recipient is asked to log in, which is the pre-existing
behaviour, rather than getting no link. `buildInvoiceShareMessage` gives web and
mobile the same wording around it.

`WEB_BASE_URL` reads `EXPO_PUBLIC_WEB_URL` then `expoConfig.extra.webUrl`,
mirroring how `apiUrl` already resolves, so a staging build can retarget it. It
is the _web_ origin and deliberately not derived from the API base URL.

## Decisions

Recorded per §39 — where a platform diverges from web, what was preserved.

| Decision                                                                  | Reason                                                                                                                                                                | Preserved                                                                                     |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Mobile dashboard uses a hero card + tiles, not web's uniform 2×2 KPI grid | A phone shows one number at a glance; the hero treatment gives total sales the emphasis a sidebar-less layout otherwise loses                                         | Same four KPIs, same labels, same order, same navigation targets                              |
| Mobile recent-activities shows 5 rows, web shows 8                        | A touch row costs more vertical space than a table row; mobile adds "see all" into `/activities`, which web does not need because its sidebar entry is always visible | Same data, same sort, same copy keys, same tap target                                         |
| Mobile invoices renders cards, web renders a 9-column table               | Six-plus columns is unreadable at 390pt                                                                                                                               | Same fields in the same priority order; company omitted because it is empty on every platform |
| `/reports` → `/accounting` rather than building a reports route           | Least destructive: the destination already exists in the contract and holds revenue detail                                                                            | The button's intent — see the numbers behind the chart                                        |
| `/workspace` → `/settings` rather than routing `WorkspacePage`            | Routing it would need a new nav-contract entry on all three platforms; settings already manages the workspace                                                         | The button's intent — manage members                                                          |

---

## Remaining gaps

**Blocking full visual sign-off**

- No screenshot comparison is possible in this environment (see verification
  levels above). Every claim here is DOM- or source-level.

**Open work, in priority order**

1. Mobile dashboard chart has no date-range picker. P1.
2. Invoice detail, warehouse (+detail), customers (+detail), accounting: not yet
   audited on any axis. P1.
3. Desktop settings and login are private implementations. Settings is the
   riskier one — the shared `SettingsPage` reads `useAuthStore` from
   `@hisabche/store` while desktop has its own auth store, so mounting it is not
   a one-line swap. P2.
4. Desktop sync page labels its queue columns with unrelated keys
   (`t('accounting.title')` for the entity column, `t('sales.status')` for the
   operation column). Copy bug, not a parity bug. P3.
