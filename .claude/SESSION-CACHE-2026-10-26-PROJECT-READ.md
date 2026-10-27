# کش سشن — خواندن کامل پروژه (۲۶ اکتبر ۲۰۲۶)

> این فایل حاصل یک دور خواندن `.claude/` و فایل‌های ریشه است، نه حاصل اجرای تست.
> در این دور **هیچ کد پروژه تغییر نکرد**؛ فقط همین فایل نوشته شد.

---

## ۱. چه چیزی خوانده شد

**ریشه:** `CLAUDE.md` (۷۲۱ خط، کامل) · `AGENTS.md` (۴۷۴ خط، کامل) · `HANDOFF.md` · `PROJECT_STATE.md` · `SELF_CRITICAL_PROTOCOL.md`

**`.claude/`:** `README.md` · `STATE.md` · `WORKFLOW.md` · `detail.md` · `USER-REQUESTS.md` (بخش آغازین) · `architecture/{core-modules, api-surface, data-model, one-ui-two-hosts, performance-policy}.md`

**مهارت‌ها (`.claude/skills/`):** `session-rules` · `feature-delivery` · `migrations` · `scripted-edits` · `release-build` · `testing` · `database` · `backend` · `ui` · `offline` · `i18n` · `architecture` · `debugging` · `desktop` · `mobile` · `web` · `auth` · `code-review` · `lessons`

**ناوبری:** `.ai/codebase/CODEBASE_MAP.md` (۱۸۷۲ فایل، ۱۱۷۴۰ نماد، git `41031ed2`)

**وضعیت جاری:** `docs/audit/UNIVERSAL-CORE-GAP-LEDGER.md` (§E–§H) و شواهد `docs/audit/evidence/`

---

## ۲. تصحیح‌های واقعیت (مهم)

| ادعای قبلی | واقعیت امروز |
|---|---|
| `docs/audit/` وجود ندارد و گزارش قبلی ساختگی بود | **وجود دارد.** ۴۰+ فایل، شامل `launch-implementation-report.md`، `return-flow-map.md`، `n36-design.md`، `UNIVERSAL-CORE-GAP-LEDGER.md` — زمان ساخت ۲۲:۳۶ تا ۲۳:۰۳ |
| HEAD همان `7f2081f3` است | HEAD اکنون **`41031ed2`** است (کامیت‌های SEO، بیلد وب، reel، local-first) |
| فایل‌های migration ساخته نشده‌اند | **ساخته شده‌اند:** `invoice-return-01-migration.sql` (+VERIFY)، `sync-commit-horizon-migration.sql` (+VERIFY)، `universal-core-migration.sql` (+VERIFY) |

درس: پیش از هر ادعای «فایل نیست»، `Test-Path` و فهرست واقعی پوشه را ببین — حافظه‌ی خلاصه‌شده جای دیدن را نمی‌گیرد.

---

## ۳. وضعیت ثبت‌شده در دفتر شکاف (§H — دور اصلاح)

| مورد | وضعیت اعلامی | یادداشت |
|---|---|---|
| FIX 1 — N-01/N-17 (مرجوعی اتمیک) | `IMPLEMENTED_NOT_LIVE_VERIFIED` | RPC `invoice_return_create`؛ تست pg روی ویندوز بلاک (خطای 1314) |
| FIX 2 — N-36 (کرسر commit-horizon) | `IMPLEMENTED_NOT_LIVE_VERIFIED` | `txid xid8` + `sync_pull_changes`؛ تست pg بلاک |
| FIX 3 — N-44 (deviceId/batchId اجباری) | `IMPLEMENTED_NOT_LIVE_VERIFIED` | helper در `sync-identity.ts`؛ ۹ تست قرارداد |
| FIX 4 — N-37 (خطای مالیات) | `IMPLEMENTED_NOT_LIVE_VERIFIED` (محاسبه) / `NOT_IMPLEMENTED` (سند دفتر) | تصمیم حسابداری صاحب پروژه لازم است |
| FIX 5 — فهرست migration/VERIFY | `PENDING HUMAN CONFIRMATION` | هیچ‌کدام روی دیتابیس زنده اجرا نشده |

**هیچ‌کدام `VERIFIED_COMPLETE` نیست.** بدون HTTP یا دیتابیس واقعی، بالاترین وضعیت `IMPLEMENTED_NOT_LIVE_VERIFIED` است.

---

## ۴. پنج قانون و قواعد کاری (یادآوری)

1. `workspace_id` تنها مرز امنیتی؛ `user_id` هرگز فیلتر نیست.
2. نقش از `request.tenancy.role`، نه `request.userRole`.
3. پول همیشه integer در واحد کوچک؛ هیچ float روی مسیر مالی.
4. نوشتن چندجدولی = تابع Postgres + `.rpc()`؛ `DELETE` جبرانی ممنوع.
5. تست سبز اثبات نیست؛ اثبات = HTTP واقعی یا Postgres واقعی.

**ممنوع‌های ثابت:** commit/push · subagent · DDL روی دیتابیس زنده · خواندن `.env` · بیلد وسط کار · ضعیف‌کردن تست برای سبزشدن · `any`/`@ts-ignore`/`eslint-disable` · داده‌ی جعلی.

**ترتیب پایان دور:** وریفای کامل → eslint روی فایل‌های تغییرکرده (از پوشه‌ی همان پکیج) → بیلدها → درس‌ها → گزارش فارسی با اعداد واقعی.

---

## ۵. نقشه‌ی `.claude`

- `skills/` — ۲۲ مهارت؛ `hisabche-session-rules` هر سشن اول.
- `architecture/` — Core Module، سطح API، مدل داده/RLS، یک UI دو میزبان، سیاست پرفورمنس.
- `ux-audit/` — پیشنهاد ادغام ۵۷ route به ۲۴؛ **منتظر تأیید**.
- `sessions/` · `research/` · `ai-pipeline/` · `warehouse-map/` · `accounting-integrity/` · `db-integrity/` · `reverse-and-import/`
- `lessons-learned.md` (۳۳۳KB) و `BUG-REGISTRY.md` (۱۶۶KB) — دانشنامه‌اند، نه نقشه؛ نسخه‌ی distilled در `skills/hisabche-lessons`.

---

## ۶. اقدام‌های باز سمت انسان (از `USER-REQUESTS.md`)

- دیپلوی آخرین بک‌اند و وب.
- اجرای migrationهای ساخته‌شده + VERIFY و برگرداندن خروجی.
- staging با DB واقعی: `node scripts/verify-idempotency-staging.mjs`.
- روشن‌کردن Leaked Password Protection در داشبورد Auth.

---

## ۷. محدودیت‌های همین دور

- Postgres روی این ویندوز بالا نمی‌آید (خطای 1314 روی `%TEMP%`) ⇒ هر تست `*.pg.test.ts` این‌جا `BLOCKED_EXTERNAL` است.
  دستور لینوکس: `cd backend && npx vitest run --project pg <file>`
- تست‌ها در این دور **اجرا نشدند**؛ فقط خوانده شد.
- فایل‌های بزرگ (`lessons-learned.md`، `BUG-REGISTRY.md`، `TASKS-UI-AND-PRODUCT.md`) سرصفحه‌ای خوانده شدند، نه خط‌به‌خط.
