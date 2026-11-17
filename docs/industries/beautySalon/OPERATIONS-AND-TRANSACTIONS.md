# ناخن و سالن زیبایی — عملیات و تراکنش

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

این سند برای این صنف‌ها هم خوانده می‌شود: [barber](../barber/README.md).

| اقدام | endpoint | اثر در دفاتر | اثر در انبار | آفلاین | وقتی نشد |
| --- | --- | --- | --- | --- | --- |
| ثبت نوبت | `POST /service-delivery/sessions` | — | — | آفلاین: در دسترس | هم‌پوشانی با رزرو منبع رد می‌شود |
| حاضر شد / شروع / نیامد | `POST /service-delivery/sessions/:x/status` | — | — | آفلاین: در دسترس | حرکت غیرمجاز وضعیت رد می‌شود |
| تحویل خدمت | `POST /service-delivery/sessions/:x/deliver` | فاکتور فروش؛ درآمد همین‌جا شناخته می‌شود | مواد مصرفی اگر تعریف شده باشد | آفلاین: در دسترس | جلسه‌ی لغوشده تحویل نمی‌شود |
| لغو نوبت | `POST /service-delivery/sessions/:x/cancel` | — | — | آفلاین: در دسترس | جلسه‌ی تحویل‌شده لغو نمی‌شود |
| رزرو صندلی/اتاق | `POST /resource-bookings` | — | — | آفلاین: در دسترس | دو رزرو روی یک بازه: تعارض صریح |
| دریافت پول | `POST /payments` | نقد در برابر دریافتنی | — | آفلاین: در دسترس | ارز دیگر روی فاکتور رد می‌شود |
| تعیین نرخ کمیسیون | `PUT /provider-commissions/rates` | — | — | فقط آنلاین | فقط آنلاین |

ستون «آفلاین» از `OFFLINE_ENDPOINT_MATRIX` خوانده شده، نه نوشته.
