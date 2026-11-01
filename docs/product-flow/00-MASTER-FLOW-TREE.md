# 00 — MASTER FLOW TREE

commit: `05f749a2` · date: 2026-11-01 · وضعیت کل: **PARTIAL** (عمق: ۱۲ مسیر بحرانی بررسی‌شده، بقیه NOT_VERIFIED) · هیچ گره‌ای VERIFIED_RUNTIME نیست
مرتبط: همهٔ اسناد این پوشه · رجیستری ماشینی: [flow-index.json](flow-index.json) · گزارش: [99](99-FLOW-VERIFICATION-REPORT.md)

## ۱. درخت واقعی (فقط آنچه در ریپو هست)

```
HISABCHE
├─ ENTRY
│  ├─ Landing (وب، ایستا)                                   NOT_VERIFIED
│  ├─ SCR-001 /login                                          PARTIAL   [JRN-03]
│  └─ Offline first run (Windows/Android)                     VERIFIED_SOURCE  FLOW-072 (offline-first-run.ts)
├─ AUTH & TENANCY
│  ├─ FLOW-070 ثبت‌نام (auth.routes.ts:344)                   VERIFIED_SOURCE
│  ├─ Workspace آنلاین: ساخت اولین workspace                  NOT_VERIFIED  ← حلقهٔ گم‌شده
│  └─ CORE-008 Authorization (۴۱ capability، ۳ نقش)          VERIFIED_SOURCE  PERM-001…
├─ ONBOARDING & CATEGORY
│  ├─ SCR-003 /onboarding — FLOW-071 (۵ مرحله)               VERIFIED_SOURCE
│  └─ دستهٔ کسب‌وکار (۶۶ کلید؛ ۲۳ override)                   CATEGORY_PERSONALIZATION: LIMITED
├─ DAILY OPERATIONS
│  ├─ فروش
│  │   ├─ SCR-005 /invoices/new — FLOW-001 (آنلاین)           VERIFIED_SOURCE   CORE-001→004→003→002
│  │   ├─ FLOW-002 (آفلاین، موتور محلی)                       VERIFIED_SOURCE   CORE-010
│  │   ├─ FLOW-003/004 لغو/حذف                                VERIFIED_SOURCE
│  │   └─ FLOW-005 برگشت فروش/خرید                            PARTIAL (۲ نسخهٔ SQL)
│  ├─ خرید: FLOW-030 (فاکتور خرید) · FLOW-031 (PO)           PARTIAL
│  ├─ پرداخت: FLOW-010 ثبت · FLOW-011 لغو                    VERIFIED_SOURCE   CORE-002
│  └─ صندوق: FLOW-012 (SCR-029)                               VERIFIED_SOURCE   CORE-006
├─ INVENTORY
│  ├─ FLOW-040 حرکت فاکتور · FLOW-041 تعدیل · FLOW-042 انتقال VERIFIED_SOURCE  CORE-005
│  ├─ FLOW-043 شمارش انبار                                    NOT_VERIFIED
│  └─ بها (FIFO/avco)                                         VERIFIED_SOURCE   CORE-004
├─ FINANCE
│  ├─ CORE-003 Ledger (invoice, payment, pos, payroll, …)     VERIFIED_SOURCE
│  ├─ بستن سال/ماه، قفل دوره                                  PARTIAL
│  └─ مالیات (applyTax)                                       NOT_VERIFIED (محتوا)
├─ PARTIES
│  └─ FLOW-050 مانده مشتری · FLOW-051 حذف                    PARTIAL
├─ PEOPLE
│  └─ FLOW-060 حقوق/حضور (SCR-026)                            PARTIAL   CORE-007
├─ OFFLINE / SYNC
│  ├─ FLOW-020…026 (outbox، ترتیب، retry، pull، versioned)    VERIFIED_SOURCE  CORE-009, CORE-010
│  └─ ماتریس endpoint: 495 ردیف (175/305/15)                  VERIFIED_SOURCE
├─ ADMIN & GOVERNANCE
│  ├─ SCR-031 /governance (ماتریس مجوز)                       PARTIAL
│  ├─ SCR-019 /billing + CORE-011 plan limits / license       PARTIAL
│  └─ apps/admin (۲۶ page)                                    NOT_VERIFIED
├─ REPORTING
│  ├─ SCR-002 داشبورد (KPI از جدول invoices)                  VERIFIED_SOURCE
│  ├─ سود/زیان (cost_consumptions)                            VERIFIED_SOURCE
│  └─ تراز آزمایشی (ledger)                                   VERIFIED_SOURCE
└─ OUT OF SCOPE / HIDDEN
   ├─ marketplace, market-seller (DISABLED_PAGES)             NOT_VERIFIED
   └─ ساخت و تولید، CRM، AI، اتوماسیون، توسعه‌دهندگان         NOT_VERIFIED
```

## ۲. چگونه بخوانیم

- هر گره یک ID دارد؛ جزئیات در سند هم‌نام. وضعیت‌ها فقط از واژگان بخش ۳ پرامپت: `VERIFIED_SOURCE` یعنی مسیر کد با `path:line` خوانده شد، نه اینکه اجرا شد.
- «NOT_VERIFIED» یعنی خوانده نشد یا اثبات نشد؛ «کار نمی‌کند» نیست.
- برای فهمیدن «چرا»، به [20](20-ANSWERS-TO-THE-FOUR-QUESTIONS.md) و جدول مشاهدات [99](99-FLOW-VERIFICATION-REPORT.md) بروید.

## ۳. ۱۰ جریان مهم برای شروع

1. FLOW-001 ثبت فاکتور آنلاین → [05](05-SALES-INVOICE-FLOW.md)
2. FLOW-002 همان در آفلاین → [05](05-SALES-INVOICE-FLOW.md)
3. FLOW-020 صف خروجی تا سرور → [12](12-OFFLINE-SYNC-FLOW.md)
4. FLOW-003/004 لغو/حذف فاکتور
5. FLOW-005 برگشت (نیازمند تأیید نسخهٔ SQL)
6. FLOW-010 پرداخت و دفتر → [08](08-PAYMENT-CASHBOX-FLOW.md)
7. FLOW-071 onboarding + [02](02-BUSINESS-CATEGORY-MATRIX.md)
8. PERM-001 زنجیرهٔ مجوز → [13](13-PERMISSION-FLOW.md)
9. FLOW-012 بستن صندوق
10. گزارش داشبورد/سود → [14](14-REPORTING-DATA-FLOW.md)
