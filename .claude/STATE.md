# وضعیت فعلی حسابچه — بخوان قبل از هر کاری

> این فایل نقشه‌ی «چی به چیه» است. آخرین به‌روزرسانی: ۳۰ اوت ۲۰۲۶.
> اگر با وضعیت کد نمی‌خواند، **کد درست است و این فایل قدیمی** — درسِ شماره ۲
> در `lessons-learned.md`.

---

## ۱. وضعیت یک‌خطی

Tier 1، Tier 2 و Tier 3 از master prompt **در سطح دامنه + سرویس + API تمام شده‌اند**.
هیچ ماژولی **product-complete نیست**، چون:

- ❌ **هیچ migration ای اجرا نشده.** جدول `schema_migrations` وجود ندارد.
- ❌ **هیچ UI ای برای شش قابلیت جدید ساخته نشده.**
- ⚠️ RLS نوشته شده ولی روی دیتابیس واقعی اثبات نشده.

```
tsc: تمیز  ·  1064 تست سبز  ·  0 خطای lint  ·  348 warning قدیمیِ any
```

---

## ۲. معماری — چهار لایه، از پایین به بالا

```
backend/src/services/<core>/<core>.domain.ts     قوانین خالص، بدون DB
                          <core>.service.ts      ارکستراسیون + Supabase
backend/src/routes/<x>.routes.ts                 HTTP + گاردها
packages/api/src/hooks/<x>.ts                    TanStack Query
packages/ui/src/components/ui/<x>/               container + view مشترک
apps/web · apps/desktop · apps/mobile            صفحه‌ی نازک
```

**دسکتاپ از `packages/ui` مصرف می‌کند** — پس هر container یک بار نوشته می‌شود و
وب و ویندوز هر دو از آن استفاده می‌کنند. موبایل الگوی خودش را دارد
(`apps/mobile/src/shared/navigation/nav.ts`).

**ترتیب ساخت UI که تصمیم گرفته شد: وب → ویندوز → موبایل.**

---

## ۳. ۲۲ Core موجود

| Core                      | مسیر                                          | Domain | Service | Route                  |
| ------------------------- | --------------------------------------------- | ------ | ------- | ---------------------- |
| Accounting / Ledger       | `services/accounting/`                        | ✅     | ✅      | `/api/accounting`      |
| Inventory Costing         | `services/inventory-costing/`                 | ✅     | ✅      | `/api/inventory`       |
| Payments / AR-AP          | `services/payments/`                          | ✅     | ✅      | `/api/payments`        |
| Authorization + SoD       | `services/authorization/`                     | ✅     | ✅      | `/api/governance`      |
| Offline Conflict          | `services/conflict/`                          | ✅     | ✅      | `/api/conflicts`       |
| Branch                    | `services/branch/`                            | ✅     | ✅      | `/api/branches`        |
| Supplier                  | `services/supplier/`                          | ✅     | ✅      | `/api/suppliers`       |
| Rules Engine              | `services/rules/`                             | ✅     | ✅      | `/api/rules`           |
| MDM                       | `services/mdm/`                               | ✅     | ✅      | `/api/intelligence`    |
| Insights (پایه‌ی AI)      | `services/insights/`                          | ✅     | ✅      | `/api/intelligence`    |
| Personalization           | `services/personalization/`                   | ✅     | ✅      | `/api/personalization` |
| **Tax**                   | `services/tax/`                               | ✅     | ✅      | `/api/tax`             |
| **Traceability**          | `services/traceability/`                      | ✅     | ✅      | `/api/operations`      |
| **POS**                   | `services/pos/`                               | ✅     | ✅      | `/api/pos`             |
| **Fixed Assets**          | `services/assets/`                            | ✅     | ✅      | `/api/finance`         |
| **Banking**               | `services/banking/`                           | ✅     | ✅      | `/api/finance`         |
| **Currency / FX**         | `services/currency/`                          | ✅     | ✅      | `/api/finance`         |
| **Dimensions**            | `services/dimensions/`                        | ✅     | ✅      | `/api/finance`         |
| **Budgeting**             | `services/budgeting/`                         | ✅     | ✅      | `/api/operations`      |
| **Timesheets**            | `services/timesheets/`                        | ✅     | ✅      | `/api/operations`      |
| Repost / Landed / Reorder | `services/inventory-costing/repost.domain.ts` | ✅     | —       | —                      |
| Plugin contract           | `services/plugins/plugin.domain.ts`           | ✅     | —       | —                      |

`packages/ui-contract/src/runtime-policy.ts` — Adaptive Runtime (قرارداد خالص).

---

## ۴. آنچه باقی مانده، به ترتیب

### گام ۱ — migrationها (مسدودکننده‌ی همه‌چیز)

`DATABASE_URL` در `.env.staging` و `.env.production` روی `staging-db` و
`production-db` اشاره می‌کند که **resolve نمی‌شوند** — placeholder هستند.

```bash
# ۱. connection string واقعی Supabase را در .env.staging بگذار
#    مهم: پورت 5432 (مستقیم) نه 6543 (pooler) — pooler حالت transaction دارد
#    و DDL چندجمله‌ای را نصفه رها می‌کند.
node scripts/run-migrations.mjs            # dry-run، چیزی نمی‌نویسد
node scripts/run-migrations.mjs --apply    # بعد از بکاپ
node scripts/verify-rls.mjs                # RLS واقعاً اثبات می‌شود
```

### گام ۲ — UI (نیمه‌کاره، جایی که رها شد)

انجام‌شده:

- `packages/ui-contract/src/navigation.ts` — شش مقصد `till`, `expiry`, `budgets`,
  `timesheets`, `assets`, `bank` اضافه شد
- آیکون‌ها در `packages/ui/src/lib/menu/nav-items.ts` (lucide) و
  `apps/mobile/src/shared/navigation/nav.ts` (Ionicons)
- کلیدهای i18n در هر سه زبان `fa/en/af`
- `packages/api/src/hooks/till.ts` — hookهای صندوق

باقی‌مانده:

- hookهای API برای پنج قابلیت دیگر (assets, bank, budgets, timesheets, expiry)
- container و view در `packages/ui`
- صفحه‌ی نازک در `apps/web/app/[lang]/(dashboard)/<x>/page.tsx`
- مسیر دسکتاپ (همان container را مصرف می‌کند)
- صفحه‌ی موبایل + افزودن id به `IMPLEMENTED` در `nav.ts`

> ⚠️ شش مقصد جدید عمداً در `IMPLEMENTED` موبایل **نیستند** — تا وقتی صفحه
> ندارند در منو ظاهر نمی‌شوند. مقصدی که به جایی نمی‌رسد بدتر از نبودنش است.

### گام ۳ — اثبات زنده

```bash
node scripts/verify-slice.mjs --i-understand-this-writes-data
```

retry واقعی، هم‌زمانی واقعی، ایزوله‌سازی tenant واقعی.

---

## ۵. ابزارهای وریفای که ساخته شد

| اسکریپت                          | چه می‌کند                                                        | نیاز به DB |
| -------------------------------- | ---------------------------------------------------------------- | ---------- |
| `scripts/check-schema-drift.mjs` | کوئری‌ای که ستون ناموجود می‌خواند را **قبل از اجرا** پیدا می‌کند | ✗          |
| `scripts/run-migrations.mjs`     | migrationها به ترتیب، checksum‌دار، تراکنشی. dry-run پیش‌فرض     | ✓          |
| `scripts/verify-rls.mjs`         | anon هیچ نمی‌بیند؛ کاربر فقط workspace خودش                      | ✓          |
| `scripts/verify-slice.mjs`       | idempotency، هم‌زمانی، هدر جعلی workspace                        | ✓ + سرور   |

**`check-schema-drift.mjs` سه باگ واقعی پیدا کرد** که ۱۰۶۴ تست سبز پنهانشان کرده بود:
`exchange_rates.workspace_id`، `invoice_items.workspace_id`، `invoices.project_id`.
هر سه در `docs/schema-drift-fix-migration.sql` درست شدند.

---

## ۶. تست‌های ایستا که نمی‌گذارند چیزی پس‌رفت کند

| فایل                                 | چه چیزی را قفل می‌کند                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `tenancy-static-guard.test.ts`       | هیچ جدول مشترکی با `user_id` فیلتر نشود                                       |
| `rls-coverage.test.ts`               | هر جدول tenant، RLS و policy داشته باشد                                       |
| `authorization-rules.test.ts`        | هر روت مالی `requireCapability` داشته باشد                                    |
| `vertical-slice-integration.test.ts` | روت ثبت‌شده، گاردها به ترتیب، سرویس context بگیرد، idempotency نوشته شده باشد |
| `financial-flows-e2e.test.ts`        | درز بین Coreها: خروجی یکی ورودی درست بعدی باشد                                |

---

## ۷. migrationها — ترتیب اجرا

ترتیب در `scripts/run-migrations.mjs` آرایه‌ی `ORDER` است. **الفبایی نیست** و
نباید باشد: `tax-engine` ستون به `invoices` اضافه می‌کند که باید بعد از
migrationهای قدیمی‌تر بیاید.

فایل‌های جدیدِ این دور:
`accounting-core` · `inventory-costing` · `payments-ar-ap` · `sync-conflicts` ·
`sod` · `branch` · `personalization` · `rules-engine` · `mdm` ·
`tenant-isolation-closure` · `tax-engine` · `traceability` · `finance-gaps` ·
`tier2-gaps` · `child-table-rls-fix` · `schema-drift-fix`

---

## ۸. تصمیم‌هایی که دوباره بحث نکن

| تصمیم                                          | چرا                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| SoD پیش‌فرض **خاموش**                          | اکثر workspaceها یک‌نفره‌اند؛ کنترلی که لاگین share کند بدتر است        |
| عضو بدون شعبه = **نامحدود**                    | وگرنه روز انتشار همه قفل می‌شدند                                        |
| FEFO پیش‌فرض برای کالای تاریخ‌دار              | کالای دیررسیده می‌تواند زودتر منقضی شود                                 |
| بچ منقضی = **رد**، نه هشدار                    | حتی با انتخاب دستی اپراتور                                              |
| نرخ مالیات روی سند **منجمد** می‌شود            | فاکتور آفلاین نباید موقع sync دوباره نرخ‌گذاری شود                      |
| tax/currency/dimensions **مقصد ناوبری نیستند** | پیکربندی‌اند، از settings؛ یک nav به‌ازای هر endpoint = سایدبار بی‌مصرف |
| پول همه‌جا در **واحد صحیح**                    | ۱۵٪ روی ۳۳٫۳۳ می‌شود ۴٫۹۹۹۵                                             |
| migration را **من اجرا نمی‌کنم**               | DDL روی دفتر مالی زنده، تصمیمی است که اسم یک آدم پایش می‌خورد           |

---

## ۹. فایل‌های دانش دیگر

- `.claude/detail.md` — نقشه‌ی محصول (منبع اصلی خواسته‌ها)
- `.claude/architecture/core-modules.md` — الگوی Core، Portها، ترتیب لایه‌ها
- `.claude/architecture/performance-policy.md` — Device Class و بودجه‌های عددی
- `.claude/lessons-learned.md` — **۴۳ الگوی خطای واقعی**. قبل از هر ماژول بخوان
- `.claude/research/*-gap-analysis.md` — مقایسه با ERPNext/Odoo per module
