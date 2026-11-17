# تعمیرات — KPI و گزارش

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

این سند برای این صنف‌ها هم خوانده می‌شود: [mobilePhones](../mobilePhones/README.md)، [mechanic](../mechanic/README.md)، [itServices](../itServices/README.md).

| شاخص | از کجا می‌آید |
| --- | --- |
| پرونده‌های باز به تفکیک وضعیت | `GET /analytics/dashboard/open-repair-tickets` (آفلاین: در دسترس) |
| منتظر قطعه | `GET /repair-tickets` (فقط آنلاین) (وضعیت `waiting_parts`) |
| آماده‌ی تحویل | `GET /repair-tickets` (فقط آنلاین) (وضعیت `ready`) |
| فروش دوره | `GET /analytics/sales` (آفلاین: در دسترس) |
| میانگین زمان تعمیر | شکاف: زمان هر حرکت وضعیت گزارش نمی‌شود. |

شاخصی که منبع ندارد «شکاف» نوشته شده و عددی برایش ساخته نمی‌شود. «نامعلوم» صفر نیست.
