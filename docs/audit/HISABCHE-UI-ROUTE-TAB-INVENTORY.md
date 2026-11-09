# Hisabche — UI Route, Page and Tab Inventory

Audit date 2026-11-08, commit `b546d5df`. Platforms: **Web** = `apps/web` (Next.js); **Windows** = `apps/desktop` hosting `packages/app-shell`; **Android** = `apps/mobile` WebView over the same `app-shell` (`apps/mobile/src/host/shell-webview.tsx`). No UI was rendered in this audit, so coverage below is "route exists in code", not "screen works".

## 1. Counts (FACT)

| Item                                     |                            Count | Evidence                                                                                                        |
| ---------------------------------------- | -------------------------------: | --------------------------------------------------------------------------------------------------------------- |
| Web `page.tsx` total                     |                               67 | `find apps/web/app -name page.tsx`                                                                              |
| Web dashboard pages `(dashboard)`        |                               30 | `apps/web/app/[lang]/(dashboard)/**/page.tsx`                                                                   |
| Web public pages                         |                               37 | landing, blog (6), docs (2), legal (10), auth (4), market (3), token pages (5), features, about, contact, oauth |
| App-shell dashboard routes               |                               30 | `packages/app-shell/src/app/app.tsx:111-146`                                                                    |
| App-shell token routes                   |                                4 | `app.tsx:148-151` (public-task, public-invoice, portal, my-attendance)                                          |
| App-shell legacy redirect routes         |                   28 + catch-all | `app.tsx:156-207`                                                                                               |
| Web legacy redirects (`moved`)           |                         28 pairs | `apps/web/next.config.js:90-123` (CLAUDE.md §0.6 still says 27 — doc drift)                                     |
| Primary navigation items                 |                               17 | `packages/ui-contract/src/navigation.ts:84-292`                                                                 |
| Quick actions                            |                                6 | `navigation.ts:362-402`                                                                                         |
| Mobile bottom tabs                       | 3 (`today`, `get-paid`, `stock`) | `navigation.ts:332`                                                                                             |
| Hub containers using `PageHub`/`HubTabs` |                         14 files | `packages/ui/src/components/ui/**` (list in §3)                                                                 |
| Top-level hub tabs                       |                               24 | §3                                                                                                              |
| Sections behind a `?view=` switch        |                              ≈30 | §3                                                                                                              |
| Admin app pages                          |                               26 | `apps/admin/app/[lang]/(admin)/**`                                                                              |

## 2. Dashboard routes × platforms (FACT)

All 30 web dashboard routes have a matching `app-shell` route (guard named in CLAUDE.md: `route-parity.test.ts`, which ran inside the green `packages/ui` suite this session). Android inherits app-shell.

| Route                                                           | Web |        Windows         | Android |            In nav?             |
| --------------------------------------------------------------- | :-: | :--------------------: | :-----: | :----------------------------: |
| /dashboard                                                      |  ✓  |           ✓            |    ✓    |               ✓                |
| /invoices, /invoices/new, /invoices/new/preview, /invoices/[id] |  ✓  |           ✓            |    ✓    |               ✓                |
| /warehouse, /warehouse/[id]                                     |  ✓  |           ✓            |    ✓    |               ✓                |
| /customers, /customers/[id]                                     |  ✓  |           ✓            |    ✓    |               ✓                |
| /accounting                                                     |  ✓  |           ✓            |    ✓    |               ✓                |
| /activities                                                     |  ✓  |           ✓            |    ✓    |               ✓                |
| /approvals, /governance                                         |  ✓  |           ✓            |    ✓    |               ✓                |
| /settings                                                       |  ✓  |           ✓            |    ✓    |               ✓                |
| /till                                                           |  ✓  |           ✓            |    ✓    |               ✓                |
| /data-and-sync                                                  |  ✓  |           ✓            |    ✓    |               ✓                |
| /team-and-payroll, /team-and-payroll/[id]                       |  ✓  |           ✓            |    ✓    |               ✓                |
| /manufacturing, /billing, /market-seller, /analysis, /assistant |  ✓  |           ✓            |    ✓    |               ✓                |
| /sync-center                                                    |  ✓  | ✓ (device outbox page) |    ✓    |               —                |
| /developers, /marketplace                                       |  ✓  |           ✓            |    ✓    | — (reached from settings tabs) |
| /operations, /stock-count, /audit, /onboarding                  |  ✓  |           ✓            |    ✓    |               —                |

Web-only by design (no app-shell route): `/accept-invite`, `/oauth/authorize`, `/feedback/[token]`, all marketing/legal/blog/docs/market pages. INFERENCE: a desktop/mobile user who receives an invite link must open it in a browser.

## 3. Hubs, tabs and sections (FACT)

| Hub (route)                     | Tabs                                           | Sections (`?view=`)                                                                                                            | Evidence                                                           |
| ------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| /invoices                       | invoices, pricing                              | —                                                                                                                              | `invoices/containers/sales-hub-container.tsx:44`                   |
| /customers                      | customers, sessions, outreach                  | followUp, campaigns, stale                                                                                                     | `customers/containers/customers-hub-container.tsx:59,65`           |
| /warehouse                      | stock, expiry                                  | warehouses, products, shelfMap, reorder, deadStock                                                                             | `warehouse/containers/warehouse-tabs-container.tsx:91,100-106`     |
| /accounting                     | books, treasury, reports                       | accounts, journal, monthEnd · bank, assets, financing (loans, holdings) · trialBalance, balanceSheet, incomeStatement, budgets | `accounting/AccountingPage.tsx:46-55`; `tabs/FinancingTab.tsx:63`  |
| /approvals                      | requests, workflows                            | —                                                                                                                              | `workflow/containers/approvals-hub-container.tsx:36`               |
| /governance                     | approvals, permissions                         | —                                                                                                                              | `governance/containers/governance-hub-container.tsx:33`            |
| /billing                        | plan, money                                    | wallet, referrals                                                                                                              | `billing/containers/billing-hub-container.tsx:69`                  |
| /data-and-sync                  | overview, details                              | status, sync, conflicts, migration                                                                                             | `data-and-sync/containers/data-hub-container.tsx:62,70`            |
| /team-and-payroll               | team, pay                                      | employees, branches · attendance, timesheets                                                                                   | `team-and-payroll/containers/team-and-payroll-container.tsx:94-96` |
| /settings                       | general, developers, integrations, marketplace | —                                                                                                                              | `settings/settings-hub-container.tsx:67`                           |
| /activities                     | —                                              | activity, audit                                                                                                                | `activity/ActivitiesPage.tsx:52`                                   |
| /analysis                       | — (one switch, ~10 analyses)                   |                                                                                                                                | `analysis/analysis-container.tsx`                                  |
| /customers/[id], /manufacturing | detail tabs                                    |                                                                                                                                | `customer-detail-view.tsx`, `manufacturing-view.tsx`               |

`PAGES_WITH_TABS` (tab customiser) lists only 7 hubs (`settings/pages-and-tabs-settings.tsx:34-42`): invoices, customers, warehouse, accounting, approvals, billing, data-and-sync. **FACT:** governance, team-and-payroll and settings have tabs but are not in this list. INFERENCE: users cannot hide tabs on those three hubs; may be intentional — NEEDS_OWNER_DECISION.

## 4. Legacy URLs (FACT)

28 pairs in `apps/web/next.config.js:90-123` and the same set as `<Navigate>` in `app.tsx:156-205` (e.g. `bank → accounting?tab=treasury`, `orders → settings`, `purchasing → invoices?type=purchase`). `orders → settings` points to a page that no longer exposes orders: the orders API is still registered with 7 routes and no caller (core #35).

## 5. Status

- Route parity web ↔ shell: IMPLEMENTED_NOT_LIVE_VERIFIED (guarded by source tests; no rendering done).
- Android visual parity: BLOCKED_EXTERNAL locally (release build blocked on this machine after the 31 Oct Defender cleanup; brief).
