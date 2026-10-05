# تخفیف‌ها و فهرست قیمت — `/promotions`

> بخشی از بازبینی UX حسابچه (۴ اکتبر ۲۰۲۶). روش: `.claude/skills/hisabche-ux-consolidation/SKILL.md`.
> واقعیت‌ها از اسکن ایستای کد آمده‌اند؛ هیچ صفحه‌ای رندر نشده است.

## این صفحه برای چیست

تعیین قیمت پیشنهادی: تخفیف‌ها و فهرست‌های قیمت.

## حکم

|                   |                                         |
| ----------------- | --------------------------------------- |
| **حکم**           | `MERGE_AS_TAB` — ادغام به‌صورت تب       |
| **مقصد پیشنهادی** | `/invoices?tab=pricing`                 |
| **فاز**           | ز — هاب فروش و خرید + یکی‌شدن فاکتورساز |

## واقعیت‌ها (از کد)

|                                    |                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| فایل صفحه                          | `apps/web/app/[lang]/(dashboard)/promotions/page.tsx`                                       |
| کانتینر                            | `PromotionsContainer` — `packages/ui/src/components/ui/promotions/promotions-container.tsx` |
| حجم کد صفحه و اجزای نزدیک          | 1192 خط در 3 فایل                                                                           |
| در منو                             | بله (`promotions`)                                                                          |
| ماژول دسترسی (`NAV_MODULE`)        | `invoices`                                                                                  |
| route در app-shell (ویندوز/موبایل) | بله                                                                                         |
| بسته در robots                     | بله                                                                                         |
| مقاله‌ی راهنما                     | `promotions`                                                                                |
| تعداد دیالوگ/شیت                   | 0                                                                                           |
| تعداد کنترل فرم                    | 13                                                                                          |
| جدول                               | 0                                                                                           |

**تب‌ها / بخش‌ها:** ندارد

**خواندن‌ها (7):**

- `useCurrencyStore`
- `useCustomers`
- `useProducts`
- `usePromotions`
- `usePriceList`
- `usePriceLists`
- `useUnits`

**نوشتن‌ها (6):**

- `useSavePromotion`
- `useSetPromotionActive`
- `useAssignPriceList`
- `useSavePriceList`
- `useSetPriceListActive`
- `useSetPriceListItems`

**به این صفحه‌ها می‌رود:**

- به هیچ صفحه‌ای لینک مستقیم ندارد

**از این صفحه‌ها به آن می‌رسند:**

- فقط از منو

**حالت‌ها (جستجوی متنی در کد):** بارگذاری بله · خطا بله · خالی بله · بدون دسترسی بله · «تنظیم نشده» بله

## یافته‌ها

### 1. شدت 2 — قاعده‌ی قیمت جدا از جایی است که قیمت اعمال می‌شود.

- **چرا مهم است:** کسی که می‌پرسد «چرا این قیمت؟» باید از فاکتور به این‌جا برسد.
- **پیشنهاد:** تب «قیمت و تخفیف» در هاب؛ از برچسب «تخفیف/فهرست» در فاکتورساز لینک مستقیم.

## اگر تأیید شود، چه چیزی عوض می‌شود

- `page.tsx` این نشانی حذف و در `next.config.js` به `/invoices?tab=pricing` redirect می‌شود؛ در app-shell یک `<Navigate>`.
- کانتینر `PromotionsContainer` دست نمی‌خورد؛ فقط از داخل هاب سوار می‌شود.
- ردیف `promotions` از `navigation.ts`، `nav-items.ts` و فهرست sidebar برداشته می‌شود.
- قفل ماژول `invoices` روی تب تازه اعمال می‌شود.
- `robots.ts`، `ROUTE_DOCS_MAP`، مسیرهای command palette و هر `push`/`href` به این نشانی به‌روز می‌شود.
