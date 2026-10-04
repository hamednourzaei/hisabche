---
name: hisabche-feature-delivery
description: The end-to-end checklist for adding a capability — migration, pg test, service, route, hook, shared UI, three languages, guards, docs, three platforms. Use whenever a request says «add», «wire», «build» or names a Business-OS capability number.
---

# Delivering a capability

«Done» means a person can use it on the web, on Windows and on the phone, the
Supabase script exists, and every guard is green. A domain file with tests and
no caller is not a capability (CLAUDE.md §7.1).

## 0. Before writing anything

1. `grep` for the engine. Look in `backend/src/services/**/**.domain.ts` and in
   `backend/src/__tests__/unwired-capability.test.ts` — the register says what
   exists and is not wired, and why.
2. Find the screen it belongs on. **Prefer a section on an existing page over a
   new route.** A new route costs: `robots.ts`, `app-shell/app.tsx`, sidebar,
   `navigation.ts`, `nav-items.ts`, a docs article, an inbound link,
   `ROUTE_DOCS_MAP`. Six of the last seven capabilities needed none.
3. Find the existing core it must go through. Money → `InvoiceService.create` /
   payments core. Email → `email_outbox`. AI → `callProvider`. Never a second
   path.

## 1. Database (only if something must be stored)

See `hisabche-migrations`. Three files, always together:

```
docs/<name>-01-migration.sql
docs/VERIFY-<name>-01.sql
backend/src/__tests__/<name>.pg.test.ts
```

## 2. Backend

- **Service** in the folder of its domain, taking `TenancyContext`. Header
  comment: what it is, what it deliberately is not, the ⚠️ rules.
- Every query filters `workspace_id`. Ids named by the client (product,
  customer, supplier, employee) are checked against the workspace before use.
- `MISSING_SCHEMA` codes (`42703`, `42P01`, `PGRST202/204/205`, `42883`) →
  a `*_MIGRATION_PENDING` error with status **503**. Never an empty list.
- Error and empty are two branches. A read that warns or decides has no
  `.limit()`; use `selectAllPages` (rpc results too).
- Retire with `is_active = false`. No DELETE on tenant tables.
- Multi-table write → Postgres function + `.rpc()`. If the second step is an
  existing service (an invoice), use claim → act with a deterministic
  idempotency key (`sourceIdOf`) → mark. See lesson 100.
- Refusals are `UPPER_SNAKE` codes thrown as `ValidationError` /
  `ConflictError`; the client translates a closed list of them.
- Money: integers in the table (hundredths), the product's unit on the API,
  one conversion point (`minor()` from `utils/money`).
- **Route** file: comment table of paths and who may call each; role from
  `request.tenancy.role` via `requireRole`; body parsed with zod in the
  handler; register in `backend/src/index.ts`.
- A route that authenticates itself → `exactPublicPaths`. A route an API key
  must reach → `API_ROUTE_SCOPES`. A public route → the inventory in
  `storefront-orders.test.ts`.
- After a money change: `invalidateMoneyCaches(workspaceId)`.
- **Service test** with an in-memory `supabase` mock: another workspace's ids,
  missing table, retire-not-delete, the money direction, two currencies.
  Expected numbers worked out by hand in a comment.

## 3. Client

- **Hook** in `packages/api/src/hooks/`, exported from `index.ts`. URLs are
  literal templates (`client-route-contract`). Lists through `asList()`.
  A mutation invalidates every key it changes (`invoiceKeys`, `paymentKeys`,
  `dashboardKeys` for anything that issues an invoice).
- **Component** in `packages/ui/src/components/ui/<area>/`, `'use client'`,
  `useTranslations('<namespace>')`.
  - Closed list of translated error codes exported as a const; anything else →
    `errors.general`. Read errors with `apiErrorMessage()`.
  - Three different outputs for loading / failed / empty, and «not set up» is
    its own sentence.
  - `SelectField` (never `<select>`), `KpiCard`/`KpiGrid` for figures,
    `JalaliDatePicker` for dates, `useDateFormat()` and `formatNumber()` for
    display, `useLocalePush()` for navigation.
  - `animate-pulse` needs `motion-reduce:animate-none`. Tokens only, logical
    properties only (`ms-`, `text-start`).
  - Currency selector on every money field; the unit beside every quantity.
  - Heavy panels load when opened (`enabled: open`).
- Two places rendering the same thing → extract the renderer, do not copy.

## 4. Three languages

Keys in `fa`, `af`, `en` — `t()` throws on a missing key. Dari wording from
`.claude/DARI-GLOSSARY.md` (بل، اسعار، جنس، لست، متقاعد، حاضری، معاش، فیصدی،
راپور، کوشش). Add them with a node script (see `hisabche-scripted-edits`), and
fix any older sentence the new capability makes false («جریمه حساب نمی‌شود»).

## 5. Guards to update in the same change

| Guard                                                        | What to add                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `packages/ui/src/__tests__/business-os-screens-keys.test.ts` | a row per new component: file, prefix, every key                               |
| `backend/src/__tests__/unwired-capability.test.ts`           | flip the row to `WIRED` with an honest note, including what is still NOT wired |
| `robots.ts` + its two tests                                  | only for a new `(dashboard)` or public route                                   |
| docs: `DOCS_ARTICLES`, section keys ×3, inbound link         | a section on the related article is enough when there is no new page           |

## 6. Platforms

Shared UI in `packages/ui` reaches web, Windows and mobile at once. A **new
route** additionally needs the web page (`metadata` + `<XContainer />`, no
`'use client'`), the app-shell route, sidebar entry and navigation ids.

## 7. Prove it

- pg test green (run twice + VERIFY).
- Inject one fault into the rule you care most about and watch a test go red.
  Restore from your own backup copy, not `git checkout`.
- Then the full verify, lint and builds — see `hisabche-release-build`.
