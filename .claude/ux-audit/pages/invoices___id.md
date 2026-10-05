# فاکتور (جزئیات) — `/invoices/[id]`

> بخشی از بازبینی UX حسابچه (۴ اکتبر ۲۰۲۶). روش: `.claude/skills/hisabche-ux-consolidation/SKILL.md`.
> واقعیت‌ها از اسکن ایستای کد آمده‌اند؛ هیچ صفحه‌ای رندر نشده است.

## این صفحه برای چیست

دیدن یک فاکتور، پرداخت‌ها، اقساط، جریمه، چاپ و اشتراک آن.

## حکم

|         |                                           |
| ------- | ----------------------------------------- |
| **حکم** | `KEEP_AS_ENTITY` — بماند (صفحه‌ی موجودیت) |
| **فاز** | بدون تغییر ساختاری                        |

## واقعیت‌ها (از کد)

|                                    |                                                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| فایل صفحه                          | `apps/web/app/[lang]/(dashboard)/invoices/[id]/page.tsx`                                                          |
| کانتینر                            | `InvoiceDetailContainer` — `packages/ui/src/components/ui/invoice-detail/containers/invoice-detail-container.tsx` |
| حجم کد صفحه و اجزای نزدیک          | 4117 خط در 13 فایل                                                                                                |
| در منو                             | نه                                                                                                                |
| ماژول دسترسی (`NAV_MODULE`)        | `invoices`                                                                                                        |
| route در app-shell (ویندوز/موبایل) | بله                                                                                                               |
| بسته در robots                     | بله                                                                                                               |
| مقاله‌ی راهنما                     | `invoices`                                                                                                        |
| تعداد دیالوگ/شیت                   | 1                                                                                                                 |
| تعداد کنترل فرم                    | 12                                                                                                                |
| جدول                               | 3                                                                                                                 |

**تب‌ها / بخش‌ها:** ندارد

**خواندن‌ها (15):**

- `useInvoice`
- `useWorkspaces`
- `useWorkflowInstance`
- `useWorkflowInstanceDetail`
- `useWorkflow`
- `usePerformWorkflowAction`
- `useInvoiceRelated`
- `useSubscriptionLocked`
- `useReceiptPrint`
- `useCORS`
- `useSubscription`
- `useSubscriptionLockStore`
- `useInvoiceEvidence`
- `useCurrencyStore`
- `useLateFeePreview`

**نوشتن‌ها (9):**

- `useRecordHistory`
- `useRecordPayment`
- `useCancelPayment`
- `usePostInvoiceToLedger`
- `useClearInstallmentPlan`
- `useInstallmentPlan`
- `useSaveInstallmentPlan`
- `useAssessLateFee`
- `useSaveLateFeePolicy`

**به این صفحه‌ها می‌رود:**

- `/accounting`

**از این صفحه‌ها به آن می‌رسند:**

- `/customers/[id]`
- `/invoices/new`
- `/invoices/new/preview`
- `/invoices`

**حالت‌ها (جستجوی متنی در کد):** بارگذاری بله · خطا بله · خالی بله · بدون دسترسی بله · «تنظیم نشده» بله

## یافته‌ها

### 1. شدت 2 — صفحه ۴٬۱۰۰ خط و ۹ نوشتن دارد؛ بخش‌ها زیر هم چیده شده‌اند.

- **چرا مهم است:** روی موبایل اسکرول بلند می‌شود و عمل اصلی (ثبت پرداخت) از دید خارج.
- **پیشنهاد:** نوار عمل چسبان پایین صفحه برای «ثبت پرداخت / چاپ / اشتراک».

### 2. شدت 2 — کد این صفحه و اجزای نزدیکش حدود 4117 خط است.

- **چرا مهم است:** صفحه‌ی سنگین دیرتر تعاملی می‌شود، مخصوصاً روی موبایل.
- **پیشنهاد:** بخش‌هایی که پیش‌فرض دیده نمی‌شوند lazy شوند.

### 3. شدت 0 — اقساط، جریمه‌ی دیرکرد و شواهد سود همین‌جا و فقط با باز کردن بارگذاری می‌شوند.

- **چرا مهم است:** الگوی درست express و progressive disclosure.
- **پیشنهاد:** همین الگو برای بقیه‌ی صفحه‌های موجودیت.

## اگر تأیید شود، چه چیزی عوض می‌شود

نشانی و ساختار می‌ماند؛ فقط یافته‌های بالا در همان صفحه اصلاح می‌شود.
