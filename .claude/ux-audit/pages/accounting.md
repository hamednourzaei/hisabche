# حسابداری — `/accounting`

> بخشی از بازبینی UX حسابچه (۴ اکتبر ۲۰۲۶). روش: `.claude/skills/hisabche-ux-consolidation/SKILL.md`.
> واقعیت‌ها از اسکن ایستای کد آمده‌اند؛ هیچ صفحه‌ای رندر نشده است.

## این صفحه برای چیست

دفترها و گزارش‌های مالی: حساب‌ها، روزنامه، تراز، سود و زیان، بستن ماه، تأمین مالی.

## حکم

|                        |                                               |
| ---------------------- | --------------------------------------------- |
| **حکم**                | `KEEP` — بماند                                |
| **فاز**                | د — هاب حسابداری                              |
| **نقش در ساختار تازه** | هاب — صفحه‌های دیگر به‌صورت تب این‌جا می‌آیند |

## واقعیت‌ها (از کد)

|                                    |                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| فایل صفحه                          | `apps/web/app/[lang]/(dashboard)/accounting/page.tsx`                            |
| کانتینر                            | `AccountingPage` — `packages/ui/src/components/ui/accounting/AccountingPage.tsx` |
| حجم کد صفحه و اجزای نزدیک          | 4130 خط در 22 فایل                                                               |
| در منو                             | بله (`money`)                                                                    |
| ماژول دسترسی (`NAV_MODULE`)        | `accounting`                                                                     |
| route در app-shell (ویندوز/موبایل) | بله                                                                              |
| بسته در robots                     | بله                                                                              |
| مقاله‌ی راهنما                     | `accounting`                                                                     |
| تعداد دیالوگ/شیت                   | 0                                                                                |
| تعداد کنترل فرم                    | 31                                                                               |
| جدول                               | 7                                                                                |

**تب‌ها / بخش‌ها:** ندارد

**خواندن‌ها (15):**

- `useAccounts`
- `useJournalEntries`
- `useTrialBalance`
- `useLedgerNumber`
- `useAccountDrilldown`
- `useBranchScope`
- `useBalanceSheet`
- `useCurrencyStore`
- `useIncomeStatement`
- `useProfitReportsByCurrency`
- `useAutomations`
- `useInvestmentHoldings`
- `useLoanFacilities`
- `useBranches`
- `useGeneralLedger`

**نوشتن‌ها (10):**

- `usePostUnpostedInvoices`
- `useCreateAccount`
- `useCreateJournalEntry`
- `useCreateMonthEndAutomation`
- `useRemoveAutomation`
- `useRunMonthEnd`
- `useCreateInvestmentHolding`
- `useCreateLoanFacility`
- `useSetLoanFacilityActive`
- `useUpdateInvestmentHolding`

**به این صفحه‌ها می‌رود:**

- `/till`
- `/team-and-payroll`

**از این صفحه‌ها به آن می‌رسند:**

- `/invoices/[id]`

**حالت‌ها (جستجوی متنی در کد):** بارگذاری بله · خطا بله · خالی بله · بدون دسترسی بله · «تنظیم نشده» بله

## یافته‌ها

### 1. شدت 3 — کارهای مالی در پنج مقصد است: `/accounting` (۷ تب)، `/bank`، `/assets`، `/budgets`، و هاب خالی `/accounting-workspace`.

- **چرا مهم است:** حسابدار باید بین پنج صفحه جابه‌جا شود.
- **پیشنهاد:** یک هاب با ناوبری دو سطحی: دفترها (حساب‌ها، روزنامه) · گزارش‌ها (تراز آزمایشی، ترازنامه، سود و زیان) · بانک · دارایی‌ها · بودجه · بستن ماه · تأمین مالی.

### 2. شدت 2 — ۷ تب در یک سطح و با سه تای تازه ۱۰ می‌شود.

- **چرا مهم است:** بیش از ۷ در یک سطح.
- **پیشنهاد:** بخش‌ها در ستون کناری (دسکتاپ) / انتخابگر بالای صفحه (موبایل)، تب‌ها داخل هر بخش.

### 3. شدت 2 — کد این صفحه و اجزای نزدیکش حدود 4130 خط است.

- **چرا مهم است:** صفحه‌ی سنگین دیرتر تعاملی می‌شود، مخصوصاً روی موبایل.
- **پیشنهاد:** بخش‌هایی که پیش‌فرض دیده نمی‌شوند lazy شوند.

## اگر تأیید شود، چه چیزی عوض می‌شود

نشانی می‌ماند. تب‌های تازه (هر کدام lazy و در URL با `?tab=`) اضافه می‌شوند و کانتینرهای موجودِ صفحه‌های ادغام‌شده را سوار می‌کنند. قفل ماژول هر تب حفظ می‌شود.
