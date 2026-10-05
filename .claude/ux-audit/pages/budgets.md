# بودجه — `/budgets`

> بخشی از بازبینی UX حسابچه (۴ اکتبر ۲۰۲۶). روش: `.claude/skills/hisabche-ux-consolidation/SKILL.md`.
> واقعیت‌ها از اسکن ایستای کد آمده‌اند؛ هیچ صفحه‌ای رندر نشده است.

## این صفحه برای چیست

تعریف بودجه و مقایسه با واقعی.

## حکم

|                   |                                   |
| ----------------- | --------------------------------- |
| **حکم**           | `MERGE_AS_TAB` — ادغام به‌صورت تب |
| **مقصد پیشنهادی** | `/accounting?tab=budgets`         |
| **فاز**           | د — هاب حسابداری                  |

## واقعیت‌ها (از کد)

|                                    |                                                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| فایل صفحه                          | `apps/web/app/[lang]/(dashboard)/budgets/page.tsx`                                            |
| کانتینر                            | `BudgetsContainer` — `packages/ui/src/components/ui/budgets/containers/budgets-container.tsx` |
| حجم کد صفحه و اجزای نزدیک          | 2371 خط در 5 فایل                                                                             |
| در منو                             | بله (`budgets`)                                                                               |
| ماژول دسترسی (`NAV_MODULE`)        | `budgets`                                                                                     |
| route در app-shell (ویندوز/موبایل) | بله                                                                                           |
| بسته در robots                     | بله                                                                                           |
| مقاله‌ی راهنما                     | `accounting`                                                                                  |
| تعداد دیالوگ/شیت                   | 2                                                                                             |
| تعداد کنترل فرم                    | 13                                                                                            |
| جدول                               | 6                                                                                             |

**تب‌ها / بخش‌ها:** ندارد

**خواندن‌ها (11):**

- `useBudgetReport`
- `useAccounts`
- `useArchiveBudget`
- `useBranches`
- `useBudgetRevisions`
- `useCheckSpend`
- `useReviseBudget`
- `useMyCapabilities`
- `useRowSelection`
- `useBulkAction`
- `useTableState`

**نوشتن‌ها (3):**

- `useApproveBudget`
- `useSaveBudget`
- `useSubmitBudget`

**به این صفحه‌ها می‌رود:**

- به هیچ صفحه‌ای لینک مستقیم ندارد

**از این صفحه‌ها به آن می‌رسند:**

- فقط از منو

**حالت‌ها (جستجوی متنی در کد):** بارگذاری بله · خطا بله · خالی بله · بدون دسترسی بله · «تنظیم نشده» **نه**

## یافته‌ها

### 1. شدت 2 — مقصد جدا؛ ماژول دسترسی خودش (`budgets`) را دارد.

- **چرا مهم است:** باید در هاب بماند ولی برای کسی که `budgets` ندارد پنهان شود.
- **پیشنهاد:** بخش «بودجه» در هاب حسابداری، با همان قفل ماژول.

## اگر تأیید شود، چه چیزی عوض می‌شود

- `page.tsx` این نشانی حذف و در `next.config.js` به `/accounting?tab=budgets` redirect می‌شود؛ در app-shell یک `<Navigate>`.
- کانتینر `BudgetsContainer` دست نمی‌خورد؛ فقط از داخل هاب سوار می‌شود.
- ردیف `budgets` از `navigation.ts`، `nav-items.ts` و فهرست sidebar برداشته می‌شود.
- قفل ماژول `budgets` روی تب تازه اعمال می‌شود.
- `robots.ts`، `ROUTE_DOCS_MAP`، مسیرهای command palette و هر `push`/`href` به این نشانی به‌روز می‌شود.
