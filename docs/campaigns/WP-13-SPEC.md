# WP-13 — مشخصات اجرا: سفارش فروش، بیعانه و اقساط به‌عنوان تعهد

> سند دستی (تولیدی نیست). مبنا: ردیفهای `sales_orders` / `deposits_liability` / `installments`
> در `docs/architecture/universal-core/ENGINE-WIRING.csv`، و تعریف WP-13 در `WORK-PACKAGES.md`.

## ۱. وضعیت اندازهگیری شده (پیش از اجرا)

| قابلیت               | ماتریس  | موتور                   | لایه غایب | محدودیت کدشده                        |
| -------------------- | ------- | ----------------------- | --------- | ------------------------------------ |
| `sales_orders`       | partial | `sales_orders`          | `local`   | `SERVER_ONLY_NO_OFFLINE_ENGINE`      |
| `deposits_liability` | partial | `deposits_installments` | —         | `DEPOSIT_AUTO_FORFEIT_NOT_WIRED`     |
| `installments`       | partial | `deposits_installments` | —         | `AUTO_DUNNING_REMINDERS_SERVER_ONLY` |

صنوف درگیر: `furniture`, `printing`, `photography`, `travelAgency`, `realEstate`, `carDealer`.

### آنچه از قبل هست (دوبارهسازی ممنوع)

- **سفارش فروش**: `backend/src/services/orders/orders.service.ts` + `orders.routes.ts` +
  `storefront.routes.ts` + `packages/api/src/hooks/orders.ts` + چرخه وضعیت
  `packages/validation/src/schemas/sales-order-lifecycle.ts`. تنها لایه غایب Local Engine بود.
- **بیعانه**: `packages/validation/src/schemas/universal-core/order-deposit.domain.ts` (قواعد
  receipt / apply / refund، مانده، idempotency، دلیل اجباری برگشت) +
  `backend/src/services/sales/order-deposit.service.ts` + `order-deposit.routes.ts` +
  `packages/local-engine/src/routes/order-deposits.ts` + جداول `order_deposits`,
  `order_deposit_applications`, `order_deposit_refunds` در app-bridge.
- **اقساط**: `packages/validation/src/schemas/installment.domain.ts` (planSchedule، addMonths،
  overdueInstallments، decideBlock) + سرویس/مسیر سرور + `packages/local-engine/src/routes/installments.ts`
  - `late_fee_policy` / `late_fee_assessment`.

## ۲. شکافها و طراحی (آنچه پیاده شد)

### شکاف A — Local Engine سفارش فروش (`SERVER_ONLY_NO_OFFLINE_ENGINE`)

هدف: پیشنویش سفارش آفلاین. «پیشنویش» به معنای سند مالی قطعی نیست: تا زمان تأیید سرور، سفارش
وضعیت `quoted`/`pending` دارد و هیچ قلم موجودی و دفتر کلی جابهجا نمیشود.

پیادهشده:

1. دو جدول محلی `sales_order_drafts` و `sales_order_draft_items` در
   `local-universal-core-schema.ts` (با `workspace_id`، کلید idempotency، وضعیت، مبلغ به
   integer minor units، ارز از ورودی — بدون hardcoded currency) + مهاجرت `V31` + `SCHEMA_VERSION=31`.
2. مسیر `packages/local-engine/src/routes/sales-orders.ts`: فهرست، خواندن، ایجاد (idempotent)،
   ویرایش (تنها در وضعیت `quoted`)، submits به `pending`، و لغو. تمام نوشتها capability-guarded.
3. قاعدهٔ مشترک وضعیت: همان `isValidSalesOrderTransition` موجود — موتور وضعیت دوم ساخته نشد.
4. قاعدهٔ مشترک پول: `draftLineTotalMinor` / `draftTotalMinor` در
   `sales-order-draft.domain.ts` — device rounding مستقل ندارد.
5. شش Hook در `packages/api/src/hooks/orders.ts` که از `localRequest` (درگاه مستقیم حملونقل
   محلی) استفاده میکنند، نه `apiClient`: پیشنویشها روی دستگاه زندگی میکنند و هیچ مسیر سروری ندارند.
   بنابراین ردیفی در `offline-endpoint-matrix.ts` اضافه نشد (ماتریس فقط endpointهایی را ثبت میکند
   که کلاینت از طریق `apiClient` میخواند).

### شکاف A — نکتهٔ معماری

قرارداد `client-route-contract.test.ts` میخواهد هر مسیری که `apiClient` میخواند روی سرور وجود
داشته باشد. از آنجا که پیشنویشها صرفاً محلیاند، Hookها از `localRequest` استفاده میکنند — همان
درگاهی که `local-ledger`/فروش آفلاین برای نوشتن یکجا روی دستگاه بهکار میبرند. نه گارد تضعیف شد،
نه مسیر سرور جعلی ساخته شد.

### شکاف B — ضبط بیعانه قابل پیکربندی (`DEPOSIT_AUTO_FORFEIT_NOT_WIRED`)

پیادهشده: `decideDepositForfeiture(input, policy)` در `deposit-forfeiture.domain.ts`:

- `DepositForfeiturePolicy`: `enabled` (پیشفرض `false`)، `afterCancelDays`،
  `maxShareOfDepositPercent` (سقف)، `reasonRequired` (پیشفرض `true`).
- نتیجه `{ forfeit: false, reason }` یا `{ forfeit: true, amountMinor, daysAfterCancel }`.
- سقف روی **بخش مصرفنشدهٔ** بیعانه است، نه کل آن (جلوگیری از اخذ دوباره).
- تاریخ نامعتبر رد میشود (`DATE_INVALID`)، نه «روز صفر» که ضبط را مجاز میکرد.
- اتصال: مسیر `POST /orders/:id/deposits/:depositId/forfeiture-decision` در Local Engine —
  **پیشنمای تصمیم** است؛ اعمال ضبط روی سرور انجام نشده است.

### شکاف C — یادآوری اقساط آفلاین (`AUTO_DUNNING_REMINDERS_SERVER_ONLY`)

پیادهشده: `decideDunning(schedule, asOf, policy, remindersSent)` در
`installment-dunning.domain.ts`:

- `DunningPolicy`: `enabled` (پیشفرض `false`)، `graceDays`، `reminderIntervalDays`، `maxReminders`.
- وضعیت `overdue` حتی با خاموش بودن یادآوری نمایش داده میشود — واقعیت پنهان نمیشود.
- قسط پرداختشده هرگز `overdue` نیست؛ از `overdueInstallments` موجود استفاده میکند، تاریخ دوباره
  پیادهسازی نشده است.
- اتصال: مسیر `GET /invoices/:id/dunning` در `local-engine/src/routes/installments.ts`.

## ۳. معیار خروج (از WORK-PACKAGES، سطر WP-13)

سفارش سفارشی، دو پرداخت، تحویل ناقص، تسویه؛ **بیعانه تا لحظهٔ اعمال هرگز در درآمد نیاید**.
اقساط سررسیدگذشته وضعیت `overdue` بگیرند.

## ۴. آنچه انجام نشد (صادقانه)

- **UI اختصاصی پیشنویش**: مسیرها و Hookها وجود دارند، ولی صفحهای برای ساختن پیشنویش روی دستگاه
  اضافه نشد؛ Hookها مصرفکنندهٔ UI ندارند و در `UNUSED-HOOKS.csv`ثبت میشوند.
- **اعمال ضبط بیعانه و ارسال یادآوری روی سرور**: فقط تصمیم مشترک و مسیر پیشنمای دستگاه ساخته شد.
- **Sync خودکار**: پیشنویشها `sync_state='local_only'` میمانند؛ تأیید نهایی از طریق جریان
  موجود `/orders` انجام میشود، نه outbox خودکار.
- **شاهد PG زنده**: فایل تست PGای برای migration سرور نوشته نشد (WP-13 مهاجرت سرور ندارد)؛
  مهاجرت محلی `V31` توسط تستهای app-bridge پوشش داده شد. شرط دوم عبور بسته (`pg.test` با نوشتن
  واقعی) در محیط فعلی مسدود است (`SeCreateGlobalPrivilege`).

حکم نهایی بسته: `IMPLEMENTED_NOT_LIVE_VERIFIED`.
