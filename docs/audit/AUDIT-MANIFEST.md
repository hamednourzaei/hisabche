# ممیزی ساختار Skillها و شواهد مبنای بسته

## شواهد تأییدشده از مخزن عمومی در شاخه main

1. `AGENTS.md` می‌گوید canonical است و باید پیش از هر ویرایش خوانده شود.
2. `AGENTS.md` ممنوعیت commit/push/reset/rebase، خواندن یا تغییر `.env*`، اجرای build بدون درخواست، نصب dependency بدون مجوز و Live Supabase DDL/write را تعیین می‌کند.
3. `AGENTS.md` بر workspace boundary، integer minor units، عدم استفاده از transaction در supabase-js، و RPC برای multi-table writes تأکید دارد.
4. پنج‌لایه Outcome Integrity شامل Availability، Execution، Outcome Correctness، Durability/Consistency و User-Visible Proof در `AGENTS.md` آمده است.
5. پنج Skill پایه در `.agents/skills/` وجود دارند؛ چهار محتوای Skill database/backend/architecture/code-review بازیابی و خوانده شدند. وجود پوشه debugging دیده شد اما محتوای کاملش در این بررسی در دسترس نبود.
6. سند `.claude/accounting-integrity/00-SPEC.md` صریحاً می‌گوید Unknown مساوی Zero نیست؛ `partial` و `unknown` نباید سود/حاشیه عددی تولید کنند؛ موجودی اول بدون قیمت خرید نباید cost layer صفر بسازد؛ و برخی مسائل چندارزی/انبار/افتتاحیه در سند به‌عنوان بازمانده ثبت شده‌اند.
7. سند `.claude/db-integrity/00-SPEC.md` هشدار می‌دهد که توازن سند فقط در تابع Postgres کنترل می‌شود و constraint/trigger کامل دیتابیس باید بررسی شود؛ FKهای ناقص، workspace nullable، currency defaults، و محدودیت‌های زنجیره COGS نیز مطرح شده‌اند.
8. در نقشه بسته، `packages/db-schema` و `packages/local-engine` و `packages/sync` در فهرست packages وجود دارند. این مشاهده به‌تنهایی ثابت نمی‌کند هر قابلیت در آن‌ها کامل یا production-ready است.

## محدودیت ممیزی

این کار ممیزی کامل source code یا اجرای تست نبود. GitHub خواندن فایل‌های public را فراهم کرد؛ working tree محلی، secrets، Supabase live, Render runtime و دیتابیس production در دسترس نبودند. بنابراین هیچ قابلیت جدیدی به‌عنوان implemented یا live-verified ادعا نمی‌شود.

## تصمیم بسته

به‌جای تکرار Skillهای عمومی موجود، پنج Skill دامنه‌ای ساخته شده‌اند:

- double-entry-ledger
- financial-posting-integrity
- accounting-reconciliation
- postgres-ha-dr
- financial-offline-sync

این پنج Skill باید کنار Skillهای پایه موجود استفاده شوند.
