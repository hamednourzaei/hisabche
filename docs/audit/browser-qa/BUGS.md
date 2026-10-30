# Browser QA — a normal user's walk through Hisabche (web, en)

Session: 2026-10-28, logged in as the owner's own account (the owner signed in himself; the
agent never entered credentials). Browser tab walked route by route from onboarding into the
app, then every hub and tab. Nothing was created, edited or deleted during the walk; dialogs
were opened and cancelled. The one write that did happen was the onboarding flow itself, which
the agent completed to reach the app (business type Retail, size Small Store, currency AFN).

Evidence rule: every value quoted below was read from the live UI or from the live network log
of that page. No aggregate metric is claimed in this file.

---

## P0 — a normal user cannot finish the job

### B1. The API rate limit counts CORS preflight, so ordinary navigation returns 429

- Seen on: every page after ~4–6 page views in a minute.
- Console: `Failed to load resource: 403` earlier in the session, then
  `429` on `GET /api/auth/me`, `GET /api/governance/my-capabilities`,
  `GET /api/v1/notifications`, `GET /api/billing/subscription`, `GET /api/employees`,
  `GET /api/finance/currency/base`, `GET /api/workspaces`.
- Network: `OPTIONS /api/branches → 429`, then `GET /api/branches → net::ERR_FAILED`.
  Same pair on `/api/products`, `/api/invoices`, `/api/customers`, `/api/pos/sessions/open`,
  `/api/developer/keys`, `/api/boms`, `/api/work-orders`, `/api/cycle-counts`,
  `/api/inventory/reorder-suggestions`, `/api/permissions/matrix`, `/api/v1/activities`.
- What the user sees: the page renders its shell and then stops — `/operations` stays on
  «Searching…», `/marketplace` on «Loading…», `/billing` and `/stock-count` on an empty body.
- Cause (code): `backend/src/index.ts` registers `@fastify/rate-limit` globally with
  `max: 100 / 1 minute` and no `allowList`; the plugin hooks `onRequest`, so the `OPTIONS`
  preflight that `@fastify/cors` answers is counted against the same 100 as the real call.
  Every page fires 10–20 requests, each with a preflight, so ~4 page views exhaust the budget.

### B2. A failed read renders as «you have no data», not as an error

- Seen on `/customers` while its requests were failing: `Total sales 0 · Customers 0 ·
Total Debt 0 · Top customer — · No customers yet`, in the same minute the dashboard said
  `Owed by customers 130,000` and `1 sales invoices are not fully paid yet`.
- `/operations` shows a permanent «Searching…» row and `/marketplace` a permanent «Loading…»
  when their single request fails.
- This is the repository's own rule (AGENTS §3: «Error and empty are two branches») broken on
  screen: a failed read is indistinguishable from an empty business.

### B3. `/invoices` shows «No invoices found» before it shows the invoices

- One load, sampled every ~50 ms: `No invoices found / No invoices have been recorded yet`
  (three samples), then `All · Sale · Purchase` tabs, then a blank main, then 21 invoices
  (`Total amount 593,751,872 · Invoice count 21 · Awaiting payment 130,000`).
- A user who looks at the screen in the first second is told their invoices do not exist.
- Root: the empty state is rendered while the list query is still loading (no `isLoading`
  branch in front of it).

---

## P1 — the screen is wrong or a core action is blocked

### B4. Validation shows a raw translation key: `customer.nameRequired`

- `/customers → Add New Customer → Save` with an empty name.
- The dialog prints `customer.nameRequired` in red under the name field.
- The bundle key is `customers.form.nameRequired`; the zod schema in
  `packages/ui/src/components/ui/customers/AddCustomerModal.tsx:32` uses the singular
  `customer.nameRequired`, so `t()` cannot resolve it.

### B5. The invoice builder labels its own inputs in Persian while the UI is English

- `/invoices/new`: header row reads `Qty`, `Unit`, `Unit price`; the inputs inside those
  columns are announced as `تعداد`, `واحد`, `قیمت واحد`.
- Cause: `packages/validation/src/schemas/invoice-grid.ts` gives each column a `labelKey` and a
  Persian `label` fallback; `grid/grid-cell.tsx` uses `aria-label={column.label}` (the Persian
  fallback) instead of translating `labelKey` the way the header does.

### B6. Currency names appear in Persian inside the English UI

- Onboarding, Default Currency step: `🇦🇫 افغانی`, `🇮🇷 ریال ایران`, `🇵🇰 روپیه پاکستان`, …
  while the step title and buttons are English.
- Dashboard: `افغانی — your books' currency` next to `1 دستگاه لندکروز = 40,000,000 Afghan afghani`.
- The currency label is resolved from the Persian name list regardless of the interface locale.

### B7. Persian digits, Persian dates and the Persian percent sign inside the English UI

- `/customers`: `Top customer مشتری تست · ۵۰۳٬۶۲۱٬۰۵۲ AFN`, last-purchase `۱۴۰۵/۰۸/۰۶`,
  while the KPI above it prints `503,621,052`.
- `/operations`: `گیربوکس اتوماتیک ‎−۳ ۵٫۳۲ ۸٫۳۲` and `شلنگ رادیات ۰ ۳٫۰۸`.
- `/stock-count`: `Net loss ۰`.
- Invoice detail: `Invoice Info Date: ۱۴۰۵/۸/۶` on the same card as `Created At 10/28/2026, 11:42 AM`.
- `/invoices/new`: `Tax (%) ٪`; dashboard: `Total: 130,080, -100.0٪ from previous period`.

### B8. A core action is disabled with a reason that is not true

- `/team-and-payroll` on a cold load: `Add employee` is `disabled`, tooltip
  «Add a branch first — every employee belongs to one.», and the page says
  «No employees yet — Add your first employee to start managing the team.»
- The Branches tab lists three branches (`شعبه آزمایش BR-77`, `saadat abad sat`,
  `hassan abad ss-23`). After opening the Branches tab and coming back, `Add employee`
  becomes enabled with no other change. The first visit therefore blocks the payroll flow
  on a false precondition.

### B9. Onboarding repeats and drops a choice

- Business Type step: clicking `Retail` advances immediately and the industry list
  (`Grocery and supermarket`, `Bakery`, …) is never reachable in that pass — the choice is
  silently dropped. Same auto-advance on Store Size.
- `Next` stays disabled on those single-choice steps, so the only way forward is the card
  click that skips the list.
- There is no «Step X of Y» anywhere in the flow.
- Final step prints the answers in Persian while the UI is English:
  `Business Type خردهفروشی · Size دکان کوچک · Currency AFN`.
- `Enter Hisabche` left the tab on `/en/onboarding` showing step 1 «Welcome to Hisabche»
  again; the app was only reachable by typing `/en/dashboard`.
- A completed business visiting `/en/onboarding` again gets step 1, not a redirect.

---

## P2 — visible, but not blocking

### B10. «1 conflicts», «1 sales invoices are»

- Dashboard: `1 conflicts waiting for a decision` and `1 sales invoices are not fully paid yet.`
- Both are singular nouns with a plural verb/noun — the count is not run through plural rules.

### B11. Every KPI on the invoice and customer hubs says «100% vs last month»

- `/invoices`: `Total amount … 100% vs last month`, `Invoice count 21 100% vs last month`,
  `Awaiting payment … 100% vs last month`, `Paid … 100% vs last month`.
- `/customers`: all four KPI cards the same.
- `/till`: `Total received today 0 -100% vs. yesterday` when both today and yesterday are 0.

### B12. Till balance contradicts the formula printed beside it

- `/till → صندوق تست`: `Balance recorded in the system 211,835,580`, `Opening float 500 AFN`,
  `Gross sales 0 AFN`, and the page's own sentence
  «Recorded balance = opening float + cash in − cash out, as recorded by the system.»

### B13. Warehouse headline total mixes units

- `/warehouse`: `Total value AFN 75,000,150` followed by
  `Afghani: 75,000,150 · US dollar: 1,153,848 · دستگاه لندکروز: 2`.
- The headline is AFN while the breakdown lists a USD amount and a custom unit as if they
  were the same measure.

### B14. Expiry report contradicts its own list

- `/warehouse?tab=expiry`: `Fresh 0 · Unhealthy 23 · Value of expired stock 0 AFN ·
Nearest expiry None`, and directly under it three rows
  `Expired OPEN-2026-10-18 halakoi 10 08/22/2026 -67`, `… 8 09/19/2026 -39`,
  `… 5 10/22/2026 -6`.

### B15. Breadcrumb prints the route slug

- `/sync-center`: the breadcrumb reads `Today sync-center` (also the page `<title>` is
  `Sync Center | Hisabche`, so only the crumb is wrong).

### B16. `/audit` is a 404 in Persian on an English route

- `https://hisabche.com/en/audit` → `<title>صفحه پیدا نشد — حسابچه</title>`,
  `<h1>این صفحه پیدا نشد</h1>`, body `This page could not be found.` with a Persian button
  `رفتن به داشبورد`.
- The desktop shell has an `/audit` route (`packages/app-shell/src/app/app.tsx:131`); the web
  app has no `apps/web/app/[lang]/(dashboard)/audit` folder.

### B17. `/governance` renders two `<h1>`s

- `H1: Governance` and `H1: Awaiting Your Approval` on the same page (the approvals screen is
  embedded with its own page title).

### B18. An internal ops note is shown to the customer

- `/developers` (and Settings → Integrations): «The website storefront is not set up on the
  server yet (the third database script has not been run).»

### B19. Add New Customer defaults the phone country to +98

- The dialog opens with `🇮🇷 +98` on a business whose books currency is AFN; the existing
  customer's phone is `+98123`.

### B20. First paint is blank for seconds

- `/invoices`: main text was 44 characters for the first ~1 s, then the false empty state,
  then the list at ~4 s.
- `/billing`: 44 characters for 4.25 s, then content.
- No skeleton is shown while this happens; the tab bar is the only thing on screen.

---

## What was checked and looked correct

- `/invoices` list (21 rows, 3 pages), row → detail navigation, detail totals
  (`Subtotal 130,000 · Total Due 130,000 · Remaining 130,000`), Share menu
  (`WhatsApp · Telegram · Email · More · Copy link`), `Add payment` inline form
  (amount prefilled 130,000, date 2026-10-28, method, till, fee, reference).
- `/accounting`: trial balance is in balance (`Total debit 2,049,943,979 = Total credit`,
  `Difference: 0`), `Assets & bank`, `Reports`, bank-statement import form.
- `/customers`: list, `Follow-up & campaigns` tab (empty state `No interactions recorded`).
- `/warehouse`: stock table, `Expiry`, `Add warehouse`, per-warehouse rows.
- `/analysis`: Money / Market / Report builder tabs all render with their own empty states.
- `/approvals`: empty state `Nothing is waiting for your approval`; `Workflows` tab.
- `/manufacturing`: BOM list, `Records` tab with a production row.
- `/data-and-sync`: 1 open conflict (`شلنگ رادیات`, differing fields 2, Financial) with a
  `Review conflicts` action.
- `/billing`: plan, usage, cancel-scheduled warning; `Wallet & referrals` tab with honest
  empty states.
- `/assistant`, `/marketplace`, `/market-seller`, `/settings` (General + Integrations),
  `/activities` (10 rows, counts 77 / 8 / 44 / 23 / 3).
