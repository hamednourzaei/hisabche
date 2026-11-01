# 17 — SCREEN STATE MATRIX

commit: `05f749a2` · date: 2026-11-01 · وضعیت: PARTIAL (ساز‌وکار مشترک تأیید شد؛ ماتریس تک‌تک صفحه‌ها NOT_VERIFIED)
مرتبط: [03](03-SCREEN-TO-CORE-MAP.md) · [13](13-PERMISSION-FLOW.md) · [12](12-OFFLINE-SYNC-FLOW.md)

## ساز‌وکارهای مشترک که حالت‌ها را تعیین می‌کنند

| حالت                         | ساز‌وکار                                                                                                            | منبع                                          | وضعیت           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------- |
| ورود نکرده                   | `useRedirectGuard` ⇒ `/{lang}/login`                                                                                | `dashboard-layout.tsx:171-195`                | VERIFIED_SOURCE |
| ویزارد انجام‌نشده            | ⇒ `/onboarding` (فقط از localStorage)                                                                               | همان                                          | VERIFIED_SOURCE |
| بدون دسترسی                  | `isRouteDenied` ⇒ `NoAccessNotice` (mount نمی‌شود، prefetch نمی‌شود)                                                | `app-shell.tsx`، `ui/no-access-notice.tsx`    | VERIFIED_SOURCE |
| آفلاین / نیاز به سرور        | `useActionAvailability` / `<OfflineGate>` / `CloudRequiredNotice` بر پایهٔ `offline-endpoint-matrix.ts` (`available | online_required                               | not_supported`) | CLAUDE.md §۸؛ ماتریس ۴۹۵ ردیف | VERIFIED_SOURCE |
| قفل ماژول (پلن)              | `isNavLocked(source)` / `NAV_MODULE`                                                                                | `nav-module-locks.test.ts`                    | PARTIAL         |
| صفحهٔ گیت‌شده                | `gated('/marketplace','/settings',…)`                                                                               | `app.tsx:131,133`                             | VERIFIED_SOURCE |
| خطا                          | `RouteErrorBoundary` برای `/login` و شاخهٔ اصلی؛ `apiErrorMessage`                                                  | `app.tsx:100`, `route-error.tsx`              | PARTIAL         |
| بارگذاری                     | `loading.tsx` وب؛ Skeleton اجباری در کانتینر                                                                        | `apps/web/app/[lang]/(dashboard)/loading.tsx` | PARTIAL         |
| داشبورد: ارقام غیرمجاز       | حذف کارت + `hidden[]`                                                                                               | `analytics.routes.ts:158-163`                 | VERIFIED_SOURCE |
| دستهٔ ناشناخته/بارگذاری نشده | پروفایل generic                                                                                                     | `use-business-profile.ts:21-29`               | VERIFIED_SOURCE |
| صف sync                      | stage: pending / inFlight / rejected / failed / committed                                                           | `outbox-stage.ts`, `sync-engine.ts:750-780`   | VERIFIED_SOURCE |

NOT_VERIFIED: برای هر ۳۵ صفحه، حالت‌های empty/error/loading/readonly — نیازمند رندر زنده یا خواندن تک‌تک کانتینرها (خارج از بودجهٔ این فاز).
