# 16 — DATA LIFECYCLE (ایجاد، تغییر، حذف، پشتیبان، ورود، لایسنس)

commit: `05f749a2` · date: 2026-11-01 · وضعیت: VERIFIED_SOURCE ×4، PARTIAL ×4، NOT_VERIFIED ×3
مرتبط: [12](12-OFFLINE-SYNC-FLOW.md) · [05](05-SALES-INVOICE-FLOW.md)

## ۱. چرخهٔ عمر موجودیت‌ها (آنچه خوانده شد)

| موجودیت (ENT)      | ایجاد                                              | تغییر                                                                     | حذف/لغو                                                                     | منبع                               |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------- |
| ENT-INVOICE        | `InvoiceService.create` (RPC اتمیک هدر+اقلام+حرکت) | PATCH فقط status/توصیفی؛ `paid_amount` از PATCH پذیرفته نمی‌شود (Phase F) | لغو: `reverseEffects` و ردیف `cancelled`؛ حذف: `reverseEffects` + حذف اقلام | `invoice.service.ts:789,1470,1675` |
| ENT-PAYMENT        | `recordPayment`                                    | — (تغییرناپذیر)                                                           | `cancelPayment`: ردیف `cancelled` می‌ماند، سند معکوس                        | `payments.service.ts:691-745`      |
| ENT-JOURNAL        | `postDocument`                                     | هرگز ویرایش؛ فقط `reverse`                                                | سند معکوس جدید                                                              | `accounting.service.ts:632`        |
| ENT-STOCK-MOVEMENT | درج در RPC فاکتور/دریافت PO/ویرایش کالا            | append-only                                                               | معکوس با حرکت جدید                                                          | `invoice.service.ts:1818`          |
| ENT-RETURN         | `invoice_return_create`                            | —                                                                         | —                                                                           | [05](05-SALES-INVOICE-FLOW.md)     |
| ENT-PRODUCT        | `ProductService.create` (موجودی اول = حرکت انبار)  | PATCH؛ quantity ⇒ حرکت adjustment                                         | کالای دارای حرکت/لایه حذف نمی‌شود                                           | `product.service.ts:700-760`       |
| ENT-CUSTOMER       | `CustomerService.create`                           | `expectedUpdatedAt` شرطی                                                  | حذف: آنلاین‌فقط                                                             | ماتریس آفلاین                      |
| ENT-TILL-SESSION   | `openSession`                                      | حرکت‌ها append                                                            | خالی حذف؛ کارکرده بسته                                                      | `pos.service.ts`                   |
| ENT-PAYROLL        | `createPayroll`                                    | `updatePayrollStatus`                                                     | «پرداخت‌شده» نهایی                                                          | `human-resources.service.ts:710`   |

قانون سراسری: tenant ⇒ `workspace_id`؛ «ریست = بازنشسته‌کردن و ساخت دوباره، نه DELETE» (sandbox).

## ۲. پشتیبان و بازیابی

- آفلاین: `GET /workspaces/backup` (`local-engine/src/routes/backup.ts:16`) + خروجی `local-engine/src/export/{exporter,checksum,preview}.ts` (checksum موجود). گارد `backup.manage` (owner) در `local auth.ts`.
- سرور: `snapshots.routes.ts` (`/api/snapshots`، compare)؛ `data_snapshots` فقط‌افزودنی با تریگر (CLAUDE.md). محتوای snapshot و بازیابی (restore) خوانده نشد: NOT_VERIFIED.
- اصل «خواندن/چاپ/خروجی/پشتیبان در هر وضعیت لایسنس مجاز» (`alwaysAllowed` در `feature-registry.ts`، اصل ۶ CLAUDE.md جلسهٔ ۲۰ اکتبر).

## ۳. ورود/خروج داده

- `POST /api/migrations/inspect` (چیزی نمی‌نویسد)، `/commit` تکه‌تکه و قابل‌ادامه؛ محلی: `local-engine/src/routes/import.ts:47,112`. فاکتورهای واردشده از `InvoiceService.create` رد می‌شوند، کلید `mig-inv-<hash>` (CLAUDE.md). بررسی اجرای زنده: NOT_VERIFIED.
- مهاجرت آفلاین→ابر: `backend/src/services/cloud-migration/` (۸ بخش؛ خرید/حقوق/قسط/شمارش/بودجه `NOT_IMPLEMENTED`) — محتوا خوانده نشد.

## ۴. اشتراک و لایسنس

- سقف پلن: `assertWithinLimit(workspaceId,'invoices'|'users'|…)` (`plan-limits.service.ts:223`)؛ FREE: 50 فاکتور مادام‌العمر؛ پلن‌های آنلاین: `invoicesDaily 500..`, `users 20` (`plan-limit-defaults.ts:45-60`)؛ تنظیم‌پذیر با `plan_limit_settings` و `workspace_limit_overrides`.
- ایندکس `idx_appointments_staff_window` (قید هم‌پوشانی نوبت‌ها) را کاربر در همین نشست VERIFY کرد (`index_idx_appointments_staff_window_exists: true`)؛ `appointment-conflict-02` و `device-slot-01` هنوز PENDING HUMAN CONFIRMATION‌اند.
- آفلاین: ۲ جای «computer» + ۲ جای «mobile» (`OFFLINE_SEATS_PER_KIND = 2`، `offline-license.service.ts:45`)؛ دستگاه پنجم ⇒ `LICENSE_SEATS_FULL` (`:69`). قید پایگاه‌داده: `device-slot-01-migration.sql` **PENDING HUMAN CONFIRMATION**.
- Entitlement: `resolveEntitlement` (`entitlement-resolver.ts:81`) با `AVAILABLE|REQUIRES_ONLINE|NOT_ENTITLED|REQUIRES_UPGRADE|EXHAUSTED|EXPIRED`؛ routeهای مالی لایسنس با `license.manage`.
- NOT_VERIFIED: تمدید/وب‌هوک Stripe (`webhook.service.ts` — در نوبت قبل `releaseClaim` اصلاح شد)، و اجرای محدودیت `users` در دعوت عضو.

## ۵. بستن سال مالی

`GET /year-end/plan`، `POST /year-end/close` (`accounting.routes.ts:679-702`) ⇒ یک سند عادی (`year-end.domain.ts`). VERIFIED_SOURCE (ساختار)؛ مقدار حقیقی/اثر زنده NOT_VERIFIED.
