# چک‌لیست گام‌به‌گام مالک محصول برای انتشار (Owner Steps Checklist)

این سند مراحل اجرایی و قطعی را که صرفاً توسط مالک محصول دارای دسترسی به محیط‌های ابری (Supabase, Render, Vercel) قابل انجام است، به ترتیب مشخص می‌کند.

---

## ۱. تهیه پشتیبان پایگاه داده (PITR / Backup)

قبل از اجرای هرگونه میگریشن روی دیتابیس لایو سوپابیس:

1. وارد پنل سوپابیس پروژه شوید: `Database -> Backups`
2. یک نقطه بازیابی فوری (Point-in-Time Recovery Snapshot) تهیه کنید.

---

## ۲. اجرای میگریشن‌ها در دیتابیس Supabase (به ترتیب)

سه فایل میگریشن را **یکی پس از دیگری** در Supabase SQL Editor اجرا کرده و بلافاصله اسکریپت تاییدیه (`VERIFY`) متناظر را اجرا کنید:

### گام ۲-۱: Universal Core Policies

1. اجرای فایل: `docs/universal-core-migration.sql`
2. اجرای فایل اعتبارسنجی: `docs/VERIFY-universal-core.sql`
   - _خروجی مورد انتظار:_ تمام enumها، توابع و ستون‌های تنظیمی با وضعیت معتبر گزارش شوند.

### گام ۲-۲: Invoice Returns Engine

1. اجرای فایل: `docs/invoice-return-01-migration.sql`
2. اجرای فایل اعتبارسنجی: `docs/VERIFY-invoice-return-01.sql`
   - _خروجی مورد انتظار:_ وجود تابع `invoice_return_create` با آرگومان‌های صحیح و پارامتر `p_fraction_digits`.

### گام ۲-۳: Commit Horizon Sync Pull

1. اجرای فایل: `docs/sync-commit-horizon-migration.sql`
2. اجرای فایل اعتبارسنجی: `docs/VERIFY-sync-commit-horizon.sql`
   - _خروجی مورد انتظار:_ وجود تابع `sync_pull_changes` و ستون `txid` روی `sync_change_log`.

> **نکته در صورت بروز خطا:** در صورتی که هر یک از مراحل با خطا متوقف شد، بلوک `-- Rollback:` داخل همان فایل میگریشن را اجرا نمایید.

---

## ۳. اجرای تست‌های Postgres روی سرور لینوکس (CI/Linux)

به دلیل خطای ویندوز (Windows 1314 - privilege not held برای embedded-postgres)، تست‌های واقعی دیتابیس روی لینوکس اجرا می‌شوند:

```bash
cd backend
npx vitest run --project pg
```

_تعداد تست‌ها: ۸۵ فایل تست پستگرس باید سبز شوند._

---

## ۴. بررسی متغیرهای محیطی در Render و Vercel

### متغیرهای حیاتی Backend در Render:

- `NODE_ENV=production`
- `NODE_VERSION=22.22.0`
- `SUPABASE_URL=https://<your-project>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=<service-role-key>`
- `PORT=3000`
- مسیر بررسی سلامت در Render: `/ready` (تأیید شده که در `render.yaml` تنظیم است)

### متغیرهای حیاتی Frontend در Vercel:

- `NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>`
- `NEXT_PUBLIC_API_URL=https://<your-render-backend-url>`

---

## ۵. ادغام برانچ و استقرار روی Git

پس از تایید مراحل بالا:

```bash
git checkout main
git merge release-close
git push origin main
```

استقرار به صورت خودکار از طریق Render و Vercel آغاز می‌شود.

---

## ۶. اجرای تست‌های پس از استقرار (Smoke Tests)

پس از بالا آمدن سرور در Render:

```bash
BASE_URL="https://<your-render-backend-url>" node scripts/release/smoke.mjs
```

این اسکریپت اندپوینت‌های `/live`، `/ready` و جریان‌های اصلی را تست کرده و گزارش سلامت نهایی را نمایش می‌دهد.
