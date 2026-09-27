# Cloudflare جلوی Render — راهنمای راه‌اندازی (۲۷ سپتامبر ۲۰۲۶)

## معماری

```
کاربر
  │
  ├── api.hisabche.com ──► Cloudflare (proxy نارنجی، بدون Worker)
  │                          │  ├─ کش: فقط بلاگ عمومی و فید آپدیت
  │                          │  ├─ Rate limit لبه روی /api/auth/*
  │                          │  └─ WAF / DDoS / ربات
  │                          ▼
  └── (failover) ─────────► Render load balancer ──► instance 1..N ──► Supabase
      آدرس مستقیم onrender.com
```

**چرا Worker در مسیر API نیست:** پلن رایگان Workers سقف ۱۰۰هزار درخواست در روز دارد؛ یعنی خودِ Worker
همان چیزی می‌شد که «به لیمیت می‌خورد». proxy معمولی Cloudflare چنین سقفی ندارد و همه‌ی کارهای لازم
(کش، rate limit، WAF) را بدون کد انجام می‌دهد. چند اکانت رایگان برای دور زدن سقف هم هم خلاف شرایط
Cloudflare است و هم سرور اضافه نمی‌سازد — Worker جای Fastify را نمی‌گیرد.

## اگر Cloudflare از کار بیفتد — سه لایه

| لایه      | چه می‌کند                                                                                                                                                                                     | کجاست                                   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| ۱. کلاینت | خطای لبه (بدون پاسخ، 520–527/530، یا 429/502/503/504 **غیر JSON**) → همان درخواست یک بار به آدرس مستقیم Render می‌رود و ۵ دقیقه همه‌ی درخواست‌ها مستقیم می‌روند؛ بعد دوباره لبه امتحان می‌شود | `packages/api/src/lib/edge-failover.ts` |
| ۲. بک‌اند | IP واقعی کاربر با و بی Cloudflare یکسان خوانده می‌شود؛ پس rate limit در حالت failover هم درست کار می‌کند                                                                                      | `backend/src/utils/trusted-proxies.ts`  |
| ۳. کش     | `stale-if-error=86400` — اگر Render پایین باشد، بلاگ و فید آپدیت از لبه سرو می‌شوند                                                                                                           | `backend/src/utils/edge-cache.ts`       |

فقط چیزی دوباره فرستاده می‌شود که دوبار فرستادنش امن است: GET/HEAD، یا نوشتنی که `Idempotency-Key` دارد
(ثبت فاکتور، سند دستی). پرداخت یا نوشتن بدون کلید **دوباره فرستاده نمی‌شود** — 524 یعنی به سرور رسیده.
429ِ JSON یعنی rate limiter خودِ ما؛ دور زده نمی‌شود.

## گام‌ها (به ترتیب)

1. **Env کلاینت‌ها** (Vercel / EAS / بیلد دسکتاپ):
   - `NEXT_PUBLIC_API_URL=https://api.hisabche.com/api` (بدون تغییر)
   - `NEXT_PUBLIC_API_FALLBACK_URL=https://<سرویس-شما>.onrender.com/api` ← جدید
   - موبایل: `EXPO_PUBLIC_API_FALLBACK_URL` با همان مقدار.
   - تنظیم‌نکردن = بدون failover، رفتار قبلی (پیش‌فرض صریح).
2. **Deploy بک‌اند** (trustProxy + هدرهای کش) — **قبل** از روشن‌کردن Cloudflare.
3. **DNS در Cloudflare:** رکورد `api` → CNAME به `<سرویس>.onrender.com`، Proxy = نارنجی.
   در Render → Custom Domains همان `api.hisabche.com` باشد.
4. **SSL/TLS:** حالت **Full (strict)**. هرگز Flexible (درخواست بدون TLS به Render می‌رود).
5. **Cache Rules** (Caching → Cache Rules) — فقط این دو:
   - `URI Path starts with /api/blog/posts` یا `/api/blog/sitemap` → _Eligible for cache_،
     Edge TTL = _Use cache-control header_.
   - `URI Path starts with /api/updates/` → همان.
     ⚠️ هیچ قانون «Cache Everything» روی `/api/*` نسازید: Cloudflare workspace نمی‌شناسد و پاسخ یک فروشگاه
     را به فروشگاه دیگر می‌دهد.
6. **Rate limiting rule** (Security → WAF → Rate limiting): `URI Path starts with /api/auth/` ،
   مثلاً ۲۰ درخواست در ۱۰ ثانیه برای هر IP → Block. (بک‌اند rate limit خودش را هم دارد.)
7. **امتحان failover:** رکورد `api` را موقتاً روی یک مقصد غلط بگذارید یا proxy را Pause کنید؛ اپ باید
   با آدرس مستقیم کار کند. بعد برگردانید.

## چیزی که هرگز نباید از کش Cloudflare رد شود

هر پاسخ احراز هویت‌شده (فاکتور، مشتری، گزارش)، `/api/sync/*`، هر نوشتن. هیچ‌کدام `s-maxage` ندارند و
Cloudflare JSON را به‌طور پیش‌فرض کش نمی‌کند — فقط قانون کش اضافه نکنید.

## منطقه‌ها — بزرگ‌ترین عامل سرعت

Supabase در **ap-southeast-2 (سیدنی)** است و Render بدون `region` در `render.yaml` یعنی **Oregon**.
هر رفت‌وبرگشت API↔DB از اقیانوس آرام رد می‌شود (~۱۵۰–۳۰۰ms)؛ کوئری‌ای که در دیتابیس ۰٫۱۵ms است در
لاگ ۲۵۰ms دیده می‌شود. هر دو را در یک منطقه بگذارید (برای کاربران ایران/افغانستان: Frankfurt برای هر
دو، یا Render Singapore کنار Sydney). این تصمیم زیرساختی شماست؛ کد برای هر دو حالت آماده است.
