# HISABCHE ARCHETYPE COVERAGE MATRIX

**Date:** 2026-11-04  
**Status:** Canonical Baseline for V54.0 Universal Business OS

---

| Business Archetype                                | Axis 1: Offering                         | Axis 2: Intake                    | Axis 3: Inventory                      | Axis 4: Settlement                            | Axis 5: Workforce                        | Axis 6: Customer        | Axis 7: Topology                      | Required Capabilities                                                    |
| :------------------------------------------------ | :--------------------------------------- | :-------------------------------- | :------------------------------------- | :-------------------------------------------- | :--------------------------------------- | :---------------------- | :------------------------------------ | :----------------------------------------------------------------------- |
| **Retail Store** (Grocery, Clothing, Supermarket) | `PHYSICAL_GOODS`                         | `COUNTER_POS` + `WALK_IN`         | `RETAIL_STOCK`                         | `IMMEDIATE_SETTLEMENT` + `CUSTOMER_CREDIT`    | `SOLO_OWNER` or `HOURLY_STAFF`           | `STANDARD_PARTY`        | `SINGLE_LOCATION` or `MULTI_BRANCH`   | `pos_sessions`, `barcodes`, `fifo_costing`, `returns`                    |
| **Nail Technician / Beauty Salon**                | `TIME_SERVICE` + `PHYSICAL_GOODS`        | `APPOINTMENT_BOOKING` + `WALK_IN` | `SERVICE_CONSUMABLES` + `RETAIL_STOCK` | `DEPOSIT_PREPAYMENT` + `IMMEDIATE_SETTLEMENT` | `SOLO_OWNER` or `COMMISSION_PROVIDERS`   | `CLIENT_CARE_PROFILE`   | `RESOURCE_CAPACITY`                   | `appointments`, `order_deposits`, `consumables`, `recall_reminders`      |
| **Language Teacher / Training Institute**         | `PACKAGE_SESSION`                        | `CLASS_ATTENDANCE`                | `NONE`                                 | `PACKAGE_CREDITS` + `DEPOSIT_PREPAYMENT`      | `SOLO_OWNER` or `SALARIED_STAFF`         | `STUDENT_PROFILE`       | `SEAT_OR_ROOM_BASED`                  | `package_credits`, `class_attendance`, `deferred_revenue`                |
| **Mobile / Auto Repair Workshop**                 | `DELIVERABLE_SERVICE` + `PHYSICAL_GOODS` | `JOB_TICKET`                      | `SPARE_PARTS`                          | `DEPOSIT_PREPAYMENT` + `IMMEDIATE_SETTLEMENT` | `HOURLY_STAFF` or `COMMISSION_PROVIDERS` | `SERVICE_ASSET_PROFILE` | `SINGLE_LOCATION`                     | `job_tickets`, `auto_fitments`, `warranties`, `spare_parts`              |
| **Wholesale Trading Business**                    | `PHYSICAL_GOODS`                         | `JOB_TICKET` or `COUNTER_POS`     | `RETAIL_STOCK`                         | `CUSTOMER_CREDIT` + `INSTALLMENT_RECEIVABLES` | `SALARIED_STAFF`                         | `BUSINESS_ACCOUNT`      | `WAREHOUSE_NETWORK`                   | `multi_warehouse`, `in_transit_transfer`, `price_lists`, `credit_limits` |
| **Artisanal Bakery / Small Workshop**             | `PHYSICAL_GOODS`                         | `COUNTER_POS` + `WALK_IN`         | `RAW_MATERIALS` + `FINISHED_GOODS`     | `IMMEDIATE_SETTLEMENT`                        | `SHIFT_BASED_STAFF`                      | `STANDARD_PARTY`        | `SINGLE_LOCATION`                     | `recipe_bom`, `batch_expiry`, `unit_conversion`, `production_costing`    |
| **Freelancer / Professional Services**            | `DELIVERABLE_SERVICE` + `TIME_SERVICE`   | `PROJECT_DELIVERY`                | `NONE`                                 | `DEPOSIT_PREPAYMENT` + `CUSTOMER_CREDIT`      | `SOLO_OWNER`                             | `BUSINESS_ACCOUNT`      | `SINGLE_LOCATION` or `MOBILE_SERVICE` | `invoices`, `time_tracking`, `milestones`, `retainers`                   |

---

## بازبینی با کد — ۷ نوامبر ۲۰۲۶

| Archetype              | کار می‌کند                                        | گم                                                                                | وضعیت                                  |
| ---------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------- |
| GOODS_RETAIL           | فاکتور فروش/خرید، انبار، بها، مرجوعی، صندوق، دفتر | UI سفارش خرید                                                                     | `IMPLEMENTED_NOT_LIVE_VERIFIED` (هسته) |
| NAIL_TECH_BEAUTY       | جلسه‌ی خدمت، فاکتور، پرداخت                       | صنف در `business-types.ts`، UI نوبت، بیعانه‌ی نوبت، مواد با سند، کمیسیون، یادآوری | `PARTIALLY_IMPLEMENTED`                |
| LANGUAGE_TEACHER       | بسته‌ی اعتباری، جلسه                              | حضور و پروفایل شاگرد                                                              | `PARTIALLY_IMPLEMENTED`                |
| GENERAL_SERVICE_REPAIR | جلسه‌ی خدمت، گارانتی                              | تیکت با وضعیت، دارایی مشتری                                                       | `PARTIALLY_IMPLEMENTED`                |
| MIXED_BUSINESS         | هسته‌های مشترک                                    | DNA چندمحوری سروری                                                                | `PARTIALLY_IMPLEMENTED`                |

«پشتیبانی همگانی» ادعا نمی‌شود. جزئیات: بخش G و H ممیزی در `UNIVERSAL-BUSINESS-ARCHITECTURE.md`.
