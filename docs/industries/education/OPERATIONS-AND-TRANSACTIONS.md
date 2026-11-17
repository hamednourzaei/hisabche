# آموزشگاه و کورس — عملیات و تراکنش

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

| اقدام | endpoint | اثر در دفاتر | اثر در انبار | آفلاین | وقتی نشد |
| --- | --- | --- | --- | --- | --- |
| فروش بسته | `POST /invoices` | پول می‌آید؛ درآمد با هر جلسه شناخته می‌شود | — | آفلاین: در دسترس | شاگرد ناشناس ساخته نمی‌شود |
| دادن اعتبار | `POST /package-credits/grant` | تعهد به شاگرد | — | فقط آنلاین | بی‌فاکتور اعتبار داده نمی‌شود |
| کسر جلسه | `POST /package-credits/consume` | درآمد همان جلسه | — | آفلاین: در دسترس | اعتبار ناکافی رد می‌شود |
| برگشت کسر اشتباه | `POST /package-credits/reverse` | معکوس همان درآمد | — | آفلاین: در دسترس | فقط کسر موجود برمی‌گردد |
| تعلیق بسته | `POST /package-credits/grants/:x/suspension` | — | — | فقط آنلاین | بسته‌ی منقضی تعلیق نمی‌شود |
| ثبت جلسه | `POST /service-delivery/sessions` | — | — | آفلاین: در دسترس | هم‌پوشانی منبع رد می‌شود |
| دریافت شهریه | `POST /payments` | نقد در برابر دریافتنی | — | آفلاین: در دسترس | ارز دیگر روی فاکتور رد می‌شود |

ستون «آفلاین» از `OFFLINE_ENDPOINT_MATRIX` خوانده شده، نه نوشته.
