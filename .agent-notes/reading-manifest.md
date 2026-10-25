# Reading manifest — sales documents (both agents)

This is the required reading order. Do not skip a pass. Do not reorder.
After each pass write a note in your own folder (`.agent-notes/agent-a/` or
`.agent-notes/agent-b/`) with: files read, facts proven, facts not proven,
deliberately skipped. Keep each note under 120 lines.

Working directory: `C:\Users\hamed\Desktop\hisabche`.

A fact is "proven" only when you can name the file and the line/symbol that
shows it. A document alone proves intent, not shipping.

---

## Pass 0 — orientation (read fully)

- `AGENTS.md`
- `CLAUDE.md` (long: read in ranges; the rules that matter for claims are §1, §2, §3)
- `README.md`
- `PROJECT_STATE.md`
- `.ai/codebase/CODEBASE_MAP.md`
- `documents/PRODUCT.md`
- `documents/DOMAIN_MODEL.md`

Note: `README.md` is short and stale. `PROJECT_STATE.md` and the code win.

## Pass 1 — product intent, flows, platform truth

- `documents/USER_FLOWS.md`
- `documents/PLATFORM_MATRIX.md`
- `documents/OFFLINE_SYNC.md`
- `documents/AUTH_AND_PERMISSION.md`
- `docs/PRODUCT_FEATURE_MATRIX.md` — **known stale**: it says the Windows app
  does not exist. Do not copy it; use it only to find gaps.
- `docs/offline/01-CAPABILITY-MATRIX.md` — the honest offline audit.
- `docs/offline/ALWAYS-LOCAL-DECISIONS.md` — what is local on purpose and why.
- `docs/offline/ALWAYS-LOCAL-00-FINDING.md`
- `.claude/POSITIONING-2026-09-15.md`
- `.claude/BUSINESS-OS-SPEC.md` (capability list; intent, not proof)

## Pass 2 — what a user actually sees: web

Read every dashboard page (30 files) under
`apps/web/app/[lang]/(dashboard)/*/page.tsx` and the nested `[id]` / `new` pages.
Read `apps/web/app/[lang]/(dashboard)/layout.tsx`.

Then the public surface:

- `apps/web/app/[lang]/page.tsx` (landing)
- `packages/ui/src/components/ui/landing/landing-page.tsx`
- `packages/ui/src/components/ui/landing/pricing-scene.tsx`
- `packages/ui/src/components/ui/landing/compare-scene.tsx`
- `packages/ui/src/components/ui/landing/modules-scene.tsx`
- `packages/ui/src/components/ui/landing/security-scene.tsx`
- `packages/ui/src/components/ui/landing/offline-sync-scene.tsx`
- `packages/ui/src/components/ui/landing/faq-scene.tsx`
- `packages/ui/src/components/ui/landing/trust-bar-scene.tsx`
- `apps/web/app/[lang]/signup/page.tsx` and its container
- `apps/web/app/[lang]/login/page.tsx`
- `apps/web/app/[lang]/(dashboard)/onboarding/page.tsx`
- `apps/web/app/[lang]/about/page.tsx`
- `apps/web/app/[lang]/legal/security/page.tsx`, `legal/privacy/page.tsx`

For the landing page, separate **what it claims** from **what the product does**.
A landing claim is not proof.

## Pass 3 — what a user actually sees: Windows and Android

- `packages/app-shell/src/app/app.tsx` — the authoritative route list (≈71 entries).
- `packages/app-shell/src/features/**/*.tsx` — one page per folder (45 files).
  Read the page wrapper and the container it renders; you do not need every
  component under `packages/ui`.
- `apps/desktop/electron/main/services/printing.ts` (receipt/invoice printing)
- `apps/desktop/electron/main/services/updater.ts` (updates)
- `apps/desktop/electron/main/services/local-api.ts` (local engine transport)
- `apps/desktop/electron/main/services/secure-store.ts` (where secrets live)
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/src/host/camera-scan.ts`, `camera-scan-overlay.tsx` (barcode)
- `apps/mobile/src/features/notifications/use-push-registration.ts`
- `apps/mobile/app.json`, `eas.json` (which platforms are actually configured)

Do not assume iOS ships because Expo can build it. If only Android artifacts and
scripts exist, iOS is `UNCLEAR` or `PLANNED`.

## Pass 4 — backend capability (what is really implemented)

Start with an endpoint inventory, not with reading 95 files whole:

```
Select-String -Path backend/src/routes/*.ts -Pattern "fastify\.(get|post|put|patch|delete)\(" |
  ForEach-Object { "$($_.Filename):$($_.LineNumber): $($_.Line.Trim())" }
```

Then read these route files fully (they carry the owner-visible capabilities):

`invoice.routes.ts`, `payments.routes.ts`, `pos.routes.ts`, `accounting.routes.ts`,
`inventory-costing.routes.ts`, `warehouse.routes.ts`, `cycle-count.routes.ts`,
`manufacturing.routes.ts`, `installments.routes.ts`, `customer.routes.ts`,
`product.routes.ts`, `purchasing.routes.ts`, `supplier.routes.ts`,
`human-resources.routes.ts`, `attendance.routes.ts`, `billing.routes.ts`,
`sync.routes.ts`, `conflict.routes.ts`, `audit.routes.ts`, `ai.routes.ts`,
`customer-portal.routes.ts`, `marketplace.routes.ts`, `storefront.routes.ts`,
`orders.routes.ts`, `branch.routes.ts`, `tax.routes.ts`, `currencies.routes.ts`.

Then the behaviour that decides the claims:

- `backend/src/services/invoice.service.ts` — create pipeline: stock, costing,
  ledger, numbering, reversal. Read the section headers and the public methods.
- `backend/src/services/accounting/profit-report.domain.ts` — profit, margin,
  `costStatus` (unknown ≠ zero).
- `backend/src/services/accounting/accounting.reports.ts` — trial balance,
  balance sheet, income statement.
- `backend/src/services/accounting/month-end.domain.ts` — month-end close.
- `backend/src/services/inventory-costing/costing.domain.ts` — FIFO/AVCO.
- `backend/src/services/payments/payments.domain.ts` — allocation, per-currency
  balances, FX gain/loss.
- `backend/src/services/plan-limit-defaults.ts` — plan ceilings (defaults are
  admin-configurable; describe, do not promise numbers).
- `backend/src/services/sync.service.ts`, `services/conflict/*` — what syncs.
- `backend/src/services/authorization/*` — roles and separation of duties.
- `backend/src/services/audit.service.ts` — activity trail.

For every capability, answer three questions: which screen calls it, which route
serves it, and what happens when the network is gone.

## Pass 5 — Persian wording (the product's own voice)

`packages/i18n/messages/fa/common.json` is ~670 KB. **Never read it whole.**
Use a node script to print:

1. top-level namespaces with leaf counts;
2. for the namespaces that matter, 10–20 sample strings each.

Namespaces to sample: `nav`, `dashboard`, `invoices`, `customers`, `warehouse`,
`accounting`, `reports`, `offline`, `sync`, `auth`, `billing`, `team`, `settings`,
`manufacturing`, `ai`, `till`, `approvals`, `audit`, `governance`, `onboarding`,
`landing`.

Then sample `packages/i18n/messages/af/common.json` for the same namespaces and
record only the places where Dari really differs (e.g. «فاکتور» vs «بل»,
«موجودی» vs «ذخیره»). Do not invent differences; quote what is there.

## Pass 6 — landing and promo copy, with its claims rule

- `hisabche-promo-reel/SCENARIOS.md` — read all of it. The table «قاعده‌ی ادعاها»
  is the product's own honesty contract. Every sales claim must survive it.
- `docs/VIDEO-PRODUCTION-WORKFLOW.md`
- `hisabche-promo-reel/src/reels/*.ts` — do not read 90 files. Extract titles and
  `vo` lines:
  `Select-String -Path hisabche-promo-reel/src/reels/*.ts -Pattern "title:|vo:"`
- `SAAS_MOTION_STANDARDS.md` (tone only)

Copy from here is evidence of **positioning**, not of shipping.

## Pass 7 — tests are behaviour

List test names; read only the ones that decide a sales claim.

```
Get-ChildItem backend/src,packages/ui/src,packages/api/src -Recurse -Filter *.test.ts* |
  Select-String -Pattern "^\s*(it|test)\(" | ForEach-Object { $_.Line.Trim() }
```

Read these fully (or their `describe` blocks):

- invoice reversal / cancel: search test names for `reverse`, `cancel`, `void`
- profit honesty: `unknown-is-not-zero`, `profit-report`
- offline queue and sync: `offline-queue`, `sync`, `conflict`
- permissions: `permission`, `rbac`, `separation`
- plan limits: `plan-limit`
- multi-currency: `currency`, `fx`, `exchange`
- inventory: `cycle-count`, `transfer`, `costing`
- printing: `print`

A test name proves the behaviour is guarded; it does not prove the screen exists.
Both are needed for `AVAILABLE`.

## Pass 8 — limits, admin, and the commercial shape

- `apps/admin/app/[lang]/(admin)/**/page.tsx` — list the pages, read `plans`,
  `workspaces`, `offline`, `billing` if present.
- `backend/src/services/admin/admin-billing.service.ts`
- `backend/src/services/plan-limits.service.ts`
- `docs/plan-limits-migration.sql` (what is configurable)
- `packages/app-shell/src/features/auth/offline-licence-screen.tsx` and
  `offline-license.ts` (the offline edition needs a licence code)
- `packages/app-shell/src/features/billing/billing-page.tsx`

## Pass 9 — gaps and honesty

- `docs/feature-audit/unknown-features.md`
- `.claude/USER-REQUESTS.md`
- `.claude/TASKS-UI-AND-PRODUCT.md`
- `.claude/BUG-REGISTRY.md` (open bugs that would embarrass a sales claim)
- `docs/qa/deep-audit-2026-10-14.md` (if it lists known gaps)
- Search for `TODO`, `FIXME`, `coming soon`, `به‌زودی` in user-facing folders:
  `packages/ui/src`, `apps/web/app`, `packages/app-shell/src`.
  A "coming soon" is `PLANNED`, never `AVAILABLE`.

---

## Known traps (verify, do not copy)

1. **Offline is not one thing.** The browser has no offline queue. Windows and
   Android can queue invoice creation and read products, customers, invoices,
   warehouses, branches, rates and stock from the device. Payments and the ledger
   stay on the server by design. There is also a separate licensed "offline
   edition" with no server. State the platform and the limit every time.
2. **Prices are live.** `GET /api/billing/plans` feeds the landing page. Never
   write a number. A free plan exists; its ceilings are configurable defaults.
3. **`documents/PRODUCT_FEATURE_MATRIX.md` is stale.** The Windows app exists.
4. **A route file is not a shipped screen.** Check the screen calls it.
5. **A landing-page sentence is marketing, not proof.**
6. **Do not claim "without a bank card"** unless the signup flow proves it.
7. **Do not claim encryption, certifications or backups** unless a file proves
   the mechanism (e.g. an export/backup route and its test).
8. **No currency anywhere.** `{قیمت}` only.
9. **AI is an assistant with a monthly quota**, not an autonomous accountant.
10. **Manufacturing, payroll, marketplace and storefront exist** but may be
    partial; verify each screen and each limit before you call them AVAILABLE.

## Banned technical words (customer-facing files)

English: code, API, database, DB, server, backend, frontend, framework, library,
React, Next.js, Electron, Supabase, Expo, Node, Zod, Tailwind, SDK, schema, repo,
repository, endpoint, JSON, SQL, Postgres, Docker, Git, TypeScript, JavaScript,
HTML, CSS, npm, pnpm, monorepo, cache, localStorage, WebSocket, IPC, CRUD, SaaS.

Persian equivalents: پایگاه داده، دیتابیس، سرور، بک‌اند، فرانت‌اند، ای‌پی‌آی،
فریم‌ورک، کتابخانه (در معنای فنی)، معماری، ریپازیتوری، اندپوینت، اسکیما،
سینتکس، کامپوننت، کش.

Exception: «کد کالا» / «کد فاکتور» are business words and are allowed.
