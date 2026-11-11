# HISABCHE OPERATIONAL DNA MATRIX (15 AXES)

**Package Home:** `packages/validation/src/schemas/operational-dna.ts`  
**Date:** 2026-11-11 (V60)

---

## 1. Composable Axes Specification

### Axis 1: Offering Model (`offering_model`)

Determines the fundamental nature of what the customer is purchasing.

- `PHYSICAL_GOODS`: Tangible items requiring shipping, barcode scanning, or retail packaging.
- `TIME_SERVICE`: Services billed by time increments or calendar bookings (e.g. massage, salon service, consulting).
- `PACKAGE_SESSION`: Bulk sessions or prepaid class packs (e.g. 10 language lessons).
- `DELIVERABLE_SERVICE`: Defined scope of work/milestones (e.g. graphic design, contract repair).
- `MIXED_OFFERING`: Blended catalog (e.g. salon selling hair cuts and shampoo).

### Axis 2: Intake and Delivery (`intake_delivery`)

How customer interaction initiates and delivers.

- `COUNTER_POS`: Instant checkout at a till or checkout counter.
- `APPOINTMENT_BOOKING`: Scheduled calendar slots with assigned resources.
- `CLASS_ATTENDANCE`: Group sessions with roll-call attendance tracking.
- `JOB_TICKET`: Work orders for intake, diagnostic, repair, and pickup.
- `PROJECT_DELIVERY`: Milestone tracking and project deliverables.
- `WALK_IN`: Queue-based immediate service without prior appointment.
- `MIXED_INTAKE`: Combination of scheduled and walk-in intakes.

### Axis 3: Inventory Behavior (`inventory_behavior`)

How stock and materials are tracked, replenished, and valued.

- `NONE`: No physical items tracked.
- `RETAIL_STOCK`: Finished goods purchased and resold with perpetual FIFO/AVCO valuation.
- `SERVICE_CONSUMABLES`: Internal materials consumed during service provision (hair dye, nail gel, oil).
- `SPARE_PARTS`: Components consumed during repair/job ticket execution.
- `RAW_MATERIALS`: Ingredients converted into finished products via Recipe BOM.
- `FINISHED_GOODS`: Manufactured items stocked for retail/wholesale.
- `HYBRID_INVENTORY`: Multi-type inventory tracking.

### Axis 4: Billing and Settlement (`billing_settlement`)

Financial terms, advance deposits, and settlement timing.

- `IMMEDIATE_SETTLEMENT`: Paid in full at checkout.
- `DEPOSIT_PREPAYMENT`: Advance customer deposit held in liability before service completion.
- `PACKAGE_CREDITS`: Pre-purchased credits decremented upon service/class attendance.
- `INSTALLMENT_RECEIVABLES`: Structured payment terms over time.
- `CUSTOMER_CREDIT`: Net-30 / open customer account ledger.
- `SUBSCRIPTION_BILLING`: Recurring membership fees.
- `MIXED_SETTLEMENT`: Multiple settlement methods.

### Axis 5: Workforce Model (`workforce_model`)

Personnel compensation, roles, and resource assignment.

- `SOLO_OWNER`: Single operator; no staff scheduling or commission splits.
- `COMMISSION_PROVIDERS`: Independent or contracted staff compensated on service percentage.
- `HOURLY_STAFF`: Timesheet and hourly wage tracking.
- `SALARIED_STAFF`: Fixed monthly payroll.
- `SHIFT_BASED_STAFF`: Rotating shift rosters.
- `MIXED_WORKFORCE`: Blended staff structures.

### Axis 6: Customer / Party Profile (`customer_profile`)

Depth of client information retained.

- `STANDARD_PARTY`: Standard commercial customer (name, phone, ledger balance).
- `CLIENT_CARE_PROFILE`: Personal care history, preferences, skin/allergy notes, visit frequency.
- `STUDENT_PROFILE`: Student records, enrollment courses, attendance records, exam results.
- `BUSINESS_ACCOUNT`: Corporate client with tax ID, credit limit, and accounts payable contacts.
- `SERVICE_ASSET_PROFILE`: Customer assets being serviced (vehicles, laptops, machinery with serials).
- `MIXED_PROFILE`: Blended party record capabilities.

### Axis 7: Operational Topology (`operational_topology`)

Physical layout and operational scale.

- `SINGLE_LOCATION`: One store, clinic, or studio.
- `MULTI_BRANCH`: Multiple storefronts sharing customers and ledger boundaries.
- `MOBILE_SERVICE`: On-the-go provider visiting customer locations.
- `RESOURCE_CAPACITY`: Bounded physical stations (e.g. 4 nail desks, 2 car lifts).
- `SEAT_OR_ROOM_BASED`: Classrooms, conference rooms, or dining tables.
- `WAREHOUSE_NETWORK`: Central distribution with regional fulfillment centers.

### Axis 8: Terminology and Presentation (`presentation_profile`)

User interface skinning, contextual vocabulary, and dashboard layout.

- Derives localized vocabulary labels (e.g. "Appointment" vs "Job Ticket" vs "Order").
- Dictates active dashboard cards and quick action bars.
- Preserves identical underlying accounting and entity schemas.

---

## بازبینی با کد — ۷ نوامبر ۲۰۲۶

- محورهای ۱ تا ۷ در `packages/validation/src/schemas/operational-dna.ts:18-94` به‌صورت **آرایه** (ترکیب‌پذیر) پیاده شده‌اند؛ محور ۸ فقط `terminology` است (`:97`) و پروفایل ناوبری/داشبورد ندارد.
- پیش‌تنظیم‌ها: `ARCHETYPE_PRESETS` (`:122`) — داده‌ی کد، نه داده‌ی نسخه‌دار در دیتابیس.
- `resolveDnaCapabilities` (`:204`) تنها از `useOperationalDna` صدا زده می‌شود و تنها مصرف‌کننده‌ی آن `first-value-checklist.tsx` است.
- DNA **روی سرور ذخیره نمی‌شود**؛ پروفایل سروری فقط `workspaces.business_types` است (`backend/src/services/workspace-profile.ts:60-106`) — بدون نسخه، تاریخچه یا ممیزی.
- هیچ شرط نام صنف در `backend/src/services` پیدا نشد (`grep`)؛ نگاشت صنف → محور فقط در `inferOperationalDna` (onboarding) است، که مجاز است.
- گزارش کامل: [UNIVERSAL-BUSINESS-ARCHITECTURE.md § ممیزی Phase 5.0](UNIVERSAL-BUSINESS-ARCHITECTURE.md).

---

## بازبینی V59 — 11 نوامبر 2026

- محور ۵ (`workforce_model`) اکنون مقدار `UNRESOLVED` و پرسش صریح `staffArrangement` دارد؛ پاسخ `hasStaff = yes` بدون تعیین آرایش نیرو دیگر به‌اشتباه به `HOURLY_STAFF` نگاشت نمی‌شود (`packages/validation/src/schemas/operational-dna.ts`).
- پیش‌تنظیم `SALON_MULTI_STAFF` برای سالن‌های چندپرسنلی در کنار `NAIL_TECH_BEAUTY` (`SOLO_OWNER`) اضافه شد.
- محور ۸ (`presentation_profile`) با فیلدهای اعلانی `terminology`, `navigation.hiddenPaths`, `dashboard` و مصرف‌کننده‌ی واحد `useTerminology()` در UI و ذخیره در SQLite V23 (`local_workspace.operational_dna`, `operational_dna_version`, `onboarding_progress`) تکمیل شد (`V59-IMPLEMENTATION-PROGRESS.md`).

---

## بازبینی V60 — 15 محور متعامد (11 نوامبر 2026)

- محور ۹ (`unitTracking`): `NONE | SERIAL_NUMBERS | EXPIRY_DATES | BOTH | UNRESOLVED` (پشتیبانی از سریال/IMEI و تاریخ انقضا).
- محور ۱۰ (`pricingBasis`, آرایه): `UNIT | WEIGHT | LENGTH | AREA | VOLUME | TIME | RATE_BOARD | CONTRACT | TIERED | UNRESOLVED`.
- محور ۱۱ (`assetCustody`): `OWN_STOCK | CUSTOMER_ASSET_IN_CUSTODY | RENTED_OUT_ASSET | NONE | UNRESOLVED`.
- محور ۱۲ (`executionSite`): `PREMISES | CUSTOMER_SITE | MOBILE_ROUTE | REMOTE | UNRESOLVED`.
- محور ۱۳ (`recurrence`): `ONE_OFF | RECURRING_SERVICE | SUBSCRIPTION | LEASE | UNRESOLVED`.
- محور ۱۴ (`approvalDepth`): `NONE | SINGLE | MULTI_STEP | UNRESOLVED`.
- محور ۱۵ (`regulatedDomain`): `NONE | HEALTH_RECORDS | PRESCRIPTION | FINANCIAL_KYC | FOOD_SAFETY | UNRESOLVED` — **تنها شکاف انطباق (`REGULATED_DOMAIN_COMPLIANCE`) ایجاد می‌کند و هرگز قابلیت `available` فعال نمی‌سازد.**
- تمامی محورهای جدید اختیاری و سازگار با داده‌های پیشین هستند؛ محور غایب به‌صورت `UNRESOLVED` خوانده می‌شود و هرگز به کسب‌وکار پیش‌فرض (مانند خواروبارفروشی/فروشگاه) سقوط نمی‌کند.
