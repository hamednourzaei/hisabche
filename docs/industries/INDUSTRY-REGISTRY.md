# رجیستری اصناف حسابچه (Industry Registry)

<!-- GENERATED — دستی ویرایش نکن. ایجادشده توسط scripts/industry/generate-industry-registry.mjs -->

این سند جدول تجمیعی و مرجع رسمی ۶۷ صنف/مدل تعریف‌شده در سیستم حسابچه است که هویت، طبقه‌بندی، مدل اولیه (Archetype)، الگوی DNA عملیاتی، قابلیت‌های فعال/ناقص/برنامه‌ریزی‌شده، **نیازمندی‌های هر صنف** (مستقل از وضعیت پیاده‌سازی) و بسته‌های ویژگی (Feature Packs) مربوط به هر کدام را به طور کامل ثبت و قفل می‌کند.

## خلاصه رجیستری

| شاخص | مقدار |
| :--- | :--- |
| **تعداد کل اصناف و مدل‌های ثبت‌شده** | **67** |
| **مدل‌های فروش اصلی (Onboarding Cards)** | **۲** (`retail`, `wholesale`) |
| **اصناف تخصصی (Searchable Trades)** | **۶۴** |
| **صنف سایر (Escape Hatch)** | **۱** (`other`) |
| **پوشش برچسب‌های سه‌زبانه (fa / af / en)** | **۱۰۰٪ (67/67)** |

---

## جدول جامع اصناف (۶۷ صنف)

| # | id | برچسب (fa / af / en) | طبقه‌بندی | Archetype | Preset DNA | قابلیت‌ها (available / partial / planned) | نیازمندی‌ها (available / partial / planned) | Feature Packs |
| :---: | :--- | :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | `retail` | خرده‌فروشی / خرده‌فروشی / Retail | مدل فروش | `RETAIL_STORE` | `RETAIL_STORE` | — | — | `core` |
| 2 | `wholesale` | عمده‌فروشی / عمده‌فروشی / Wholesale | مدل فروش | `RETAIL_STORE` | `RETAIL_STORE` | — | — | `core` |
| 3 | `grocery` | خواروبار و سوپرمارکت / خواروبار و سوپرمارکت / Grocery and supermarket | صنف | `RETAIL_STORE` | `RETAIL_STORE` | available: multi_unit | partial: batch_expiry | `core` |
| 4 | `bakery` | نانوایی و قنادی / نانوایی و قنادی / Bakery and confectionery | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | — | partial: recipe_bom, batch_expiry · planned: production_batch | `core` |
| 5 | `butcher` | قصابی / قصابی / Butcher | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit · partial: batch_expiry | — | `core` |
| 6 | `restaurant` | رستوران / رستوران / Restaurant | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | — | partial: recipe_bom · planned: table_service, production_batch | `core` |
| 7 | `cafe` | کافه و قهوه‌خانه / کافه و قهوه‌خانه / Cafe and teahouse | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | — | partial: recipe_bom · planned: table_service, production_batch | `core` |
| 8 | `fruitVegetable` | میوه و سبزی / میوه و سبزی / Fruit and vegetables | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | partial: batch_expiry | `core` |
| 9 | `dairy` | لبنیات / لبنیات / Dairy | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit · partial: batch_expiry | — | `core` |
| 10 | `nuts` | خشکبار و آجیل / خشکبار و آجیل / Dried fruit and nuts | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | — | `core` |
| 11 | `spices` | عطاری و ادویه / عطاری و ادویه / Herbs and spices | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | — | `core` |
| 12 | `jewellery` | طلا و جواهر / طلا و جواهر / Gold and jewellery | صنف | `RETAIL_STORE` | `RETAIL_STORE` | available: measurement, weight_pricing, multi_unit | partial: gold_purity, making_charges, gold_trade | `core` |
| 13 | `watches` | ساعت / ساعت / Watches | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | partial: serialized_items, warranty_claims | `core` |
| 14 | `currencyExchange` | صرافی / صرافی / Currency exchange | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | partial: currency_exchange | — | `core` |
| 15 | `clothing` | پوشاک / پوشاک / Clothing | صنف | `RETAIL_STORE` | `RETAIL_STORE` | partial: variants | — | `core` |
| 16 | `fabric` | پارچه متری و خرازی / پارچه متری و خرازی / Fabric by the metre and haberdashery | صنف | `RETAIL_STORE` | `RETAIL_STORE` | available: measurement, multi_unit | partial: length_pricing · planned: roll_cutting | `core` |
| 17 | `fabricRoll` | رول پارچه (عمده) / رول پارچه (عمده) / Fabric rolls (wholesale) | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | partial: length_pricing · planned: roll_cutting | `core` |
| 18 | `shoes` | کفش / کفش / Shoes | صنف | `RETAIL_STORE` | `RETAIL_STORE` | partial: variants | — | `core` |
| 19 | `carpet` | فرش و قالین / فرش و قالین / Carpets and rugs | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit · partial: variants | partial: area_pricing · planned: roll_cutting | `core` |
| 20 | `tailoring` | خیاطی / خیاطی / Tailoring | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement | partial: length_pricing | `core` |
| 21 | `mobilePhones` | موبایل و لوازم جانبی / موبایل و لوازم جانبی / Mobile phones and accessories | صنف | `RETAIL_STORE` | `RETAIL_STORE` | partial: serialized_items, variants | partial: warranty_claims | `core` |
| 22 | `computers` | کامپیوتر و لپ‌تاپ / کامپیوتر و لپ‌تاپ / Computers and laptops | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | partial: serialized_items, variants | partial: warranty_claims | `core` |
| 23 | `computerComponents` | قطعات کامپیوتر / قطعات کمپیوتر / Computer components | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | partial: serialized_items, variants | partial: warranty_claims | `core` |
| 24 | `electronics` | لوازم برقی و الکترونیک / لوازم برقی و الکترونیک / Electronics and appliances | صنف | `RETAIL_STORE` | `RETAIL_STORE` | partial: serialized_items, variants | partial: warranty_claims | `core` |
| 25 | `itServices` | خدمات کامپیوتری / خدمات کامپیوتری / IT services | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | — | partial: work_queue_sla, contracts_recurring | `core` |
| 26 | `hardware` | آهن‌فروشی و ابزار / آهن‌فروشی و ابزار / Hardware and tools | صنف | `RETAIL_STORE` | `RETAIL_STORE` | available: measurement, multi_unit | partial: tiered_pricing | `core` |
| 27 | `buildingMaterials` | مواد ساختمانی / مواد ساختمانی / Building materials | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | partial: tiered_pricing, area_pricing | `core` |
| 28 | `paint` | رنگ و ابزار نقاشی / رنگ و ابزار نقاشی / Paint and decorating | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit · partial: variants | partial: volume_pricing | `core` |
| 29 | `timber` | چوب و الوار / چوب و الوار / Timber | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | partial: length_pricing · planned: roll_cutting | `core` |
| 30 | `glass` | شیشه و آلومینیوم / شیشه و آلومینیوم / Glass and aluminium | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | partial: area_pricing | `core` |
| 31 | `construction` | ساخت‌وساز و پیمانکاری / ساخت‌وساز و پیمانکاری / Construction and contracting | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | — | `core` |
| 32 | `manufacturing` | تولیدی و کارگاه / تولیدی و کارگاه / Manufacturing and workshop | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit | partial: recipe_bom, quality_inspection, cost_allocation · planned: production_batch | `core` |
| 33 | `autoParts` | قطعات موتر و یدکی / قطعات موتر و یدکی / Auto parts and spares | صنف | `RETAIL_STORE` | `RETAIL_STORE` | partial: auto_fitments | partial: warranty_claims | `core` |
| 34 | `carDealer` | نمایشگاه موتر / نمایشگاه موتر / Car dealership | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | partial: serialized_items, auto_fitments | partial: warranty_claims | `core` |
| 35 | `mechanic` | مکانیکی و سرویس / مکانیکی و سرویس / Mechanic and servicing | صنف | `SERVICE_REPAIR` | `SERVICE_REPAIR` | — | partial: work_queue_sla, warranty_claims | `core` |
| 36 | `fuel` | تیل‌فروشی و گاز / تیل‌فروشی و گاز / Fuel and gas | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | partial: volume_pricing · planned: fuel_tank_reconciliation | `core` |
| 37 | `furniture` | مبل و اثاثیه / مبل و اثاثیه / Furniture | صنف | `RETAIL_STORE` | `RETAIL_STORE` | available: multi_unit · partial: variants | — | `core` |
| 38 | `kitchenware` | ظروف و لوازم آشپزخانه / ظروف و لوازم آشپزخانه / Kitchenware | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | — | — | `core` |
| 39 | `homeAppliances` | لوازم خانگی / لوازم خانگی / Home appliances | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | partial: serialized_items, variants | partial: warranty_claims | `core` |
| 40 | `stationery` | لوازم‌التحریر و کتاب / لوازم‌التحریر و کتاب / Stationery and books | صنف | `RETAIL_STORE` | `RETAIL_STORE` | available: multi_unit | — | `core` |
| 41 | `toys` | اسباب‌بازی / اسباب‌بازی / Toys | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit · partial: variants | — | `core` |
| 42 | `giftShop` | کادو و تزئینات / کادو و تزئینات / Gifts and decorations | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit | — | `core` |
| 43 | `pharmacy` | دواخانه و داروخانه / دواخانه و داروخانه / Pharmacy | صنف | `RETAIL_STORE` | `RETAIL_STORE` | available: multi_unit · partial: batch_expiry | planned: pharmacy_prescription, pharmacy_dispensing, insurance_claims | `core` |
| 44 | `cosmetics` | لوازم آرایشی و بهداشتی / لوازم آرایشی و بهداشتی / Cosmetics and toiletries | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit · partial: batch_expiry, variants | — | `core` |
| 45 | `clinic` | کلینیک و مطب / کلینیک و مطب / Clinic and surgery | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | — | partial: resource_capacity | `core` |
| 46 | `barber` | آرایشگاه و سلمانی / آرایشگاه و سلمانی / Barber and salon | صنف | `NAIL_TECH_BEAUTY` | `NAIL_TECH_BEAUTY` | — | partial: resource_capacity | `core` |
| 47 | `beautySalon` | ناخن و سالن زیبایی / ناخن و سالون زیبایی / Nails and beauty salon | صنف | `SALON_MULTI_STAFF` | `SALON_MULTI_STAFF` | — | partial: resource_capacity | `core` |
| 48 | `optician` | عینک‌فروشی / عینک‌فروشی / Optician | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit · partial: batch_expiry, serialized_items | planned: optical_prescription, lens_order | `core` |
| 49 | `agriculture` | زراعت و کشاورزی / زراعت و کشاورزی / Agriculture and farming | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit · partial: batch_expiry | planned: crop_cycle | `core` |
| 50 | `livestock` | مالداری و دامداری / مالداری و دامداری / Livestock | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit · partial: serialized_items | planned: livestock_register | `core` |
| 51 | `seedsFertilizer` | تخم و کود / تخم و کود / Seeds and fertiliser | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit · partial: batch_expiry | — | `core` |
| 52 | `flowers` | گل و گیاه / گل و گیاه / Flowers and plants | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit | — | `core` |
| 53 | `transport` | ترانسپورت و باربری / ترانسپورت و باربری / Transport and freight | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit | partial: fleet_dispatch, delivery_pod | `core` |
| 54 | `freightTransport` | حمل بار و باربری / حمل بار و باربری / Freight and cargo transport | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | partial: fleet_dispatch, delivery_pod | `core` |
| 55 | `passengerTransport` | مسافربری / مسافربری / Passenger transport | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit | partial: fleet_dispatch | `core` |
| 56 | `courier` | پیک و تحویل بسته / پیک و رساندن بسته / Courier and delivery | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | — | partial: fleet_dispatch, delivery_pod | `core` |
| 57 | `travelAgency` | آژانس مسافرتی / آژانس مسافرتی / Travel agency | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit | partial: deposits_liability, installments | `core` |
| 58 | `realEstate` | املاک و مشاورین / املاک و مشاورین / Real estate | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | partial: contracts_recurring · planned: asset_rental | `core` |
| 59 | `printing` | چاپ و تبلیغات / چاپ و تبلیغات / Printing and advertising | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | planned: print_job, production_batch | `core` |
| 60 | `photography` | عکاسی و فیلم‌برداری / عکاسی و فیلم‌برداری / Photography and video | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit | partial: resource_capacity, deposits_liability | `core` |
| 61 | `education` | آموزشگاه و کورس / آموزشگاه و کورس / Training and courses | صنف | `LANGUAGE_TEACHER` | `LANGUAGE_TEACHER` | partial: package_credits | partial: installments | `core, workforce` |
| 62 | `laundry` | خشک‌شویی / خشک‌شویی / Dry cleaning | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit | partial: work_queue_sla · planned: laundry_item_tracking | `core` |
| 63 | `repairs` | تعمیرات / تعمیرات / Repairs | صنف | `SERVICE_REPAIR` | `SERVICE_REPAIR` | partial: work_queue_sla | partial: warranty_claims | `core, workforce` |
| 64 | `wedding` | تالار و خدمات عروسی / تالار و خدمات عروسی / Wedding venue and services | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | — | partial: resource_capacity, deposits_liability, contracts_recurring | `core` |
| 65 | `security` | خدمات امنیتی / خدمات امنیتی / Security services | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit | partial: contracts_recurring | `core` |
| 66 | `consulting` | مشاوره و حسابداری / مشاوره و حسابداری / Consulting and accounting | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | — | partial: project_costing, timesheet_billing, contracts_recurring | `core` |
| 67 | `other` | کسب‌وکارت پیدا نشد؟ (سایر) / تجارتت پیدا نشد؟ (سایر) / Business not listed? (Other) | سایر | `GENERIC_BUSINESS` | `RETAIL_STORE` | — | — | `core` |
