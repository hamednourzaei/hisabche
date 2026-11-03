# LEGACY DOCUMENT RECONCILIATION — Phase 1.1 (Task B)

READ-ONLY. هیچ سند معماری قدیمی ویرایش نشد؛ این فایل تنها نتیجه‌ی تطبیق است.
برچسب‌های ادعا: `CURRENTLY_TRUE` · `PARTIALLY_TRUE` · `IMPLEMENTED_DIFFERENTLY` · `STALE` · `CONTRADICTED_BY_CODE` · `UNVERIFIED`.
هر ردیف شاهد `file:line` یا نتیجه‌ی اسکریپت دارد؛ بدون شاهد → `UNVERIFIED`.

## 1. Scope

- ۱۵ سند در `docs/architecture/universal-core/` و ۱۲ سند در `docs/architecture/industry/` (`ls` در ۳ نوامبر ۲۰۲۶).
- آخرین کامیت همه‌ی آن‌ها: ۲۷ اکتبر ۲۰۲۶ (`git log -1 -- <file>`)، به‌جز `INDUSTRY-COVERAGE-TABLE.md` (۳ نوامبر). مبنای ادعاهای آن‌ها HEAD `41031ed2` و تاریخ ۲۶ اکتبر است؛ بسته‌ی `universal-core` بعد از آن ساخته شد → بخش بزرگی از سندها «قبل از بسته» نوشته شده.
- منبع حقیقت: کد فعلی مخزن.

## 2. Documents Audited

| #   | سند                                                                                                                                                                                                 | نوع                            | تعداد ادعای تطبیق‌داده‌شده                                                                                                                                                                                                    | نتیجه کلی                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `universal-core/README.md`                                                                                                                                                                          | راهنمای خواندن                 | 2                                                                                                                                                                                                                             | PARTIALLY_TRUE (دستور generator الان `--check` را رد می‌کند)                                                                               |
| 2   | `universal-core/UNIVERSAL-CORE-GAP-ANALYSIS.md`                                                                                                                                                     | تحلیل شکاف (G-01…17)           | 17                                                                                                                                                                                                                            | بیشتر STALE (بسته شده/جابه‌جا شده)                                                                                                         |
| 3   | `universal-core/CORE-INVENTORY.md`                                                                                                                                                                  | موجودی مخزن                    | 10                                                                                                                                                                                                                            | ۵ ادعا STALE، ۵ ادعا هنوز درست                                                                                                             |
| 4   | `universal-core/CORE-BOUNDARIES.md`                                                                                                                                                                 | مرزها                          | 2                                                                                                                                                                                                                             | CURRENTLY_TRUE (قاعده‌ی «هسته نام صنف نمی‌برد» با گارد)                                                                                    |
| 5   | `universal-core/INDUSTRY-COVERAGE-TABLE.md` + `.csv`                                                                                                                                                | ماتریس ۱۱۸ ردیف                | 118 ردیف                                                                                                                                                                                                                      | شمار درست؛ برچسب‌ها در ۳۰ ردیف بیش‌ادعا (§17)                                                                                              |
| 6   | `universal-core/FIFTY-OPTIONS-AUDIT.md`                                                                                                                                                             | ممیزی ۵۰ گزینه                 | 5                                                                                                                                                                                                                             | ۴ مورد CURRENTLY_TRUE؛ ۱ مورد PARTIALLY (#12)                                                                                              |
| 7   | `universal-core/FIFTY-OPTIONS-LOG.md`                                                                                                                                                               | لاگ اجرا                       | 50 از 50 ردیف                                                                                                                                                                                                                 | SUPPORTED 4 · SUPPORTED_WITH_LIMITATIONS 21 · NOT_YET_SUPPORTED 4 · CONTRADICTED 20 · UNVERIFIED 1 (جزئیات: Final Semantic Reconciliation) |
| 8   | `universal-core/MENU-DOMAIN-MAP.md`                                                                                                                                                                 | نقشه‌ی منو                     | 18 ادعا                                                                                                                                                                                                                       | TRUE 10 · PARTIAL 2 · STALE 4 · CONTRADICTED 1 · UNVERIFIED 1                                                                              |
| 9   | `universal-core/RANKING-MODEL.md`                                                                                                                                                                   | مدل رتبه‌بندی (مستند تولیدشده) | 16 ادعا                                                                                                                                                                                                                       | TRUE 11 · PARTIAL 2 · STALE 2 · CONTRADICTED 1                                                                                             |
| 10  | `universal-core/*-PROMPT.md` (۵ فایل)                                                                                                                                                               | دستورالعمل                     | 0                                                                                                                                                                                                                             | بدون ادعای معماری؛ `FIFTY-OPTIONS-IMPLEMENTATION-PROMPT.md` خودش SUPERSEDED است                                                            |
| 11  | `industry/INDUSTRY-SUPPORT-MATRIX.md`                                                                                                                                                               | رول‌آپ ۲۴ صنف                  | 24 ردیف                                                                                                                                                                                                                       | مشتق از #5؛ همان بیش‌ادعا                                                                                                                  |
| 12  | `industry/FINAL-RESULTS.md`                                                                                                                                                                         | نتیجه‌ی سه دور                 | 8                                                                                                                                                                                                                             | ۶ ادعا STALE                                                                                                                               |
| 13  | `industry/OPEN-QUESTIONS.md`                                                                                                                                                                        | تصمیم‌های باز                  | 4                                                                                                                                                                                                                             | ۳ مورد بسته شده، ۱ مورد جا افتاده                                                                                                          |
| 14  | `industry/TRACEABILITY.md`                                                                                                                                                                          | ظرفیت ← منبع ← تست             | 12 کلید                                                                                                                                                                                                                       | STALE (۴ کلید «planned» در سند ولی «available» در کد، و `auto_fitments` اصلاً نیست؛ ۱۳ کلید نه ۱۲)                                         |
| 15  | `industry/VERIFICATION-LOG.md`, `AUDIT.md`, `BASELINE.md`, `EVIDENCE.md`, `ADR-001-primary-industry.md`, `INDUSTRY-ONBOARDING-TAXONOMY.md`, `INDUSTRY-DIFFERENCES.md`, `industry-diff.generated.md` | گزارش/ADR/جدول                 | TAXONOMY: 13 ادعا (TRUE 11 · PARTIAL 1 · UNVERIFIED 1)؛ DIFFERENCES: 16 ادعا (TRUE 3 · PARTIAL 4 · STALE 6 · CONTRADICTED 1 · UNVERIFIED 2)؛ ADR CURRENTLY_TRUE؛ لاگ‌های تاریخی «لحظه‌ای»؛ `industry-diff.generated.md` STALE |

سندهای تاریخی (`VERIFICATION-LOG`, `BASELINE`, `AUDIT`, `EVIDENCE`) شرح یک لحظه‌اند، نه ادعای پایدار؛ فقط ادعاهای ماندگارشان تطبیق شد.

## 3. Universal Core Claims — شکاف‌های G-01…G-17 (`UNIVERSAL-CORE-GAP-ANALYSIS.md`)

| ID   | ادعای سند                                          | کلاس                    | شاهد فعلی                                                                                                                                   |
| ---- | -------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| G-01 | حمل‌ونقل/پیک/رول کلید onboarding ندارد             | STALE (بسته شد)         | `industry-profiles.ts:90-92` کلیدهای `freightTransport/passengerTransport/courier`                                                          |
| G-02 | پروفایل generic یادداشتی ندارد                     | STALE (بسته شد)         | `packages/ui/src/lib/industry-support-note.ts:31`                                                                                           |
| G-03 | `--check` ریزش ادعا را می‌گیرد                     | PARTIALLY_TRUE          | مکانیسم هست؛ **الان** `generate-coverage-table.mjs --check` → `STALE`                                                                       |
| G-04 | تبدیل واحد آفلاین بی‌تست                           | STALE (بسته شد)         | `local-engine/src/__tests__/invoice-unit-parity.test.ts`، `invoices.ts:159` `toBaseQuantity`                                                |
| G-05 | موجودیت variant وجود ندارد                         | PARTIALLY_TRUE          | `variant.service.ts`، `variant.routes.ts`، `local-engine/routes/variants.ts`، UI موجود؛ ولی به خط فاکتور/موجودی وصل نیست (P0 #1 ممیزی اصلی) |
| G-06 | قیمت‌گذاری مساحتی نیست                             | CURRENTLY_TRUE          | `area-dimension.domain.ts`: ۴ از ۴ export بدون مصرف تولیدی (اسکریپت orphan)                                                                 |
| G-07 | رول/ضریب هر بچ نیست                                | CURRENTLY_TRUE          | `roll-batch.domain.ts`: ۲ از ۲ export orphan                                                                                                |
| G-08 | سقف اعتبار اعمال نمی‌شود                           | CURRENTLY_TRUE          | `evaluateCreditLimit` فقط `ui:1`؛ `invoice.service.ts` هیچ ارجاعی ندارد (grep خالی)                                                         |
| G-09 | `batch_expiry/serialized_items` در رجیستری planned | PARTIALLY_TRUE          | `batch_expiry` هنوز planned (`business-capabilities.ts:108-112`)؛ `serialized_items` الان `available` (بیش‌ادعا، §15)                       |
| G-10 | سریال به خط فاکتور وصل نیست                        | PARTIALLY_TRUE          | آزادسازی در بازگشت هست (`invoice.service.ts:2133-2140`)؛ claim هنگام فروش نیست                                                              |
| G-11 | موجودیت گارانتی نیست                               | STALE                   | `warranty.domain.ts`: دو export هر دو مصرف دارند (backend/device/ui)؛ «claim/repair» همچنان MISSING (#5)                                    |
| G-12 | سند مرجوعی فروش نیست                               | IMPLEMENTED_DIFFERENTLY | مایگریشن‌های `invoice-return-03/04/05` + `returns-settlement.domain.ts` (۹ از ۱۰ export مصرف دارند)                                         |
| G-13 | عیار/اجرت/طلای کهنه                                | PARTIALLY_TRUE          | `metal-rates.service.ts` + route + موتور محلی هست؛ سه تابع `gold-jewellery.domain.ts` همه orphan                                            |
| G-14 | سفر/تسویه راننده/بلیت/COD                          | PARTIALLY_TRUE          | `transport.routes.ts`، `freight_trips`؛ `calculateTripSummary` orphan                                                                       |
| G-15 | OEM/fitment/core charge                            | PARTIALLY_TRUE          | `fitment.service.ts`/`fitment.routes.ts` هست؛ `buildCoreDepositLine` و `matchesFitment` orphan                                              |
| G-16 | بارکد کارتن به واحد وصل نیست                       | IMPLEMENTED_DIFFERENTLY | `product_barcodes.unit` (سند `FIFTY-OPTIONS-AUDIT.md` §0)؛ `pack-barcode.domain.ts` orphan (دوم)                                            |
| G-17 | وقت‌دهی/کشاورزی صفر match                          | STALE                   | `appointment.routes.ts`، `agriculture.routes.ts`؛ `calculateCropYieldSummary`، `hasAppointmentConflict` orphan                              |

## 4. Universal Core — `CORE-INVENTORY.md`

| ادعا                                                        | کلاس                 | شاهد                                                                                   |
| ----------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------- |
| «No variant entity (`product_variants`/`variant_id`: none)» | STALE                | `backend/src/services/product/variant.service.ts`، `docs/universal-core-migration.sql` |
| موتور آفلاین تست واحد ندارد                                 | STALE                | `invoice-unit-parity.test.ts`، `universal-core-parity.test.ts`                         |
| عدد/ضریب واحد ثابت به ازای کالا                             | CURRENTLY_TRUE       | `roll-batch.domain.ts` orphan؛ ضریب هر بچ MISSING (#15)                                |
| lots/serials online-only و فروش مصرفشان نمی‌کند             | PARTIALLY_TRUE       | ماتریس آفلاین `online_required`؛ فروش serial را claim نمی‌کند (G-10)                   |
| `local_workspace` صنف نگه نمی‌دارد                          | STALE                | `packages/app-bridge/src/local-schema.ts:422` ستون `business_types`                    |
| سفارش فروش «بدون بیعانه»                                    | CURRENTLY_TRUE       | P0 #21 ممیزی اصلی؛ `calculateOrderDepositBalance` orphan                               |
| اعتبار مشتری نمایش داده می‌شود نه اعمال                     | CURRENTLY_TRUE       | همان G-08                                                                              |
| ساخت: online-only، بدون WIP                                 | CURRENTLY_TRUE       | `offline-endpoint-matrix.ts` و قید CLAUDE.md؛ OD-WIP باز                               |
| رجیستری `serialized_items` planned                          | CONTRADICTED_BY_CODE | الان `available` (`business-capabilities.ts` بخش registry، §15)                        |
| «در این دور هیچ‌چیز روی دیتابیس زنده تأیید نشد»             | CURRENTLY_TRUE       | همچنان BLOCKED_EXTERNAL                                                                |

## 5. Industry Claims — `FINAL-RESULTS.md` و `OPEN-QUESTIONS.md`

| ادعا                                            | کلاس                 | شاهد                                                                                 |
| ----------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------ |
| «رجیستری ۶۱ صنف»                                | STALE                | `INDUSTRY_KEYS` الان ۶۶ مدخل (اسکریپت شمارش)                                         |
| مورد B: صنف در `local_workspace` نیست (BLOCKED) | STALE (حل شد)        | `local-schema.ts:422-423`                                                            |
| مورد C: ویرایش صنف در تنظیمات (FAILED)          | STALE (حل شد)        | `packages/app-shell/src/features/settings/settings-page.tsx:54` `saveIndustry`       |
| مورد D: ترتیب داشبورد صنفی                      | STALE (حل شد)        | `dashboard-container.tsx:84` `look.customized ? DASHBOARD_PARTS : profile.dashboard` |
| ریسک: موتور محلی واحد را تبدیل نمی‌کند          | STALE                | `local-engine/routes/invoices.ts:159`                                                |
| «بدون مایگریشن، `SCHEMA_VERSION` ثابت»          | STALE                | `SCHEMA_VERSION = 17` (`local-schema.ts:15`)                                         |
| `generate-industry-diff.mjs --check` سبز        | CONTRADICTED_BY_CODE | الان خروجی `STALE: …industry-diff.generated.md does not match the registry`          |
| OPEN-Q 4: «فرمول عیار/اجرت وجود ندارد»          | PARTIALLY_TRUE       | تابع‌ها هستند ولی orphan؛ تصمیم گرم-یا-قطعه ثبت نشده                                 |

## 6. Claims Still True

G-06، G-07، G-08؛ CORE-BOUNDARIES §1 (هسته نام صنف نمی‌برد، گارد `industry-profile-guard.test.ts`)؛ ADR-001 (صنف اصلی = اولین کلید به ترتیب رجیستری)؛ ساخت online-only؛ «بیعانه‌ی سفارش» ناقص؛ «تأیید دیتابیس زنده نشده»؛ و (از `FIFTY-OPTIONS-AUDIT.md`) حذف سه جدول موازی `pack_barcodes`/`product_serials`/`vehicle_units` — الان فقط در گارد `no-duplicate-concepts.test.ts` و تست مایگریشن قدیمی نام برده می‌شوند (grep).

## 7. Partially True Claims

G-03، G-05، G-09، G-10، G-13، G-14، G-15، OPEN-Q 4، «lots/serials» در CORE-INVENTORY، و لاگ #17 (Reorder→draft PO وجود دارد ولی دو پیاده‌سازی ناهمگون سرور/دستگاه دارد، ENGINE-DEEP-AUDIT §2).

## 8. Implemented Differently

G-12 (مرجوعی = migration 03/04/05)، G-16 (`product_barcodes.unit`).

## 9. Stale Claims

G-01، G-02، G-04، G-11، G-17؛ در CORE-INVENTORY: variant، تست واحد آفلاین، `local_workspace`؛ در FINAL-RESULTS: ۶۱ صنف، B، C، D، تبدیل واحد، `SCHEMA_VERSION`؛ TRACEABILITY (۴ کلید + یک کلید غایب)؛ RANKING-MODEL ستون وضعیت (به‌اعتراف خود FIFTY-OPTIONS-AUDIT).

## 10. Contradicted Claims (`FIFTY-OPTIONS-LOG.md` و دیگران)

| #      | ادعای لاگ (وضعیت)                             | شاهد مخالف                                                                                                                                                                      |
| ------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12     | Serial/batch at sale — IMPLEMENTED            | فروش serial را claim نمی‌کند؛ `serial-batch.domain.ts` ۴ از ۴ orphan                                                                                                            |
| 13     | Landed cost — IMPLEMENTED                     | `landed.?cost` در `backend/`، `packages/`، `apps/` صفر نتیجه (فقط در مستندات)                                                                                                   |
| 14     | Kits — IMPLEMENTED                            | `explodeKit` فقط تعریف و تست دارد (`specialized-extensions.domain.ts`)                                                                                                          |
| 34     | Scheduled reports — IMPLEMENTED               | رجیستری خودِ مخزن آن را `WRITTEN_NOT_WIRED` می‌گوید (`backend/src/__tests__/unwired-capability.test.ts:476-482`)                                                                |
| 48     | Audit proof (SHA-256 chain) — IMPLEMENTED     | `AuditService.log()` هرگز `hash/prev_hash` نمی‌نویسد؛ تست `audit.test.ts:30-47` ردیف‌های زنجیره را خودش می‌سازد (ENGINE-DEEP-AUDIT §7)                                          |
| 2      | Consolidation — IMPLEMENTED                   | `consolidateEntities` فقط در `consolidation.domain.ts` و تست؛ هیچ caller تولیدی (grep)                                                                                          |
| 40, 41 | Connectors، Zapier — IMPLEMENTED              | رجیستری مخزن: `connector.domain.ts` = `WRITTEN_NOT_WIRED` با یادداشت «No connector exists» (`unwired-capability.test.ts:350-352`)؛ `CLAUDE.md` هم می‌گوید ۱۵ تعریف، صفر adapter |
| 5, 9   | Three-way match، Expense claims — IMPLEMENTED | `threeWayMatch` و `expense-claims.domain.ts` فقط در `packages/validation` (خود فایل + `index.ts`) — صفر مصرف‌کننده‌ی backend/UI/device                                          |
| 19     | Area pricing — IMPLEMENTED                    | ۴ از ۴ export orphan                                                                                                                                                            |
| 21     | Gold — IMPLEMENTED                            | فقط نرخ فلز؛ ۳ از ۳ تابع محاسبه orphan                                                                                                                                          |

## 11. Unverified Claims

همه‌ی ۴ سند و ۵۰ ردیف لاگ در «Final Semantic Reconciliation» (انتهای این فایل) تطبیق معنایی شدند. موارد UNVERIFIED باقی‌مانده دقیقاً ۵ مورد است: M14 (مصرف UI از snapshots)، T11 (سؤال‌های شرطی onboarding)، D15 (سیاست تعارض sync صنف)، D16 (شمار تست‌های سبزِ گزارش تاریخی؛ اجرا نشد)، و لاگ #29 (فرم دقیق بازگشت مالیاتی ARD). لاگ #28/#30/#44 به اعتبارنامه‌ی بیرونی بسته‌اند و `NOT_YET_SUPPORTED` طبقه‌بندی شدند.

## 12. Orphaned Universal-Core Exports — بازبینی

`node scripts/audit/universal-core-orphans.mjs` دوباره اجرا شد.

|                  | قبلی (ممیزی ۱) | فعلی | تفاوت | دلیل                             |
| ---------------- | -------------- | ---- | ----- | -------------------------------- |
| exports          | 85             | 85   | 0     | هیچ تغییر محصولی در این فاز نبود |
| بدون مصرف تولیدی | 45             | 45   | 0     | —                                |
| فقط تست          | 32             | 32   | 0     | —                                |
| با مصرف          | 40             | 40   | 0     | —                                |

«تفاوت صفر» بهبود نیست؛ تأیید می‌کند ممیزی اول درست شمرده بود. وضعیت هر فایل: ALL_ORPHAN = `area-dimension`(4)، `auto-parts`(2)، `gold-jewellery`(3)، `pack-barcode`(1)، `returns`(1)، `roll-batch`(2)، `serial-batch`(4)، `variants`(3)؛ ALL_WIRED = `credit-limit`(1، فقط UI)، `returns-document`(2)، `warranty`(2).

## 13. Production Consumers

۴۰ export مصرف تولیدی دارد؛ بزرگ‌ترین‌ها: `returns-settlement`(۹ از ۱۰)، `package-credit-ledger`(۷ از ۱۱)، `service-delivery`(۶ از ۱۳)، `package-grant-allocation`(۷ از ۸). `credit-limit` تنها در UI مصرف می‌شود (WRONG_LAYER برای قاعده‌ای که باید سمت سرور اعمال شود).

## 14. Test-Only Consumers

۳۲ export. نمونه: `resolveVariantPrice`، `formatVariantTitle`، `canonicalAttributeKey`، `calculateJewelleryLine`، `calculateOldGoldTradeIn`، `deriveKaratGramRate`، `validateSerialSale`، `markSerialSold`، `sortBatchesFEFO`، `calculateAreaDimension`، `explodeKit`، `calculateTripSummary`.

## 15. Capability Registry Overclaims

رجیستری دوباره باز شد (`packages/validation/src/schemas/business-capabilities.ts`): ۱۳ کلید؛ ۸ `available`، ۵ `planned`. هر `evidence.sources` و `tests` با `existsSync` موجود است (۰ مسیر گم‌شده، اسکریپت). یعنی «مسیر هست»، اما:

| کلید               | وضعیت رجیستری | واقعیت فعلی                                                                  | حکم                      |
| ------------------ | ------------- | ---------------------------------------------------------------------------- | ------------------------ |
| `measurement`      | available     | مصرف در گرید فاکتور (`invoice-grid.ts`)                                      | قابل‌دفاع                |
| `weight_pricing`   | available     | همان                                                                         | قابل‌دفاع                |
| `multi_unit`       | available     | `toBaseQuantity` در سرور و دستگاه + تست parity                               | قابل‌دفاع                |
| `variants`         | available     | CRUD دارد؛ به خط فاکتور/موجودی بسته نیست؛ `variants.domain.ts` ۳ از ۳ orphan | CONTRADICTED_PRIOR_CLAIM |
| `serialized_items` | available     | فروش serial را claim نمی‌کند؛ `serial-batch.domain.ts` ۴ از ۴ orphan         | CONTRADICTED_PRIOR_CLAIM |
| `auto_fitments`    | available     | fitment search هست؛ core charge/`matchesFitment` orphan                      | PARTIALLY (بیش‌ادعا)     |
| `gold_purity`      | available     | فقط CRUD نرخ فلز؛ محاسبه‌ی خط orphan                                         | CONTRADICTED_PRIOR_CLAIM |
| `making_charges`   | available     | همان؛ «اجرت و وزن» (#47) MISSING                                             | CONTRADICTED_PRIOR_CLAIM |

هیچ ورودی «planned» نیست که پیاده‌شده باشد. ۵ بیش‌ادعا: `variants`، `serialized_items`، `auto_fitments`، `gold_purity`، `making_charges` (همان پنج مورد ممیزی اول؛ بازتأیید شد). رجیستری در این فاز تغییر نکرد.

## 16. Industry Support Overclaims

از ۲۴ صنف در `INDUSTRY-SUPPORT-MATRIX.md`: ۱۴ «VERIFIED_SUPPORTED». ردیف‌های آن‌ها بر `variants`، `serials`، `warranty`، `goldPurity`، `makingCharges`، `oldGold`، `areaPricing`، `rollTracking`، `coreCharge`، `crossReference` تکیه دارند → برای صنف‌های **طلا، فرش، پارچه‌ی رول، قطعات خودرو، لوازم کامپیوتر، لوازم برقی، پوشاک، کفش، ظروف** برچسب `VERIFIED_SUPPORTED` تا مسیر خرید-تا-فاکتور نبسته، `SUPPORTED_WITH_LIMITATIONS` باید باشد. ممیزی اصلی از ۵۰ صنف فقط ۱ را SUPPORTED می‌داند؛ تفاوت از این است که سند قدیمی «قاعده+تست» را «پشتیبانی» می‌نامد.

## 17. 118-Requirement Reconciliation

اسکریپت تحلیل روی `INDUSTRY-COVERAGE-TABLE.csv`:

| سنجه                                                                     | نتیجه                                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| ردیف                                                                     | **۱۱۸** = ۱۰۳ `VERIFIED_SUPPORTED` + ۱۰ `PARTIALLY_SUPPORTED` + ۵ `IMPLEMENTED_THIS_ROUND` |
| مدل کسب‌وکار                                                             | ۲۴                                                                                         |
| ردیف تکراری (مدل+قابلیت)                                                 | ۰                                                                                          |
| مسیر `file:line` گم‌شده                                                  | ۰                                                                                          |
| `VERIFIED` بدون فایل تست                                                 | ۰                                                                                          |
| `VERIFIED` که فقط به `packages/validation/src/schemas/*` + تست لنگر دارد | ۸۱                                                                                         |
| از آن‌ها فقط به `universal-core/*.domain.ts` لنگر دارد                   | ۵۴                                                                                         |
| از آن‌ها لنگرشان فقط فایل‌هایی است که **همه‌ی exportهایشان orphan** است  | **۳۰**                                                                                     |

نتیجه: **عدد ۱۱۸ درست است؛ ۱۱۳ (۳۸+۴۰+۳۵) قدیمی بود.** اما از ۱۰۳ ردیف «VERIFIED»، ۳۰ ردیف فقط به قاعده‌ای لنگر دارند که هیچ مسیر تولیدی صدایش نمی‌زند. از این ۳۰، ۶ ردیف `returns` هستند که قابلیت واقعی است (مرجوعی 03–05) ولی لنگر اشتباه (`returns.domain.ts`) → `IMPLEMENTED_DIFFERENTLY`؛ ۲۴ ردیف (variants، serials، rollTracking، batchExpiry، areaPricing، goldPurity، makingCharges، oldGold، coreCharge، crossReference، packBarcodes) بیش‌ادعا هستند. «VERIFIED» در این جدول یعنی «قاعده + فایل تست» نه «مسیر تولیدی + دیتابیس». عبارت `IMPLEMENTED_THIS_ROUND` (۵ ردیف) وابسته به زمان است و باید حذف شود.

دو سند تولیدی هم‌اکنون `--check` را رد می‌کنند: `generate-coverage-table.mjs --check` و `generate-industry-diff.mjs --check` (هر دو `STALE`) — یعنی ضمانت G-03 («ادعا از کد جدا نشود») در HEAD شکسته است.

## 18. Recommended Documentation Corrections (پیشنهاد؛ اعمال نشد)

1. بازتولید دو سند تولیدی با دو فرمان بالا و افزودن چک آن‌ها به CI.
2. `INDUSTRY-COVERAGE-TABLE`: وضعیت `VERIFIED_SUPPORTED` را به `RULE_ONLY` / `WIRED` / `LIVE_VERIFIED` بشکنید؛ ۲۴ ردیف بیش‌ادعا → `RULE_ONLY`.
3. `GAP-ANALYSIS`: G-01/02/04/11/17 را «closed» علامت بزنید؛ G-12/G-16 را به جایگزین‌شان ارجاع دهید.
4. `FINAL-RESULTS`: ۶۱→۶۶، B/C/D و `SCHEMA_VERSION` به‌روز؛ یا سند «تاریخی» برچسب بخورد.
5. `TRACEABILITY`: ۱۳ کلید و وضعیت واقعی؛ بهتر است از رجیستری تولید شود.
6. `FIFTY-OPTIONS-LOG`: وضعیت #12، #13، #14، #34، #48، #5، #9 را از `IMPLEMENTED` به `WRITTEN_NOT_WIRED` برگردانید؛ #48 باید شامل «نویسنده‌ی هش» باشد.
7. رجیستری قابلیت: پنج کلید بیش‌ادعا را `partial` (وضعیت تازه) یا `planned` کنید — تصمیم مالک/تیم، نه این ممیزی.

## 19. Evidence Index

- شمارش orphan: `node scripts/audit/universal-core-orphans.mjs` (۸۵/۴۵/۳۲/۴۰).
- gap scan: `node scripts/audit/capability-gap-scan.mjs` (۳۱۷۹ فایل؛ ۱۴ شکاف با صفر شاهد، همگی در ممیزی اصلی MISSING یا PARTIAL با شاهد دستی — #30 `freight_trips` و #36 `appointments.staff_employee_id`؛ regex اسکنر محدود است، پس «صفر» حد پایین است نه تناقض).
- `--check` ژنراتورها: دو خروجی `STALE` بالا.
- تحلیل CSV ۱۱۸ ردیف و رجیستری: اسکریپت‌های scratchpad (خارج از مخزن؛ منطق در §15، §17 تکرارپذیر با خواندن CSV و `business-capabilities.ts`).
- کد: `backend/src/services/inventory/cycle-count.service.ts`، `backend/src/routes/inventory-insights.routes.ts`، `packages/local-engine/src/routes/purchasing.ts`، `backend/src/services/audit.service.ts`، `backend/src/__tests__/unwired-capability.test.ts`.

## Final Semantic Reconciliation

(READ-ONLY؛ هیچ سند معماری و هیچ کدی ویرایش نشد. یک خطای روش در همین فاز: اجرای `node scripts/industry/ranking-model.mjs --check` — که فلگ `--check` ندارد — فایل `RANKING-MODEL.md` را بازنویسی کرد؛ بلافاصله با `git show HEAD:<path>` به محتوای HEAD برگردانده شد و `git diff --name-only` = ۰. تفاوت فقط فاصله‌گذاری جدول‌ها بود و اعداد سرخط خروجی با سند یکی بود.)

### A. MENU-DOMAIN-MAP — ۱۹ ادعا

Claims audited: 19 · Currently true: 10 · Partially true: 2 · Implemented differently: 0 · Stale: 5 · Contradicted: 1 · Unverified: 1

| #   | ادعا                                             | کلاس                 | شاهد (کد فعلی / مصرف‌کننده)                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | ۱۸ مقصد منو                                      | PARTIALLY_TRUE       | ۱۷ شناسه‌ی `id:` در `packages/ui-contract/src/navigation.ts`؛ `sync` فقط در union نوع (`navigation.ts:51`)                                                                                                                                                                 |
| M2  | `/stock-count` در هیچ هابی نیست                  | CURRENTLY_TRUE       | `packages/app-shell/src/app/app.tsx:139` route مستقل؛ `warehouse-hub.test.ts:152` فقط وجود فایل را می‌سنجد                                                                                                                                                                 |
| M3  | `orders*` caller کلاینتی ندارد                   | CURRENTLY_TRUE       | `packages/api/src/hooks/orders.ts` فقط هوک‌های storefront دارد                                                                                                                                                                                                             |
| M4  | `products/low-stock` caller ندارد                | CURRENTLY_TRUE       | تنها ارجاع: id کارت داشبورد (`DashboardRegistry.ts:98`) نه مسیر API                                                                                                                                                                                                        |
| M5  | مرجوعی سومین نوع سند نیست                        | CURRENTLY_TRUE       | مایگریشن‌های `invoice-return-03/04/05` + `useInvoiceReturns` (۱ مصرف UI)                                                                                                                                                                                                   |
| M6  | اعمال سقف اعتبار جایش `InvoiceService` است       | CURRENTLY_TRUE       | هنوز در `invoice.service.ts` اعمال نمی‌شود؛ تنظیم `credit-limit-mode-section.tsx` و `use-customer-terms.ts` فقط UI                                                                                                                                                         |
| M7  | `recurring_expense` declared، not executable     | STALE                | `automation.service.ts:691-693` شاخه‌ی اجرا (`postJournalTemplate`)                                                                                                                                                                                                        |
| M8  | حمل‌ونقل = تب هاب فروش                           | STALE                | هیچ UI حمل‌ونقل نیست؛ `useFreightTrips/useCourierDeliveries` صفر مصرف‌کننده؛ `audit-unwired-routes.mjs`: `/api/freight/trips`, `/api/courier/deliveries`, `/api/delivery-notes` بدون caller                                                                                |
| M9  | Expense claims = بخش Team→pay                    | STALE                | فقط `expense-claims.domain.ts`؛ هیچ ارجاع در api/ui                                                                                                                                                                                                                        |
| M10 | Deferrals = بخش Money→books                      | STALE                | `grep deferral` در `packages/ui/src/components` صفر                                                                                                                                                                                                                        |
| M11 | endpoint cash-flow هست، بخشش نیست                | CURRENTLY_TRUE       | `accounting.routes.ts:525`؛ هوک `/accounting/cash-flow` در `packages/api` نیست                                                                                                                                                                                             |
| M12 | تنظیمات: ویرایشگر صنف، حالت سقف اعتبار، واحد فلز | CURRENTLY_TRUE       | `settings-page.tsx:54`؛ `credit-limit-mode-section.tsx`؛ `metal-unit-section.tsx` (بدون هیچ UI نرخ فلز)                                                                                                                                                                    |
| M13 | کنسول وب‌هوک بخشی از developers                  | CURRENTLY_TRUE       | `useReplayWebhook` (`hooks/developer.ts:279`) در `developers-view.tsx`                                                                                                                                                                                                     |
| M14 | `snapshots` بدون caller UI                       | UNVERIFIED           | script مسیر `/api/snapshots` را بی‌caller نشان می‌دهد، اما `hooks/conflicts.ts` رشته‌ی snapshots دارد؛ مصرف UI تفکیک نشد                                                                                                                                                   |
| M15 | مقصد UI برای گزینه‌های 16، 19–27 وجود دارد       | CONTRADICTED_BY_CODE | ۱۰ هوک قابلیت (`useLatestMetalRate`, `useVehicles`, `useOrderDeposits`, `useAppointments`, `useCropCycles`, `useFreightTrips`, `useCourierDeliveries`, `useDeliveryNotes`, `useConsumePackageCredit`, `usePackageCreditLedger`) در کل `apps/` و `packages/` صفر مصرف‌کننده |
| M16 | واریانت: Stock→products + شبکه‌ی فاکتور          | PARTIALLY_TRUE       | `product-variants-section.tsx` هست؛ `invoice.service.ts` هیچ ارجاع variant ندارد (P0 #1)                                                                                                                                                                                   |
| M17 | «فقط hard lock برگشت‌ناپذیر نیست»                | CURRENTLY_TRUE       | `setPeriodLock` اجازه‌ی عقب‌بردن قفل می‌دهد (`accounting.service.ts:330-349`)؛ گزارش لاگ #1 غلط است                                                                                                                                                                        |
| M18 | `industry ===` بیرون رجیستری ممنوع               | CURRENTLY_TRUE       | grep روی backend/ui/local-engine بدون نتیجه؛ گارد `industry-profile-guard.test.ts`                                                                                                                                                                                         |
| M19 | «۸۰۸ route، ۱۰۶ بی‌caller»                       | STALE                | اجرای فعلی `audit-unwired-routes.mjs`: ۸۳۴ route، ۶۴۵ رشته‌ی مسیر کلاینت، ۱۱۸ بی‌caller                                                                                                                                                                                    |

نتیجه‌ی معماری: نقشه «ترکیب» را درست توصیف می‌کند (هر مقصد یک هاب، قابلیت = بخش، نه هسته‌ی صنفی). ولی «منوی هدف» برای ۱۰ قابلیت universal-core هنوز ساخته نشده؛ پس **مسیر API/دامنه هست و منو/UI نیست** (backend capabilities without menu exposure). عکسش — منویی بدون پشتوانه‌ی بک‌اند — یافت نشد.

### B. RANKING-MODEL — ۱۶ ادعا

Claims audited: 16 · Currently true: 11 · Partially true: 2 · Implemented differently: 0 · Stale: 2 · Contradicted: 1 · Unverified: 0

| #   | ادعا                                                    | کلاس                 | شاهد                                                                                                                                     |
| --- | ------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | سند تولیدشده از `scripts/industry/ranking-model.mjs`    | CURRENTLY_TRUE       | اسکریپت هست؛ اجرای دوباره سرخط یکسان داد: آستانه‌ی رتبه‌ی ۴ = 80.5، حساسیت now median 11، full median 2 / top‑4 80%                      |
| R2  | بازتولیدپذیر/قطعی                                       | PARTIALLY_TRUE       | حساسیت با LCG بذردار (`ranking-model.mjs:662-669`)؛ تابع بی‌بذر `dirichlet()` هنوز هست ولی `void` شده                                    |
| R3  | Hisabche now 67.5 رتبه ۱۱ → بعد از ۵۰ گزینه 86.8 رتبه ۲ | PARTIALLY_TRUE       | محاسبه درست و بازتولید شد؛ ورودی «now» فرض می‌کند همه‌ی درخواست‌ها تحویل شده‌اند، که خود سند و ممیزی رد می‌کنند                          |
| R4  | امتیاز ۲۹ رقیب = قضاوت نه اندازه‌گیری                   | CURRENTLY_TRUE       | اعلام صریح سند؛ درستی بیرونی ادعای دیگری نمی‌سازد                                                                                        |
| R5  | وزن‌ها جمع ۱۰۰٪                                         | CURRENTLY_TRUE       | ۲۰+۱۵+۱۰×۵+۱۵ = ۱۰۰ (جدول §1)                                                                                                            |
| R6  | ستون «Repository state»                                 | STALE                | `FIFTY-OPTIONS-AUDIT.md` §0 می‌گوید برای ۱۶ گزینه غلط بود؛ مثلاً #11 «no variant entity» و #4 «nothing found» امروز غلط‌اند              |
| R7  | رتبه ۴ بعد از ۲۲ گزینه (۸۰ واحد تلاش، 81.1)             | CONTRADICTED_BY_CODE | از ۲۲ گزینه‌ی مسیر، ۱۱ مورد (#9، #47، #13، #5، #36، #49، #48، #12، #14، #34، #40) بنا بر کد فعلی CONTRADICTED‌اند؛ پس «رسیدن» اثبات نشده |
| R8  | مصرف‌کننده‌ی تولیدی                                     | CURRENTLY_TRUE       | هیچ؛ مدل فقط سند است (grep خارج از `docs/` فقط خود اسکریپت)                                                                              |
| R9  | پوشش تست                                                | CURRENTLY_TRUE       | هیچ تستی به آن ارجاع نمی‌دهد                                                                                                             |
| R10 | جدول حساسیت ۲۰۰۰ بردار                                  | CURRENTLY_TRUE       | بازتولید شد (R1)                                                                                                                         |
| R11 | #1 «فقط hard lock نیست»                                 | CURRENTLY_TRUE       | همان M17                                                                                                                                 |
| R12 | #33 «رمزنگاری DB محلی نیست»                             | CURRENTLY_TRUE       | grep برای sqlcipher/ciphers/PRAGMA key در desktop/app-bridge/local-engine صفر؛ `FIFTY-OPTIONS-LOG` #33 خلافش را ادعا می‌کند              |
| R13 | #47 «TOTP فقط ادمین»                                    | CURRENTLY_TRUE       | `requireStepUpMfa` هیچ route مشتری ندارد (بخش E)                                                                                         |
| R14 | #42 «کنسول تحویل UI ندارد»                              | STALE                | replay در `developers-view.tsx` مصرف می‌شود (M13)                                                                                        |
| R15 | #39 «spec منتشر نشده، SDK نیست»                         | CURRENTLY_TRUE       | فقط قالب `scripts/export-openapi-sdk.mjs`؛ `@fastify/swagger` در `index.ts:626`                                                          |
| R16 | #43 «داشبورد دفتر حسابداری نیست»                        | CURRENTLY_TRUE       | فقط `enterWorkspace`/`listWorkspaces`                                                                                                    |

وزن‌ها و مدل تغییر داده نشد؛ نتیجه‌ی ممیزی این است که **مدل مستند-محض است و ورودی‌های «تحویل‌داده‌شده»اش اعتبار ندارد**.

### C. INDUSTRY-ONBOARDING-TAXONOMY — ۱۳ ادعا

Claims audited: 13 · Currently true: 11 · Partially true: 1 · Implemented differently: 0 · Stale: 0 · Contradicted: 0 · Unverified: 1

| #   | ادعا                                                      | کلاس           | شاهد                                                                                                            |
| --- | --------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------- |
| T1  | جریان: دو کارت مدل فروش → فهرست صنف → اندازه → ارز → مرور | PARTIALLY_TRUE | کارت‌ها `onboarding-page.tsx:163`؛ بقیه‌ی گام‌ها تک‌به‌تک دنبال نشد                                             |
| T2  | فقط `business_types` ذخیره می‌شود                         | CURRENTLY_TRUE | `auth.routes.ts:51,203,213`؛ `resolveBusinessProfile` (`industry-profiles.ts:490`)                              |
| T3  | صنف اصلی = اولین کلید به ترتیب رجیستری                    | CURRENTLY_TRUE | ADR-001 + همان تابع                                                                                             |
| T4  | واحد پیش‌فرض محصول **جدید**                               | CURRENTLY_TRUE | `add-product-modal.tsx:283-284`                                                                                 |
| T5  | ترتیب کارت‌های داشبورد (چیدمان ذخیره‌شده برنده)           | CURRENTLY_TRUE | `dashboard-container.tsx:84`                                                                                    |
| T6  | قابلیت planned فعال نمی‌شود                               | CURRENTLY_TRUE | `kind` مشتق (`industry-profiles.ts:338`)؛ `pharmacy` می‌گوید `batch_expiry` (planned) و حل‌کننده فیلترش می‌کند  |
| T7  | یادداشت «ویژگی تخصصی نیست» برای generic، سه زبان          | CURRENTLY_TRUE | `industry-support-note.ts:31`؛ کلید `supportNote` یک‌بار در هر سه `common.json`                                 |
| T8  | کلیدهای الزامی + freight/passenger/courier generic        | CURRENTLY_TRUE | `business-types.ts:51,60,78,106,111`؛ این سه در `OVERRIDES` (`industry-profiles.ts:201`) نیستند → generic       |
| T9  | `fabricRoll` بدون طول هر رول                              | CURRENTLY_TRUE | override فقط measurement+multi_unit؛ `roll-batch.domain.ts` ۲ از ۲ orphan                                       |
| T10 | اندازه‌ی رجیستری ۶۶                                       | CURRENTLY_TRUE | شمارش `INDUSTRY_KEYS` = ۶۶                                                                                      |
| T11 | سؤال شرطی/صفحه‌ی دسته‌ی والد عمداً نیست                   | UNVERIFIED     | کد onboarding فقط بخشی خوانده شد                                                                                |
| T12 | معماری = ترکیب قابلیت، نه معماری صنفی                     | CURRENTLY_TRUE | `ls backend/src/services` بدون Teacher/Gold/Carpet/Hardware/Fuel/School/Jewel؛ بدون `industry ===` در کد تولیدی |
| T13 | بدون مجوز/حسابداری/موجودی صنفی                            | CURRENTLY_TRUE | همان گارد؛ مسیر پول/موجودی مشترک (`invoice-posting.domain.ts`)                                                  |

یافته‌ی معماری: رجیستری قابلیت می‌گوید `gold_purity`/`making_charges` available اما **پروفایل jewellery فقط سه قابلیت دارد** (`industry-profiles.ts:202-209`)؛ پروفایل و رجیستری ناهم‌ساز. هسته‌ی صنفی جدا ساخته نشده، ولی نام‌گذاری ماژول‌های `universal-core/` (`gold-jewellery`, `auto-parts`, `vehicles`, `specialized-extensions`) صنفی است: خطر لغزش به `GoldCore` — **ARCH-FINDING-1** (P3، نام/مرز).

### D. INDUSTRY-DIFFERENCES — ۱۶ ادعا

Claims audited: 16 · Currently true: 4 · Partially true: 3 · Implemented differently: 0 · Stale: 6 · Contradicted: 1 · Unverified: 2

| #   | تفاوت / ادعا                                                           | نوع                     | کلاس                 | شاهد                                                                                          |
| --- | ---------------------------------------------------------------------- | ----------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| D1  | پروفایل مشتق‌شده، بدون جدول دوم                                        | UI_CONFIGURATION        | CURRENTLY_TRUE       | T2                                                                                            |
| D2  | ۶۱ کلید / ۱۳ تخصصی / ۴۸ عمومی / ۳ قابلیت available                     | —                       | STALE                | ۶۶ کلید؛ رجیستری ۱۳ قابلیت، ۸ available؛ ≥۲۳ override (`industry-profiles.ts:201-325`)        |
| D3  | «تخصصی» یعنی قابلیت/واژگان نه صفحه/دفتر جدا                            | WORKFLOW                | CURRENTLY_TRUE       | M18/T12                                                                                       |
| D4  | هسته‌ی مشترک (invoice-math، دفتر، stock_movements، FIFO، workspace_id) | UNIVERSAL_CAPABILITY    | PARTIALLY_TRUE       | واقعیت‌ها برقرارند؛ شماره‌خط‌های `invoice.service.ts` بدون بازبینی تک‌به‌تک                   |
| D5  | ترتیب داشبورد مصرف‌کننده ندارد                                         | UI_CONFIGURATION        | STALE                | `dashboard-container.tsx:84`                                                                  |
| D6  | `vocabulary` مصرف‌کننده ندارد                                          | TERMINOLOGY             | STALE                | `add-product-modal.tsx:283-284`                                                               |
| D7  | `local_workspace` صنف ندارد                                            | —                       | STALE                | `local-schema.ts:422-423`                                                                     |
| D8  | ویرایش صنف در تنظیمات نیست                                             | UI_CONFIGURATION        | STALE                | `settings-page.tsx:54`                                                                        |
| D9  | موتور محلی واحد را تبدیل نمی‌کند                                       | UNIVERSAL_CAPABILITY    | STALE                | `local-engine/src/routes/invoices.ts:159`                                                     |
| D10 | طلا: فقط گرم + ستون وزن؛ بدون عیار/اجرت                                | INDUSTRY_SPECIFIC_LOGIC | PARTIALLY_TRUE       | پروفایل همین است؛ ولی نرخ فلز (`metal-rates.service.ts`) و ۳ تابع orphan اضافه شده‌اند        |
| D11 | سه مسیر (UI/سرور/دستگاه) جمع یکسان                                     | UNIVERSAL_CAPABILITY    | PARTIALLY_TRUE       | `invoice-grid`/`invoice-math` مشترک؛ اجرای تست در این فاز نشد                                 |
| D12 | تغییر صنف چیدمان ذخیره‌شده را بازنویسی نمی‌کند                         | POLICY                  | CURRENTLY_TRUE       | `invoice-draft.slice.ts:275-277`                                                              |
| D13 | چندصنفی: اجتماع قابلیت‌ها + صنف اصلی                                   | POLICY                  | CURRENTLY_TRUE       | ADR-001 + `resolveBusinessProfile`                                                            |
| D14 | موبایل نمی‌تواند `packages/ui` را import کند                           | —                       | CONTRADICTED_BY_CODE | `apps/mobile/package.json:28` وابستگی `@hisabche/app-shell`؛ CLAUDE.md: WebView روی app-shell |
| D15 | سیاست تعارض sync صنف تعریف‌نشده                                        | POLICY                  | UNVERIFIED           | pull/sync صنف بررسی نشد                                                                       |
| D16 | شمار تست‌ها (۵، ۴۰، ۹ سبز)                                             | —                       | UNVERIFIED           | در این فاز اجرا نشد                                                                           |

دسته‌بندی در معماری هدف (Industry → Preset → Universal capabilities → Policy/Workflow/Terminology): measurement/UOM/pricing/variants/serials = UNIVERSAL_CAPABILITY؛ سقف اعتبار = POLICY؛ واژگان = TERMINOLOGY؛ ستون‌های اضافه/داشبورد = UI_CONFIGURATION؛ عیار/اجرت، fitment/core، سفر/محصول کشاورزی/دام = INDUSTRY_SPECIFIC_LOGIC (در `universal-core/*.domain.ts` با نام صنفی؛ ARCH-FINDING-1). اشتراک، پروژه، appointments، package credits و service delivery به‌صورت قابلیت عمومی مدل شده‌اند (`package-credits.routes.ts`, `service-delivery.routes.ts`, `appointment.routes.ts`) — نقض «Separate Domain Core» یافت نشد.

### E. FIFTY-OPTIONS-LOG — ۵۰ از ۵۰

Previously semantically audited: 17 · Newly semantically audited: 33 · Total: 50

| کلاس                       | تعداد | شناسه‌ها                                                                        |
| -------------------------- | ----- | ------------------------------------------------------------------------------- |
| SUPPORTED                  | 4     | 6، 10، 31، 42                                                                   |
| SUPPORTED_WITH_LIMITATIONS | 21    | 3، 4، 7، 11، 15، 16، 17، 18، 22، 23، 24، 25، 26، 27، 32، 37، 39، 43، 45، 46، 50 |
| NOT_YET_SUPPORTED          | 4     | 8 (skip عمدی)، 28، 30، 44                                                       |
| STALE                      | 0     | —                                                                               |
| CONTRADICTED               | 20    | 1، 2، 5، 9، 12، 13، 14، 19، 20، 21، 33، 34، 35، 36، 38، 40، 41، 47، 48، 49      |
| UNVERIFIED                 | 1     | 29                                                                              |

ردیف‌های ۳۳گانه‌ی تازه:

| #                               | حکم                        | شاهد                                                                                                                                                       |
| ------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Hard lock                     | CONTRADICTED               | `setPeriodLock` قفل را آزادانه تغییر/عقب می‌برد (`accounting.service.ts:330-349`)؛ هیچ مفهوم hard/irreversible در backend/validation (grep)                |
| 3 Tax offline                   | SUPPORTED_WITH_LIMITATIONS | `local-engine/routes/tax.ts` هست؛ `GET /tax/return` = `online_required` (`offline-endpoint-matrix.ts:278`)                                                 |
| 7 Cash flow                     | SUPPORTED_WITH_LIMITATIONS | endpoint `accounting.routes.ts:525`؛ بدون هوک/بخش UI                                                                                                       |
| 8 Rolling forecast              | NOT_YET_SUPPORTED          | SKIP عمدی در لاگ؛ ادعای پشتیبانی نیست                                                                                                                      |
| 10 Learned rules                | SUPPORTED                  | `match-learning.domain.ts` توسط `banking.service.ts`                                                                                                       |
| 11 Variants                     | SUPPORTED_WITH_LIMITATIONS | service+route+engine+UI؛ به فاکتور/موجودی وصل نیست                                                                                                         |
| 16 Delivery notes               | SUPPORTED_WITH_LIMITATIONS | `transport.routes.ts:99-101`؛ بدون UI، بدون موتور محلی، آنلاین‌فقط                                                                                         |
| 18 Warranty                     | SUPPORTED_WITH_LIMITATIONS | `warranty.routes.ts`, `local-engine/routes/warranties.ts`؛ `useRegisterWarranty` صفر مصرف UI                                                               |
| 20 Roll stock                   | CONTRADICTED               | `roll-batch.domain.ts` ۲ از ۲ orphan؛ هیچ مصرف در backend/engine/ui                                                                                        |
| 22–24 Freight/Passenger/Courier | SUPPORTED_WITH_LIMITATIONS | `transport.routes.ts` (+سرویس)؛ بدون UI و بدون موتور محلی؛ `calculateTripSummary` orphan                                                                   |
| 25 Fitment                      | SUPPORTED_WITH_LIMITATIONS | `fitment.service.ts`, `local-engine/routes/fitments.ts`, UI (`useProductFitments`)؛ core charge orphan                                                     |
| 26 Appointments                 | SUPPORTED_WITH_LIMITATIONS | `appointment.routes.ts` ثبت‌شده در `index.ts:140`؛ بدون UI/engine                                                                                          |
| 27 Agriculture                  | SUPPORTED_WITH_LIMITATIONS | `agriculture.routes.ts` (`index.ts:141`)؛ `/api/agriculture/livestock` بی‌caller؛ `calculateCropYieldSummary` orphan                                       |
| 28 Moodian                      | NOT_YET_SUPPORTED          | فقط تعریف در `connector.domain.ts`؛ BLOCKED_EXTERNAL_CREDENTIAL                                                                                            |
| 30 Local payments               | NOT_YET_SUPPORTED          | بدون adapter                                                                                                                                               |
| 31 Conflicts                    | SUPPORTED                  | `packages/ui/src/components/ui/conflicts` + `services/conflict`                                                                                            |
| 32 E2E                          | SUPPORTED_WITH_LIMITATIONS | ۶ تست در `apps/desktop/e2e/app.e2e.ts:30-91`؛ اجرا نشد                                                                                                     |
| 33 Encrypted DB                 | CONTRADICTED               | شاهد لاگ فقط vault اعتبارنامه (`secure-store.ts`)؛ رمزنگاری SQLite نیست (grep خالی)                                                                        |
| 35 Drill-through                | CONTRADICTED               | `packages/ui/src/hooks/use-account-drilldown.ts` صفر مصرف؛ فقط نسخه‌ی قبلی `components/use-account-drilldown.tsx` در تب‌های گزارش؛ کارت داشبورد لینک ندارد |
| 36 Management pack              | CONTRADICTED               | `management-pack.composer.ts` بدون هیچ فراخوانی تولیدی                                                                                                     |
| 37 OData                        | SUPPORTED_WITH_LIMITATIONS | `odata.routes.ts` ثبت‌شده (`index.ts:802`)، با capability؛ کلید API نمی‌رسد (خارج از `API_ROUTE_SCOPES`)                                                   |
| 38 Export footer                | CONTRADICTED               | `toCSV(..., {footer})` هست (`csv.ts:37-46`) ولی هیچ export سندی footer نمی‌دهد (فقط رسید چاپی)                                                             |
| 39 OpenAPI+SDK                  | SUPPORTED_WITH_LIMITATIONS | `@fastify/swagger` (`index.ts:626`)؛ SDK فقط قالب `scripts/export-openapi-sdk.mjs`، اجرا/انتشار نشده                                                       |
| 42 Webhook console              | SUPPORTED                  | replay + UI (`developers-view.tsx`)                                                                                                                        |
| 43 Accountant mode              | SUPPORTED_WITH_LIMITATIONS | `listWorkspaces/enterWorkspace`؛ بدون داشبورد دفتر                                                                                                         |
| 44 Migration kits               | NOT_YET_SUPPORTED          | `migration.presets.ts` هیچ importer ندارد                                                                                                                  |
| 45/46/50 SOC2/ISO/Pentest       | SUPPORTED_WITH_LIMITATIONS | فقط اسناد (`docs/security/soc2/control-inventory.md`، `iso27001/*`، `pentest-scope.md`)؛ گواهی/ممیزی بیرونی نیست                                           |
| 47 Customer MFA                 | CONTRADICTED               | `requireStepUpMfa` (`mfa.middleware.ts:17`) در هیچ route استفاده نشده؛ `mfa.domain` بی‌مصرف؛ مسیر مشتری ندارد                                              |
| 49 DR                           | CONTRADICTED               | `scripts/dr-restore-drill.mjs` با خروجی ساختگیِ درون‌اسکریپت کار می‌کند (نه بازیابی واقعی)؛ RTO/RPO در `disaster-recovery.md:5-6` ادعاست نه اندازه‌گیری    |

ردیف‌های دور اول با برچسب‌های جدید: 2، 5، 9، 12، 13، 14، 19، 21، 34، 40، 41، 48 = CONTRADICTED؛ 6 = SUPPORTED؛ 4، 15، 17 = SUPPORTED_WITH_LIMITATIONS؛ 29 = UNVERIFIED.

### F. جمع‌بندی

- ۴ سند + ۵۰ ردیف: هر ادعا یا شاهد دارد یا صریحاً UNVERIFIED است (۵ مورد: M14، T11، D15، D16، لاگ #29).
- `RANKING-MODEL.md` و `FIFTY-OPTIONS-LOG.md` سندهای وضعیت‌اند و ۲۰ ادعای «IMPLEMENTED» لاگ با کد نمی‌خواند.
- هیچ ادعای `VERIFIED` تازه‌ای افزوده نشد.
