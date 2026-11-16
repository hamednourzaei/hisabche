# V70.0 — اندازه‌گیری و FINDINGS (بدون تغییر کد محصول)

> این سند فقط اندازه‌گیری است. هیچ فایل محصولی در این فاز ویرایش نشد. اعداد از اجرای
> `node scripts/industry/generate-v70-measurements.mjs` روی همین working tree می‌آیند.

## ۱. خط پایه‌ی مخزن

| سنجه                           | عدد     |
| ------------------------------ | ------- |
| فایل route (بک‌اند)            | **125** |
| پوشه سرویس                     | **79**  |
| فایل SQL در `docs/`            | **528** |
| جدول استخراج‌شده از SQL        | **366** |
| کلید `FEATURE_REGISTRY`        | **204** |
| صنف در `INDUSTRY_KEYS`         | **67**  |
| ردیف خوانده‌شده از رجیستری صنف | **67**  |

**پیام اصلی:** محصول بزرگ‌تر از گزارش V68/V69 است. نام routeها نشان می‌دهد payroll، دارایی ثابت،
بانک/خزانه، خرید و RFQ، منابع انسانی، ابعاد، قرارداد و حمل از قبل وجود دارند. پس «۶۰ شکاف» باید از
probe ساخته شود و هر موردی که در کد هست، `PRESENT` علامت بخورد و از فهرست شکاف بیرون بماند.

## ۲. پوشش قابلیت در ۶۷ صنف (از رجیستری تولیدی)

- جمع `available`: **63** · جمع `partial`: **31** · جمع `planned`: **0**
- صنف‌های بدون هیچ قابلیت اختصاصی: **16** (`retail`, `wholesale`, `bakery`, `restaurant`, `cafe`, `currencyExchange`, `itServices`, `mechanic`, `kitchenware`, `clinic`, `barber`, `beautySalon`, `courier`, `wedding`, `consulting`, `other`)
- توزیع archetype: `RETAIL_STORE`=14 · `GENERIC_BUSINESS`=48 · `SERVICE_REPAIR`=2 · `NAIL_TECH_BEAUTY`=1 · `SALON_MULTI_STAFF`=1 · `LANGUAGE_TEACHER`=1

|   # | id                   | archetype           | available | partial | planned |
| --: | -------------------- | ------------------- | --------: | ------: | ------: |
|   1 | `retail`             | `RETAIL_STORE`      |         0 |       0 |       0 |
|   2 | `wholesale`          | `RETAIL_STORE`      |         0 |       0 |       0 |
|   3 | `grocery`            | `RETAIL_STORE`      |         1 |       0 |       0 |
|   4 | `bakery`             | `GENERIC_BUSINESS`  |         0 |       0 |       0 |
|   5 | `butcher`            | `GENERIC_BUSINESS`  |         2 |       1 |       0 |
|   6 | `restaurant`         | `GENERIC_BUSINESS`  |         0 |       0 |       0 |
|   7 | `cafe`               | `GENERIC_BUSINESS`  |         0 |       0 |       0 |
|   8 | `fruitVegetable`     | `GENERIC_BUSINESS`  |         2 |       0 |       0 |
|   9 | `dairy`              | `GENERIC_BUSINESS`  |         1 |       1 |       0 |
|  10 | `nuts`               | `GENERIC_BUSINESS`  |         2 |       0 |       0 |
|  11 | `spices`             | `GENERIC_BUSINESS`  |         2 |       0 |       0 |
|  12 | `jewellery`          | `RETAIL_STORE`      |         3 |       0 |       0 |
|  13 | `watches`            | `GENERIC_BUSINESS`  |         2 |       0 |       0 |
|  14 | `currencyExchange`   | `GENERIC_BUSINESS`  |         0 |       0 |       0 |
|  15 | `clothing`           | `RETAIL_STORE`      |         0 |       1 |       0 |
|  16 | `fabric`             | `RETAIL_STORE`      |         2 |       0 |       0 |
|  17 | `fabricRoll`         | `GENERIC_BUSINESS`  |         2 |       0 |       0 |
|  18 | `shoes`              | `RETAIL_STORE`      |         0 |       1 |       0 |
|  19 | `carpet`             | `GENERIC_BUSINESS`  |         2 |       1 |       0 |
|  20 | `tailoring`          | `GENERIC_BUSINESS`  |         1 |       0 |       0 |
|  21 | `mobilePhones`       | `RETAIL_STORE`      |         0 |       2 |       0 |
|  22 | `computers`          | `GENERIC_BUSINESS`  |         0 |       2 |       0 |
|  23 | `computerComponents` | `GENERIC_BUSINESS`  |         0 |       2 |       0 |
|  24 | `electronics`        | `RETAIL_STORE`      |         0 |       2 |       0 |
|  25 | `itServices`         | `GENERIC_BUSINESS`  |         0 |       0 |       0 |
|  26 | `hardware`           | `RETAIL_STORE`      |         2 |       0 |       0 |
|  27 | `buildingMaterials`  | `GENERIC_BUSINESS`  |         2 |       0 |       0 |
|  28 | `paint`              | `GENERIC_BUSINESS`  |         2 |       1 |       0 |
|  29 | `timber`             | `GENERIC_BUSINESS`  |         2 |       0 |       0 |
|  30 | `glass`              | `GENERIC_BUSINESS`  |         2 |       0 |       0 |
|  31 | `construction`       | `GENERIC_BUSINESS`  |         2 |       0 |       0 |
|  32 | `manufacturing`      | `GENERIC_BUSINESS`  |         1 |       0 |       0 |
|  33 | `autoParts`          | `RETAIL_STORE`      |         0 |       1 |       0 |
|  34 | `carDealer`          | `GENERIC_BUSINESS`  |         0 |       2 |       0 |
|  35 | `mechanic`           | `SERVICE_REPAIR`    |         0 |       0 |       0 |
|  36 | `fuel`               | `GENERIC_BUSINESS`  |         2 |       0 |       0 |
|  37 | `furniture`          | `RETAIL_STORE`      |         1 |       1 |       0 |
|  38 | `kitchenware`        | `GENERIC_BUSINESS`  |         0 |       0 |       0 |
|  39 | `homeAppliances`     | `GENERIC_BUSINESS`  |         0 |       2 |       0 |
|  40 | `stationery`         | `RETAIL_STORE`      |         1 |       0 |       0 |
|  41 | `toys`               | `GENERIC_BUSINESS`  |         1 |       1 |       0 |
|  42 | `giftShop`           | `GENERIC_BUSINESS`  |         1 |       0 |       0 |
|  43 | `pharmacy`           | `RETAIL_STORE`      |         1 |       1 |       0 |
|  44 | `cosmetics`          | `GENERIC_BUSINESS`  |         1 |       2 |       0 |
|  45 | `clinic`             | `GENERIC_BUSINESS`  |         0 |       0 |       0 |
|  46 | `barber`             | `NAIL_TECH_BEAUTY`  |         0 |       0 |       0 |
|  47 | `beautySalon`        | `SALON_MULTI_STAFF` |         0 |       0 |       0 |
|  48 | `optician`           | `GENERIC_BUSINESS`  |         1 |       2 |       0 |
|  49 | `agriculture`        | `GENERIC_BUSINESS`  |         2 |       1 |       0 |
|  50 | `livestock`          | `GENERIC_BUSINESS`  |         2 |       1 |       0 |
|  51 | `seedsFertilizer`    | `GENERIC_BUSINESS`  |         2 |       1 |       0 |
|  52 | `flowers`            | `GENERIC_BUSINESS`  |         1 |       0 |       0 |
|  53 | `transport`          | `GENERIC_BUSINESS`  |         1 |       0 |       0 |
|  54 | `freightTransport`   | `GENERIC_BUSINESS`  |         2 |       0 |       0 |
|  55 | `passengerTransport` | `GENERIC_BUSINESS`  |         1 |       0 |       0 |
|  56 | `courier`            | `GENERIC_BUSINESS`  |         0 |       0 |       0 |
|  57 | `travelAgency`       | `GENERIC_BUSINESS`  |         1 |       0 |       0 |
|  58 | `realEstate`         | `GENERIC_BUSINESS`  |         2 |       0 |       0 |
|  59 | `printing`           | `GENERIC_BUSINESS`  |         2 |       0 |       0 |
|  60 | `photography`        | `GENERIC_BUSINESS`  |         1 |       0 |       0 |
|  61 | `education`          | `LANGUAGE_TEACHER`  |         0 |       1 |       0 |
|  62 | `laundry`            | `GENERIC_BUSINESS`  |         1 |       0 |       0 |
|  63 | `repairs`            | `SERVICE_REPAIR`    |         0 |       1 |       0 |
|  64 | `wedding`            | `GENERIC_BUSINESS`  |         0 |       0 |       0 |
|  65 | `security`           | `GENERIC_BUSINESS`  |         1 |       0 |       0 |
|  66 | `consulting`         | `GENERIC_BUSINESS`  |         0 |       0 |       0 |
|  67 | `other`              | `GENERIC_BUSINESS`  |         0 |       0 |       0 |

## ۳. probe شکاف‌ها: ۱۰۰ کاندید روی چهار فهرست

probe روی نام routeها، پوشه‌های سرویس، جدول‌های SQL و کلیدهای `FEATURE_REGISTRY` اجرا شد.
نتیجه: **30** ردیف با نام منطبق و **70** ردیف بدون هیچ نام منطبق.
`PROBE=۰` یعنی «هیچ route/service/table/feature با این نام نیست» — نه «قابلیت وجود ندارد»؛ V70.1 هر ردیف را با خواندن کد تأیید می‌کند.

| id   | موضوع                      | شرط probe                                                          | route                 | service         | table                                             | feature                                          | حکم         |
| ---- | -------------------------- | ------------------------------------------------------------------ | --------------------- | --------------- | ------------------------------------------------- | ------------------------------------------------ | ----------- |
| G01  | کارت هدیه                  | `gift_card/giftcard/voucher`                                       | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G02  | اعتبار فروشگاه             | `store_credit/credit_note`                                         | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G03  | فروش اقساطی/امانی          | `layaway/hold_sale`                                                | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G04  | انعام و تقسیم آن           | `tip_pool/tips`                                                    | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G05  | حق سرویس                   | `service_charge`                                                   | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G06  | تقسیم صورتحساب             | `split_bill/split_bill`                                            | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G07  | نقشه میز                   | `table_map/table_order/dine_in`                                    | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G08  | نمایشگر آشپزخانه           | `kitchen_display/kds`                                              | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G09  | سفارش آنلاین               | `online_order/web_order`                                           | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G10  | منوی QR                    | `qr_menu/digital_menu`                                             | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G11  | برنامه‌ریزی مسیر           | `route_plan/route_optim/trip_plan`                                 | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G12  | اثبات تحویل                | `proof_of_delivery/pod_signature`                                  | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G13  | اپ راننده                  | `driver_app/driver_shift`                                          | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G14  | تسویه COD                  | `cod_recon/cash_on_delivery`                                       | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G15  | اشتراک مشتری               | `customer_subscription`                                            | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G16  | صورتحساب مصرفی             | `metered/usage_billing`                                            | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G17  | پیگیری بدهی (dunning)      | `dunning/collection_letter`                                        | ۰                     | ۰               | dunning_logs                                      | ۰                                                | **PROBE>۰** |
| G18  | جریمه دیرکرد               | `late_fee`                                                         | late-fees             | ۰               | late_fee_policies, late_fee_assessments           | invoice.late_fee                                 | **PROBE>۰** |
| G19  | پورتال مشتری               | `customer_portal`                                                  | customer-portal       | customer-portal | customer_portal_links                             | customer.portal_link                             | **PROBE>۰** |
| G20  | پورتال تأمین‌کننده         | `vendor_portal/supplier_portal`                                    | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G21  | امضای الکترونیک            | `esign/e_signature`                                                | ۰                     | ۰               | trial_abuse_signals, offline_license_signing_keys | ۰                                                | **PROBE>۰** |
| G22  | مدیریت اسناد               | `document_management/dms`                                          | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G23  | اتصال بانکی (bank feed)    | `bank_feed/open_banking/plaid`                                     | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G24  | قواعد تطبیق بانکی          | `recon_rule/matching_rule`                                         | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G25  | وصول چک                    | `cheque_clear/post_dated/cheque`                                   | ۰                     | ۰               | cheques                                           | payments.cheques                                 | **PROBE>۰** |
| G26  | سفته/برات                  | `promissory/bill_of_exchange`                                      | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G27  | اعتبار اسنادی              | `letter_of_credit`                                                 | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G28  | ضمانت‌نامه بانکی           | `bank_guarantee`                                                   | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G29  | تنخواه                     | `petty_cash`                                                       | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G30  | شمارش نقد صندوق            | `cash_count/till.cash_movement`                                    | ۰                     | ۰               | ۰                                                 | till.cash_movement                               | **PROBE>۰** |
| G31  | گزارش Z                    | `z_report`                                                         | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G32  | تحویل شیفت                 | `shift_handover/shift_close/till.shift_history`                    | ۰                     | ۰               | ۰                                                 | till.shift_history                               | **PROBE>۰** |
| G33  | صورتحساب الکترونیکی/مودیان | `e_invoice/moadian/fiscal_device`                                  | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G34  | اظهارنامه ارزش افزوده      | `vat_return/tax_filing`                                            | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G35  | مالیات حقوق و فیش          | `payroll_tax`                                                      | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G36  | سنوات/پایان خدمت           | `gratuity/end_of_service`                                          | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G37  | برنامه شیفت                | `shift_schedule/roster`                                            | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G38  | حضور بیومتریک              | `biometric`                                                        | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G39  | سوابق آموزش                | `training_record/certification`                                    | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G40  | گزارش حادثه                | `incident_report/safety_incident`                                  | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G41  | بازرسی کیفیت               | `quality_check/inspection`                                         | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G42  | کالیبراسیون                | `calibration`                                                      | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G43  | گارانتی                    | `warranty`                                                         | warranty              | ۰               | warranty_claims                                   | ۰                                                | **PROBE>۰** |
| G44  | مرجوعی کالا (RMA)          | `rma/return_authorization`                                         | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G45  | لیست سیاه IMEI             | `imei_blacklist/blacklist`                                         | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G46  | معاوضه (trade-in)          | `trade_in`                                                         | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G47  | تاریخچه خودرو/VIN          | `vehicle_history/vin`                                              | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G48  | آج لاستیک                  | `tyre/tread`                                                       | ۰                     | ۰               | activity_reads, blog_quality_reports              | ۰                                                | **PROBE>۰** |
| G49  | کارت سوخت                  | `fuel_card`                                                        | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G50  | نگهداری ناوگان             | `fleet/vehicle_maintenance`                                        | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G51  | فرمول ساخت (BOM)           | `bill_of_materials/bom`                                            | ۰                     | ۰               | bom_items, boms                                   | manufacturing.bom                                | **PROBE>۰** |
| G52  | دستور تولید                | `production_order/manufacturing.work_orders/manufacturing.produce` | ۰                     | ۰               | ۰                                                 | manufacturing.work_orders, manufacturing.produce | **PROBE>۰** |
| G53  | برنامه‌ریزی مواد (MRP)     | `mrp/material_requirement`                                         | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G54  | دستور پخت/مواد اولیه       | `recipe/ingredient`                                                | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G55  | ضایعات                     | `wastage/spoilage`                                                 | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G56  | شماره بچ                   | `batch_lot/lot_number/stock.batches/batch`                         | ۰                     | ۰               | stock_batches                                     | stock.batches, expiry.batches…                   | **PROBE>۰** |
| G57  | FEFO                       | `fefo`                                                             | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G58  | قفسه/محل نگهداری           | `bin_location/storage_location`                                    | ۰                     | ۰               | storage_locations, storage_location_placements    | stock.storage_locations                          | **PROBE>۰** |
| G59  | برداشت/بسته‌بندی/ارسال     | `pick_list/pack_ship/wave_pick`                                    | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G60  | چاپ برچسب بارکد            | `label_print/barcode_label`                                        | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G61  | همگام‌سازی مارکت‌پلیس      | `marketplace/shopify/woocommerce/salla/zid`                        | marketplace           | ۰               | marketplace_listings                              | marketplace.apps                                 | **PROBE>۰** |
| G62  | همگام‌سازی فروشگاه آنلاین  | `ecommerce/online_store`                                           | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G63  | کاتالوگ واتساپ             | `whatsapp_catalog/whatsapp`                                        | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G64  | کمپین پیامکی               | `sms_campaign/campaign`                                            | campaigns             | campaigns       | customer_campaigns, campaign_recipients           | ۰                                                | **PROBE>۰** |
| G65  | باشگاه مشتریان/امتیاز      | `loyalty/points_ledger`                                            | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G66  | معرفی دوستان               | `referral`                                                         | referral              | referral        | referral_codes, referrals…                        | referral.program                                 | **PROBE>۰** |
| G67  | حق عضویت                   | `membership_fee`                                                   | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G68  | ظرفیت کلاس                 | `class_capacity/capacity_rule`                                     | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G69  | لیست انتظار                | `waitlist`                                                         | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G70  | قاعده کمیسیون              | `commission_rule/commission`                                       | ۰                     | ۰               | provider_commission_rates, referral_commissions   | hr.commission                                    | **PROBE>۰** |
| G71  | تطبیق سه‌طرفه خرید         | `three_way_match/threeway`                                         | ۰                     | ۰               | ۰                                                 | purchase.three_way_match                         | **PROBE>۰** |
| G72  | امتیاز تأمین‌کننده         | `supplier_score`                                                   | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G73  | سفارش باز (blanket)        | `blanket_order`                                                    | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G74  | درخواست خرید               | `requisition`                                                      | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G75  | موجودی امانی               | `consignment`                                                      | ۰                     | ۰               | consignment_lots                                  | inventory.consignment                            | **PROBE>۰** |
| G76  | ارسال مستقیم (dropship)    | `dropship/drop_ship`                                               | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G77  | اعلان ارسال (ASN)          | `advance_ship/asn`                                                 | ۰                     | ۰               | data_snapshots                                    | data.snapshots                                   | **PROBE>۰** |
| G78  | بهای تمام‌شده رسیده        | `landed_cost`                                                      | ۰                     | ۰               | landed_costs, landed_cost_lines…                  | ۰                                                | **PROBE>۰** |
| G79  | حقوق گمرکی/واردات          | `customs/duty`                                                     | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G80  | تلفیق چند شرکت             | `consolidation/intercompany`                                       | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G81  | قیمت‌گذاری انتقالی         | `transfer_pricing`                                                 | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G82  | سود و زیان شعبه            | `branch_pnl/branch_pl`                                             | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G83  | مرکز هزینه                 | `cost_center/dimension`                                            | ۰                     | dimensions      | accounting_dimensions, dimension_values…          | ۰                                                | **PROBE>۰** |
| G84  | بودجه                      | `budget`                                                           | ۰                     | budgeting       | ai_budgets, budget_revisions…                     | budget.manage                                    | **PROBE>۰** |
| G85  | پیش‌بینی جریان نقد         | `forecast`                                                         | intelligence-forecast | ۰               | ۰                                                 | ai.cashflow_forecast                             | **PROBE>۰** |
| G86  | سناریو                     | `scenario`                                                         | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G87  | گردش تأیید                 | `approval`                                                         | ۰                     | ۰               | approval_policies, approval_policy_requests…      | invoice.approval, approvals.workflows            | **PROBE>۰** |
| G88  | گزارش رخداد                | `audit_log/audit`                                                  | audit                 | ۰               | audit_logs, audit_chain_heads…                    | audit.trail                                      | **PROBE>۰** |
| G89  | ورود یکپارچه (SSO)         | `sso/saml/oidc`                                                    | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G90  | ورود دو مرحله‌ای           | `two_factor/mfa/totp`                                              | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G91  | قفل دستگاه                 | `device_pin/device_lock`                                           | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G92  | محل نگهداری داده           | `residency`                                                        | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G93  | حقوق داده (DSAR)           | `dsar/gdpr`                                                        | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G94  | سیاست نگهداری              | `retention`                                                        | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G95  | اسکن رسید (OCR)            | `ocr/receipt_scan`                                                 | ۰                     | ۰               | ۰                                                 | ocr.receipt                                      | **PROBE>۰** |
| G96  | صورتحساب طرف حساب          | `statement`                                                        | ۰                     | ۰               | statement, bank_statements…                       | ۰                                                | **PROBE>۰** |
| G97  | فهرست قیمت                 | `price_list`                                                       | price-lists           | ۰               | price_lists, price_list_items                     | pricing.price_lists                              | **PROBE>۰** |
| G98  | تخفیف پله‌ای               | `volume_discount/tier_price`                                       | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |
| G99  | کوپن/تخفیف                 | `coupon/promotion`                                                 | promotions            | ۰               | promotions                                        | pricing.promotions                               | **PROBE>۰** |
| G100 | ثبت بیمه‌نامه              | `insurance_policy`                                                 | ۰                     | ۰               | ۰                                                 | ۰                                                | **PROBE=۰** |

## ۴. FINDINGS این فاز

1. **F9 — «۶۰ شکاف» را نمی‌توان از حدس نوشت.** probe نشان می‌دهد بخش بزرگی از کاندیدها در کد هستند؛
   هر ادعای غیبت باید چهار فهرست را صفر بدهد. V70.1 فقط از `MISSING`ها (و `PARTIAL`های اثبات‌شده) می‌سازد.
2. **F10 — رجیستری صنف، منبع درست ماتریس است.** ۶۷ ردیف و archetype هر صنف از سند تولیدی می‌آید؛
   ماتریس شکاف باید همان archetype را استفاده کند، نه یک نگاشت دستی دوم.
3. **F11 — شکاف واقعی محصول، بیشتر «تفکیک صنفی» است تا «قابلیت غایب»:** چند قابلیت عمومی هست
   (payroll، buying، banking) ولی برای صنف خاص سیم‌کشی نشده؛ V70.1 باید `PARTIAL` را از `MISSING` جدا کند.
4. **F12 — probe نام‌سطح می‌تواند خطا بدهد.** در اجرای اول G56 (شماره بچ) صفر بود، چون `stock.batches` در فهرست probe نبود؛
   همین نشان می‌دهد V70.1 بدون تأیید دستی هر ردیف، حق ندارد چیزی را «شکاف» بنامد.

## ۵. چیزهایی که در این فاز اندازه‌گیری نشد

- تست‌ها دوباره اجرا نشدند؛ اعداد V69.9 (همین درخت، همین روز) به‌عنوان خط پایه ثبت است.
- Postgres و jest و بیلد desktop/android همچنان `BLOCKED_EXTERNAL` هستند (دلیل در PROGRESS).
