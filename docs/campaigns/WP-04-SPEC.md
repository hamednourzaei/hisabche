# WP-04 — مشخصات اجرا: رول، برش، باقیمانده، ضایعات و مسیر سرور

> سند دستی. مبنا: ردیف `roll_cutting` در `docs/campaigns/WORK-PACKAGES.md` و
> قاعدهٔ موجود `packages/validation/src/schemas/universal-core/roll-batch.domain.ts`.

## وضعیت پیش از اجرا

| قابلیت         | وضعیت   | موتور | لایههای غایب                    | محدودیت                        |
| -------------- | ------- | ----- | ------------------------------- | ------------------------------ |
| `roll_cutting` | partial | —     | service, route, local, hook, ui | `NO_SERVER_ROUTE_OR_UI_PICKER` |

`consumeRollLength` و `convertBatchQuantity` پیش از این وجود داشتند، ولی هیچ لایهٔ محصولی
به آنها وصل نبود: نه جدول، نه مسیر سرور، نه موتور محلی، نه Hook و نه UI.

## آنچه پیاده میشود

### 1. قواعد مشترک (`packages/validation/src/schemas/universal-core/roll-cutting.domain.ts`)

- `splitRollCut` — برش را به **قابل فروش** + **ضایعات** تقسیم میکند و باقیماندهٔ رول
  را بهروز میکند. برش بیش از باقیمانده یا ضایعات منفی رد میشود.
- `returnToRoll` — برگشت فقط به **همان رول** و حداکثر به اندازهای که مصرف شده بود؛
  رول دیگری نمیتواند طول برگشتی را بگیرد.
- `rollCostOf` — بهای تمامشدهٔ مصرفشده و باقیمانده بر حسب **واحد پولی صحیح** (minor
  units). طول یا بهای ناشناخته → `null`، هرگز صفر.
- `convertBatchQuantity` (موجود) — تبدیل بر اساس ضریب مخصوص همان رول.

### 2. موتور محلی (`packages/local-engine/src/routes/rolls.ts`)

- هویت رول: شماره، طول اولیه، طول باقیمانده، محل، بها و ضریب تبدیل.
- جداول `local_rolls` و `roll_movements` + مهاجرت محلی `V33` (`SCHEMA_VERSION=33`).
- مصرف/برش/برگشت **اتمیک** با `UPDATE … WHERE remaining_length >= ?` داخل transaction:
  دو عمل همزمان روی همان رول نمیتوانند دو بار بفروشند.
- every write idempotent via `client_request_id`.
- تمام نوشتها capability-guarded.

### 3. مسیر سرور (`backend/src/routes/roll-cutting.routes.ts`)

- `GET /api/rolls`, `GET /api/rolls/:id`, `GET /api/rolls/report`
- `POST /api/rolls` · `POST /api/rolls/:id/consume` · `POST /api/rolls/:id/return`
- مصرف و برگشت از طریق تابع Postgres اتمیک `roll_apply_movement` با `.rpc()` —
  یک transaction، قفل سطر، و کلید idempotency. migration:
  `docs/roll-cutting-01-migration.sql` + `docs/VERIFY-roll-cutting-01.sql` +
  `backend/src/__tests__/roll-cutting-01.pg.test.ts`.

### 4. Hook و UI

- ۶ Hook مبتنی بر `localRequest` (درگاه محلی) — مسیر سرور جعلی ساخته نمیشود.
- پنل `rolls-panel` در shared UI که مصرف/برش/برگشت را در همان صفحه انجام میدهد.
- کلیدهای سهزبانهٔ لازم در `fa` / `af` / `en`.

## معیار خروج

- فروش ۱۲٫۵ متر از رول ۵۰ متری → باقیمانده ۳۷٫۵ متر.
- برگشت همان رول، طول مصرفشده را برمیگرداند؛ رول دیگری را تحت تأثیر نمیدهند.
- دو دستگاه همزمان → فروش مضاعف صفر (قفل سطر / conditional update).
- گزارش «موجودی بر حسب رول» با متر و بهای تمامشده.
- بهای ناشناخته «صفر» نمیشود.

## آنچه انجام نمیشود

- وصل کردن رول به **خط فاکتور** (انتخاب رول روی خط فروش) — محدودیت صادقانهٔ
  `ROLL_INVOICE_LINE_PICKER_MISSING` باقی میماند.
- اجرای migration روی Supabase زنده — فقط فایلها تولید میشوند؛ مالک اجرا میکند.

## حکم

`IMPLEMENTED_NOT_LIVE_VERIFIED` — شاهد PG زنده مسدود است (`SeCreateGlobalPrivilege`).
