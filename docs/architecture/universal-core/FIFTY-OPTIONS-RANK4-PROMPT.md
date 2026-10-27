# Hisabche — the 50 options, built into the menu that already exists, to reach «below rank 5»

**This prompt replaces `FIFTY-OPTIONS-IMPLEMENTATION-PROMPT.md`.** It is organised around the project's actual menu so that nothing is built twice.

## 0. What «success» means, stated honestly

«Below rank 5» = rank 4 or better in `RANKING-MODEL.md` (the score of the 4th-best rival is **80.5**). That ranking is a **prioritisation model**: the rivals' scores are the author's judgement and the gains are assumptions. It is not a market fact, and this job must never describe it as one. The measurable outcome of this job is: **the options are real, wired, tested and reachable from the menu, and the model is re-run with evidence-based scores.**

What the model says (regenerated, baseline re-scored after the code audit):

|                                                 | score | rank  |
| ----------------------------------------------- | ----- | ----- |
| Hisabche now (assuming in-flight work finishes) | 67.5  | 11    |
| Cheapest 22 options (the Wave 1 below)          | 81.1  | **4** |
| All 46 code-only options                        | 82.6  | 3     |
| All 50                                          | 86.8  | 2     |

Code alone reaches rank 4 only with 31 options and a **0.4-point margin**; the organisational options (SOC 2, ISO 27001, DR, pentest) are what make rank ≤ 4 robust. They produce documents and evidence in this job; the audits/certificates themselves are `BLOCKED_EXTERNAL_CREDENTIAL`.

## 1. Read, in this order, before writing a line

1. `docs/architecture/universal-core/MENU-DOMAIN-MAP.md` — **every menu destination, what it holds, the landing spot of each option, and what must never be created.** This is the anti-duplicate authority.
2. `FIFTY-OPTIONS-AUDIT.md` — the verdict per option (EXISTS / EXTEND / BUILD / IN-FLIGHT / ORG / SKIP) and the evidence.
3. `RANKING-MODEL.md` (and `node scripts/industry/ranking-model.mjs` to regenerate it).
4. `WIRE-IT-UP-MASTER-PROMPT.md` §3 — the 10-link chain every capability completes.
5. `CLOSE-ALL-GAPS-PROMPT.md` §1 (decisions already made — do not re-ask) and §3 numeric vectors.
6. `CLAUDE.md`, `.claude/skills/hisabche-session-rules/SKILL.md`, `.ai/codebase/CODEBASE_MAP.md`.

## 2. Rules

- No commit/push, no subagents, no live DDL. Migrations = `docs/*.sql` + `VERIFY-*.sql` + a `*.pg.test.ts` that applies them **twice**; report `PENDING HUMAN CONFIRMATION`.
- Money moves only through `InvoiceService`, `PaymentsService`, `ledger.postDocument`. Pure rules in `packages/validation`, imported by the backend **and** the local engine. Additive migrations, no backfill, `workspace_id` on every row, `REVOKE ALL … FROM service_role` first, `IS NOT NULL` in CHECKs.
- **No new menu item. No new route unless a destination is genuinely absent** (there is no transport destination — see §3 row 22–24: it becomes a tab of the Sales hub). New UI = a tab or `?view=` section of the hub named in the map; register the old/new address pair if a page becomes a section (`moved` + `<Navigate>`, route-parity guard).
- No `any`, `@ts-ignore`, `eslint-disable`, dead code. Every string in `fa`, `af`, `en`. Every endpoint has an offline-matrix row; every new write route a `concurrency-safety-map.ts` entry.
- Labels: `VERIFIED_COMPLETE`, `IMPLEMENTED_NOT_LIVE_VERIFIED` (name what was not run), `BLOCKED_EXTERNAL_CREDENTIAL` (only: live Supabase SQL, a physical device, a third party's credential or sample file, an external audit).
- Machine traps: `TEMP`/`TMP` → `.pgtest/tmp`; backend tsc with `NODE_OPTIONS=--max-old-space-size=6144`; suites sequential; never run pip-made `.exe`; some `|pg|` backend files fail from the environment — try every fix and record each attempt, a skipped pg test is not a pass.

## 3. The anti-duplicate protocol (apply to every option, log the result)

1. **Find the owner.** Look the concept up in `MENU-DOMAIN-MAP.md` §1 and §3. The owner's folder is where the work goes.
2. **Search the concept, not the name.** `graphify` first (`C:/Users/hamed/AppData/Local/Programs/Python/Python313/Scripts/graphify.exe explain "<symbol>"`), then: `docs/*.sql` for tables and columns; `backend/src/services`, `backend/src/routes`; `packages/validation/src/schemas`; `packages/local-engine/src/routes`; `packages/api/src/hooks`; `packages/ui/src/components/ui`. Also check `node scripts/audit-unwired-routes.mjs` — a route with no caller may already be the backend you need.
3. **Decide:** owner exists → _extend_; endpoint exists with no caller → _wire_; truly absent → _build in the owner's folder_. Never build a "cleaner" parallel.
4. **Write the search into the log** (what you searched, what you found, the decision).
5. **Guard it.** Add `backend/src/__tests__/no-duplicate-concepts.test.ts`: a closed list of table names that must never be created (`pack_barcodes`, `product_serials`, `vehicle_units`, and any other you rejected), and a map concept → owner table; the test scans `docs/*.sql` and the local schema and fails on a violation. Inject-test it.

## 4. Step zero (before any option)

An agent is currently adding a `universal-core` bundle. Measured against the repository it duplicates three owners:

| In-flight         | Owner that already exists                                 | Action                                                                                              |
| ----------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `pack_barcodes`   | `product_barcodes` (column `unit`)                        | delete everywhere (rule, route, hook, UI, engine table, DDL, tests)                                 |
| `product_serials` | `stock_serials`, `stock_batches`, `services/traceability` | delete everywhere                                                                                   |
| `vehicle_units`   | `stock_serials`                                           | delete; add `vehicle_attributes(serial_id → stock_serials.id, make, model, year, colour, odometer)` |

Then: split `universal-core.service.ts` (748 lines), `universal-core.routes.ts` (483) and the matching hook / engine route / UI file **by domain** into the folders of the map; no file named `universal-core*` may remain in `services/`, `routes/` or engine `routes/`. Re-audit `docs/universal-core-migration.sql` against `traceability-migration.sql` and `product-barcodes-migration.sql`. Keep a single unreleased engine `SCHEMA_VERSION` 9 with an upgrade test on a copy of a real device DB (v8 → v9, twice). Reset every `business-capabilities.ts` entry without a complete chain to `planned`, and add the guard «an `available` capability names a consumer outside `packages/validation` and a server-vs-engine parity test» (inject-test it). Correct the wrong claims listed in `FIFTY-OPTIONS-AUDIT.md` §0 in `scripts/industry/coverage-data.mjs` and `UNIVERSAL-CORE-GAP-ANALYSIS.md`; both generators `--check` green. **Nothing below starts until tsc and the validation + local-engine suites pass.**

## 5. Wave 1 — the 22 options that take the model to rank 4 (do these first)

Execution order respects dependencies, not the model's greedy order. Each row: **landing** (hub → tab → `?view=`), what to **extend**, what is **new**, the **vector** that must pass on server, engine and UI (or the online-only reason).

### 1a — cheap extensions of what exists

| #   | Option                                            | Landing                                  | Extend                                                                                                                                                                                                                   | New                                                     | Vector / proof                                                                                     |
| --- | ------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 17  | Reorder → draft purchase orders                   | Stock → stock → reorder                  | `ReorderService`, `PurchasingService`                                                                                                                                                                                    | `POST /api/inventory/reorder-suggestions/draft-po` only | 3 suggestions, 2 suppliers → 2 draft POs, none placed                                              |
| 6   | Recurring journals                                | Money → books → journal                  | automation `ActionType 'recurring_expense'` (declared, not executable): give it an execution branch in `automation.service` and add it to `EXECUTABLE_ACTIONS`; reuse `ledger.postDocument`                              | `journal_templates` (name, lines, cadence)              | monthly template posts once per slot, catch-up ≤ 35 days, idempotent                               |
| 36  | Management pack PDF                               | Analysis → reports                       | `/aging/:kind`, working capital, `/cash-flow`, income statement, `backend/src/pdf`                                                                                                                                       | one composer                                            | pack totals equal the four sources to the minor unit                                               |
| 48  | Tamper-evident audit                              | Governance → audit                       | `audit.routes`, `audit.service`                                                                                                                                                                                          | hash-chain column + `GET /api/audit/verify`             | edit one row in a test DB → verify fails at that row                                               |
| 3   | Tax offline                                       | Sales invoice builder; Money → reports   | move `services/tax/tax.domain.ts` to `packages/validation/src/schemas/tax.domain.ts` (re-export the old path); engine computes tax with it; keep `GET /tax/return` online unless the engine can build it from local data | engine `tax.ts`, matrix rows                            | same invoice taxed identically on server, engine and builder; zero-rated ≠ exempt ≠ not-applicable |
| 12  | Serial/batch bound to the sale line, FEFO default | Sales builder row picker; Stock → expiry | `stock_serials`, `stock_batches`, `traceability.service` consume/plan — call them from `InvoiceService.create` and the engine                                                                                            | none                                                    | S1 sold twice refused online and offline; return restores `in_stock` (release path exists)         |
| 14  | Kits                                              | Production → boms                        | BoM `kind: 'kit'` in `manufacturing.service` / `manufacturing_save_bom`                                                                                                                                                  | one pure `explodeKit()`                                 | kit of 3 components sold as one line; stock moves per component; no work order                     |
| 34  | Scheduled report delivery                         | Analysis → reports                       | saved views, `custom-reports`, `email-outbox`, scheduler                                                                                                                                                                 | cadence + recipients on the saved view                  | daily schedule emits once, retries do not duplicate                                                |

### 1b — builds inside their owner

| #   | Option           | Landing                              | Extend                                                                                                                   | New                                                   | Vector                                                                                                                                         |
| --- | ---------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 4   | Deferred revenue | Money → books (section `deferrals`)  | `ledger.postDocument`, automation tick                                                                                   | `deferral_schedules`                                  | 1,200 over 12 months: one reclass entry, 12 recognitions, last absorbs rounding                                                                |
| 9   | Expense claims   | Team → pay (section `expenses`)      | approval gate, `PaymentsService`, payroll, ingest for receipts                                                           | `expense_reports`, `expense_lines`                    | approve → posts once; reject posts nothing; reimbursement via a payment                                                                        |
| 5   | Three-way match  | Sales builder (purchase) + Approvals | `purchasing.service` receive, `purchasing.domain`                                                                        | match link columns; pure `threeWayMatch()`            | qty variance → `quantity_variance`, price variance → `price_variance`, default **warn**                                                        |
| 13  | Landed cost      | Stock → products (receipt)           | `inventory-costing`, `repost.domain`                                                                                     | `landed_costs` + `allocateLandedCost()`               | 100 split by value 3:1 → 75/25, layers repriced, profit uses new cost                                                                          |
| 47  | Customer MFA     | Settings → general                   | Supabase TOTP/AAL2 already enforced for admin (`admin-rbac.middleware`) — generalise for owners (opt-in), recovery codes | none                                                  | enrol, step-up required for period lock / API key creation. **No «two-step login» claim anywhere until this ships** (`landing-claims.test.ts`) |
| 44  | Migration kits   | Data → details → migration           | `services/migration` detectors and column shapes                                                                         | alias tables for Tally / Holoo / Sepidar / QuickBooks | needs real export samples from the owner — build the generic path, label the rest `BLOCKED_EXTERNAL_CREDENTIAL`                                |
| 16  | Delivery notes   | Sales → invoice detail               | invoice lines; transfer in-transit pattern; **not** the API-only `orders` routes                                         | `delivery_notes` + lines                              | invoice of 10, deliver 4 then 6; stock moves once per delivery                                                                                 |
| 26  | Appointments     | Buyers → outreach                    | CRM tasks; invoice via `InvoiceService.create`                                                                           | `appointments`                                        | overlap on one resource refused                                                                                                                |
| 11  | Variants         | Stock → products; invoice grid       | `products`, `product_barcodes` (barcode per variant)                                                                     | `product_variants`                                    | size × colour: stock per variant per warehouse; template not sellable                                                                          |
| 40  | Real connectors  | Settings → integrations              | `services/connectors` framework                                                                                          | ≥ 3 adapters: payment, bank statement, shipping       | adapter writes no financial table (framework guard)                                                                                            |

### 1c — organisational (documents and evidence now; the audit itself is external)

| #   | Option    | Deliverable                                                                                                                                                                                                                                                  |
| --- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 50  | Pentest   | `docs/security/pentest-scope.md` from OWASP WSTG against the real route list; public security policy + `security.txt`                                                                                                                                        |
| 45  | SOC 2     | `docs/security/soc2/` — control inventory mapped to the five trust criteria with repository evidence and gaps                                                                                                                                                |
| 49  | DR        | restore-drill script (restore a `BackupService` export into a scratch workspace and reconcile counts) + `docs/security/disaster-recovery.md` with **measured** RTO/RPO + status-page copy; wire the `snapshots` UI (the API has no caller) in Data → details |
| 46  | ISO 27001 | `docs/security/iso27001/` — scope, risk register from the codebase, statement-of-applicability draft                                                                                                                                                         |

After Wave 1, **regenerate the model with evidence-based scores** (§7). Expected under the current assumptions: 81.1, rank 4.

## 6. Wave 2 — the other 28 (same protocol; takes the model from 4 to 2)

| #     | Option                            | Verdict                                                                                                                            | Landing                              |
| ----- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 7     | Cash-flow statement               | **EXISTS** — `/cash-flow`; verify the number and **add the missing section** to `ACCOUNTING_REPORT_SECTIONS` if no screen shows it | Money → reports                      |
| 10    | Learned bank rules                | **EXISTS** — verify `match-learning` feeds the suggestion route                                                                    | Money → treasury → bank              |
| 15    | Pack barcodes                     | **EXISTS** — prove scan of a `unit='carton'` barcode adds the factor on server and engine                                          | Stock → product barcodes             |
| 31    | Conflict resolver                 | **EXISTS** — verify with a conflict fixture                                                                                        | Data → details → conflicts           |
| 8     | Rolling forecast                  | **SKIP** — budgets + `/operations` cash forecast cover it; record the decision                                                     | —                                    |
| 1     | Hard lock                         | EXTEND                                                                                                                             | Money → books → monthEnd; Governance |
| 2     | Consolidation                     | BUILD (large; may finish `IMPLEMENTED_NOT_LIVE_VERIFIED`)                                                                          | Money → reports; Settings            |
| 18    | Warranty                          | EXTEND on `stock_serials`                                                                                                          | Stock / Sales detail                 |
| 19    | Area pricing                      | `area` unit dimension + per-line width/length in the invoice grid                                                                  | Sales builder                        |
| 20    | Roll stock                        | `stock_batches.remainingQty` + per-batch factor column                                                                             | Stock → expiry; builder              |
| 21    | Gold                              | `metal_rates`, purity on the line, making, old-gold credit via `InvoiceService`                                                    | Sales builder; Settings → metal unit |
| 22–24 | Freight, passenger, courier + COD | a **Transport tab of the Sales hub**; money only via invoices, payments, till; driver pay = payroll line                           | Sales → transport                    |
| 25    | OEM / fitment / core charge       | `product_barcodes.kind`; `auto_fitments`; `core_deposit` account role                                                              | Stock → products                     |
| 27    | Agriculture                       | land / crop cycle / livestock group; harvest = stock-in                                                                            | Production                           |
| 28    | Moodian                           | adapter under `connectors/moodian` (`BLOCKED_EXTERNAL_CREDENTIAL` for live)                                                        | Settings → integrations              |
| 29    | ARD return export                 | export formats on `TaxService.getTaxReturn` (needs a real sample)                                                                  | Money → reports                      |
| 30    | Local payment adapters            | `connectors/<name>`, `checkout.service`                                                                                            | Settings → integrations; Billing     |
| 32    | Electron E2E                      | extend `apps/desktop/e2e/app.e2e.ts` (4 tests today)                                                                               | —                                    |
| 33    | Encrypted local DB                | SQLCipher-class encryption, key in `secure-store.ts`; verified-backup migration of a plain DB                                      | desktop main + app-bridge            |
| 35    | KPI drill-through                 | cards link to `use-account-drilldown`                                                                                              | Today → Money                        |
| 37    | OData                             | read-only endpoint over `reporting/dataset.domain` with a `read:reports` scope                                                     | Settings → developers                |
| 38    | Export footer                     | `toCSV` / `buildXlsx`                                                                                                              | `packages/formatting`                |
| 39    | OpenAPI + SDK                     | publish the existing `@fastify/swagger` spec at build; replace `z.any()` responses on public-API routes first; generate a TS SDK   | Settings → developers                |
| 41    | Zapier / Make                     | separate package on OAuth apps + webhooks                                                                                          | external                             |
| 42    | Webhook console                   | list attempts, replay button on the existing replay route                                                                          | Settings → developers                |
| 43    | Accountant mode                   | «my client businesses» from existing memberships + `enterWorkspace`                                                                | Settings                             |

## 7. After each wave — re-score from evidence, not from hope

1. Run the five **scenario checks** against the real app and record pass/fail with logs: (a) foreign-currency purchase with FX gain/loss, (b) multi-warehouse sale with serial or batch, (c) offline sale then sync with a deliberate conflict, (d) return with ledger and stock correction, (e) restore after a simulated failure.
2. Update `HISABCHE_NOW` in `scripts/industry/ranking-model.mjs` only for dimensions where a check or a shipped feature justifies it; write the justification beside the numbers; set each finished option's gain to 0 (it is now in the baseline).
3. Regenerate `RANKING-MODEL.md`, `INDUSTRY-COVERAGE-TABLE.*` and the support matrix; both generators `--check` green. Report the new score and rank **with the sensitivity table**, and say plainly which rival scores remain unmeasured.

## 8. Verification and builds (after all waves, or after Wave 1 if asked to stop there)

Sequential, with real counts: validation, local-engine, api, app-bridge, formatting — tsc + vitest full; `ui` — tsc + vitest full (isolate timeouts by running the file alone); `backend` — tsc + vitest full, `|pg|` files reported separately; desktop + mobile jest; eslint on changed files from their package directories; guards (offline matrix, route parity, no hard-coded currency, import cycles, no `eq null`, registry parity, the new capability-consumer guard, `no-duplicate-concepts`, both generators `--check`); `node scripts/audit-unwired-routes.mjs` (the count must not rise); `node scripts/build-ai-index.mjs`; inject-test each new guard. Then web, Windows (`-c.electronDist=node_modules/electron/dist`) and Android (`pnpm run android:release`, judge by APK timestamp) builds, and drive the real Windows app **offline** through the vectors in §5 and `CLOSE-ALL-GAPS-PROMPT.md` §3. Anything not driven is `IMPLEMENTED_NOT_LIVE_VERIFIED` with the reason.

## 9. Deliverables

`FIFTY-OPTIONS-LOG.md` (one row per option: verdict, the anti-duplicate search, decision, files, commands, real counts, status); `PRODUCTION-RELEASE-CHECKLIST-universal-core.md` updated (migrations in order with VERIFY and expected result; deploy order **database → backend → clients**; rollback; defaults such as `credit_limit_mode = warn`; first launch after the v9 bump; old/new client-server compatibility; «no backfill»); lessons in `.claude/lessons-learned.md` and `CLAUDE.md`; regenerated model and tables.

## 10. Completion gate

- [ ] Step zero done; `no-duplicate-concepts` green; no `universal-core*` file remains in `services/`, `routes/` or engine `routes/`.
- [ ] Each of the 50 has a log row with its anti-duplicate search; EXISTS rows prove it by running; no option created a second owner for a concept in `MENU-DOMAIN-MAP.md`.
- [ ] Wave 1 complete (or each open item named with its exact external dependency).
- [ ] Every `available` capability has a consumer in backend + engine + UI and a parity test.
- [ ] No new menu item; every new screen is a tab/section of the hub the map names.
- [ ] Suites, guards, builds, offline Windows run done with real numbers, or each omission named.
- [ ] Model re-run from evidence, with sensitivity, and the report says the rank is a model output.
- [ ] Nothing committed or pushed; no live DDL.

## 11. Final report (Persian)

جدول: یک ردیف برای هر ۵۰ مورد — وضعیت · اقدام (تأیید / اتصال / گسترش / ساخت / انتقال / حذف) · جستجوی ضدتکرار و تصمیم · محل در منو (هاب ← تب ← بخش) · فایل‌ها · تست‌ها با عدد واقعی · مهاجرت (فایل + VERIFY + منتظر اجرای انسان) · آفلاین · باقی‌مانده. بعد: جمع هر سوئیت، مسیر و زمان بیلدها، شواهد اجرای زنده، امتیاز و رتبه‌ی مدل پس از دوباره‌سنجی با جدول حساسیت، و فهرست تصمیم‌هایی که خودت گرفتی. ستون «باقی‌مانده» فقط وقتی خالی است که واقعاً خالی باشد.

Begin with `git status`, then `MENU-DOMAIN-MAP.md`, then step zero.
