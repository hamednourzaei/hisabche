> **SUPERSEDED by FIFTY-OPTIONS-RANK4-PROMPT.md** (menu-aware, anti-duplicate protocol, rank-4 wave order). Do not execute this file.

# Hisabche — Implement the 50 options, without creating a single duplicate

You are the implementation agent. **Read first, in this order:** `FIFTY-OPTIONS-AUDIT.md` (the specification: for each of the 50 options it says whether the code already has it, what to extend, and the exact folder it belongs in) → `WIRE-IT-UP-MASTER-PROMPT.md` §3 (the 10-link chain every capability must complete) → `CLOSE-ALL-GAPS-PROMPT.md` §1 (decisions already made — do not re-ask) → `CLAUDE.md`. This file adds only order, anti-duplicate rules and acceptance.

## 0. Rules

- No commit, no push, no subagents. No live DDL: migrations are `docs/*.sql` files with a rollback block, a `VERIFY-*.sql`, and a `*.pg.test.ts` that applies them **twice**; report `PENDING HUMAN CONFIRMATION`.
- **Search before you create.** Before any new table, service, route, hook, component or constant: search `docs/*.sql`, `backend/src/services`, `packages/validation/src/schemas`, `packages/local-engine/src/routes` and `packages/ui/src/components/ui` for the **concept** (not only the name). If something owns it, extend it. Record the search in the log.
- **One table per entity; one owner per table.** A second table for the same concept is a defect even if it is "cleaner".
- Money moves only through `InvoiceService`, `PaymentsService`, `ledger.postDocument`. No extension module writes a financial table or computes tax, cost or totals itself.
- Pure rules live in `packages/validation` and are imported by the backend **and** the local engine. Import golden vectors by direct module path.
- Additive migrations only; no backfill of guessed data; `workspace_id` on every row; `REVOKE ALL … FROM service_role` before grants; `IS NOT NULL` in CHECKs.
- A new capability is a tab or section of an existing hub (`PageHub`/`HubTabs`), not a route, unless unavoidable. `DataTable`, `SelectField`, `SegmentedControl`; tokens only; RTL-logical classes. Every string in `fa`, `af`, `en`.
- Every new endpoint gets an `offline-endpoint-matrix.ts` row; every new write route gets a `concurrency-safety-map.ts` entry; every new header goes in `allowedHeaders`.
- No `any`, `@ts-ignore`, `eslint-disable`, dead code. Honest labels only: `VERIFIED_COMPLETE`, `IMPLEMENTED_NOT_LIVE_VERIFIED`, `BLOCKED_EXTERNAL_CREDENTIAL`.
- Machine traps: `TEMP`/`TMP` → `.pgtest/tmp`; backend tsc with `NODE_OPTIONS=--max-old-space-size=6144`; suites sequentially; never run pip-made `.exe`.
- Preserve the approved uncommitted work in the tree; read a diff before touching a file.

## 1. Step zero — stop the duplication that already exists (before anything else)

1. In the in-flight `universal-core` bundle, **delete** (rule, route, service method, hook, UI, engine route/table, migration DDL, tests):
   - `pack_barcodes` → use `product_barcodes.unit` + `toBaseQuantity` (option 15).
   - `product_serials` → use `stock_serials` / `stock_batches` / `services/traceability` (options 12, 18, 25).
   - `vehicle_units` → replace by `vehicle_attributes(serial_id → stock_serials.id, make, model, year, colour, odometer)`.
2. **Split** `universal-core.service.ts` (748 lines), `universal-core.routes.ts` (483 lines), `packages/api/src/hooks/universal-core.ts`, `packages/local-engine/src/routes/universal-core.ts` and `universal-core-sections.tsx` by domain into the folders of `FIFTY-OPTIONS-AUDIT.md` §3. No file named `universal-core*` may remain in `services/`, `routes/`, or engine `routes/`.
3. Re-audit `docs/universal-core-migration.sql` against `traceability-migration.sql` and `product-barcodes-migration.sql`; remove duplicated DDL; keep one migration per domain if that matches the repository's `docs/*-migration.sql` habit.
4. Reset `SCHEMA_VERSION` handling: the bundle added v9; keep a single v9 for all unreleased engine tables, with an upgrade test on a copy of a real device DB (v8 → v9, run twice).
5. Put every `business-capabilities.ts` entry back to `planned` unless its whole chain (§3 of the wire-it-up prompt) is complete; add the guard test "an `available` capability must name a consumer outside `packages/validation` and a server-vs-engine parity test" and inject-test it.
6. Correct the wrong claims (`FIFTY-OPTIONS-AUDIT.md` §0) in `scripts/industry/coverage-data.mjs`, `UNIVERSAL-CORE-GAP-ANALYSIS.md` and `RANKING-MODEL.md`; regenerate both generators; both `--check` green.

Nothing in §2 starts until step zero passes `tsc` + the validation and local-engine suites.

## 2. The 50 options — grouped by workstream, in execution order

For each row the action is the verdict from the audit. "Chain" means the 10 links of `WIRE-IT-UP-MASTER-PROMPT.md` §3 (rule → migration+pg test → server → engine → parity → hook → UI → consumer proof → flip → verdict). **EXISTS** rows need verification only. Where a row says "online-only", add the `online_required` matrix row and `<CloudRequiredNotice />`, and say why.

### W1 — Verify what exists (no new code unless a test fails)

| #   | Do                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | Run `GET /api/accounting/cash-flow` on a fixture with two currencies; confirm method and sign; add a test if none                                                     |
| 10  | Confirm `match-learning` is used by the suggestion route; test that a learned bonus raises but never reconciles                                                       |
| 15  | Prove: scan a barcode with `unit = 'carton'` adds the carton factor through `toBaseQuantity`, on server **and** engine, offline. If the engine ignores `unit`, fix it |
| 31  | Open `ui/conflicts` against a real conflict fixture; add the missing test if absent                                                                                   |
| 48  | Confirm audit rows are append-only (trigger) and exportable; list the gap to tamper-evidence in the log                                                               |

### W2 — Accounting and tax (extend what is there)

| #   | Do                                                                                                                                                                                                                                                                                                                                                            | Where                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | Add an irreversible **hard lock**: column `hard_lock boolean` on the period-lock row (additive), refuse reopen and exceptions when set, audit event, engine honours it                                                                                                                                                                                        | `governance.routes.ts`, `accounting.service.ts#setPeriodLock`, `local-engine/src/routes/accounting.ts` |
| 3   | Move `services/tax/tax.domain.ts` pure rules to `packages/validation/src/schemas/tax.domain.ts` (re-export the old path, as budgets did); the engine computes tax with it at invoice time offline; change `GET /tax/return` from `online_required` to `available` only if the engine can produce it from local data, otherwise keep it online with the notice | `tax/`, engine `invoices.ts`, matrix                                                                   |
| 4   | **Build** deferral: `DeferralSchedule` (invoice line + start/end dates + deferral account), a pure `spread()` rule in validation, a service that posts one reclass entry then periodic recognition via the existing scheduler/automation tick and `ledger.postDocument`                                                                                       | `services/accounting/deferral.*`, `automation`                                                         |
| 6   | **Build** recurring journal templates as one new `EXECUTABLE_ACTIONS` member (`post_journal_template`) with its branch in `automation.service`; template table `journal_templates`; uses `ledger.postDocument`                                                                                                                                                | `services/automation`, `accounting`                                                                    |
| 9   | **Build** expense claims: `expense_reports` + `expense_lines` (receipt via the existing attachment/ingest path), submission through `workflow/approval-gate`, reimbursement through `PaymentsService`, posting through `ledger.postDocument`; a section of the HR hub                                                                                         | `services/human-resources` (or a sibling `expenses/`), `workflow/`                                     |
| 5   | Extend purchasing: link a purchase invoice to PO + receipt lines; a pure `threeWayMatch()` in `purchasing.domain.ts` returning `matched                                                                                                                                                                                                                       | quantity_variance                                                                                      | price_variance`; refuse or warn per a workspace setting (default **warn**) | `purchasing.service`, `purchasing.domain` |
| 2   | **Build** consolidation (greenfield): `workspace_groups` + `intercompany_links`, read-only consolidated statements reusing `accounting.reports`, eliminations posted as ordinary entries in a dedicated group workspace. Large; ships behind its own capability and is allowed to finish as `IMPLEMENTED_NOT_LIVE_VERIFIED`                                   | new `services/consolidation/`                                                                          |
| 8   | **Skip.** Record in the log: budgets with distribution and the cash forecast already cover it                                                                                                                                                                                                                                                                 | —                                                                                                      |

### W3 — Inventory, trade, traceability (extend the existing tables)

| #   | Do                                                                                                                                                                                                                                                                                        | Where                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 12  | Call the existing traceability consume/plan path from `InvoiceService.create` (and the engine mirror): a sale line may carry serial(s) or a batch plan (FEFO default, manual override); refuse a sold serial online **and** offline; return restores `in_stock` (the release path exists) | `invoice.service.ts`, `traceability.service.ts`, engine `invoices.ts`, invoice-builder row picker |
| 20  | Roll = a `stock_batches` row measured in metres; partial sale consumes `remainingQty`; optional per-batch factor column (additive) used instead of the fixed product factor when present                                                                                                  | `traceability`, `unit-conversion.domain`, engine                                                  |
| 11  | Variants (keep the in-flight `product_variants`): relocate to `services/inventory/variants.*`; template not sellable; stock per variant per warehouse; barcode per variant through `product_barcodes`; invoice grid selects a variant; engine parity                                      | `inventory/`, invoice-grid in validation                                                          |
| 14  | Kits: add `kind: 'kit'` to the manufacturing BoM; selling a kit explodes to components at sale (no production order); one pure `explodeKit()`                                                                                                                                             | `manufacturing.service.ts`, invoice rule                                                          |
| 13  | **Build** landed cost: `landed_costs` allocated over received lines by quantity / value / weight / volume (pure `allocateLandedCost()` in validation), adjusting cost layers through the existing repost path                                                                             | `inventory-costing/`, `repost.domain`                                                             |
| 17  | Add `POST /api/inventory/reorder-suggestions/draft-po`: groups suggestions by supplier and creates **draft** purchase orders through `PurchasingService` — no new entity                                                                                                                  | `reorder.service.ts`, `purchasing.routes.ts`                                                      |
| 16  | Delivery notes (keep the in-flight `delivery_notes`): attach to `orders`/invoices, partial deliveries tracked per line, stock effect only through the existing movement service                                                                                                           | `services/orders/`                                                                                |
| 18  | Warranty (keep `warranties`): hang it off `stock_serials`/the sale line; claim = linked record with status; no financial effect                                                                                                                                                           | `traceability/`                                                                                   |
| 25  | OEM numbers: add a `kind` column to `product_barcodes` (`barcode                                                                                                                                                                                                                          | oem                                                                                               | aftermarket | supersedes`), search by any; keep `auto_fitments`; core charge = a deposit line to a `core_deposit` account role seeded additively | `product.service`, `inventory/` |
| 19  | Area pricing: add an `area` unit dimension and per-line width/length that derive quantity in the invoice grid; server, engine and UI use the same function                                                                                                                                | `units-seed`, `invoice-grid`, `measurement.domain`                                                |

### W4 — Industry extensions (keep the in-flight tables; relocate; wire)

| #   | Do                                                                                                                                                                                                         | Rule                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 21  | Gold: `metal_rates` (dated), purity on the line, making (per-gram / % / fixed), old-gold credit line — all through the invoice grid and `InvoiceService`; tax follows the workspace's existing tax setting | `pricing.ts` / invoice-grid |
| 22  | Freight trips: `freight_trips` + expenses; the freight charge is an ordinary sales invoice via `InvoiceService.create`; driver pay is a payroll line                                                       | `services/transport/`       |
| 23  | Passenger: layout, route, fare leg, scheduled trip, ticket; a paid ticket is an ordinary sale; online-only unless a till needs it                                                                          | `services/transport/`       |
| 24  | Courier + COD: status lifecycle; COD stages move cash through `pos`/`payments` services only                                                                                                               | `services/transport/`       |
| 26  | Appointments → invoice via `InvoiceService.create`                                                                                                                                                         | new small module            |
| 27  | Agriculture: land/crop/livestock-group; harvest posts stock-in through the stock-movement service                                                                                                          | new small module            |

### W5 — Localisation and connectors

| #      | Do                                                                                                                                                                                                                                                        |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 29     | Add export formats to `TaxService.getTaxReturn` aligned with the Afghanistan Revenue Department e-filing; needs a real sample return from the owner — until then it is `BLOCKED_EXTERNAL_CREDENTIAL` for the format, with the generic export done         |
| 28     | Moodian connector as an adapter under `services/connectors/moodian/` using the framework's retry, audit and tenant rules; needs taxpayer credentials and the sandbox — build to the documented interface and label `BLOCKED_EXTERNAL_CREDENTIAL` for live |
| 30, 40 | Real adapters under `services/connectors/<name>/`: at least one payment, one bank-statement and one shipping adapter; each writes **nothing** to a financial table (the framework's own guard)                                                            |
| 44     | Migration kits: add Tally / Holoo / Sepidar / QuickBooks column aliases and shapes to `services/migration` (`detect-entity`, `column-shape`); requires real export samples — ask the owner for them, build the generic path meanwhile                     |

### W6 — Reporting and exports

| #   | Do                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 34  | Scheduled report delivery: a saved report + cadence stored with the saved view, executed by the existing scheduler, sent through `email-outbox` |
| 35  | Dashboard KPI cards link to the ledger drill-down that already exists                                                                           |
| 36  | Management pack: compose `/aging`, working capital, cash flow and the income statement into one PDF through `backend/src/pdf`                   |
| 37  | Read-only OData endpoint over `reporting/dataset.domain` (workspace-scoped API key, paging, `$filter` subset)                                   |
| 38  | Footer with business, period, generated-at and workspace on `toCSV`/`buildXlsx` outputs                                                         |

### W7 — Ecosystem

| #   | Do                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 39  | Publish `openapi.json` from `@fastify/swagger` at build time; replace `z.any()` response schemas on the public-API routes first; generate a TypeScript SDK; versioned |
| 41  | Zapier app (separate package) on the existing OAuth apps + webhooks: triggers new invoice / customer / payment, actions create invoice / customer                     |
| 42  | Webhook delivery console in the developers hub: list attempts, status, replay button calling the existing replay route                                                |
| 43  | Accountant mode: a "my client businesses" list built from existing memberships with status and one-click `enterWorkspace`; no new identity concept                    |

### W8 — Resilience and security

| #   | Do                                                                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 32  | Extend `apps/desktop/e2e/app.e2e.ts` with the offline scenarios of `CLOSE-ALL-GAPS-PROMPT.md` §6                                                                                                                                                                                                                |
| 33  | Encrypt the device SQLite file (SQLCipher or equivalent) with a key held by `secure-store.ts` (safeStorage); migration path for an existing plain DB with a verified backup first; document the mobile equivalent. If a native build of SQLCipher is not possible on this machine, say exactly why and label it |
| 47  | Customer MFA: reuse the Supabase TOTP/AAL2 mechanism already enforced for the admin panel for owner accounts (opt-in), recovery codes, and a passkey path if the identity provider supports it; **do not** claim "two-step login" anywhere until it ships (`landing-claims.test.ts`)                            |
| 49  | Restore drill: a script that restores a `BackupService` export into a scratch workspace and reconciles counts; write `docs/security/disaster-recovery.md` with measured RTO/RPO; status page content                                                                                                            |

### W9 — Organisational (documents and evidence; no pretend completion)

| #   | Do                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 45  | `docs/security/soc2/`: control inventory mapped to the five trust criteria with the repository evidence for each (access control, audit log, backups, change management) and the gaps. Mark the audit itself `BLOCKED_EXTERNAL_CREDENTIAL` |
| 46  | `docs/security/iso27001/`: scope statement, risk register template filled from the codebase, statement of applicability draft. Certification is `BLOCKED_EXTERNAL_CREDENTIAL`                                                              |
| 50  | `docs/security/pentest-scope.md` built from OWASP WSTG against the real route list, plus a public security policy page and `security.txt`. The test itself is `BLOCKED_EXTERNAL_CREDENTIAL`                                                |

## 3. Per-item proof (unchanged from the wire-it-up prompt, restated as a checklist)

For every non-EXISTS row: shared rule + golden vector · migration + double-run pg test (or a recorded environment failure) · server service/route/body mapping/idempotency/audit · **two-workspace isolation** test · engine route + table + upgrade test or an `online_required` row · server-vs-engine **parity** test on the numeric vector · hook · UI section on web and `app-shell` · i18n ×3 · consumer proof (`grep` shows a caller; `audit-unwired-routes.mjs` clean; `unwired-capability.test.ts` green) · capability flip only after all of that · log row.

Numeric vectors that must hold on server, engine and UI: 2 cartons × 24 = 48 pieces; 15 g × 33,000,000 = 495,000,000; 50 m roll: sell 12.5 → 37.5 left, sell 40 → `ROLL_INSUFFICIENT`; sale return of 2 of 5 restores 2 units at original layer cost and reverses 2/5 of revenue and tax; credit limit 1,000 with receivable 800 and a 300 invoice → warn shows 100 over, block refuses, off ignores, limit `0` ≠ limit `null`; serial S1 sold twice → refused online and offline; 3 m × 2.5 m at 1,200,000/m² = 9,000,000; landed cost 100 split by value 3:1 → 75/25; three-way match with a quantity variance → `quantity_variance`.

## 4. Whole-job verification (sequential, real counts)

validation · local-engine · api · app-bridge · formatting — tsc + vitest full; `ui` — tsc + vitest full (isolate timeouts by running the file alone); `backend` — tsc + vitest full with the `|pg|` files reported separately (executed / not executed with the exact error; try every environment fix and record each attempt); desktop and mobile jest; eslint on changed files from their package directories; guards (offline matrix, route parity, no hard-coded currency, import cycles, no `eq null`, registry parity, capability-consumer guard, both generators `--check`); `node scripts/audit-unwired-routes.mjs`; `node scripts/build-ai-index.mjs`. Inject-test each new guard.

Then builds (web, Windows with `-c.electronDist=node_modules/electron/dist`, Android via `pnpm run android:release`; judge by artifact timestamps) and a **real Windows run, offline**, of the vectors in §3. Anything not driven is `IMPLEMENTED_NOT_LIVE_VERIFIED` with the reason.

## 5. Deliverables

`docs/architecture/universal-core/FIFTY-OPTIONS-LOG.md` (one row per option: verdict, search done to avoid duplicates, files, commands, real counts, status); updated `PRODUCTION-RELEASE-CHECKLIST-universal-core.md` (migrations in order with VERIFY and expected result; deploy order **database → backend → clients**; rollback; defaults such as `credit_limit_mode = warn`; first launch after the v9 bump; compatibility old/new; "no backfill"); lessons in `.claude/lessons-learned.md` and `CLAUDE.md`; regenerated coverage table, support matrix and ranking model with the post-implementation scores.

## 6. Completion gate

- [ ] Step zero done: the three duplicate tables are gone, no `universal-core*` file remains in `services/`, `routes/` or engine `routes/`.
- [ ] Each of the 50 has a log row; EXISTS rows prove it by running; EXTEND/BUILD/IN-FLIGHT rows completed the chain or are `BLOCKED_EXTERNAL_CREDENTIAL` with the exact dependency (only: live Supabase SQL, a physical device, a taxpayer credential or sample file from a third party, an external audit).
- [ ] Every `available` capability has a consumer in backend + engine + UI and a parity test.
- [ ] Suites, guards, builds and the offline Windows run are done with real numbers, or each omission is named.
- [ ] Nothing committed or pushed; no live DDL.

## 7. Final report (Persian)

جدول با یک ردیف برای هر ۵۰ مورد: وضعیت · اقدام (اجرا/تأیید/گسترش/ساخت/انتقال) · جستجوی ضدتکرار انجام‌شده · فایل‌ها · تست‌ها با عدد واقعی · مهاجرت (فایل، VERIFY، منتظر اجرای انسان) · آفلاین · باقی‌مانده. بعد: جمع هر سوئیت، مسیر و زمان بیلدها، شواهد اجرای زنده، ترتیب انتشار، و فهرست تصمیم‌هایی که خودت گرفتی. ستون «باقی‌مانده» فقط وقتی خالی است که واقعاً خالی باشد.

Begin with `git status`, then step zero.
