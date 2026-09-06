# وضعیت زنده — فازهای G تا O

> **این فایل را اول بخوان اگر سشن جدیدی شروع کرده‌ای.**
> پس‌زمینه‌ی معماری و درس‌ها در
> [SESSION-2026-09-05-CONSOLIDATION.md](SESSION-2026-09-05-CONSOLIDATION.md) و
> [lessons-learned.md](lessons-learned.md) است. این فایل فقط **وضعیت اجرا** و
> **کار نیمه‌تمام** را نگه می‌دارد.

---

## ✅ J3 — تمام شد

migration اجرا شده، کد کامل، تست‌ها سبز. جزئیات پایین‌تر در بخش Credit Note.

---

## Migrationها — وضعیت اجرا

| فایل                                     | اجرا شد؟                    |
| ---------------------------------------- | --------------------------- |
| `phase-a-01` … `phase-a-04`              | ✅                          |
| `phase-b-01`, `phase-b-02`, `phase-b-03` | ✅                          |
| `phase-c-01`                             | ✅                          |
| `phase-d-01`                             | ✅                          |
| `phase-e-01`                             | ✅                          |
| `phase-f-01`                             | ✅                          |
| `phase-g-01-branch-manager`              | ✅                          |
| `phase-g-02-permission-profiles`         | ✅                          |
| `phase-g-03-audit-branch`                | ✅                          |
| `phase-j-01-branch-period-lock`          | ✅                          |
| `phase-j-02-reconciliation-hardening`    | ✅                          |
| `phase-j-03-document-status`             | ✅                          |
| `phase-j-04-payroll-ledger`              | ✅ (خروجی V1/V2 گزارش نشده) |
| `phase-k-01-stock-transfers`             | ✅ (خروجی V1–V5 گزارش نشده) |
| `phase-l-01-units`                       | ✅ (خروجی V1–V6 گزارش نشده) |
| `phase-l-02-product-units`               | ✅ (خروجی V1–V5 گزارش نشده) |
| `phase-l-03-cycle-counts`                | ✅ (خروجی V1–V5 گزارش نشده) |
| `phase-m-01-shift-handover`              | ✅ تأییدشده                 |
| `phase-n-01-reconciliation-memory`       | ✅ تأییدشده                 |
| `phase-o-01-reporting-layer`             | ✅ ساختار تأیید شد¹         |
| `phase-o-02-catalog-and-query-log`       | ✅ تأییدشده                 |

¹ **ساختار** تأیید شد (هر ۴ View `security_invoker`، صفر تابع با آرگومان
workspace، صفر امتیاز نوشتن برای نقش کاربری، هر ۴ View کامپایل می‌شوند).
**رفتار ایزولاسیون هنوز `PENDING`** — تستش به کاربر لاگین‌شده نیاز دارد و تا
بعد از دیپلوی ممکن نیست. اسکریپت: `docs/verify-phases-m-n-o.sql` بخش سوم.

**کد هیچ‌کدام هنوز دیپلوی نشده.**

---

## فازها — تمام‌شده و باقی‌مانده

### ✅ تمام

| فاز | چه شد                                                                  |
| --- | ---------------------------------------------------------------------- |
| A–F | یکپارچه‌سازی Source of Truth (دیتابیس)                                 |
| G1  | یکی‌کردن سه جفت Route تکراری + redirect                                |
| G2  | تب «شعب» + درخت + فرم کارمند با انتخاب شعبه                            |
| G3  | ماتریس دسترسی واقعی + پروفایل‌ها                                       |
| G4  | مرکز Audit + `branch_id` + نگاشت entity→route                          |
| G5  | **از قبل انجام شده بود** — دست نزدم                                    |
| G6  | گیت تأیید که واقعاً سند را نگه می‌دارد                                 |
| J0  | Discovery — گزارش کامل                                                 |
| J1  | قفل دوره‌ی شعبه‌آگاه                                                   |
| J2  | Reconciliation: `matched_kind`، کاندیدهای journal، قفل، Audit          |
| J3  | تفکیک `document_status` از `settlement_status` (J3.4 → Stop Condition) |
| J4  | حقوق حالا سند حسابداری می‌زند + گزارش سندهای ناتراز                    |
| J5  | سه قانون مرده‌ی SoD؛ گارد پوشش؛ Override حالا در Audit دیده می‌شود     |
| H1  | کارت‌های داشبورد کلیک‌پذیر + لیست فاکتور حالا URL را می‌خواند          |
| H2  | نام طرف‌حساب لینک شد؛ پنل پرداخت‌ها و سند حسابداری روی جزئیات فاکتور   |
| H3  | Drill-down حسابداری: هر رقم → خطوط پشتش → سند مبدأ                     |
| H4  | تاریخچه‌ی موجودی هر کالا + `reference_id` روی حرکت‌های فروش            |
| H5  | شعبه‌های کارمند از `employee_branch_assignments` خوانده می‌شود         |
| H6  | پنل «تاریخچه‌ی تغییرات این رکورد» روی فاکتور و کارمند                  |
| H7  | سند در انتظار تأیید از روی کارت approval باز می‌شود                    |
| H8  | تعارض → رکورد واقعی (UI تعارض‌ها از قبل بود)                           |
| G7  | **پشتیبان واقعی** — قبلاً محتوای localStorage دانلود می‌شد             |
| G8  | **از قبل ساخته شده بود** — فقط لینک رکورد کم بود (H8)                  |
| K0  | `unit_id` روی `stock_transfer_lines` از روز اول (L1 مهاجرت مخرب نکند)  |
| K1  | **از قبل ساخته شده بود** — `branchIds` تا RPC وصل بود                  |
| K2  | چرخه‌ی عمر Transfer + ۴ Invariant (پایه‌ی stock → Stop Condition)      |
| K3  | In-Transit **مشتق** از `stock_transfers` — بدون ستون ذخیره‌شده         |
| K4  | سوییچر شعبه روی هر سه گزارش حسابداری                                   |
| L0  | جدول `units` + واحدهای وزنی (L0.1 → Stop Condition، سیاست §9)          |
| L1  | Multi-UOM — تبدیل در سرویس؛ opt-in، بدون backfill                      |
| L2  | Cycle Count — دامنه‌ی قیمت‌گذاری که خواننده نداشت، حالا وصل است        |
| L5  | Audit ارزش‌گذاری + tripwire برای FIFO ناسازگار با Transfer             |
| M2  | تعارض فروش بیش از موجودی + کشف گپ «فاکتور آفلاین = فقط سر» (Stop)      |
| L3  | Smart Reorder — نقطه‌ی سفارش از فروش واقعی (فقط پیشنهاد)               |
| L4  | Dead Stock — پارامتر Query، نه Setting                                 |
| M1  | **از قبل بود** — `POS_PAYMENT_SHORT` و گارد نقد/باقی‌مانده             |
| M3  | Shift Handover **منجمد** + تاریخچه‌ی شیفت‌ها                           |
| M4  | **ساخته نشد** — هیچ Threshold تخفیفی در Policy نیست (G4)               |
| N1  | یادگیری از Matchهای تأییدشده + ستون `matched_party`                    |
| N2  | **OUT OF SCOPE** — طبق خود اسپک (Provider/Storage/Queue نیست)          |
| N3  | پیش‌بینی نقدینگی ۷/۳۰ روزه — کاملاً Derived                            |
| N4  | فرصت‌های راکد — Read Model با پیش‌فرض ۱۴ روز                           |
| O1  | کاتالوگ معنایی — کدام جدول منبع حقیقت، کدام Projection، کدام Frozen    |
| O2  | لایه‌ی گزارش AI-safe — **هیچ View پارامتر workspace نمی‌گیرد**         |
| O3  | `ai_query_log` — فقط زیرساخت، هیچ Provider وصل نیست                    |
| O4  | `docs/ai-integration-readme.md` — مرز Raw SQL صریح و برجسته            |

### ✅ هر ۵۱ زیرفاز تمام شد

هیچ زیرفازی باقی نمانده. آنچه باز است:

- **۴ migration اجرا نشده** (جدول بالا)
- **هیچ کدی از این سشن دیپلوی نشده**
- **۵ Stop Condition** که تصمیم محصولی می‌خواهند (پایین‌تر)

---

## 🔴 Gapهای واقعی که J0 پیدا کرد و هنوز بازند

1. **Stock Adjustment هیچ سند حسابداری نمی‌زند.** (Payroll در J4 حل شد.) رویداد مالی
   کاملاً خارج از دفتر. هر گزارش مالی به اندازه‌ی همان‌ها ناقص است. (J4)
2. **Credit Note اصلاً وجود ندارد** — نه جدول، نه schema، نه کد. (J3.4)
3. **`unmatch` حالا Audit دارد** ✅ ولی `reconciliation_sessions` /
   `reconciliation_matches` هنوز جدولِ بی‌خواننده‌اند (عمداً دست‌نخورده).
4. **FKهای گم‌شده که PGRST200 می‌دهند** — با `node scripts/find-missing-fks.mjs`
   دیده می‌شوند: `pos_orders → pos_order_payments`, `purchase_orders → products`,
   `lot_allocations → stock_batches`,
   `stock_movements → warehouses!from_warehouse_id` و چند مورد RBAC.
5. **مانده‌ی اول دوره دوبار شمرده می‌شود** — `customers.opening_balance` و
   همزمان یک سطر `transactions`.
6. ~~**`ApprovalCard` هیچ‌جا رندر نمی‌شود**~~ — **بسته شد**: هم در `/approvals` و
   هم در جزئیات فاکتور رندر می‌شود؛ در H7 لینک به سند هم اضافه شد.
7. **SoD بین دو سند (cross-document) وجود ندارد.** `priorActions` با کلید
   `(entity_type, entity_id)` می‌خواند، پس قانونی که دو نیمه‌اش روی دو موجودیت
   متفاوت باشد **هرگز** فعال نمی‌شود. قانون واقعیِ
   «کسی که حساب را ساخت تنها کسی نباشد که در آن سند می‌زند» به همین دلیل در J5
   **حذف شد، نه پیاده** — مدلش وجود ندارد و Policy‌اش تعریف نشده (G4).
   اگر لازم شد، اول مدل cross-document تعریف شود.
8. **`settlementDate()` هرگز `settlementStatus` نمی‌گیرد.** در J3 اصلاح شد که
   اول `settlement_status` را بخواند، ولی:
   - `INVOICE_LIST_COLUMNS` این ستون را select نمی‌کند،
   - `invoices-mappers.ts` هم آن را پاس نمی‌دهد.

   یعنی ستون «تاریخ تسویه» هنوز روی مسیر legacy (`status === 'completed'`)
   کار می‌کند. **عمداً در H2 اصلاح نشد** — اضافه‌کردن ستون به
   `INVOICE_LIST_COLUMNS` یعنی اگر آن ستون نباشد کل لیست فاکتور 42703
   می‌شود؛ همان دلیلی که در J3 `document_status` را از INSERT بیرون آورد
   (درس ۶۵). راه درست: یک خواندن tolerant جدا، یا افزودن ستون بعد از تأیید
   اینکه phase-f روی همه‌ی محیط‌ها اجرا شده.

9. **KPI «بدهی مشتریان» هنوز روی `status !== 'paid'` است، نه
   `settlement_status`.** حالا این قاعده در
   `services/invoices/outstanding.domain.ts` **یک‌جا** است و لیست و کارت از
   همان می‌خوانند، پس ناهماهنگ نمی‌شوند. ولی مهاجرت به `settlement_status`
   (منبع حقیقت فاز F) یک **تصمیم محصولی** است چون عددی را که کاربر هر روز
   می‌بیند تغییر می‌دهد — طبق §۱۳ گزارش شد، بازنویسی نشد.
10. **`audit_logs` را فقط platform-admin و worker انقضا می‌نویسند** — فاکتور،
    پرداخت و انبار به آن نمی‌نویسند، پس تب «سابقه تغییرات» تنک است. (کار جدا)
11. **صفحه‌ی `/purchasing` هیچ فرم ایجاد سفارش ندارد.** فقط سفارش‌ها را لیست
    می‌کند و کالای رسیده را ثبت می‌کند. ولی `POST /api/purchase-orders` و
    `useCreatePurchaseOrder` **هر دو وجود دارند** و صفر مصرف‌کننده دارند
    (همان الگوی درس ۷۴).

    به همین دلیل دکمه‌ی «سفارش خرید» روی کالای کم‌موجود در H4 **ساخته نشد** —
    به صفحه‌ای می‌رفت که نمی‌تواند روی آن عمل کند. ساختن فرم یک **feature**
    است نه اتصال: تأمین‌کننده، اقلام، تاریخ‌ها و تصمیم درباره‌ی تأیید می‌خواهد.

12. **حرکت‌های انبارِ قدیمیِ فروش `reference_id` ندارند.** از H4 به بعد نوشته
    می‌شود، ولی سطرهای قبلی `NULL` می‌مانند و در تاریخچه به‌صورت متن (نه لینک)
    دیده می‌شوند. طبق §۱۲ حدس زده نشد — «نامعلوم» می‌ماند.

    اگر لازم شد، backfill از `invoice_items` **ممکن** است ولی مبهم: چند فاکتور
    می‌توانند همان کالا را در همان لحظه حرکت داده باشند و انتساب قطعی نیست.

13. **`purchase_order` و `work_order` صفحه‌ی جزئیات ندارند** (فقط
    `/purchasing` و `/manufacturing` به‌صورت لیست). پس `routeForEntity` برای
    آن‌ها درست `null` برمی‌گرداند و در drill-down به‌جای لینک، متن دیده می‌شود.

---

## قوانینی که این سشن با آن‌ها کار کرد

طبق سند اجرایی کاربر (بخش ۰.۵):

- **من هیچ DDL روی دیتابیس زنده اجرا نمی‌کنم.** فقط فایل migration + کوئری
  Verification می‌سازم؛ انسان اجرا می‌کند.
- تست‌های سطح Application را خودم می‌نویسم و اجرا می‌کنم.
- تست‌های سطح DB → SQL Verification Script با علامت
  `PENDING HUMAN CONFIRMATION`.
- **دیتابیس در تست‌ها mock است** (`setup.ts` به دامنه‌ی رزرو IANA اشاره می‌کند)،
  پس هیچ تست خودکاری تریگر یا RPC واقعی را اثبات نمی‌کند.
- هر migration باید بلوک Rollback/Mitigation داشته باشد.
- Additive و idempotent؛ بدون DROP.

---

## وریفای — دو سطح

اجرای هر ۹ پکیج بعد از هر تغییر کوچک **خیلی طول می‌کشد**. دو سطح:

**۱ — حین کار (بعد از هر فاز):** فقط پکیج‌های دست‌خورده.

```bash
# معمولاً همین سه‌تا کافی است
for p in packages/api packages/ui backend; do (cd $p && npx tsc --noEmit) && echo "$p OK"; done
```

به‌علاوه‌ی فقط فایل تستِ مربوطه:
`npx vitest run src/__tests__/<file>.test.ts`

**۲ — پایان یک دسته فاز:** کامل.

```bash
for p in packages/validation packages/formatting packages/api packages/ui \
         packages/ui-contract apps/web apps/desktop apps/mobile backend; do
  (cd $p && npx tsc --noEmit) && echo "$p OK"
done
cd backend && npx vitest run
cd packages/ui && npx vitest run
cd packages/ui-contract && npx vitest run
```

برای lint فقط شمارش error مهم است (warningها از قبل زیادند):

```bash
npx eslint src 2>&1 | grep -cE "^\s+[0-9]+:[0-9]+\s+error"
```

**تست مرورگر را صاحب پروژه خودش انجام می‌دهد** — dev server بالا نیاور.

**آخرین وضعیت سبز:** backend ۱۶۴۹ تست · ui ۱۶۲ · ui-contract ۴۳۲ · `eslint`
صفر error.

---

## 🛑 J3.4 — Credit Note: STOP CONDITION، ساخته نشد

طبق بند ۲۱ سند اجرایی (Stop Conditions) و Guardrail G4 (بدون Policy تعریف‌نشده
چیزی نساز)، Credit Note پیاده **نشد** و دلیلش اینجا ثبت می‌شود.

### وضعیت فعلی

صفر. نه جدول، نه schema، نه سرویس، نه روت. تنها ردش یک مقدار در واژگان
party-ledger است (`LedgerTxnType = ... | 'return'`) که معنایش تعریف شده
(«ما به او اعتبار دادیم → کمتر بدهکار است») ولی **هیچ کدی آن را نمی‌سازد**.

### چهار تصمیمی که قبل از ساخت باید گرفته شوند

1. **بازپرداخت نقدی یا اعتبار روی حساب؟** این کل مدل را عوض می‌کند. نقدی یعنی
   یک `payment` با `direction='out'`؛ اعتبار یعنی یک سند بستانکار که فاکتورهای
   بعدی به آن allocate می‌شوند. **هیچ‌کدام در محصول تعریف نشده.**

2. **اثر حسابداری:** برگشت درآمد و AR، یا یک حساب contra-revenue جدا؟ دومی
   گزارش فروش ناخالص را حفظ می‌کند، اولی نه. تصمیم حسابداری است نه فنی.

3. **اثر مالیاتی:** مالیات فاکتور اصلی روی سند **منجمد** شده (تصمیم ثبت‌شده در
   README). برگشت باید همان نرخ منجمد را برگرداند، نه نرخ امروز.

4. **اثر انبار — سخت‌ترین:** کالای برگشتی باید لایه‌ی FIFO را با **بهای اصلی**
   برگرداند، نه بهای امروز. `inventory_release_consumption(workspace, user,
consumer_type, consumer_id)` وجود دارد و مصرف یک سند را آزاد می‌کند — ولی
   برای **برگشت جزئی** (سه تا از ده تا) طراحی نشده. استفاده‌ی نادرست از آن،
   کل مصرف فاکتور را آزاد می‌کند.

### چرا حدس زدن بدتر از نساختن است

هر انتخابی بدون این چهار تصمیم، یک **مدل مالی موازی** می‌سازد — دقیقاً چیزی که
G2 منع می‌کند. و برخلاف یک باگ UI، یک Credit Note با اثر حسابداری اشتباه در
دفتر می‌ماند و بعداً باید با سند برگشتی اصلاح شود.

### آنچه به‌جایش انجام شد

بقیه‌ی J3 (تفکیک document_status از settlement_status) کامل شد، که **پیش‌نیاز**
Credit Note هم هست: بدون آن، یک سند برگشتی نمی‌توانست بگوید «ثبت‌شده ولی
تسویه‌نشده».

---

## 🛑 K2 — پایه‌ی حرکت انبار در Transfer: STOP CONDITION

سند Transfer کامل ساخته شد (چرخه‌ی عمر، تأییدها، Invariantها، In-Transit
مشتق). ولی **ship و receive حرکت انبار نمی‌زنند** و با کد
`TRANSFER_STOCK_LEG_NOT_IMPLEMENTED` رد می‌شوند.

### چرا

انتقال لحظه‌ای امروز (`warehouse_transfer_stock`) کالا را A→B در یک تراکنش
می‌برد. یک انتقال واقعی نمی‌تواند: کالا دوشنبه می‌رود و پنج‌شنبه می‌رسد، و
آن سه روز روی **هیچ قفسه‌ای** نیست. پس باید دو پا شود — و کالا باید جایی
«باشد».

### سه گزینه، هیچ‌کدام تصمیم‌گیری نشده

1. **یک انبار رزرو «در راه» به‌ازای هر workspace.** تمیز است، ولی در هر
   picker و هر گزارش موجودی ظاهر می‌شود مگر همه‌شان یاد بگیرند حذفش کنند.
2. **`stock_movements` با from بدون to.** صادقانه است، ولی
   `stock_movements_project()` (فاز C) باید یاد بگیرد چنین سطری مبدأ را کم
   می‌کند و به هیچ‌جا اضافه نمی‌کند — یعنی **تغییر تریگر پروجکشن**، که منبع
   حقیقت هر عدد موجودی در کل محصول است.
3. **حرکت لحظه‌ای در ship، و receive فقط تأیید.** ساده‌ترین و همان کاری که
   امروز می‌شود — ولی آن‌وقت `stock_in_transit` کالایی را «در راه» گزارش
   می‌کند که دفتر انبار می‌گوید رسیده. دو منبع، دو جواب.

### چرا حدس زدن بدتر از نساختن است

هر انتخاب اشتباه، **عدد اشتباه در منبع حقیقت موجودی** می‌نویسد — و برخلاف یک
باگ UI، موجودی غلط در `stock_movements` می‌ماند و با تعدیل دستی باید اصلاح
شود. طبق §۲۱ و G4 متوقف شد.

### آنچه هست و کار می‌کند

سند، هفت وضعیت، تأیید/لغو با ثبت actor هر مرحله، قفل رقابتی روی status، و
`stock_in_transit`. به‌محض تصمیم‌گیری، فقط دو شاخه‌ی `ship`/`receive` در
`transfer.service.ts` باز می‌شوند.

---

## 🛑 L0.1 — Currency Master List: STOP CONDITION

اسپک خواست جدول `currencies` با ~۱۸۰ کد ISO 4217 ساخته شود، چون
«کاربر نمی‌تواند ارز دیگری انتخاب کند». **ساخته نشد.**

### چرا — این هاردکدِ باقی‌مانده نیست، یک Policy تست‌شده است

`packages/formatting/src/__tests__/currency-policy.test.ts` یک سیاست
شماره‌گذاری‌شده است («STAGE 4 §8/§9») که:

- دقیقاً همان `z.enum(['AFN','USD','PKR','IRR'])` را pin می‌کند،
- غیبت یک ارزِ غیرفعال مشخص را در **هفت فایل** assert می‌کند
  (schema, store slice, hook وب, drizzle schema, انتخابگر موبایل و دسکتاپ),
- و §9 صراحتاً می‌گوید کد ناشناخته باید `undefined` بدهد، **نه** اینکه
  precision ارز دیگری را قرض بگیرد.

### مانع فنی (نه فقط سیاستی)

`FRACTION_DIGITS` در `@hisabche/formatting` دقیقاً همین چهار ارز را می‌شناسد.
افزودن ارز بدون گسترش آن یعنی پولی که **هیچ قرارداد precision ندارد** —
`formatAmount` برای آن کد جواب تعریف‌نشده می‌دهد. یعنی افزودن جدول به‌تنهایی
مبلغ‌های غلط تولید می‌کند، نه صرفاً گزینه‌ی بیشتر.

### اگر تصمیم گرفته شد اضافه شود، این‌ها **با هم** باید عوض شوند

1. `packages/validation/src/schemas/common.schema.ts` → `currencyCodeSchema`
2. `packages/store/src/slices/currency.slice.ts` → `type CurrencyCode`
3. `packages/ui/src/hooks/dashboard/use-currency.ts` → `type CurrencyCode` + نشانه‌ها
4. `packages/formatting/src/money.ts` → `FRACTION_DIGITS` + `CURRENCY_SIGN`
5. `apps/mobile/.../settings-screen.tsx` و `apps/desktop/.../settings-page.tsx`
6. `backend/src/drizzle-schema.ts`
7. **و خودِ `currency-policy.test.ts`** — چون سیاست عوض شده، نه اینکه تست خراب باشد

نکته‌ی طراحی: به‌جای enum ۱۸۰تایی، `currencies` به‌عنوان جدول + یک
`decimal_places` که `FRACTION_DIGITS` از آن پر شود. ولی این یک **تصمیم محصولی**
است، نه ریفکتور.

### آنچه به‌جایش انجام شد

- **L0.2 کامل شد** — جدول `units` با گرم/کیلوگرم/تن (درخواست بازار آهن) و
  ضرایب تبدیل درست. هیچ سیاستی واحدها را محدود نمی‌کرد.
- قاعده‌ی precision که در **۵ فایل** به‌صورت `currency === 'USD' ? 2 : 0`
  تکرار شده بود، به یک `currencyPrecision` واحد جمع شد — و یک گارد تازه در
  `currency-policy.test.ts` آن را با `FRACTION_DIGITS` هم‌خط نگه می‌دارد.

---

## 🛑 M2 — فروش آفلاین فقط «سرِ فاکتور» است: STOP CONDITION

هنگام ساخت M2 معلوم شد سناریوی اسپک از مسیر آفلاین **اصلاً ممکن نیست** — و
دلیلش از خود سناریو بزرگ‌تر است.

### زنجیره‌ی واقعی

`packages/sync/src/http-transport.ts` نوشته‌های آفلاین را به `/sync/push`
می‌فرستد. `sync.service.execute()` **مستقیم در جدول insert می‌کند**:

- هرگز `InvoiceService` را صدا نمی‌زند
- `WRITABLE.invoice` هیچ `items` ندارد → هیچ سطر `invoice_items` نوشته نمی‌شود
- `stock_movements` در کل فایل **صفر بار** ظاهر می‌شود

یعنی یک فروش آفلاین به‌صورت **سرِ فاکتور و هیچ چیز دیگر** sync می‌شود:
مبلغ دارد، مشتری دارد، ولی خط ندارد، انبار را تکان نمی‌دهد، لایه‌ی بها مصرف
نمی‌کند، و سند حسابداری نمی‌زند.

در مطالبات هست و در هیچ زیرسیستم دیگری نیست.

### چرا اصلاح نکردم

عبور مسیر sync از `InvoiceService.create` جواب درست است و **کوچک نیست**: آن
متد گیت تأیید (G6)، زنجیره‌ی costing، ثبت دفتر و resolve شعبه را اجرا می‌کند،
و با idempotency خودِ sync و با `pickWritable` تداخل دارد. انجامش در حاشیه،
همان‌جایی است که پول خراب می‌شود.

وضعیت با `offline-invoice-gap.test.ts` **pin** شد: اگر کسی sync را از سرویس
عبور دهد، آن تست‌ها قرمز می‌شوند و تغییر را عمدی می‌کنند.

### آنچه از M2 ساخته شد و کار می‌کند

| بند                                      | وضعیت                    |
| ---------------------------------------- | ------------------------ |
| M2.1 هر دو فروش ثبت می‌شوند              | ✅ (مسیر آنلاین)         |
| M2.2 تعارض `negative_stock` ساخته می‌شود | ✅                       |
| M2.3 در `/conflicts` دیده می‌شود         | ✅ (همان جدول و همان UI) |
| M2.4 چهار ممنوعیت                        | ✅ گارد دارد             |
| M2.5 Idempotency                         | ✅ از قبل محکم بود       |

تشخیص روی **مسیر آنلاین** وصل شد، جایی که انبار واقعاً حرکت می‌کند، و برای
مسیر آفلاین آماده است به‌محض اینکه آن مسیر انبار را تکان دهد.

### سه راه‌حلِ تعارض — و اینکه فقط یکی وجود دارد

| راه‌حل             | وضعیت                                    |
| ------------------ | ---------------------------------------- |
| `inventory_adjust` | ✅ موجود — Cycle Count فاز L2            |
| `refund_sale`      | ⛔ Credit Note ساخته نشده (J3.4)         |
| `replenish`        | ⛔ `/purchasing` فرم ایجاد ندارد (گپ ۱۱) |

هر سه در رکورد تعارض **نام برده می‌شوند به‌همراه اینکه کدام قابل اجراست** —
سه دکمه که یکی کار کند همان تئاتری است که G1 منع می‌کند.

---

## 🛑 M4 — تأیید تخفیف: ساخته نشد

اسپک: «اگر Threshold در Policy موجود نیست، Setting جدید نساز مگر محصول قبلاً
تعریف کرده باشد.»

`grep -rn "discountThreshold|discount_threshold|maxDiscount" src` → **صفر
نتیجه**. هیچ آستانه‌ی تخفیفی در هیچ‌کجای محصول تعریف نشده.

پس ساختن Setting برای سیاستی که وجود ندارد، همان G4 است. Approval Engine از
قبل هست و آماده است؛ به‌محض اینکه آستانه تعریف شود، فقط یک شرط به
`routeForApproval` اضافه می‌شود.

---

## 🛑 N2 — OCR: OUT OF SCOPE

اسپک خودش گفته: «فقط در صورت وجود Storage + Job Queue + OCR Provider +
Security model. اگر Provider آماده نیست: `OUT OF SCOPE` — سرویس جعلی نساز.»

هیچ‌کدام از چهار پیش‌نیاز وجود ندارد. ساخته نشد.

---

## نکات پیاده‌سازی که سشن بعدی باید بداند

### فازهای اخیر — کجا چه چیزی است

| فاز   | دامنه (خالص)                                       | سرویس                                | روت                               | Migration    |
| ----- | -------------------------------------------------- | ------------------------------------ | --------------------------------- | ------------ |
| L1    | `inventory/unit-conversion.domain.ts`              | داخل `invoice.service`               | —                                 | `phase-l-02` |
| L2    | `inventory-costing/stock-count.domain.ts` (از قبل) | `inventory/cycle-count.service.ts`   | `cycle-count.routes.ts`           | `phase-l-03` |
| L3/L4 | `inventory/reorder.domain.ts`                      | `inventory/reorder.service.ts`       | `inventory-insights.routes.ts`    | —            |
| M2    | `pos/negative-stock.domain.ts`                     | `conflict.service.recordStockBreach` | —                                 | —            |
| M3    | —                                                  | `pos.service.sessionHistory`         | `pos.routes` `/sessions/history`  | `phase-m-01` |
| N1    | `banking/match-learning.domain.ts`                 | داخل `banking.service.suggest`       | —                                 | `phase-n-01` |
| N3/N4 | `intelligence/forecast.domain.ts`                  | `intelligence/forecast.service.ts`   | `intelligence-forecast.routes.ts` | —            |

### گاردهای تازه (همه با تزریق باگ تست شده‌اند)

- `sod-rule-coverage` — هر قانون SoD در **محل واقعی فراخوانی** وصل باشد
- `outstanding-predicate` — قاعده‌ی «هنوز بدهکار» در KPI و لیست یکی باشد
- `accounting-drilldown` (در `packages/ui`) — پنجره‌ی زمانی هر گزارش درست باشد
- `stock-movement-provenance` — هر حرکت انبار `reference_id` داشته باشد
- `workspace-backup` — پشتیبان واقعاً داده داشته باشد و workspace-scoped باشد
- `uom-service-side-guard` — تبدیل واحد در **سرویس** باشد نه UI
- `cycle-count-guard` — شمارش هرگز `products.quantity` را مستقیم ننویسد
- `valuation-consistency` — tripwire: تا وقتی Transfer لایه جابه‌جا نمی‌کند،
  هیچ‌چیز حق ندارد لایه را per-warehouse مصرف کند
- `offline-invoice-gap` — **وضعیت pin شده**: sync نباید انبار را تکان دهد تا
  وقتی costing/ledger/approval هم با آن حرکت کنند

### الگویی که ۷ بار تکرار شد

**G5، G8، J1، K1، G6.3، G4، M1** — کار فاز از قبل انجام شده بود، یا زیرساخت
آماده بود و فقط UI/سیم‌کشی به آن نمی‌رسید. حدود **یک‌سوم** کل کار.

**اولین قدم هر فاز: `ls` + `grep` روی همان ناحیه.**
