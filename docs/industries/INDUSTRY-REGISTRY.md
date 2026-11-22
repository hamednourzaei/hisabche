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

| # | id | برچسب (fa / af / en) | طبقه‌بندی | Archetype | Preset DNA | قابلیت‌ها (available / partial / planned) | نیازمندی‌ها (available / partial / planned) | Feature Packs | عمل‌گرای اصلی |
| :---: | :--- | :--- | :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `retail` | خرده‌فروشی / خرده‌فروشی / Retail | مدل فروش | `RETAIL_STORE` | `RETAIL_STORE` | — | — | `core` | `everyday_sales` |
| 2 | `wholesale` | عمده‌فروشی / عمده‌فروشی / Wholesale | مدل فروش | `RETAIL_STORE` | `RETAIL_STORE` | — | — | `core` | `wholesale_measurement` |
| 3 | `grocery` | خواروبار و سوپرمارکت / خواروبار و سوپرمارکت / Grocery and supermarket | صنف | `RETAIL_STORE` | `RETAIL_STORE` | available: multi_unit | partial: batch_expiry | `core` | `everyday_sales` |
| 4 | `bakery` | نانوایی و قنادی / نانوایی و قنادی / Bakery and confectionery | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | — | partial: recipe_bom, batch_expiry · planned: production_batch | `core` | `food_recipe` |
| 5 | `butcher` | قصابی / قصابی / Butcher | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit · partial: batch_expiry | — | `core` | `food_recipe` |
| 6 | `restaurant` | رستوران / رستوران / Restaurant | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | — | partial: table_service, recipe_bom · planned: production_batch | `core` | `food_recipe` |
| 7 | `cafe` | کافه و قهوه‌خانه / کافه و قهوه‌خانه / Cafe and teahouse | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | — | partial: table_service, recipe_bom · planned: production_batch | `core` | `food_recipe` |
| 8 | `fruitVegetable` | میوه و سبزی / میوه و سبزی / Fruit and vegetables | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | partial: batch_expiry | `core` | `everyday_sales` |
| 9 | `dairy` | لبنیات / لبنیات / Dairy | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit · partial: batch_expiry | — | `core` | `food_recipe` |
| 10 | `nuts` | خشکبار و آجیل / خشکبار و آجیل / Dried fruit and nuts | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | — | `core` | `everyday_sales` |
| 11 | `spices` | عطاری و ادویه / عطاری و ادویه / Herbs and spices | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | partial: batch_expiry | `core` | `everyday_sales` |
| 12 | `jewellery` | طلا و جواهر / طلا و جواهر / Gold and jewellery | صنف | `RETAIL_STORE` | `RETAIL_STORE` | available: measurement, weight_pricing, multi_unit | partial: gold_purity, making_charges, gold_trade | `core` | `value_trade` |
| 13 | `watches` | ساعت / ساعت / Watches | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | partial: serialized_items, warranty_claims | `core` | `sku_serial` |
| 14 | `currencyExchange` | صرافی / صرافی / Currency exchange | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | partial: currency_exchange | — | `core` | `value_trade` |
| 15 | `clothing` | پوشاک / پوشاک / Clothing | صنف | `RETAIL_STORE` | `RETAIL_STORE` | partial: variants | — | `core` | `sku_serial` |
| 16 | `fabric` | پارچه متری و خرازی / پارچه متری و خرازی / Fabric by the metre and haberdashery | صنف | `RETAIL_STORE` | `RETAIL_STORE` | available: measurement, multi_unit, length_pricing | available: length_pricing · planned: roll_cutting | `core` | `wholesale_measurement` |
| 17 | `fabricRoll` | رول پارچه (عمده) / رول پارچه (عمده) / Fabric rolls (wholesale) | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit, length_pricing | available: length_pricing · planned: roll_cutting | `core` | `wholesale_measurement` |
| 18 | `shoes` | کفش / کفش / Shoes | صنف | `RETAIL_STORE` | `RETAIL_STORE` | partial: variants | — | `core` | `sku_serial` |
| 19 | `carpet` | فرش و قالین / فرش و قالین / Carpets and rugs | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit · partial: variants | partial: area_pricing · planned: roll_cutting | `core` | `wholesale_measurement` |
| 20 | `tailoring` | خیاطی / خیاطی / Tailoring | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement | available: length_pricing | `core` | `wholesale_measurement` |
| 21 | `mobilePhones` | موبایل و لوازم جانبی / موبایل و لوازم جانبی / Mobile phones and accessories | صنف | `RETAIL_STORE` | `RETAIL_STORE` | partial: serialized_items, variants | partial: warranty_claims, work_queue_sla | `core` | `sku_serial` |
| 22 | `computers` | کامپیوتر و لپ‌تاپ / کامپیوتر و لپ‌تاپ / Computers and laptops | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | partial: serialized_items, variants | partial: warranty_claims | `core` | `sku_serial` |
| 23 | `computerComponents` | قطعات کامپیوتر / قطعات کمپیوتر / Computer components | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | partial: serialized_items, variants | partial: warranty_claims | `core` | `sku_serial` |
| 24 | `electronics` | لوازم برقی و الکترونیک / لوازم برقی و الکترونیک / Electronics and appliances | صنف | `RETAIL_STORE` | `RETAIL_STORE` | partial: serialized_items, variants | partial: warranty_claims | `core` | `sku_serial` |
| 25 | `itServices` | خدمات کامپیوتری / خدمات کامپیوتری / IT services | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | — | partial: work_queue_sla, contracts_recurring | `core` | `repair_ticket` |
| 26 | `hardware` | آهن‌فروشی و ابزار / آهن‌فروشی و ابزار / Hardware and tools | صنف | `RETAIL_STORE` | `RETAIL_STORE` | available: measurement, multi_unit | partial: tiered_pricing | `core` | `wholesale_measurement` |
| 27 | `buildingMaterials` | مواد ساختمانی / مواد ساختمانی / Building materials | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | partial: tiered_pricing, area_pricing | `core` | `wholesale_measurement` |
| 28 | `paint` | رنگ و ابزار نقاشی / رنگ و ابزار نقاشی / Paint and decorating | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit · partial: variants | partial: volume_pricing | `core` | `wholesale_measurement` |
| 29 | `timber` | چوب و الوار / چوب و الوار / Timber | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit, length_pricing | available: length_pricing · planned: roll_cutting | `core` | `wholesale_measurement` |
| 30 | `glass` | شیشه و آلومینیوم / شیشه و آلومینیوم / Glass and aluminium | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | partial: area_pricing | `core` | `wholesale_measurement` |
| 31 | `construction` | ساخت‌وساز و پیمانکاری / ساخت‌وساز و پیمانکاری / Construction and contracting | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | partial: project_costing, timesheet_billing, deposits_liability | `core` | `production_project_land` |
| 32 | `manufacturing` | تولیدی و کارگاه / تولیدی و کارگاه / Manufacturing and workshop | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit | partial: recipe_bom, quality_inspection, cost_allocation · planned: production_batch | `core` | `production_project_land` |
| 33 | `autoParts` | قطعات موتر و یدکی / قطعات موتر و یدکی / Auto parts and spares | صنف | `RETAIL_STORE` | `RETAIL_STORE` | partial: auto_fitments | partial: warranty_claims | `core` | `sku_serial` |
| 34 | `carDealer` | نمایشگاه موتر / نمایشگاه موتر / Car dealership | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | partial: serialized_items, auto_fitments | partial: warranty_claims | `core` | `sku_serial` |
| 35 | `mechanic` | مکانیکی و سرویس / مکانیکی و سرویس / Mechanic and servicing | صنف | `SERVICE_REPAIR` | `SERVICE_REPAIR` | — | partial: work_queue_sla, warranty_claims | `core` | `repair_ticket` |
| 36 | `fuel` | تیل‌فروشی و گاز / تیل‌فروشی و گاز / Fuel and gas | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | partial: volume_pricing · planned: fuel_tank_reconciliation | `core` | `wholesale_measurement` |
| 37 | `furniture` | مبل و اثاثیه / مبل و اثاثیه / Furniture | صنف | `RETAIL_STORE` | `RETAIL_STORE` | available: multi_unit · partial: variants | — | `core` | `sku_serial` |
| 38 | `kitchenware` | ظروف و لوازم آشپزخانه / ظروف و لوازم آشپزخانه / Kitchenware | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | — | — | `core` | `everyday_sales` |
| 39 | `homeAppliances` | لوازم خانگی / لوازم خانگی / Home appliances | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | partial: serialized_items, variants | partial: warranty_claims | `core` | `sku_serial` |
| 40 | `stationery` | لوازم‌التحریر و کتاب / لوازم‌التحریر و کتاب / Stationery and books | صنف | `RETAIL_STORE` | `RETAIL_STORE` | available: multi_unit | — | `core` | `everyday_sales` |
| 41 | `toys` | اسباب‌بازی / اسباب‌بازی / Toys | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit · partial: variants | — | `core` | `sku_serial` |
| 42 | `giftShop` | کادو و تزئینات / کادو و تزئینات / Gifts and decorations | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit | — | `core` | `everyday_sales` |
| 43 | `pharmacy` | دواخانه و داروخانه / دواخانه و داروخانه / Pharmacy | صنف | `RETAIL_STORE` | `RETAIL_STORE` | available: multi_unit · partial: batch_expiry | planned: pharmacy_prescription, pharmacy_dispensing, insurance_claims | `core` | `health` |
| 44 | `cosmetics` | لوازم آرایشی و بهداشتی / لوازم آرایشی و بهداشتی / Cosmetics and toiletries | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit · partial: batch_expiry, variants | — | `core` | `everyday_sales` |
| 45 | `clinic` | کلینیک و مطب / کلینیک و مطب / Clinic and surgery | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | — | partial: resource_capacity · planned: clinical_record, health_data_access | `core` | `health` |
| 46 | `barber` | آرایشگاه و سلمانی / آرایشگاه و سلمانی / Barber and salon | صنف | `NAIL_TECH_BEAUTY` | `NAIL_TECH_BEAUTY` | — | partial: resource_capacity | `core` | `booking_services` |
| 47 | `beautySalon` | ناخن و سالن زیبایی / ناخن و سالون زیبایی / Nails and beauty salon | صنف | `SALON_MULTI_STAFF` | `SALON_MULTI_STAFF` | — | partial: resource_capacity | `core` | `booking_services` |
| 48 | `optician` | عینک‌فروشی / عینک‌فروشی / Optician | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit · partial: batch_expiry, serialized_items | planned: optical_prescription, lens_order | `core` | `health` |
| 49 | `agriculture` | زراعت و کشاورزی / زراعت و کشاورزی / Agriculture and farming | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit · partial: batch_expiry | planned: crop_cycle | `core` | `production_project_land` |
| 50 | `livestock` | مالداری و دامداری / مالداری و دامداری / Livestock | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit · partial: serialized_items | planned: livestock_register | `core` | `production_project_land` |
| 51 | `seedsFertilizer` | تخم و کود / تخم و کود / Seeds and fertiliser | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit · partial: batch_expiry | — | `core` | `wholesale_measurement` |
| 52 | `flowers` | گل و گیاه / گل و گیاه / Flowers and plants | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit | partial: batch_expiry | `core` | `everyday_sales` |
| 53 | `transport` | ترانسپورت و باربری / ترانسپورت و باربری / Transport and freight | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit | partial: fleet_dispatch, delivery_pod | `core` | `transport_travel` |
| 54 | `freightTransport` | حمل بار و باربری / حمل بار و باربری / Freight and cargo transport | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | partial: fleet_dispatch, delivery_pod | `core` | `transport_travel` |
| 55 | `passengerTransport` | مسافربری / مسافربری / Passenger transport | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit | partial: fleet_dispatch | `core` | `transport_travel` |
| 56 | `courier` | پیک و تحویل بسته / پیک و رساندن بسته / Courier and delivery | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | — | partial: fleet_dispatch, delivery_pod | `core` | `transport_travel` |
| 57 | `travelAgency` | آژانس مسافرتی / آژانس مسافرتی / Travel agency | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit | partial: deposits_liability, installments · planned: travel_booking, supplier_settlement | `core` | `transport_travel` |
| 58 | `realEstate` | املاک و مشاورین / املاک و مشاورین / Real estate | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | partial: contracts_recurring · planned: asset_rental | `core` | `production_project_land` |
| 59 | `printing` | چاپ و تبلیغات / چاپ و تبلیغات / Printing and advertising | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: measurement, multi_unit | planned: print_job, production_batch | `core` | `production_project_land` |
| 60 | `photography` | عکاسی و فیلم‌برداری / عکاسی و فیلم‌برداری / Photography and video | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit | partial: resource_capacity, deposits_liability | `core` | `booking_services` |
| 61 | `education` | آموزشگاه و کورس / آموزشگاه و کورس / Training and courses | صنف | `LANGUAGE_TEACHER` | `LANGUAGE_TEACHER` | partial: package_credits | partial: installments | `core, workforce` | `booking_services` |
| 62 | `laundry` | خشک‌شویی / خشک‌شویی / Dry cleaning | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit | partial: work_queue_sla · planned: laundry_item_tracking | `core` | `booking_services` |
| 63 | `repairs` | تعمیرات / تعمیرات / Repairs | صنف | `SERVICE_REPAIR` | `SERVICE_REPAIR` | partial: work_queue_sla | partial: warranty_claims | `core, workforce` | `repair_ticket` |
| 64 | `wedding` | تالار و خدمات عروسی / تالار و خدمات عروسی / Wedding venue and services | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | — | partial: resource_capacity, deposits_liability, contracts_recurring | `core` | `booking_services` |
| 65 | `security` | خدمات امنیتی / خدمات امنیتی / Security services | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | available: multi_unit | partial: contracts_recurring | `core` | `production_project_land` |
| 66 | `consulting` | مشاوره و حسابداری / مشاوره و حسابداری / Consulting and accounting | صنف | `GENERIC_BUSINESS` | `RETAIL_STORE` | — | partial: project_costing, timesheet_billing, contracts_recurring | `core` | `production_project_land` |
| 67 | `other` | کسب‌وکارت پیدا نشد؟ (سایر) / تجارتت پیدا نشد؟ (سایر) / Business not listed? (Other) | سایر | `GENERIC_BUSINESS` | `RETAIL_STORE` | — | — | `core` | `generic` |


---

## ساختار هسته، عمل‌گرا و صنف

«هسته» مالک قواعد مشترک است، «عمل‌گرا» یک گردش عملیاتی مشخص، و «صنف» کسب‌وکاری است که از آن گردش استفاده می‌کند. یک صنف از چند هسته استفاده می‌کند؛ ستون «عمل‌گرای اصلی» فقط گردش اصلی هر صنف را نشان می‌دهد، نه همه وابستگی‌هایش.

### هشت هسته مشترک

1. هسته فروش، فاکتور و دریافت پول
2. هسته موجودی، انبار و رهگیری
3. هسته حسابداری، دفتر و بهای تمام‌شده
4. هسته قیمت‌گذاری و واحد اندازه‌گیری
5. هسته طرف حساب، پرداخت و تسویه
6. هسته مجوز، تأیید و Audit
7. هسته آفلاین، همگام‌سازی و حل تعارض
8. هسته گزارش، داشبورد و پیش‌بینی

هسته‌ها یک بار پیاده‌سازی می‌شوند و چند عمل‌گرا و چند صنف از آن‌ها استفاده می‌کنند. هیچ صنفی هسته اختصاصی ندارد؛ تفاوت اصناف در عمل‌گرا و نیازمندی‌های ثبت‌شده است.

### عمل‌گراها و موتورهای درگیر

«موتورهای درگیر» از قابلیت‌های فعال و نیازمندی‌های ثبت‌شده‌ی اصناف همان عمل‌گرا استخراج شده است، نه دستی. «صنف با نیاز برآورده‌نشده» یعنی صنفی که دست‌کم یکی از قابلیت‌ها یا نیازمندی‌های ثبت‌شده‌اش در وضعیت `available` نیست؛ این عدد با وضعیت رسمی `SELLABLE` یکی نیست.

| عمل‌گرا | عنوان | تعداد صنف | اصناف | موتورهای درگیر (از رجیستری) | صنف با نیاز برآورده‌نشده |
| :--- | :--- | ---: | :--- | :--- | ---: |
| `everyday_sales` | فروش روزمره و پیشخوان | 10 | `retail`، `grocery`، `fruitVegetable`، `nuts`، `spices`، `kitchenware`، `stationery`، `giftShop`، `cosmetics`، `flowers` | `inventory_catalog`, `sales_invoice` | 5 از 10 |
| `wholesale_measurement` | عمده‌فروشی و فروش اندازه‌ای | 12 | `wholesale`، `fabric`، `fabricRoll`، `carpet`، `tailoring`، `hardware`، `buildingMaterials`، `paint`، `timber`، `glass`، `fuel`، `seedsFertilizer` | `inventory_catalog`, `pricing_rates`, `sales_invoice` | 10 از 12 |
| `sku_serial` | SKU، سایز و سریال | 12 | `watches`، `clothing`، `shoes`، `mobilePhones`، `computers`، `computerComponents`، `electronics`، `autoParts`، `carDealer`، `furniture`، `homeAppliances`، `toys` | `inventory_catalog`, `quality_claims`, `sales_invoice`, `work_orders_repair` | 12 از 12 |
| `value_trade` | معاملات ارزش‌محور | 2 | `jewellery`، `currencyExchange` | `exchange`, `pricing_rates`, `sales_invoice` | 2 از 2 |
| `food_recipe` | غذا و دستور تهیه | 5 | `bakery`، `butcher`، `restaurant`، `cafe`، `dairy` | `inventory_catalog`, `production_bom`, `sales_invoice`, `sales_orders` | 5 از 5 |
| `health` | سلامت | 3 | `pharmacy`، `clinic`، `optician` | `appointments_resources`, `inventory_catalog`, `sales_invoice` | 3 از 3 |
| `booking_services` | نوبت و خدمات | 6 | `barber`، `beautySalon`، `photography`، `education`، `laundry`، `wedding` | `appointments_resources`, `contracts_recurring`, `deposits_installments`, `package_credits`, `sales_invoice`, `work_orders_repair` | 6 از 6 |
| `repair_ticket` | تعمیر و تیکت | 3 | `itServices`، `mechanic`، `repairs` | `contracts_recurring`, `quality_claims`, `work_orders_repair` | 3 از 3 |
| `production_project_land` | تولید، پروژه و زمین | 8 | `construction`، `manufacturing`، `agriculture`، `livestock`، `realEstate`، `printing`، `security`، `consulting` | `contracts_recurring`, `costing_ledger`, `deposits_installments`, `inventory_catalog`, `production_bom`, `projects_time`, `quality_claims`, `sales_invoice` | 8 از 8 |
| `transport_travel` | حمل‌ونقل و سفر | 5 | `transport`، `freightTransport`، `passengerTransport`، `courier`، `travelAgency` | `delivery_logistics`, `deposits_installments`, `sales_invoice` | 5 از 5 |
| `generic` | مدل عمومی | 1 | `other` | — | 0 از 1 |

`other` فقط پروفایل عمومی است: نه نیازمندی تخصصی دارد و نه ادعای آمادگی صنفی. `retail` و `wholesale` مدل فروش‌اند، نه صنف؛ حضورشان در این جدول فقط برای کامل بودن فهرست است.
