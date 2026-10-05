# انبار و کالاها — `/warehouse`

> بخشی از بازبینی UX حسابچه (۴ اکتبر ۲۰۲۶). روش: `.claude/skills/hisabche-ux-consolidation/SKILL.md`.
> واقعیت‌ها از اسکن ایستای کد آمده‌اند؛ هیچ صفحه‌ای رندر نشده است.

## این صفحه برای چیست

دیدن موجودی و فهرست کالاها.

## حکم

|                        |                                               |
| ---------------------- | --------------------------------------------- |
| **حکم**                | `KEEP` — بماند                                |
| **فاز**                | ه — هاب انبار                                 |
| **نقش در ساختار تازه** | هاب — صفحه‌های دیگر به‌صورت تب این‌جا می‌آیند |

## واقعیت‌ها (از کد)

|                                    |                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| فایل صفحه                          | `apps/web/app/[lang]/(dashboard)/warehouse/page.tsx`                                                         |
| کانتینر                            | `WarehouseTabsContainer` — `packages/ui/src/components/ui/warehouse/containers/warehouse-tabs-container.tsx` |
| حجم کد صفحه و اجزای نزدیک          | 2643 خط در 9 فایل                                                                                            |
| در منو                             | بله (`stock`)                                                                                                |
| ماژول دسترسی (`NAV_MODULE`)        | `inventory`                                                                                                  |
| route در app-shell (ویندوز/موبایل) | بله                                                                                                          |
| بسته در robots                     | بله                                                                                                          |
| مقاله‌ی راهنما                     | `inventory`                                                                                                  |
| تعداد دیالوگ/شیت                   | 4                                                                                                            |
| تعداد کنترل فرم                    | 26                                                                                                           |
| جدول                               | 4                                                                                                            |

**تب‌ها / بخش‌ها:** `stock` · `products`

**خواندن‌ها (9):**

- `useListEngine`
- `useProducts`
- `useSyncStore`
- `useWarehouse`
- `useCurrencyStore`
- `useStockHistory`
- `useWarehouseDetail`
- `useWarehouseOverview`
- `useUnits`

**نوشتن‌ها (7):**

- `useAssignWarehouseStock`
- `useCreateWarehouse`
- `useUpdateWarehouse`
- `useCreatePurchaseOrder`
- `useCreateProduct`
- `useCreateUnit`
- `useReceiveBatch`

**به این صفحه‌ها می‌رود:**

- به هیچ صفحه‌ای لینک مستقیم ندارد

**از این صفحه‌ها به آن می‌رسند:**

- `/invoices/new`
- `/quick-invoice`
- `/warehouse/[id]`

**حالت‌ها (جستجوی متنی در کد):** بارگذاری بله · خطا بله · خالی بله · بدون دسترسی **نه** · «تنظیم نشده» **نه**

## یافته‌ها

### 1. شدت 3 — کارهای انبار در پنج مقصد است: `/warehouse`، `/expiry`، `/stock-count`، `/operations`، `/manufacturing`.

- **چرا مهم است:** دو تای آن‌ها (`/stock-count`، `/operations`) اصلاً در منو نیستند.
- **پیشنهاد:** هاب انبار با تب‌های: موجودی · کالاها · انقضا · شمارش · سفارش‌گذاری و پیش‌بینی.

### 2. شدت 0 — قبلاً `/product-list` در همین صفحه ادغام شده (تب products).

- **چرا مهم است:** الگوی موجود برای ادامه.
- **پیشنهاد:** -

## اگر تأیید شود، چه چیزی عوض می‌شود

نشانی می‌ماند. تب‌های تازه (هر کدام lazy و در URL با `?tab=`) اضافه می‌شوند و کانتینرهای موجودِ صفحه‌های ادغام‌شده را سوار می‌کنند. قفل ماژول هر تب حفظ می‌شود.
