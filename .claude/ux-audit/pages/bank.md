# بانک — `/bank`

> بخشی از بازبینی UX حسابچه (۴ اکتبر ۲۰۲۶). روش: `.claude/skills/hisabche-ux-consolidation/SKILL.md`.
> واقعیت‌ها از اسکن ایستای کد آمده‌اند؛ هیچ صفحه‌ای رندر نشده است.

## این صفحه برای چیست

ورود صورت‌حساب بانک و تطبیق آن با پرداخت‌ها.

## حکم

|                   |                                   |
| ----------------- | --------------------------------- |
| **حکم**           | `MERGE_AS_TAB` — ادغام به‌صورت تب |
| **مقصد پیشنهادی** | `/accounting?tab=bank`            |
| **فاز**           | د — هاب حسابداری                  |

## واقعیت‌ها (از کد)

|                                    |                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| فایل صفحه                          | `apps/web/app/[lang]/(dashboard)/bank/page.tsx`                                      |
| کانتینر                            | `BankContainer` — `packages/ui/src/components/ui/bank/containers/bank-container.tsx` |
| حجم کد صفحه و اجزای نزدیک          | 1452 خط در 6 فایل                                                                    |
| در منو                             | بله (`bank`)                                                                         |
| ماژول دسترسی (`NAV_MODULE`)        | `accounting`                                                                         |
| route در app-shell (ویندوز/موبایل) | بله                                                                                  |
| بسته در robots                     | بله                                                                                  |
| مقاله‌ی راهنما                     | `accounting`                                                                         |
| تعداد دیالوگ/شیت                   | 0                                                                                    |
| تعداد کنترل فرم                    | 7                                                                                    |
| جدول                               | 9                                                                                    |

**تب‌ها / بخش‌ها:** ندارد

**خواندن‌ها (9):**

- `useAccounts`
- `useBankStatements`
- `useMatchSuggestions`
- `useReconcileLine`
- `useReconciliation`
- `useBankCategorySuggestions`
- `useRowSelection`
- `useBulkAction`
- `useTableState`

**نوشتن‌ها (1):**

- `useImportStatement`

**به این صفحه‌ها می‌رود:**

- به هیچ صفحه‌ای لینک مستقیم ندارد

**از این صفحه‌ها به آن می‌رسند:**

- فقط از منو

**حالت‌ها (جستجوی متنی در کد):** بارگذاری بله · خطا بله · خالی بله · بدون دسترسی بله · «تنظیم نشده» **نه**

## یافته‌ها

### 1. شدت 2 — مقصد جدا برای کاری که بخشی از حسابداری است.

- **چرا مهم است:** همان شخص، همان ماژول دسترسی (`accounting`).
- **پیشنهاد:** بخش «بانک» در هاب حسابداری.

## اگر تأیید شود، چه چیزی عوض می‌شود

- `page.tsx` این نشانی حذف و در `next.config.js` به `/accounting?tab=bank` redirect می‌شود؛ در app-shell یک `<Navigate>`.
- کانتینر `BankContainer` دست نمی‌خورد؛ فقط از داخل هاب سوار می‌شود.
- ردیف `bank` از `navigation.ts`، `nav-items.ts` و فهرست sidebar برداشته می‌شود.
- قفل ماژول `accounting` روی تب تازه اعمال می‌شود.
- `robots.ts`، `ROUTE_DOCS_MAP`، مسیرهای command palette و هر `push`/`href` به این نشانی به‌روز می‌شود.
