# پرامپت اجرایی — ممیزی و اصلاح Technical SEO حسابچه (نسخه‌ی مخصوص این ریپو)

> این نسخه جایگزین پرامپت عمومی است. تفاوتش: همه‌ی تله‌ها، گاردها و تصمیم‌های قبلی همین پروژه در آن آمده تا
> دوباره کشف نشوند و کاری که قبلاً درست شده خراب نشود.
> هدف: صفحات واقعاً ارزشمند کشف، crawl، canonical و index شوند؛ هر چیز بی‌ارزش صریحاً بیرون بماند.
> **SEO را دستکاری نکن؛ معماری را درست کن.**

## ۰. قواعد ثابت (نقض هر کدام = رد کل تحویل)

1. **commit و push نکن.** subagent نساز. وسط کار نپرس «کدام فاز».
2. هیچ DDL/Migration مستقیم روی دیتابیس زنده. اگر چیزی دیتابیس لازم داشت، فقط فایل SQL در `docs/` (additive، idempotent، با Rollback) + VERIFY جدا؛ تا انسان اجرا نکرده بنویس `PENDING HUMAN CONFIRMATION`.
3. **فقط بیلد وب** (`cd apps/web && pnpm run build`) برای اثبات مجاز است. بیلد ویندوز/اندروید نگیر.
4. اگر `Access is denied` روی esbuild temp آمد، `TEMP`/`TMP` را روی پوشه‌ی داخل پروژه (`.pgtest/tmp`) بگذار.
5. **عملکرد سخت‌گیر است:** PageSpeed ۹۹/۱۰۰ لندینگ نباید پس‌رفت کند. هر تغییر روی لندینگ/layout قبل و بعد اندازه‌گیری شود؛ عددی که اندازه نگرفته‌ای ننویس.
6. **هیچ ادعای «Google تأیید کرد» یا «ایندکس شد».** فقط سه وضعیت: `VERIFIED` · `IMPLEMENTED_NOT_EXTERNALLY_VERIFIED` · `REQUIRES_GOOGLE`.
7. هیچ محتوای جعلی: review، rating، قیمت، آمار، FAQ، سازمان یا ادعای ویژگی که در کد نیست (گارد: `landing-claims.test.ts`).
8. در این شل heredoc و `node -e` با backtick/بک‌اسلش خراب می‌شوند؛ اسکریپت را با Write بساز.
9. سوئیت‌ها را پشت سر هم اجرا کن (موازی، گاردهای درخت‌خوان را timeout می‌کند). `pnpm exec vitest run` از پوشه‌ی همان پکیج.

## ۱. آنچه از قبل درباره‌ی این سایت درست و مستند است (دوباره کشف نکن؛ فقط بسنج و خراب نکن)

- وب = Next.js 16 App Router با پیشوند `[lang]` (`fa`، `af`، `en`). تقویم: fa→fa-IR، af→fa-AF، en→en. هر سه فعال‌اند.
- **ستاره در robots.txt اسلش را هم می‌پذیرد.** `*/invoices` صفحه‌ی `/fa/docs/invoices` را می‌بندد (BUG-085). `robots.ts` هر قانون زبان‌دار را لنگرشده می‌دهد (`/fa/invoices`). گارد: `robots-does-not-block-public.test.ts` و `robots-dashboard-routes.test.ts`. هر مسیر تازه‌ی `(dashboard)` باید در robots disallow شود.
- **سایت‌مپ نشانی noindex یا ۴۰۴ نمی‌دهد.** نشانی‌ای که وجودش به داده بسته است (هاب وبلاگ بدون مقاله، بازارِ خاموش) در سایت‌مپ هم به همان داده شرطی است (BUG-086). سایت‌مپ hreflang alternates دارد، با خطای API هنگام build می‌شکند نه، و `lastModified` فقط از تغییر محتوای واقعی می‌آید.
- **root layout هرگز `alternates`/canonical پیش‌فرض نمی‌دهد** (وگرنه همه‌ی صفحات noindex ارث می‌برند). canonical باید هر صفحه خودش بدهد.
- عنوان صفحه برند نمی‌گیرد؛ template layout `| حسابچه` اضافه می‌کند. عنوان دوبار برند نخورد.
- لینک داخلی همیشه با پیشوند locale؛ لینک از صفحه‌ی عمومی به صفحه‌ی خصوصی `rel="nofollow"`.
- **۲۷ جفت redirect «moved»** در `apps/web/next.config.js` و همان جفت‌ها `<Navigate>` در `packages/app-shell/src/app/app.tsx`؛ دو فهرست باید یکی باشند (گارد: `route-parity.test.ts`). ۱۹ پوشه‌ی صفحه‌ی وب حذف شده‌اند. این redirectها **عمداً** هستند؛ زنجیره‌ی A→B→C را فقط اگر واقعاً وجود دارد به A→C ببر، بدون شکستن گارد.
- `/purchasing` → `/invoices?type=purchase`، `/bank` → `/accounting?tab=treasury` و مشابه: بررسی کن لینک داخلی عمومی مستقیم به مقصد نهایی اشاره می‌کند.
- **لندینگ، راهنما و وبلاگ ایستا/ISR هستند؛ `<Suspense>` رویشان نگذار** (LCP را ۲ ثانیه عقب انداخت و CLS ساخت). بخش‌های ایستا server component؛ آیکون تزئینی = کاراکتر CSS؛ `prefetch={false}`.
- لندینگ یکی است («سفر یک فاکتور»): `journey-hero.tsx` سرور-کامپوننت و `<h1>` را خودش رندر می‌کند؛ فقط `scene.ts` حق import از `three` دارد. تغییری که h1 یا LCP را عقب بیندازد ممنوع است.
- پیام با `{placeholder}` را با `translate.raw()` بگیر؛ کلید ناموجود `t()` را می‌اندازد و صفحه را به error boundary می‌برد. هر کلید جدید در **هر سه** locale (`fa`/`af`/`en`) و با واژه‌نامه‌ی دری `.claude/DARI-GLOSSARY.md`.
- هر صفحه‌ی وب بیرون از `(dashboard)` فقط namespaceهایی را دارد که layoutش می‌دهد (گارد: `public-page-namespaces.test.ts`).
- هر route زیر `/api/public/` باید در فهرست بازبینی‌شده‌ی `storefront-orders.test.ts` باشد.
- راهنمای عمومی از `DOCS_ARTICLES` می‌آید (خودکار در سایت‌مپ) + لینک از یک مقاله‌ی مرتبط + `ROUTE_DOCS_MAP`. کلید query‌دار در `ROUTE_DOCS_MAP` فقط برای «باز کردن در برنامه» است و با pathname جور نمی‌شود.
- ماژولی که barrel `@hisabche/ui` صادر می‌کند و `@hisabche/api` را import می‌کند باید `'use client'` باشد (گارد: `index-exports-server-safe.test.ts`). تابع UI را در فایل سرور صدا نزن؛ به‌صورت element رندر کن.
- هر ادعا در لندینگ/FAQ/متا باید در کد وجود داشته باشد («ورود دو مرحله‌ای»، «بک‌آپ ۳۰ روزه»، «۳۰ روز آزمایشی» قبلاً دروغ بودند).
- برای بازرسی HTTP واقعی از `web-prod` روی پورت ۳۱۱۱ استفاده کن (`next start` بیلد را فقط هنگام شروع می‌خواند؛ بعد از build ریستارت کن). با سوئیت سبز، ۲۴ مشکل پیدا شد که فقط HTTP واقعی دید.
- دامنه‌ی production را از کد/پیکربندی بخوان (متغیر محیطی سایت‌مپ/canonical). **حدس نزن**؛ اگر مقدارش در ریپو نیست، در `OPEN-QUESTIONS` بنویس و با placeholder امن (از env) جلو برو.

## ۲. قبل از هر تغییر: Audit با داده‌ی واقعی

۱. `docs/SEO/AUDIT.md` را بساز. منبع حقیقت = **بیلد واقعی + HTTP واقعی**، نه خواندن کد به‌تنهایی:

- `pnpm run build` وب، سپس `next start` روی ۳۱۱۱.
- فهرست URL ها از: خروجی `sitemap.xml` (و sitemap index اگر هست) + همه‌ی `app/[lang]/**/page.tsx` بیرون از `(dashboard)` + `generateStaticParams` + `DOCS_ARTICLES` + وبلاگ/CMS + `moved` در `next.config.js`.

2. برای هر URL (هر سه locale) با درخواست واقعی ثبت کن: status، مقصد redirect (تا زنجیره‌ی کامل)، `<link rel=canonical>`، `meta robots`، هدر `X-Robots-Tag`، hreflang، `<title>`، تعداد `<h1>`، JSON-LD. یک اسکریپت قابل‌تکرار (`scripts/seo/crawl-inventory.mjs`) بنویس که این را بسازد، نه کار دستی.
3. خروجی: `docs/SEO/URL-INVENTORY.csv` با ستون‌ها: `url, route, page_type, locale, status, redirect_chain, canonical, robots_meta, x_robots, indexable, crawlable, in_sitemap, inbound_internal_links, parent, content_quality, structured_data, noindex_reason, priority`. عدد «inbound links» را از خزش واقعی لینک‌های داخلی (از homepage و منو) بساز، نه حدس.
4. **۱۵ پرسش Audit** (redirect؛ ۴۰۴؛ canonical غلط؛ در/خارج سایت‌مپ؛ orphan؛ query-only؛ duplicate؛ middleware؛ وابسته به auth؛ وابسته به locale) هر کدام با شمار و فهرست پاسخ داده شوند.
5. **صفحات «Discovered – currently not indexed» (~۱۲۰ تایی):** فایل خروجی Search Console در ریپو نیست. از انسان نخواه؛ فهرست ۱۲۰ تا را از inventory بازسازی کن (URLهایی که در سایت‌مپ‌اند و `indexable` ولی لینک داخلی کم یا محتوای کم دارند) و برای هر کدام یکی از چهار حکم بده: `keep+strengthen`، `exclude (noindex/خروج از sitemap)`، `canonical-to-X`، `thin→fix content first`. هیچ URL را کورکورانه indexable نکن. اگر انسان بعداً CSV واقعی Search Console را داد، همین جدول با آن تطبیق داده می‌شود (جای آن را در `POST-IMPLEMENTATION.md` بگذار).

## ۳. سیاست ایندکس (`docs/SEO/INDEXABILITY-POLICY.md`)

برای هر نوع صفحه تصمیم صریح و دلیل از کد:

- **index:** لندینگ (هر سه locale)، قیمت‌گذاری/ویژگی‌ها، راهنما (docs)، وبلاگ و مقالات، صفحات صنف/کسب‌وکار، بازار (فقط اگر روشن و دارای داده)، صفحات حقوقی، صفحات مقایسه اگر وجود دارند.
- **noindex یا خارج:** `(dashboard)`، login/register/forgot، `/my-attendance/[token]`، لینک‌های توکن‌دار، خروجی‌های `/api`، صفحات sandbox/preview، نتایج جست‌وجوی داخلی، query-based فیلتر/مرتب‌سازی، صفحات صرفاً utility.
- هر `noindex` را `INTENTIONAL` یا `ACCIDENTAL` طبقه‌بندی کن؛ accidental را اصلاح و intentional را با دلیل مستند کن. noindex را کورکورانه حذف نکن.
- **robots.txt برای جلوگیری از index نیست.** URLای که باید از نتایج بیرون بماند ولی باید crawl شود تا noindex دیده شود، در robots مسدود نشود.

## ۴. کارهای مهندسی (هر کدام با ریشه‌یابی؛ هیچ فایلی فقط برای سبزشدن تست دستکاری نشود)

A. **Redirect:** زنجیره‌ها را به یک جهش برسان (فقط جایی که امن است)، حلقه‌ی locale/middleware/www/trailing-slash/http-https را بسنج. هیچ ۴۰۴ به homepage redirect نشود. `301` برای جابه‌جایی دائمی؛ `404/410` برای حذف واقعی. لینک‌های داخلی مستقیم به مقصد نهایی (نه به نشانی «moved»).
B. **Canonical:** هر indexable، canonical مطلق و self-referential، بدون اشاره به redirect/۴۰۴/noindex/صفحه‌ی نامرتبط، سازگار با hreflang و سایت‌مپ. canonical در هر صفحه تعریف می‌شود (نه root layout).
C. **hreflang:** فقط به URLهایی که ۲۰۰، indexable و canonical-consistent هستند؛ جفت‌های دوطرفه؛ `x-default` فقط اگر معنا دارد. **fa و af دو locale مستقل‌اند** — اگر محتوایشان واقعاً یکی است، تصمیم صریح در سیاست بنویس (duplicate نبینند).
D. **Sitemap:** از داده/inventory واقعی تولید شود (نه hardcode)، فقط ۲۰۰ + canonical + indexable + بدون redirect/noindex/duplicate/private/query کم‌ارزش. اگر تعداد زیاد شد sitemap index (pages/docs/blog/market) فقط با توجیه واقعی. `lastModified` فقط از تغییر واقعی.
E. **robots.txt:** سایت‌مپ اعلام‌شده، assets (JS/CSS/تصویر) باز، private بسته، قوانین لنگرشده. تست خروجی واقعی.
F. **Metadata:** title یکتا و نمایانگر intent، description یکتا برای صفحات مهم، OG/Twitter، `lang`/`dir`، favicon؛ بدون keyword stuffing؛ عنوان برند را دوبار نگیر.
G. **Heading/semantic HTML:** یک `<h1>` معنادار در هر صفحه‌ی عمومی؛ `<h2>/<h3>` منطقی؛ متن مهم در `<div>` بی‌معنا یا فقط داخل عکس/canvas پنهان نباشد (لندینگ سه‌بعدی: محتوای متنی h1 و CTA در HTML سرور باشد).
H. **JSON-LD:** فقط از داده‌ی واقعی: `Organization`، `WebSite`، `BreadcrumbList`، `Article`/`BlogPosting` برای مقاله، `FAQPage` فقط اگر FAQ واقعی روی صفحه هست و با متن صفحه یکی است، `SoftwareApplication` فقط با فیلدهایی که در کد/صفحه ثابت‌اند. **ممنوع:** `aggregateRating`/`review`/`offers.price` که داده‌ی واقعی ندارد.
I. **Internal linking:** orphanهای مهم را پیدا و با لینک زمینه‌ای واقعی وصل کن (از لندینگ، فوتر، مقالات مرتبط، breadcrumb). anchor توصیفی. هیچ لینک پنهان.
J. **Query parameters:** inventory و حکم برای هر کدام (`?tab=`، `?view=`، `?type=`، `?lang`، utm، صفحه‌بندی). `?tab=`/`?view=` صفحات داشبورد‌اند (خصوصی). برای عمومی‌ها canonical به نسخه‌ی بدون پارامتر مگر محتوای مستقل دارند.
K. **Pagination:** هر صفحه self-canonical، بدون noindex بی‌دلیل، قابل‌رسیدن.
L. **Dynamic routes** (`docs/[slug]`، `blog/[slug]`، بازار): slug نامعتبر → ۴۰۴ واقعی (نه ۲۰۰ خالی)، metadata/canonical/JSON-LD پویا، `generateStaticParams` هماهنگ با سایت‌مپ.
M. **Core Web Vitals:** قبل/بعد برای لندینگ، یک مقاله، یک صفحه‌ی راهنما (Lighthouse CLI یا PSI). هر تغییری که LCP/CLS را بدتر کرد برگردانده شود. «بهتر شد» بدون عدد ممنوع.
N. **محتوا:** برای هر صفحه‌ی index‌شونده intent، موضوع اصلی، thin/duplicate بودن را در inventory ثبت کن؛ صفحه‌ی thin را اول محتوایش را درست کن یا از index خارج کن. صفحه‌ی صرفاً-برای-کلمه نساز.

## ۵. تست‌ها و CI

تست‌هایی که **روی خروجی واقعی** (بیلد/`inject`/خروجی `sitemap.ts` و `robots.ts`) اجرا می‌شوند، نه source-assertion صرف:

- sitemap: بدون ۴۰۴/redirect/noindex/تکراری/غیر‌canonical؛ همه ۲۰۰؛ همه مطلق.
- robots: سایت‌مپ اعلام‌شده؛ مسیرهای عمومی مهم بسته نیستند (از inventory بخوان)؛ خصوصی‌ها بسته‌اند؛ قوانین لنگرشده.
- canonical: مطلق، self، نه redirect، نه ۴۰۴.
- metadata: title/h1 برای هر indexable؛ title یکتا؛ description برای صفحات مهم.
- hreflang: جفت‌های دوطرفه، همه ۲۰۰ و indexable.
- JSON-LD: parse می‌شود؛ نوع‌های مجاز؛ فیلد جعلی (rating/price بدون داده) نیست.
- internal links: لینک به ۴۰۴ شناخته‌شده نیست؛ orphan مهم نیست؛ لینک عمومی→خصوصی `nofollow`.
- **هر گارد را injection-test کن:** فیکس را موقتاً برگردان، قرمزشدن را نشان بده، بازگردان (`git diff` خالی برای آن فایل).
- CI: همین تست‌ها در pipeline موجود (جای فعلی را در `.github/workflows` یا اسکریپت `turbo` پیدا کن؛ pipeline دوم نساز) و fail اگر sitemap ۴۰۴ شد، canonical به redirect رفت، صفحه‌ی عمومی ناخواسته noindex شد یا robots مسیر مهم را بست.

## ۶. وریفای (به‌ترتیب، پشت سر هم)

```bash
cd packages/ui && pnpm exec tsc --noEmit && pnpm exec vitest run
cd apps/web && pnpm exec tsc --noEmit && pnpm exec vitest run   # اگر تست دارد
cd apps/web && pnpm run build
# سپس next start روی 3111 و اسکریپت crawl-inventory + تست‌های HTTP واقعی
cd packages/api && pnpm exec tsc --noEmit
```

- گاردهای موجود که باید سبز بمانند و نامشان در گزارش بیاید: `robots-does-not-block-public`، `robots-dashboard-routes`، `landing-claims`، `route-parity`، `public-page-namespaces`، `index-exports-server-safe`، `no-import-cycles`، `one-ux`.
- eslint روی فایل‌های تغییرکرده از پوشه‌ی همان پکیج: ۰ خطا.
- `node scripts/build-ai-index.mjs` بعد از تغییر کد.

## ۷. خروجی‌ها

`docs/SEO/AUDIT.md` · `docs/SEO/URL-INVENTORY.csv` · `docs/SEO/INDEXABILITY-POLICY.md` · `docs/SEO/POST-IMPLEMENTATION.md` (before/after/fixed/intentionally excluded/unresolved/verification method + جای تطبیق با CSV واقعی Search Console) · `docs/SEO/SEO-TESTING.md` · `scripts/seo/*` · کد و تست‌ها · درس‌های تازه در `.claude/lessons-learned.md` (شماره‌ی بعد) و `CLAUDE.md`.

## ۸. شکل گزارش پایانی (فارسی، جدول، عدد واقعی)

۱. جدول معیارهای پذیرش (سایت‌مپ، robots، canonical، noindex، redirect، ۴۰۴، hreflang، metadata، heading، internal links، orphan، query، JSON-LD، تست‌ها، CI) → وضعیت از `VERIFIED | IMPLEMENTED_NOT_EXTERNALLY_VERIFIED | REQUIRES_GOOGLE` → مدرک (فرمان/درخواست + خروجی).
۲. before/after: تعداد URL در inventory، در sitemap، noindex، redirect، ۴۰۴، orphan، چرخه — با اسکریپت قابل‌تکرار.
۳. جدول تصمیم برای ۱۲۰ URL.
۴. اندازه‌گیری Core Web Vitals قبل/بعد (یا «NOT MEASURED» با دلیل).
۵. آنچه انجام نشد و دلیل دقیق؛ آنچه فقط Google می‌تواند تأیید کند (`REQUIRES_GOOGLE`)؛ کارهای انسان (ارسال مجدد sitemap در Search Console، درخواست بازبررسی).
۶. `git status` نشان دهد commit نشده است.

**شرط «SEO IMPLEMENTED»** فقط وقتی که همه‌ی موارد ۲۳ معیار پذیرش پرامپت اصلی با مدرک واقعی بسته باشند؛ در غیر این صورت وضعیت را `IMPLEMENTED_NOT_EXTERNALLY_VERIFIED` یا `FAILED` بنویس.
