# دستورالعمل جامع انتشار نسخه پروداکشن (Production Release Runbook)

این سند مرجع رسمی و نهایی برای استقرار نسخه عملیاتی هیسابچه (Universal Core Release) است. کلیه مراحل به صورت ترتیبی، برگشت‌پذیر و آزموده شده تدوین شده‌اند.

---

## فهرست فازهای عملیاتی

1. **فاز صفر:** بررسی‌های پیش از پرواز (Preflight Checks)
2. **فاز یک:** اجرای میگریشن‌های سه‌گانه دیتابیس Supabase
3. **فاز دو:** استقرار بک‌اند روی سرور Render
4. **فاز سه:** استقرار وب‌اپلیکیشن روی Vercel
5. **فاز چهار:** تست‌های دود نهایی (Post-Deploy Smoke Tests)
6. **فاز اضطراری:** دستورالعمل بازیابی به وضعیت قبلی (Emergency Rollback)

---

## فاز صفر: بررسی‌های پیش از پرواز (Preflight)

پیش از هر اقدامی، اسکریپت پیش‌پرواز را اجرا کنید تا از سلامت کاتالوگ کد و تایپ‌اسکریپت اطمینان حاصل شود:

```bash
node scripts/release/preflight.mjs
```

**شرط ورود به فاز بعد:** خروجی `0 FAILED` باشد.

---

## فاز یک: اجرای میگریشن‌های Supabase

سه میگریشن باید دقیقاً به ترتیب زیر اعمال شوند. برای هر میگریشن، اسکریپت اعتبارسنجی متناظر بلافاصله اجرا می‌شود.

### ۱. میگریشن Universal Core Policies

- **فایل اجرایی:** `docs/universal-core-migration.sql`
- **فایل اعتبارسنجی:** `docs/VERIFY-universal-core.sql`
- **دستور رول‌بک در صورت شکست:**
  ```sql
  ALTER TABLE public.workspaces DROP COLUMN IF EXISTS business_type;
  ALTER TABLE public.workspaces DROP COLUMN IF EXISTS core_policies;
  ```

### ۲. میگریشن Invoice Returns Engine

- **فایل اجرایی:** `docs/invoice-return-01-migration.sql`
- **فایل اعتبارسنجی:** `docs/VERIFY-invoice-return-01.sql`
- **دستور رول‌بک در صورت شکست:**
  ```sql
  DROP FUNCTION IF EXISTS public.invoice_return_create(uuid, uuid, int, jsonb, jsonb);
  DROP TABLE IF EXISTS public.invoice_return_lines;
  DROP TABLE IF EXISTS public.invoice_returns;
  ```

### ۳. میگریشن Commit Horizon Sync Pull

- **فایل اجرایی:** `docs/sync-commit-horizon-migration.sql`
- **فایل اعتبارسنجی:** `docs/VERIFY-sync-commit-horizon.sql`
- **دستور رول‌بک در صورت شکست:**
  ```sql
  DROP FUNCTION IF EXISTS public.sync_pull_changes(uuid, bigint, int);
  DROP INDEX IF EXISTS public.sync_change_log_ws_version_idx;
  DROP INDEX IF EXISTS public.sync_change_log_txid_idx;
  ALTER TABLE public.sync_change_log DROP COLUMN IF EXISTS txid;
  ```

---

## فاز دو: استقرار بک‌اند روی Render

1. ادغام تغییرات در برانچ `main`:
   ```bash
   git checkout main
   git merge release-close
   git push origin main
   ```
2. Render به صورت خودکار تغییرات را با دستور `bash render-build.sh` بیلد می‌کند.
3. در داشبورد Render، لاگ‌های سرویس `hisabche-api` را رصد کنید.
4. مسیر بررسی سلامت Render بر روی `/ready` تنظیم شده است و تنها پس از اتصال موفق به Supabase مقدار 200 برمی‌گرداند.

---

## فاز سه: استقرار وب‌اپلیکیشن روی Vercel

1. داشبورد Vercel بیلد Next.js را شروع می‌کند (`pnpm build`).
2. بررسی کنید که متغیرهای زیر فعال باشند:
   - `NEXT_PUBLIC_API_URL`: آدرس پروداکشن بک‌اند Render
   - `NEXT_PUBLIC_SUPABASE_URL`: آدرس سوپابیس
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: کلید ناشناس سوپابیس
3. پس از اتمام دیپلوی، آدرس دامنه اصلی را بررسی کنید.

---

## فاز چهار: تست‌های دود نهایی (Smoke Tests)

اسکریپت زیر را با آدرس لایو اجرا نمایید:

```bash
BASE_URL="https://api.hisabche.com" node scripts/release/smoke.mjs
```

- بررسی مسیر `/live` (Liveness)
- بررسی مسیر `/ready` (Database Readiness)
- بررسی عملکرد کش و CORS

---

## فاز اضطراری: دستورالعمل رول‌بک (Emergency Rollback)

اگر پس از دیپلوی خطای بحرانی یا قطعی در سیستم مشاهده شد:

### ۱. رول‌بک بک‌اند در Render

1. در داشبورد Render به سربرگ `Deploys` بروید.
2. روی دیپلوی موفق قبلی کلیک کرده و گزینه `Rollback to this deploy` را بزنید.

### ۲. رول‌بک فرانت‌اند در Vercel

1. در داشبورد Vercel به سربرگ `Deployments` بروید.
2. روی آخرین نسخه پایدار قبلی کلیک کرده و گزینه `Promote to Production` را انتخاب کنید.

### ۳. رول‌بک میگریشن‌های دیتابیس

دستورات رول‌بک قید شده در بخش فاز یک را به ترتیب معکوس (۳ سپس ۲ سپس ۱) در SQL Editor اجرا کنید.
اطلاعات قبلی دست‌نخورده باقی خواهند ماند زیرا میگریشن‌ها افزایشی و غیرمخرب بوده‌اند.
