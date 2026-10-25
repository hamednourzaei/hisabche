# Pass 2 — what a user sees: web

## Files read

- All 29 `apps/web/app/[lang]/(dashboard)/**/page.tsx` (one batch; thin
  metadata + shared container).
- `apps/web/app/[lang]/page.tsx` → `LandingPage`; `packages/ui/.../landing/landing-page.tsx`
- `landing/modules-scene.tsx`, `security-scene.tsx`, `offline-sync-scene.tsx`,
  `compare-scene.tsx`, `trust-bar-scene.tsx` (full)
- `landing/pricing-scene.tsx` (grep: `usePlans`, price states — not whole file)
- `apps/web/app/[lang]/signup/{page,SignupClient,layout}.tsx`, `login/{page,LoginClient}.tsx`
- `packages/ui/src/components/ui/auth/containers/auth-container.tsx` (schema + flow)
- Hub containers: `sales-hub-container.tsx`, `warehouse-tabs-container.tsx`,
  `customers-hub-container.tsx` (tab arrays + comments)

## Facts proven

- Web has these owner screens (page files exist): dashboard, invoices (list /
  new / preview / [id]), warehouse (list / [id]), customers (list / [id]),
  accounting, till, stock-count, operations, analysis, activities, approvals,
  manufacturing, team-and-payroll (+[id]), audit is **not** a web page (shell
  only), governance, billing, settings, onboarding, data-and-sync, sync-center,
  assistant, marketplace, market-seller, developers.
- Public web surface exists: `public-invoice/[token]`, `public-task/[token]`,
  `portal/[token]`, `my-attendance/[token]`, `market/[seller]/[listing]`,
  `feedback/[token]`, `oauth/authorize`.
- Hubs: Sales = invoices + pricing; Warehouse = stock + expiry; Customers =
  customers + outreach (`SALES_HUB_TABS`, `WAREHOUSE_HUB_TABS`, `CUSTOMERS_HUB_TABS`).
- Signup asks: full name, business name, email, password ≥ 8
  (`auth-container.tsx` `signupSchema`). Comment: signup creates a workspace with
  the owner role. No card field in the form.
- Landing prices are read live from `GET /api/billing/plans` (`usePlans` in
  `pricing-scene.tsx`); the file's own comment says the hardcoded price was
  removed so a stale number cannot be shown. A free plan exists.
- Landing trust section was deliberately corrected: the comment at
  `trust-bar-scene.tsx:41` says «Trusted by every type of business» was replaced
  because nothing knows that; the list is business _types_, not customers.
- `security-scene.tsx:32-38`: 2FA, "30-day restore" and "only you hold the key"
  were **removed** because nothing implements them. Four pillars remain:
  isolation, roles, separation of duties, audit trail.
- `compare-scene.tsx`: no competitor is named; rows compare "old way" vs product.

## Facts not proven

- Whether the web `audit` screen exists — it does not (no page file; shell only).
- Landing claims about backup ("نسخه پشتیبان") — the backup route must be proven
  in Pass 4/8 before any customer sentence mentions it.
- Signup → trial/plan assignment: not read end-to-end; do not claim a trial.

## Deliberately skipped

- `pricing-scene.tsx` full body (27 KB) — only the price-source and free-plan
  states matter; no numbers are copied into the sales file.
- `chapter-scene.tsx`, `journey/*`, `transform-scene.tsx`, footer — layout.
- `about`, `legal/*`, `docs`, `blog`, `contact`, `features/[slug]` — not
  capability-bearing for this file (legal/security read in Pass 8 only if needed).
- 29 page files' metadata strings — the Persian text is read from i18n in Pass 5.
