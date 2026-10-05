# کالا (جزئیات) — `/warehouse/[id]`

> بخشی از بازبینی UX حسابچه (۴ اکتبر ۲۰۲۶). روش: `.claude/skills/hisabche-ux-consolidation/SKILL.md`.
> واقعیت‌ها از اسکن ایستای کد آمده‌اند؛ هیچ صفحه‌ای رندر نشده است.

## این صفحه برای چیست

دیدن و ویرایش یک کالا، موجودی هر انبار، واحدها و سودش.

## حکم

|         |                                           |
| ------- | ----------------------------------------- |
| **حکم** | `KEEP_AS_ENTITY` — بماند (صفحه‌ی موجودیت) |
| **فاز** | بدون تغییر ساختاری                        |

## واقعیت‌ها (از کد)

|                                    |                                                                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| فایل صفحه                          | `apps/web/app/[lang]/(dashboard)/warehouse/[id]/page.tsx`                                                             |
| کانتینر                            | `ProductDetailContainer` — `packages/ui/src/components/ui/warehouse-detail/containers/warehouse-detail-container.tsx` |
| حجم کد صفحه و اجزای نزدیک          | 3447 خط در 13 فایل                                                                                                    |
| در منو                             | نه                                                                                                                    |
| ماژول دسترسی (`NAV_MODULE`)        | `inventory`                                                                                                           |
| route در app-shell (ویندوز/موبایل) | بله                                                                                                                   |
| بسته در robots                     | بله                                                                                                                   |
| مقاله‌ی راهنما                     | `inventory`                                                                                                           |
| تعداد دیالوگ/شیت                   | 1                                                                                                                     |
| تعداد کنترل فرم                    | 17                                                                                                                    |
| جدول                               | 1                                                                                                                     |

**تب‌ها / بخش‌ها:** ندارد

**خواندن‌ها (16):**

- `useProduct`
- `useProductWarehouseBreakdown`
- `useUnits`
- `useBatches`
- `useProductJourney`
- `useCurrency`
- `useProductBarcodes`
- `useProductImages`
- `useReorderProductImages`
- `useProductionDefinition`
- `useProductionDraft`
- `useCurrencyStore`
- `useProduce`
- `useWarehouseOverview`
- `useProductionRun`
- `useProductionRuns`

**نوشتن‌ها (11):**

- `useUpdateProduct`
- `useDeleteProduct`
- `useUpdateBatchDates`
- `useAddProductBarcode`
- `useRemoveProductBarcode`
- `useAddProductImage`
- `useRemoveProductImage`
- `useSetProductImageAlt`
- `useAssignWarehouseStock`
- `useCreateWarehouse`
- `useSaveProductionDefinition`

**به این صفحه‌ها می‌رود:**

- `/warehouse`

**از این صفحه‌ها به آن می‌رسند:**

- هیچ صفحه‌ای (فقط نشانی مستقیم / command palette)

**حالت‌ها (جستجوی متنی در کد):** بارگذاری بله · خطا بله · خالی بله · بدون دسترسی بله · «تنظیم نشده» بله

## یافته‌ها

### 1. شدت 2 — ۱۱ نوشتن در یک صفحه.

- **چرا مهم است:** ویرایش‌ها باید express باشند و صفحه را ترک نکنند.
- **پیشنهاد:** بازبینی در فاز E: هر ویرایش inline یا شیت.

### 2. شدت 2 — کد این صفحه و اجزای نزدیکش حدود 3447 خط است.

- **چرا مهم است:** صفحه‌ی سنگین دیرتر تعاملی می‌شود، مخصوصاً روی موبایل.
- **پیشنهاد:** بخش‌هایی که پیش‌فرض دیده نمی‌شوند lazy شوند.

## اگر تأیید شود، چه چیزی عوض می‌شود

نشانی و ساختار می‌ماند؛ فقط یافته‌های بالا در همان صفحه اصلاح می‌شود.
