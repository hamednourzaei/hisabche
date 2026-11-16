# V70 — بک‌لاگ قابلیت‌های خواسته‌شده (برآمده از V69.5)

وضعیت این سند: **طرح**. هیچ‌یک از موارد زیر در V68/V69 ساخته نشده و در این دور حتی یک خط کد برایشان
نوشته نشده است. هر بند می‌گوید «امروز چه هست» (با فایل و ستون واقعی)، «چه باید باشد»، و «از کدام مسیر
ساخته می‌شود». فایل migration هر بند در V70 ساخته می‌شود؛ پیش از ساخت، `docs/FINDING-*.sql` می‌سنجد چند
ردیف موجود قاعده‌ی تازه را می‌شکند، و وضعیت هر فایل تا اجرای انسانی
`Post-migration verification query generated — PENDING HUMAN CONFIRMATION` می‌ماند.

برچسب وضعیت هر بند از همان فهرست بسته‌ی `docs/industries/` است: `EXISTING_BUT_INCOMPLETE` ·
`CONFIGURATION_REQUIRED` · `NEW_CAPABILITY_REQUIRED` · `NOT_SUPPORTED` · `BLOCKED_EXTERNAL`.

---

## ۱. خدمت به‌عنوان یک موجودیت (service catalog)

**امروز.** «خدمت» یک کالای معمولی است: `service_delivery_sessions.service_offering_id` به
`public.products(id)` اشاره می‌کند (`docs/service-delivery-01-migration.sql:21`). جدول `service_catalog` فقط
در سند QA یکپارچه‌سازی سالن آمده (`docs/salon-01-migration.sql:52`) و در شمای پایه، شمای محلی
(`packages/app-bridge/src/local-schema.ts`) و کد بک‌اند وجود ندارد. مدت خدمت روی هر جلسه نوشته می‌شود
(`duration_minutes`, `start_time`, `end_time`)، نه روی خدمت؛ فیلدی برای «این کالا خدمت است» هم نیست.
**اثر دیده‌شده:** کارت «نوبت‌های امروز» نمی‌تواند «هنوز خدمتی تعریف نشده» را از «امروز نوبتی نیست»
تشخیص دهد و تنها یک پیام خالی صادقانه نشان می‌دهد.

**دامنه (طرح).** ستون‌های افزودنی روی `products`: `is_service boolean NOT NULL DEFAULT false`،
`default_duration_minutes integer`، `default_resource_kind text`؛ هیچ ستونی حذف یا بازنویسی نمی‌شود و
`service_offering_id` همچنان به `products` می‌ماند. قاعده‌ی «خدمت، موجودی ندارد» به‌صورت CHECK روی
همان ردیف، نه trigger سراسری.

**API (طرح).** `GET /products?kind=service` (فیلتر موجود، بدون route تازه)؛ ثبت/ویرایش از همان
`ProductService` با دو فیلد تازه در schema اعتبارسنجی؛ هیچ سرویس دوم ساخته نمی‌شود.

**migration (طرح).** `docs/service-catalog-01-migration.sql` — `ADD COLUMN IF NOT EXISTS` سه ستون،
`NOT VALID` + `VALIDATE` برای CHECK، بلوک Rollback، و `docs/VERIFY-service-catalog-01.sql`.
**تست.** `service-catalog-01.pg.test.ts` (اجرای فایل دو بار + نوشتن مجاز/رد‌شده) و گسترش
`industry-dashboard-parts.test.ts` برای پیام خالی «هیچ خدمتی تعریف نشده» وقتی `is_service = false` برای همه.

**برچسب:** `NEW_CAPABILITY_REQUIRED` — برای `beautySalon` / `barber` / `education`.

---

## ۲. ظرفیت کلاس/صندلی و فهرست انتظار

**امروز.** هر جلسه یک مشتری و یک بازه دارد (`service_delivery_sessions`)، و رزرو منبع فقط هم‌پوشانی
زمانی دو رزرو روی یک منبع را رد می‌کند (تریگر `service_sessions_resource_guard` در
`docs/salon-01-migration.sql`). ظرفیت عددی (چند نفر در یک کلاس، چند صندلی در یک بازه) جایی تعریف نشده،
پس «نرخ پرشدن کلاس/صندلی» مخرج ندارد.

**دامنه (طرح).** جدول `service_capacity_rules`: `workspace_id`، `service_offering_id`، `resource_kind`،
`capacity integer CHECK (capacity > 0)`، `effective_from date`. یک تابع `public.service_capacity_available(...)`
با `SET search_path = public, pg_temp` که «ظرفیت آزاد این بازه» را برمی‌گرداند؛ رزرو تازه در همان تابع
اتمیک سنجیده می‌شود، چون supabase-js تراکنش ندارد.

**API (طرح).** `GET /service-delivery/sessions?date=…` همان پاسخ موجود + `capacity` و `seated`؛
`POST /resource-bookings` همان route با خطای صریح `SERVICE_CAPACITY_FULL` (نه LWW).

**migration (طرح).** `docs/service-capacity-01-migration.sql` + `docs/VERIFY-service-capacity-01.sql`،
`REVOKE ALL` پیش از هر `GRANT`، و تابع با `REVOKE EXECUTE FROM PUBLIC, anon, authenticated`.
**تست.** `service-capacity-01.pg.test.ts`: دو رزرو هم‌زمان روی ظرفیت ۱ ⇒ یکی پذیرفته، یکی
`SERVICE_CAPACITY_FULL`؛ رزرو پس از لغو پذیرفته می‌شود؛ دو workspace با دو ظرفیت مستقل.

**برچسب:** `NEW_CAPABILITY_REQUIRED` — برای `education` (کلاس) و «نرخ پرشدن صندلی» در `beautySalon`.

---

## ۳. کنترل کیفیت تعمیر پیش از تحویل

**امروز.** چرخه‌ی وضعیت تعمیر در `packages/validation/src/schemas/repair-tickets.ts`
(`REPAIR_STATUSES` / `REPAIR_MOVES`) از `ready` مستقیم به `delivered` می‌رود؛ نه وضعیت بازرسی، نه
چک‌لیست، نه امضای بازرس. جدول‌های `repair_tickets` / `repair_ticket_events` هم فیلدی برای نتیجه‌ی
بازرسی ندارند.

**دامنه (طرح).** جدول `repair_quality_checks`: `ticket_id`، `checked_by uuid`، `result text CHECK (result IN
('passed','failed'))`، `notes`، `checked_at`. حرکت `ready → delivered` فقط با یک ردیف `passed` برای
همان پرونده مجاز می‌شود (تابع Postgres، چون ثبت چک و حرکت وضعیت باید اتمیک باشد).

**API (طرح).** `POST /repair-tickets/:id/quality-check` (capability همان نویسنده‌ی وضعیت)، و
`POST /repair-tickets/:id/status` با خطای `REPAIR_QA_REQUIRED` وقتی چک passed نیست.

**migration (طرح).** `docs/repair-quality-01-migration.sql` + `docs/VERIFY-repair-quality-01.sql`،
افزودنی و idempotent، با بلوک Rollback.
**تست.** `repair-quality-01.pg.test.ts`: تحویل بدون چک رد می‌شود؛ با `failed` رد می‌شود؛ با `passed`
پذیرفته و در `repair_ticket_events` یک ردیف ثبت می‌شود؛ اجرای دوباره‌ی migration بی‌خطا.

**برچسب:** `NEW_CAPABILITY_REQUIRED` — برای `repairs` (و `mobilePhones` / `mechanic` / `itServices` که از
همین سند می‌خوانند).

---

## ۴. کمیسیون قاعده‌محور

**امروز.** یک نرخ ثابت برای هر متخصص: `provider_commission_rates (workspace_id, employee_id, rate_bp)`
(`docs/provider-commission-01-migration.sql:16-23`) و گزارش `GET /provider-commissions`. نرخ به خدمت،
دسته‌ی خدمت، پله‌ی فروش یا نقش وابسته نیست؛ تصمیم صاحب کار N-7 هم همین بود (درصد خدمت، فقط گزارش،
بدون سند حسابداری).

**دامنه (طرح).** جدول `provider_commission_rules`: `scope text CHECK (scope IN
('employee','role','service','category'))`، `scope_id uuid`، `rate_bp`، `priority integer`،
`effective_from date`. حل قاعده با یک تابع خالص در `packages/validation` (قابل تست بدون دیتابیس)، و
گزارش موجود همان `CommissionSession` را با قاعده‌ی برنده برمی‌گرداند — سرویس دوم ساخته نمی‌شود.

**API (طرح).** `PUT /provider-commissions/rules` و `GET /provider-commissions/rules` در همان route
file؛ گزارش `GET /provider-commissions` بدون تغییر قرارداد.

**migration (طرح).** `docs/provider-commission-rules-01-migration.sql` + VERIFY؛ جدول قدیمی حذف نمی‌شود،
فقط به‌عنوان قاعده‌ی `scope='employee'` نگاشت می‌شود.
**تست.** `provider-commission-rules.test.ts` (حل قاعده، دو ارز، دو کارمند) و یک pg test برای یکتایی و
CHECKها؛ injection: برداشتن اولویت ⇒ دو قاعده هم‌زمان ⇒ تست قرمز.

**برچسب:** `NEW_CAPABILITY_REQUIRED` — برای `beautySalon` / `barber`.

---

## ۵. قفل دستگاه با رمز (device lock)

**امروز.** هیچ قفل/رمز دستگاهی وجود ندارد: جست‌وجوی `devicePin`/`pinHash`/`device_pin` در
`packages/app-bridge` و `packages/app-shell` صفر نتیجه دارد. دستگاه مشترک فروشگاه/سالن/آموزشگاه/تعمیرگاه
هر کسی را که پشتش بنشیند با نشست باز می‌پذیرد.

**دامنه (طرح).** رمز فقط به‌صورت hash با نمک (PBKDF2 یا scrypt، از crypto خود Node/Electron، بدون
dependency تازه) در جدول محلی `device_security` نگه داشته می‌شود: `device_id`، `pin_hash`، `salt`،
`failed_attempts`، `locked_until`. هیچ رمزی در سرور، لاگ یا پاسخ API نوشته نمی‌شود. قفل بعد از N تلاش،
و باز کردن با نشست صاحب کار (نه با ریست خودکار).

**API (طرح).** بدون route سرور. پل محلی: `deviceSecurity.enroll` / `deviceSecurity.unlock` /
`deviceSecurity.reset` در `packages/app-bridge` با قرارداد تایپ‌شده و همان الگوی `executionSiteFor`؛
مسیر سوم ساخته نمی‌شود.

**migration (طرح).** فقط جدول محلی (SQLite) — migration سرور لازم نیست. اگر روزی زمان‌بندی قفل
سراسری لازم شد، آن زمان `docs/device-lock-01-migration.sql`.
**تست.** `device-lock.test.ts`: رمز درست باز می‌کند، غلط سه بار ⇒ `locked_until`، hash هرگز در پاسخ
برنمی‌گردد، ریست فقط با نشست معتبر؛ injection: مقایسه‌ی رمز خام ⇒ تست قرمز.

**برچسب:** `NOT_SUPPORTED` — تا ساخته شود، برای هر چهار نماینده (و بقیه‌ی اصناف).

---

## ۶. شکاف دادهٔ آفلاین چهار نماینده (pull) — کشف‌شده در V69.5

**امروز.** `syncEntitySchema` (`packages/validation/src/schemas/sync-protocol.schema.ts:60`) یازده
موجودیت دارد: `invoice, customer, product, transaction, time_entry, warehouse, branch, exchange_rate,
product_stock, order_deposits, order_deposit_applications, order_deposit_refunds`. هیچ‌یک از
`product_variants`, `service_delivery_sessions`, `package_credit_ledger`, `repair_tickets` در آن نیست و
`FEATURE_PACKS[*].syncEntities` هم آن‌ها را نام نمی‌برد. پس روی دستگاه، این چهار جدول فقط ردیف‌هایی را
می‌بینند که همان دستگاه نوشته است؛ چهار قطعه‌ی داشبورد آفلاین «available» هستند چون route و schema
محلی دارند، ولی داده‌ای که دستگاه ندیده را نشان نمی‌دهند.

**طرح.** افزودن چهار موجودیت به `syncEntitySchema` + `syncEntities` پک مربوطه + مسیر pull سرور برای
هرکدام، با همان پنجره‌ی زمانی و همان قرارداد `sync_state`؛ بدون این کار وضعیت ماتریس باید
`online_required` بماند. این یک تغییر قرارداد sync است، نه یک قابلیت تازه.

**تست.** گسترش `offline-endpoint-matrix` (وضعیت هر ردیف با موجودیت پشتش بخواند)، یک pg test برای pull
دو workspace، و یک تست roundtrip: ردیف ساخته‌شده روی دستگاه A روی دستگاه B خوانده می‌شود.

**برچسب:** `EXISTING_BUT_INCOMPLETE` — برای هر چهار نماینده.

---

## ۷. دروازه‌ی پک برای قطعه‌های داشبورد

**امروز.** قطعه‌های داشبورد فقط با `PROFILES[id].dashboard` (صنف) و انتخاب شخص (`usePageLook`) mount
می‌شوند؛ هیچ‌کدام از کارت‌های داشبورد (از جمله `manufacturing`) وضعیت پک را نمی‌سنجند. `getInstalledPacks()`
در `packages/app-shell/src/features/packs/pack-gate.tsx` هست، ولی `packages/ui` نمی‌تواند آن را import کند
(جهت وابستگی) و هر دو محل رندر (`apps/web/.../dashboard/page.tsx` سروری، `packages/app-shell/.../dashboard-page.tsx`)
همین حالا هم `DashboardContainer` را بدون پک صدا می‌زنند. تا وقتی پرچم `hisabche:packs.delivery` خاموش
است، `getInstalledPacks()` همه‌ی `PACK_IDS` را برمی‌گرداند، پس امروز هیچ کسب‌وکار زنده‌ای پک کم ندارد؛
اختلاف وقتی پیدا می‌شود که تحویل پک روشن شود.

**طرح.** کلیدهای `PACK_DELIVERY_FLAG_KEY` / `INSTALLED_PACKS_STORAGE_KEY` به
`packages/validation/src/schemas/feature-packs.ts` (خانه‌ی `PACK_IDS` و `packForDashboardPart`) منتقل شوند و
`pack-gate.tsx` همان‌ها را دوباره export کند؛ `DashboardContainer` یک prop اختیاری
`installedPacks?: readonly PackId[]` بگیرد و با `packForDashboardPart` بسنجد؛ هر دو محل رندر مقدار را از
همان یک منبع بدهند. بدون prop، رفتار امروز (همه‌ی پک‌ها) حفظ می‌شود تا هیدریشن خراب نشود.

**تست.** یک تست رندر با `installedPacks: ['core']` که هیچ‌یک از چهار قطعه را mount نکند، و همان تست با
پک کامل که همه را mount کند؛ injection: برداشتن gate ⇒ تست قرمز.

**برچسب:** `EXISTING_BUT_INCOMPLETE` — برای هر چهار نماینده.

---

## ۸. `payment.record` و `invoice.return` در قرارداد مکان اجرا هستند، ولی هیچ‌کس نمی‌پرسد

**امروز.** `executionSiteFor` سه عمل را می‌شناسد، ولی هر پنج caller آن (همه در `packages/api/src/hooks`) فقط
`invoice.create` را می‌پرسند (`node scripts/code-intel.mjs callers "executionSiteFor"`). یعنی دریافت پول و مرجوعی
هرگز مسیر دستگاه را انتخاب نمی‌کنند، هرچند `OFFLINE_ENDPOINT_MATRIX` برای `POST /payments` و
`POST /invoices/:x/returns` وضعیت `available` دارد. سند صنف همین را صریح می‌نویسد («در قرارداد هست، ولی هیچ hook آن را
صدا نمی‌زند؛ امروز server») و گارد `industry-offline-device.test.ts` همین را از کد اسکن می‌کند.

**اندازه‌گیری V69.9 (یافته F8).** پرداخت **local-first نشده** و در این دور هم یک خط کد برایش نوشته نشد:
`Select-String -Path packages\api\src\hooks\payments.ts -Pattern "executionSite|localRequest"` ⇒ **۰ برخورد**،
`git diff --stat -- packages/api/src/hooks/payments.ts` ⇒ **خالی**، و `node scripts/code-intel.mjs callers
"executionSiteFor"` ⇒ **۵ caller**، همه با `'invoice.create'`. پس تیک V68.6 در پرامپت برداشته شد.

**طرح (الف) — انتخاب‌شده؛ مسیر سوم ساخته نمی‌شود.**

1. روت محلی `POST /payments/:id/confirm-server` در `packages/local-engine/src/routes/payments.ts`، دقیقاً قرینه‌ی
   `confirmServerInvoice` در `packages/local-engine/src/routes/invoices.ts`: در **یک** تراکنش SQLite شناسه و شماره‌ی
   رسمی سرور روی ردیف محلی بنشیند، `payment_allocation`ها به شناسه‌ی سرور جابه‌جا شوند و `pendingSync` پایان یابد.
   بدون این روت، `localRequest('POST','/payments')` ردیف محلی را با شناسه‌ی موقت رها می‌کند و سرور ردیف دوم می‌سازد
   — دو پرداخت در دو جا؛ همین دلیل، وصل‌کردن با یک خط را رد می‌کند.
2. سیم‌کشی `pushEntry` در `packages/app-shell/src/features/sync/sync-engine.ts` برای `payment` (همان نگاشت
   `clientId → serverId` فاکتور) و `confirmServerPayment` پس از پاسخ ۲۰۰/۲۰۱.
3. در `packages/api/src/hooks/payments.ts`: `executionSiteFor('payment.record') === 'device'` + `writeLocally()`
   با `Idempotency-Key` (همان الگوی `submitInvoice`)، و شاخه‌ی خطای ۴xx موتور محلی **بدون** fallback به سرور.
4. مرجوعی (`invoice.return`) تا وقتی برگشت لایه‌های FIFO/AVCO و سند محلی کامل نشده، روی مسیر امروز (`server`)
   می‌ماند؛ گارد `industry-offline-device.test.ts` همین را از کد می‌خواند، نه از ادعا.

**تست.** `payment-local-first.test.ts` در `packages/api` (آماده + آنلاین ⇒ صفر `POST /payments` از axios)،
`payment-confirm-roundtrip.test.ts` در `packages/app-shell` (ثبت محلی → push → شناسه‌ی رسمی؛ push دوم ⇒ همان ردیف)،
و گسترش `payment-allocation-parity.test.ts` با **دو ارز**: تخصیص محلی و سروری یک عدد بدهند؛ injection: برداشتن
`confirm-server` ⇒ دو ردیف ⇒ تست قرمز.

**برچسب:** `NEW_CAPABILITY_REQUIRED` — روت `confirm-server` برای پرداخت وجود ندارد (برای فاکتور هست).

---

## ۹. اثبات parity یک هسته روی **دو ذخیره‌ساز** (Postgres واقعی در برابر موتور محلی) — یافته F7

**امروز.** `packages/local-engine/src/__tests__/v59-1-golden-parity.test.ts` فقط همان ورودی‌ها را از قواعد دامنه‌ی
مشترک (`@hisabche/validation`) و از handlerهای SQLite می‌گذراند: **۵/۵ پاس**. یعنی «یک هسته» ثابت شده، ولی «دو
ذخیره‌ساز یک جواب می‌دهند» ثابت نشده. پرامپت V68.7 به `golden-multi-currency-parity.pg.test.ts` اشاره می‌کرد که
**وجود ندارد**: `Test-Path backend\src\__tests__\golden-multi-currency-parity.pg.test.ts` ⇒ **False** و در `backend`
و `packages` هیچ فایلی با `*golden-multi-currency*` نیست.

**طرح.** تنها یک fixture طلایی با **دو ارز**، یک کالای وزنی، یک واحد تبدیلی، تخفیف خط + فاکتور، مالیات، FIFO و AVCO
و مشتری با سقف اعتبار؛ همان fixture از `InvoiceService.create` روی Postgres واقعی (`*.pg.test.ts`) و از موتور محلی
اجرا شود و این هفت چیز مقایسه شوند: جمع‌ها، خطوط، حرکت موجودی، مصرف لایه‌ی بها، خطوط سند دفتر، مانده‌ی طرف حساب،
و شماره‌ی سند. عدد انتظار با دست حساب و کنارش assert مقیاسی. گسترش همان دو فایل موجود، نه harness تازه.

**محدودیت امروز.** Postgres روی این ماشین نیست (۱۶۰ فایل `*.pg.test.ts` همه skip؛ اندازه‌گیری:
`workspace-create-01.pg.test.ts` = ۲۴۰۰۱۴ms برای ۶ تست skip) ⇒ **BLOCKED_EXTERNAL** برای اجرا در CI لینوکس؛
اجرای محلی ادعا نمی‌شود.

**برچسب:** `BLOCKED_EXTERNAL`.

---

## ترتیب پیشنهادی اجرا

1. بند ۶ (pull) — بدون آن، قطعه‌های آفلاین نصفه‌اند و هر قابلیت تازه روی داده‌ی ناقص می‌نشیند.
2. بند ۱ (service catalog) — پیش‌نیاز پیام خالی درست در `todaySessions` و بند ۲.
3. بند ۲ (ظرفیت) و بند ۳ (QC) — هر دو مستقل، هر دو با تابع Postgres.
4. بند ۴ (کمیسیون قاعده‌محور) — بعد از تثبیت بند ۱، چون قاعده به «خدمت» اشاره می‌کند.
5. بند ۵ (قفل دستگاه) — مستقل از بقیه؛ فقط محلی.
6. بند ۷ (دروازه‌ی پک) — کوچک و بی‌ریسک؛ فقط وقتی پرچم تحویل پک روشن شود اهمیت پیدا می‌کند.
7. بند ۸ (پرداخت local-first) — بعد از بند ۶، چون روت `confirm-server` پرداخت به pull/نگاشت شناسه تکیه دارد.
8. بند ۹ (parity دو ذخیره‌ساز) — هر وقت CI لینوکس با Postgres در دسترس بود؛ محلی `BLOCKED_EXTERNAL`.

### بند ۸ — پیشرفت ۱۶ نوامبر

- ✅ سند پرداخت محلی = سند سرور: نرخ منجمد هر فاکتور + `fx_gain_loss`، و بانک برای روش غیرنقدی (`payment-posting-parity.test.ts` ۲/۲، injection قرمز).
- ✅ روت `POST /payments/:id/confirm-server` (شناسه و شماره‌ی سرور + تخصیص، سند دفتر، کاربرد/استرداد بیعانه در یک تراکنش) — `payment-confirm-server.test.ts` ۶/۶، injection ۲ قرمز.
- ✅ `confirmServerPayment` در `sync-engine.ts` بعد از push پرداخت (best-effort، مثل فاکتور).
- ✅ `submitPayment` در `packages/api/src/hooks/payments.ts`: دستگاه آماده ⇒ موتور محلی با کلید intent به‌عنوان شناسه؛ رد آنلاین ⇒ یک بار سرور با همان کلید؛ رد آفلاین ⇒ همان رد — `payment-device-first.test.ts` ۵/۵، injection ۱ قرمز.
- ✅ `payment.record` در `DEVICE_FIRST_OPERATIONS`. ⚠️ تست app-shell (`device-operation-reads.test.ts`) بازنویسی شد ولی اجرا نشد (jest نصب نیست).
- ⬜ اجرای واقعی روی ویندوز/اندروید و Postgres — `IMPLEMENTED_NOT_LIVE_VERIFIED`.
- ⚠️ تصمیم مالک: دریافت از تأمین‌کننده در سرور به «دریافتنی» و در دستگاه به «پرداختنی» می‌رود.

### بند ۳ — ساخته شد (۱۶ نوامبر، V71)

- ⚠️ **طرح بالا غلط بود و اجرا نشد:** جدول `repair_quality_checks` موتور دوم می‌شد. دفتر کیفیت از پیش
  هست — `quality_events` (`quality-events-01`) با `source_type = 'repair'` و `pass`/`fail`/`rework` — و پنل
  تعمیر از قبل روی آن می‌نوشت (با مجوز اشتباه `inventory.configure` و برچسب خام `event_kind`).
- ✅ قاعده‌ی یکتا: `repairMoveRefusal(from, input, latestQuality)` — پارامتر سوم **اجباری**؛ تحویل بدون
  آخرین حکم «قبول» ⇒ `REPAIR_QA_REQUIRED`. `rework` قدیمی = رد.
- ✅ سرور: `POST /api/repair-tickets/:id/quality-check` (همان مجوز حرکت تیکت، `invoice.create`) از
  `QualityService.recordQualityEvent`؛ «رد» روی دستگاهِ آماده آن را به تعمیر برمی‌گرداند. صورت‌حساب نهایی
  کنترل را **پیش از** ساختن فاکتور می‌سنجد (وگرنه فاکتور صادر می‌شد و تحویل رد).
- ✅ دیتابیس: `docs/repair-quality-01-migration.sql` (تریگر روی `repair_tickets`، بدون جدول تازه) +
  `VERIFY-repair-quality-01.sql` + `repair-quality-01.pg.test.ts` — **منتظر اجرا و VERIFY**؛ تست pg روی
  این دستگاه اجرا نشد (Postgres نیست).
- ✅ دستگاه: `quality_events` روی دستگاه نیست، پس دستگاه هرگز خودش تحویل نمی‌دهد (`null`).
- ✅ UI: پنل تعمیر — یادداشت، «قبول» / «رد — برگشت به تعمیر» (رد بدون یادداشت غیرفعال)، حکم ترجمه‌شده.
