# HISABCHE V64 — از «ثبت صنف» تا «قابل فروش»: پرامپت اجرایی

> **هدف V64:** بعد از این نسخه، محصول را برای اصنافی که واقعاً پشتیبانی می‌کند **بفروشیم** — و برای
> بقیه صادقانه بگوییم «هنوز نه». V64 قابلیت تازه‌ی پراکنده نمی‌سازد؛ مسیر کاربر را از ثبت‌نام تا
> اولین عملیات مالی و عملیاتی، **برای هر صنف**، بی‌بن‌بست و با داده‌ی درست می‌کند، و هر ادعا را با
> اجرای واقعی ثابت می‌کند.
>
> نوشته‌شده ۱۲ نوامبر ۲۰۲۶، از ممیزی بیرونی روی commit `7d411d39` («fixed ci 18») که **با کد همین
> مخزن تطبیق داده شد**. هر عدد این سند با فرمانی که آن را ساخته آمده است.

---

## ۰. قانون‌های ثابت (قبل از هر کار بخوان؛ هیچ‌کدام قابل‌مذاکره نیست)

1. `AGENTS.md` و `CLAUDE.md` مرجع‌اند. مهارت `hisabche-session-rules` را اول بخوان.
2. **هیچ DDL روی Supabase زنده.** فقط `docs/<name>-NN-migration.sql` (additive، idempotent، با بلوک
   Rollback) + `docs/VERIFY-<name>-NN.sql` + `backend/src/__tests__/<name>-NN.pg.test.ts` که migration
   را **دو بار** روی Postgres واقعی اجرا کند. وضعیت: `PENDING HUMAN CONFIRMATION`.
3. **موتور موازی ممنوع (G2).** ۲۰ موتور در `ENGINES` (`packages/validation/src/schemas/business-capabilities.ts`)
   هست. قبل از هر فایل تازه: `pnpm code-intel symbol find` و گراف. «گسترش» قبل از «ساختن».
4. **بدون UI theater (G1)، بدون backfill حدسی (§12)، «نامعلوم» صفر نیست.**
5. `workspace_id` تنها مرز امنیتی؛ پول integer؛ نوشتن چندجدولی = تابع Postgres + `.rpc()`.
6. هر کلید i18n در `fa`، `af` (واژه‌نامه‌ی دری: «بل»، «اسعار»، «کوشش»، «عواید»، «نماینده‌گی») و `en`.
7. بدون `any`، `@ts-ignore`، `eslint-disable`. هیچ گاردی شل نمی‌شود؛ گاردِ فهرست‌بسته با **دلیل تاریخ‌دار** ویرایش می‌شود.
8. commit و push با صاحب پروژه است. بیلد فقط در پایان. subagent نساز.
9. وضعیت‌های مجاز گزارش: `VERIFIED_COMPLETE` · `IMPLEMENTED_NOT_LIVE_VERIFIED` ·
   `BLOCKED_EXTERNAL_CREDENTIAL` · `BLOCKED_BY_EXISTING_SYSTEM` · `NOT_APPLICABLE` · `FAILED` ·
   `NEEDS_OWNER_DECISION`. بدون HTTP واقعی یا دیتابیس واقعی هیچ چیز `VERIFIED_COMPLETE` نیست.

---

## ۱. وضعیت تأییدشده (ممیزی بیرونی × کد، ۱۲ نوامبر)

### ۱.۱ آنچه ممیزی گفت و در کد درست بود

| #   | ادعای ممیزی                                                                | شاهد در کد                                                                                                                                               | درست؟ |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| A1  | ۶۷ صنف ثبت‌شده، ۳۷ پروفایل‌شده، ۱۳ `workflowComplete`                      | `docs/architecture/universal-core/INDUSTRY-SUPPORT-LEVELS.csv` (شمارش با awk)                                                                            | ✅    |
| A2  | First Value Checklist فقط ۴ archetype دارد و بقیه به Retail می‌روند        | `first-value-checklist.tsx:41` — `archetypeHint \|\| 'RETAIL_STORE'` و `default:` زیر `RETAIL_STORE`                                                     | ✅    |
| A3  | DNA فقط از صنف اصلی ساخته می‌شود                                           | `onboarding-container.tsx:206` — `inferOperationalDna({ tradeKey: primaryTrade, ... })`                                                                  | ✅    |
| A4  | صنف اصلی انتخاب صریح کاربر نیست                                            | `primaryIndustryKeyOf` (`industry-profiles.ts:541`) — `explicitPrimary` دارد، ولی آنبوردینگ آن را از کاربر نمی‌پرسد؛ اولین صنفِ غیر «مدل فروش» برنده است | ✅    |
| A5  | `locations` فقط `MULTI_BRANCH` می‌سازد؛ «چند انبار» از «چند شعبه» جدا نیست | `operational-dna.ts:753`                                                                                                                                 | ✅    |
| A6  | مرحله‌ی «اندازه فروشگاه» برای خدمات/حمل/آموزش نامناسب است                  | `onboarding-page.tsx` — `storeSize` / `storeSizeLabel`                                                                                                   | ✅    |
| A7  | `acceptance-results.json` مال commit قدیمی است                             | `docs/architecture/industry/acceptance-results.json` → `0b68fe4…`                                                                                        | ✅    |
| A8  | تست‌های خانواده FakeDatabase دارند، نه Postgres و مرورگر                   | `v60-http-families.test.ts`، `http-e2e-business-day.test.ts`                                                                                             | ✅    |

### ۱.۲ آنچه همین امروز (۱۲ نوامبر) درست شد — دوباره نساز

| مورد                         | چه بود                                                                                                                                      | چه شد                                                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ناهماهنگی رجیستری (ممیزی §۴) | `LIFECYCLE_ACTIONS_UNWIRED`، `GRANT_ENDPOINT_UNWIRED`، `DELIVERY_NOTES_UI_UNWIRED`، `FLEET_DISPATCH_UI_UNWIRED` با اینکه UI وصل بود         | حذف شدند؛ `package_credits` → `GRANT_ONLINE_ONLY`                                                                                                                                                        |
| خلاصه‌ی ترکیب در آنبوردینگ   | کلید خام روی صفحه (`capabilities.x.label`، `…limitation.0`، `…questions.x.title`، `…gaps.REGULATED_…`، `nav.overview`)؛ همه‌ی سؤال‌ها «باز» | `labelKey` رجیستری، `capabilities.limitations.<CODE>`، `setupGapMessageKey` (camelCase)، منوی واقعی منهای `suggestedHiddenMenuPaths`؛ فقط سؤال بی‌جواب. گارد: `onboarding-plan-has-no-raw-keys.test.tsx` |
| سود به تفکیک پروژه/شعبه      | route بی‌صفحه؛ «سود خالص» = ناخالص                                                                                                          | `CostObjectProfitSection`؛ خالص `null` تا قاعده‌ی سربار؛ فروش بی‌برچسب شمرده می‌شود                                                                                                                      |
| تعویض کالا (exchange)        | بدنه‌ی چک‌نشده، دلیل ثابت، «نقد» با پرداخت صفر، بدون کلید idempotency                                                                       | `invoiceExchangeSchema`؛ کلید اجباری. **UI هنوز نیست** (کار V64، بند ۵.۸)                                                                                                                                |
| برگشت دارایی اجاره           | وضعیت سریالی که دیتابیس رد می‌کند و خطای بلعیده                                                                                             | `leaseReturnSerialStatus`؛ خطاها پرتاب می‌شوند                                                                                                                                                           |
| بیلد اندروید                 | `node:crypto` در `local-engine`                                                                                                             | `newId()`؛ گارد `no-node-builtins-on-device.test.ts`                                                                                                                                                     |
| دیپلوی Render                | `drizzle-kit generate` روی فایلِ حذف‌شده                                                                                                    | مرحله حذف شد؛ گارد `render-build-steps.test.ts`                                                                                                                                                          |

جزئیات: `docs/architecture/V60-IMPLEMENTATION-PROGRESS.md` §13.

### ۱.۳ نقشه‌ی اصناف (از CSV)

- **workflowComplete (۱۳):** retail · wholesale · supermarket · gold · exchange · clothing · mobile ·
  manufacturing · barber · beauty · courier · repair · consulting
- **پروفایل‌شده ولی نه کامل (۲۴):** bakery · restaurant · cafe · spices · watches · fabric · fabricRoll ·
  shoes · tailoring · computers · computerComponents · electronics · itServices · hardware ·
  buildingMaterials · timber · autoParts · carDealer · mechanic · fuel · pharmacy · clinic · education · wedding
- **بی‌پروفایل (۳۰):** butcher · fruitVegetable · dairy · nuts · carpet · paint · glass · construction ·
  furniture · kitchenware · homeAppliances · stationery · toys · giftShop · cosmetics · optician ·
  agriculture · livestock · seedsFertilizer · flowers · transport · freightTransport · passengerTransport ·
  travelAgency · realEstate · printing · photography · laundry · security · other

---

## ۲. تعریف «قابل فروش» برای یک صنف (معیار پذیرش V64)

یک صنف فقط وقتی `SELLABLE` است که **همه‌ی** این‌ها برایش با اجرای واقعی ثابت شده باشد:

1. **ثبت‌نام → workspace:** حساب، workspace با `workspace_create_with_owner`، ارز دفاتر ذخیره‌شده.
2. **آنبوردینگ:** پرسش‌هایی که به همان مدل کار می‌خورد؛ DNA از **همه‌ی** صنف‌های انتخاب‌شده؛ صنف اصلی را کاربر گفته.
3. **اولین ارزش:** چک‌لیست از DNA ساخته می‌شود، هر قدم به صفحه‌ای می‌رود که برای این کسب‌وکار باز و بی‌قفل است.
4. **عملیات روزانه:** ثبت سند اصلی صنف (فروش/جلسه/تعمیر/سفارش/…) → دریافت پول → اثر در موجودی یا منبع → سند دفتر.
5. **گزارش:** سود (با «نامعلوم» صریح)، مانده‌ی طرف حساب به تفکیک ارز، موجودی/ظرفیت.
6. **آفلاین:** هر عمل یا روی دستگاه کار می‌کند یا `<OfflineGate>` صریح «اینترنت لازم است» می‌گوید (ماتریس).
7. **برگشت:** لغو/مرجوعی همان سند، مانده‌ها را برمی‌گرداند (`reverse-*.test.ts`).
8. **اثبات:** یک تست زنجیره‌ای روی **Postgres واقعی** + یک سناریوی مرورگر (Playwright) روی بیلد وب؛
   نتیجه در `acceptance-results.json` با **همان commit** که منتشر می‌شود.
9. **ادعا:** لندینگ، راهنما و متن آنبوردینگ برای این صنف فقط چیزی می‌گویند که ۱–۸ ثابت کرده (`landing-claims.test.ts`).

صنفی که به این نرسد `NOT_YET_SELLABLE` است و آنبوردینگ برایش **همین را** می‌گوید (بند ۵.۷).

---

## ۳. فاز ۰ — پیش‌پرواز (بدون تغییر کد)

1. `git status --short`، `pnpm code-intel status`، `node scripts/build-ai-index.mjs`.
2. وریفای کامل روی HEAD (tsc ۱۰ پکیج، همه‌ی سوئیت‌ها **پشت سر هم**). عددها را ثبت کن.
3. `node scripts/audit-unwired-routes.mjs` و یک اسکن «هوک بی‌مصرف‌کننده‌ی UI» (هر `export function use*`
   در `packages/api/src/hooks` که در `packages/ui|app-shell` فراخوان ندارد). امروز این‌ها بی‌مصرف‌اند:
   `useExchangeInvoice` (UI ندارد)، `useSalesOrder`، `useSerialHolds`، هوک‌های وظیفه‌ی پروژه
   (`useProjectTasks`، `useCreateProject`، …). برای هر کدام: وصل کن یا با دلیل در دفتر `unwired-capability` بنویس.
4. خروجی: `docs/architecture/V64-PREFLIGHT.md` با جدول بالا + عددها. **هیچ ادعایی از گزارش‌های V60–V63 را بدون اجرای خودت تکرار نکن.**

---

## ۴. فاز ۱ — یک منبع حقیقت (رجیستری = کد)

**مسئله:** رجیستری می‌گفت «UI وصل نیست» وقتی وصل بود؛ آنبوردینگ همان را به مشتری نشان داد.

1. اسکریپت `scripts/capability/wiring-matrix.mjs`: برای هر `ENGINES[k]` و هر `CAPABILITIES[k]`،
   `service` / `localEngine` / `clientHook` / `uiHost` / ردیف ماتریس آفلاین را **از دیسک** بخواند و
   `docs/architecture/universal-core/ENGINE-WIRING.csv` بسازد (کنار `capability-matrix.csv`، همان الگو).
2. گارد `capability-claims-match-code.test.ts`:
   - هر کد limitation که `UNWIRED` یا `UI_` دارد ⇒ هوک نام‌برده واقعاً بی‌مصرف‌کننده باشد؛ وگرنه قرمز.
   - هر `partial` ⇒ دست‌کم یک limitation؛ هر `available` ⇒ هیچ limitation و ردیف آفلاین `available`.
   - هر limitation ⇒ متن در هر سه زبان (`capabilities.limitations.<CODE>`).
   - injection-test: یک limitation کهنه را برگردان و قرمز شدن را ببین.
3. `industry-coverage-table.test.ts` و `INDUSTRY-SUPPORT-LEVELS.csv` همین داده را بخوانند — نه فهرست دستی.

---

## ۵. فاز ۲ — مسیر کاربر

### ۵.۱ آنبوردینگ بر اساس «مدل کار»، نه «اندازه فروشگاه» (A6)

- مرحله‌ی `storeSize` به «مقیاس کار» تبدیل شود: تعداد نفرات (تنها / ۲–۵ / ۶–۲۰ / بیشتر) — همان
  پاسخ به `hasStaff` و `staffArrangement` نگاشت شود، **نه** سؤال دوم کنارش. برچسب از DNA می‌آید
  («فروشگاه» فقط وقتی `inventory` دارد؛ «دفتر/کارگاه/مرکز» برای بقیه — `TerminologyProfile`).
- **سؤال مکان دو سؤال شود (A5):** `branches` (یک / چند شعبه یا نقطه‌ی فروش) و `warehouses`
  (هیچ / یک / چند انبار). نگاشت: `MULTI_BRANCH` و یک توپولوژی **موجود یا تازه در همان enum**
  برای چند انبار — قبل از افزودن، `OperationalTopology` را بخوان. پاسخ قدیمی `locations` همچنان
  خوانده شود (سازگاری؛ `effectiveDnaAxes` الگوست). اسکیمای JSONB نسخه‌دار است — migration لازم نیست،
  ولی SQLite (`local_workspace.operational_dna`) و round-trip را تست کن.
- **بعد از DNA، «راه‌اندازی اول» اختیاری و از همان هسته:** اگر `warehouses = multiple` ⇒ فرم ساخت
  انبارها (همان `WarehouseService`)؛ اگر `branches = multiple` ⇒ شعبه‌ها (`branches`)؛ اگر خدمات
  نوبتی ⇒ اولین منبع/خدمت (`SalonService` / `service_resources`). **فرم دوم نساز**؛ کامپوننت‌های
  موجود را در یک مرحله‌ی قابل‌ردکردن mount کن. ردکردن = هیچ داده‌ی ساختگی.
- نقش‌ها و تأیید: سؤال `needsApprovals` ⇒ پیشنهاد الگوی گردش تأیید **موجود** (`/approvals`، یک موتور — V61)؛ نساختن خودکار.

### ۵.۲ چندصنفی = یک مدل (A3، A4)

- آنبوردینگ بعد از انتخاب چند صنف **صنف اصلی را بپرسد** (پیش‌فرض: پیشنهاد `primaryIndustryKeyOf`)
  و در workspace ذخیره کند (ستون/فیلد موجود را بگرد: `primary_trade` / `business_profile`؛ اگر نیست
  migration additive).
- `inferOperationalDna` ورودی `tradeKeys: string[]` بگیرد و DNA را **اجتماع** محورها بسازد
  (`offering`، `inventory`، `intake`، … همه آرایه‌اند). `resolveBusinessProfile` و DNA و پیشنهاد
  پاسخ‌ها (`suggestedOperatingAnswers`) **یک** ورودی بخوانند. صنف اصلی فقط برای واژه‌ها و ترتیب منو.
- گارد: برای ۱۰ ترکیب (retail+wholesale، retail+repair، cafe+bakery، mobile+repair، …) پروفایل و DNA
  یک تصویر بدهند (هر ماژول فعال در پروفایل، در DNA هم دلیل داشته باشد و برعکس).

### ۵.۳ First Value Checklist از DNA، نه از ۴ archetype (A2)

- قدم‌ها از **محورهای DNA** ساخته شوند، در یک تابع خالص در `packages/validation`
  (`firstValueSteps(dna, plan)`): `offering` (کالا/خدمت/پروژه/اجاره)، `inventory`، `intake`
  (نوبت/تیکت/سفارش/فروش مستقیم)، `settlement` (نقد/نسیه/قسط/قرارداد).
- **هیچ fallback به Retail.** `GENERIC_BUSINESS` یا DNA نامعلوم ⇒ «مشتری اول، اولین سند فروش خدمت/کالا،
  اولین دریافت» — بدون «ساخت کالا در انبار» وقتی `inventory = NONE`.
- هر قدم نشانیِ **هاب** دارد (`/accounting?tab=…`، نه route قدیمی)، از `isRouteDenied`/`isNavLocked` رد می‌شود،
  و «انجام شد» را از داده‌ی واقعی می‌خواند (همان‌طور که امروز برای ۴ archetype می‌خواند).
- گارد ماتریسی: برای **هر** ۶۷ صنف + `other`: قدم‌ها وجود دارند، هر `href` route واقعی دارد، و برای
  DNA بدون موجودی هیچ قدمی به `/warehouse` نمی‌رود.

### ۵.۴ منو و داشبورد از همان ترکیب

- منوی پیشنهادی آنبوردینگ = منوی واقعی (`suggestedHiddenMenuPaths`) — امروز وصل شد؛ داشبورد (`emphasizedWidgets`،
  `OwnerCommandCenter`) هم فقط از `composeBusinessSolution` بخواند. گارد: هر ویجت/قدم/مورد منو در یک صنف،
  قابلیتش در `plan` همان صنف `available|partial` باشد.

### ۵.۵ پروفایل ۳۰ صنف بی‌پروفایل — بدون موتور تازه

- برای هر کدام فقط `INDUSTRY_PROFILES` + پاسخ پیشنهادی + واژه‌ها، **با قابلیت‌های موجود**. نمونه:
  butcher/fruitVegetable/nuts/dairy = وزن (`weight_pricing`) + انقضا؛ carpet/glass = مساحت
  (بعد از ۵.۶)؛ laundry/printing/photography = تیکت کار (`work_queue_sla`)؛ transport/freight = `fleet_dispatch`؛
  realEstate/travelAgency/security = خدمات + قرارداد (`contracts_recurring`).
- هر صنفی که سند اصلی‌اش موتور ندارد (agriculture، livestock، seedsFertilizer اگر کشت می‌خواهد)
  پروفایل «فروشگاه نهاده» بگیرد **یا** `NOT_YET_SELLABLE` بماند — `NEEDS_OWNER_DECISION`.

### ۵.۶ کامل‌کردن «partial» هایی که مانع فروش یک صنف پروفایل‌شده‌اند — با دامنه‌ی موجود

| صنف                            | قابلیت                                  | چه چیزی هست                                              | کار V64                                                                                                                        |
| ------------------------------ | --------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| gold                           | `gold_purity`، `making_charges`         | `goldLineSnapshotSchema` روی خط، تابلوی نرخ              | قیمت خط = وزن × نرخ عیار + اجرت، در `computeItemTotal` یا یک تابع دامنه‌ی موجود؛ سرور همان را می‌سازد؛ فاکتورساز فقط پیش‌نمایش |
| fabric/fabricRoll/carpet/glass | `area_pricing`، `roll_cutting`          | `area-dimension.domain.ts`، `roll-batch.domain.ts`       | انتخابگر خط فاکتور + مسیر سرور؛ ضایعات برش به‌عنوان حرکت موجودی جدا (نه کم‌شدن بی‌صدا)                                         |
| restaurant/cafe/bakery         | `table_service` (planned)، `recipe_bom` | BOM و تولید (`manufacturing_*`)                          | **NEEDS_OWNER_DECISION:** فروش رستوران بدون میز (صندوق + مواد اولیه از BOM) قابل فروش است؛ میز/آشپزخانه موتور تازه است         |
| wedding/rental                 | `asset_rental` (planned)                | `contracts-01` (قرارداد، ودیعه، برگشت دارایی، رزرو منبع) | اجاره = قرارداد + `resource_bookings`، بدون موتور سوم؛ ودیعه پرداخت واقعی (`PaymentsService`)، نه فقط ستون                     |
| hotel                          | `room_nights` (planned)                 | `resource_capacity` + قرارداد                            | **NEEDS_OWNER_DECISION** — هتل را تا تصمیم نفروش                                                                               |
| clinic/pharmacy                | `REGULATED_DOMAIN_COMPLIANCE`           | گپ صریح                                                  | پرونده‌ی پزشکی ساخته **نمی‌شود**؛ کلینیک = نوبت + خدمت + فاکتور، با جمله‌ی صریح در آنبوردینگ                                   |

### ۵.۷ صداقت برای صنف ناآماده

- آنبوردینگ برای صنف `NOT_YET_SELLABLE` یک جمله‌ی روشن نشان دهد («برای این صنف، X و Y آماده است؛ Z هنوز نه»)
  — از همان رجیستری، نه متن دستی. لندینگ و سایت‌مپ صفحه‌ی صنفِ ناآماده را «پشتیبانی کامل» نخوانند.

### ۵.۸ صفحه‌ی تعویض کالا (exchange)

- route و schema امروز امن شدند؛ UI نیست. تعویض داخل همان `InvoiceReturnsDialog` (نه دیالوگ دوم):
  هر ردیف برگشتی با `productId` می‌تواند «تعویض با مدل دیگر» (`useProductVariants`) بگیرد؛ با هر
  جایگزین، فرم از `useExchangeInvoice` می‌رود؛ استرداد نقدی و کسورات در این حالت بسته‌اند.
  `display.items` باید `productId` را برساند (امروز نمی‌رساند).

---

## ۶. فاز ۳ — اثبات واقعی (A7، A8)

1. **Postgres واقعی:** همه‌ی `*.pg.test.ts` در CI لینوکس (روی این ویندوز `initdb.exe` نیست — `BLOCKED`
   محلی، نه «سبز»). یک workflow GitHub Actions برای `pnpm --filter backend vitest run --project pg`.
2. **تست زنجیره‌ای هر خانواده‌ی قابل فروش:** `backend/src/__tests__/journey-<family>.pg.test.ts` —
   `buildServer()` + `inject` روی Postgres واقعی (نه FakeDatabase): ثبت‌نام → workspace → DNA →
   سند اصلی → پرداخت → گزارش → برگشت. خانواده‌ها: retail، wholesale، service-appointment (beauty)،
   repair-ticket، consulting/project، courier، gold، manufacturing، rental-contract.
3. **مرورگر:** Playwright روی `next build` + `next start` برای ۴ مسیر (retail، خدمات نوبتی، تعمیر، مشاوره):
   آنبوردینگ → چک‌لیست → اولین سند → گزارش. اسکرین‌شات در `docs/architecture/V64-EVIDENCE/`.
4. **`acceptance-results.json`** فقط از runner ساخته شود و `commit` و `ranAt` واقعی بنویسد. اسکریپت
   `scripts/release/check-acceptance-commit.mjs` در گیت انتشار: commit فایل = HEAD، وگرنه انتشار متوقف.
   (این را unit test نکن — بعد از هر commit قرمز می‌شود.)
5. **آفلاین:** برای هر خانواده‌ی قابل فروش، جدول «کدام عمل روی دستگاه، کدام آنلاین» از ماتریس —
   و یک تست که `OfflineGate` همان را می‌گوید. موتور محلی تازه برای Sales Orders / Projects / BOM / Contracts
   **ساخته نمی‌شود** مگر صاحب پروژه بخواهد؛ فروش با جمله‌ی صریح «این‌ها آنلاین‌اند».

---

## ۷. فاز ۴ — آمادگی فروش

1. `docs/sales/SELLABLE-INDUSTRIES.md`: برای هر صنف `SELLABLE` — چه کار می‌کند، چه نمی‌کند، چه آنلاین است.
   فقط از شواهد فاز ۳. (عامل‌های `sales-product-analyst` و `sales-script-writer` همین را می‌خوانند.)
2. لندینگ/FAQ/راهنما: هر ادعا در `landing-claims.test.ts`؛ صفحه‌ی صنف ناآماده «پشتیبانی کامل» نمی‌گوید.
3. راهنمای عمومی (`DOCS_ARTICLES`) برای اولین روز کار هر خانواده‌ی قابل فروش، با لینک از `ROUTE_DOCS_MAP`.
4. فهرست migration های منتظر اجرا (V60–V64) با ترتیب و VERIFY — یک جدول برای صاحب پروژه.
5. بیلدها در پایان: وب، ویندوز (`-c.electronDist`)، اندروید (`pnpm run android:release`، تاریخ APK بعد از آخرین تغییر).

---

## ۸. خارج از دامنه‌ی V64 (نساز)

- موتور میز رستوران، هتل، پرونده‌ی پزشکی، کشت و دام — تا تصمیم صاحب پروژه.
- درگاه پرداخت محلی (تصمیم باز V61؛ HesabPay در برابر …).
- هر جدول/سرویس/هوک دومی کنار موجود؛ هر «ماژول» تازه برای پرکردن جدول قابلیت‌ها.
- تغییر روی دیتابیس زنده.

---

## ۹. ترتیب کار و شکل گزارش

ترتیب: فاز ۰ → ۱ → ۲ (۵.۲ قبل از ۵.۳، چون چک‌لیست از DNA ترکیبی می‌خواند) → ۳ → ۴ → وریفای کامل →
eslint فایل‌های تغییرکرده (از پوشه‌ی هر پکیج) → بیلدها → درس‌ها در `.claude/lessons-learned.md` و
`CLAUDE.md` → گزارش.

گزارش نهایی (فارسی، جدول، عدد واقعی):

| صنف | ثبت | پروفایل | مسیر Postgres | مسیر مرورگر | آفلاین | وضعیت فروش |
| --- | --- | ------- | ------------- | ----------- | ------ | ---------- |

و برای هر کار: وضعیت از فهرست §۰.۹، فرمانی که آن را ثابت کرد، و آنچه انسان باید اجرا کند.
