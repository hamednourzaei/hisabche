# مشتری (جزئیات) — `/customers/[id]`

> بخشی از بازبینی UX حسابچه (۴ اکتبر ۲۰۲۶). روش: `.claude/skills/hisabche-ux-consolidation/SKILL.md`.
> واقعیت‌ها از اسکن ایستای کد آمده‌اند؛ هیچ صفحه‌ای رندر نشده است.

## این صفحه برای چیست

تصویر کامل یک مشتری: صورت‌حساب، فاکتورها، پرداخت‌ها، CRM.

## حکم

|         |                                           |
| ------- | ----------------------------------------- |
| **حکم** | `KEEP_AS_ENTITY` — بماند (صفحه‌ی موجودیت) |
| **فاز** | بدون تغییر ساختاری                        |

## واقعیت‌ها (از کد)

|                                    |                                                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| فایل صفحه                          | `apps/web/app/[lang]/(dashboard)/customers/[id]/page.tsx`                                                      |
| کانتینر                            | `CustomerDetailContainer` — `packages/ui/src/components/ui/customers/containers/customer-detail-container.tsx` |
| حجم کد صفحه و اجزای نزدیک          | 2602 خط در 8 فایل                                                                                              |
| در منو                             | نه                                                                                                             |
| ماژول دسترسی (`NAV_MODULE`)        | `parties`                                                                                                      |
| route در app-shell (ویندوز/موبایل) | بله                                                                                                            |
| بسته در robots                     | بله                                                                                                            |
| مقاله‌ی راهنما                     | `customers`                                                                                                    |
| تعداد دیالوگ/شیت                   | 1                                                                                                              |
| تعداد کنترل فرم                    | 7                                                                                                              |
| جدول                               | 5                                                                                                              |

**تب‌ها / بخش‌ها:** `statement` · `invoices` · `payments` · `activity` · `insights` · `accounting` · `account` · `crm` · `history`

**خواندن‌ها (14):**

- `useCustomer`
- `useInvoices`
- `usePartyActivity`
- `usePartyLedger`
- `usePartySummary`
- `useSyncStore`
- `useBackupStore`
- `useCustomerCrm`
- `useCustomerDocuments`
- `useCustomerProfile`
- `useSupplierSearch`
- `useCustomerPortalLinks`
- `useCustomerAccounting`
- `useCustomerInsights`

**نوشتن‌ها (11):**

- `useRecordHistory`
- `useOpenInvoices`
- `usePayments`
- `useCreateTransaction`
- `useRecordPayment`
- `useRemoveCustomerDocument`
- `useUpdateCustomerTerms`
- `useUploadCustomerDocument`
- `useCreatePortalLink`
- `useRevokePortalLink`
- `usePostInvoiceToLedger`

**به این صفحه‌ها می‌رود:**

- `/customers`
- `/invoices/new`
- `/invoices`
- `/portal`

**از این صفحه‌ها به آن می‌رسند:**

- هیچ صفحه‌ای (فقط نشانی مستقیم / command palette)

**حالت‌ها (جستجوی متنی در کد):** بارگذاری بله · خطا بله · خالی بله · بدون دسترسی **نه** · «تنظیم نشده» بله

## یافته‌ها

### 1. شدت 2 — ۹ تب در یک سطح.

- **چرا مهم است:** بیش از ۷ گزینه در یک سطح (قانون Hick)؛ روی موبایل اسکرول افقی بلند.
- **پیشنهاد:** گروه‌بندی به ۵: صورت‌حساب · فاکتور و پرداخت · فعالیت و CRM · حساب · تحلیل.

### 2. شدت 2 — 9 تب/بخش در یک سطح.

- **چرا مهم است:** قانون Hick: بیش از ۷ گزینه انتخاب را کند می‌کند.
- **پیشنهاد:** گروه‌بندی دو سطحی.

## اگر تأیید شود، چه چیزی عوض می‌شود

نشانی و ساختار می‌ماند؛ فقط یافته‌های بالا در همان صفحه اصلاح می‌شود.
