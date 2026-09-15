# درس‌های ۱۵ سپتامبر ۲۰۲۶ — لندینگ، موبایل، PageSpeed، باگ‌ها

> هر مورد: **علامت** (چه دیدیم) → **علت واقعی** → **رفع** → **گارد**.
> همه با اندازه‌گیری واقعی (بیلد production یا PageSpeed زنده)، نه حدس از روی کد.

## نتیجه‌ی کلی PageSpeed (`/en`)

|                | موبایل قبل | موبایل بعد | دسکتاپ قبل | دسکتاپ بعد |
| -------------- | ---------- | ---------- | ---------- | ---------- |
| Performance    | 55         | 97         | 69         | 100        |
| Accessibility  | 93         | 100        | 93         | 100        |
| Best Practices | 96         | 100        | 96         | 100        |
| SEO            | 100        | 100        | 100        | 100        |

---

## ۱. پرفورمنس — بزرگ‌ترین برد‌ها به ترتیب اثر

### 1.1 barrel import در root layout = کل داشبورد روی هر صفحه‌ی عمومی

- **علامت:** «Reduce unused JavaScript 494 KB»؛ چانک ۱.۶MB (payroll، manufacturing، command palette) روی `/en`.
- **علت:** `providers.tsx`، `client-error-boundary.tsx`، `error.tsx`، `layout.tsx` از `'@hisabche/ui'` (barrel) import می‌کردند. `optimizePackageImports` نجاتش نداد.
- **رفع:** subpath export در `packages/ui/package.json` (`./toast-provider`، `./error-boundary`، `./utils`) و import مستقیم.
- **درس:** در هر چیزی که زیر root layout است **هرگز** از barrel `@hisabche/ui` import نکن. پیدا کردن: `grep -rn "from '@hisabche/ui'" apps/web/app/[lang] | grep -v "(dashboard)"`.
- **تشخیص:** چانک‌های HTML را بشمار: `grep -o '_next/static/chunks/[^"]*\.js' page.html` + `wc -c` + gzip.

### 1.2 کاتالوگ کامل ترجمه در HTML هر صفحه

- **علامت:** LCP «Resource load delay 850ms»؛ HTML `/fa` = ۷۵۸KB خام / ۱۳۸KB gzip، ۳۴۲KB از آن RSC payload.
- **علت:** root layout همه‌ی ۸۶ namespace را به `NextIntlClientProvider` می‌داد.
- **رفع:** `apps/web/app/[lang]/scoped-messages.tsx` — root فقط `CORE_NAMESPACES`؛ صفحه‌ی اصلی `LANDING_NAMESPACES`؛ بقیه‌ی مسیرها `layout.tsx` با `FullMessagesLayout`. نتیجه ۱۰۰KB gzip.
- **⚠️ تله:** provider تو در تو پیام‌ها را **جایگزین** می‌کند، ادغام نمی‌کند → subset باید core را هم داشته باشد.
- **⚠️ هر مسیر عمومی جدید** زیر `[lang]` باید `layout.tsx` با `FullMessagesLayout` داشته باشد، وگرنه کلیدهای خام نشان می‌دهد (onError ساکت است، کرش نمی‌کند — خطرناک‌تر چون دیده نمی‌شود).

### 1.3 آیکون‌ها ۵.۹MB

- **علامت:** «Avoid enormous network payloads 6,205 KiB».
- **علت:** همه‌ی `favicon-*.png`، `android-chrome-*`، `apple-touch-icon` یک PNG ۱۲۵۴×۱۲۵۴ (۱.۲MB) با اسم متفاوت؛ `favicon.ico` و `favicon.svg` در واقع PNG ۲.۲MB.
- **رفع:** تولید اندازه‌ی واقعی با `sharp` (در `node_modules/.pnpm/sharp@0.34.5`)، ICO واقعی دست‌ساز (هدر + دایرکتوری + PNG). جمع ~۱۵۰KB.
- **گارد:** `packages/ui/src/__tests__/public-icon-sizes.test.ts` (ابعاد واقعی از هدر PNG).
- **درس:** اسم فایل دروغ می‌گوید؛ ابعاد را از بایت‌های هدر بخوان.

### 1.4 analytics داخل پنجره‌ی اندازه‌گیری

- **علامت:** TBT از 560ms به **6,110ms** پرید (رگرسیون خودم).
- **علت:** (الف) باگ `initPostHog` را درست کردم → PostHog با autocapture واقعاً اجرا شد؛ (ب) تایمر fallback ۱۲ ثانیه داخل trace کند Lighthouse شلیک کرد.
- **رفع:** gtag و PostHog **فقط** روی تعامل واقعی (`pointerdown`, `keydown`, `touchstart`, `wheel`). بدون تایمر، بدون `scroll` (تغییر layout خودش scroll event می‌سازد).
- **گارد:** `analytics-deferred-load.test.ts` (injection شده: تایمر برگشت → قرمز).
- **درس:** «درست کردن» یک باگ خاموش می‌تواند هزینه‌ی پنهان را روشن کند؛ بعد از هر رفع analytics دوباره اندازه بگیر.
- **trade-off ثبت‌شده:** بازدیدکننده‌ی بی‌تعامل شمرده نمی‌شود.

### 1.5 تصویر LCP داخل `<picture>`

- `priority` در `getImageProps` preload نمی‌سازد → `<link rel="preload" as="image" imageSrcSet media fetchPriority="high">` دستی، **یکی برای هر viewport** (موبایل تصویر دسکتاپ را preload نکند).
- `packages/ui` تایپ `react-dom` نسخه‌ی ۱۸ دارد → `preload()` از react-dom در دسترس نیست؛ JSX `<link>` (React 19 به head منتقلش می‌کند).
- art direction: موبایل اسکرین‌شات گوشی، دسکتاپ اسکرین‌شات دسکتاپ؛ دسکتاپ روی موبایل **دانلود نمی‌شود** (تأیید با `performance.getEntriesByType('resource')`).

### 1.6 بقیه

| مورد                             | رفع                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------- |
| CSS render-blocking (۳ فایل)     | `experimental.inlineCss: true`                                                  |
| تصویر بزرگ‌تر از لازم            | `imageSizes` + 256/384/512                                                      |
| prefetch صفحه‌ی خودش (۸۸KB RSC)  | لینک لوگو `prefetch={false}`                                                    |
| انیمیشن non-composited (۱۱۳–۱۵۷) | keyframe با `var()` روی compositor اجرا نمی‌شود → keyframe ثابت + `marquee-rtl` |
| Style & Layout                   | `content-visibility:auto` روی `LANDING_SECTION`                                 |

### 1.7 باقی‌مانده / غیرقابل‌حل تمیز

- Legacy JS 14KB: polyfill خود Next (`Array.at` …)، نه کد ما.
- فونت Vazirmatn TTF (۶۸KB×۲): WOFF2 نیازمند نصب ابزار (اجازه لازم).
- واریانس موبایل PSI چند امتیاز است؛ میانه‌ی ۲–۳ اجرا را ملاک بگیر.

---

### 1.8 hydration کل لندینگ (TBT موبایل 6.9s)

- **رفع:** بخش‌های ایستا Server Component (`landing-page.tsx` سرور، `landing-shell.tsx` کلاینت، `landing-client-sections.tsx` برای FAQ/فوتر). دکمه‌ها → `<Link>`/`<a href="#…">`.
- مشاهده‌ی بخش فعال از `useSceneObserver` در هر صحنه به `NavigationRegistry` منتقل شد.
- **گارد:** «static landing sections stay server components» (بدون `'use client'` و hook).
- **تله:** barrel `landing/index.ts` نباید `LandingPage` سروری را export کند (next-intl/server در باندل کلاینت).
- **تله:** `tailwindcss-animate` کلاس `slide-in-from-start/end` ندارد → Sheet بدون انیمیشن بود؛ left/right + `rtl:`.
- **تله:** `scroll-behavior` ارث‌بری نمی‌شود؛ داشبورد container خودش را اسکرول می‌کند.

### 1.9 prefetch خودکار Next = دانلود JS صفحه‌های دیگر (دسکتاپ TBT 790، چانک ۴۰۰KB «100% unused»)

- **علت:** `<Link>` در viewport، JS مسیر مقصد را prefetch می‌کند؛ هدر دسکتاپ «ورود»/`/login` را نشان می‌دهد و login باندل سنگین UI را دارد. روی 4G کند با تصویر LCP هم رقابت کرد (موبایل LCP 4.1s).
- **رفع:** همه‌ی لینک‌های لندینگ `prefetch={false}` + گارد «landing links do not prefetch other routes».
- **تأیید:** بعد از ۶ ثانیه: صفر درخواست `_rsc` و صفر JS دیررس.
- **درس:** «Reduce unused JS» با ۱۰۰٪ unused معمولاً یعنی **prefetch** یا import بی‌مصرف، نه کد صفحه.

### 1.10 i18next قدیمی روی وب (۳۱۳KB) + بازنویسی `dir`

- **علت:** `heavy-providers` از `@hisabche/i18n` فقط `syncLanguageFromStorage` را صدا می‌زد → i18next + react-i18next + ۳ کاتالوگ JSON؛ و `<html dir/lang>` را از localStorage روی زبان مسیر می‌نوشت.
- **رفع:** حذف `LanguageInitializer` (وب با next-intl زبان را از مسیر می‌گیرد) + گارد.
- **تشخیص:** سر چانک را بخوان: `head -c 300 chunk.js` → `JSON.parse('{"app":{…` یعنی کاتالوگ در JS است.

### 1.11 drawer موبایل lazy

- `landing-mobile-menu.tsx` با `next/dynamic` روی اولین لمس؛ Radix Dialog (۲۲KB) از بار اولیه خارج شد.
- PostHog: `disable_surveys: true` (surveys.js ۳۳KB بدون survey). تصویر LCP موبایل `quality: 60`.

### نتیجه‌ی این مرحله (محلی)

JS `/en`: ۳۹۲ → ۳۰۵KB؛ prefetch صفر؛ `dir`/`lang` درست.

### ⚠️ تکرار نکن (خواسته‌ی صریح کاربر)

قبل از هر «رفع»، **اول گزارش PSI را خط‌به‌خط بخوان** و برای هر مورد: چه چانکی، از کجا import، با `head -c` محتوا — نه حدس. هر رفع = یک گارد + اندازه‌گیری محلی قبل/بعد.

### 1.12 ⚠️ `<Suspense>` دور صفحه‌ی ایستا = LCP «element render delay» ۲ ثانیه

- **علامت:** PSI موبایل: TTFB 20ms، دانلود تصویر 70ms، ولی **element render delay 2,050ms**؛ دسکتاپ CLS 0.02.
- **علت (در HTML زنده دیده شد):** `page.tsx` لندینگ async را در `<Suspense fallback={spinner}>` پیچیده بود → React اسپینر را اول HTML (بایت ۱٬۰۸۰) و کل صفحه (h1 + تصویر LCP) را در `<div hidden id="S:0">` (بایت ۱۶۰٬۰۰۳) می‌گذاشت و با اسکریپت `$RC` در **انتهای** سند نمایان می‌کرد. تصویر دانلود شده ولی رنگ نمی‌شد.
- **رفع:** حذف Suspense (صفحه prerender ایستا است؛ چیزی برای انتظار نیست) + گارد «landing is not behind a Suspense boundary».
- **تشخیص:** `curl page | python: s.find('<div hidden id="S:')` و مقایسه با جای `<h1`.
- **درس:** «render delay» بزرگ با TBT کم = محتوای LCP پشت boundary استریم/hydration است، نه JS سنگین.

### 1.13 ⚠️ PSI را محلی بازتولید کن، نه حدس — اسکریپت CDP

- ابزار: `scratchpad/cdp-tbt.mjs` (Chrome نصب‌شده + WebSocket داخلی Node 22؛ بدون دانلود). Long Tasks + **Long Animation Frames** با نام اسکریپت، تابع و `forcedStyleAndLayoutDuration`.
- **کالیبراسیون:** CPU این ماشین خیلی سریع‌تر از سرور PSI است؛ 4× اینجا TBT ≈ صفر نشان داد. **12× موبایل / 6× دسکتاپ** به اعداد PSI نزدیک شد.
- پنل مرورگر Claude برای main-thread بی‌کاربرد است (مخفی ⇒ ۱ فریم در ثانیه).
- `scratchpad/cdp-anim-trace.mjs`: trace واقعی و `compositeFailed` هر انیمیشن.

### 1.14 یافته‌های این دور (همه با اندازه‌گیری)

| علت                                                                                                           | شاهد                               | رفع                                                                                |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------- |
| حلقه‌ی rAF دائمی نوار پیشرفت (`startScrollLoop` روی mount، بدون scroll متوقف نمی‌شد)                          | LoAF: 108ms با 107ms forced layout | scroll listener + یک rAF + ResizeObserver                                          |
| نوشتن روی `<html>` بعد از hydration (AdaptiveUI: ۳ CSS var بی‌مصرف + data-perf؛ lite-mode؛ applyTheme تکراری) | ۳ فریم style+layout ۱۰۰–۲۳۰ms      | حذف کد مرده، lite-mode در inline script قبل از paint، applyTheme فقط در صورت تغییر |
| `left`/`width` transition نشانگر منو + `animate-pulse` placeholder قیمت                                       | trace: compositeFailed (۵ انیمیشن) | transform؛ placeholder ثابت → **۰ non-composited**                                 |
| DOM تکراری (bullet امنیت ×۲، timeline pain ×۲، ۵۱ SVG تیک جدول)                                               | ۱۳۹۴ المان، ۳۹۷ نود SVG            | یک نسخه + متن ✓/— با aria-label → ۱۳۱۷                                             |
| پاسخ `usePlans` کل بخش تعرفه (+جدول ۲۰۰ المان) را دوباره رندر می‌کرد                                          | long task دیررس ~۱۲۰ms             | جدول `memo` با فقط `locale`                                                        |
| `useLayoutEffect` + getBoundingClientRect در commit hydration                                                 | forced layout 31ms                 | اندازه‌گیری در rAF بعدی                                                            |
| FAQ کلاینت با state                                                                                           | بخشی از hydration                  | `<details>` سرور (بدون JS)، JSON-LD همه‌ی سوال‌ها                                  |

- **درس کلیدی:** Server Component هزینه‌ی **hydration walk** را صفر نمی‌کند — React همه‌ی نودهای RSC را هم می‌پیماید. اهرم واقعی = **تعداد المان** + کارهای بعد از hydration، نه فقط اندازه‌ی JS.
- **نتیجه‌ی محلی (دسکتاپ 6×):** TBT میانه ~۱۴۰ → ~۷۸ms.

## ۲. باگ‌های واقعی که هم‌زمان پیدا شد

| باگ                                                                              | علت                                                                  | رفع/گارد                                                                                  |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| قیمت‌ها روی سایت زنده **هرگز** نمایش داده نمی‌شد                                 | `/api/billing/plans` در production → 401 (در `publicPaths` نبود)     | `exactPublicPaths` (تطبیق دقیق، نه prefix) + تست بک‌اند؛ `/plans/x` و `/plansX` هنوز 401  |
| `bg-[var(--gradient-brand)]` در ۳۳ جا (دکمه‌ی پیش‌فرض، badge، FAB) بدون پس‌زمینه | Tailwind آن را `background-color` می‌کند؛ گرادیان رنگ نیست → نامعتبر | `bg-[image:var(--gradient-brand)]` + `gradient-background-class.test.ts`                  |
| هدر sticky اسکرول می‌شد (top −3520)                                              | wrapper با `overflow-x-hidden` = scroll container                    | `overflow-x-clip` + گارد                                                                  |
| ریبون «ساخته‌شده برای هر نوع کسب‌وکار» در fa/af خالی می‌شد                       | RTL با reverse کردن جهت، ترک را یک کپی جابه‌جا شروع می‌کرد (پوشش ۰٪) | keyframe مجزای `marquee-rtl`؛ پوشش ۱۰۰٪ اندازه‌گیری شد + `marquee-rtl.test.ts`            |
| دو ردیف ریبون هم‌جهت                                                             | `animate-*` shorthand، `animation-direction` را reset می‌کرد         | `![animation-direction:reverse]`                                                          |
| PostHog هرگز شروع نمی‌شد                                                         | منتظر رویداد `load` که قبلاً رخ داده بود                             | `document.readyState === 'complete'`                                                      |
| منوی بالا `#transform` → بخشی که وجود نداشت                                      | صحنه حذف شده بود، آیتم منو نه                                        | حذف + گارد «هر anchor منو mount شده باشد»                                                 |
| کنتراست تم روشن: teal 1.6:1، خاکستری 3.1:1، success 2.5:1                        | PSI در تم روشن رندر می‌کند؛ توکن‌های تیره برای روشن استفاده می‌شد    | توکن‌های جدا در بلوک light (primary 22%، tertiary 40%، وضعیت‌ها)، گرادیان تیره + متن سفید |
| ۲۳ کلید ترجمه‌ی ناموجود (FAQ، کارت‌های hero، pricing.month) + ۸ کارت قابلیت      | مسیر کلید اشتباه / فقط fallback فارسی                                | کلید در ۳ زبان + `landing-i18n-keys.test.ts` (کلید لیترال + خانواده‌های داده‌محور)        |
| ارقام فارسی و «۵۰ در ماه» روی `/en`                                              | داده‌ی از پیش فرمت‌شده                                               | `formatNumber` + مقدار عددی + گارد                                                        |
| «Trusted by…» ادعای بی‌پشتوانه                                                   | ترجمه‌ی en قدیمی                                                     | «Built for every type of business»                                                        |
| «تماس با فروش» به ثبت‌نام می‌رفت                                                 | href اشتباه                                                          | `/{lang}/contact`                                                                         |
| `aria-label` روی div بدون role                                                   | toast container                                                      | `role="region"`                                                                           |
| `llms.txt` صفحه‌ی HTML برمی‌گرداند                                               | فایل وجود نداشت                                                      | `apps/web/public/llms.txt`                                                                |
| `NavigationRegistry` id تکراری                                                   | wrapper و section هر دو id دارند                                     | ✅ wrapper بدون id                                                                        |

---

## ۳. امنیت / «درز»

- باز کردن endpoint عمومی: فقط **تطبیق دقیق مسیر**، نه `startsWith` (وگرنه هر زیرمسیر باز می‌شود). قبلش handler را بخوان که `request.userId` / `tenancy` نمی‌خواند.
- `woodencork.com/api/collect` در گزارش دسکتاپ PSI دیده شد و در کد ما **نیست** — احتمالاً تزریق محیط PSI/اکستنشن؛ اگر روی سایت زنده دیده شد، بررسی شود.
- `claude-seo` به‌صورت gitlink (submodule بدون `.gitmodules`) در ریپو است → هشدار Vercel. `git rm --cached claude-seo` (اقدام کاربر).

---

## ۴. روش کار / تله‌های ابزار (برای سشن بعد)

- **پنل مرورگر مخفی** → `requestAnimationFrame` و رندر متوقف؛ اسکریپت با rAF تا ابد می‌ماند، `document` ممکن است نسخه‌ی `hidden S:0` استریم را نشان دهد. اول یک screenshot بگیر، از `setTimeout` استفاده کن.
- **viewport بلند** (مثلاً 360×2600) + مخفی کردن بخش‌های بالا = اسکرین‌شات بخش‌های پایین؛ اسکرول در پنل عکس را نمی‌گیرد.
- مرورگر preview کش می‌کند → بعد از بیلد `?v=N` به URL اضافه کن.
- `next build` فایل `apps/web/next-env.d.ts` را تغییر می‌دهد → `git checkout -- apps/web/next-env.d.ts`.
- heredoc: `\\b` و `[\\/]` داخل template/regex خراب می‌شود → Write tool یا `String.raw`؛ مسیر فایل با `basename`.
- Prettier/linter فایل را بعد از edit عوض می‌کند (`marquee: {` بدون کوتیشن، CRLF) → قبل از replace دوباره بخوان.
- هر گارد را **injection-test** کن؛ دو بار sed من match نکرد و تست به‌ظاهر «سبز ماند» — بدون شمارش match، injection اثبات نیست.
- اندازه‌گیری mobile-first: ارتفاع هر section، `scrollWidth > clientWidth`، المان‌های `font-size < 12px`، `getBoundingClientRect` هدر بعد از اسکرول.

---

## ۵. قواعد طراحی لندینگ (تثبیت‌شده)

- mobile-first: کلاس بی‌پیشوند = گوشی؛ `max-lg:` ممنوع در لندینگ.
- **هیچ اسکرول افقی** (خواسته‌ی صریح کاربر)؛ فقط جدول تعرفه از `lg`. کارت‌ها روی موبایل = لیست گروهی عمودی.
- منوی موبایل = `Sheet` خود پروژه (نه دست‌ساز).
- مقیاس تایپ/فاصله در `landing-primitives.tsx` (`LANDING_TYPE`، `LANDING_SECTION`).
- جهت آیکون با `ForwardArrow` (انتخاب بر اساس `dir`)، نه چرخاندن.
- داده‌ی ساختگی ممنوع: بدون ستاره/نظر/آمار شمرده‌نشده؛ قیمت فقط از `usePlans`.

## ۶. هنوز باز

- PSI موبایل ۹۷ → ۱۰۰ بعد از deploy تغییرات scoped-messages اندازه گرفته نشده.
- صفحات dashboard، login، team-and-payroll، warehouse، governance (درخواست #58).
- تبدیل بخش‌های ایستای لندینگ به Server Component (کاهش hydration) اگر TBT مانع شد.
- WOFF2 فونت‌ها (نیازمند اجازه‌ی نصب ابزار).
