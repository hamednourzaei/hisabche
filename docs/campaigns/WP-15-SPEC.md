# WP-15 — مشخصات اجرا: پروژه، زمانسنجی و صورتوضعیت مرحلهای

> سند دستی. مبنا: ردیفهای `project_costing` / `timesheet_billing` در
> `docs/architecture/universal-core/ENGINE-WIRING.csv`.

## وضعیت پیش از اجرا

| قابلیت              | لایه غایب | محدودیتها                                                 |
| ------------------- | --------- | --------------------------------------------------------- |
| `project_costing`   | `local`   | `SERVER_ONLY_NO_OFFLINE_ENGINE`, `NO_OVERHEAD_ALLOCATION` |
| `timesheet_billing` | `local`   | `MILESTONE_INVOICE_WIRING_PARTIAL`                        |

## آنچه پیاده شد

1. **قواعد مشترک** (`packages/validation/src/schemas/universal-core/`):
   - `project-costing.domain.ts` — `projectCostOf` (هزینه از تراکنش واقعی + سربار قابل پیکربندی،
     پیشفرض خاموش) و `budgetVarianceOf`. مقدار ناشناخته → `null`، نه صفر.
   - `timesheet-billing.domain.ts` — `billableTimeOf` (فقط ساعات **تأییدشده و قابلصورتحساب**) و
     `milestoneReadiness` (ساعات تأییدنشده هرگز مرحله را آزاد نمیکند).
2. **Local Engine** (`routes/projects.ts`) — جدولهای `local_projects`, `project_time_entries`,
   `project_milestones` + مهاجرت `V32` (`SCHEMA_VERSION=32`) · ثبت زمان · تأیید با مجوز
   `ledger.post` · پیشنمای هزینه و آمادگی مرحله · تمام نوشتها capability-guarded.
3. **Hookها** — ۶ Hook مبتنی بر `localRequest` (درگاه محلی)، بدون مسیر سرور جعلی و بدون ردیف
   اضافی در offline matrix.

## آنچه انجام نشد

- صدور فاکتور روی دستگاه — همان `/api/projects/:id/bill` سرور مرجع است.
- تخصیص سربار روی سرور — قاعده مشترک و پیشنمای دستگاه هست، ولی تنظیم سرور وصل نشده
  (محدودیت `NO_OVERHEAD_ALLOCATION` باقی ماند).
- UI اختصاصی برای پیشنویش پروژه / تأیید زمان.

## حکم

`IMPLEMENTED_NOT_LIVE_VERIFIED` — شاهد PG زنده مسدود است (`SeCreateGlobalPrivilege`).
