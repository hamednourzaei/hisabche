# الگوی Core Module در حسابچه

> این فایل با ساخت **Accounting Core** نوشته شد. هر Core بعدی همین الگو را دنبال کند.
> اگر جایی از الگو منحرف شدی، دلیلش را همین‌جا بنویس — نه در کد.

---

## ۱. ساختار پوشه

یک Core یک پوشه زیر `backend/src/services/<core>/` است:

```
backend/src/services/accounting/
├── index.ts                    ← تنها سطح عمومی Core
├── accounting.domain.ts        ← قوانین خالص (بدون DB، بدون شبکه)
├── accounting.reports.ts       ← محاسبات خالص روی داده‌ی جمع‌زده‌شده
├── accounting.repository.ts    ← تنها فایلی که Supabase و نام ستون‌ها را می‌شناسد
├── accounting.service.ts       ← ارکستراسیون: قوانین + گزارش + ذخیره‌سازی
├── ledger.port.ts              ← قرارداد استفاده‌ی Coreهای دیگر
└── operational-reports.ts      ← (موقت) گزارش‌هایی که بعداً به Core دیگری می‌روند
```

قانون‌ها:

- **هیچ فایلی بیرون از پوشه‌ی Core حق ندارد به فایل داخلی آن import بزند.** فقط `index.ts`.
  یک ماژول که مستقیم به repository وصل شود، به شکل ذخیره‌سازی وابسته می‌شود و اولین تغییر
  storage می‌شکندش.
- `*.domain.ts` و `*.reports.ts` باید **کاملاً خالص** باشند: بدون `supabase`، بدون `Date.now()`
  در مسیر تصمیم‌گیری، بدون کش. دلیل: «آیا این سند تراز است؟» باید بدون دیتابیس قابل تست باشد.
- `*.repository.ts` تنها جایی است که نام جدول/ستون ظاهر می‌شود.
- `*.service.ts` منطق را می‌چیند، ولی خودش فرمول ندارد.

## ۲. مرز تنانسی

```
workspaceId  = مرز امنیتی. تنها چیزی که در WHERE می‌آید.
userId       = فقط «چه کسی این کار را کرد». هرگز فیلتر نیست.
```

هر متد عمومی Core باید `TenancyContext` بگیرد، نه `userId: string`. امضای تابع خودش
جلوی روتی را می‌گیرد که `requireWorkspaceContext` را فراموش کرده است — چون چیزی برای
پاس‌دادن ندارد و کامپایل نمی‌شود.

تست ایستای `backend/src/__tests__/tenancy-static-guard.test.ts` جداول مشترک را می‌پاید؛
جدول‌های هر Core جدید باید به `SHARED_TABLES` آن اضافه شوند.

## ۳. Port — تنها راه ارتباط بین Coreها

هر Core که دیگران به آن «فرمان» می‌دهند، یک فایل `*.port.ts` دارد:

```ts
// نمونه: ledger.port.ts
export interface LedgerPort {
  postDocument(ctx: TenancyContext, request: LedgerPostingRequest): Promise<LedgerPostingOutcome>
  reverseDocument(...): Promise<...>
  resolveAccountsByRole(ctx, roles): Promise<{ accounts; missing }>
}
```

قوانین Port:

- فراخوان **هرگز** نباید جزئیات داخلی Core مقصد را بداند. `invoice.service` نباید بداند
  فروش یعنی «بدهکار دریافتنی / بستانکار درآمد»، و مطلقاً نباید کد حساب (`'1200'`) بشناسد.
  به‌جای کد حساب، **نقش** (`role`) پرسیده می‌شود.
- خروجی Port باید **حالت‌های ناموفق را برگرداند، نه ببلعد**:
  `{ status: 'posted' | 'already_posted' | 'skipped', reason }`.
  `try { ... } catch { }` خاموش، همان چیزی است که باعث شد فاکتورها ماه‌ها بدون سند بمانند.
- هر فرمانی که از یک سند دیگر می‌آید **idempotent** است: `(sourceType, sourceId)` کلید
  یکتاست، هم در کد و هم با unique index در دیتابیس.

## ۴. خطاها

Domain با **کد** رد می‌کند، نه با جمله:

```
JOURNAL_ENTRY_UNBALANCED · ACCOUNTING_PERIOD_LOCKED · ACCOUNT_PARENT_CYCLE
```

روت همان کد را در `code` می‌فرستد و کلاینت آن را ترجمه می‌کند. جمله‌ی ساخته‌شده در
سرور تا وقتی به صفحه برسد دیگر قابل ترجمه نیست.

اعتبارسنجی باید **همه‌ی مشکل‌ها را یکجا** برگرداند، نه اولی را — کاربری که سند ده‌سطری
را اصلاح می‌کند نباید ده بار submit بزند.

## ۵. کش

کلید کش با پیشوند Core و workspace ساخته می‌شود:

```
accounting:<workspaceId>:trial:<from>:<to>
```

و invalidate روی پیشوند `accounting:<workspaceId>` انجام می‌شود. درسِ گران‌قیمت:
کش قدیمی با کلید `trial_balance:<user>:<date>` ساخته می‌شد ولی `trial_balance:<user>`
پاک می‌شد — یعنی هیچ‌وقت پاک نمی‌شد.

## ۶. نوشتن اتمیک

`supabase-js` تراکنش ندارد. هر نوشتنی که چند جدول را با هم عوض می‌کند باید یک
**Postgres function** باشد و سرویس فقط `rpc` صدا بزند (نمونه:
`accounting_post_journal_entry`). الگوی «insert کن، اگر دومی خطا داد اولی را delete کن»
ممنوع است: اگر پروسه وسط کار بمیرد، جبران هرگز اجرا نمی‌شود.

قوانین حیاتی دوباره داخل همان تابع چک می‌شوند — چک بیرون از تراکنش قابل race است.

## ۷. تجمیع گزارش

جمع‌زدن روی دیتابیس انجام می‌شود (`accounting_trial_balance`)، نه با کشیدن همه‌ی
ردیف‌ها به Node. Core فقط داده‌ی جمع‌زده‌شده را شکل می‌دهد.

## ۸. Coreهای فعلی و وضعیتشان

| Core                                   | مسیر                                                      | وضعیت                                                                                                          |
| -------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Accounting / Ledger                    | `backend/src/services/accounting/`                        | ✅ Tier 1، مورد ۱                                                                                              |
| Inventory Costing                      | `backend/src/services/inventory-costing/`                 | ✅ Tier 1، مورد ۲                                                                                              |
| Payments / AR / AP                     | `backend/src/services/payments/`                          | ✅ Tier 1، مورد ۳                                                                                              |
| CRM (tasks, opportunities)             | `backend/src/services/crm/` — port: `CrmPort`             | ✅ مصرف بین‌هسته‌ای فقط از port؛ UI: `CustomerCrmPanel`                                                        |
| Customer Profile (credit, terms, docs) | `backend/src/services/customer-profile/`                  | ✅ فاز ۳ و ۴ Customer 360؛ پول از Payments Core، اسناد از Accounting (`entriesForDocuments`)، تحلیل قاعده‌محور |
| Authorization                          | `backend/src/services/authorization/`                     | ✅ Tier 1، موارد ۴ و ۵                                                                                         |
| Offline Conflict Resolution            | `backend/src/services/conflict/`                          | ✅ Tier 1، مورد ۶                                                                                              |
| RLS                                    | `docs/*.sql` + `scripts/verify-rls.mjs`                   | ✅ Tier 1، مورد ۷ — اثبات دو نیمه‌ای                                                                           |
| SoD                                    | `backend/src/services/authorization/sod.*`                | ✅ Tier 2، مورد ۱                                                                                              |
| Branch (Multi-company)                 | `backend/src/services/branch/`                            | ✅ Tier 2، مورد ۲                                                                                              |
| Supplier                               | `backend/src/services/supplier/`                          | ✅ Tier 2، مورد ۳                                                                                              |
| Subscription / Billing                 | `backend/src/services/billing.service.ts`                 | ✅ Tier 2، مورد ۴ (DECISION A تکمیل شد)                                                                        |
| Personalization (UI Visibility)        | `backend/src/services/personalization/`                   | ✅ Tier 3، مورد ۱                                                                                              |
| Adaptive Runtime                       | `packages/ui-contract/src/runtime-policy.ts`              | ✅ Tier 3، مورد ۲ (قرارداد؛ اعمال در کلاینت باقی)                                                              |
| Manufacturing                          | `backend/src/services/manufacturing.service.ts`           | ✅ Tier 3، مورد ۳                                                                                              |
| Rules Engine                           | `backend/src/services/rules/`                             | ✅ (`detail.md` بند ۵)                                                                                         |
| MDM                                    | `backend/src/services/mdm/`                               | ✅ (`detail.md` بند ۷)                                                                                         |
| Insights (پایه‌ی AI Copilot)           | `backend/src/services/insights/`                          | ✅ (`detail.md` بند ۹)                                                                                         |
| Plugin / Marketplace contract          | `backend/src/services/plugins/plugin.domain.ts`           | ✅ قرارداد (`detail.md` بند ۱۰)                                                                                |
| Tax                                    | `backend/src/services/tax/`                               | ✅ Tier 1 گپ ۱ — پول در واحد صحیح + انجماد نرخ آفلاین                                                          |
| Traceability (Batch / Serial / Expiry) | `backend/src/services/traceability/`                      | ✅ Tier 1 گپ ۲ — FEFO پیش‌فرض                                                                                  |
| POS                                    | `backend/src/services/pos/`                               | ✅ گپ ۳ — بازیابی session رهاشده                                                                               |
| Fixed Assets                           | `backend/src/services/assets/`                            | ✅ گپ ۴ — جدول استهلاک از پیش محاسبه‌شده                                                                       |
| Bank Reconciliation                    | `backend/src/services/banking/`                           | ✅ گپ ۵ — تطبیق پیشنهادی، نه خودکار                                                                            |
| FX Revaluation                         | `backend/src/services/currency/`                          | ✅ گپ ۶ — تحقق‌یافته جدا از تحقق‌نیافته                                                                        |
| Accounting Dimensions                  | `backend/src/services/dimensions/`                        | ✅ گپ ۷ — الزام per-account                                                                                    |
| Budgeting                              | `backend/src/services/budgeting/`                         | ✅ Tier 2 گپ ۸ — تعهد، نه فقط هزینه                                                                            |
| Repost / Landed Cost / Reorder         | `backend/src/services/inventory-costing/repost.domain.ts` | ✅ Tier 2 گپ ۹-۱۱                                                                                              |
| Timesheet Billing                      | `backend/src/services/timesheets/`                        | ✅ Tier 2 گپ ۱۴                                                                                                |
| Workflow Engine                        | `backend/src/services/workflow.service.ts`                | ✅ trigger از Rules Engine می‌آید                                                                              |

## ۹. Portهای موجود

| Port          | فایل                                         | چه کسی استفاده می‌کند                                            |
| ------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| `LedgerPort`  | `services/accounting/ledger.port.ts`         | `invoice.service`، `payments.service`                            |
| `CostingPort` | `services/inventory-costing/costing.port.ts` | `invoice.service`، `purchasing.service`، `manufacturing.service` |

جریان کامل یک فروش:

```
invoice.create
  → costing.recordIssue  (FIFO مصرف می‌شود، بهای واقعی برمی‌گردد)
  → ledger.postDocument  (دریافتنی/درآمد + COGS/موجودی با همان بها)
payment.record
  → ledger.postDocument  (صندوق/دریافتنی)

purchasing.receiveGoods / manufacturing.completeWorkOrder
  → costing.recordReceipt / recordIssue  (ارزش موجودی حفظ می‌شود)
```

## ۱۱. ترتیب لایه‌ها (غیرقابل‌جابه‌جایی)

```
Authentication → Workspace (tenancy) → Branch (narrowing) →
Capability → Record-level → Field-level → SoD →
UI Visibility → Runtime Policy
```

هر لایه فقط می‌تواند **محدودتر** کند. `resolveVisibility()` مجموعه‌ی authorized را
ورودی می‌گیرد و فقط زیرمجموعه برمی‌گرداند؛ `branchScopeFor()` هرگز چیزی به workspace
اضافه نمی‌کند؛ `runtimePolicy()` هیچ کلید امنیتی/مالی ندارد و این با
`assertPolicyIsPresentationOnly()` تست می‌شود.

## ۱۰. Authorization در روت‌ها

هر روت مالی سه preHandler دارد و ترتیبشان معنادار است:

```ts
preHandler: [
  authenticate, // تو کی هستی
  requireWorkspaceContext, // کدام دفتر
  requireCapability('...'), // آیا اجازه‌ی این کار را داری
]
```

تست ایستای `authorization-rules.test.ts` می‌شمارد که تعداد `requireCapability` با
تعداد روت‌های ثبت‌شده در فایل‌های مالی برابر باشد — روت جدیدی که کپی شود و این خط را
نداشته باشد، CI را می‌شکند.

## ۱۲. لایه‌ی عمودی — یک قابلیت کِی «هست»

یک Core با دامنه‌ی سبز، **قابلیت نیست**. کامل یعنی هر هفت لایه:

```
domain.ts      قوانین خالص، بدون DB، بدون شبکه
service.ts     ارکستراسیون؛ TenancyContext می‌گیرد، نه userId
routes.ts      authenticate → requireWorkspaceContext → requireCapability
migration      جدول + RLS + policy، در docs/*.sql
hooks          packages/api/src/hooks/<x>.ts
container      packages/ui/src/components/ui/<x>/ — وب و ویندوز هر دو مصرف می‌کنند
page           صفحه‌ی نازک در هر سه اپ
```

`vertical-slice-integration.test.ts` پنج تای اول را قفل می‌کند. دو تای آخر را
هیچ تستی نمی‌تواند اثبات کند جز نگاه‌کردن.

**ترتیب ساخت UI:** وب → ویندوز → موبایل. دسکتاپ از همان `packages/ui` مصرف
می‌کند، پس container یک بار نوشته می‌شود.

## ۱۳. اسکریپت‌های وریفای

| اسکریپت                                                           | نیاز به DB |
| ----------------------------------------------------------------- | ---------- |
| `check-schema-drift.mjs` — ستون ناموجود، قبل از migration         | ✗          |
| `run-migrations.mjs` — ترتیبی، checksum، تراکنشی، dry-run پیش‌فرض | ✓          |
| `verify-rls.mjs` — RLS واقعی با کاربر واقعی                       | ✓          |
| `verify-slice.mjs` — retry، هم‌زمانی، هدر جعلی workspace          | ✓ + سرور   |
