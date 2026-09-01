# به باگ خوردی؟ اول این را بخوان

> هدف: به‌جای گشتن کل پروژه، در ۳۰ ثانیه بفهمی کجا را نگاه کنی.
> هر ردیف یک باگ **واقعی** است که در این پروژه اتفاق افتاده.

---

## جدول علائم → علت

| چه می‌بینی                                            | تقریباً همیشه این است                                                 | کجا                                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `Element type is invalid … got: undefined` در سایدبار | آیکون lucide که بهینه‌ساز نکست به namespace حل می‌کند                 | `nav-items.ts` — آیکون را با یکی از **آیکون‌های اثبات‌شده‌ی همان فایل** عوض کن |
| صفحه ۴۰۴ ولی روت هست                                  | prefix یا متد فرق دارد (governance=**PUT**، products=**PATCH**)       | `.claude/architecture/api-surface.md`                                          |
| `Invalid time value`                                  | `Intl` روی تاریخ نامعتبر پرتاب می‌کند                                 | `packages/ui/src/lib/utils.ts` — `Number.isNaN(d.getTime())`                   |
| کوئری موفق ولی **هیچ** برمی‌گرداند                    | ستون اضافه شد، backfill نشد                                           | `node scripts/compare-live-schema.mjs`                                         |
| `42P17 infinite recursion`                            | policy روی `workspaces`/`workspace_members` آن یکی را subquery می‌کند | `docs/rls-recursion-fix-migration.sql`                                         |
| `42703 column does not exist`                         | drift کد در برابر دیتابیس زنده                                        | `compare-live-schema.mjs`، **نه** `check-schema-drift`                         |
| تغییر UI دیده نمی‌شود                                 | dev server وب `packages/ui` را rebuild نمی‌کند                        | **اول سرور را ری‌استارت کن**، بعد دنبال باگ بگرد                               |
| کلاس `max-h-[60vh]` بی‌اثر                            | Tailwind سورس `packages/ui` را اسکن نمی‌کند                           | `style={{ maxHeight: … }}`                                                     |
| پنل داخل جدول بریده می‌شود                            | `overflow-x-auto` کلیپ می‌کند؛ z-index کمکی نمی‌کند                   | `createPortal` + `position: fixed`                                             |
| radix `SelectItem` خطا                                | مقدار خالی نمی‌پذیرد                                                  | sentinel (`__all` → `undefined`)                                               |
| تست IDOR قرمز شد                                      | کوئری روی جدول مشترک `.eq('workspace_id')` ندارد                      | همان کوئری — **همیشه** اول workspace                                           |
| تأیید گردش‌کار کار نمی‌کند                            | `request.userRole` برای کاربر چند-workspace خالی است                  | `request.tenancy.role`                                                         |

---

## قبل از هر تغییر، این ۳ را بدان

**۱. `workspace_id` تنها مرز است.** `user_id` فقط بازیگر را ثبت می‌کند.
هیچ کوئری روی جدول مشترک بدون `.eq('workspace_id', ctx.workspaceId)` نیست —
حتی کوئری‌ای که بلافاصله بعدش workspace را چک می‌کند. (این دقیقاً باگی بود که
`tenancy-idor.test.ts` در `scope.service.ts` گرفت.)

**۲. supabase-js تراکنش ندارد.** نوشتن چندجدولی → تابع Postgres + `.rpc()`.
`DELETE` جبرانی ممنوع.

**۳. تست سبز اثبات نیست.** `scope.domain.ts` یک سشن کامل درست و تست‌شده بود و
**هیچ‌کس صدایش نمی‌زد**؛ فروشنده همچنان می‌توانست فاکتور دیگری را ویرایش کند.
برای همین `scope-wiring-guard.test.ts` وجود دارد: قانون امنیتی باید **صدا زده
شود**، نه فقط نوشته.

---

## دستورهای وریفای (حفظ کن، نساز)

```bash
npx turbo run type-check                      # ۱۷ پکیج
cd backend && npx vitest run                  # ۱۲۳۹ تست
cd packages/ui-contract && npx vitest run     # ۴۲۴ تست
npx turbo run build --filter=@hisabche/web --filter=@hisabche/desktop
```

commit فقط **error** های eslint را مسدود می‌کند، نه warning.
lint-staged بعد از شکست تکه‌ی اول بقیه را skip می‌کند — پس خودت همه را یک‌جا بزن:

```bash
git diff --cached --name-only | grep -E '\.(ts|tsx)$' | xargs npx eslint
```

---

## تله‌های ابزاری (هر کدام وقت واقعی گرفته)

⚠️ **`cd` بین فراخوانی‌های Bash می‌ماند.** یک اسکریپت با مسیر نسبی چهار صفحه را
داخل `packages/ui-contract/apps/web/...` ساخت. **همیشه اول `cd` به ریشه‌ی مطلق.**

⚠️ **`node -e "…"` در bash: backtick داخل رشته‌ی دوتایی اجرا می‌شود** و کامنت را
خالی می‌گذارد. برای متن دارای backtick از **فایل پایتون** استفاده کن.

⚠️ **heredoc پایتون با محتوای طولانی/کوت‌دار می‌شکند.** اسکریپت را در scratchpad
بنویس و `python3 <path>` بزن.

⚠️ **`git stash -u` روی این مخزن دردسر دارد** — pop با تعارض می‌ایستد و stash را
نگه می‌دارد. برای ایزوله کردن باگ، فایل را **نقطه‌ای** برگردان.

⚠️ **regex روی JSX:** `[^>]*` نمی‌شود — `=>` یک `>` دارد. `(?<!=)>` یا `[\s\S]*?`.

⚠️ **گاردی که سورس می‌خواند باید اول کامنت را حذف کند**، وگرنه کامنتِ توضیحِ یک
رفع، همان رفع را قرمز می‌کند.

---

## گاردها — اگر قرمز شد، کد را درست کن نه تست را

| تست                     | چه چیزی را می‌گیرد                                 |
| ----------------------- | -------------------------------------------------- |
| `tenancy-idor`          | کوئری بدون `workspace_id` روی جدول مشترک           |
| `tenancy-static-guard`  | فیلتر با `user_id`                                 |
| `rls-coverage`          | جدول tenant بدون RLS/policy؛ بازگشت بی‌نهایت       |
| `workspace-guard-order` | ترتیب گاردها؛ `request.userRole`                   |
| `client-route-contract` | مسیر کلاینت که روی سرور نیست                       |
| `nav-destinations`      | مقصد nav بدون صفحه (فایل‌سیستم را می‌خواند)        |
| `scope-wiring-guard`    | قانون scope که **صدا زده نمی‌شود**                 |
| `consolidation`         | حقیقت رویدادِ **پنجم**؛ دو مسیر به یک مقصد         |
| `design-system-guard`   | رنگ خام، حرکت بدون `motion-reduce`، متن در قرارداد |
| `migration-recovery`    | rollback که ردیف وابسته‌دار را پاک کند             |
| `offline-contract`      | ماژولی که sync می‌شود بدون دلیل ثبت‌شده            |

⚠️ **گارد `nav-destinations` فایل‌سیستم را می‌خواند** — برای همین چهار صفحه‌ی
دامنه، چهار فایل جدا هستند نه یک روت `[domain]`: پوشه‌ی براکت‌دار را نمی‌بیند.
