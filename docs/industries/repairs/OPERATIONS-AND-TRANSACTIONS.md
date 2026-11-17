# تعمیرات — عملیات و تراکنش

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

این سند برای این صنف‌ها هم خوانده می‌شود: [mobilePhones](../mobilePhones/README.md)، [mechanic](../mechanic/README.md)، [itServices](../itServices/README.md).

| اقدام | endpoint | اثر در دفاتر | اثر در انبار | آفلاین | وقتی نشد |
| --- | --- | --- | --- | --- | --- |
| پذیرش | `POST /repair-tickets` | — | کالای مشتری موجودی نیست | فقط آنلاین | مشتری ناشناس ساخته نمی‌شود |
| تأیید برآورد | `POST /repair-tickets/:x/approve` | — | — | فقط آنلاین | پرونده‌ی بسته تأیید نمی‌شود |
| حرکت وضعیت | `POST /repair-tickets/:x/status` | — | — | فقط آنلاین | حرکت بیرون از `REPAIR_MOVES` رد می‌شود |
| نگه‌داشتن قطعه | `POST /repair-tickets/:x/parts` | — | رزرو از موجودی آزاد | فقط آنلاین | موجودی ناکافی |
| مصرف قطعه | `POST /repair-tickets/:x/parts/:x/consume` | بهای قطعه | کسر قطعی از انبار | فقط آنلاین | قطعه‌ی آزادشده مصرف نمی‌شود |
| صورت‌حساب | `POST /repair-tickets/:x/bill` | فاکتور فروش دستمزد و قطعه | — | فقط آنلاین | پرونده دو بار صورت‌حساب نمی‌شود |
| گارانتی کار | `POST /warranties` | — | — | آفلاین: در دسترس | — |

ستون «آفلاین» از `OFFLINE_ENDPOINT_MATRIX` خوانده شده، نه نوشته.
