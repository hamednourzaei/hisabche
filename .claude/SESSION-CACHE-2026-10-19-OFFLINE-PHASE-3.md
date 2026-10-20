# Session cache — Offline Edition، فاز ۳

**تاریخ:** ۱۹ اکتبر ۲۰۲۶ (نشستِ سوم)
**دامنه:** `docs/offline/OFFLINE-EDITION-PROMPT.md` → Phase 3 (اسکیمای دستگاه v3 و مایگریشن ویندوز و اندروید)
**وضعیت:** `IMPLEMENTED_NOT_LIVE_VERIFIED` — پرونده‌ی دروازه ۳ (`docs/offline/gates/3.md`) سبز است.
**شاخه:** `main`. هیچ چیزی commit یا push نشد. همه‌ی تغییرات در working tree است.

---

## ۱. آنچه انجام شد

### ۱.۱ بازبینی اسکیمای محلی و تعیین ستون‌ها (عامل A - راهبر دامنه)
- مستند `docs/offline/03-DEVICE-SCHEMA.md`: بازبینی کامل تمام ردیف‌های L و L* و تطبیق ستون‌ها با ثوابت `*_COLUMNS` بک‌اند.
- یادداشت انتقال به عامل B در `docs/offline/handoff/03.md`.
- اعمال قواعد سه‌گانه:
  1. پول در همه جا به صورت واحد خرد صحیح (`INTEGER`).
  2. مقادیر کالا (`quantity`, `qty`) با دقت اعشاری (`REAL` با اعشار بدون نوسان ارقام).
  3. ستون‌های عمومی تننسی و هماهنگی روی تمام جداول: `id, workspace_id, created_at, updated_at, deleted_at, origin, sync_state`.
  4. حذف پیش‌فرض ارزی سخت‌کد شده `'AFN'`.

### ۱.۲ پیاده‌سازی اسکیمای محلی و مایگریشن‌ها (عامل B - پلتفرم‌ها)
- **`packages/app-bridge/src/local-schema.ts`**:
  - ارتقای نسخه اسکیما: `SCHEMA_VERSION = 3`.
  - تعریف جداول جدید: `local_user`, `local_workspace`, `warehouse`, `product_stock`, `branch`, `shelf`, `cost_layer`, `cost_consumption`, `payment`, `payment_allocation`, `account`, `journal_entry`, `journal_line`, `exchange_rate`, `invoice_counter`.
  - اضافه کردن قیود تمامیت: `journal_line` دارای قید `CHECK (debit >= 0 AND credit >= 0 AND NOT (debit > 0 AND credit > 0))`.
  - به‌روزرسانی `WRITABLE_COLUMNS` و `SEARCHABLE_COLUMNS` برای تمامی ۲۲ جدول.
- **`packages/app-bridge/src/contract.ts`**:
  - به‌روزرسانی `localTableSchema` با نام تمامی جداول جدید آفلاین.
- **`packages/app-bridge/src/local-migrations.ts`**:
  - اضافه کردن مایگریشن نسخه ۳ (`V3_OFFLINE_SCHEMA`):
    - ساخت جداول جدید به همراه ایندکس‌ها.
    - افزودن ستون‌های مفقود به جداول موجود (`product`, `customer`, `invoice`, `invoice_item`, `transaction`, `inventory_movement`, `employee`).
    - تبدیل امن و یک‌باره‌ی مبالغ اعشاری شناور در ردیف‌های موجود به واحد خرد صحیح (`minor units`) با نشانگر در `meta` جهت تکرارپذیری بدون اعمال مجدد.
- **`apps/mobile/src/host/local-db.ts`**:
  - اتصال `runMigrations` و فراخوانی آن پیش از ثبت نسخه اسکیما تا هاست اندروید نیز عینا همان مایگریشن‌های مشترک را اجرا کند.

### ۱.۳ آزمون‌ها و اعتبارسنجی دروازه ۳ (عامل C - ارزیاب)
- **`apps/desktop/electron/main/db/__tests__/migrations.test.ts`**:
  - گسترش آزمون‌ها به ۸ آزمون جامع:
    - آزمون مایگریشن از v1 به v3.
    - آزمون مایگریشن دیتابیس واقعی v2 به v3 با داده‌های پولی و فاکتورها.
    - بررسی تبدیل مبالغ اعشاری به واحد خرد (مثلا `15.5` → `1550` و `245.0` → `24500`).
    - آزمون تکرار مایگریشن (اجرای دو باره) و اطمینان از حفظ ۱۰۰٪ داده‌ها بدون دوبرابر شدن مبالغ.
    - بررسی قید `CHECK` در `journal_line` (تایید سطرهای بدهکار یا بستانکار، و رد سطرهای دارای همزمان بدهکار و بستانکار یا منفی).
    - بررسی امکان درج و واکشی در جداول جدید از طریق درایور SQLite.
- مستند دروازه ۳: `docs/offline/gates/3.md`.

---

## ۲. اعدادی که اندازه‌گیری شد

```
apps/desktop         npx jest                         16 سوئیت / 186 آزمون سبز (13.47s)
apps/desktop         migrations.test.ts               8 آزمون سبز (4.63s)
apps/mobile          npx jest --passWithNoTests       13 سوئیت / 176 آزمون سبز (3.45s)
packages/validation  npx vitest run                   21 فایل / 369 آزمون سبز (1.50s)
packages/ui          one-rule-each.test.ts             71 آزمون سبز
packages/app-bridge  npx tsc --noEmit                 EXIT=0
apps/desktop         npx tsc --noEmit                 EXIT=0
apps/mobile          npx tsc --noEmit                 EXIT=0
eslint (فایل‌های تغییریافته)                           0 errors
```

---

## ۳. آنچه انجام نشد

- ساخت پکیج `packages/local-engine` (دامنه فاز ۴).
- ساخت روت‌ها و هندلرهای محلی آفلاین (دامنه فاز ۴).
- ایجاد ترنسپورت محلی و اتصال IPC/Bridge (دامنه فاز ۵).

---

## ۴. شروع نشست بعد (فاز ۴)

1. ایجاد پکیج `packages/local-engine` و نوشتن قرارداد موتور محلی (`docs/offline/handoff/engine-contract.md`).
2. پیاده‌سازی اینترفیس `LocalDb` و هندلرهای هسته (`products`, `customers`, `invoices`, `payments`, `warehouses`, `accounting`, `settings`, `backup`, `import`).
3. آزمون‌های تطابق (parity tests) خروجی JSON موتور محلی با سرویس‌های بک‌اند.
