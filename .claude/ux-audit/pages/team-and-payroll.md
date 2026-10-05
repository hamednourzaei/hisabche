# تیم و حقوق — `/team-and-payroll`

> بخشی از بازبینی UX حسابچه (۴ اکتبر ۲۰۲۶). روش: `.claude/skills/hisabche-ux-consolidation/SKILL.md`.
> واقعیت‌ها از اسکن ایستای کد آمده‌اند؛ هیچ صفحه‌ای رندر نشده است.

## این صفحه برای چیست

کارمندان، شعب، حقوق و حضور و غیاب.

## حکم

|                        |                                               |
| ---------------------- | --------------------------------------------- |
| **حکم**                | `KEEP` — بماند                                |
| **فاز**                | و — هاب مشتریان و تیم                         |
| **نقش در ساختار تازه** | هاب — صفحه‌های دیگر به‌صورت تب این‌جا می‌آیند |

## واقعیت‌ها (از کد)

|                                    |                                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| فایل صفحه                          | `apps/web/app/[lang]/(dashboard)/team-and-payroll/page.tsx`                                                            |
| کانتینر                            | `TeamAndPayrollContainer` — `packages/ui/src/components/ui/team-and-payroll/containers/team-and-payroll-container.tsx` |
| حجم کد صفحه و اجزای نزدیک          | 3029 خط در 10 فایل                                                                                                     |
| در منو                             | بله (`coworkers`)                                                                                                      |
| ماژول دسترسی (`NAV_MODULE`)        | `people`                                                                                                               |
| route در app-shell (ویندوز/موبایل) | بله                                                                                                                    |
| بسته در robots                     | بله                                                                                                                    |
| مقاله‌ی راهنما                     | `branches`                                                                                                             |
| تعداد دیالوگ/شیت                   | 0                                                                                                                      |
| تعداد کنترل فرم                    | 37                                                                                                                     |
| جدول                               | 8                                                                                                                      |

**تب‌ها / بخش‌ها:** ندارد

**خواندن‌ها (12):**

- `useServerFieldErrors`
- `useBranches`
- `useBranchTree`
- `useEmployees`
- `usePermissionMatrix`
- `useWorkspaces`
- `useAttendanceSheet`
- `useWorkShifts`
- `useRowSelection`
- `useBulkAction`
- `useTableState`
- `useShiftPlan`

**نوشتن‌ها (12):**

- `useCreateEmployee`
- `useAssignProfile`
- `useCreateBranch`
- `useCreateMemberDirect`
- `useDeleteEmployee`
- `usePayrolls`
- `usePayrollSummary`
- `useMarkAttendance`
- `useCreateWorkShift`
- `useSetWorkShiftActive`
- `useAssignShift`
- `useCancelShiftAssignment`

**به این صفحه‌ها می‌رود:**

- `/team-and-payroll/employee`

**از این صفحه‌ها به آن می‌رسند:**

- `/accounting`
- `/team-and-payroll/[id]`

**حالت‌ها (جستجوی متنی در کد):** بارگذاری بله · خطا بله · خالی بله · بدون دسترسی بله · «تنظیم نشده» بله

## یافته‌ها

### 1. شدت 2 — `/timesheets` (ساعات کار روی پروژه) مقصد جداست.

- **چرا مهم است:** همان آدم‌ها، همان ماژول `people`.
- **پیشنهاد:** تب «ساعات کار» در همین هاب.

### 2. شدت 2 — کد این صفحه و اجزای نزدیکش حدود 3029 خط است.

- **چرا مهم است:** صفحه‌ی سنگین دیرتر تعاملی می‌شود، مخصوصاً روی موبایل.
- **پیشنهاد:** بخش‌هایی که پیش‌فرض دیده نمی‌شوند lazy شوند.

### 3. شدت 0 — شیفت‌ها و برنامه‌ی شیفت داخل تب حضور و غیاب‌اند و با باز کردن بارگذاری می‌شوند.

- **چرا مهم است:** الگوی درست.
- **پیشنهاد:** -

## اگر تأیید شود، چه چیزی عوض می‌شود

نشانی می‌ماند. تب‌های تازه (هر کدام lazy و در URL با `?tab=`) اضافه می‌شوند و کانتینرهای موجودِ صفحه‌های ادغام‌شده را سوار می‌کنند. قفل ماژول هر تب حفظ می‌شود.
