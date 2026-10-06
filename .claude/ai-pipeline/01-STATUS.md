# AI Pipeline — وضعیت پیاده‌سازی (۶ اکتبر ۲۰۲۶)

> وضعیت کلی: `IMPLEMENTED_NOT_LIVE_VERIFIED`. migration روی دیتابیس زنده **اجرا نشده**؛
> هیچ run واقعی با provider واقعی و نشست واقعی گرفته نشده.

## چه ساخته شد

| لایه                      | فایل                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Migration + VERIFY        | `docs/ai-pipeline-01-migration.sql` · `docs/VERIFY-ai-pipeline-01.sql`                                                                |
| قاعده‌ها (خالص)           | `backend/src/services/ai/pipeline/pipeline.domain.ts`                                                                                 |
| جدول‌های خودش             | `…/pipeline.repository.ts`                                                                                                            |
| هماهنگ‌کننده              | `…/pipeline.service.ts`                                                                                                               |
| Routeها                   | `backend/src/routes/ai-pipeline.routes.ts` (۷ route، فقط نشست)                                                                        |
| فراخوانی route خودِ سرور  | `backend/src/services/mcp/own-route.ts` (مشترک با MCP)                                                                                |
| قفل هم‌زمانی ویرایش مشتری | `CustomerService.update(…, { expectedUpdatedAt })`                                                                                    |
| هوک‌ها                    | `packages/api/src/hooks/ai-pipeline.ts`                                                                                               |
| صفحه                      | `packages/ui/src/components/ui/ai/ai-action-tool.tsx` — حالت «انجام کار» در `/assistant`                                              |
| تست                       | `ai-pipeline.pg.test.ts` (۱۵) · `ai-pipeline-domain.test.ts` (۴۶) · `ai-pipeline-routes.test.ts` (۲۵) · `ai-action-tool.test.ts` (۱۵) |

## تصمیم‌های اعمال‌شده

- دامنه: فاکتور **فروش**، دریافت از **مشتری**، ساخت و ویرایش مشتری. فاکتور خرید، پرداخت به تأمین‌کننده، حذف، برگشت و بستن دوره بیرون است (پاسخ: `UNSUPPORTED_REQUEST`).
- auto-approve: ساخته شده، پیش‌فرض خاموش، فقط غیرمالی، فقط تطبیق دقیق و بدون هشدار.
- تأییدکننده: هر کس capability همان عملیات را دارد — برای درخواست خودش، یا مدیر/مالک برای درخواست دیگری.
- سهمیه: هر run یک واحد.
- فاکتور همیشه **پرداخت‌نشده** ساخته می‌شود؛ دریافت پول عملیات جداست.
- ارزِ گفته‌نشده `AFN` است (همان پیش‌فرض routeها) و در پیشنهاد با هشدار گفته می‌شود.

## آنچه ثابت نشده / باز است

1. **اجرای زنده:** migration، سپس یک run واقعی از هر چهار عملیات با HTTP واقعی.
2. **`.eq('updated_at', …)` روی PostgREST واقعی** — منطقش تست شده، رفت‌وبرگشت رشته‌ی timestamp روی دیتابیس زنده نه.
3. **کیفیت فهم مدل** با provider تنظیم‌شده سنجیده نشده (تست‌ها پاسخ مدل را اسکریپت می‌کنند).
4. **تاریخچه‌ی AI روی صفحه‌ی فاکتور** ساخته نشد: ستون‌های `entity_type/entity_id` و ایندکسش هست، route و UI ندارد (عمداً — route بی‌caller نساختم).
5. **قفل نسخه‌ای برای فاکتور/پرداخت وجود ندارد و لازم هم نشد:** هر دو «ساختن»‌اند و با `Idempotency-Key` و تراکنش خودِ سرویس محافظت می‌شوند.
6. **شکاف مجوز موجود (گزارش، اصلاح‌نشده):** `POST /api/invoices` و routeهای نوشتنی مشتری `requireCapability` ندارند.
7. جست‌وجوی مشتری/کالا از routeهای کش‌دار (۶۰ ثانیه) می‌خواند؛ رکوردِ تازه‌ساخته ممکن است یک دقیقه «پیدا نشد» بدهد.
