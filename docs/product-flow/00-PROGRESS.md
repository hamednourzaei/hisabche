# 00-PROGRESS — نقشهٔ جریان محصول (Feature Freeze، فقط‌خواندنی)

commit: `05f749a2818299d5c0995d557cc0ec40c1bd5740` (main) · date: 2026-11-01 · **وضعیت: INCOMPLETE (جزئیات در [99](99-FLOW-VERIFICATION-REPORT.md))**

## Git baseline (قبل از شروع)

```
 M apps/desktop/electron-builder.yml
 M docs/qa/BUG-DISCOVERY-100-REGISTRY.json
 M docs/qa/FINAL-STABILIZATION-VERIFICATION.fa.md
?? apps/desktop/resources/installer.nsh
```

۱۵ کامیت آخر: `05f749a2 fixed ci 9` … `9e003f5d tab-by-tab fixes…`. Code-intel: FRESH (۱۸۷۹ فایل / ۱۷٬۹۲۷ نماد / ۳ چرخهٔ فایل).
migrationهای نوشته‌شده ولی اجرانشده (PENDING HUMAN CONFIRMATION): `device-slot-01`، `appointment-conflict-02` و فهرست [99 §۴](99-FLOW-VERIFICATION-REPORT.md).

## پیشرفت

| سند                                                        | وضعیت              |
| ---------------------------------------------------------- | ------------------ |
| 00 tree، 01، 02، 03، 04                                    | DONE               |
| 05 فاکتور، 06 خرید، 07 موجودی، 08 پرداخت/صندوق، 09 دفتر کل | DONE (عمق متفاوت)  |
| 10 مشتری، 11 حقوق                                          | DONE (محدود)       |
| 12 sync، 13 مجوز، 14 گزارش                                 | DONE               |
| 15 خطا، 16 چرخهٔ داده، 17 حالت‌ها، 18 رویدادها             | DONE (17: PARTIAL) |
| 19 سفرها، 20 پاسخ‌ها، flow-index.json، 99                  | DONE               |

## اگر ادامه داده شود (Resume)

اولویت: (۱) تأیید ساخت اولین workspace آنلاین؛ (۲) تعیین نسخهٔ زندهٔ `invoice_return_create` با VERIFY انسانی؛ (۳) ۱۴ صفحهٔ NOT_VERIFIED؛ (۴) cycle-count، tax، cloud-migration، تولید/CRM/AI؛ (۵) اجرای زنده در workspace آزمایشی برای ارتقا به VERIFIED_RUNTIME.
Blockers: workspace آزمایشی تأییدشده؛ اجرای SQL توسط انسان؛ ۸۷ تست PG روی این ماشین (خطای ۱۳۱۴ ویندوز).
