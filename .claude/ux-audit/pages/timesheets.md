# ساعات کار — `/timesheets`

> بخشی از بازبینی UX حسابچه (۴ اکتبر ۲۰۲۶). روش: `.claude/skills/hisabche-ux-consolidation/SKILL.md`.
> واقعیت‌ها از اسکن ایستای کد آمده‌اند؛ هیچ صفحه‌ای رندر نشده است.

## این صفحه برای چیست

ثبت ساعت کار روی پروژه و مبلغ آن.

## حکم

|                   |                                    |
| ----------------- | ---------------------------------- |
| **حکم**           | `MERGE_AS_TAB` — ادغام به‌صورت تب  |
| **مقصد پیشنهادی** | `/team-and-payroll?tab=timesheets` |
| **فاز**           | و — هاب مشتریان و تیم              |

## واقعیت‌ها (از کد)

|                                    |                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| فایل صفحه                          | `apps/web/app/[lang]/(dashboard)/timesheets/page.tsx`                                                  |
| کانتینر                            | `TimesheetsContainer` — `packages/ui/src/components/ui/timesheets/containers/timesheets-container.tsx` |
| حجم کد صفحه و اجزای نزدیک          | 1076 خط در 4 فایل                                                                                      |
| در منو                             | بله (`timesheets`)                                                                                     |
| ماژول دسترسی (`NAV_MODULE`)        | `people`                                                                                               |
| route در app-shell (ویندوز/موبایل) | بله                                                                                                    |
| بسته در robots                     | بله                                                                                                    |
| مقاله‌ی راهنما                     | `permissions`                                                                                          |
| تعداد دیالوگ/شیت                   | 0                                                                                                      |
| تعداد کنترل فرم                    | 7                                                                                                      |
| جدول                               | 7                                                                                                      |

**تب‌ها / بخش‌ها:** ندارد

**خواندن‌ها (8):**

- `useBillingPreview`
- `useLogTime`
- `useProjectProfitability`
- `useProjects`
- `useTimesheetSummary`
- `useRowSelection`
- `useBulkAction`
- `useTableState`

**نوشتن‌ها (0):**

- ندارد

**به این صفحه‌ها می‌رود:**

- به هیچ صفحه‌ای لینک مستقیم ندارد

**از این صفحه‌ها به آن می‌رسند:**

- فقط از منو

**حالت‌ها (جستجوی متنی در کد):** بارگذاری بله · خطا بله · خالی بله · بدون دسترسی بله · «تنظیم نشده» **نه**

## یافته‌ها

### 1. شدت 2 — مقصد جدا در منو.

- **چرا مهم است:** نمای دوم از کار کارمندان.
- **پیشنهاد:** تب در هاب تیم.

## اگر تأیید شود، چه چیزی عوض می‌شود

- `page.tsx` این نشانی حذف و در `next.config.js` به `/team-and-payroll?tab=timesheets` redirect می‌شود؛ در app-shell یک `<Navigate>`.
- کانتینر `TimesheetsContainer` دست نمی‌خورد؛ فقط از داخل هاب سوار می‌شود.
- ردیف `timesheets` از `navigation.ts`، `nav-items.ts` و فهرست sidebar برداشته می‌شود.
- قفل ماژول `people` روی تب تازه اعمال می‌شود.
- `robots.ts`، `ROUTE_DOCS_MAP`، مسیرهای command palette و هر `push`/`href` به این نشانی به‌روز می‌شود.
