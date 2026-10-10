# Domain Feature Audit: Sales & POS

## 1. Invoices (فاکتور فروش و خرید)

عنوان: Invoicing (فاکتور فروش و خرید)
توضیحات: صدور و مدیریت فاکتورهای فروش و خرید، به‌روزرسانی خودکار موجودی کالا (Stock Movements)، و رهگیری وضعیت پرداخت‌ها (Settlement Status).
چه کاری از صاحب کسب‌وکار را آسان کرده: پیگیری فاکتورهای پرداخت‌نشده، محاسبه خودکار مانده و کسر موجودی از انبار بدون نیاز به ثبت دستی حواله.
الگوریتم / منطق کاری در Hisabche: یک فاکتور می‌تواند `sale` یا `purchase` باشد. وضعیت `status` (مثل 'paid') دارد و بر اساس پرداخت‌ها (allocations) `settlement_status` آپدیت می‌شود. موجودی کالا به‌صورت خودکار بر اساس `invoice_items` کم یا زیاد می‌شود. فرمول reversal برای برگشت انبار (netReversal) به‌کار گرفته می‌شود.
نتیجه برای کسب‌وکار: دقت بالا در حسابداری و انبارگردانی بدون خطای انسانی در ثبت دوباره.
نحوه استفاده (مسیر واقعی UI): apps/web/app/[lang]/(dashboard)/invoices
Backend: backend/src/services/invoices/invoice-related.service.ts, backend/src/services/invoices/outstanding.domain.ts
Frontend: apps/web/app/[lang]/(dashboard)/invoices/page.tsx
API: Fastify REST endpoints in `backend/src/routes/invoice.routes.ts` (GET/POST/PATCH /api/invoices)
Data / DB: invoices, invoice_items, payment_allocations, journal_entries
Tests: invoice-derived-money.test.ts, invoice-edit-rules.test.ts, outstanding-predicate.test.ts
Status: COMPLETE
زاویه فروش: اتوماسیون کامل بین فروش، انبار و حسابداری در یک کلیک.
مشکل مشتری که حل می‌کند: گم شدن فاکتورها، مغایرت انبار، فراموشی پیگیری مطالبات.
مناسب برای چه نوع کسب‌وکاری: عمده‌فروشی‌ها، شرکت‌های خدماتی و بازرگانی.
Feature Relationships: وابسته به انبار (Inventory)، مشتریان (CRM) و پرداخت‌ها (Payments).
NEXT_HOOK: اتصال به Portal برای پرداخت آنلاین فاکتور.
زبان اثبات (برای دمو): "ببینید چطور با ثبت یک فاکتور، هم موجودی انبار کم میشه و هم سند حسابداریش اتوماتیک میخوره."
Evidence: outstanding.domain.ts references trigger from payment_allocations. stock-reversal.domain.ts reverses stock on invoice edit.
Business Value: 5
Demo Value: 5
Differentiation: 4
Frequency of Use: 5
Sales Impact: 5

---

## 2. POS / Till (صندوق فروشگاهی)

عنوان: POS / Till (صندوق فروشگاهی)
توضیحات: ماژول فروشگاهی با مدیریت شیفت (Session)، محاسبه موجودی کشو (Drawer Ledger) و مغایرت‌گیری (Variance).
چه کاری از صاحب کسب‌وکار را آسان کرده: بستن روزانه صندوق، محاسبه دقیق پولی که باید در کشو باشد، و جداسازی فروش نقد از نسیه و کارت.
الگوریتم / منطق کاری در Hisabche: مفهوم Session که با `openingFloat` (پول خرد اول روز) شروع می‌شود. سیستم تمام دریافتی‌های نقدی (sales, cash_in, settlements) را جمع و پرداختی‌ها را کسر می‌کند تا `expectedCash` به‌دست آید. صندوقدار پول موجود را می‌شمارد (`countedCash`) و اختلاف با `expectedCash` در سیستم به عنوان `varianceMinor` ثبت می‌شود تا مغایرت‌ها شفاف شود.
نتیجه برای کسب‌وکار: جلوگیری از دزدی یا اشتباهات صندوق، رهگیری دقیق جریانات نقدی روزانه.
نحوه استفاده (مسیر واقعی UI): apps/web/app/[lang]/(dashboard)/till/page.tsx
Backend: backend/src/services/pos/pos.domain.ts, backend/src/services/pos/pos.service.ts
Frontend: apps/web/app/[lang]/(dashboard)/till/page.tsx
API: pos.service.ts methods
Data / DB: pos_sessions, pos_orders, cash_movements
Tests: pos-rules.test.ts, till-settlement-drawer.test.ts, offline-pos-conflict.test.ts
Status: COMPLETE
زاویه فروش: کنترل دقیق صندوقداران و بستن شیفت بدون استرس کسری صندوق.
مشکل مشتری که حل می‌کند: مغایرت‌های روزانه صندوق و مشخص نبودن دلیل کسری یا اضافه‌آوردن پول.
مناسب برای چه نوع کسب‌وکاری: خرده‌فروشی‌ها، فروشگاه‌ها، سوپرمارکت‌ها.
Feature Relationships: به Inventory (کاهش آنی موجودی)، Payments و Invoices متصل است.
NEXT_HOOK: گزارش روزانه شیفت و مقایسه عملکرد صندوقداران.
زبان اثبات (برای دمو): "در پایان روز، سیستم بهتون میگه دقیقا چقدر باید تو کشو پول باشه و کسری یا اضافات رو با دقت یک ریال ثبت میکنه."
Evidence: pos.domain.ts (buildDrawerLedger, buildPosting) handles cashMinor, varianceMinor, expectedCashMinor.
Business Value: 5
Demo Value: 5
Differentiation: 4
Frequency of Use: 5
Sales Impact: 5

---

## 3. Payments & Customer 360

عنوان: Payments & Customer 360 (مدیریت دریافت/پرداخت و پروفایل مالی مشتری)
توضیحات: ثبت دریافت‌ها و پرداخت‌ها، تخصیص به فاکتورها، گزارش‌گیری عمر بدهی‌ها (Aging) و صورت‌حساب مشتری (Party Ledger / Statement).
چه کاری از صاحب کسب‌وکار را آسان کرده: دید جامع ۳۶۰ درجه به هر مشتری، تشخیص اینکه چه کسی بدهکارتر است و پیگیری مطالبات.
الگوریتم / منطق کاری در Hisabche: مشتری `openingBalance` دارد. تراکنش‌ها شامل Invoices و Payments با هم ترکیب شده و یک دفتر کل (Ledger) با `runningLedger` می‌سازند. مانده در لحظه (netBalance) و عمر بدهی (AgingBuckets: 1-30, 31-60, ...) محاسبه می‌شود. `rankPartyProducts` محصولاتی که مشتری بیشتر خریده را استخراج می‌کند.
نتیجه برای کسب‌وکار: وصول سریع‌تر مطالبات، کاهش ریسک اعتباری مشتریان، شناخت بهتر الگوهای خرید.
نحوه استفاده (مسیر واقعی UI): apps/web/app/[lang]/(dashboard)/customers/[id]/page.tsx
Backend: backend/src/services/payments/payments.service.ts, backend/src/services/payments/payments.domain.ts
Frontend: apps/web/app/[lang]/(dashboard)/customers/[id]/page.tsx
API: getAging, getPartyLedger, getPartySummary, getPartyActivity
Data / DB: payments, payment_allocations, invoices, customers
Tests: party-ledger.test.ts, party-summary.test.ts, payments-ar-ap-rules.test.ts, customer-debt-report.test.ts
Status: COMPLETE
زاویه فروش: صورت‌حساب لحظه‌ای و هوشمند که نه‌تنها مانده، بلکه محصولات محبوب مشتری را هم نشان می‌دهد.
مشکل مشتری که حل می‌کند: دعوا با مشتری سر مانده‌حساب، از دست دادن مشتریان خوب به دلیل فراموشی، رسوب سرمایه در مطالبات سوخت‌شده.
مناسب برای چه نوع کسب‌وکاری: همه کسب‌وکارهای B2B و B2C که فروش اعتباری/نسیه دارند.
Feature Relationships: وابسته به Invoices و Customers.
NEXT_HOOK: ارسال اتوماتیک پیامک سررسید بدهی.
زبان اثبات (برای دمو): "شما با باز کردن پروفایل مشتری نه‌تنها می‌بینید چقدر بدهکاره و چند روزه که پول نداده، بلکه می‌فهمید بیشتر چه کالاهایی رو ازتون خریده."
Evidence: summarizeParty, ageInvoices, getPartyLedger in payments.domain.ts and payments.service.ts.
Business Value: 5
Demo Value: 5
Differentiation: 5
Frequency of Use: 5
Sales Impact: 5

---

## 4. Customer Portal

عنوان: Customer Portal (پورتال اختصاصی مشتری)
توضیحات: ساخت لینک امن و عمومی (Token-based) برای هر مشتری تا بتواند فاکتورها، مانده حساب، پرداخت‌ها و سفارشات خود را آنلاین ببیند.
چه کاری از صاحب کسب‌وکار را آسان کرده: کاهش تماس‌های مشتریان برای پرسیدن "حساب من چقدره؟" یا "فاکتور منو بفرست".
الگوریتم / منطق کاری در Hisabche: سرویس `createLink` یک توکن ۶۴ کاراکتری یک‌بارمصرف یا دارای تاریخ انقضا می‌سازد. ویوی پورتال با `view(token)` کار می‌کند که در آن اطلاعات `balance`، لیستی از `invoices`، `payments` و `orders` واکشی می‌شود و همچنین `isDebtor` بودن مشتری مشخص می‌گردد. لینک در دیتابیس با `last_used_at` آپدیت می‌شود تا فروشنده بداند مشتری کی پورتال را دیده است.
نتیجه برای کسب‌وکار: پرستیژ بالاتر کسب‌وکار، شفافیت بی‌نظیر با مشتریان و صرفه‌جویی شدید در وقت حسابدار.
نحوه استفاده (مسیر واقعی UI): apps/web/app/[lang]/portal/[token]/page.tsx
Backend: backend/src/services/customer-portal/customer-portal.service.ts
Frontend: apps/web/app/[lang]/portal/layout.tsx, apps/web/app/[lang]/portal/[token]/page.tsx
API: createLink, view, listLinks, revokeLink
Data / DB: customer_portal_links, invoices, payments, sales_orders
Tests: customer-portal.test.ts
Status: COMPLETE
زاویه فروش: دادن یک پنل حرفه‌ای به مشتریان شما، بدون نیاز به نصب هیچ اپلیکیشنی از سمت آن‌ها.
مشکل مشتری که حل می‌کند: پاسخگویی مداوم به درخواست‌های تکراری ارسال صورت‌حساب.
مناسب برای چه نوع کسب‌وکاری: کسب‌وکارهای خدماتی، عمده‌فروشی‌ها، شرکت‌های پخش.
Feature Relationships: وابسته به Invoices, Payments, Customers.
NEXT_HOOK: امکان پرداخت مستقیم از داخل پورتال (Payment Gateway Integration).
زبان اثبات (برای دمو): "یک لینک به مشتری میدید، خودش باز میکنه و تمام فاکتورها و پرداختی‌هاش رو همراه با مانده حسابش زنده می‌بینه."
Evidence: createLink, view methods in customer-portal.service.ts. customer_portal_links table with expires_at and revoked_at.
Business Value: 4
Demo Value: 5
Differentiation: 5
Frequency of Use: 3
Sales Impact: 4
