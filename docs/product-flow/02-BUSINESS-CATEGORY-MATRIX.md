# 02 — BUSINESS CATEGORY MATRIX

commit: `05f749a2` · date: 2026-11-01 · وضعیت: `CATEGORY_PERSONALIZATION: LIMITED` (VERIFIED_SOURCE)
مرتبط: [01-ONBOARDING-FLOW](01-ONBOARDING-FLOW.md) · [20-ANSWERS](20-ANSWERS-TO-THE-FOUR-QUESTIONS.md)

## ۱. فهرست واقعی دسته‌ها

- کاتالوگ UI: `BUSINESS_MODELS` (2) + `BUSINESS_TYPES` (62) + `BUSINESS_TYPE_OTHER` — `packages/ui-contract/src/business-types.ts:25-138`.
- کلیدهای canonical: **۶۶** کلید در `INDUSTRY_KEYS` (`packages/validation/src/schemas/industry-profiles.ts`)؛ legacy: `service` (`LEGACY_INDUSTRY_KEYS`).
- **۲۳ کلید** `OVERRIDES` دارند (تجربهٔ متفاوت)، **۴۳ کلید** generic: `retail, wholesale, bakery, butcher, fruitVegetable, dairy, nuts, currencyExchange, carpet, itServices, paint, glass, construction, mechanic, furniture, kitchenware, homeAppliances, stationery, toys, giftShop, cosmetics, clinic, barber, optician, agriculture, livestock, seedsFertilizer, flowers, transport, freightTransport, passengerTransport, courier, travelAgency, realEstate, printing, photography, education, laundry, repairs, wedding, security, consulting, other`.
- تضمین سورس: فایل تعریف صریحاً می‌گوید «صنعت فقط تأکید را تنظیم می‌کند؛ هیچ capability نمی‌دهد، مجوز را عوض نمی‌کند، ماژولی را پنهان نمی‌کند، به پول دست نمی‌زند» (`industry-profiles.ts` سرفایل).

## ۲. ماتریس دسته‌هایی که رفتار متفاوت دارند (۲۳ ردیف — تولیدشده از سورس با اسکریپت)

| Category           | capabilities                            | واحد پیش‌فرض کالای جدید | ستون اضافهٔ فاکتور | ترتیب داشبورد              | vocabulary                |
| ------------------ | --------------------------------------- | ----------------------- | ------------------ | -------------------------- | ------------------------- |
| jewellery          | measurement, weight_pricing, multi_unit | gram                    | weightGrams        | custom                     | industry.vocabulary.piece |
| watches            | measurement, multi_unit                 | piece                   | —                  | generic                    | —                         |
| fabric             | measurement, multi_unit                 | meter                   | —                  | generic                    | —                         |
| hardware           | measurement, multi_unit                 | kg                      | —                  | generic                    | —                         |
| buildingMaterials  | measurement, multi_unit                 | kg                      | —                  | generic                    | —                         |
| timber             | measurement, multi_unit                 | meter                   | —                  | generic                    | —                         |
| fuel               | measurement, multi_unit                 | liter                   | —                  | generic                    | —                         |
| spices             | measurement, multi_unit                 | gram                    | —                  | generic                    | —                         |
| grocery            | multi_unit                              | piece                   | —                  | generic                    | —                         |
| pharmacy           | batch_expiry, multi_unit                | piece                   | —                  | generic                    | —                         |
| clothing           | variants                                | piece                   | —                  | generic                    | —                         |
| shoes              | variants                                | piece                   | —                  | generic                    | —                         |
| electronics        | serialized_items, variants              | piece                   | —                  | generic                    | —                         |
| computers          | serialized_items, variants              | piece                   | —                  | generic                    | —                         |
| mobilePhones       | serialized_items, variants              | piece                   | —                  | generic                    | —                         |
| computerComponents | serialized_items, variants              | piece                   | —                  | generic                    | —                         |
| autoParts          | auto_fitments                           | piece                   | —                  | generic                    | —                         |
| carDealer          | serialized_items, auto_fitments         | piece                   | —                  | generic                    | —                         |
| restaurant         | —                                       | piece                   | —                  | custom                     | industry.vocabulary.dish  |
| cafe               | —                                       | piece                   | —                  | custom                     | industry.vocabulary.drink |
| fabricRoll         | measurement, multi_unit                 | meter                   | —                  | generic                    | —                         |
| tailoring          | measurement                             | meter                   | —                  | generic                    | —                         |
| manufacturing      | multi_unit                              | piece                   | —                  | custom (manufacturing اول) | —                         |

(منبع داده: `OVERRIDES` در `industry-profiles.ts`؛ ستون «generic» یعنی همان ترتیب `GENERIC_DASHBOARD`.)

## ۳. ستون‌های درخواستی: چه چیزی واقعاً از دسته تأثیر می‌گیرد

| بُعد                         | تغییر می‌کند؟                                                                                                          | شاهد                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| فیلد DB نوشته‌شده            | `profiles.business_types` (آنلاین) / `workspace.business_types` (آفلاین) + `store_size`, `business_note`               | [01](01-ONBOARDING-FLOW.md)                                                               |
| منوی ناوبری                  | **خیر** — grep مصرف‌کنندگان: هیچ فایل `navigation.ts`/`nav-items.ts` از `useBusinessProfile`/`businessTypes` نمی‌خواند | NOT_IMPLEMENTED (grep: ۱۰ مصرف‌کنندهٔ UI، همه در جدول ۴)                                  |
| ماژول فعال/پنهان             | **خیر** — طبق قرارداد فایل ("never hides a module")                                                                    | VERIFIED_SOURCE                                                                           |
| واژگان                       | فقط ۳ مورد: `restaurant`→dish، `cafe`→drink، `jewellery`→piece؛ فقط در فرم افزودن کالا                                 | `add-product-modal.tsx:238-239`                                                           |
| ویجت/ترتیب داشبورد           | بله، **ترتیب** بخش‌ها (نه محتوا)؛ اگر کاربر «سفارشی‌سازی» کرده باشد نادیده گرفته می‌شود                                | `dashboard-container.tsx:83-84` (`look.customized ? DASHBOARD_PARTS : profile.dashboard`) |
| پیش‌فرض‌ها                   | واحد کالای جدید و ستون‌های اضافهٔ فاکتورساز                                                                            | `add-product-modal.tsx:65-76`، `invoice-builder-container.tsx:65,125`                     |
| نمایش قابلیت‌های کالا        | تب‌های variants / auto_fitments / serialized_items در جزئیات انبار                                                     | `warehouse-detail-container.tsx:119,323-329`                                              |
| ارز / مالیات / سرفصل حساب‌ها | **خیر** — هیچ مصرف‌کنندهٔ `business_types` در `backend/src` جز `auth.routes.ts` و `profile-write.ts`                   | grep سراسری بک‌اند                                                                        |
| نقش/مجوز پیش‌فرض             | **خیر**                                                                                                                | طبق قرارداد فایل + grep                                                                   |
| انبار/صندوق/seed             | **خیر** — هیچ seed وابسته به دسته پیدا نشد                                                                             | grep                                                                                      |
| `store_size`                 | فقط ذخیره می‌شود؛ مصرف‌کننده‌ای جز تحلیلات (`trackOnboardingCompleted`) پیدا نشد                                       | `packages/analytics/src/posthog.ts:43` — `LIMITED`                                        |
| بنچمارک همتا                 | `peer-benchmark.tsx` و `benchmark.domain.ts` صریحاً می‌گویند «صنعت/بازار» را ادعا نمی‌کنند (کامنت `:73`)               | عدم مصرف                                                                                  |

## ۴. فهرست کامل مصرف‌کنندگان مقدار دسته (از grep)

1. `packages/ui/src/hooks/use-business-profile.ts:21-29` — تنها خواننده؛ `resolveBusinessProfile(businessTypes)`؛ هنگام بارگذاری/ناشناخته → پروفایل generic.
2. `dashboard-container.tsx:83` · 3. `invoice-builder-container.tsx:65` · 4. `add-product-modal.tsx:65` · 5. `warehouse-detail-container.tsx:119`.
3. `packages/ui/src/components/ui/settings/industry-profile-section.tsx` و `packages/app-shell/src/features/settings/settings-page.tsx` — ویرایش (فقط owner: `industry-edit-access.ts:20`).
4. `packages/ui/src/lib/industry-support-note.ts` — جملهٔ صادقانهٔ «این دسته چه دارد».
5. `packages/store/src/slices/auth.slice.ts`، `packages/auth-core/src/types.ts` — فقط حمل مقدار روی user.
6. بک‌اند: فقط ذخیرهٔ پروفایل. آفلاین: `me.ts` و `workspace.ts` در local-engine.
7. لندینگ: `journey-industries.ts` (نمایشی؛ ربطی به داده ندارد).

## ۵. حکم

`CATEGORY_PERSONALIZATION: LIMITED` — دسته فقط «تأکید» می‌دهد: ۲۳ از ۶۶ کلید تجربهٔ متفاوت دارند و تفاوت‌ها به واحد پیش‌فرض، چند ستون/تب، ترتیب داشبورد و سه واژه محدود است. ناوبری، مجوز، سرفصل حساب، مالیات، انبار و seed تابع دسته نیستند.

⚠️ اختلاف: آنلاین روی کاربر ذخیره می‌شود و آفلاین روی workspace؛ کاربری که از آفلاین به ابر می‌رود، اگر مسیر `cloud-migration` فیلد را حمل نکند، دسته را از دست می‌دهد — حمل آن در این نقشه **NOT_VERIFIED**.

اجرای زنده (قبل/بعد) روی workspace آزمایشی: NOT_VERIFIED — workspace تأییدشدهٔ تست در دسترس نبود.
