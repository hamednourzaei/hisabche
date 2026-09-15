# Performance Policy — تصمیم‌های عددی و Device Class

> این فایل با Tier 3 نوشته شد. منبع: `packages/ui-contract/src/runtime-policy.ts`
> (توابع خالص) و تست‌های `packages/ui-contract/src/__tests__/runtime-policy.test.ts`.

---

## ⭐ قانون غیرقابل‌مذاکره

```
هزینه‌ی اجرای یک session تابعِ
  VISIBLE FEATURES + BUSINESS CONTEXT + AUTHORIZATION + DEVICE + NETWORK
است — نه تابع حجم کل محصول.
```

تابع `sessionCost()` همین را قابل‌اندازه‌گیری می‌کند و تست
«costs the same whether Hisabche has 5 modules or 50» همین را قفل می‌کند.

## Device Class

| ورودی                         | نتیجه                        |
| ----------------------------- | ---------------------------- |
| RAM ≤ 2GB **یا** CPU ≤ 2 core | `low`                        |
| RAM ≥ 8GB **و** CPU ≥ 8 core  | `high`                       |
| باقی                          | `balanced`                   |
| thermal throttling            | `low` (هرچه specs باشد)      |
| باتری < ۲۰٪ و بدون شارژر      | `low`                        |
| **سیگنال ناشناخته**           | **`balanced` — هرگز `high`** |

مرورگری که RAM را گزارش نمی‌کند معمولاً privacy-hardened است نه قدرتمند؛ حدسِ `high`
همان حدسی است که اپ را غیرقابل‌استفاده می‌کند.

## بودجه‌ها

|              | low | balanced | high |
| ------------ | --- | -------- | ---- |
| ویجت هم‌زمان | ۳   | ۵        | ۸    |
| ردیف در DOM  | ۲۰  | ۳۵       | ۵۰   |
| page size    | ۲۰  | ۳۰       | ۵۰   |
| prefetch     | ✗   | ✗        | ✓    |
| sync batch   | ۲۵  | ۵۰       | ۱۰۰  |
| chart        | ✗   | ✓        | ✓    |
| نقاط چارت    | ۳۰  | ۶۰       | ۱۰۰  |
| realtime     | ✗   | ✓        | ✓    |

**سقف پلتفرم** روی این‌ها اعمال می‌شود: موبایل حداکثر ۵ ویجت / ۳۰ ردیف / ۲۵ page size،
دسکتاپ تا ۱۲ ویجت. موبایل «دسکتاپ کوچک» نیست — محدودیتش صفحه و باتری است نه پردازنده.

**شبکه‌ی ضعیف یا آفلاین**: `prefetch = false`، `syncBatchSize ≤ 25`، و آفلاین یعنی
`realtime = false` — مستقل از سخت‌افزار.

## Performance Mode (انتخاب کاربر)

| حالت            | اثر                                                      |
| --------------- | -------------------------------------------------------- |
| `balanced`      | هیچ تغییری                                               |
| `battery_saver` | prefetch/animation/chart/realtime خاموش، ۳ ویجت، ۲۰ ردیف |
| `fast`          | prefetch روشن، ولی همچنان کران‌دار (≤۱۲ ویجت، ≤۶۰ ردیف)  |

نکته‌ی طراحی: `fast` هم سقف دارد. فلسفه‌ی بودجه این است که **حتی وقتی کاربر بیشتر
می‌خواهد هم برقرار بماند.**

## 🔴 آنچه Device Class هرگز نمی‌کند

```
✗ تغییر permission
✗ تغییر عدد مالی یا نحوه‌ی محاسبه‌اش
✗ تغییر اینکه کدام رکورد وجود دارد یا کدام درست است
```

این با `assertPolicyIsPresentationOnly()` و لیست `FINANCIAL_OR_SECURITY_KEYS` تست
می‌شود، نه با یک کامنت — چون حالت شکستش (گوشی کند بی‌صدا جمعِ متفاوتی نشان بدهد)
تا لحظه‌ی فاجعه نامرئی است.

## پیوند با Visibility (بخش ۴ master prompt)

چیزی که کاربر مخفی کرده نباید فقط رندر نشود؛ نباید bundle/query/subscription/sync
هم بشود. ترتیب همیشه:

```
Authorization (سرور/RLS)  →  UI Visibility Profile  →  Runtime Policy
```

هرگز برعکس. `resolveVisibility()` مجموعه‌ی authorized را **ورودی** می‌گیرد و فقط
می‌تواند زیرمجموعه برگرداند — به همین دلیل «visibility امنیت نیست» یک واقعیت درباره‌ی
کد است، نه یک قول در کامنت.

## کارهای انجام‌نشده (آگاهانه)

| مورد                               | چرا                                                                |
| ---------------------------------- | ------------------------------------------------------------------ |
| `size-limit` / `bundlewatch` در CI | نیازمند تصمیم درباره‌ی آستانه‌ها روی بیلد واقعی؛ قرارداد آماده است |
| Worker برای محاسبات سنگین          | سمت کلاینت، و کلاینت طبق تصمیم فعلی بعد از بک‌اند می‌آید           |
| اعمال policy در web/mobile/desktop | همان دلیل — قرارداد در `packages/ui-contract` آماده است            |

## قواعد اثبات‌شده با PageSpeed (۱۵ سپتامبر ۲۰۲۶)

جزئیات و اعداد: [../SESSION-CACHE-2026-09-15-PERF.md](../SESSION-CACHE-2026-09-15-PERF.md)

1. زیر root layout هرگز از barrel `@hisabche/ui` import نکن — subpath (`@hisabche/ui/toast-provider` …). barrel یک چانک ۱.۶MB داشبورد را روی هر صفحه‌ی عمومی می‌آورد.
2. root layout فقط `CORE_NAMESPACES` ترجمه را می‌فرستد؛ هر مسیر جدید زیر `[lang]` باید `layout.tsx` با `FullMessagesLayout` داشته باشد (`scoped-messages.tsx`).
3. analytics (gtag، PostHog) فقط روی تعامل واقعی؛ بدون تایمر و بدون `scroll`.
4. تصویر LCP داخل `<picture>`: preload دستی برای هر viewport + `fetchPriority="high"`.
5. keyframe انیمیشن بدون `var()` (وگرنه non-composited).
6. فایل‌های `public/` را با ابعاد واقعی بسنج (گارد `public-icon-sizes.test.ts`).
7. گرادیان پس‌زمینه: `bg-[image:var(--x)]`، نه `bg-[var(--x)]`.
