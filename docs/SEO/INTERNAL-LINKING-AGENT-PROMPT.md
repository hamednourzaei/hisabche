# پرامپت اجرایی — بازسازی معماری لینک داخلی حسابچه

> با پرامپت SEO کلی (`SEO-AGENT-PROMPT.md`) هم‌پوشانی دارد؛ این یکی فقط روی **لینک داخلی** تمرکز دارد.
> اگر هر دو را می‌دهی، اول این را اجرا کن؛ بقیه‌ی SEO روی گراف درست سوار می‌شود.

## ۰. شواهد (Search Console دامنه‌ی `hisabche.com`، اسکرین‌شات صاحب پروژه)

| مورد                  | مقدار گزارش‌شده                                        |
| --------------------- | ------------------------------------------------------ |
| Internal links (کل)   | **۱**                                                  |
| Top linked page داخلی | `https://hisabche.com/fa` (۱ لینک)                     |
| External links        | ۲ (از `scamadviser.com`؛ به `/` و `/fa`)               |
| Top linking text      | `visit` (این **متن لینک خارجی** است، نه لینک داخلی ما) |

نکته‌ی تفسیر: این عدد گزارش **تأخیری Google** است. ولی «فقط ۱» یعنی Google از HTML خزیده‌شده تقریباً هیچ لینک داخلی ندید. فرضیه‌های محتمل، **همه باید با HTML واقعی ثابت یا رد شوند، نه حدس**:

1. منو/لینک‌ها فقط پس از hydrate یا با `router.push`/`onClick` ساخته می‌شوند و در HTML سرور `<a href>` نیستند.
2. لندینگ «سفر یک فاکتور» (صحنه‌ی سه‌بعدی) محتوای لینک‌دار را در HTML سرور نمی‌گذارد.
3. `/` به `/fa` ریدایرکت می‌شود و لینک‌ها به `/` می‌روند (از یک ریدایرکت می‌گذرند) یا هیچ لینکی نیست.
4. لینک‌ها `rel="nofollow"` یا پشت `noindex` هستند.
5. هدر/فوتر عمومی لینک مهم کم دارند و راهنما/وبلاگ/قیمت از لندینگ دیده نمی‌شوند.
6. `prefetch={false}` و کامپوننت‌های `'use client'` لینک را از HTML حذف کرده‌اند.

**اول فرضیه‌ها را با HTML خام بسنج** (`curl`، بدون JS) و در `INTERNAL-LINKING-BEFORE.md` نتیجه را بنویس. تا ثابت نشده کدام درست است، کد را عوض نکن.

## ۱. قواعد ثابت

1. commit و push نکن؛ subagent نساز؛ وسط کار نپرس. فقط بیلد وب (`cd apps/web && pnpm run build`)؛ بیلد ویندوز/اندروید نه. اگر `Access is denied` روی esbuild temp آمد `TEMP`/`TMP` را روی `.pgtest/tmp` بگذار.
2. **این محصول فروشگاه با دسته‌بندی/محصول نیست.** سایت عمومی = لندینگ، قیمت‌گذاری، ویژگی‌ها، صفحات صنف/کسب‌وکار (۴۹ صنف)، راهنما (`DOCS_ARTICLES`)، وبلاگ، صفحات حقوقی، بازار/انبار عمومی فقط اگر روشن باشد. **سلسله‌مراتب را از کد و `sitemap.ts` در بیاور؛ دسته/محصول/related-products نساز.** اگر چیزی در محصول وجود ندارد، لینکش را هم نساز.
3. PageSpeed لندینگ (۹۹/۱۰۰) نباید پس‌رفت کند. لندینگ ایستا/ISR است؛ `<Suspense>` رویش نگذار. `journey-hero.tsx` سرور-کامپوننت و `<h1>` را خودش رندر می‌کند؛ فقط `scene.ts` حق import از `three` دارد؛ لینک‌ها باید در HTML سرور باشند، نه پس از اجرای صحنه. قبل/بعد اندازه بگیر.
4. لینک داخلی همیشه با پیشوند locale (`/fa`، `/af`، `/en`) و از طریق ابزار مشترک (`localizePath`، `useLocalePush`)؛ در UI مشترک `router.push('/…')` برهنه ممنوع (گارد: `dashboard-page-structure.test.ts`).
5. لینک از صفحه‌ی عمومی به صفحه‌ی خصوصی (`(dashboard)`، login-required) `rel="nofollow"`؛ **لینک مهم عمومی هرگز nofollow نباشد.**
6. هر کلید i18n تازه در **هر سه** locale (`fa`/`af`/`en`)؛ `t()` روی کلید ناموجود throw می‌کند. دری: `.claude/DARI-GLOSSARY.md`. پیام با `{placeholder}` را با `translate.raw()` بگیر.
7. هیچ ادعای جعلی: لینک به صفحه‌ای که وجود ندارد، آمار، review، قابلیت بی‌مدرک (`landing-claims.test.ts`).
8. هیچ ادعای «Google تأیید کرد». وضعیت‌ها: `VERIFIED` · `IMPLEMENTED_NOT_EXTERNALLY_VERIFIED` · `REQUIRES_GOOGLE`. عدد Search Console بعد از دوباره‌خزیدن Google عوض می‌شود، نه هنگام deploy.
9. در این شل heredoc و `node -e` با backtick/بک‌اسلش خراب می‌شوند؛ اسکریپت را با Write بساز.
10. سوئیت‌ها پشت سر هم اجرا شوند.

## ۲. پایه‌های تأییدشده‌ی سایت (دوباره کشف نکن؛ نشکن)

- وب = Next.js 16 App Router با `[lang]`. صفحات عمومی بیرون از `(dashboard)`؛ هر صفحه‌ی `(dashboard)` خصوصی و در robots بسته است.
- `/` به `/fa` می‌رود؛ لینک داخلی به `/` یک ریدایرکت اضافه است → همیشه مستقیم به `/{lang}`.
- ۲۷ جفت redirect «moved» (`apps/web/next.config.js` + `packages/app-shell/src/app/app.tsx`)؛ دو فهرست یکی بمانند (`route-parity.test.ts`). لینک عمومی به مقصد نهایی اشاره کند، نه به نشانی قدیمی (`/bank` → `/accounting?tab=treasury` و مانند آن؛ ولی `?tab=` صفحه‌ی داشبورد است و خصوصی).
- `robots.ts` قوانین زبان‌دار را لنگرشده می‌دهد و سایت‌مپ نشانی noindex/۴۰۴ نمی‌دهد؛ گاردها: `robots-does-not-block-public`، `robots-dashboard-routes`.
- ماژول UI که از barrel `@hisabche/ui` صادر می‌شود و `@hisabche/api` را import می‌کند باید `'use client'` باشد (`index-exports-server-safe.test.ts`)؛ تابع آن را در server component صدا نزن.
- راهنما: `DOCS_ARTICLES` (خودکار در سایت‌مپ) + `ROUTE_DOCS_MAP`؛ هر مقاله‌ی راهنما باید از یک مقاله‌ی مرتبط لینک داشته باشد.
- Tailwind RTL: `ms-/me-`، `ps-/pe-`، `text-start`؛ رنگ فقط توکن.

## ۳. مراحل (هر کدام با مدرک اجرایی)

### M1. اندازه‌ی «قبل» از HTML واقعی

- بیلد وب، `next start` روی ۳۱۱۱ (بعد از build ریستارت کن).
- اسکریپت `scripts/seo/internal-link-audit.mjs` (قابل‌تکرار، بدون JS): از `/` و `/fa`، `/af`، `/en` شروع کن؛ `<a href>` را از **HTML خام سرور** بیرون بکش؛ لینک داخلی را دنبال کن؛ گراف بساز؛ status، redirect، canonical، robots/`X-Robots-Tag`، عمق و anchor هر لینک را ثبت کن.
- خروجی: `docs/SEO/internal-link-report.json` و `.md`. معیارها: کل لینک، هدف یکتا، صفحات با ۰/۱/≥۳/≥۵ لینک ورودی، لینک شکسته، لینک از مسیر redirect، لینک به noindex/non-canonical/خصوصی، میانگین لینک برای صفحات مهم، عمق میانگین و بیشینه، orphan.
- **`docs/SEO/INTERNAL-LINKING-BEFORE.md`:** baseline Search Console (جدول بالا) + baseline HTML خودت + کدام فرضیه از §۰ درست بود.

### M2. Inventory و هرم صفحات

- `docs/SEO/INTERNAL-LINKING-INVENTORY.csv`: `url, route, page_type, locale, indexable, canonical, parent, children, inbound_links, outbound_links, tier, target_inbound`.
- سه سطح از ساختار واقعی: Tier 1 (لندینگ، قیمت‌گذاری، ثبت‌نام/شروع، صفحات تجاری اصلی)؛ Tier 2 (فهرست ویژگی‌ها، صنف‌ها، هاب راهنما، هاب وبلاگ)؛ Tier 3 (مقاله‌ی راهنما، پست وبلاگ، صفحه‌ی هر صنف).
- برای هر Tier ۱ و ۲ پرسش: «اگر Google فقط از لینک‌های HTML حرکت کند، به آن می‌رسد؟»

### M3. اصلاح بر اساس علت واقعی (فقط آنچه M1 ثابت کرد)

الف. **هدر عمومی:** لینک‌های `<a href>` واقعی به قیمت‌گذاری، ویژگی‌ها، صنف‌ها، راهنما، وبلاگ، ورود/ثبت‌نام و تغییر زبان (جدا از لینک زمینه‌ای). شلوغ نکن؛ UX اول. در موبایل هم در DOM باشد (منوی همبرگری نباید لینک‌ها را از HTML حذف کند).
ب. **لندینگ:** بخش‌های ایستا سرور-کامپوننت؛ لینک‌های ویژگی/صنف/راهنما/قیمت در HTML سرور با anchor توصیفی. صحنه‌ی سه‌بعدی نباید تنها راه رسیدن به هیچ صفحه‌ای باشد.
ج. **فوتر:** محدود و سازمان‌یافته (محصول، صنف‌های اصلی، راهنما، وبلاگ، حقوقی، تماس). نه sitemap عظیم.
د. **Breadcrumb** (فقط جایی که سلسله‌مراتب واقعی هست): راهنما، وبلاگ، صفحه‌ی صنف. `<nav aria-label>`، لینک واقعی، به redirect/۴۰۴ اشاره نکند، با canonical هماهنگ، و `BreadcrumbList` JSON-LD فقط برای همین‌ها.
ه. **لینک زمینه‌ای:** مقاله ↔ مقاله‌ی راهنمای مرتبط، صنف ↔ ویژگی‌های واقعاً مرتبط آن صنف (از داده‌ی موجود)، ویژگی ↔ مقاله‌ی راهنما، وبلاگ ↔ ویژگی. فقط وقتی رابطه در محتوا/داده واقعی است. «مقاله‌های مرتبط» از برچسب/موضوع واقعی بیاید، نه تصادفی.
و. **anchor text:** فهرست anchorهای عمومی (`visit`، `click here`، `read more`، `more`، `here`، «بیشتر»، «مشاهده»…) را پیدا کن؛ در لینک‌های اصلی با نام واقعی صفحه جایگزین کن. تکراری‌کردن یک keyword در همه‌ی anchorها ممنوع. (متن `visit` در Search Console مال لینک خارجی است؛ ربطی به کد ما ندارد مگر در کد جایی خودمان `visit` گذاشته‌ایم؛ بسنج.)
ز. **Locale:** صفحه‌ی `/fa` فقط به `/fa/...`، `/af` به `/af/...`، `/en` به `/en/...`؛ هیچ لینک بین‌زبانی تصادفی. فقط locale switcher عمداً بین‌زبانی است. fa و af جدا هستند؛ اشتباه «fa» برای کاربر دری ممنوع.
ح. **ریدایرکت‌ها:** هر لینک داخلی مستقیم به نشانی نهایی؛ `/` → `/{lang}`.
ط. **پیمایش JS:** هر ناوبری SEO-critical `<a href>` در HTML سرور (یا کامپوننت `Link` که `<a href>` رندر می‌کند). `div onClick`، `button + router.push`، `window.location` برای مسیر عمومی مهم ممنوع.
ی. **Orphan:** برای هر صفحه‌ی عمومی ارزشمند حداقل یک مسیر معنادار از Home. صفحه‌ی بی‌ارزش را فقط برای رفع orphan لینک نکن؛ بررسی کن باید public/indexable باشد یا نه.
ک. **سایت‌مپ ↔ لینک داخلی:** هر URL سایت‌مپ باید لینک داخلی داشته باشد؛ هر لینک مهم باید در سایت‌مپ باشد (مگر عمداً نه، با دلیل).

### M4. تست‌ها و CI

تست‌هایی که روی **خروجی واقعی** (HTML رندرشده/`inject`) اجرا می‌شوند:

- هیچ لینک داخلی به ۴۰۴/۴۱۰.
- لینک مهم از مسیر redirect/chain نمی‌گذرد؛ `/` در لینک داخلی نیست.
- هیچ لینک داخلی مهم به noindex/non-canonical/خصوصی.
- هر صفحه‌ی Tier 1/2 دست‌کم N لینک ورودی (N را از inventory تعیین کن، مثلاً ≥۳) و هیچ orphan مهم.
- locale: fa→fa، af→af، en→en.
- anchor عمومی در لینک‌های اصلی ممنوع (فهرست بسته در تست).
- لینک‌های SEO-critical در **HTML سرور** وجود دارند (نه فقط پس از hydrate).
- عمق بحرانی: صفحات Tier 1/2 در عمق ≤ ۲ از Home.
- **هر تست را injection-test کن** (تغییر موقت → قرمز → بازگردانی بایت‌به‌بایت).
- CI: همین تست‌ها در pipeline موجود؛ pipeline دوم نساز؛ fail اگر لینک شکسته، orphan مهم، لینک از طریق redirect یا لینک فقط-JS اضافه شود.

### M5. معماری نهایی

`docs/SEO/INTERNAL-LINKING-ARCHITECTURE.md`: سلسله‌مراتب سایت، صفحات مهم و Tier، روابط محتوا، locale، breadcrumb، هدر، فوتر، لینک زمینه‌ای، استراتژی anchor، عمق، سیاست orphan، سیاست redirect/canonical، رابطه با سایت‌مپ، تست‌های خودکار.

## ۴. وریفای (پشت سر هم)

```bash
cd packages/ui && pnpm exec tsc --noEmit && pnpm exec vitest run
cd apps/web && pnpm exec tsc --noEmit
cd apps/web && pnpm run build        # سپس next start روی 3111 و internal-link-audit
cd packages/api && pnpm exec tsc --noEmit
```

- گاردهای باید سبز بمانند و نامشان بیاید: `robots-does-not-block-public`، `robots-dashboard-routes`، `landing-claims`، `route-parity`، `public-page-namespaces`، `index-exports-server-safe`، `no-import-cycles`، `one-ux`، `dashboard-page-structure`.
- eslint روی فایل‌های تغییرکرده از پوشه‌ی همان پکیج: ۰ خطا (pre-commit همه‌ی فایل ویرایش‌شده را می‌سنجد).
- Core Web Vitals لندینگ قبل/بعد (Lighthouse/PSI)؛ بدتر شد → برگردان.
- `node scripts/build-ai-index.mjs`؛ درس‌ها در `.claude/lessons-learned.md` و `CLAUDE.md`.

## ۵. گزارش پایانی (فارسی، جدول، عدد واقعی)

۱. before/after از **اسکریپت قابل‌تکرار**: کل لینک، هدف یکتا، صفحات با ۰/۱/≥۳/≥۵ ورودی، شکسته، از redirect، به noindex، non-canonical، orphan، عمق میانگین/بیشینه.
۲. کدام فرضیه از §۰ علت واقعی بود، با مدرک HTML.
۳. فهرست تغییرات (هدر، لندینگ، فوتر، breadcrumb، زمینه‌ای، anchor، locale).
۴. اندازه‌گیری Core Web Vitals قبل/بعد (یا `NOT MEASURED` با دلیل).
۵. وضعیت سه‌گانه: `VERIFIED` · `IMPLEMENTED_NOT_EXTERNALLY_VERIFIED` · `REQUIRES_GOOGLE`. انسان باید پس از deploy در Search Console درخواست بازبررسی/ارسال دوباره‌ی sitemap بدهد؛ عدد «Internal links» بعد از خزش بعدی عوض می‌شود.
۶. `git status`: commit نشده.

**شرط «INTERNAL LINKING IMPLEMENTED»:** گراف HTML واقعی نشان دهد هیچ صفحه‌ی مهمی orphan نیست، لینک‌های مهم در HTML سرور هستند، و تست‌ها/بیلد سبزند. وگرنه `IMPLEMENTED_NOT_EXTERNALLY_VERIFIED` یا `FAILED`.
