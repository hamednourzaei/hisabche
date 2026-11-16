# V70 — پرامپت اجرایی (فازبندی مکتوب)

نسخه‌ی دوم: هر فاز با PRIMARY/SECONDARY/گارد/پذیرش نوشته شده تا مثل `V68-V69-PROMPT.md` قابل
اجرا و قابل بازبینی باشد. مرجع قواعد: `AGENTS.md` و `CLAUDE.md`.

---

## ۰. قواعد (خلاصه‌ی اجرایی)

1. عدد جعلی ممنوع؛ هر شاهد = فرمان + نتیجه‌ی واقعی. «اجرا نشد» یک جواب معتبر است.
2. بدون commit/push/stash/reset/rebase/branch؛ کار در working tree.
3. بدون DDL روی دیتابیس زنده؛ فقط فایل migration/VERIFY/pg test با
   `PENDING HUMAN CONFIRMATION`.
4. بدون dependency تازه؛ بیلد فقط در V70.8.
5. یک سرویس/کامپوننت برای هر کار؛ توسعه‌ی خانه‌ی موجود، نه دوم.
6. «۱۰۰ از ۱۰۰» فقط با سبزی هر ۱۰۰ دروازه‌ی §۲٫۵؛ دروازه‌ی `BLOCKED_EXTERNAL` سبز نیست.
7. تضاد کد با §۲ ⇒ توقف و ثبت در PROGRESS، بدون تغییر تصمیم.
8. هر گارد تازه injection می‌شود (قرمز ⇒ بازگردانی ⇒ سبز).
9. §۸ مال معمار است.
10. ترتیب فازها اجباری است.

## ۰٫۱. خواندن اجباری

`AGENTS.md` → `CLAUDE.md` → `.claude/skills/hisabche-session-rules/SKILL.md` →
`.ai/codebase/CODEBASE_MAP.md` → `V68-V69-PROGRESS.md` (F1–F12) → `V70-BACKLOG.md` →
`V70-MEASUREMENTS.md` → `INDUSTRY-REGISTRY.md`.

---

## ۱. خط پایه

| سنجه                                      | عدد                                               |
| ----------------------------------------- | ------------------------------------------------- |
| route / service / جدول / feature key      | **۱۲۵ / ۷۹ / ۳۶۶ / ۲۰۴**                          |
| صنف / ردیف رجیستری                        | **۶۷ / ۶۷** (available ۶۳، partial ۳۱، planned ۰) |
| probe ۱۰۰ کاندید                          | **۳۰ نام منطبق، ۷۰ بدون نام**                     |
| backend (بدون pg) / ui / validation / api | **۵۷۸۳ / ۲۸۷۴ / ۱۱۰۵ / ۱۰**                       |
| `tsc` شش پکیج                             | **exit 0**                                        |
| next build                                | ✓ 19.1s · desktop/android **exit 1** (محیط)       |
| jest / Postgres                           | **نصب نیست / نیست**                               |
| `git status --short`                      | **۹۵ ورودی**                                      |

---

## ۲. تصمیم‌های معماری (ثابت)

1. سرور مرجع، دستگاه تسریع؛ هر نوشتن محلی `Idempotency-Key` + `confirm-server` در یک تراکنش.
2. یک هسته، دو ذخیره‌ساز؛ قاعده‌ی پول یک بار.
3. مکان اجرا فقط `executionSiteFor`؛ عملی که hook ندارد در سند `server` است.
4. یک پوشر برای هر ردیف outbox (`claimQueue` + lease).
5. پول = عدد صحیح واحد کوچک؛ «ناشناخته» صفر نمی‌شود.
6. `workspace_id` تنها مرز امنیتی.
7. کاتالوگ شکاف تولیدی است؛ سند دستی ویرایش نمی‌شود.
8. هر «غایب» با probe چهارفهرستی سنجیده می‌شود؛ عدد چاپ می‌شود.
9. archetype از مولد رجیستری، نه نگاشت دوم.

## ۲٫۵. ۱۰۰ دروازه (A–J، هر کدام ۱۰)

| حوزه             | دروازه‌ها                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. هسته مالی     | A1 فاکتور محلی · A2 بازگشت شناسه سرور · A3 پرداخت محلی · A4 تخصیص دو ارزی · A5 مرجوعی · A6 دفتر · A7 بهای تمام‌شده · A8 سقف اعتبار · A9 مالیات · A10 گرد کردن |
| B. همگام‌سازی    | B1 یک پوشر · B2 lease · B3 retry · B4 تکرار · B5 pull کامل · B6 ۴۰۹ · B7 ترتیب · B8 cutover · B9 replay · B10 tombstone                                       |
| C. آفلاین دستگاه | C1 آمادگی · C2 مکان اجرا · C3 خواندن · C4 نوشتن · C5 نشان تازگی · C6 صف · C7 بازیابی crash · C8 نشست منقضی · C9 حافظه · C10 دو workspace                      |
| D. داده          | D1 migration additive · D2 VERIFY · D3 pg test · D4 tenancy · D5 RLS · D6 یکتایی · D7 rollback · D8 ایندکس · D9 بکاپ · D10 بازیابی                            |
| E. ۶۷ صنف        | E1 رجیستری · E2 داشبورد · E3 آس اختصاصی · E4 آفلاین هر صنف · E5 ماتریس شکاف · E6 سند · E7 سه زبان · E8 پک · E9 گارد محتوا · E10 اتحادیه                       |
| F. امنیت         | F1 نشست · F2 نقش · F3 capability · F4 قفل دستگاه · F5 رمز · F6 audit · F7 نرخ · F8 ورودی · F9 secret · F10 نشت                                                |
| G. کارایی        | G1 فاکتور < ۱۰ms · G2 صف ۱k · G3 داشبورد < ۳۰۰ms · G4 ایندکس · G5 N+1 · G6 حافظه · G7 اسناد · G8 صفحه‌بندی · G9 جست‌وجو · G10 export                          |
| H. انتشار        | H1 web · H2 desktop · H3 APK · H4 نصب · H5 مهاجرت داده · H6 نسخه · H7 update · H8 rollback · H9 crash-free · H10 لاگ                                          |
| I. مستندات       | I1 README صنف · I2 کاتالوگ شکاف · I3 درس‌ها · I4 قرارداد API · I5 راهنمای کاربر · I6 متن خطا · I7 سه زبان · I8 نمودار · I9 changelog · I10 نقشه               |
| J. کیفیت         | J1 واحد · J2 pg · J3 گارد · J4 injection · J5 e2e · J6 type-check · J7 eslint · J8 diff · J9 بدون ادعای کاذب · J10 بازبینی خود                                |

نمره = تعداد دروازه‌های سبز با شاهد؛ `BLOCKED_EXTERNAL` سبز نیست. جدول وضعیت در `V70-PROGRESS.md` §۳.

---

## ۳. فازها

### - [x] V70.0 — اندازه‌گیری و FINDINGS (بدون کد محصول)

شاهد: `node scripts/industry/generate-v70-measurements.mjs` ⇒ route ۱۲۵ · service ۷۹ · جدول ۳۶۶ · feature ۲۰۴ · صنف ۶۷ · probe ۱۰۰ ⇒ ۳۰/۷۰.

- خروجی: `V70-MEASUREMENTS.md` + `V70-PROGRESS.md`. **انجام شد.**

### - [x] V70.1 — کاتالوگ ۶۰ شکاف × ماتریس ۶۷ صنف (تنها خروجی تحقیق رقیب)

شاهد: `node scripts/industry/generate-gap-matrix.mjs` ⇒ `gaps=60 industries=67 coverage=min:22/max:38 probeNonZero=0`؛
`--check` ⇒ exit **0** با stderr خالی و هش یکسان در اجرای دوباره؛ `npx vitest run src/__tests__/competitor-gap-matrix.test.ts` ⇒ **۷/۷** (شامل دو injection)؛
`npx vitest run` کل پکیج ⇒ **۱۱۱۲/۱۱۱۲** در ۸۹ فایل؛ `npx tsc --noEmit` ⇒ exit **0**؛ eslint روی فایل تست ⇒ **۰ خطا**.

**PRIMARY**

- `scripts/industry/competitor-gaps.data.mjs` — دقیقاً ۶۰ شکاف: `id` (G01…)، خانواده، نام fa/en،
  رقیب مرجع (QuickBooks/Xero/Zoho/Odoo/Loyverse/Toast/Shopmonkey/Mindbody/Fresha/ServiceTitan/
  Salla/Zid/سپیدار/هلو)، `probe` (نام‌های قابل جست‌وجو)، `applies` (bucket archetype + id صریح)، فاز مقصد.
- `scripts/industry/gap-matrix.lib.mjs` — bucketها از archetype رجیستری، probe روی چهار فهرست
  (route/service/table/feature)، ساخت متن هر دو سند.
- `scripts/industry/generate-gap-matrix.mjs` — نوشتن سند + `--check` (مقایسه، بدون نوشتن).
- `docs/architecture/V70-COMPETITOR-GAPS.md` (تولیدی) — جدول ۶۰ شکاف با عدد probe.
- `docs/industries/COMPETITOR-GAP-MATRIX.md` (تولیدی) — ۶۷ ردیف صنف.

**گارد** `packages/validation/src/__tests__/competitor-gap-matrix.test.ts`

1. `--check` خروجی ۰ (سند روی دیسک = خروجی مولد).
2. دقیقاً ۶۰ شکاف و idهای یکتا.
3. هر ۶۷ `INDUSTRY_KEYS` یک بار، با ≥۵ شکاف.
4. هیچ شکاف `MISSING`ی probe غیرصفر ندارد (عدد در سند چاپ شده).
5. هر شکاف ≥۱ صنف دارد (هیچ شکاف یتیم).
6. injection: حذف یک شکاف از داده ⇒ تست ۲ و ۵ قرمز.

**پذیرش:** ۶۰/۶۷/≥۵؛ `npx vitest run` سبز؛ `npx tsc --noEmit` صفر.

### - [ ] V70.2 — pull چهار جدول (اولویت ۱ بازبین)

**PRIMARY:** `packages/validation/src/schemas/sync-protocol.schema.ts` (چهار موجودیت)،
`feature-packs.ts` (`syncEntities`)، `backend/src/routes/sync.routes.ts` + change-log،
`packages/app-shell/src/features/sync/sync-engine.ts` (snapshot/pull)،
`packages/app-bridge/src/local-schema.ts` فقط اگر جدول نیست.
**گارد:** `sync-pull-four-tables.test.ts` (شل: A→B) + pg test دو workspace.
**پذیرش:** ردیف A روی B خوانده می‌شود؛ pull دوم ساخته نشده؛ kill-switch/نسخه‌ی پروتکل.

### - [ ] V70.3 — پرداخت local-first + `confirm-server` (F8، اولویت ۲)

**PRIMARY:** `packages/local-engine/src/routes/payments.ts` (روت `POST /payments/:id/confirm-server`
قرینه‌ی فاکتور، تراکنش اتمیک + جابه‌جایی `payment_allocation`)،
`packages/app-shell/src/features/sync/sync-engine.ts` (`pushEntry` پرداخت + `confirmServerPayment`)،
`packages/api/src/hooks/payments.ts` (`executionSiteFor('payment.record')` + `localRequest`).
**گارد:** `payment-local-first.test.ts` (صفر axios)، `payment-confirm-roundtrip.test.ts` (push دوم = همان ردیف).
**پذیرش:** تخصیص دو ارزی همان عدد؛ خطای ۴xx موتور بدون fallback.

### - [ ] V70.4 — parity دو ذخیره‌ساز (F7)

**PRIMARY:** `packages/local-engine/src/__tests__/golden-multi-currency-parity.pg.test.ts` (تازه)،
fixture مشترک در `packages/validation/src/__golden__`، مقایسه‌ی ۷ چیز + assert مقیاسی.
**پذیرش:** pg در CI؛ محلی `BLOCKED_EXTERNAL` صادقانه.

### - [ ] V70.5 — تاب‌آوری (اولویت ۴)

**PRIMARY:** `packages/app-shell/src/features/sync/__tests__/sync-resilience.test.ts` (تازه):
crash وسط push، retry بعد lease expiry، duplicate با همان کلید، صف ۱٬۰۰۰، ساعت عقب/جلو، ۵۰۰ میانی.
**پذیرش:** هر تست یک رفتار را قفل می‌کند؛ هیچ تستی skip نمی‌شود.

### - [ ] V70.6 — مرجوعی محلی یا سند server-only

**PRIMARY:** `packages/local-engine/src/routes/invoices.ts` (`reverseEffects` محلی) اگر کامل است؛
وگرنه `documents/OFFLINE_SYNC.md` + گارد `industry-offline-device` با ادعای `server`.
**پذیرش:** برگشت لایه‌ها + سند + انبار در یک تست؛ یا سند صریح بدون ادعا.

### - [ ] V70.7 — دروازه‌ی `installedPacks` (اولویت ۶)

**PRIMARY:** `packages/validation/src/schemas/feature-packs.ts` (کلیدها)،
`packages/ui/.../dashboard-container.tsx` (prop اختیاری)، دو محل رندر، `pack-gate.tsx` (re-export).
**گارد:** `dashboard-pack-gate.test.tsx` — `['core']` هیچ قطعه‌ی غیرcore را mount نمی‌کند.
**پذیرش:** بدون prop رفتار امروز؛ hydration سالم.

### - [ ] V70.8 — بیلد و انتشار (اولویت ۷)

`next build` → `electron-vite build` → `pnpm run android:release`؛ **تاریخ فایل خروجی**.
`Access is denied` سه‌بار ⇒ `BLOCKED_EXTERNAL` با شاهد، بدون عدد جعلی.

### - [ ] V70.9 — سند و درس

`V70-PROGRESS.md`، وضعیت بندهای `V70-BACKLOG.md`، `CLAUDE.md` §۴/§۸، درس تازه،
`documents/OFFLINE_SYNC.md`؛ رجیستری فقط از مولد.

### - [ ] V70.10 — وریفای نهایی + §۵ + §۶

ترتیب: وریفای کامل → eslint → بیلد → نمره‌ی ۱۰۰ دروازه‌ای → گزارش فارسی.

---

## ۴. قالب شاهد

```text
شاهد: <فرمان> ⇒ <نتیجه‌ی عددی واقعی>؛ <فرمان دوم> ⇒ <نتیجه>.
```

## ۵. بازبینی خود

۱) هر تیک بازتولید شد؟ ۲) نماد تکراری/بی‌caller؟ ۳) injection هر گارد؟ ۴) `audit-unwired-routes` و
`check-schema-drift`؟ ۵) جست‌وجوی diff (any، select، router.push، hex، `?? 0` روی پول)؟ ۶) ادعای
ممنوع؟ ۷) هر باگ اول در PROGRESS؟

## ۶. گزارش پایانی

جدول فاز | وضعیت | فایل‌ها | تست | شاهد · FINDINGها · ۶۰ شکاف (خانواده/تعداد) · نمره‌ی ۱۰۰
دروازه‌ای (سبز/کل/بلاک) · migration (هیچ/PENDING) · چه نشد · فرض‌ها · برای مالک.

## ۷. ممنوعیت صریح

هر عدد بدون فرمان = رد. «۱۰۰ از ۱۰۰» بدون ۱۰۰ دروازه‌ی سبز = رد. «۶۷ صنف آماده» بدون شاهد = رد.

## ۸. پایان کار — مال معمار (تیک نمی‌خورد)
