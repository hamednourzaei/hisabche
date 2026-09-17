# مدل داده — اسکیمای واقعی و RLS

> خوانده‌شده از دیتابیس زنده در ۳۱ اوت ۲۰۲۶، بعد از اجرای ۳۲ migration.
> بازتولید: `docs/_dump-schema.sql` را در SQL Editor بزن.

---

## قانون اول: `workspace_id` تنها مرز است

`user_id` می‌گوید چه کسی سطر را ساخت. **هرگز فیلتر نیست.** یک مدیر باید
فاکتوری را که فروشنده‌اش زده ببیند.

```ts
// درست
.eq('workspace_id', ctx.workspaceId)

// غلط — گارد tenancy-static-guard این را قرمز می‌کند
.eq('user_id', ctx.userId)
```

استثناهای ثبت‌شده (جدول‌های واقعاً per-user): `member_branches`،
`ui_visibility_profiles`، `audit_logs` در بخش کاربری.

---

## RLS — چطور کار می‌کند و چرا یک بار شکست

هر جدول tenant این policy را دارد:

```sql
CREATE POLICY <table>_workspace_members ON <table>
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT auth_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT auth_workspace_ids()));
```

### چرا از تابع، نه از subquery مستقیم

`auth_workspace_ids()` **SECURITY DEFINER** است — با حق مالکش اجرا می‌شود، پس
خواندن `workspace_members` داخلش policy آن جدول را دوباره صدا نمی‌زند.

⚠️ **باگی که یک بار افتاد:** `workspace_members_select` جدولی را subquery
می‌کرد که خودش از آن محافظت می‌کرد → `42P17: infinite recursion`. از روز اول
شکسته بود و هرگز دیده نشد، چون بک‌اند با `service_role` وصل می‌شود که RLS را
کامل دور می‌زند.

**قاعده:** هیچ policy روی `workspaces` یا `workspace_members` نباید آن یکی را
subquery کند. گاردش در `rls-coverage.test.ts`.

### دو جدول عمداً بدون policy

`sync_change_log` و `sync_mutations` — RLS روشن، policy هیچ. یعنی **همه‌چیز
ممنوع** برای کاربر عادی؛ فقط endpointهای sync با service_role. این
سخت‌گیرانه‌ترین حالت است، نه نقص.

---

## جدول‌های کلیدی و ستون‌هایی که غافلگیر می‌کنند

| جدول                              | نکته                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `journal_lines`                   | کلید خارجی **`journal_id`** است، نه `entry_id`                                                               |
| `journal_lines`                   | قید `one_sided_check` **validated** — یک طرف صفر، یکی نه                                                     |
| `journal_lines_archive`           | دو سطر بی‌مبلغ که قبل از قید آرشیو و حذف شدند                                                                |
| `accounts`                        | `role` (نه فقط `code`) چیزی است که posting با آن حساب پیدا می‌کند                                            |
| `stock_serials`                   | نام جدول است، **نه** `serial_units`                                                                          |
| `exchange_rates`                  | تا این سشن **وجود نداشت**                                                                                    |
| `invoices` `customers` `products` | از قبل `workspace_id` داشتند                                                                                 |
| `migration_jobs`                  | وضعیت ویزارد انتقال؛ فایل خام **ذخیره نمی‌شود**، فقط digest                                                  |
| `migration_records`               | دفتر هویت مبدأ→مقصد. ایندکس یکتا روی (workspace, entity, source_identity) — همین idempotency را تضمین می‌کند |

### ۱۴ جدولی که در این سشن `workspace_id` گرفتند

`audit_logs` `stock_movements` `suppliers` `purchase_orders` `payrolls`
`leaves` `project_time_entries` `boms` `bom_items` `work_orders`
`opportunities` `employees` `projects` `departments`

⚠️ ستون و backfill در **یک تراکنش** رفتند. اگر فقط ستون اضافه می‌شد، کوئری‌ای
که با خطای واضح `42703` می‌افتاد **موفق** می‌شد و **هیچ** برمی‌گرداند — یعنی
«این دکان هیچ حرکت انباری ندارد». خطای بلند بد است؛ دروغ ساکت بدتر.

**قاعده‌ی backfill:** workspace از «پدر» می‌آید، نه از حدس. یک حرکت انباری به
workspace کالایی تعلق دارد که جابه‌جا شده. سطری که به هیچ پدری نرسید NULL
می‌ماند و شمرده می‌شود.

---

## نقش‌ها

**نقش workspace (حقیقت سرور):** `owner | manager | seller`

⚠️ `packages/auth-core` مجموعه‌ی **متفاوتی** دارد
(`owner|admin|member|viewer`) که فقط برای نمایش سمت کلاینت است. هرگز مبنای
مجوز نیست.

⚠️ `'admin'` نقش workspace **نیست**. یک شاخه‌ی `userRole === 'admin'` در
تأیید گردش‌کار وجود داشت که برای اعضای واقعی دست‌نیافتنی و برای غریبه‌ها یک
دور زدن بود. حذف شد.

---

## انتقال داده (Data Migration)

شناسه‌ی مبدأ **هرگز** کلید اصلی حسابچه نیست. `migration_records` جدول ترجمه
است و اجرای دوباره‌ی همان فایل، به‌جای ساختن رکورد دوقلو، همان ردیف را
به‌روز می‌کند.

⚠️ پول در پارسر با **واحد صحیح (minor)** خوانده می‌شود، ولی
`customers.opening_balance` و قیمت‌های `products` در واحد **major** ذخیره
می‌شوند. تبدیل فقط در `toMajor()` داخل `migration.service.ts` رخ می‌دهد —
تنها درز بین این دو.

⚠️ مانده‌ی اولیه در به‌روزرسانی **بازنویسی نمی‌شود**. حالت حساب در آغاز دفتر
است و تراکنش‌ها از آن زمان جابه‌جایش کرده‌اند.

فقط `csv` و `tsv`. قید دیتابیس هم همین دو را می‌پذیرد، تا سطری که ادعای
`xlsx` دارد اصلاً ساخته نشود.

---

## پول

همه‌جا **واحد صحیح** (`amountMinor: number`). `roundHalfAwayFromZero` برای
تقارن، تا برگشت سند دقیقاً اصل را خنثی کند.

`/100` فقط در لبه‌ی نمایش — در `Money` و `MinorInput` از `capability-kit`.

---

## Offline / sync

`syncEntitySchema` در `packages/validation/src/schemas/sync-protocol.schema.ts`:

```
invoice · customer · product · transaction · time_entry
```

عمداً **بیرون**: بودجه، ابعاد، صورتحساب بانکی، نرخ ارز، دارایی ثابت.
دلیل هرکدام در `backend/src/__tests__/offline-contract.test.ts`.

هر موجودیت باید سه جا همزمان داشته باشد: `ENTITY_TABLE`، `WRITABLE` (allow-list
ستون‌ها) در `sync.service.ts`، و `DEFAULT_RETENTION` در `packages/sync/src/gc.ts`.

⚠️ `invoice_id` روی `time_entry` **قفل صورتحساب** است و دستگاه نباید بنویسدش.
روی `transaction` همان فیلد مجاز است — پرداختی که سر پیشخوان ثبت می‌شود
می‌داند کدام فاکتور را می‌پردازد.

---

## اسکریپت‌های تشخیصی

| فایل                              | کار                                          |
| --------------------------------- | -------------------------------------------- |
| `docs/_dump-schema.sql`           | کل اسکیما در یک سلول متنی                    |
| `docs/_inspect.sql`               | جدول‌ها، RLS، سطرهای خراب                    |
| `docs/_verify-after.sql`          | ۸ بررسی پس از migration                      |
| `docs/_verify-rls.sql`            | RLS واقعی با نقش `authenticated` — بدون پیست |
| `scripts/check-schema-drift.mjs`  | ستون ناموجود، **بدون** DB                    |
| `scripts/compare-live-schema.mjs` | کد در برابر **دامپ زنده**                    |

⚠️ `check-schema-drift` فایل‌های migration را با هم مقایسه می‌کند —
«اگر همه‌چیز روی دیتابیس خالی اجرا می‌شد درست بود؟». برای «آیا با دیتابیس
واقعی می‌خواند؟» از `compare-live-schema.mjs` با دامپ استفاده کن. تفاوت این
دو، ۲۱ ناسازگاری را نشان داد.

> ⚠️ **۲۰۲۶-۰۹-۱۷ — روی دیتابیس زنده `auth_workspace_ids()` وجود ندارد** (خطای 42883 هنگام اجرای `docs/customer-360-phase3-migration.sql`). تا کاربر وجودش را با `SELECT proname FROM pg_proc WHERE proname = 'auth_workspace_ids'` تأیید نکرده، در migration جدید از الگوی زنده‌ی `tenant-isolation-closure-migration.sql` استفاده کن: `workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL)`.
