# 03 — SCREEN → CORE MAP

commit: `05f749a2` · date: 2026-11-01 · وضعیت: VERIFIED_SOURCE ×12 صفحه، PARTIAL ×9، NOT_VERIFIED ×14
مرتبط: [00-MASTER-FLOW-TREE](00-MASTER-FLOW-TREE.md) · [04](04-CORE-DEPENDENCY-GRAPH.md) · [17](17-SCREEN-STATE-MATRIX.md)

منبع routeها: `packages/app-shell/src/app/app.tsx:100-207` (Windows/Android و مشترک)، وب: پوشه‌های `apps/web/app/[lang]/(dashboard)/*` (۳۰ page.tsx در گروه dashboard؛ ۶۷ در کل `apps/web/app`؛ ۲۶ در `apps/admin`). ۳۵ صفحهٔ واقعی + ۲۹ ریدایرکت قدیمی (هاب‌ها، CLAUDE.md §۰٫۶).

| SCR     | route                    | کامپوننت           | عمل اصلی ← API                                        | Core                             | وضعیت                                                     |
| ------- | ------------------------ | ------------------ | ----------------------------------------------------- | -------------------------------- | --------------------------------------------------------- |
| SCR-001 | `/login`                 | LoginPage          | `POST /api/auth/login`, ورود آفلاین                   | auth.routes                      | PARTIAL (ورود خوانده نشد؛ دکمهٔ آفلاین: `login-page.tsx`) |
| SCR-002 | `/`                      | DashboardPage      | `GET /api/analytics/dashboard`                        | analytics.service (read-only)    | VERIFIED_SOURCE                                           |
| SCR-003 | `/onboarding`            | OnboardingPage     | `PATCH /api/auth/profile`, base-currency              | auth.routes + profile-write      | VERIFIED_SOURCE                                           |
| SCR-004 | `/invoices`              | InvoicesPage       | `GET /api/invoices`                                   | CORE-001                         | PARTIAL                                                   |
| SCR-005 | `/invoices/new`          | InvoiceBuilderPage | `POST /api/invoices`                                  | CORE-001                         | VERIFIED_SOURCE                                           |
| SCR-006 | `/invoices/new/preview`  | InvoicePreviewPage | چاپ/پیش‌نمایش (markInvoiceCreated)                    | UI                               | PARTIAL                                                   |
| SCR-007 | `/invoices/:id`          | InvoiceDetailPage  | `GET /invoices/:id`, `/related`, لغو/حذف/برگشت/پرداخت | CORE-001, CORE-002, return RPC   | VERIFIED_SOURCE                                           |
| SCR-008 | `/warehouse`             | ProductsPage       | کالا/انبار/قفسه/انتقال/تعدیل                          | ProductService, WarehouseService | VERIFIED_SOURCE                                           |
| SCR-009 | `/warehouse/:id`         | ProductDetailPage  | جزئیات + قابلیت‌های دسته                              | useBusinessProfile               | VERIFIED_SOURCE                                           |
| SCR-010 | `/customers`             | CustomersPage      | CRUD + `?tab=outreach`                                | CustomerService                  | PARTIAL                                                   |
| SCR-011 | `/customers/:id`         | CustomerDetailPage | مانده/صورت‌حساب                                       | CustomerService.getBalance       | VERIFIED_SOURCE                                           |
| SCR-012 | `/accounting`            | AccountingPage     | دفتر/تراز/خزانه/گزارش/بودجه                           | CORE-003                         | PARTIAL                                                   |
| SCR-013 | `/activities`            | ActivitiesPage     | فید رخدادها                                           | activity services                | NOT_VERIFIED                                              |
| SCR-014 | `/sync-center`           | SyncCenterPage     | صف خروجی، تلاش دوباره                                 | sync-engine                      | VERIFIED_SOURCE                                           |
| SCR-015 | `/settings`              | SettingsPage       | ارز دفاتر، منطقه زمانی، دسته                          | workspace/me routes              | PARTIAL                                                   |
| SCR-016 | `/approvals`             | ApprovalsPage      | گردش‌کار                                              | workflow                         | NOT_VERIFIED                                              |
| SCR-017 | `/developers`            | DevelopersPage     | کلید API/وب‌هوک                                       | developer                        | NOT_VERIFIED                                              |
| SCR-018 | `/marketplace`           | MarketplacePage    | **گیت‌شده** (`DISABLED_PAGES`)                        | —                                | NOT_VERIFIED                                              |
| SCR-019 | `/billing`               | BillingPage        | اشتراک/ارتقا/لایسنس                                   | billing.service + plan-limits    | PARTIAL                                                   |
| SCR-020 | `/market-seller`         | MarketSellerPage   | **گیت‌شده**                                           | —                                | NOT_VERIFIED                                              |
| SCR-021 | `/analysis`              | AnalysisPage       | تحلیل کسب‌وکار                                        | analysis.service                 | NOT_VERIFIED                                              |
| SCR-022 | `/manufacturing`         | ManufacturingPage  | BOM/تولید                                             | ManufacturingService             | NOT_VERIFIED                                              |
| SCR-023 | `/assistant`             | AssistantPage      | دستیار AI                                             | ai pipeline                      | NOT_VERIFIED                                              |
| SCR-024 | `/operations`            | OperationsPage     | عملیات                                                | —                                | NOT_VERIFIED                                              |
| SCR-025 | `/stock-count`           | StockCountPage     | شمارش انبار                                           | cycle-count.service              | PARTIAL                                                   |
| SCR-026 | `/team-and-payroll`      | TeamAndPayrollPage | کارمند/حقوق/حضور                                      | HumanResourcesService            | VERIFIED_SOURCE (حقوق)                                    |
| SCR-027 | `/team-and-payroll/:id`  | EmployeeDetailPage | —                                                     | —                                | NOT_VERIFIED                                              |
| SCR-028 | `/audit`                 | AuditPage          | audit trail                                           | audit.service                    | NOT_VERIFIED                                              |
| SCR-029 | `/till`                  | TillPage           | صندوق                                                 | PosService                       | VERIFIED_SOURCE                                           |
| SCR-030 | `/data-and-sync`         | DataAndSyncPage    | تعارض‌ها، ورود فایل                                   | migration + sync                 | PARTIAL                                                   |
| SCR-031 | `/governance`            | GovernancePage     | ماتریس مجوزها                                         | authorization                    | PARTIAL                                                   |
| SCR-032 | `/public-task/:token`    | PublicTaskPage     | عمومی                                                 | —                                | NOT_VERIFIED                                              |
| SCR-033 | `/public-invoice/:token` | PublicInvoicePage  | عمومی                                                 | —                                | NOT_VERIFIED                                              |
| SCR-034 | `/portal/:token`         | PublicPortalPage   | پورتال مشتری                                          | —                                | NOT_VERIFIED                                              |
| SCR-035 | `/my-attendance/:token`  | AttendanceSelfPage | لینک حضور                                             | attendance-link.service          | PARTIAL                                                   |

ریدایرکت‌ها (نمونه): `/purchasing`→`/invoices?type=purchase`، `/bank`→`/accounting?tab=treasury`، `/budgets`→`/accounting?tab=reports&view=budgets`، `/permissions`→`/governance?tab=permissions`، `/wallet`→`/billing?tab=money`، `/conflicts`→`/data-and-sync?tab=details&view=conflicts` (فهرست کامل `app.tsx:156-207`).

⚠️ `/marketplace`، `/market-seller` در Windows/Android پشت `gated(...)`اند؛ سوییچ `DISABLED_PAGES` طبق commit `622584d9`/`85d79856`.
