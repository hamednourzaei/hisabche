# وضعیت: مستندات، Patch ها، و کارهای باز

> نوشته شد تا سشن بعدی این‌ها را دوباره کشف نکند. هر ادعای اینجا با کد یا با
> خروجی واقعی تأیید شده — چیزی که تأیید نشده صریحاً «تأییدنشده» علامت خورده.

---

## ۱. باگ ۵۰۰ مستندات — حل شد، و **دوبار** اتفاق افتاده

### علت قطعی

```
digest: 'DYNAMIC_SERVER_USAGE'   روی /[lang]/docs/[slug]
```

یک صفحه زیر `app/[lang]/` که متنش را با `getMessages()` می‌خواند، locale را از
**request** می‌گیرد. اگر `generateStaticParams` داشته باشد، Next می‌خواهد
**استاتیک prerender** کند — و در prerender اصلاً request وجود ندارد.

⚠️ **`next build` موفق می‌شود و `next dev` هم درست رندر می‌کند.** فقط
production که واقعاً prerender می‌کند ۵۰۰ می‌دهد. به همین دلیل تا production
پیدا نمی‌شود.

در خروجی build اینطور دیده می‌شود:

```
ƒ /[lang]/docs          ← درست (dynamic)
● /[lang]/docs/[slug]   ← ۵۰۰ می‌دهد (SSG)
```

### چرا دوبار

اول روی `app/[lang]/features/[slug]/page.tsx` افتاد، تشخیص داده شد، و دلیلش
در کامنت **همان فایل** نوشته شد. بعد دقیقاً همان اشتباه در docs تکرار شد، چون
کامنت در یک فایل جلوی اشتباه در فایل دیگر را نمی‌گیرد.

### گارد

`packages/ui/src/__tests__/next-dynamic-server-usage.test.ts` — هر صفحه‌ی
app router را اسکن می‌کند و روی ترکیب `generateStaticParams` +
(`getMessages`/`getTranslations`/`headers`/`cookies`) fail می‌شود، مگر
`setRequestLocale` استفاده شده باشد (راه رسمی next-intl برای استاتیک‌کردن).
با تزریق همان باگ تست شد.

### اگر روزی خواستید docs استاتیک شود

راه پشتیبانی‌شده: `setRequestLocale()` از next-intl **به‌علاوه‌ی**
`generateStaticParams` که هم `lang` و هم `slug` برگرداند. آن‌وقت گارد باید
به‌روز شود که **هر دو** را الزامی کند، نه اینکه حذف شود.

---

## ۲. ساختار فعلی مستندات

| چیز                                         | کجا                                                          |
| ------------------------------------------- | ------------------------------------------------------------ |
| ساختار مقالات (slug، گروه، بخش‌ها، لینک‌ها) | `packages/ui/src/lib/docs/docs-content.ts`                   |
| **متن** (۱۲۱ کلید × ۳ زبان)                 | `packages/i18n/messages/{fa,af,en}/common.json` زیر `docs.*` |
| UI                                          | `packages/ui/src/components/ui/docs/docs-view.tsx`           |
| «؟» کنار عنوان صفحات                        | `packages/ui/src/components/ui/docs/docs-help-link.tsx`      |
| Route ها                                    | `apps/web/app/[lang]/docs/`                                  |

**هیچ فایل MDX وجود ندارد.** محتوا داده + کلید i18n است.

اعداد واقعی (از baseline): **۱۱ مقاله × ۳ زبان = ۳۳ ورودی، ۳۶ route،
۳٬۷۸۴ کلمه، ۱۲۱ کلید.**

### Baseline های منجمدشده

```
docs/baseline/docs-route-baseline.json    ← هر route از ۶ منبع
docs/baseline/content-baseline.json       ← هر مقاله، هر زبان، wordCount/headings/links
```

با `DOCS_BASELINE=1 npx vitest run src/__tests__/docs-baseline-dump.test.ts`
در `packages/ui` بازتولید می‌شوند. اگر مهاجرت Fumadocs انجام شد، محتوای جدید
باید با این‌ها diff شود؛ **کاهش غیرمنتظره = FAIL نه warning**.

---

## ۳. ⚠️ پنج ورودی خرابِ کشف‌شده در `ROUTE_DOCS_MAP` — هنوز باز

`ROUTE_DOCS_MAP` (نگاشت route محصول → مقاله) پنج ورودی دارد که **صفحه‌شان
وجود ندارد**:

```
branches · invoice-detail · payments · pos · products
```

گاردِ فعلی فقط چک می‌کند «slug مقاله واقعی است»، **نه** «route محصول واقعی
است». پس این‌ها بی‌صدا مانده‌اند.

**اثر واقعی:** `branches` تنها route نگاشته‌شده برای مقاله‌ی `branches` است،
پس دکمه‌ی «باز کردن در برنامه» روی `/docs/branches` به `/fa/branches` می‌رود
که **۴۰۴ است**. بقیه‌ی چهار تا alias اضافی‌اند و ضرر مستقیم ندارند، ولی
گمراه‌کننده‌اند.

مدیریت شعبه واقعاً در `team-and-payroll` (تب `branches`) است، نه route جدا.

**کار لازم:** جهت معکوس گارد (Docs → Product) اضافه شود، و این پنج ورودی
اصلاح یا حذف شوند. این همان Invariant شماره ۲ در سند Production Gate است.

`assistant` عمداً نگاشت ندارد — دستیار یک دکمه روی داشبورد است نه route.

---

## ۴. Migration های معلق (هیچ‌کدام اجرا نشده)

| فایل                                             | چه می‌کند                                          |
| ------------------------------------------------ | -------------------------------------------------- |
| `docs/phase-t2-units-rls-migration.sql`          | RLS روی `units`                                    |
| `docs/phase-t13-ai-provider-migration.sql`       | `ai_provider_settings` + `ai_workspace_quota`      |
| `docs/phase-t4-manufacturing-fk-migration.sql`   | FK های manufacturing (⚠️ اول بخش ۱ = گزارش orphan) |
| `docs/phase-t11-product-units-rpc-migration.sql` | `product_units_replace()` — **اجرا شد، تأیید شد**  |
| `docs/patch-01-currencies-migration.sql`         | جدول `currencies` + ۱۶۲ ارز                        |
| `docs/patch-02-custom-units-migration.sql`       | ⚠️ **پیشنهاد — منتظر تصمیم شماست**                 |
| `docs/patch-03-leaves-gaps-migration.sql`        | سه ستون روی `leaves`                               |

### تصمیم Patch 2 (چرا `units` باز نشد)

Option B (افزودن `workspace_id` به `units`) **به‌صورت additive ممکن نیست**:

1. `code text NOT NULL UNIQUE` — سراسری. دو workspace نمی‌توانند هردو
   «مثقال» اضافه کنند.
2. `units_one_base_per_dimension` — `UNIQUE (dimension) WHERE is_base`،
   سراسری.

هردو باید **DROP و بازنویسی** شوند که قانون additive را می‌شکند. الگوی
`roles` آنجا کار می‌کند چون نام نقش unique سراسری نیست؛ اینجا خودِ
uniqueness همان invariant است.

پس: `custom_units` جدا، با `workspace_id`، و `product_units.custom_unit_id`
با CHECK که دقیقاً یکی از دو منبع ست باشد.

---

## ۵. کارهای باز دیگر

- **`SUPABASE_ANON_KEY` در production ست نشده** — بدون آن چت AI با خطای صریح
  رد می‌شود (نه ناامن کار می‌کند). فقط در `backend/src/__tests__/setup.ts` هست.
- **K2/K3 (انتقال بین شعب)** — تصمیم معماری‌اش گرفته شده (Transfer Document +
  Derived In-Transit)، ولی پیاده نشده. `stock_movements_project()` از قبل
  حرکت یک‌طرفه را درست هندل می‌کند، **ولی** برای پای SHIP باید
  `products.quantity` دست‌نخورده بماند (جنس در راه هنوز مال کسب‌وکار است) —
  که trigger فعلی این کار را نمی‌کند.
- **`workspace-staleness.test.ts`** در `packages/store` از قبل قرمز است، ربطی
  به این تغییرات ندارد (با `git stash` تأیید شد).
- **گپ پوشش:** `services/inventory/` در `MODULES` تست
  `vertical-slice-integration` نیست، پس `units.service.ts` هرگز اسکن نشده.

---

## ۶. قواعدی که این سشن‌ها بارها به آن‌ها برخوردند

1. **اول `grep` بزن.** حدود یک‌سوم کارهای «لازم» از قبل وجود داشت. J5 کامل
   پیاده بود؛ من در جدول نوشته بودم نیست.
2. **عدد مشتق نویسنده‌ی دوم نمی‌گیرد.** `paid_amount` این را ثابت کرد.
   مصرف AI هم به همین دلیل از `ai_query_log` شمرده می‌شود نه شمارنده‌ی جدا.
3. **`undefined` یعنی «رفتار قبلی»، نه `false`.** در `includeInTotal` این
   تفاوت، جمع کل فاکتورهای ذخیره‌شده را عوض می‌کرد.
4. **نبودِ داده «—» است نه صفر.** صفر یک پاسخ واقعی است.
5. **متغیر CSS تعریف‌نشده fallback نمی‌گیرد** — کل declaration دور انداخته
   می‌شود. ۱۶۸ ارجاع مرده پیدا شد.
6. **Radix `SelectItem` روی مقدار خالی throw می‌کند** — و `value=""` الگوی
   «همه» در هر فیلتر بود.
7. **کلاینت بک‌اند service role است و RLS را دور می‌زند.** برای AI باید
   `createUserScopedClient(token)` استفاده شود وگرنه هر workspace خوانده
   می‌شود.
8. **تزریق باگ، تنها اثبات گارد است.** هر گاردِ این سشن‌ها با برگرداندن
   عمدی باگ اصلی تست شده.
