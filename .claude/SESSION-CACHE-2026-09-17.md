# سشن ۱۵ تا ۱۷ سپتامبر ۲۰۲۶ — لندینگ، سئو، ثبت فاکتور

> خلاصه‌ی یکجای درس‌های این سشن. جزئیات پرفورمنس: `SESSION-CACHE-2026-09-15-PERF.md`.
> باگ‌ها: `BUG-REGISTRY.md` (BUG-006، BUG-007). درخواست‌ها: `USER-REQUESTS.md` (#52 تا #79).
> هیچ‌کدام commit نشده؛ همه منتظر deploy کاربرند.

---

## ۱. قواعد جدید (هر کدام از یک باگ واقعی آمده)

| قاعده                                                                  | چرا                                                                                                      | گارد                                                 |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| هر هدر جدید در `packages/api` = همان commit در `allowedHeaders` بک‌اند | `Idempotency-Key` اضافه شد، CORS نه → ثبت فاکتور در وب کلاً قطع شد                                       | `backend/src/__tests__/cors-allowed-headers.test.ts` |
| خواندنی که «تصمیم» یا «هشدار» می‌سازد نباید `limit` داشته باشد         | هشدار موجودی از `useProducts({ limit: 100 })` → کالای ۱۰۱ام هرگز بررسی نمی‌شد                            | `invoice-oversold-warning.test.ts`                   |
| هشدار باید جایی باشد که تصمیم گرفته می‌شود                             | هشدار منفی‌شدن موجودی فقط در پیش‌نمایش بود، نه هنگام تایپ                                                | همان                                                 |
| root layout هرگز `alternates`/canonical پیش‌فرض ندارد                  | ~۴۰ صفحه‌ی noindex داشبورد canonical را به صفحه‌ی اصلی می‌دادند                                          | crawl محلی (بخش ۳)                                   |
| `robots.ts` باید همه‌ی مسیرهای `(dashboard)` را disallow کند           | ۲۱ مسیر فراموش شده بود؛ SEMrush آن‌ها را crawl کرد                                                       | `robots-dashboard-routes.test.ts`                    |
| لینک درون‌سایتی همیشه با پیشوند locale                                 | `/features/x` → 307 → زنجیره‌ی ریدایرکت + خواننده‌ی en به صفحه‌ی fa                                      | `crawlable-nav.test.ts`                              |
| لینک به صفحه‌ی خصوصی از صفحه‌ی عمومی `rel="nofollow"`                  | دکمه‌ی «باز کردن در برنامه» در docs ربات را به داشبورد می‌برد                                            | —                                                    |
| عنوان صفحه برند ندارد                                                  | template layout خودش `                                                                                   | حسابچه` اضافه می‌کند → برند دو بار                   | crawl |
| هر ادعا در متن لندینگ/FAQ با کد تطبیق داده شود                         | ورود دو مرحله‌ای، بک‌آپ ۳۰ روزه، وب‌هوک، «آزمایشی ۳۰ روزه» (کد: ۷)، Starter ۹ دلار — هیچ‌کدام واقعی نبود | `landing-claims.test.ts` (روی messages هر ۳ زبان)    |
| لیست‌های whitelist دستی کنار مصرف‌کننده گارد می‌خواهند                 | `SectionId` هنوز pain/testimonials بود → هدر با اسکرول عوض نمی‌شد                                        | `landing-i18n-keys.test.ts`                          |
| صفحات عمومی فقط زیرمجموعه‌ی پیام‌ها را می‌گیرند                        | `FullMessagesLayout` کل ۱۶۰KB کاتالوگ را در هر صفحه‌ی legal می‌ریخت (513→373KB)                          | `public-page-message-keys.test.ts`                   |

## ۲. پرفورمنس لندینگ — چیزهایی که واقعاً اثر داشت

- بخش‌های ایستا = **server component** (بدون `'use client'`، بدون hook). گارد در `landing-i18n-keys.test.ts`.
- **DOM budget:** آیکون lucide = `<svg>` + چند `<path>`. فلش/تیک/شورون تزئینی = کاراکتر CSS با `::before/::after` (`ltr:after:content-['→']`). ۱۷۸۰ → ۱۴۶۹ المنت.
- `<Link prefetch={false}>` روی همه‌ی لینک‌های لندینگ (prefetch، JS داشبورد را می‌کشید).
- بدون `<Suspense>` دور کل صفحه (محتوا در `div hidden` تا انتهای stream → LCP).
- انیمیشن continuous (marquee) → حذف؛ PageSpeed «non-composited animations» را می‌شمرد.
- IntersectionObserver با `threshold: 0.25` برای سکشن بلندتر از ۴ صفحه هرگز fire نمی‌شود → `rootMargin: '-45% 0px -50% 0px'`.
- اندازه‌گیری محلی: `cdp-tbt.mjs` در scratchpad (CPU 6× دسکتاپ، 12× موبایل). عدد محلی نویز زیادی دارد؛ فقط PSI واقعی بعد از deploy معتبر است.

## ۳. سئو — روش درست کار

1. crawl محلی از build production (sitemap + لینک‌ها، **با احترام به robots و nofollow** مثل SEMrush).
2. هر یافته را به URL واقعی وصل کن؛ P0/P1/P2.
3. P2 (H3 نداشتن، کلمات عنوان در متن، تعداد JS) را دستکاری نکن — دلیل بنویس.
4. متن را با **بدنه‌ی خود صفحه** چک کن (description دسترسی‌پذیری ادعای screen reader می‌کرد، صفحه نه).
5. کپی متن رقبا ممنوع (§10 + کپی‌رایت + duplicate content)؛ رقبا فقط برای intent و ساختار.
6. E-E-A-T (تیم، آدرس، تلفن، testimonial) بدون داده‌ی واقعی کاربر جعل است — بپرس.

## ۴. تله‌های ابزار در این محیط (ویندوز + harness)

- ⚠️ **`python -`، `cat > file` بدون heredoc، و `python - <<EOF … </dev/null` همه hang می‌کنند** (stdin بسته نمی‌شود، ۴ بار رخ داد). همیشه: اسکریپت را با ابزار Write در scratchpad بنویس و `python file.py </dev/null`.
- یک formatter بعد از هر ذخیره فایل را بازنویسی می‌کند → replace دقیق پایتونی بعد از ذخیره شکست می‌خورد. Edit tool (بعد از Read) یا Write کامل.
- پنل مرورگر وقتی پنهان است `content-visibility` را رندر نمی‌کند → اسکرین‌شات سیاه. اسکرین‌شات با Chrome headless (`shot.mjs`).
- PDF بدون متن قابل انتخاب (glyph برداری): Chrome headless + اسکرول با `Input.dispatchMouseEvent` (فرگمنت `#page=` کار نمی‌کند).
- `next start` بیلد را هنگام شروع می‌خواند → بعد از هر build سرور preview را restart کن.

## ۵. باز / منتظر کاربر

- deploy و PSI/SEMrush/میزفاتولز دوباره.
- React error #418 (hydration متن) در مسیر فاکتور — بدون بازتولید در dev هنوز ریشه‌یابی نشده.
- کندی لاگین: هر فراخوان Supabase REST ≈ ۷۰۰ms و `/api/v1/activities` ۲۸ کوئری → فاصله‌ی region سرور Render و Supabase + خواب رفتن سرویس (hostname: `hibernate`). زیرساختی؛ باید region و پلن چک شود.
- سیاست کوکی می‌گوید tracking شخص ثالث نداریم، اما GA و PostHog بعد از تعامل بار می‌شوند — تصمیم حقوقی کاربر.
- اطلاعات واقعی E-E-A-T (تیم، آدرس، تلفن، testimonial).
