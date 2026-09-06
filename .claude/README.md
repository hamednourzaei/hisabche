# حسابچه — نقطه‌ی ورود دانش

> **این فایل را اول بخوان.** هدفش این است که برای هر سوالی بدانی کجا را باز
> کنی، به‌جای اینکه کل کدبیس یا کل سشن قبلی را بگردی.

---

## پیدا کردن جواب — جدول مسیریابی

| سوال                                                 | فایل                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **«الان کجای فازها هستیم؟ چه چیزی نیمه‌تمام است؟»**  | [HANDOFF-PHASES-G-TO-O.md](HANDOFF-PHASES-G-TO-O.md) — **اول این**                   |
| **به باگ خوردم / چطور وریفای کنم؟**                  | [DEBUG-PLAYBOOK.md](DEBUG-PLAYBOOK.md) — اول این                                     |
| «الان چه چیزی کار می‌کند و چه چیزی نه؟»              | [STATE.md](STATE.md)                                                                 |
| «چرا این‌طوری نوشته شده؟» / «قبلاً چه اشتباهی شد؟»   | [lessons-learned.md](lessons-learned.md) — ۷۵ درس                                    |
| «کد جدید را کجا بگذارم؟»                             | [architecture/core-modules.md](architecture/core-modules.md)                         |
| «چه روتی هست؟ کدام hook به کدام endpoint می‌زند؟»    | [architecture/api-surface.md](architecture/api-surface.md)                           |
| «جدول‌ها چه شکلی‌اند؟ RLS چطور کار می‌کند؟»          | [architecture/data-model.md](architecture/data-model.md)                             |
| «چطور migration بزنم / تست کنم / commit کنم؟»        | [WORKFLOW.md](WORKFLOW.md)                                                           |
| **«Source of Truth هر داده کدام است؟»**              | [SESSION-2026-09-05-CONSOLIDATION.md](SESSION-2026-09-05-CONSOLIDATION.md)           |
| «کدام migration اجرا شده و کدام نه؟»                 | [SESSION-2026-09-05-CONSOLIDATION.md](SESSION-2026-09-05-CONSOLIDATION.md)           |
| «سشن قبل چه شد؟»                                     | [SESSION-2026-08-31.md](SESSION-2026-08-31.md)                                       |
| «فازهای نقشه‌راه UX چه شد؟ چه چیزی عمداً ساخته نشد؟» | [SESSION-2026-08-31-PHASES.md](SESSION-2026-08-31-PHASES.md)                         |
| «قرارداد وضعیت / فهرست / نما / صف کار کجاست؟»        | `packages/ui-contract/src/{work-state,list-engine,entity-views,work-queue,shell}.ts` |
| «کندی، بودجه‌ی عملکرد»                               | [architecture/performance-policy.md](architecture/performance-policy.md)             |
| «مقایسه با ERPNext/Odoo»                             | [research/](research/)                                                               |
| محصول، خواسته‌های اصلی                               | [detail.md](detail.md)                                                               |

---

## پنج قانونی که همه‌چیز بر آن‌هاست

**۱. `workspace_id` تنها مرز امنیتی است.**
`user_id` می‌گوید چه کسی کاری کرد — **هرگز** فیلتر نیست. سرویس‌ها
`TenancyContext` می‌گیرند، نه `userId`.

**۲. نقش را از `request.tenancy.role` بخوان، نه `request.userRole`.**
دومی برای کاربری که در بیش از یک workspace است **خالی** است. این باگ تأیید
فاکتور را کاملاً از کار انداخته بود.

**۳. پول همیشه در واحد صحیح (minor units).**
`amountMinor: number` — عدد صحیح. `/100` فقط در لبه‌ی نمایش.

**۴. supabase-js تراکنش ندارد.**
هر نوشتن چندجدولی باید تابع Postgres باشد و با `.rpc()` صدا زده شود.
**`DELETE` جبرانی ممنوع** — درس شماره ۳.

**۵. تست سبز اثبات نیست.**
۱۰۶۴ تست سبز سه ستون ناموجود و یک حلقه‌ی بی‌نهایت RLS را پنهان کرده بود.
اثبات یعنی HTTP واقعی یا دیتابیس واقعی.

---

## ساختار مخزن

```
backend/          Fastify + supabase-js + zod + vitest
  src/routes/     ۳۷ فایل روت
  src/services/   ۲۱ Core (domain / service / repository / port)
  src/__tests__/  ۴۲ فایل تست
packages/
  api/            hookهای TanStack Query — تنها راه تماس با بک‌اند
  ui/             کامپوننت‌های مشترک وب + دسکتاپ
  ui-contract/    NAV_CONTRACT، سیاست‌های خالص، بدون DOM
  validation/     زود اسکیماها + قرارداد sync
  i18n/           fa / af / en
  offline/ sync/ store/ auth-core/ formatting/ mobile-ui/
apps/
  web/            Next.js — صفحه‌ی نازک، منطق در packages/ui
  desktop/        Electron — همان containerها از @hisabche/ui/screens
  mobile/         Expo — صفحه‌ی native، همان hookها
  admin/
docs/             migrationهای SQL + اسکریپت‌های تشخیصی (`_*.sql`)
scripts/          migration، وریفای، drift-check، bundle
```

---

## جریان یک قابلیت (لایه‌ی عمودی)

یک Core با دامنه‌ی سبز **قابلیت نیست**. کامل یعنی هر هفت لایه:

```
domain.ts      قوانین خالص — بدون DB، بدون شبکه
service.ts     ارکستراسیون — TenancyContext می‌گیرد
routes.ts      authenticate → requireWorkspaceContext → requireCapability
migration      جدول + RLS + policy در docs/*.sql
hooks          packages/api/src/hooks/<x>.ts
container      packages/ui/.../containers/ — وب و ویندوز هر دو مصرف می‌کنند
page           صفحه‌ی نازک در هر سه اپ
```

**ترتیب ساخت UI: وب → ویندوز → موبایل.**

قفل‌کننده‌ها: `vertical-slice-integration.test.ts` (پنج لایه‌ی اول) و
`nav-destinations.test.ts` (دو لایه‌ی آخر).

---

## گاردهایی که قبل از تغییر باید بشناسی

اگر یکی از این‌ها قرمز شد، **کد را درست کن، نه تست را** — مگر اینکه تست واقعاً
اشتباه باشد (که هم اتفاق افتاده و در درس‌ها ثبت شده).

| تست                     | چه چیزی را قفل می‌کند                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `tenancy-static-guard`  | هیچ جدول مشترکی با `user_id` فیلتر نشود                                                                |
| `rls-coverage`          | هر جدول tenant، RLS + policy دارد؛ policy روی `workspaces`/`workspace_members` آن یکی را subquery نکند |
| `workspace-guard-order` | گاردها به ترتیب؛ مجوز از `request.userRole` گرفته نشود                                                 |
| `client-route-contract` | هر مسیر کلاینت روی سرور با همان متد باشد                                                               |
| `offline-contract`      | هر ماژول sync می‌شود یا نه، و **چرا**                                                                  |
| `authorization-rules`   | هر روت مالی `requireCapability` دارد                                                                   |
| `nav-destinations`      | هر مقصد NAV_CONTRACT روی هر سه پلتفرم صفحه دارد                                                        |
| `http-e2e-business-day` | توازن دفتر بعد از هر قدم یک روز کاری                                                                   |
| `http-migration`        | ویزارد انتقال روی HTTP واقعی: گارد، idempotency، جداسازی workspace                                     |

---

## تصمیم‌هایی که دوباره بحث نکن

| تصمیم                                          | چرا                                                                                                                   |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| SoD پیش‌فرض **خاموش**                          | اکثر workspaceها یک‌نفره‌اند                                                                                          |
| عضو بدون شعبه = **نامحدود**                    | وگرنه روز انتشار همه قفل می‌شدند                                                                                      |
| FEFO پیش‌فرض برای کالای تاریخ‌دار              | کالای دیررسیده می‌تواند زودتر منقضی شود                                                                               |
| بچ منقضی = **رد**، نه هشدار                    | حتی با انتخاب دستی اپراتور                                                                                            |
| نرخ مالیات روی سند **منجمد** می‌شود            | فاکتور آفلاین نباید موقع sync دوباره نرخ‌گذاری شود                                                                    |
| tax/currency/dimensions **مقصد ناوبری نیستند** | پیکربندی‌اند؛ یک nav به‌ازای هر endpoint = سایدبار بی‌مصرف                                                            |
| بودجه/ابعاد/بانک/ارز/دارایی **sync نمی‌شوند**  | دلیل هرکدام در `offline-contract.test.ts`                                                                             |
| migration را **دستیار اجرا نمی‌کند**           | DDL روی دفتر مالی زنده، تصمیمی است که اسم یک آدم پایش می‌خورد                                                         |
| ورود داده فقط **CSV/TSV**                      | پارسر امن همین است. xlsx یک zip است و dump پستگرس می‌تواند کد اجرا کند — تا وقتی پارسر ایزوله نداریم، تبلیغش دروغ است |
| فایل آپلودی **ذخیره نمی‌شود**                  | در همان درخواست خوانده و دور ریخته می‌شود؛ فقط digest می‌ماند. چیزی که نگه نداری، نشت نمی‌کند                         |
| فاکتور و پرداخت **وارد نمی‌شوند**              | سطر صفحه‌گسترده سند حسابداری نیست؛ ساختش بدون سرویس دفتر، یک حقیقت مالی دوم می‌سازد                                   |
