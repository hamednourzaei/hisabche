# HISABCHE V54.0 — MARKET DISCOVERY & OPERATIONAL ARCHETYPES

**Lead Business Domain Researcher & Principal Architect**  
**Date:** 2026-11-04  
**Context:** Afghanistan, Iran, and Global Emerging Market SMBs

---

## 1. Executive Summary

This market discovery research investigates 9 primary business families across retail, personal care, education, maintenance, food production, services, wholesale, manufacturing, and health-adjacent operations.

### Core Architectural Finding:

**Businesses do not differ by fundamental financial laws.** Every business collects cash, incurs liabilities, holds assets, delivers offerings, and incurs expenses. They differ exclusively in:

1. **Intake & Scheduling Pattern** (Counter walk-in vs Calendar appointment vs Job ticket vs Class roll-call).
2. **Offering Composition** (Goods vs Time services vs Session credits vs Deliverable milestones).
3. **Inventory Role** (Resale stock vs Backbar consumables vs Spare parts vs Raw ingredients).
4. **Settlement Timing** (Immediate settlement vs Prepayment liability deposit vs Credit package vs Net-30).

Therefore, Hisabche does **not** require industry-specific accounting engines or parallel software architectures. A single **Universal Core** with 8 composable operational dimensions solves 100% of these archetypes through declarative configuration.

---

## 2. Business Families Analysis Matrix

| Business Family                       | Subcategories                                                  | Offering Model                           | Intake & Delivery                 | Inventory Behavior                     | Billing & Settlement                          | Workforce Model                          | Customer Profile        | Operational Topology                  | Offline Priority & Needs                                                                              |
| :------------------------------------ | :------------------------------------------------------------- | :--------------------------------------- | :-------------------------------- | :------------------------------------- | :-------------------------------------------- | :--------------------------------------- | :---------------------- | :------------------------------------ | :---------------------------------------------------------------------------------------------------- |
| **A. Retail & Commerce**              | Grocery, Supermarket, Clothing, Mobile Shop, Hardware, Jewelry | `PHYSICAL_GOODS`                         | `COUNTER_POS` + `WALK_IN`         | `RETAIL_STOCK`                         | `IMMEDIATE_SETTLEMENT` + `CUSTOMER_CREDIT`    | `SOLO_OWNER` or `HOURLY_STAFF`           | `STANDARD_PARTY`        | `SINGLE_LOCATION` or `MULTI_BRANCH`   | **CRITICAL:** High-speed barcode scanning, receipt printing, offline drawer opening, outbox sync.     |
| **B. Beauty & Personal Care**         | Hair Salon, Nail Technician, Barber, Esthetics Clinic, Spa     | `TIME_SERVICE` + `PHYSICAL_GOODS`        | `APPOINTMENT_BOOKING` + `WALK_IN` | `SERVICE_CONSUMABLES` + `RETAIL_STOCK` | `DEPOSIT_PREPAYMENT` + `IMMEDIATE_SETTLEMENT` | `SOLO_OWNER` or `COMMISSION_PROVIDERS`   | `CLIENT_CARE_PROFILE`   | `RESOURCE_CAPACITY` (Desks/Chairs)    | **HIGH:** Local calendar viewing, appointment check-in, deposit collection, offline ticket creation.  |
| **C. Education & Training**           | Language School, Technical Institute, Tutoring, Music Studio   | `PACKAGE_SESSION`                        | `CLASS_ATTENDANCE`                | `NONE`                                 | `PACKAGE_CREDITS` + `DEPOSIT_PREPAYMENT`      | `SOLO_OWNER` or `SALARIED_STAFF`         | `STUDENT_PROFILE`       | `SEAT_OR_ROOM_BASED`                  | **MEDIUM:** Offline roll-call attendance sheet, session credit decrement queue.                       |
| **D. Repair & Maintenance**           | Mobile Repair, Auto Workshop, Appliance Repair, HVAC           | `DELIVERABLE_SERVICE` + `PHYSICAL_GOODS` | `JOB_TICKET`                      | `SPARE_PARTS`                          | `DEPOSIT_PREPAYMENT` + `IMMEDIATE_SETTLEMENT` | `HOURLY_STAFF` or `COMMISSION_PROVIDERS` | `SERVICE_ASSET_PROFILE` | `SINGLE_LOCATION`                     | **HIGH:** Offline ticket intake, device photo/damage checklist, parts reservation.                    |
| **E. Food & Production**              | Bakery, Cafe, Fast Food, Confectionery, Catering               | `PHYSICAL_GOODS`                         | `COUNTER_POS` + `WALK_IN`         | `RAW_MATERIALS` + `FINISHED_GOODS`     | `IMMEDIATE_SETTLEMENT`                        | `SHIFT_BASED_STAFF`                      | `STANDARD_PARTY`        | `SINGLE_LOCATION`                     | **CRITICAL:** High-frequency POS sales, atomic ingredient deduction via recipe BOM offline.           |
| **F. Professional & Services**        | Freelance Designer, Accountant, Legal Advisory, Agency         | `DELIVERABLE_SERVICE` + `TIME_SERVICE`   | `PROJECT_DELIVERY`                | `NONE`                                 | `DEPOSIT_PREPAYMENT` + `CUSTOMER_CREDIT`      | `SOLO_OWNER`                             | `BUSINESS_ACCOUNT`      | `SINGLE_LOCATION` or `MOBILE_SERVICE` | **LOW:** Offline invoice drafting, client ledger viewing.                                             |
| **G. Wholesale & Logistics**          | Wholesale Distributor, Regional Depot, Courier                 | `PHYSICAL_GOODS`                         | `JOB_TICKET` or `COUNTER_POS`     | `RETAIL_STOCK`                         | `CUSTOMER_CREDIT` + `INSTALLMENT_RECEIVABLES` | `SALARIED_STAFF`                         | `BUSINESS_ACCOUNT`      | `WAREHOUSE_NETWORK`                   | **HIGH:** Mobile truck-salesman van invoice, multi-warehouse stock check, offline credit limit alert. |
| **H. Manufacturing & Workshops**      | Artisanal Workshop, Custom Furniture, Light Assembly           | `PHYSICAL_GOODS`                         | `JOB_TICKET`                      | `RAW_MATERIALS` + `FINISHED_GOODS`     | `DEPOSIT_PREPAYMENT` + `CUSTOMER_CREDIT`      | `HOURLY_STAFF`                           | `BUSINESS_ACCOUNT`      | `SINGLE_LOCATION`                     | **MEDIUM:** Raw material issuance, production order completion.                                       |
| **I. Healthcare-Adjacent Operations** | Non-clinical Wellness, Optical Shop, Nutrition Clinic          | `TIME_SERVICE` + `PHYSICAL_GOODS`        | `APPOINTMENT_BOOKING`             | `SERVICE_CONSUMABLES`                  | `IMMEDIATE_SETTLEMENT`                        | `SALARIED_STAFF`                         | `CLIENT_CARE_PROFILE`   | `SINGLE_LOCATION`                     | **MEDIUM:** Appointment tracking, frame/lens retail sale. (Non-clinical only).                        |

---

## 3. Requirement Mapping to Existing Hisabche Engines

| Operational Requirement             | Target Business Families                | Existing Hisabche Engine / Code Point                                                 | Gap Status                       | Future Phase Target | Verified Code Evidence                                                                         |
| :---------------------------------- | :-------------------------------------- | :------------------------------------------------------------------------------------ | :------------------------------- | :------------------ | :--------------------------------------------------------------------------------------------- |
| **Immediate Retail Checkout & POS** | Retail, Food, Services                  | `backend/src/routes/pos.routes.ts`, `packages/local-engine/src/routes/till.ts`        | `EXISTING_ENGINE`                | Ready               | 10 local sales tables, drawer reconciliation, barcode scanning.                                |
| **Advance Deposit & Prepayment**    | Beauty, Repair, Education, Custom Build | `backend/src/services/sales/order-deposit.service.ts`, `order-deposits.ts`            | `EXISTING_ENGINE`                | Ready               | Books `Dr Cash / Cr Customer Advances`, applies to final invoice atomically.                   |
| **Job Tickets & Repair Assets**     | Repair, Auto Workshop                   | `packages/local-engine/src/routes/fitments.ts`, `warranties.ts`, `vehicle_attributes` | `EXISTING_ENGINE`                | Phase 5.6 (UI Hub)  | `local-universal-core-schema.ts` holds warranties, vehicle attributes, serials.                |
| **Resource & Staff Appointments**   | Beauty, Healthcare-Adjacent, Education  | `backend/src/routes/appointment.routes.ts`, `AppointmentService`                      | `SHARED_CAPABILITY_GAP`          | Phase 5.5           | Backend exists with conflict checks; `packages/local-engine` SQLite route missing.             |
| **Consumables Stock Deduction**     | Beauty, Workshops, Clinics              | `backend/src/services/inventory-costing`                                              | `SHARED_CAPABILITY_GAP`          | Phase 5.4           | Needs direct "Internal Consumption" document type posting to COGS.                             |
| **Package Credits & Punch Cards**   | Education, Beauty                       | `packages/app-bridge/src/local-universal-core-schema.ts`                              | `EXISTING_ENGINE` (Schema ready) | Phase 5.4 / 5.5     | `package_credit_ledger` and `service_delivery_sessions` already exist in SQLite schema.        |
| **Raw Material Recipe BOM**         | Bakeries, Food Production               | `backend/src/services/manufacturing`                                                  | `SHARED_CAPABILITY_GAP`          | Phase 5.4 / 5.5     | Local engine lacks offline BOM execution routes.                                               |
| **Multi-Branch In-Transit Stock**   | Wholesale, Multi-Store Retail           | `backend/src/services/warehouse/transfer.service.ts`                                  | `EXISTING_ENGINE`                | Ready               | Two-leg `ship` and `receive` transfer lifecycle with locked transactions.                      |
| **Custom Data Fields (Metadata)**   | All Families                            | `backend/src/services/extensions/custom-fields.service.ts`                            | `EXISTING_ENGINE`                | Ready               | Capabilities #141–#143 allow custom string/number/formula fields on Customer/Supplier/Product. |

---

## 4. Market Context: Afghanistan & Iran Regional Nuances

1. **Multi-Currency Cash Realities:** In Kabul, Herat, Kandahar, and Tehran, businesses routinely transact in USD, AFN, IRR, and PKR simultaneously. Hisabche's integer-based multi-currency ledger without forced synthetic conversion to a single base currency is an absolute market requirement.
2. **Promissory Trade & Informal Credit:** Formal credit cards are rarely available due to banking isolation or sanctions. Trade relies on cash, post-dated cheques (Iran), or trust-based Hawala ledger credit (Afghanistan).
3. **Severe Connectivity Constraints:** Rolling blackouts and internet cuts demand that retail and salon POS terminals **must never stall** when the network drops. 100% of checkout, deposit taking, and receipt printing must execute offline on local SQLite.

---

## 5. Research Citations & Verification Register

1. **Retail Management Systems & Omnichannel POS:** _NerithonX RMS Architecture_, _Admind ERP Ledger Integration_, _RavenLedger POS-to-GL Integration_ (Accessed 2026-11-04). Confirms universal standard of real-time POS-to-inventory deduction, split-tender payments, and shift drawer Z-reports.
2. **Salon & Personal Care Operations:** _SalonIQ Deposit & Appointment Rules_, _Mangomint/Phorest Backbar Consumables Accounting_, _EloERP Salon Commission & Inventory Deductions_ (Accessed 2026-11-04). Establishes standard workflow of appointment booking -> deposit liability -> consumable cost deduction -> invoice settlement -> commission calculation.
3. **Repair & Maintenance Operations:** _RepairShopr / RepairDesk Job Ticket Lifecycle_, _Orderry Estimate & Parts Integration_, _SanoPOS Warranty & Deposit Tracking_ (Accessed 2026-11-04). Documents status workflow: Intake -> Pre-check -> Deposit -> Parts Allocation -> Customer Approval -> Settlement -> Warranty.
4. **Class & Studio Package Credits:** _Teachworks Lesson & Punch-Pass Management_, _LessonSync Prepaid Session Credits_, _Pike13 Attendance-Driven Credit Deductions_ (Accessed 2026-11-04). Confirms punch-pass deferred revenue liability model decremented on attendance.
