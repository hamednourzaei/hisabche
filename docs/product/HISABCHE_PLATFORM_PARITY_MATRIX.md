# ماتریس هم‌ارزی سه پلتفرم — وب · ویندوز · اندروید

> کامیت `28154aca` · ۷ نوامبر ۲۰۲۶ · سند اصلی: [HISABCHE_MASTER_USER_JOURNEY.md](HISABCHE_MASTER_USER_JOURNEY.md)
> هیچ‌کدام از سه برنامه در این ممیزی اجرا نشد؛ همه‌ی خانه‌ها از خواندن کد است. ستون‌های ویندوز و اندروید هر دو `packages/app-shell` را رندر می‌کنند؛ تفاوتشان فقط در host است (Electron + better-sqlite3 در برابر Expo WebView + expo-sqlite).

## ۱. معماری

| مورد         | وب                                                     | ویندوز                                                          | اندروید                                                       |
| ------------ | ------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------- |
| پوسته        | `apps/web/app/[lang]/(dashboard)/dashboard-layout.tsx` | `packages/app-shell` در `apps/desktop`                          | `packages/app-shell` داخل WebView (`apps/mobile`)             |
| مسیر         | `/{lang}/…`                                            | `/#/…` بدون locale                                              | همان                                                          |
| گارد         | `useRedirectGuard` (`dashboard-layout.tsx:171`)        | `RequireAuth` (`app-shell/src/features/auth/require-auth.tsx`)  | همان                                                          |
| ذخیره‌ی نشست | localStorage + کوکی httpOnly refresh                   | vault (`electron/main/services/secure-store.ts`)                | host بومی (`apps/mobile/src/host/native-bridge.ts`)           |
| موتور محلی   | ندارد                                                  | `packages/local-engine` (`electron/main/services/local-api.ts`) | `packages/local-engine` (`apps/mobile/src/host/local-api.ts`) |
| صف خروجی     | ندارد                                                  | SQLite (`app-bridge`)                                           | SQLite (`local-db.ts`؛ مهاجرت صف قدیمی AsyncStorage)          |

## ۲. ۱۲ پرسش برای هر پلتفرم

| پرسش                       | وب                                                                                                        | ویندوز                                                                                             | اندروید                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------- |
| ۱. ثبت‌نام؟                | بله — `AuthContainer`؛ اعتبارسنجی رمز ضعیف‌تر از سرور                                                     | بله — `login-page.tsx` با `signUpSchema` سرور                                                      | بله — همان app-shell          |
| ۲. ورود؟                   | بله                                                                                                       | بله؛ و ورود به «نسخه‌ی آفلاین» با مجوز                                                             | بله؛ همان                     |
| ۳. ساخت/انتخاب workspace؟  | بله (onboarding، سوییچر)                                                                                  | بله (همان `OnboardingContainer`؛ `LocalFirstRunForm` برای نسخه‌ی آفلاین)                           | بله                           |
| ۴. ساخت کالا؟              | آنلاین                                                                                                    | آنلاین و آفلاین (`POST                                                                             | PATCH /products`=`available`) | همان |
| ۵. فروش آفلاین؟            | **خیر**                                                                                                   | بله (`POST /invoices` = `available`)                                                               | بله                           |
| ۶. دریافت پرداخت آفلاین؟   | **خیر**                                                                                                   | بله (`POST /payments` = `available`)                                                               | بله                           |
| ۷. تغییر موجودی آفلاین؟    | **خیر**                                                                                                   | بله برای انتقال/تعدیل‌هایی که در ماتریس `available` هستند (`local-engine/src/routes/transfers.ts`) | بله                           |
| ۸. تاریخچه‌ی مشتری آفلاین؟ | **خیر**                                                                                                   | بله (`GET /customers/:x`، `/accounting` = `available`)                                             | بله                           |
| ۹. وقتی اینترنت برمی‌گردد؟ | —                                                                                                         | صف push می‌شود؛ pull از cursor (`sync.routes.ts`، `sync-stream.routes.ts`)                         | همان                          |
| ۱۰. تعارض؟                 | —                                                                                                         | فروش بیش از موجودی رد نمی‌شود؛ conflict ثبت و در `/api/conflicts` حل دستی                          | همان                          |
| ۱۱. کرش وسط عملیات؟        | فرم: idempotency-key یک بار به‌ازای هر پرکردن فرم (CLAUDE.md)؛ فاکتور: RPC سند یک تراکنش، دفتر/پرداخت جدا | نوشتن محلی + صف با کلید idempotency؛ بقای ردیف نیمه‌کاره **سنجیده نشد** → `UNKNOWN`                | همان → `UNKNOWN`              |
| ۱۲. خروج با تغییرات معلق؟  | — (صفی نیست)                                                                                              | دیالوگ هشدار با شمارش (`logout-pending-dialog.tsx`)                                                | همان                          |

## ۳. ماژول به ماژول

| ماژول               | وب                             | ویندوز                                                  | اندروید     | یادداشت                              |
| ------------------- | ------------------------------ | ------------------------------------------------------- | ----------- | ------------------------------------ |
| لندینگ و سایت عمومی | ✅                             | ❌ (نیاز نیست)                                          | ❌          | —                                    |
| ثبت‌نام/ورود        | ✅                             | ✅                                                      | ✅          | اعتبارسنجی رمز ناهم‌سان (وب ضعیف‌تر) |
| ورود نمایشی         | ✅ (کلاینت-فقط)                | پیدا نشد                                                | پیدا نشد    | —                                    |
| Onboarding          | ✅                             | ✅                                                      | ✅          | همان کامپوننت                        |
| داشبورد             | ✅ آنلاین                      | ✅ آنلاین/محلی (`local-engine/src/routes/dashboard.ts`) | ✅          | —                                    |
| کالا و انبار        | ✅                             | ✅ + آفلاین                                             | ✅ + آفلاین | —                                    |
| فاکتور              | ✅                             | ✅ + آفلاین                                             | ✅ + آفلاین | ویرایش فاکتور (`PATCH`) آنلاین‌فقط   |
| پرداخت              | ✅                             | ✅ + آفلاین                                             | ✅ + آفلاین | —                                    |
| صندوق               | ✅                             | ✅ + آفلاین                                             | ✅ + آفلاین | —                                    |
| مرجوعی              | ✅                             | ✅ ثبت آفلاین؛ بازپرداخت آنلاین                         | همان        | —                                    |
| حسابداری (خواندن)   | ✅                             | ✅ دفتر روزنامه محلی                                    | ✅          | `post-to-ledger` آنلاین‌فقط          |
| تولید               | ✅                             | آنلاین‌فقط                                              | آنلاین‌فقط  | ماتریس: `online_required`            |
| حقوق                | ✅                             | ✅ (`GET /payrolls` = `available`)                      | ✅          | —                                    |
| billing             | ✅                             | آنلاین‌فقط                                              | آنلاین‌فقط  | —                                    |
| مجوز آفلاین         | —                              | ✅                                                      | ✅          | صندلی `computer`/`mobile`            |
| صفحه‌ی همگام‌سازی   | `/sync-center` (کانتینر مشترک) | `features/sync/sync-page.tsx` (صف خود دستگاه)           | همان        | عمداً متفاوت (CLAUDE.md §۰٫۶)        |
| چاپ                 | مرورگر                         | `electron/main/services/printing.ts`                    | host بومی   | —                                    |
| دوربین/بارکد        | Permissions-Policy             | CSP Electron                                            | host        | سه جای مجزا (BUG-089)                |

## ۴. شمار ماتریس آفلاین

از `packages/validation/src/schemas/offline-endpoint-matrix.ts` (شمارش ردیف‌های `'METHOD /path': [feature, status]`):

| وضعیت             | تعداد |
| ----------------- | ----- |
| `available`       | ۱۹۱   |
| `online_required` | ۳۱۰   |
| `not_supported`   | ۱۵    |

گارد: endpoint بدون ردیف، CI را قرمز می‌کند (`offline-matrix-guard.test.ts`).

## ۵. شواهد

- `offline-invoice-sync.test.ts`, `sync-invariants.test.ts`, `offline-license-policy.test.ts`: **اجرا شدند، سبز** (بخشی از ۱۹۱ تست).
- تست‌های Jest دسکتاپ/موبایل و E2E (`apps/desktop/e2e`, `apps/mobile/e2e`) در این ممیزی **اجرا نشدند** (worktree بدون `node_modules`؛ نیاز به build).
- بیلد اندروید/ویندوز اجرا نشد (طبق قاعده‌ی پروژه فقط با درخواست صاحب پروژه).
- هر ادعای «آفلاین کار می‌کند» در این جدول = `IMPLEMENTED_NOT_LIVE_VERIFIED`.
