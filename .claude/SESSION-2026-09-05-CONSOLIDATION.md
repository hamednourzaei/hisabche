# سشن ۱۴ شهریور ۱۴۰۵ (2026-09-05) — یکپارچه‌سازی معماری، فازهای A تا E

> این سشن روی **Source of Truth** کار کرد، نه روی قابلیت جدید. ورودی‌اش دو سند
> بود: Audit دیتابیس واقعی، و معماری هدف UI/Database. خروجی‌اش ۱۱ فایل migration
> و تغییر ۹ فایل کد.
>
> اگر فقط یک چیز از این فایل می‌خوانی: **بخش «چیزهایی که Audit اشتباه گفته
> بود»** را بخوان. سه فرض آن سند با کد واقعی نمی‌خواند و کورکورانه اجرا کردنشان
> داده را نابود می‌کرد.

---

## وضعیت اجرا

| فاز | فایل‌ها                     | روی دیتابیس اجرا شد؟ | کد دیپلوی شد؟         |
| --- | --------------------------- | -------------------- | --------------------- |
| A   | `phase-a-01` … `phase-a-04` | ✅ بله               | —                     |
| B   | `phase-b-01`, `phase-b-03`  | ✅ بله               | ⛔ هنوز نه            |
| B   | `phase-b-02`                | ⛔ **عمداً نه**      | باید بعد از دیپلوی کد |
| C   | `phase-c-01`                | ✅ بله               | ⛔ هنوز نه            |
| D   | `phase-d-01`                | ✅ بله               | —                     |
| E   | `phase-e-01`                | ⛔ هنوز نه           | ⛔ هنوز نه            |
| F   | `phase-f-01`                | ⛔ هنوز نه           | ⛔ هنوز نه            |

**ترتیب دیپلوی که باید رعایت شود:**

- `phase-b-02` → فقط **بعد از** دیپلوی کد. تا وقتی PaymentModal قدیمی روی مرورگر
  کسی باز است، تریگر آن ثبت پرداخت را ۵۰۰ می‌کند.
- `phase-c-01` → **قبل از** دیپلوی کد. تریگر، نوشتن‌های فعلی سرویس‌ها را بی‌اثر
  می‌کند نه غلط؛ اگر کد اول برود یک بازه می‌ماند که هیچ‌چیز موجودی را نگه نمی‌دارد.

---

## تصمیم‌های قطعی این سشن

| موضوع            | Source of Truth                                        | Projection                                            |
| ---------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| حسابداری         | `journal_entries` + `journal_lines`                    | `ledger_entries_view`؛ `ledger_entries` **freeze شد** |
| مانده‌ی طرف حساب | اسناد: `invoices` + `payments` + `payment_allocations` | `party_ledger` / `transactions_view`                  |
| موجودی (مقدار)   | `stock_movements`                                      | `products.quantity`, `warehouse_stock.quantity`       |
| موجودی (بها)     | `cost_layers`                                          | —                                                     |
| تسویه‌ی فاکتور   | `payment_allocations`                                  | `invoices.paid_amount`, `invoices.settlement_status`  |
| شعبه‌ی کارمند    | `employee_branch_assignments`                          | `employee_current_branches`                           |
| دسترسی           | فعلاً `workspace_members.role` (استاتیک)               | `user_roles` هنوز فقط **اضافه** می‌کند                |

---

## 🔴 چیزهایی که Audit اشتباه گفته بود — مهم‌ترین بخش این فایل

### ۱. «موجودی سه منبع دارد» — چهار تا بود، و `stock_movements` **ناقص** بود

Audit می‌گفت `products.quantity` / `warehouse_stock` / `stock_movements`. واقعیت:

- `products.quantity` را `invoice.service` با حساب دستی می‌نوشت **و**
  `purchasing.service` و `manufacturing.service` از روی `cost_layers`
  **رونویسی** می‌کردند. هرکدام آخر اجرا می‌شد برنده بود.
- `warehouse_stock` را فقط `warehouse_transfer_stock` می‌نوشت — یعنی فقط انتقال‌ها
  را منعکس می‌کرد، نه فروش و نه خرید.
- **`stock_movements` برای دریافت سفارش خرید و برای تولید اصلاً سطر نمی‌ساخت.**

**درسی که نزدیک بود گران تمام شود:** نقشه‌ی بدیهی «`products.quantity` را از
`SUM(stock_movements)` بازمحاسبه کن» موجودی حاصل از **هر خرید و هر تولید در
تاریخ سیستم** را صفر می‌کرد. تمیز به نظر می‌رسید و موجودی هر کسب‌وکاری را از بین
می‌برد.

راه‌حلی که به‌جایش رفت: بازمحاسبه نکن. شکاف بین عدد امروز و چیزی که حرکت‌ها
توضیح می‌دهند را اندازه بگیر و برایش یک حرکت `type='opening'` بنویس. هیچ عددی
تکان نمی‌خورد؛ فقط از این به بعد هر تغییر مجبور است از مسیر حرکت رد شود.

### ۲. «Accounting سه مدل دارد» — عملاً دو تا بود

`ledger_entries` در کل `backend/src` **صفر خواننده و صفر نویسنده** داشت. نوشتن‌های
موازی همه روی `transactions` بود. پس freeze کردن `ledger_entries` بی‌خطر بود.

### ۳. «`employees.branch_id` را با جدول تخصیص جایگزین کن» — چنین ستونی وجود ندارد

هرگز اضافه نشده بود. `member_branches` که هست، سؤال دیگری را جواب می‌دهد: آن
درباره‌ی **کاربر** است و تعیین می‌کند چه چیزی را _مجاز_ است ببیند. کارمند اکثراً
اصلاً لاگین ندارد. این دو نباید یکی شوند.

---

## باگ‌های واقعی که حین کار پیدا شدند

### 🔴 پرداخت مشتری برعکس و بدون سند ثبت می‌شد

`PaymentModal.tsx` پرداخت را با `useCreateTransaction` و `type: "payment"`
می‌فرستاد. سه پیامد، هیچ‌کدام خطا نمی‌داد:

1. هیچ allocation ای نمی‌ساخت → فاکتور همچنان تسویه‌نشده می‌ماند؛
2. هیچ سند حسابداری نمی‌ساخت → پول به دفتر کل نمی‌رسید؛
3. `payment` در واژگان party-ledger یعنی «پولی که **ما** پرداخت کردیم» → گرفتن
   ۵۰۰ از بدهکار، بدهی‌اش را ۵۰۰ **زیاد** می‌کرد.

این دقیقاً درس ۱۰ است که در سرویس رفع شده بود و از مسیر UI دوباره وارد شده بود.
`/api/payments` از قبل روی سرور بود و **هیچ hook ای صدایش نمی‌زد** — آدرس آنجا
بود، هیچ‌چیز به آن اشاره نمی‌کرد.

### 🔴 مانده‌ی مشتری اصلاً فاکتورها را نمی‌دید

هیچ‌جای کد هنگام صدور فاکتور یا ثبت پرداخت سطری در `transactions` نمی‌نوشت. فقط
دو نویسنده بود: مانده‌ی اول دوره‌ی مشتری نسیه، و `POST` دستی. یعنی
`customer.getBalance()` از مجموعه‌ای جمع می‌زد که نه فاکتور داشت نه پرداخت.

### 🔴 همان باگ علامت، در روت دوم

`/api/transactions/balance/:customerId` هم `receipt` را مثبت و `payment` را منفی
حساب می‌کرد. رفعِ درس ۱۰ فقط به `customer.service` خورده بود و این کپی جا مانده
بود. حالا هر دو از `partyBalance` استفاده می‌کنند — کپی سوم این چهار خط، جایی است
که اختلاف سوم شروع می‌شود.

### 🔴 `hasPermission` مرز تنانسی نداشت

`permission.service.hasPermission(userId, code)` فقط با `user_id` فیلتر می‌کرد و
`user_roles.workspace_id` را نادیده می‌گرفت. کسی که در یک workspace حسابدار است،
آن دسترسی را به همه‌ی workspaceهای دیگرش می‌برد. کلید کش هم workspace نداشت.
روی مسیر enforcement نبود — و Phase E دقیقاً همان تغییری است که می‌بردش آنجا.

### 🔴 `paid_amount` نویسنده‌ی دوم داشت و افزایشی نگه‌داری می‌شد

`invoice.service.update()` فیلد `paidAmount` را از بدنه‌ی PATCH مستقیم روی ستون
می‌نوشت — یعنی یک کلاینت می‌توانست فاکتور را «تسویه‌شده» کند بدون اینکه حتی یک
پرداخت وجود داشته باشد. حالا صریحاً رد می‌شود.

و `payments_record`/`payments_cancel` عدد را **افزایشی** نگه می‌داشتند
(`paid_amount + x`، `GREATEST(0, paid_amount - x)`). سه پیامد:

- `GREATEST(0, …)` باز هم کسری را می‌بلعید (درس ۱۵)؛
- `payments_cancel` وضعیت **هر** فاکتوری را که لمس می‌کرد از `paid` به `pending`
  برمی‌گرداند، حتی فاکتوری که هنوز با پرداخت دیگری تسویه بود؛
- `payments_record` هیچ‌وقت `partial` نمی‌نوشت — فاکتور نیمه‌پرداخت از پرداخت‌نشده
  قابل تشخیص نبود.

### 🟠 `products.quantity` عدد صحیح بود

با اینکه دامنه کالای وزنی دارد (`weight_grams`, `unit_label`). فروش نیم کیلو
بی‌صدا صفر یا یک می‌شد. به `numeric(18,4)` پهن شد.

### 🟠 `scripts/find-missing-fks.mjs` هیچ‌وقت هیچ‌چیز match نمی‌کرد

رجکس‌ها داخل template literal با `\s` و `\b` تک‌بک‌اسلش نوشته شده بودند. در رشته،
`\s` می‌شود حرف `s` و `\b` می‌شود کاراکتر backspace. یعنی اسکریپت **هر** FK را
«گم‌شده» گزارش می‌کرد. حالا که درست شد، چند embed واقعاً بدون FK هست و PGRST200
می‌دهند: `pos_orders → pos_order_payments`, `purchase_orders → products`,
`lot_allocations → stock_batches`, `stock_movements → warehouses!from_warehouse_id`
و چند مورد RBAC. **کار باقی‌مانده.**

---

## درس‌های جدید این سشن

### الف. `DROP VIEW` تنظیم `security_invoker` را هم می‌برد

`phase-b-01` مجبور بود `transactions_view` را drop کند (تغییر نوع ستون با
`CREATE OR REPLACE VIEW` ممکن نیست — خطای `42P16`). ویو بازساخته‌شده با حالت
پیش‌فرض برگشت، یعنی **با دسترسی سازنده**، یعنی RLS جدول‌های زیرش اصلاً اعمال
نمی‌شد. `linter-hardening-migration.sql` این پرچم را یک بار عمداً گذاشته بود و
drop آن را دور انداخت.

نتیجه تا وقتی `phase-b-03` اجرا شود: هر کاربر لاگین‌شده از `/rest/v1/party_ledger`
فاکتورها و پرداخت‌های **همه‌ی** workspaceها را می‌گرفت.

> **قانون:** هر migration که ویویی را drop و rebuild می‌کند، باید
> `ALTER VIEW … SET (security_invoker = true)` را در **همان فایل** دوباره بگذارد.
> این خاصیت ویو است، نه اسکیما.

### ب. فایل‌های phase عمداً در `ORDER` فایل `run-migrations.mjs` نیستند

اضافه‌شان کردم و اشتباه بود. هرچه در `ORDER` است **قبل از** همه‌ی extraها اجرا
می‌شود — و `SETUP-COMPLETE.sql` یک extra است که `warehouse_transfer_stock` و
`transactions_view` را در شکل قبل‌از‌consolidation دوباره می‌سازد. یعنی هر rebuild
بی‌صدا Phase B و C را برمی‌گرداند، بدون هیچ خطایی چون هر دو `CREATE OR REPLACE`
اند. مرتب‌سازی نام‌محور خودش ترتیب درست را می‌دهد (حروف بزرگ قبل از کوچک، و
`a < b < c < d`). دلیلش در خود آن فایل کامنت شده.

### ج. لینتر Supabase — کدام هشدارش را باید جدی گرفت

- `security_definer_view` روی ویوهای جدید → **واقعی، فوری** (بند الف).
- `function_search_path_mutable` روی توابع جدید → واقعی، با
  `SET search_path = public` (بدون `pg_temp` — قبل از `public` resolve می‌شود).
- `authenticated_security_definer_function_executable` روی
  `auth_workspace_ids` / `auth_owned_workspace_ids` / `is_workspace_member` →
  **پذیرفته‌شده و مستند**. در `linter-hardening-migration.sql:120` نوشته شده که
  نسخه‌ی اول همه را revoke کرد و «محصول را برای همه‌ی کاربران لاگین‌شده از کار
  می‌انداخت»، چون بدنه‌ی policy با دسترسی نقش کوئری‌زننده اجرا می‌شود. دست نزن.
- `auth_leaked_password_protection` → یک سوییچ در Supabase Auth، نه دیتابیس.

### د. `MIN()` روی `uuid` وجود ندارد

`(array_agg(DISTINCT x))[1]` به‌جایش، وقتی `HAVING COUNT(DISTINCT x) = 1` تضمین
می‌کند فقط یک مقدار هست.

### ه. گاردهای تست را برای جا دادن migration خودت ضعیف نکن

`rls-coverage.test.ts` روی `USING (true)` در policy جدید `permissions` قرمز شد.
وسوسه: استثنا اضافه کن، «کاتالوگ که global است». درست: policy را به
`EXISTS (SELECT 1 FROM auth_workspace_ids())` تغییر بده — هم گارد را راضی می‌کند
هم واقعاً قوی‌تر است (اکانتی که عضو هیچ workspace ای نیست نمی‌تواند کاتالوگ را
enumerate کند).

### و. تستی که projection را assert می‌کند، بعد از انتقال به تریگر باید عوض شود

`tenancy-idor.test.ts` روی `products.quantity` assert می‌کرد. با انتقال محاسبه به
تریگر دیتابیس، آن عدد در تستِ بدون دیتابیس تکان نمی‌خورد. assert به **حرکت انبار**
منتقل شد — که assert قوی‌تری هم هست، چون حالا گارد IDOR واقعی همان است.

---

## کار باقی‌مانده

1. **دیپلوی کد**، بعد اجرای `phase-b-02`.
2. **اجرای `phase-e-01`** و بعد کوئری `rbac_grant_drift` انتهای آن فایل — باید
   خالی باشد.
3. **پرداخت‌های ثبت‌شده با علامت اشتباه**: کوئری (A) انتهای `phase-b-01` فهرستشان
   می‌دهد. هرکدام باید آگاهانه از طریق `POST /api/payments` دوباره ثبت و سطر
   legacy آرشیو شود. migration عمداً بازنویسی‌شان نمی‌کند.
4. **مانده‌ی اول دوره دوبار شمرده می‌شود**: `customers.opening_balance` و همزمان
   یک سطر `transactions`. هنوز حل نشده — Phase F فقط تسویه‌ی فاکتور را پوشش داد،
   نه مانده‌ی افتتاحیه‌ی طرف حساب.
   4b. **`invoices.status` هنوز دو چیز است**: هم وضعیت سند (`completed`,
   `cancelled`) و هم وضعیت تسویه (`paid`, `partial`). Phase F ستون درست
   (`settlement_status`) را کنار آن اضافه کرد و رفتار `status` را **عوض نکرد**.
   جدا کردن خواننده‌ها از `status` یک تغییر جداست.
5. **FKهای گم‌شده‌ی PGRST200** (بند بالا).
6. **`employee_branch_assignments` خواننده ندارد** — لایه‌ی سرویس/روت/hook/UI
   ساخته نشده.
7. **Phase E هنوز فقط اضافه می‌کند.** `user_roles` می‌تواند دسترسی بدهد، نمی‌تواند
   بگیرد. سوییچ به database-only یک ریلیز جداست، بعد از اینکه `rbac_grant_drift`
   یک ریلیز کامل خالی مانده باشد. **در همان دیپلوی این کار را نکن.**

---

## فایل‌های ساخته/تغییریافته

**Migrationها (`docs/`)** — `phase-a-01-journal-lines-fk`,
`phase-a-02-ledger-entries-workspace`, `phase-a-03-fk-indexes`,
`phase-a-04-missing-primary-keys`, `phase-b-01-accounting-source-of-truth`,
`phase-b-02-freeze-transaction-payment-writes`, `phase-b-03-view-security-invoker-fix`,
`phase-c-01-inventory-source-of-truth`, `phase-d-01-employee-branch-assignments`,
`phase-e-01-rbac-2.0`

**کد** — `backend/src/routes/transaction.routes.ts`,
`backend/src/routes/permission.routes.ts`,
`backend/src/services/invoice.service.ts`,
`backend/src/services/purchasing.service.ts`,
`backend/src/services/manufacturing.service.ts`,
`backend/src/services/permission.service.ts`,
`backend/src/__tests__/tenancy-idor.test.ts`,
`packages/api/src/hooks/payments.ts` (جدید), `packages/api/src/index.ts`,
`packages/ui/src/components/ui/customers/PaymentModal.tsx`,
`scripts/find-missing-fks.mjs`, `scripts/run-migrations.mjs`

---

# فازهای G و J — ادامه‌ی همان سشن

## وضعیت اجرا (تکمیل جدول بالا)

| فاز | فایل‌ها                          | روی دیتابیس اجرا شد؟ |
| --- | -------------------------------- | -------------------- |
| G1  | — (فقط کد)                       | —                    |
| G2  | `phase-g-01-branch-manager`      | ⛔ هنوز نه           |
| G3  | `phase-g-02-permission-profiles` | ⛔ هنوز نه           |
| J1  | `phase-j-01-branch-period-lock`  | ⛔ هنوز نه           |

## 🔴 کرشی که به production رسید

`/fa/warehouse?tab=products` با React #300 کاملاً پایین آمد. علتش تب کاتالوگی
بود که در G1 اضافه کردم: `warehouseContainer()` را **شرطی** صدا می‌زدم و آن تابع
دوازده هوک دارد. درس ۵۹ و گارد ایستا
`packages/ui/src/__tests__/conditional-hook-call.test.ts`.

## J0 — یافته‌ی اصلی که نقشه را عوض کرد

**قفل دوره از قبل پیاده بود** و — مهم‌تر — **داخل خودِ RPC ثبت** اعمال می‌شود، نه
فقط در سرویس. یعنی نوشتن مستقیم روی دیتابیس هم رد می‌شود. اسمش
`accounting_period_locks` است، نه `accounting_periods`.

اگر J1 را طبق متن اولیه از صفر می‌ساختم، یک لایه‌ی موازی روی یک enforcement کارکن
می‌گذاشتم — روی تنها کنترلی که تعیین می‌کند آیا ارقام بایگانی‌شده نهایی‌اند.

**Gapهای واقعی که J0 پیدا کرد:**

- `branch_id` روی **هدر** سند است (`journal_entries`)، نه روی خطوط. **K1 باید
  دقیقاً از همین استفاده کند** و ستون به `journal_lines` اضافه نکند.
- **Payroll و Stock Adjustment اصلاً سند حسابداری نمی‌زنند** — دو رویداد مالی
  خارج از دفتر.
- **Approval سند را نگه نمی‌دارد.** `invoice.service.ts` صراحتاً کامنت دارد
  «Never blocks invoice creation». یعنی «در انتظار تأیید» یک برچسب است، نه گیت.
- Credit Note وجود ندارد.
- Reconciliation فقط `payments` را کاندید match می‌گیرد؛ `reconciliation_sessions`
  و `reconciliation_matches` جدولِ بی‌خواننده‌اند.
- `unmatch` هیچ Audit Event نمی‌نویسد.

**محیط تست:** دیتابیس mock است (`setup.ts` به دامنه‌ی رزرو IANA اشاره می‌کند).
پس تست‌های DB-level فقط به‌صورت Verification Script و `PENDING HUMAN CONFIRMATION`.

## J1 — قفل دوره‌ی شعبه‌آگاه

`workspace_id PRIMARY KEY` اجازه‌ی سطر دوم نمی‌داد. کلید مرکب
`(workspace_id, branch_id)` هم کار نمی‌کند چون **ستون PK نمی‌تواند NULL باشد** و
NULL دقیقاً همان چیزی است که قفل شرکتی را بیان می‌کند. راه‌حل: `id` جانشین + دو
ایندکس یکتای جزئی.

قاعده‌ی precedence در `evaluatePeriodLock` (خالص، ۱۶ تست): **قفل شرکت یا قفل شعبه
رد می‌کند** — و شعبه هرگز نمی‌تواند چیزی را که شرکت بسته باز کند.

## G3 — ماتریس دسترسی

خانه‌های owner/manager/seller **قفل‌اند**، چون Phase E حل قابلیت را افزایشی گذاشت:
برداشتن تیک `ledger.post` برای مدیر هیچ اثری نداشت. کنترلی که بی‌صدا شکست
می‌خورد از نبودنش بدتر است.

## ریفکتور UI حسابداری

سه نقص واقعی، نه ظاهری:

1. **`toLocaleString()` بدون locale** در همه‌ی تب‌ها → دو نفر در یک مغازه یک عدد
   را «۱۲٬۵۰۰» و "12,500" می‌دیدند. پکیج `@hisabche/formatting` از قبل بود و این
   ماژول هیچ‌وقت صدایش نزده بود.
2. **بدون `tabular-nums`** → ستون اعداد راست‌چین اصلاً تراز نمی‌شد.
3. **خانه‌ی اختلاف تراز آزمایشی وقتی صفر بود خالی می‌ماند** و وقتی صفر نبود با
   همان وزن بقیه رندر می‌شد. تنها عددی که باید داد بزند، شبیه بقیه بود.

به‌علاوه: رنگ‌های خام تیلویند (`bg-blue-500/10`, rose, purple, emerald, amber) که
به هیچ توکن تمی وصل نبودند و به سوییچ light/dark جواب نمی‌دادند.
