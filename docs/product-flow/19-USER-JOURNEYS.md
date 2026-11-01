# 19 — USER JOURNEYS (JRN-##)

commit: `05f749a2` · date: 2026-11-01 · وضعیت (شمارش دقیق از flow-index.json): VERIFIED_SOURCE ×15، PARTIAL ×16، NOT_VERIFIED ×7
مرتبط: [00-MASTER-FLOW-TREE](00-MASTER-FLOW-TREE.md)

| JRN    | سفر                               | وضعیت                        | Flow / سند                                                     | توضیح                                                          |
| ------ | --------------------------------- | ---------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| JRN-01 | اولین ورود به سایت                | PARTIAL                      | [01](01-ONBOARDING-FLOW.md)                                    | لندینگ ایستا؛ محتوا بررسی نشد                                  |
| JRN-02 | ثبت‌نام                           | VERIFIED_SOURCE              | FLOW-070                                                       | `auth.routes.ts:344`                                           |
| JRN-03 | ورود                              | PARTIAL                      | —                                                              | route login خوانده نشد؛ نشست آفلاین `auth.store.ts:294`        |
| JRN-04 | ساخت workspace                    | PARTIAL                      | [01](01-ONBOARDING-FLOW.md)                                    | آفلاین ✓؛ آنلاین NOT_VERIFIED                                  |
| JRN-05 | onboarding                        | VERIFIED_SOURCE              | FLOW-071                                                       |                                                                |
| JRN-06 | انتخاب دسته                       | VERIFIED_SOURCE              | [02](02-BUSINESS-CATEGORY-MATRIX.md)                           | LIMITED                                                        |
| JRN-07 | داشبورد                           | VERIFIED_SOURCE              | [14](14-REPORTING-DATA-FLOW.md)                                |                                                                |
| JRN-08 | ساخت کالا/مشتری/تأمین‌کننده/انبار | PARTIAL                      | [07](07-INVENTORY-FLOW.md), [10](10-CUSTOMER-SUPPLIER-FLOW.md) | کالا: ویرایش خوانده شد؛ create و تأمین‌کننده جدا: NOT_VERIFIED |
| JRN-09 | ثبت فاکتور فروش                   | VERIFIED_SOURCE              | FLOW-001/002                                                   |                                                                |
| JRN-10 | دریافت پرداخت                     | VERIFIED_SOURCE              | FLOW-010                                                       |                                                                |
| JRN-11 | لغو فاکتور                        | VERIFIED_SOURCE              | FLOW-003/004                                                   |                                                                |
| JRN-12 | برگشت از فروش                     | PARTIAL                      | FLOW-005                                                       | دو نسخهٔ SQL (نسخهٔ زنده نامعلوم)                              |
| JRN-13 | خرید                              | PARTIAL                      | FLOW-030/031                                                   |                                                                |
| JRN-14 | پرداخت خرید                       | VERIFIED_SOURCE              | FLOW-010 (`direction out`)                                     |                                                                |
| JRN-15 | برگشت خرید                        | VERIFIED_SOURCE              | FLOW-006                                                       |                                                                |
| JRN-16 | انتقال موجودی                     | VERIFIED_SOURCE              | FLOW-042                                                       |                                                                |
| JRN-17 | شمارش انبار                       | NOT_VERIFIED                 | FLOW-043                                                       | اثر تکمیل خوانده نشد                                           |
| JRN-18 | باز/بستن صندوق                    | VERIFIED_SOURCE              | FLOW-012                                                       |                                                                |
| JRN-19 | بدهی مشتری/تأمین‌کننده            | PARTIAL                      | FLOW-050                                                       |                                                                |
| JRN-20 | کارمند/حضور/حقوق                  | PARTIAL                      | FLOW-060                                                       |                                                                |
| JRN-21 | سند دفتر دستی                     | NOT_VERIFIED                 | —                                                              | route `ledger.post` دیده شد؛ جریان نخواندم                     |
| JRN-22 | گزارش‌ها                          | PARTIAL                      | [14](14-REPORTING-DATA-FLOW.md)                                |                                                                |
| JRN-23 | حالت آفلاین                       | VERIFIED_SOURCE              | FLOW-002                                                       |                                                                |
| JRN-24 | اتصال مجدد                        | VERIFIED_SOURCE              | FLOW-020…022                                                   |                                                                |
| JRN-25 | sync                              | VERIFIED_SOURCE              | [12](12-OFFLINE-SYNC-FLOW.md)                                  |                                                                |
| JRN-26 | تعارض                             | PARTIAL                      | `pushVersioned`                                                | UI صفحهٔ conflicts: NOT_VERIFIED                               |
| JRN-27 | رد مجوز                           | VERIFIED_SOURCE              | [13](13-PERMISSION-FLOW.md)                                    |                                                                |
| JRN-28 | لایسنس/اشتراک                     | PARTIAL                      | [16](16-DATA-LIFECYCLE.md)                                     |                                                                |
| JRN-29 | بکاپ/بازیابی                      | PARTIAL                      | [16](16-DATA-LIFECYCLE.md)                                     | بازیابی NOT_VERIFIED                                           |
| JRN-30 | ورود/خروج داده (import/export)    | PARTIAL                      | [16](16-DATA-LIFECYCLE.md)                                     |                                                                |
| JRN-31 | تنظیمات                           | PARTIAL                      | SCR-015                                                        |                                                                |
| JRN-32 | جست‌وجو                           | NOT_VERIFIED                 | —                                                              |                                                                |
| JRN-33 | ادمین/حاکمیت                      | PARTIAL                      | [13](13-PERMISSION-FLOW.md)                                    | `apps/admin` بررسی نشد                                         |
| JRN-34 | بستن سال مالی                     | PARTIAL                      | [16](16-DATA-LIFECYCLE.md)                                     |                                                                |
| JRN-35 | ساخت و تولید (BOM)                | NOT_VERIFIED                 | —                                                              |                                                                |
| JRN-36 | CRM / پیگیری                      | NOT_VERIFIED                 | —                                                              |                                                                |
| JRN-37 | AI دستیار                         | NOT_VERIFIED                 | —                                                              |                                                                |
| JRN-38 | بازار/Marketplace                 | NOT_VERIFIED (مخفی با سوئیچ) | SCR-018                                                        | پشت `DISABLED_PAGES`                                           |
