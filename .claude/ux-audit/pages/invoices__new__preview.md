# پیش‌نمایش فاکتور (گام ۲) — `/invoices/new/preview`

> بخشی از بازبینی UX حسابچه (۴ اکتبر ۲۰۲۶). روش: `.claude/skills/hisabche-ux-consolidation/SKILL.md`.
> واقعیت‌ها از اسکن ایستای کد آمده‌اند؛ هیچ صفحه‌ای رندر نشده است.

## این صفحه برای چیست

دیدن فاکتور پیش از ثبت و ثبت نهایی.

## حکم

|                   |                                          |
| ----------------- | ---------------------------------------- |
| **حکم**           | `MERGE_AS_STEP` — ادغام به‌صورت گام/حالت |
| **مقصد پیشنهادی** | `/invoices/new?step=preview`             |
| **فاز**           | ز — هاب فروش و خرید + یکی‌شدن فاکتورساز  |

## واقعیت‌ها (از کد)

|                                    |                                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| فایل صفحه                          | `apps/web/app/[lang]/(dashboard)/invoices/new/preview/page.tsx`                                                      |
| کانتینر                            | `InvoicePreviewContainer` — `packages/ui/src/components/ui/invoice-builder/containers/invoice-preview-container.tsx` |
| حجم کد صفحه و اجزای نزدیک          | 2601 خط در 8 فایل                                                                                                    |
| در منو                             | نه                                                                                                                   |
| ماژول دسترسی (`NAV_MODULE`)        | `invoices`                                                                                                           |
| route در app-shell (ویندوز/موبایل) | بله                                                                                                                  |
| بسته در robots                     | بله                                                                                                                  |
| مقاله‌ی راهنما                     | `invoices`                                                                                                           |
| تعداد دیالوگ/شیت                   | 0                                                                                                                    |
| تعداد کنترل فرم                    | 2                                                                                                                    |
| جدول                               | 2                                                                                                                    |

**تب‌ها / بخش‌ها:** ندارد

**خواندن‌ها (10):**

- `useWorkspaces`
- `useBackupStore`
- `useInvoiceDraftStore`
- `useOnboardingStore`
- `usePreferencesStore`
- `useSyncStore`
- `useInvoiceDraft`
- `useOversoldLines`
- `useProducts`
- `useProductsByIds`

**نوشتن‌ها (2):**

- `useCreateInvoice`
- `useCreateRecurringInvoice`

**به این صفحه‌ها می‌رود:**

- `/invoices/new`
- `/invoices`

**از این صفحه‌ها به آن می‌رسند:**

- `/invoices/new`

**حالت‌ها (جستجوی متنی در کد):** بارگذاری بله · خطا بله · خالی بله · بدون دسترسی **نه** · «تنظیم نشده» **نه**

## یافته‌ها

### 1. شدت 3 — یک گام از یک جریان، route خودش را دارد.

- **چرا مهم است:** باز کردن مستقیم این نشانی بدون پیش‌نویس معنا ندارد؛ نشانی فقط برای چیزی است که بشود به آن لینک داد.
- **پیشنهاد:** گام دوم همان route؛ دکمه‌ی برگشت مرورگر به گام ۱ برگردد و پیش‌نویس بماند.

## اگر تأیید شود، چه چیزی عوض می‌شود

- `page.tsx` این نشانی حذف و در `next.config.js` به `/invoices/new?step=preview` redirect می‌شود؛ در app-shell یک `<Navigate>`.
- کانتینر `InvoicePreviewContainer` دست نمی‌خورد؛ فقط از داخل هاب سوار می‌شود.
- قفل ماژول `invoices` روی تب تازه اعمال می‌شود.
- `robots.ts`، `ROUTE_DOCS_MAP`، مسیرهای command palette و هر `push`/`href` به این نشانی به‌روز می‌شود.
- لینک‌های ورودی از: `/invoices/new`
