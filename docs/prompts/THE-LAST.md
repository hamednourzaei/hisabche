# THE LAST — Universal Industry Operating System Remediation

> **Baseline commit:** `b54636fae57806c6d75c710c7621a49c8a3132d0` (`fixed ci 33`)
> **Repository:** `hamednourzaei/hisabche` · **Target branch:** `main`
> **Purpose:** canonical record of the external review and the implementation mandate.
> Code, comments and technical docs are in English; the final report is in Persian.
>
> This file holds TWO source texts verbatim: (1) the external review of the
> baseline commit, and (2) the remediation prompt. Implementation notes are
> appended at the end as work lands in the repository.

---

# PART 1 — EXTERNAL REVIEW (verbatim English translation)

I am conducting this review based on the new commit **b54636fa — fixed ci 33**, not on previous V73 reports or commit d1b2bd21.

I will separate the output into two distinct layers:

1. What is actually implemented in the code: cores, capabilities, UI routes, permissions, data, offline/Sync, and the status of each industry.
2. The actual workflow for each industry: from the moment a user logs in to performing their daily tasks; including appropriate titles and KPIs, workflows, operational pain points, and which pain Hisabche actually solves, which it partially solves, and which it does not yet cover.
   One important note: I do not consider the mere existence of an industry or capability name in the Registry as equivalent to the product being ready for that industry. For every claim, I look for the actual connection of the capability to the engine, API, page, permissions, storage, tests, and execution evidence.

## 1) Initial Result of the New Commit Review

- Vercel: success
- Sales Readiness: Unproven

**Fully verified commit:**

- SHA: `b54636fae57806c6d75c710c7621a49c8a3132d0`
- Message: `fixed ci 33`
- Compared to `d1b2bd21`: one commit ahead, no regressions.
- Changes: 182 files.
- Recorded CI status: Vercel check is successful; this alone does not equate to all tests and real workflows being green.
  Major changes in this version: Hisabche hasn't just changed docs and registry; it has also added several operational capabilities and new local routes: Batch Traceability and Recall, Delivery and Fleet, Sales Order, Longitudinal Cutting, Production Batch, Variant Cost Layers, and prevention of duplicate warranty claims.

However, there is a significant inconsistency: generated documents like `ENGINE-WIRING-STATUS.md` and `CAPABILITY-RECONCILIATION.md` still show HEAD as `d1b2bd21`. Therefore, their numbers cannot be considered definitive statistics for the new commit without being regenerated. The `sellable-industries.json` file also still points to the old acceptance and records zero Sellable industries.

## 2) The Architecture Actually Seen in the Code

Hisabche has not built 67 separate engines for 67 business models. The current structure is as follows:

- **8 Shared Cores:** Sales and Receipts; Inventory and Tracking; Accounting and Costing; Pricing and Unit; Customer, Supplier, and Settlement; Permissions, Approvals, and Audit; Offline and Sync; Reporting and Forecasting.
- **11 Operational Operators:** Each hosts one type of workflow.
- **67 Industry Profiles:** Each industry has a primary operator and can use multiple cores.
  This separation comes from `INDUSTRY_OPERATOR` and `PROFILES` in `industry-profiles.ts`. The positive aspect is that one sales or inventory rule is used for multiple industries, and no parallel engine is built for each industry.

**Base Shared Workflow:**
Almost all industries use a common financial and operational cycle:

1.  Business Definition and Onboarding (Selecting industry, operational information, units, and initial settings)
2.  Registering Parties and Resources (Customers, suppliers, goods, services, employees, warehouses, or capacity)
3.  Industry Operational Document (Invoice, order, reservation, repair, project, production, or delivery)
4.  Receipt / Payment / Resource Consumption (Settlement, inventory change, material consumption, expense recording, or capacity)
5.  Financial Ledger, Reporting, and Follow-up (Balance, profit, debt, inventory, open tasks, and history)

This diagram is the target model and documented product workflow; it does not mean proof of live execution of all steps in all 67 industries.

**Important Operational Changes in b54636fa**

| Capability                          | What the new code does                                                                                                        | Actual pain targeted                                                    |
| :---------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------- |
| Batch Recall                        | Blocking a batch with reason and time; preserving inventory quantity; recording event; preventing exit of the recalled batch. | Unintentional sale of defective or recalled goods.                      |
| Delivery and Fleet                  | Assigning driver/vehicle, delivery attempts, failure reason, and delivery proof with signature/photo/code.                    | Disputes over delivery and driver responsibility.                       |
| COD Settlement                      | Recording the actual amount collected; the shortfall remains as customer debt.                                                | Erroneously zeroing customer debt despite a cash shortfall.             |
| Offline Order                       | Creating and editing order drafts without internet; final confirmation on the server.                                         | Losing an order during internet disconnection.                          |
| Variant Costing                     | Connecting the cost layer to the exact color/size/variant and consuming FIFO of that variant.                                 | Incorrect profit calculation when costs of sizes or colors differ.      |
| Cutting Waste                       | Exiting materials equal to the sold quantity plus waste; not charging for waste.                                              | Disappearance of consumed meters or weight during cutting.              |
| Production with Waste and Rework    | Separating healthy output, waste, and rework; calculating yield and unit cost of healthy output.                              | Reporting 100% healthy production while part of the material is wasted. |
| Duplicate Warranty Claim Prevention | Unique request key at the Workspace level.                                                                                    | Opening two files for a duplicate request.                              |

These are not just capability titles; in the commit, there are migrations, PostgreSQL tests, Local Engine tests, and UI changes for some of them. However, the existence of a test file does not equal successful execution of the test in the target environment. The exact example of this logic can be seen in the Batch Traceability service, Transport service, Offline Order engine, and Variant Costing migration.

## 3) Workflow of 67 Industries, with Titles and Specific Pains

In the tables below, I have intentionally separated two concepts:

- **Proposed Experience Titles:** Names that are natural and understandable for the user of that industry.
- **Code Status:** What is actually recorded in Hisabche's profile, capabilities, and engines.
  The proposed titles should not be confused with claiming the existence of all of them in the current UI.

**A) Daily Sales — 10 Models**
Main Core: Register, Invoice, Payment, Goods, Inventory, and Sales Report.

| Industry                | Appropriate Experience Titles                            | Main Workflow and Operational Pain                                                                                                           |
| :---------------------- | :------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| Retail                  | Today's Sales, Register, Goods, Sales Profit             | Recording sales and receiving money, inventory control, returns, and closing the register; reducing sales errors and register discrepancies. |
| Grocery and Supermarket | Quick Sale, Shelf Inventory, Expiry Date, Purchase Order | High-volume sales with different units and expiring goods; `multi_unit` code is active, but `batch_expiry` still has limitations.            |
| Fruits and Vegetables   | Weight Sale, Daily Waste, Fresh Inventory                | Selling based on weight and unit, recording waste, and controlling perishable goods; batch/expiry tracking still has gaps.                   |
| Nuts and Dried Fruits   | Weight Sale, Price per Kilo, Inventory                   | Weighing and pricing based on weight; `measurement` and `multi_unit` are active in the profile.                                              |
| Herbal and Spices       | Weighted Items, Batch Inventory, Expiry Date             | Selling grams and kilos, managing numerous and dated goods; `batch_expiry` still requires registration.                                      |
| Dishes and Kitchenware  | Goods, Sales, Repurchase                                 | Piece-goods sales and inventory control; the current profile is almost generic and has no registered specialized need.                       |
| Stationery and Books    | Quick Sale, Bestsellers, Inventory                       | Selling numerous items, multi-unit, and shortage control; `multi_unit` is active.                                                            |
| Gifts and Decorations   | Goods, Occasion Sales, Inventory                         | Managing item diversity and seasonal sales; the current code mainly covers general sales.                                                    |
| Cosmetics and Health    | Products, Color/Model, Expiry Date                       | Managing diversity and dated inventory; `variants` and `batch_expiry` are recorded with limitations.                                         |
| Flowers and Plants      | Daily Sale, Fresh Inventory, Waste                       | Controlling perishable goods and quick sales; `batch_expiry` need is recorded in the profile.                                                |

**Evaluation of this group:** Sales, register, and receiving money are the pillars of the product. But for grocery, spices, fruits and vegetables, and flowers, real value is created when expiry, batch, and waste are fully connected to sales and inventory value; just registering goods is not enough.

**B) Wholesale and Measurement-Based Sales — 12 Models**
Main Core: Unit of Measurement, Pricing, Customer Price List, Purchasing, Warehouse, and Receivables Collection.

| Industry                 | Appropriate Experience Titles                                        | Main Workflow and Operational Pain                                                                                                                                |
| :----------------------- | :------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wholesale                | Customer Price List, Wholesale Order, Receivables, Supplier Purchase | Dedicated customer pricing, credit sales, debt collection, purchasing, and inter-warehouse transfers.                                                             |
| Fabric and Haberdashery  | Bolt, Meterage, Cutting, Fabric Waste                                | Meter sales and recording cutting waste; `length_pricing` is active, `roll_cutting` still lacks a complete engine.                                                |
| Wholesale Fabric Rolls   | Rolls, Remaining Meterage, Roll Cutting                              | Roll inventory control and selling by length; length recording is active, roll cutting has gaps.                                                                  |
| Hardware and Tools       | Weight, Branch, Tiered Price                                         | Weight/unit sales and price based on quantity; tiered pricing is still limited.                                                                                   |
| Building Materials       | Meterage, Weight, Project Price, Warehouse Inventory                 | Volume/area and wholesale sales, different prices by quantity; `area_pricing` and `tiered_pricing` have limitations.                                              |
| Paint and Painting Tools | Paint, Volume, Product Series, Inventory                             | Selling by liter and type/packaging; volume pricing and some variants are not complete.                                                                           |
| Wood and Lumber          | Length, Volume, Cutting, Wood Waste                                  | Length sales and waste control; `length_pricing` is active, and cutting/waste must remain integrated with inventory and cost.                                     |
| Glass and Aluminum       | Dimensions, Area, Cutting, Fabrication Order                         | Calculation based on dimensions and area; `area_pricing` still has gaps.                                                                                          |
| Tire and Gas Sales       | Liter, Tank Volume, Daily Sale                                       | Volume sales and tank quantity discrepancy control; `fuel_tank_reconciliation` is not yet built.                                                                  |
| Rugs and Carpets         | Piece, Meterage, Area, Roll                                          | Rug inventory and size-based pricing; `area_pricing`, `roll_cutting`, and some variants are limited.                                                              |
| Tailoring                | Tailoring Order, Fabric Consumed, Labor Fee                          | Registering orders and fabric meterage; measurement exists, but the complete tailoring order workflow and time/labor in the specialized profile are not complete. |
| Seeds and Fertilizers    | Weight, Batch, Expiry Date, Inventory                                | Weight sales, batch, and consumption date control; `batch_expiry` has limitations.                                                                                |

**Evaluation of this group:** This group is one of the best users of Hisabche's measurement core. The main remaining problem is the actual connection of "Measurement → Cutting → Waste → Inventory → Costing". The new cutting waste capability has advanced part of this chain, but alone it does not mean the completion of roll cutting, surface dimensions, or fuel tank.

**C) Variant and Serialized Goods — 12 Models**
Main Core: Goods, Variant, Barcode, Serial, Cost Layer, Warranty, and Returns.

| Industry                   | Appropriate Experience Titles                 | Main Workflow and Operational Pain                                                                                                                                   |
| :------------------------- | :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Watches                    | Model, Serial Number, Warranty, Sale          | Recording serial number and linking to invoice; tracking and warranty still have limitations.                                                                        |
| Apparel                    | Size, Color, Model, Inventory per Size        | Purchase and sale based on variant; calculating the cost of each variant has advanced with the new change, but old data without variants requires manual allocation. |
| Shoes                      | Size, Color, Size Inventory, Reorder          | Preventing wrong size sales and shortage control per size; variants are active but limited.                                                                          |
| Mobile and Accessories     | IMEI/Serial, Warranty, Repairs                | Linking device to invoice, customer, and service file; serial and warranty have limitations.                                                                         |
| Computer and Laptop        | Serial Number, Parts, Warranty                | Device tracking and returns/warranty; variant and serial are still limited.                                                                                          |
| Computer Parts             | Part Compatibility, Model, Serial             | Finding compatible parts and preventing wrong part sales; warranty need is registered.                                                                               |
| Electrical and Electronics | Model, Serial, Warranty, After-Sales Services | Tracking sold devices and warranty files; duplicate warranty claims are now idempotent, but the whole chain is not yet complete.                                     |
| Auto Parts and Spares      | Vehicle Compatibility, Part Number, Warranty  | Recognizing part compatibility with vehicle model and year; `auto_fitments` exists but core charge has limitations in the matrix.                                    |
| Car Dealership             | Available Cars, VIN, Customer, Warranty       | Tracking each vehicle with a unique identifier and purchase cost; variant/serial and Fitment are limited.                                                            |
| Furniture                  | Model, Color, Dimensions, Order               | Selling models and variant inventory control; `variants` have limitations.                                                                                           |
| Home Appliances            | Serial, Warranty, Installation, and Services  | Device tracking and warranty; serial and warranty capability is limited.                                                                                             |
| Toys                       | Model, Color, Age Group, Inventory            | Managing product diversity and sales; variants are limited.                                                                                                          |

**Evaluation of this group:** The variant costing change is one of the most important improvements in this commit; because if a size L shirt is purchased at a different price than M, the sales profit should not be derived from the wrong product average. However, the strict point of the migration is that old inventory without `variant_id` is not automatically attributed to a color or size; a person must consciously allocate it. This decision prevents data forgery but leaves the migration work for the old store.

**D) Value-Based Transactions — 2 Models**

| Industry          | Appropriate Experience Titles                                            | Main Workflow and Operational Pain                                                                                                                                                              |
| :---------------- | :----------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gold and Jewelry  | Gold Weight, Purity, Daily Rate, Labor Fee, Second-hand Gold Purchase    | Recording weight, rate, and second-hand/melting gold operations; `gold_purity` and `making_charges` are limited in the profile, and the complete invoice line price calculation still has gaps. |
| Currency Exchange | Currencies, Buy Rate, Sell Rate, Conversion Profit, Balance per Currency | Recording currency transactions and balances by currency; the exchange engine is added, but its currency conversion operation is online-dependent and partial.                                  |

**Evaluation of this group:** For a gold shop and currency exchange, a general invoice is not enough. The rate, purity, labor fee, transaction profit, currency balance, and register discrepancy control must be precise. In the new commit, the currency exchange engine exists, but in the matrix, `currency_exchange` is still not complete and offline. The gold shop also still needs complete connection for pricing based on purity and labor fee.

**E) Food and Catering — 5 Models**

| Industry                 | Appropriate Experience Titles                              | Main Workflow and Operational Pain                                                                                                 |
| :----------------------- | :--------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| Bakery and Confectionery | Today's Production, Recipe, Raw Materials, Waste           | Purchasing materials, production, sales, waste, and closing the register; recipe and production batch still have limitations/gaps. |
| Butchery                 | Weight, Portioning, Batch, Date, Waste                     | Receiving meat, weighing, sales, and recording waste; measurement and batch exist, but expiry still has limitations.               |
| Restaurant               | Tables, Orders, Kitchen, Raw Materials, Register           | Ordering, preparation, food delivery, and receiving; `table_service` is planned and not available.                                 |
| Cafe and Coffee Shop     | Drinks, Orders, Consumables, Register                      | Selling drinks and managing material consumption; basic order and register are usable, but tables and recipes have gaps.           |
| Dairy                    | Products, Production/Receipt Batch, Expiry Date, Inventory | Date-sensitive inventory control and sales; batch capability exists in the profile but has limitations.                            |

**Evaluation of this group:** Register and daily sales are usable for cafes and restaurants; but a real restaurant needs connection to tables, kitchen orders, preparation status, and recipes. The current restaurant and cafe profiles have registered these needs, but the code does not turn them on as complete capabilities. This honesty in the Registry is positive; one should not promise a restaurant customer a complete restaurant POS.

**F) Health — 3 Models**

| Industry                   | Appropriate Experience Titles                                            | Main Workflow and Operational Pain                                                                                                     |
| :------------------------- | :----------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| Pharmacy and Drugstore     | Medicine, Batch, Expiry Date, Prescription, Medicine Delivery, Insurance | Selling medicine and date/batch control; prescription, medicine delivery, and insurance claims are still planned.                      |
| Clinic and Doctor's Office | Appointment, Patient, File, Service, Receipt                             | Booking time and receiving fees; capacity is limited, and the clinical file and health information access control have not been built. |
| Optical Store              | Eye Prescription, Lens, Frame, Lens Order                                | Linking prescription to frame and lens order; serial and batch are limited, optical prescription and lens order are still planned.     |

**Evaluation of this group:** Hisabche can cover part of sales, receipts, and inventory; but these three industries, especially pharmacy and clinic, have specialized and sensitive needs. Without prescription, medicine delivery, clinical file, health data access level, and insurance workflow, the product should not be introduced as specialized medical or pharmacy software.

**G) Appointments and Services — 6 Models**

| Industry                        | Appropriate Experience Titles                                | Main Workflow and Operational Pain                                                                                                                  |
| :------------------------------ | :----------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| Barber and Hairdresser          | Today's Appointment, Customer, Service, Barber, Receipt      | Customer booking, assigning service provider, and settlement; resource capacity is limited.                                                         |
| Beauty and Nail Salon           | Today's Sessions, Customer, Service, Staff, Package Credit   | Managing multiple people's appointments and services; `todaySessions` dashboard exists in the profile, but concurrent capacity is limited.          |
| Academy and Course              | Student, Course, Session, Remaining Credit, Tuition          | Selling session/credit packages and consuming it in each session; `package_credits` is active but limited, and installments still have limitations. |
| Dry Cleaning                    | Open Orders, Delivered Clothes, Ready for Delivery, Customer | Receiving clothes, recording status, delivery, and receiving money; `laundry_item_tracking` is not yet built.                                       |
| Photography and Filmmaking      | Project Reservation, Execution Date, Deposit, File Delivery  | Time reservation and receiving deposit; capacity is limited, and specialized project management/delivery is not complete.                           |
| Event Hall and Wedding Services | Date Reservation, Hall, Contract, Deposit, Balance           | Date reservation, receiving prepayment, and settlement; capacity, recurring contracts, and deposit debt management are incomplete.                  |

**Evaluation of this group:** Here, the most important difference with a store is "Service", not "Goods". The academy is one of the few profiles that has student, course titles, and a package credit dashboard. But the salon, dry cleaner, and hall need a complete workflow of capacity, reservation, no-show, delivery, and contract. The existence of an appointment page does not mean solving all these pains.

**H) Repair and Ticketing — 3 Models**

| Industry              | Appropriate Experience Titles                                  | Main Workflow and Operational Pain                                                                                                                  |
| :-------------------- | :------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| Computer Services     | Ticket, Customer Device, Fault, SLA, Consumed Part             | Recording device, troubleshooting, part, work done, and delivery; SLA and recurring contracts are incomplete.                                       |
| Mechanics and Service | Vehicle Acceptance, Mileage, Fault, Parts, Labor Fee, Delivery | Acceptance, diagnosis, part and labor fee, delivery; the dashboard has tickets but the mechanics profile has not fully activated specialized needs. |
| Repairs               | Repair File, Work Status, Responsible, Delivery Time           | Recording work, repair queue, and SLA tracking; `work_queue_sla` has limitations, and warranty is not complete either.                              |

**Evaluation of this group:** Hisabche has moved towards work queue and ticket management; but for a professional repair shop, device history, consumed parts, labor fee, responsible person, commitment time, final test, and warranty must be connected to a single file. `openRepairTickets` in the dashboard is one step, not a replacement for the entire repair shop system.

**I) Production, Project, and Land — 8 Models**

| Industry                       | Appropriate Experience Titles                                               | Main Workflow and Operational Pain                                                                                                                                        |
| :----------------------------- | :-------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Construction and Contracting   | Project, Progress, Project Cost, Worker, Deposit, Progress Billing          | Receiving deposit, material consumption, recording work hours, and project cost; `project_costing` and `timesheet_billing` are online-dependent and limited.              |
| Manufacturing and Workshop     | Production Order, BOM, Consumed Materials, Healthy Output, Waste, Unit Cost | Defining formula, recording production, and calculating cost; the new commit has added healthy output/waste/rework separation, but production is still not fully offline. |
| Agriculture and Farming        | Farm, Crop, Product Cycle, Input Consumption, Harvest                       | Purchasing inputs, recording consumption and harvest; `crop_cycle` is not yet built, and the agriculture engine is also `not_verified`.                                   |
| Livestock and Animal Husbandry | Livestock, ID, Feed, Treatment, Birth, Production                           | Identifying livestock and recording maintenance/production cycle; `livestock_register` is planned and the livestock engine is `not_verified`.                             |
| Real Estate and Consultants    | Property, Owner, Tenant, Contract, Rent, Commission                         | Recording property, rent contract, and collection; rental asset still has no connected engine, and contracts are online-dependent.                                        |
| Printing and Advertising       | Print Order, Circulation, Design, Material Consumption, Delivery            | Receiving orders, calculating consumption, and production; `print_job` and production batch are not yet built.                                                            |
| Security Services              | Contract, Service Location, Guard, Shift, Renewal                           | Managing contracts and deployed personnel; recurring contracts are incomplete, and shift/service location management needs to be more complete.                           |
| Consulting and Accounting      | Customer Project, Consulting Hours, Contract, Cost, Invoice                 | Recording project and time and invoicing; project and timesheet are online-dependent and incomplete.                                                                      |

**Evaluation of this group:** The new production change in recording waste and healthy output unit cost has real value. However, industrial production requires material control, batch, quality, time, capacity, rework, and financial recording. The project should also go beyond "cost recording" and connect budget, progress, progress billing, time, and project profit. For agriculture and livestock, one should still not claim specialized coverage.

**J) Transport and Tourism — 5 Models**

| Industry                    | Appropriate Experience Titles                                  | Main Workflow and Operational Pain                                                                                                              |
| :-------------------------- | :------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| Transport and Freight       | Trips, Fleet, Driver, Cargo, Delivery, Trip Cost               | Recording trips, assigning vehicle/driver, and settlement; transport is stronger in the new code but still partially online-dependent.          |
| Cargo and Freight           | Waybill, Origin, Destination, Weight, Driver, Delivery Receipt | Recording trips, cargo weight, and delivery; `delivery_pod` and `fleet_dispatch` are still online-dependent in the matrix.                      |
| Passenger Transport         | Trip, Route, Vehicle, Capacity, Driver                         | Recording trips and vehicle assignment; fleet and dispatch are incomplete, and specialized seat reservation is not proven in this matrix.       |
| Courier and Parcel Delivery | Parcel, Tracking Code, Courier, Status, COD, Delivery Proof    | Recording parcels, assigning drivers, recording delivery attempts, proofs, and COD settlement; one of the main winners of the new WP-19 change. |
| Travel Agency               | Reservation, Passenger, Ticket, Deposit, Supplier, Settlement  | Reservation, receiving money, supplier confirmation, and settlement; `travel_booking` and `supplier_settlement` are not yet built.              |

**Evaluation of this group:** Courier and parcel delivery has tangible progress from the new code perspective: delivery proof, failed attempt, failure reason, vehicle, driver, and COD. But this should not be taken to mean the completion of fleet management software or a travel agency; trip reservation and supplier settlement still have gaps.

**K) Other — 1 Model**

| Industry                   | Appropriate Experience Titles                  | Main Workflow and Operational Pain                                                                                                                                                                                       |
| :------------------------- | :--------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Other / Business Not Found | Sales, Services, Customers, General Operations | The user can work with a general model, but the system should not assume a goods store without knowing the business model. In the code, `other` intentionally has no specialized capability and specialized requirement. |

This choice is correct: `other` should not be converted to Retail without reason or promise capabilities it does not actually have.

## 4) Have Titles, KPIs, and Dashboards Really Become Different for Each Industry?

Here we see one of the most important gaps between Hisabche's architecture and the final product experience.
**What is actually defined in `industry-profiles.ts`**
The profile of each industry has this information:

- `capabilities`: Capabilities it can use.
- `requestedCapabilities`: Actual needs of the industry, even if not yet implemented.
- `invoiceDefaults`: Additional invoice columns.
- `productDefaults`: Default unit and more important product form fields.
- `dashboard`: Dashboard sections that should be displayed.
- `vocabulary`: Industry-specific vocabulary.
  However, the number of actually defined specialized vocabularies is much less than 67 industries.
  | Industry         | Vocabulary defined in code                   |
  | :--------------- | :------------------------------------------- |
  | Restaurant       | `productKey: dish`                           |
  | Cafe             | `productKey: drink`                          |
  | Barber           | `productKey: service`, `customerKey: client` |
  | Beauty Salon     | `productKey: service`, `customerKey: client` |
  | Academy          | `productKey: course`, `customerKey: student` |
  | Repairs          | `productKey: repairItem`                     |
  | Gold Shop        | `productKey: piece`                          |
  | Other Industries | Mostly general vocabulary                    |

So if a mechanic owner enters Hisabche, we should not yet claim that all titles like "Accepted Vehicle", "Repair Labor Fee", "Consumed Parts", and "Vehicle Delivery" have been integrated and dynamically replaced in all pages. These are correct mechanic experience titles, but their existence in the entire UI is not proven from this profile.

**Current Dashboard**
The code knows these IDs for the dashboard:

| ID                  | Usage                       |
| :------------------ | :-------------------------- |
| `kpis`              | Main indicators             |
| `workQueue`         | Work queue                  |
| `chart`             | Chart                       |
| `insights`          | Insights                    |
| `activities`        | Activities                  |
| `manufacturing`     | Production                  |
| `lowStockVariants`  | Variant shortage            |
| `todaySessions`     | Today's sessions            |
| `packageCreditsLow` | Package credits running low |
| `openRepairTickets` | Open repair tickets         |

A few real examples of profile differences:

- Apparel and Shoes: `lowStockVariants`
- Barber and Beauty Salon: `todaySessions`
- Academy: `packageCreditsLow` and `todaySessions`
- Repairs, Mechanics, IT Services, and Mobile: `openRepairTickets`
  This is real progress; but for all 67 industries, there are not yet specialized KPIs with independent computational definitions in the profiles.

To reach a professional experience, the dashboard must go beyond "Today's Sales and Inventory". For example:

| Industry          | Suggested KPIs that must be connected to real data                                              |
| :---------------- | :---------------------------------------------------------------------------------------------- |
| Retail            | Profit margin, Net sales, Register shortage, Inventory turnover                                 |
| Wholesale         | Overdue receivables, Average collection period, Profit per customer, Purchase orders in transit |
| Supermarket       | Near-expiry goods value, Waste, Turnover per product group                                      |
| Apparel           | Sales per size/color, Stagnant inventory per variant, Profit per variant                        |
| Gold Shop         | Inventory weight based on purity, Labor fee profit, Discrepancy between actual and book weight  |
| Currency Exchange | Balance per currency, Conversion profit, Currency register discrepancy                          |
| Restaurant        | Sales per table, Preparation time, Cost per dish, Material waste                                |
| Pharmacy          | Near-expiry medicine, Medicine shortage, Sales by group                                         |
| Clinic            | Appointment occupancy rate, Return visits, Revenue per service                                  |
| Academy           | Consumed sessions, Remaining credit, Course renewal rate                                        |
| Dry Cleaning      | Overdue orders, Clothes ready for delivery, Lost items                                          |
| Mechanics         | Accepted vehicles, Repair time, Part cost, Labor fee profit                                     |
| Manufacturing     | Production yield, Waste, Rework, Healthy unit cost                                              |
| Contracting       | Actual cost vs. budget, Project progress, Project profit                                        |
| Courier           | Successful delivery rate, Uncollected COD, Failed delivery, Driver performance                  |

These KPIs must be built from real data and testable formulas; they should not just be decorative numbers on the dashboard.

## 5) Offline and Sync: Architectural Advantage, but Still a Gap from Complete Coverage

In `OFFLINE-WORKFLOW-MATRIX.md`, the current matrix of 688 endpoints is reported as follows:

- **218** Executable Offline
- **450** Internet Required
- **20** Not Supported in Offline Version

This statistic relates to the endpoint matrix, not the readiness percentage of each industry.

Important examples from the new change:

- Sales order draft is recorded offline, but order confirmation and final price and inventory check depend on the server.
- Courier delivery operations have a Local Engine route.
- Batch Recall is also supported in the local route.
- Production, project, transport, contracts, approvals, and currency exchange are still in the list of engines lacking a Local Engine.
- Assets and rent still have gaps even from a Wiring perspective.
- Agriculture engine is `not_verified`.
  Therefore, one cannot say "all of Hisabche is offline". The more precise sentence is:

> Hisabche has a Local-First architecture and has local routes for a number of financial and daily operations; but many specialized and organizational operations are still Online Required.

To prove Sync quality, tests must also be conducted for two devices, real conflicts, request repetition, crash recovery, and local data retention; a single-device test is not enough.

## 6) Important Gaps That Still Prevent Specialized Sales

This table is extracted from the Capability Matrix status and industry profiles; "Limited" means code or engine exists but a registered limitation remains, and "Planned" means it should not be introduced as an available capability.

| Area                                       | Status in Matrix   | Impact on Customer                                                    |
| :----------------------------------------- | :----------------- | :-------------------------------------------------------------------- |
| Measurement and Units                      | Available          | Suitable for a large part of weight and length sales.                 |
| Multi-unit                                 | Available          | Useful for package purchase and unit sale.                            |
| Weight and Length Pricing                  | Available          | Good base for nuts, fabric, and measurement-based goods.              |
| Area and Volume Pricing                    | Partial            | Risk of incorrect price calculation for glass, paint, and materials.  |
| Roll Cutting                               | No complete engine | Complete bolt management and cutting not yet proven.                  |
| Expiry Date and Batch                      | Partial            | For medicine, food, and perishable goods, must be completed.          |
| Recipe and BOM                             | Partial            | Restaurant and manufacturing need complete material workflow.         |
| Table Service                              | Planned            | Restaurant and cafe still do not have a complete specialized POS.     |
| Serial and Variant                         | Partial            | Not enough for mobile, electronics, apparel, and shoes.               |
| Gold Purity and Labor Fee                  | Partial            | Gold shop still lacks complete specialized coverage.                  |
| Capacity and Reservation                   | Partial            | Salon, clinic, hall, and photography have limitations.                |
| Purchase Order and 3-Way Matching          | Partial            | Organizational procurement process is not yet complete.               |
| Project Cost and Timesheet                 | Partial            | Contracting and consulting need more complete coverage.               |
| Fleet and Delivery Proof                   | Partial            | New code has progress; but the whole engine is still Online Required. |
| Asset Rental                               | Planned            | Real estate and equipment rental are not ready as specialized.        |
| Livestock and Crop Cycle                   | Planned            | Agriculture and livestock are still not ready.                        |
| Prescription and Medicine Delivery         | Planned            | Pharmacy is not specialized.                                          |
| Health File and Access                     | Planned            | Clinic is not specialized.                                            |
| Travel Reservation and Supplier Settlement | Planned            | Travel agency is incomplete.                                          |
| Dry Cleaning Clothes Tracking              | Planned            | Professional dry cleaning is still not ready.                         |
| Print Job                                  | Planned            | Print shop is not specialized.                                        |
| Fuel Tank Reconciliation                   | Planned            | Gas station is still not specialized.                                 |

**An Important Note About Database Migrations**
The file `docs/MIGRATIONS-PENDING.md` in the new commit lists 289 migrations and sets the status of all as `PENDING HUMAN CONFIRMATION`. Also:

- 119 migrations do not have a VERIFY file.
- 108 migrations do not have a PostgreSQL test.
  This does not mean all those migrations have definitely not run; it means from the Repository, one cannot confirm which ones have run in the target database. Until the versions recorded in `supabase_migrations.schema_migrations` are checked, one should not claim that new changes have been applied to the Production database.

## 7) Real Readiness of Each Group for Sales

This ranking is my product evaluation based on profiles and registered gaps, not an official score or customer test. "Ready to start" means suitable for a controlled pilot, not Sellable approval.

| Group                         | Current Readiness from Code | Reason                                                                                             |
| :---------------------------- | :-------------------------- | :------------------------------------------------------------------------------------------------- |
| General Retail                | Relatively Suitable         | Sales, register, and invoice have a stronger core.                                                 |
| Nuts and Dried Fruits         | Relatively Suitable         | Weight and multi-unit exist.                                                                       |
| Stationery                    | Relatively Suitable         | Relatively simple sales model and multi-unit.                                                      |
| Wholesale                     | Conditional                 | Credit sales and collection are good, but pricing/procurement workflow is not complete.            |
| Apparel and Shoes             | Conditional                 | Variant and variant costing have progressed, but limitations remain.                               |
| Supermarket and Food          | Conditional                 | Batch and expiry must still be completely and operationally verified.                              |
| Fabric and Wood               | Conditional                 | Measurement is active; cutting and waste need chain completion.                                    |
| Courier and Delivery          | In Progress                 | WP-19 changes have operational value, but end-to-end acceptance is needed.                         |
| Manufacturing                 | Conditional                 | Recording healthy output, waste, and unit cost has improved; production is still online-dependent. |
| Mechanics and Repairs         | Conditional                 | Repair queue and tickets exist, but the specialized workflow is not complete.                      |
| Academy                       | Conditional                 | Package and session credit exist, but capacity and installments are limited.                       |
| Gold Shop                     | Specialized Unreadiness     | Purity and labor fee pricing are still limited.                                                    |
| Currency Exchange             | Specialized Unreadiness     | Engine is added, but currency conversion is still online-dependent and incomplete.                 |
| Restaurant and Cafe           | Specialized Unreadiness     | Tables and kitchen workflow are not complete.                                                      |
| Pharmacy and Clinic           | Specialized Unreadiness     | Prescription, file, and health access are not built.                                               |
| Agriculture and Livestock     | Specialized Unreadiness     | Specialized engine and domains are not yet proven.                                                 |
| Real Estate and Travel Agency | Specialized Unreadiness     | Rent, reservation, and supplier settlement have gaps.                                              |

## 8) Engineering Summary: Where is Hisabche After This Commit?

**Real Progress in Code**

- The sales and invoice core is still the main foundation of the product.
- Batch tracking, delivery and COD, offline orders, variant costing, cutting waste, and production yield have progressed.
- The structure of 67 profiles and 11 operators is the right path to prevent 67 parallel systems.
- Profiles also record unbuilt needs; this prevents false claims of coverage.
  **Unproven or Incomplete**
- Important generated files still report the old HEAD.
- `sellable-industries.json` still has old acceptance evidence: 0 PostgreSQL evidence, 0 Browser evidence, and 0 Sellable industries.
- For all 67 industries, fresh browser and PostgreSQL evidence on this exact commit is not provided.
- The execution status of migrations in the target Supabase is unknown.
- Many specialized engines are still not offline.
- Specialized vocabularies and KPIs for all industries have not reached an integrated UI level.
  **My Suggested Priority for the Next Version**
  | Priority | Work that must be completed                                                  | Commercial Result                    |
  | :------- | :--------------------------------------------------------------------------- | :----------------------------------- |
  | 1        | Completing and proving sales, receipts, returns, general ledger, and costing | Trust in money and profit.           |
  | 2        | Completing batch, expiry, variant, serial, and returns                       | Reducing inventory loss.             |
  | 3        | Completing orders, purchasing, receipts, and inter-warehouse transfers       | Capital and procurement control.     |
  | 4        | Completing offline orders, Sync, and two-device testing                      | Trust in working in weak internet.   |
  | 5        | Completing production, waste, and healthy output cost                        | Real entry into production.          |
  | 6        | Completing tickets, reservations, capacity, and delivery                     | Real entry into services.            |
  | 7        | Completing vocabularies and KPIs of each industry in the UI                  | Specialized and sellable experience. |
  | 8        | PostgreSQL, HTTP, Browser, and real device acceptance                        | Proving Production readiness.        |

**My Final Verdict:** Commit `b54636fa` has significant technical progress compared to the previous version, especially in inventory, delivery, order, and production chains. But I still cannot consider Hisabche a "67-industry system ready for specialized sales". In the current state, Hisabche is a multi-industry business core with several more advanced operational workflows; not 67 completed specialized software.

To directly view the basis of this review:

- Commit `b54636fa`
- 67 Industry Registry
- Industry Profiles and Vocabularies
- Capability Matrix
- Offline Matrix
- Migrations Ledger

The next step with the most value is to build a 67-industry acceptance matrix that connects for each industry: actual UI title, actual KPI, page route, API, Hook, permission, Local Engine, accounting effect, PostgreSQL test, and Browser test; then it will be exactly clear which industry is truly ready for sale and which only has a profile and documented workflow.

---

# PART 2 — IMPLEMENTATION PROMPT (verbatim)

# HISABCHE — UNIVERSAL INDUSTRY OPERATING SYSTEM

## Complete Architecture, Implementation, Industry Workflow, Offline-First, UI, Accounting, and Production-Readiness Remediation

**Baseline commit:** `b54636fae57806c6d75c710c7621a49c8a3132d0`  
**Repository:** `hamednourzaei/hisabche`  
**Target branch:** `main`  
**Execution mode:** Autonomous, sequential, end-to-end implementation  
**Role:** Principal Software Architect + Staff Full-Stack Engineer + Domain Model Engineer + Database Engineer + Offline/Sync Engineer + QA/Release Engineer

---

# 1. MISSION

You are the single autonomous principal engineer responsible for bringing Hisabche's existing Universal Business OS architecture to a coherent, production-ready, evidence-backed implementation.

Your mission is to inspect the actual repository at the current HEAD, identify every remaining architectural, domain, workflow, UI, accounting, offline, synchronization, security, localization, testing, migration, and release-readiness gap, and implement the necessary corrections directly in the existing codebase.

Do not merely produce an audit, report, proposal, mockup, or roadmap.

**Implement the work.**

The final product must support different business models through one coherent business core, shared domain engines, industry-specific configuration, terminology, KPIs, and complete operational workflows.

Hisabche must not become 67 disconnected applications or 67 sets of duplicated business logic.

It must become:

> One Offline-First Business Operating System, with one business core, reusable domain engines, industry-adaptive experiences, reliable financial operations, and measurable workflow completeness.

The implementation must address the complete chain:

`Industry Profile → Capability Resolution → Domain Engine → API → Authorization → Local Engine → Sync → UI → Accounting Effects → KPI → Reports → Tests → Acceptance Evidence`

A capability is not complete merely because its name exists in a registry, schema, migration, route, dashboard, or documentation file.

A capability is complete only when its intended workflow works across every required layer and has appropriate automated and runtime evidence.

---

# 2. NON-NEGOTIABLE EXECUTION RULES

## 2.1 Repository safety

Before making changes:

1. Read all applicable `AGENTS.md` files.
2. Inspect the actual Git branch, HEAD, working tree, staged changes, and untracked files.
3. Confirm the actual repository package manager and runtime versions from repository configuration.
4. Inspect the current architecture and relevant implementation before designing replacements.
5. Build a dependency map for the affected modules.
6. Identify generated files and their generators.
7. Identify existing domain services, resolvers, validation schemas, hooks, UI components, and tests that should be extended rather than duplicated.

Preserve all pre-existing user work.

Never execute:

- `git commit`
- `git push`
- `git reset`
- `git rebase`
- `git stash`
- `git checkout`
- `git clean`
- destructive branch operations
- destructive database operations

Do not modify or inspect `.env` files or secrets.

Do not execute production Supabase DDL, production database writes, or production data mutations.

Do not install, upgrade, remove, or replace dependencies or modify lockfiles unless explicitly authorized.

Do not run production builds unless explicitly authorized.

Do not use subagents, background agents, parallel coding agents, or separate autonomous sessions.

Work sequentially as one engineer.

## 2.2 Engineering restrictions

- No `any`.
- No `@ts-ignore`.
- No `eslint-disable`.
- No fake APIs.
- No placeholder implementations.
- No dead code.
- No duplicate business engines.
- No parallel terminology systems.
- No duplicate KPI calculation engines.
- No category-specific conditionals scattered across unrelated UI components.
- No silent financial data overwrites.
- No silent deletion of business records.
- No fabricated acceptance evidence.
- No pretending that a migration was deployed.
- No claiming that an unexecuted test passed.
- Respect `exactOptionalPropertyTypes`.
- Preserve the existing Expo/RN compatibility constraints.
- Preserve the existing Electron, mobile, web, backend, and local-engine architecture.
- Use the existing shared UI packages and validation packages.
- Keep business logic independent of presentation and platform-specific code.

Code, comments, identifiers, and technical documentation must be in English.

Final implementation reports must be in Persian.

## 2.3 Existing architecture preservation

Before introducing a new abstraction, search for an existing equivalent.

Extend the existing implementation wherever possible.

The following must remain conceptually singular:

- Business core
- Industry profile registry
- Capability resolver
- Terminology resolver
- KPI definition and calculation system
- Authorization engine
- Financial posting engine
- Local-first mutation pipeline
- Sync conflict-resolution mechanism
- Audit/event history
- Workflow acceptance registry

If an equivalent already exists, improve it instead of creating a competing implementation.

---

# 3. INITIAL REPOSITORY AUDIT

Use commit `b54636fa` as the requested baseline, but inspect the actual current HEAD first.

Do not assume the current repository is unchanged.

Produce an internal implementation inventory covering:

- Repository packages and applications
- Business domain boundaries
- Industry profile definitions
- Industry operators
- Capability definitions
- Engine registrations
- Engine-to-route mappings
- API route ownership
- Client API hooks
- Screen and route ownership
- Authorization policies
- Local Engine routes
- Outbox and synchronization logic
- Financial posting and ledger behavior
- KPI definitions and dashboard composition
- Localization files
- Database schemas and migrations
- PostgreSQL tests
- Browser tests
- Mobile and desktop test coverage
- Generated documentation and registry files
- Existing release gates and CI workflows

Inspect at least the following relevant areas where they exist:

- `packages/validation`
- `packages/api`
- `packages/local-engine`
- `packages/ui`
- `packages/ui-contract`
- `packages/i18n`
- Backend services and routes
- Web application routes
- Mobile application routes
- Desktop application routes
- Database and migration directories
- Industry and universal-core documentation
- Existing scripts and CI checks

Do not rely on old generated reports when their recorded HEAD differs from the actual HEAD.

Regenerate reports only through their canonical generators.

Do not manually edit generated files unless their documented ownership explicitly requires it.

## 3.1 Baseline discrepancy detection

Specifically investigate:

- Stale `ENGINE-WIRING-STATUS.md`
- Stale `CAPABILITY-RECONCILIATION.md`
- Stale `sellable-industries.json`
- Stale industry-support registries
- Migration status discrepancies
- Missing PostgreSQL verification
- Missing browser acceptance evidence
- Capability-to-engine mismatches
- Engine-to-UI wiring gaps
- Routes without client consumers
- Client hooks without real screens
- Screens that do not use the intended industry configuration
- Offline endpoint classifications that do not match actual Local Engine behavior

Every generated artifact must identify the source HEAD from which it was produced.

A generated report must never silently represent a previous commit.

---

# 4. TARGET ARCHITECTURE

Implement and enforce the following logical architecture using existing repository conventions.

```text
                        HISABCHE BUSINESS OS
                                  |
                  +---------------+---------------+
                  |                               |
           BUSINESS IDENTITY                USER / WORKSPACE
                  |                               |
                  +---------------+---------------+
                                  |
                       INDUSTRY PROFILE
                                  |
                 +----------------+----------------+
                 |                |                |
           Capabilities      Terminology          KPI Profile
                 |                |                |
                 +----------------+----------------+
                                  |
                       CAPABILITY RESOLVER
                                  |
                      SHARED BUSINESS CORE
                                  |
       +--------------------------+--------------------------+
       |              |            |             |           |
     Sales         Inventory    Finance       Services    Workforce
       |              |            |             |           |
       +--------------+------------+-------------+-----------+
                                  |
                         DOMAIN ENGINES
                                  |
                    APPLICATION / API BOUNDARY
                                  |
                    AUTHORIZATION + VALIDATION
                                  |
                 +----------------+----------------+
                 |                                 |
             ONLINE PATH                       LOCAL PATH
                 |                                 |
           PostgreSQL                         Local Database
                 |                                 |
           Domain Events                       Outbox
                 |                                 |
                 +---------------+-----------------+
                                 |
                          SYNC PROTOCOL
                                 |
                       CONFLICT RESOLUTION
                                 |
                         AUDIT / HISTORY
                                 |
                   UI / DASHBOARD / REPORTS
                                 |
                      WORKFLOW ACCEPTANCE
```

This is a logical architecture, not permission to create duplicate implementations of existing components.

## 4.1 Architectural principles

1. One business core.
2. One source of business rules.
3. Goods are optional, not mandatory.
4. Services are first-class business objects.
5. Inventory is optional for service-only businesses.
6. Workforce is optional for owner-operated businesses.
7. Projects and assets are optional capabilities.
8. Industry profiles configure the experience; they do not duplicate domain logic.
9. Terminology is configurable and localized.
10. KPIs are data-driven, mathematically defined, and testable.
11. Online and offline operations use the same domain invariants.
12. Financial integrity takes priority over convenience.
13. Unknown business types must never silently fall back to retail.
14. A registered business type is not automatically supported.
15. A supported business type is not automatically sellable.
16. A sellable business type requires verified end-to-end evidence.

---

# 5. UNIVERSAL BUSINESS CORE

Inspect the current domain model and consolidate its concepts into one consistent model.

Do not force every business into a retail-oriented structure.

The core must support the following independent concepts.

## 5.1 Business resources

- Goods
- Services
- Materials
- Consumables
- Assets
- Equipment
- Packages
- Credits
- Labor
- Capacity
- Locations
- Projects
- Contracts
- Vehicles
- Livestock
- Agricultural resources
- Financial instruments where supported

A business may use one or several resource types.

Do not require every resource to have a stock quantity.

## 5.2 Commercial operations

Support the following as composable concepts:

- Sale
- Service sale
- Quote
- Estimate
- Sales order
- Invoice
- Credit note
- Return
- Refund
- Payment
- Deposit
- Installment
- Subscription
- Contract
- Reservation
- Work order
- Project order
- Purchase order
- Supplier invoice
- Delivery
- Settlement

Use existing schemas and engines where possible.

Do not create a second invoice or payment domain.

## 5.3 Resource consumption

Support:

- Quantity-based consumption
- Weight-based consumption
- Length-based consumption
- Area-based consumption
- Volume-based consumption
- Time-based consumption
- Session-based consumption
- Package-credit consumption
- Asset utilization
- Capacity utilization
- Labor utilization

Every consumption operation must have explicit units and appropriate validation.

## 5.4 Operational dimensions

Review the existing industry DNA dimensions and add or complete the missing concepts where appropriate:

- Offering
- Intake
- Inventory
- Billing
- Workforce
- CRM profile
- Business topology
- Terminology and KPI
- Unit tracking
- Pricing basis
- Asset custody
- Execution site
- Recurrence
- Approval depth
- Regulated domain

Use a centralized, validated model.

Do not introduce another independent set of industry classification flags.

Unknown or ambiguous dimensions must remain unknown until explicitly configured.

---

# 6. INDUSTRY PROFILE AND CAPABILITY SYSTEM

## 6.1 Profile architecture

The existing industry profile registry must remain the canonical industry configuration source.

Each profile should consistently define, where relevant:

- Stable industry key
- Display name
- Industry family
- Primary operating model
- Secondary operating models
- Resource types
- Capabilities
- Requested capabilities
- Capability constraints
- Default units
- Pricing basis
- Product/service form defaults
- Customer terminology
- Supplier terminology
- Workforce terminology
- Document terminology
- Dashboard configuration
- KPI profile
- Workflow definitions
- Permissions
- Offline expectations
- Regulatory classification
- Support tier
- Acceptance evidence requirements

Do not require every industry to implement every field.

Use explicit optionality and validated defaults.

## 6.2 Capability resolver

Create or improve one canonical resolver.

The resolver must answer:

- Is a capability available?
- Is it partially available?
- Is it unavailable?
- Is it dependent on another capability?
- Does it require an external service?
- Is it supported offline?
- Is it supported on mobile?
- Is it supported on desktop?
- Is additional authorization required?
- Does the capability have verified workflow evidence?

Use explicit status values such as:

- `AVAILABLE`
- `PARTIAL`
- `PLANNED`
- `UNAVAILABLE`
- `BLOCKED`
- `NOT_APPLICABLE`

Do not infer `AVAILABLE` merely because a feature is registered.

## 6.3 Support tiers

Implement or consolidate a canonical industry support status:

- `SUPPORTED`
- `SUPPORTED_WITH_LIMITS`
- `NOT_OFFERED`

A profile may be registered without being supported.

A profile may be supported without being sellable.

A profile may be sellable only when all mandatory workflows pass their acceptance gates.

Never use a missing requirement as evidence of readiness.

Never treat an empty requested-capability list as proof that a profile is complete.

## 6.4 Industry fallback

If the industry is unknown:

- Show a neutral general-business experience.
- Ask for business-model configuration where necessary.
- Do not assume retail.
- Do not enable stock-specific workflows by default.
- Do not display misleading inventory KPIs.
- Do not fabricate terminology.

Preserve legacy behavior through an explicit compatibility profile where necessary.

---

# 7. TERMINOLOGY AND INDUSTRY-ADAPTIVE UI

This is a critical requirement.

The current profile-level vocabulary definitions must become part of one complete UI terminology system.

## 7.1 Canonical terminology resolver

Create or extend a single terminology resolver that maps domain concepts to localized labels.

Examples:

| Domain concept | Retail        | Restaurant             | Education          | Repair           | Construction      |
| -------------- | ------------- | ---------------------- | ------------------ | ---------------- | ----------------- |
| Resource       | Product       | Ingredient / Menu Item | Course             | Equipment / Part | Material          |
| Customer       | Customer      | Guest                  | Student            | Client           | Employer / Client |
| Order          | Sales Order   | Food Order             | Enrollment         | Repair Order     | Project Order     |
| Invoice        | Sales Invoice | Bill                   | Tuition Invoice    | Service Invoice  | Progress Invoice  |
| Worker         | Employee      | Staff                  | Instructor         | Technician       | Worker            |
| Delivery       | Delivery      | Serving                | Session Delivery   | Device Return    | Site Delivery     |
| Inventory      | Stock         | Ingredients            | Learning Materials | Parts            | Materials         |

These are examples of terminology, not a hardcoded mapping to scatter through components.

## 7.2 Terminology requirements

Support:

- Persian
- Dari
- English

Persian and Dari must not be treated as interchangeable dictionaries.

Preserve existing localization conventions.

Add missing keys to all supported locales.

No UI should display raw internal identifiers as labels.

No hardcoded English business terminology in Persian screens.

No retail-only labels in service-only business workflows.

## 7.3 UI architecture

All affected screens must consume the canonical resolved industry configuration.

Do not implement industry-specific `if` statements in unrelated UI components.

The UI should render from:

- Resolved capabilities
- Resolved terminology
- Resolved dashboard configuration
- Resolved workflow configuration
- Resolved permissions
- Resource model
- Support limitations

The same business core should render different experiences without duplicating its logic.

## 7.4 Required UI audit

For every relevant workflow, trace:

`Route → Screen → Container → Hook → API → Domain Service`

Verify:

- Correct screen ownership
- Correct industry context
- Correct localized labels
- Correct empty states
- Correct loading states
- Correct permission states
- Correct validation messages
- Correct offline state
- Correct error handling
- Correct navigation
- Correct action visibility

Remove or fix dead buttons and actions that do not perform their advertised behavior.

Do not show unsupported features as active actions.

---

# 8. INDUSTRY-SPECIFIC WORKFLOWS

Implement complete workflows using shared engines.

Do not create separate accounting, invoice, inventory, customer, or synchronization systems for different industries.

The following workflows define the expected product behavior.

## 8.1 Retail and general commerce

Required workflow:

1. Configure business and sales defaults.
2. Register customers and suppliers.
3. Create goods and variants.
4. Register purchase receipts.
5. Update inventory and cost layers.
6. Create sales.
7. Record payments and credit balances.
8. Process returns and refunds.
9. Update stock and financial effects.
10. Review daily sales, margins, and cash reconciliation.

Required screens and terminology:

- Today's Sales
- POS
- Products
- Variants
- Stock
- Purchase Orders
- Customers
- Receivables
- Returns
- Cash Register
- Gross Margin
- Stock Turnover

## 8.2 Grocery, produce, food, and perishable goods

Complete:

- Batch tracking
- Expiry dates
- FEFO allocation where appropriate
- Recall management
- Damaged stock
- Waste tracking
- Expiry alerts
- Batch-level stock
- Purchase and sale traceability
- Supplier traceability

Never allow a recalled or blocked batch to be sold.

Prevent negative or inconsistent batch balances.

Define a safe policy for returns of expired or recalled goods.

A recall must preserve inventory and financial history.

## 8.3 Wholesale

Complete:

- Customer-specific pricing
- Tiered pricing
- Credit limits
- Approval and override
- Purchase orders
- Partial receipts
- Supplier invoices
- Partial payments
- Receivables aging
- Customer statements
- Warehouse transfers
- Delivery reconciliation

Credit-limit override must require the correct permission and an explicit reason.

## 8.4 Fabric, textile, wood, and dimensional goods

Complete:

- Length-based pricing
- Area-based pricing
- Volume-based pricing
- Roll identification
- Roll measurements
- Cutting plans
- Partial roll consumption
- Waste measurement
- Scrap classification
- Inventory deduction
- Cost allocation

For cutting:

`Material Consumed = Saleable Output + Waste + Other Explicit Loss`

Never silently discard waste.

Never charge the customer for internal waste unless the configured pricing policy explicitly defines that behavior.

Maintain accurate inventory and cost history.

## 8.5 Apparel, footwear, and variant-heavy commerce

Complete:

- Variant identity
- Color
- Size
- Model
- Barcode
- Variant-level stock
- Variant-specific cost layers
- Variant-specific returns
- Reorder points
- Variant-level sales reporting
- Legacy null-variant migration workflow

Do not silently assign legacy inventory to a variant.

Require explicit allocation or a documented unassigned-inventory policy.

Preserve existing inventory value.

## 8.6 Electronics, mobile, watches, appliances, and auto parts

Complete where applicable:

- Serial number tracking
- IMEI or equivalent identifiers
- Warranty registration
- Customer ownership
- Purchase source
- Sale linkage
- Service history
- Warranty claims
- Duplicate claim prevention
- Parts compatibility
- Return authorization

A serial number must not be sold twice while actively assigned to another sale.

Warranty claims must be idempotent.

Duplicate requests must not create duplicate claims or financial effects.

## 8.7 Restaurant, cafe, bakery, and butcher

Complete:

- Menu items
- Ingredients
- Recipes/BOM
- Order intake
- Table service where applicable
- Preparation workflow
- Order status
- Kitchen workflow where applicable
- Ingredient consumption
- Waste
- Production batches
- Cost per saleable unit
- Sales and settlement

Restaurant workflow:

`Table / Takeaway → Order → Preparation → Serving → Bill → Payment → Ingredient Consumption → Accounting`

Bakery workflow:

`Ingredients → Recipe → Production Batch → Good Output / Waste / Rework → Unit Cost → Sale`

Do not claim restaurant-grade POS readiness if table, kitchen, and recipe workflows are missing.

## 8.8 Pharmacy and healthcare

Implement only where legally and operationally appropriate.

Pharmacy requirements:

- Medicine catalog
- Batch
- Expiry
- Recall
- Prescription linkage where legally required
- Dispensing
- Restricted product handling
- Returns policy
- Insurance claims where supported
- Audit trail
- Access restrictions

Clinic requirements:

- Appointment scheduling
- Patient identity
- Service catalog
- Clinical record separation
- Sensitive data access controls
- Consent where required
- Billing
- Payment
- Audit history

Do not represent ordinary customer records as a compliant clinical record system.

Do not expose sensitive healthcare data through general financial reports.

Do not claim regulatory compliance without appropriate legal and technical verification.

If the required compliance model cannot be safely implemented within the current scope, classify the industry as `NOT_OFFERED` or `SUPPORTED_WITH_LIMITS`.

## 8.9 Gold and jewelry

Complete the required domain model before claiming specialist support:

- Purity
- Weight
- Gross and net weight
- Making charges
- Pricing policy
- Rate source and timestamp
- Purchase and sale calculations
- Returns
- Old-gold transactions where supported
- Melt/loss accounting where applicable
- Audit history

Use exact decimal arithmetic.

Do not use floating-point arithmetic for financial calculations.

Do not silently convert currency minor units.

Preserve AFN's zero-decimal convention.

Do not assume a universal `/100` conversion.

Gold inventory and financial valuation must remain reconcilable.

## 8.10 Currency exchange

Complete:

- Currency pair
- Buy rate
- Sell rate
- Transaction rate
- Rate timestamp
- Amount received
- Amount paid
- Profit calculation
- Currency-specific balances
- Cash reconciliation
- Rate authorization
- Transaction audit
- Offline limitations

A currency exchange must not be treated as an ordinary goods invoice.

Each transaction must preserve its currency dimensions and accounting effects.

Do not expose a partially implemented online-only engine as fully offline.

## 8.11 Education and course businesses

Complete:

- Student
- Course
- Enrollment
- Session
- Instructor
- Package
- Purchased credits
- Consumed credits
- Remaining credits
- Expiry policy
- Attendance
- Tuition
- Installments
- Renewal
- Refund policy

Required workflow:

`Student → Enrollment → Package Purchase → Session Booking → Attendance → Credit Consumption → Payment / Receivable → Renewal`

Never allow duplicate session consumption.

Never consume more credits than available unless an explicitly authorized policy permits it.

## 8.12 Beauty, salon, and appointment businesses

Complete:

- Service catalog
- Staff
- Availability
- Resource capacity
- Appointment
- Rescheduling
- Cancellation
- No-show
- Service completion
- Package credit
- Payment
- Staff commission where supported

Prevent double booking of the same resource when capacity rules prohibit it.

## 8.13 Laundry

Complete:

- Customer intake
- Individual garment identification
- Order grouping
- Service type
- Quantity
- Pricing
- Processing status
- Quality check
- Ready-for-pickup
- Delivery
- Missing/damaged garment reporting
- Payment
- Audit history

Required lifecycle:

`Received → Tagged → Processing → Quality Check → Ready → Delivered`

A laundry order must support individual garment tracking where required.

Do not claim laundry-item tracking until the complete workflow is implemented.

## 8.14 Repair, mechanics, and IT service

Complete:

- Customer asset/device
- Intake
- Serial/VIN where applicable
- Condition on arrival
- Issue description
- Diagnosis
- Estimate
- Approval
- Technician assignment
- Parts consumption
- Labor
- Repair status
- Quality check
- Delivery
- Payment
- Warranty

Required lifecycle:

`Intake → Diagnosis → Estimate → Approval → Work Queue → Parts/Labor → Quality Check → Delivery → Payment`

Preserve the full repair history.

Prevent unapproved work and unauthorized charges.

## 8.15 Construction, projects, and consulting

Complete:

- Project
- Contract
- Customer
- Budget
- Cost codes
- Materials
- Labor
- Timesheets
- Milestones
- Progress
- Deposits
- Progress invoices
- Receivables
- Project profitability
- Final settlement

Project cost:

`Actual Project Cost = Materials + Labor + Equipment + Other Approved Costs`

Project margin must derive from real financial records.

Do not confuse invoiced revenue with cash collected.

## 8.16 Manufacturing

Complete:

- BOM
- Materials
- Work orders
- Production batches
- Resource consumption
- Labor
- Good output
- Waste
- Rework
- Quality checks
- Finished goods
- Unit costing
- Financial posting

The existing production-batch improvements must be integrated into the complete inventory and financial lifecycle.

Reconcile:

`Input Materials + Labor + Allocated Overhead = Good Output Cost + Waste Cost + Rework Cost + Remaining WIP`

Use the existing approved costing policy.

Never duplicate cost-layer calculations.

## 8.17 Agriculture and livestock

Do not claim support until the relevant domain exists and is verified.

Where implemented, support:

- Farms and locations
- Crop cycles
- Planting
- Input consumption
- Harvest
- Yield
- Waste
- Livestock registry
- Animal identity
- Feeding
- Veterinary events
- Production
- Inventory
- Cost allocation
- Sales

Do not map agricultural or livestock resources to ordinary retail stock without explicit domain modeling.

## 8.18 Transport, delivery, and courier

Complete:

- Shipment
- Route
- Vehicle
- Driver
- Dispatch
- Assignment
- Delivery attempts
- Failure reasons
- Proof of delivery
- Customer signature
- Photo evidence
- COD
- Cash collection
- Settlement
- Outstanding balance
- Driver reconciliation

COD rules:

- Record the actual amount collected.
- Preserve the outstanding amount when under-collected.
- Do not mark the customer invoice as fully paid when cash collection is incomplete.
- Prevent duplicate settlement.
- Preserve evidence and audit history.

The new transport and delivery services must be integrated with the shared order, payment, and accounting domains.

## 8.19 Travel, property, rental, and security services

Implement only through shared, reusable domains.

Travel:

- Booking
- Passenger
- Service supplier
- Deposit
- Confirmation
- Supplier settlement
- Cancellation
- Refund

Property:

- Property
- Owner
- Tenant
- Lease
- Rent schedule
- Deposit
- Payment
- Renewal
- Maintenance

Rental:

- Asset
- Availability
- Reservation
- Handover
- Return
- Damage
- Deposit
- Utilization

Security:

- Contract
- Site
- Staff assignment
- Shift
- Attendance
- Service delivery
- Recurring billing

Do not claim specialist readiness if these workflows are incomplete.

---

# 9. FINANCIAL INTEGRITY AND ACCOUNTING

This is a mandatory cross-industry requirement.

All business operations that have financial consequences must use one accounting and financial posting architecture.

## 9.1 Required invariants

- Every financial posting must be balanced.
- Every posting must be idempotent.
- Every posting must have an identifiable source document.
- Every posting must preserve its currency.
- Every posting must preserve its original amount.
- Posted financial records must not be silently overwritten.
- Finalized invoices must remain immutable except explicitly permitted synchronization metadata.
- Corrections must use documented reversal or adjustment operations.
- Returns and refunds must preserve audit history.
- Receivables must not disappear when partial payments occur.
- Deposits must follow the existing approved liability treatment.
- Inventory valuation must reconcile with stock movements.
- COGS must be derived from the approved cost engine.
- Waste and rework must be represented explicitly.
- Customer balances must reconcile with payment and invoice records.
- Supplier balances must reconcile with purchases and payments.

## 9.2 Existing owner decisions

Preserve previously approved business decisions.

In particular:

- Order deposits remain liabilities.
- Refunds use the existing `payment.record` permission.
- Refunds require a reason and complete audit logging.
- Do not create a separate `payment.refund` permission.
- Credit-limit overrides require `credit.override` and a reason.
- AFN uses zero decimal places.
- Never introduce an unconditional `/100` currency conversion.
- Existing approved WIP and costing decisions must remain intact.

## 9.3 Accounting verification

For every workflow, define and test:

- Source document
- Debit
- Credit
- Currency
- Amount
- Posting timestamp
- Idempotency key
- Reversal behavior
- Audit actor
- Authorization

A UI success notification is not proof of accounting correctness.

---

# 10. OFFLINE-FIRST AND SYNCHRONIZATION

The product must behave consistently online and offline.

Use the existing local database, outbox, mutation, and synchronization architecture.

Do not introduce Redis, polling-based synchronization, or a second sync engine.

## 10.1 Offline operation contract

Every mutation must be explicitly classified:

- `OFFLINE_SUPPORTED`
- `ONLINE_REQUIRED`
- `READ_ONLY_OFFLINE`
- `UNSUPPORTED`

Classification must describe actual implementation, not intention.

For each endpoint and workflow, document:

- Local implementation
- Server implementation
- Validation location
- Idempotency strategy
- Conflict behavior
- Retry behavior
- Offline UI behavior
- Sync status
- Required permissions
- Financial impact

## 10.2 Outbox and mutation handling

Ensure:

- Local writes are durable.
- Outbox mutations have stable IDs.
- Retries are idempotent.
- Network interruption does not lose committed local drafts.
- Server acknowledgement is explicit.
- Duplicate requests do not duplicate business effects.
- Failed mutations remain inspectable.
- Conflict records remain recoverable.
- Local data is not overwritten by stale server responses.
- Device hydration does not replace newer local work.
- Sync cursor advancement is safe.
- Finalized financial records are protected.

## 10.3 Conflict resolution

Never use generic last-write-wins for financial data.

Use domain-specific policies.

Examples:

- Draft descriptions may support controlled merging.
- Stock movements require invariant-preserving reconciliation.
- Payments require idempotency and explicit conflict handling.
- Finalized invoices cannot be silently overwritten.
- Customer profile fields may use field-level resolution where safe.
- Reservations require capacity and overlap validation.
- Serial numbers require unique ownership validation.

Unresolved conflicts must be visible to an authorized owner.

Every resolution must preserve audit history.

## 10.4 Cross-platform verification

Verify the actual behavior across:

- Web
- Electron
- Android
- Other supported mobile targets

Preserve the current Expo/RN compatibility constraints.

Do not upgrade React Native or introduce the New Architecture unless explicitly authorized.

Test weak-network and offline scenarios.

A single-device test does not prove multi-device synchronization.

---

# 11. AUTHORIZATION, SECURITY, AND AUDIT

Use one canonical permission system.

Each operation must have a defined permission.

Examples:

- `sales.create`
- `sales.finalize`
- `payment.record`
- `inventory.adjust`
- `inventory.recall`
- `purchase.create`
- `purchase.receive`
- `production.execute`
- `delivery.dispatch`
- `delivery.confirm`
- `credit.override`
- `reports.view`
- `audit.view`

Use existing permission identifiers where they already exist.

Do not create duplicates.

Implement:

- Server-side authorization
- Client-side capability-aware visibility
- Local permission checks
- Workspace isolation
- Resource ownership validation
- Sensitive data restrictions
- Audit history
- Reason requirements for privileged actions
- Idempotency enforcement
- Rate limits where relevant
- Input validation
- Safe error responses

Client-side permission checks must never replace server-side authorization.

Do not trust a user-provided workspace ID or owner ID without validating access.

Ensure new workflows do not introduce cross-workspace access.

---

# 12. KPI AND REPORTING ARCHITECTURE

Create or consolidate one canonical KPI definition system.

Do not calculate the same KPI independently in multiple screens.

Each KPI definition must contain, where relevant:

- Stable identifier
- Domain
- Industry applicability
- Localized label key
- Description
- Formula or canonical calculation reference
- Required data sources
- Unit
- Currency behavior
- Date range behavior
- Permission requirement
- Offline availability
- Empty-state behavior
- Validation tests

## 12.1 Required KPI examples

Retail:

- Net Sales
- Gross Margin
- Average Order Value
- Stock Turnover
- Cash Variance

Wholesale:

- Outstanding Receivables
- Overdue Receivables
- Customer Credit Exposure
- Supplier Payables
- Order Fulfillment Rate

Grocery:

- Expiring Stock Value
- Waste Rate
- Stockout Rate
- Batch Recall Exposure

Apparel:

- Sales by Variant
- Margin by Variant
- Slow-Moving Variants
- Variant Stockout Rate

Gold:

- Inventory Weight by Purity
- Making Charge Revenue
- Inventory Valuation
- Weight Reconciliation Difference

Exchange:

- Currency Balances
- Buy/Sell Spread
- Realized Exchange Profit
- Cash Reconciliation Difference

Restaurant:

- Revenue per Table
- Average Preparation Time
- Ingredient Cost
- Waste Rate
- Sales by Menu Item

Education:

- Active Students
- Sessions Consumed
- Remaining Package Credits
- Renewal Rate
- Outstanding Tuition

Repair:

- Open Repair Orders
- Average Repair Time
- Parts Cost
- Labor Revenue
- On-Time Completion Rate

Manufacturing:

- Production Yield
- Waste Rate
- Rework Rate
- Unit Cost
- Work in Progress

Construction:

- Budget vs Actual
- Project Progress
- Cost to Complete
- Project Margin

Courier:

- Delivery Success Rate
- Failed Attempts
- Outstanding COD
- Driver Settlement Difference

These are required domain examples, not permission to hardcode fake metrics.

## 12.2 KPI calculation rules

- Use real source records.
- Respect the user's date range and timezone.
- Respect workspace and permission boundaries.
- Preserve currency dimensions.
- Use decimal-safe arithmetic.
- Handle missing data explicitly.
- Never represent missing values as zero unless mathematically justified.
- Never mix forecast values with actual values.
- Never mix revenue with collected cash.
- Never display a KPI without a defined calculation.

Every displayed KPI must have automated tests.

---

# 13. DASHBOARD AND NAVIGATION

Implement adaptive dashboards using the canonical industry profile.

Required behavior:

- Hide irrelevant modules.
- Prioritize the most important daily workflow.
- Show real operational work queues.
- Display industry-specific terminology.
- Display supported KPIs.
- Show capability limitations clearly.
- Preserve permission boundaries.
- Support mobile, desktop, and web layouts.
- Avoid excessive dashboard cards.
- Avoid duplicate navigation entries.
- Avoid creating parallel menus for different industries.

Examples:

| Industry      | Primary dashboard focus                         |
| ------------- | ----------------------------------------------- |
| Retail        | Sales, cash, stock, receivables                 |
| Grocery       | Sales, expiring stock, waste, replenishment     |
| Apparel       | Variant stock, sales by size/color              |
| Wholesale     | Orders, receivables, purchasing                 |
| Restaurant    | Orders, kitchen queue, table operations         |
| Education     | Sessions, students, package credits             |
| Salon         | Appointments, staff, daily services             |
| Repair        | Open work orders, technicians, overdue jobs     |
| Manufacturing | Work orders, materials, output, waste           |
| Construction  | Projects, milestones, budget, actual cost       |
| Courier       | Dispatch, delivery attempts, COD                |
| Exchange      | Currency balances, transactions, reconciliation |
| Gold          | Weight, purity, rates, making charges           |

Do not display unsupported dashboards as if their data were reliable.

---

# 14. DATABASE AND MIGRATION REQUIREMENTS

Inspect every affected schema and migration.

For each new or modified database structure:

- Define constraints.
- Define indexes.
- Define foreign keys.
- Define workspace isolation.
- Define unique constraints.
- Define idempotency constraints.
- Define deletion behavior.
- Define audit behavior.
- Define migration order.
- Define rollback or recovery considerations.
- Define data backfill behavior.
- Define compatibility with existing data.

## 14.1 Migration discipline

Never execute production migrations.

Create the required migration files following repository conventions.

For each migration, provide:

1. Migration SQL.
2. Verification SQL.
3. PostgreSQL integration test.
4. RLS verification where relevant.
5. Idempotency verification where relevant.
6. Backward-compatibility analysis.
7. Data migration strategy where required.

Do not claim a migration is deployed because its SQL file exists.

Do not claim all pending migrations are applied.

Inspect existing migration records only through authorized, non-destructive means.

Never delete historical financial data to simplify migration.

## 14.2 Migration reconciliation

Reconcile the existing migration inventory.

For every migration, classify:

- `VERIFIED_APPLIED`
- `VERIFIED_NOT_APPLIED`
- `PENDING_DEPLOYMENT`
- `NEEDS_REVIEW`
- `BLOCKED`

Only use verified evidence.

Where deployment evidence is unavailable, retain an explicit unknown/pending state.

Do not fabricate migration execution results.

---

# 15. INDUSTRY WORKFLOW REGISTRY

Create or improve one machine-readable workflow registry.

Each industry must have explicit workflow definitions.

A workflow should include:

- Industry key
- Workflow ID
- Workflow name
- Business objective
- Preconditions
- Required capabilities
- Required permissions
- Required domain entities
- Required routes
- Required UI screens
- Required hooks
- Required API operations
- Local Engine support
- Offline policy
- Accounting effects
- Audit requirements
- KPI outputs
- Test references
- Acceptance criteria
- Support limitations

Do not create a second industry registry.

Extend the existing registry or introduce a single canonical workflow layer that references it.

## 15.1 Required traceability

For each workflow, prove the complete chain:

```text
Industry
  → Capability
  → Domain Engine
  → API Route
  → Client Hook
  → UI Screen
  → Permission
  → Local Engine
  → Sync Behavior
  → Accounting Effect
  → KPI
  → Automated Tests
  → Acceptance Evidence
```

The registry must detect:

- Missing route ownership
- Unused routes
- Hooks without screens
- Screens without API integration
- Capabilities without engines
- Engines without tests
- Missing authorization
- Missing offline policy
- Missing accounting effects
- Missing localization
- Missing KPI definitions
- Stale generated files

Do not mark a workflow complete when any mandatory link is missing.

---

# 16. ACCEPTANCE AND SELLABILITY SYSTEM

Implement one evidence-based acceptance model.

A business profile must not become sellable through a manually asserted boolean.

## 16.1 Acceptance levels

Use clear states such as:

- `REGISTERED`
- `IMPLEMENTED`
- `IMPLEMENTED_NOT_LIVE_VERIFIED`
- `WORKFLOW_VERIFIED`
- `SUPPORTED_WITH_LIMITS`
- `SELLABLE`
- `BLOCKED`
- `NOT_OFFERED`

Respect existing status conventions where possible.

## 16.2 Evidence requirements

A workflow acceptance record should identify:

- Exact repository HEAD
- Workflow ID
- Industry ID
- Test command
- Test result
- Test timestamp
- Environment classification
- Browser evidence
- API evidence
- PostgreSQL evidence
- Device evidence where relevant
- Known limitations
- Reviewer or execution source

Never reuse evidence from a different HEAD without proving its validity.

Never turn missing evidence into a pass.

Never infer production readiness from TypeScript compilation alone.

## 16.3 Sellability gate

A profile may be marked `SELLABLE` only when:

1. All mandatory workflows are implemented.
2. All critical API operations work.
3. Authorization tests pass.
4. Financial invariants pass.
5. Database constraints are verified.
6. Required migrations have deployment evidence.
7. Browser acceptance passes.
8. Offline behavior matches its declared policy.
9. Sync and conflict behavior pass where applicable.
10. Localization is complete.
11. KPI calculations are verified.
12. Critical user journeys have no unresolved blockers.

For regulated industries, add the required specialist and compliance review gates.

If any requirement cannot be verified, report the exact reason and retain a non-sellable status.

---

# 17. TESTING STRATEGY

Tests must validate real business behavior, not just schemas and registry consistency.

## 17.1 Unit tests

Test:

- Capability resolution
- Terminology resolution
- Industry fallback
- KPI calculations
- Pricing
- Unit conversion
- Variant costing
- Batch allocation
- Expiry
- Recall
- Waste
- Rework
- Financial posting
- Permission evaluation
- Idempotency
- Conflict policies

## 17.2 Domain integration tests

Test complete workflows for representative industries:

- Retail
- Grocery
- Wholesale
- Apparel
- Fabric
- Gold
- Currency exchange
- Restaurant
- Pharmacy where safely supported
- Education
- Salon
- Laundry
- Repair
- Manufacturing
- Construction
- Courier
- Agriculture where implemented

Test both successful and failed business paths.

## 17.3 PostgreSQL tests

Verify:

- Constraints
- RLS
- Workspace isolation
- Unique indexes
- Foreign keys
- Financial posting
- Idempotency
- Partial payments
- Returns
- Refunds
- Stock movements
- Variant cost layers
- Batch recall
- COD reconciliation
- Warranty claim deduplication
- Migration compatibility

## 17.4 Browser tests

At minimum, test:

1. Workspace creation.
2. Industry selection.
3. Initial setup.
4. Dashboard configuration.
5. Main industry workflow.
6. Customer and resource creation.
7. Document creation.
8. Payment.
9. Accounting result.
10. Reports.
11. Permissions.
12. Unsupported capability visibility.
13. Localization.
14. Offline state.
15. Recovery after reconnection.

## 17.5 Offline and synchronization tests

Test:

- Offline draft creation
- Offline editing
- Reconnection
- Duplicate request
- Retry
- Crash recovery
- Stale response
- Multi-device synchronization
- Concurrent stock changes
- Concurrent payment attempts
- Finalized invoice immutability
- Conflict resolution
- Owner review
- Audit history

## 17.6 Regression testing

Run the relevant existing suites before and after modifications.

Do not weaken or delete existing tests to obtain a green result.

If an existing test exposes a genuine defect, fix the implementation rather than suppressing the assertion.

Report all skipped tests.

---

# 18. REQUIRED INDUSTRY ACCEPTANCE MATRIX

Build a complete acceptance matrix for every industry profile actually present in the repository.

Do not assume the number of profiles is 67 without verifying the current source.

For every profile, report:

| Dimension       | Required output                         |
| --------------- | --------------------------------------- |
| Industry        | Stable industry key                     |
| Family          | Industry family                         |
| Operating model | Goods / Services / Mixed / Other        |
| Terminology     | Defined and localized                   |
| Capabilities    | Required, available, partial, missing   |
| Workflows       | Implemented and verified                |
| API             | Wired and tested                        |
| UI              | Screen and navigation verified          |
| Permissions     | Server and client checks verified       |
| Offline         | Supported or explicitly online-required |
| Sync            | Retry and conflict behavior             |
| Accounting      | Financial effects verified              |
| KPI             | Formula and source verified             |
| Database        | Constraints and migration status        |
| Browser         | Acceptance result                       |
| PostgreSQL      | Acceptance result                       |
| Mobile/Desktop  | Platform evidence                       |
| Limitations     | Explicit list                           |
| Support status  | Supported / Limited / Not Offered       |
| Sellability     | Evidence-backed decision                |

Generate the matrix through a canonical script.

Do not manually maintain competing CSV, JSON, Markdown, and TypeScript representations.

Generated artifacts must record their source HEAD and generation timestamp.

---

# 19. DOCUMENTATION

Update documentation only after implementation reflects the actual code.

Required documentation:

1. Universal Business Core Architecture
2. Industry Profile Architecture
3. Capability Resolver Contract
4. Terminology Resolver Contract
5. KPI Definition Contract
6. Domain Engine Ownership Matrix
7. API and UI Wiring Matrix
8. Offline Workflow Matrix
9. Accounting Invariants
10. Conflict Resolution Policies
11. Migration and Verification Inventory
12. Industry Workflow Matrix
13. Industry Acceptance Matrix
14. Sellability Policy
15. Production Readiness Report

Documentation must distinguish:

- Implemented
- Tested
- Runtime verified
- Live verified
- Blocked
- Planned

Do not describe an intended feature as an existing feature.

Do not copy stale metrics from previous reports.

---

# 20. EXECUTION PHASES

Execute these phases sequentially.

Do not stop after producing the audit.

## Phase 0 — Repository truth and baseline

- Verify actual HEAD.
- Inspect working tree.
- Read repository rules.
- Map existing architecture.
- Identify stale generated artifacts.
- Establish test baseline.
- Record blockers.

Deliverable: verified baseline inventory.

## Phase 1 — Architecture and domain consolidation

- Resolve duplicate domain concepts.
- Consolidate capability ownership.
- Complete the industry profile contract.
- Complete business resource modeling.
- Validate operating-model dimensions.
- Enforce unknown-industry safety.
- Preserve backward compatibility.

Deliverable: one coherent business-core architecture.

## Phase 2 — Terminology, dashboard, and KPI

- Implement the canonical terminology resolver.
- Complete Persian, Dari, and English labels.
- Connect profile vocabulary to actual UI.
- Complete dashboard composition.
- Implement data-driven KPI definitions.
- Remove unsupported or misleading dashboard items.
- Test all supported terminology paths.

Deliverable: genuinely industry-adaptive UI.

## Phase 3 — Domain workflow completion

Prioritize the following shared business chains:

1. Sales and invoicing
2. Payments and receivables
3. Inventory and costing
4. Procurement and supplier settlement
5. Returns and refunds
6. Production and waste
7. Services and appointments
8. Repair and work orders
9. Delivery and COD
10. Projects and contracts

Implement each workflow across domain, API, permissions, UI, local engine where applicable, accounting, and tests.

Deliverable: real end-to-end workflows.

## Phase 4 — Industry-specific gaps

Implement and validate the required industry workflows in Section 8.

Prioritize business models with strong reuse of existing engines.

Do not falsely classify incomplete specialist workflows as supported.

Deliverable: industry workflows with explicit limits.

## Phase 5 — Offline and synchronization

- Complete endpoint classification.
- Implement missing local mutations where feasible.
- Align local and server validation.
- Enforce idempotency.
- Complete conflict policies.
- Protect financial immutability.
- Verify recovery and multi-device behavior.

Deliverable: truthful offline guarantees and test evidence.

## Phase 6 — Security and accounting

- Complete authorization.
- Verify workspace isolation.
- Validate financial invariants.
- Test audit behavior.
- Verify privileged overrides.
- Verify accounting effects for all implemented workflows.

Deliverable: secure and financially consistent operations.

## Phase 7 — Database and migration reconciliation

- Review all affected migrations.
- Add missing verification SQL.
- Add PostgreSQL tests.
- Verify RLS.
- Document unapplied migrations.
- Do not deploy migrations without authorization.

Deliverable: auditable migration readiness.

## Phase 8 — Acceptance and industry support

- Generate workflow traceability.
- Execute relevant automated tests.
- Run browser tests where available.
- Run PostgreSQL tests where available.
- Run platform-specific checks where available.
- Generate the industry acceptance matrix.
- Assign support and sellability states only from evidence.

Deliverable: evidence-backed industry readiness.

## Phase 9 — Final regression and reporting

- Run all safe, relevant existing test suites.
- Run type checks and lint.
- Validate generated artifacts.
- Confirm no prohibited files were modified.
- Confirm no production database writes occurred.
- Confirm no dependency or lockfile changes occurred.
- Confirm no Git history operations occurred.
- Review the complete diff.

Deliverable: final implementation and release-readiness report.

---

# 21. PRIORITY RULES

Do not attempt to make all industries appear complete at the same time.

Prioritize shared workflows that unlock the largest number of industries.

Priority order:

**P0 — Financial and operational integrity**

- Sales
- Invoice
- Payment
- Receivables
- Ledger
- Inventory
- Costing
- Returns
- Authorization
- Audit

**P1 — Offline reliability**

- Local mutations
- Outbox
- Idempotency
- Conflict resolution
- Recovery
- Multi-device behavior

**P2 — High-reuse industry workflows**

- Variants
- Batch and expiry
- Unit pricing
- Cutting and waste
- Procurement
- Production
- Delivery and COD
- Service orders

**P3 — Industry experience**

- Terminology
- KPI
- Dashboard
- Workflow navigation
- Empty states
- Localization

**P4 — Specialist industries**

- Gold
- Exchange
- Pharmacy
- Healthcare
- Agriculture
- Livestock
- Travel
- Rental
- Complex manufacturing

Regulated or complex industries must not be promoted to supported merely because a generic sales workflow exists.

---

# 22. QUALITY GATES

Before considering any workflow complete, verify all applicable gates:

- [ ] Domain model exists.
- [ ] Business invariants are defined.
- [ ] Validation schema exists.
- [ ] API route is connected.
- [ ] Service ownership is clear.
- [ ] Workspace isolation is enforced.
- [ ] Server authorization is enforced.
- [ ] UI hook is connected.
- [ ] UI screen is reachable.
- [ ] Terminology is industry-aware.
- [ ] Persian localization exists.
- [ ] Dari localization exists.
- [ ] English localization exists.
- [ ] Local Engine behavior is defined.
- [ ] Offline policy is accurate.
- [ ] Idempotency is implemented where needed.
- [ ] Conflict behavior is defined.
- [ ] Accounting effects are verified.
- [ ] Audit history is preserved.
- [ ] KPI calculations are defined.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] PostgreSQL tests pass where applicable.
- [ ] Browser tests pass where applicable.
- [ ] Platform limitations are documented.
- [ ] Generated reports are fresh.
- [ ] Acceptance evidence references the correct HEAD.

A workflow must not receive `VERIFIED_COMPLETE` while mandatory gates remain unchecked.

---

# 23. DEFINITION OF DONE

The task is complete only when all of the following are true:

1. The existing architecture has been inspected and reconciled.
2. There is one canonical business core.
3. There is one canonical industry profile registry.
4. There is one canonical capability resolver.
5. There is one canonical terminology resolver.
6. There is one canonical KPI definition system.
7. Industry-specific terminology reaches the actual UI.
8. Dashboards use real industry-relevant data.
9. Every registered industry has an explicit workflow and support assessment.
10. Implemented workflows are connected end-to-end.
11. Missing capabilities are explicitly classified.
12. Unsupported industries are not misrepresented.
13. Financial invariants are preserved.
14. Offline classifications match real behavior.
15. Sync conflicts do not silently overwrite financial records.
16. Authorization and workspace isolation are verified.
17. New migrations include verification and tests.
18. Existing migration status is accurately reported.
19. Generated reports match the actual HEAD.
20. Industry acceptance evidence is reproducible.
21. No existing regression tests have been weakened.
22. All safe, relevant checks have been executed.
23. Every unexecuted or blocked check is explicitly reported.

Do not declare the entire product production-ready if external verification is unavailable.

Do not declare all industries sellable if some mandatory workflows remain incomplete.

---

# 24. FINAL REPORT FORMAT

Write the final report in Persian.

Use the following structure.

## A. Executive Summary

- Actual starting HEAD
- Actual final HEAD
- Implementation status
- Overall completion status
- Critical blockers
- Production-readiness assessment

## B. Architecture Changes

| Area | Previous state | Implemented changes | Evidence |
| ---- | -------------- | ------------------- | -------- |

## C. Industry Coverage

| Industry | Workflow status | UI status | Offline status | Accounting status | Tests | Support status |
| -------- | --------------- | --------- | -------------- | ----------------- | ----- | -------------- |

Include every actual industry profile.

## D. Industry Terminology

Show actual labels implemented for representative industries.

Clearly distinguish implemented labels from recommended labels.

## E. KPI Coverage

Show KPI identifiers, formulas, data sources, and test status.

## F. Domain Workflow Results

Report completed workflows and their evidence.

## G. Offline and Sync

Report actual offline coverage, conflict behavior, retry behavior, and multi-device test results.

## H. Database and Migrations

Report:

- New migration files
- Verification files
- PostgreSQL tests
- RLS tests
- Deployment status
- Unverified migration status

## I. Security and Accounting

Report the results of the financial and authorization invariants.

## J. Automated Tests

| Test category | Executed | Passed | Failed | Skipped | Blocked |
| ------------- | -------: | -----: | -----: | ------: | ------: |

Never report unexecuted tests as passed.

## K. Industry Sellability

Report the actual count of:

- Registered industries
- Supported industries
- Supported with limits
- Not offered
- Workflow verified
- Sellable
- Blocked

Use generated evidence, not estimates.

## L. Remaining Blockers

For each blocker include:

- Exact issue
- Affected workflow or industry
- Why it remains blocked
- Required external action
- Risk
- Recommended next step

## M. Git and Change Safety

Report:

- Whether the branch changed
- Whether commits were created
- Whether files outside scope changed
- Whether dependency files changed
- Whether secrets were accessed
- Whether production database operations occurred

Do not perform prohibited Git operations to obtain a clean working tree.

## N. Final Status

Use exactly one of these overall classifications:

- `VERIFIED_COMPLETE`
- `IMPLEMENTED_NOT_LIVE_VERIFIED`
- `BLOCKED`
- `PARTIALLY_IMPLEMENTED`

Explain the evidence supporting the chosen status.

---

# 25. AUTONOMOUS EXECUTION INSTRUCTION

Proceed without asking for permission between phases.

Do not stop after the first discovery of a gap.

Do not return a list of recommendations instead of implementing them.

Make reasonable, architecture-consistent decisions based on the existing repository.

When multiple implementation choices exist:

1. Prefer the smallest change that preserves the existing architecture.
2. Prefer shared domain behavior over industry-specific duplication.
3. Prefer explicit configuration over scattered conditionals.
4. Prefer reversible migrations.
5. Prefer deterministic calculations.
6. Prefer observable failure over silent fallback.
7. Prefer accurate limitations over fake completeness.

If an external dependency, missing credential, unavailable database, missing device, or unavailable test environment prevents verification:

- Continue all work that can safely be completed.
- Implement the code and tests that do not require the external resource.
- Record the exact blocker.
- Do not fabricate a successful result.
- Do not bypass security or production protections.

If a required change would violate the repository safety rules, do not perform that change. Implement the safe portion and clearly report the remaining authorization requirement.

**Do not stop at architecture documentation. Implement the architecture in the actual code.**

**Do not stop at profile definitions. Wire them to real screens and workflows.**

**Do not stop at API routes. Connect hooks, UI, authorization, local execution, and accounting.**

**Do not stop at offline declarations. Verify actual offline mutations and synchronization.**

**Do not stop at KPI labels. Implement their calculations and tests.**

**Do not stop at industry registration. Prove workflow completeness.**

**Do not stop at green unit tests. Run the available integration and acceptance checks.**

The final objective is a coherent, maintainable, evidence-backed, industry-adaptive Business Operating System that can honestly state what it supports, what it supports with limitations, and what it does not yet offer.

Start with repository inspection and execute the entire task sequentially until all safely achievable work is implemented and verified.

---

# PART 3 — IMPLEMENTATION LOG (appended as work lands)

_This section is maintained by the implementing agent. Each entry records the
exact HEAD at the time, the files changed, and the verification numbers._

### WP-06 — Gold claims reconciled with the wired code — IMPLEMENTED_NOT_LIVE_VERIFIED

- **HEAD:** `b54636fa` (working tree carries the earlier WP-04/WP-15 work; no commits made).
- **Finding:** the review's «invoice-line price not computed from purity/making charge» was based
  on a stale matrix. `quoteGoldItemPrice` → `priceGoldLineWithSnapshot` is already wired into
  `InvoiceService.withDerivedLineTotals`, and `buildItemRows` persists the locked metal snapshot
  columns; the second-hand purchase RPC posts to both weight and money books. Three limitation
  codes were false, not missing functionality.
- **Change:** replaced `LINE_PRICING_FROM_PURITY_NOT_WIRED`, `MAKING_CHARGE_NOT_COMPUTED_ON_LINE`
  and `OLD_GOLD_TRADE_IN_NOT_ON_INVOICE` with the single true limitation
  `GOLD_WEIGHT_VALUE_REPORT_NOT_WIRED` (`summarizeGoldReportByKarat` remains a pure function with
  no route/hook/screen). Status stays `partial` so `capability-composition.test.ts` is untouched.
- **Files changed:** `docs/prompts/THE-LAST.md` (this log), `docs/campaigns/WP-06-SPEC.md` (new),
  `packages/validation/src/schemas/business-capabilities.ts`,
  `packages/i18n/messages/{fa,af,en}/common.json`, plus the 11 regenerated docs.
- **Measured:** validation guard tests 5 files / **89 passed**; ui i18n guards 2 files / **7 passed**;
  full ui suite **2874 passed / 2 skipped (2876)**, 232 files passed + 1 skipped;
  `tsc --noEmit` validation **0**, ui **0**; `eslint` on changed source **0 errors**;
  11 generators `--check` all green; `git diff --check` **0**.
- **Not done:** the gold weight/value report route/hook/screen (the kept limitation); live PG/HTTP
  witness (blocked by `SeCreateGlobalPrivilege`), so the existing `gold-01.pg.test.ts` is generated
  but unexecuted here. No status was promoted to `available` without a real chain.

### WP-07 — Exchange: offline trade drafts — IMPLEMENTED_NOT_LIVE_VERIFIED

- **HEAD:** `b54636fa`.
- **Finding:** the online exchange engine (KYC, atomic RPC GL posting, `resolveOfflineFxConflict`)
  already existed; the device side did not — an agent without signal could not write a trade at all.
- **Change:** pure draft rules (`fx-drafts.domain.ts` — same `convertAtRate`, 4-state machine,
  review rule) + `fx_trade_drafts` table (V34, `SCHEMA_VERSION=34`) + `/local-fx/trade-drafts`
  routes + 4 device hooks. Drafts move NO cash, NO position and post NO journal; submit only marks
  `pending`, and a queued sell with a short/unknown position is flagged `needs_review`.
  Limitation `FX_TRADES_ONLINE_ONLY` → `FX_TRADE_CONFIRMATION_ONLINE_ONLY` (confirmation stays online).
- **Verification:** reported in the final message of this session once tsc/tests/eslint finish.
- **Not done:** live PG/HTTP witness (environment blocked); no new DB migration — V34 is a LOCAL
  cache migration only, no Supabase DDL was written or run.

### Session status — autonomous continuation (no owner interaction)

**Completed in this session** (all `IMPLEMENTED_NOT_LIVE_VERIFIED`, HEAD `b54636fa`):

- WP-06 (gold claim reconciliation), WP-07 (offline FX trade drafts + V34),
  WP-08 (tiered pricing rule), WP-10 (table service on shared order core),
  WP-14 (procurement pack rounding + three-way preview),
  WP-16 (core-charge liability + one-time refund), WP-17 (offline contracts + V35),
  WP-18 (offline package-credit grant).
- Earlier already complete: WP-04, WP-13, WP-15, WP-19 (from prior sessions).
- Honestly kept partial with a true limitation (no code change): WP-11 (cross-device slot lock
  genuinely needs the server), WP-12 (SLA breach status machine is server-side),
  WP-22 (no forecast calculation domain on disk).

**Not implemented in this session — require NEW domains + server DDL/PG tests, outside the safe
file-only scope:** WP-20 (asset rental / room nights), WP-21 (approval queue — domain lives in
backend, wiring would duplicate it), WP-23 (livestock / crop cycle), WP-24 (optical prescription),
WP-25 (pharmacy prescription / insurance), WP-27 (laundry item tracking), WP-28 (clinical record /
health-data access), WP-29 (travel booking / supplier settlement), WP-26 (registry wiring already
done). These remain `planned`/`partial` in the registry with their honest limitations — the
prompt's own rule (§25) forbids promoting them without a real end-to-end chain and evidence.

**Full regression measured this session:**

- validation **1233 passed** (101 files) · api **320** · local-engine **652** ·
  app-bridge **56** · ui **2874 passed / 2 skipped**.
- backend suite: **5932 passed / 5 failed / 1239 skipped** (7176 tests, 635 files).
  The 168 failed FILES are exactly the `*.pg.test.ts` set (170 exist) — embedded Postgres cannot
  start with `SeCreateGlobalPrivilege` (owner-side blocker); the 5 failed tests are inside those
  PG files. All 465 non-PG unit-test files passed; capability/wiring guards 21/21 green.
- tsc: validation, app-bridge, local-engine, api, ui all **0 errors**.
- eslint on every changed source file: **0 errors**. 11 generators `--check`: green.
  `git diff --check`: **0**. OPEN-DECISIONS hook count refreshed 65 → 70 (7/7 test green).

**Standing blockers (unchanged, owner-side):** live Postgres witness blocked by
`SeCreateGlobalPrivilege`; no commit/push; no build; no browser/device acceptance evidence —
hence no industry can be marked `SELLABLE` and the overall verdict stays
`IMPLEMENTED_NOT_LIVE_VERIFIED` / `PARTIALLY_IMPLEMENTED`.

### This session — work packages WP-14, WP-16, WP-17, WP-10 (Autonomous continuation)

All at HEAD `b54636fa`, all `IMPLEMENTED_NOT_LIVE_VERIFIED`. No commit, no build, no live DB.

- **WP-14** procurement: device-side pack rounding + three-way-match preview (same shared rules).
  Limitations → `PACK_ROUNDING_ON_DEVICE_PREVIEW`, `THREE_WAY_FINAL_MATCH_SERVER_ONLY`.
- **WP-16** auto parts: core-deposit liability line + one-time core refund rule wired to device.
  Limitation → `CORE_REFUND_POSTING_SERVER_ONLY`.
- **WP-17** recurring contracts: `local_contracts` + `local_contract_bills` (V35), bill-period
  proposal with stable idempotency key; engine now declares its local route.
  Limitation → `CONTRACT_BILL_INVOICE_SERVER_ONLY`.
- **WP-10** table service: promoted planned → partial on the shared order core; occupancy,
  KDS stages, kitchen gate, exact bill split. Limitation → `TABLE_FINAL_INVOICE_SERVER_ONLY`.
- Injection test for `PLANNED_WITH_LIMITATION` now uses `livestock_register` (still planned).
- **Measured:** validation guards+new domain tests **39 passed**; local-engine offline route tests
  **23 passed**; ui i18n guards **7 passed**; 11 generators `--check` green; tsc validation,
  app-bridge, local-engine, api all **0**; eslint changed sources **0**; `git diff --check` **0**.

### WP-08 — Tiered pricing — IMPLEMENTED_NOT_LIVE_VERIFIED

- Pure `tier-pricing.domain.ts`: highest earned quantity break sets the base price, then the
  existing `quotePrice` engine owns floor/promotion/drift. 1/10/50 units → 10/9/8; 5/5 tests.
- `QUANTITY_BREAK_UI_BASIC` kept honestly: the break editor UI is still basic.

### WP-18 — Offline package-credit grant — IMPLEMENTED_NOT_LIVE_VERIFIED

- Added `POST /local-package-credits/grant` using shared `planPackageGrant`; idempotent,
  non-positive refused, no duplicate sync command. 4/4 tests.
- `GRANT_ONLINE_ONLY` → `GRANT_ACTIVATION_POLICY_BASIC` (honest; activation policy still basic).

---

# PART 4 - APPROVED ARCHITECTURE DECISIONS & CONTEXT (owner-confirmed, 19 Nov 2026)

This part records the owner's confirmed product decisions and the repository-grounded
analysis that motivate PART 5, PART 6 and PART 7. It is context for the implementation
prompts that follow, not a prompt itself.

The decisions are fixed as follows:

- **Offline-first / Primary:** at start, one primary device owns the local database and
  performs every permitted business operation without internet.
- **Hybrid after migration:** buying the online plan does NOT switch the offline plan off;
  both environments can stay active and exchange changes through controlled Sync.
- **Flexible device topology:** first an independent device; later the ability to promote one
  device to a Local Server and attach LAN Clients over the internal network, without internet
  dependency.
- **One Business Core:** sales, invoicing, inventory, accounting, customers, employees and all
  other domains must not be implemented twice for online and offline.

A decisive architecture note: "Hybrid" does NOT mean two independent databases with unlimited
writes and automatic conflict resolution. Data ownership, operation identity, versions, change
ordering and a conflict queue must be explicit. For financial documents Last-Write-Wins is
unacceptable.

## Repository state at last verified review

HEAD confirmed: `b54636fae57806c6d75c710c7621a49c8a3132d0` (commit `fixed ci 33`, 18 Nov 2026).

| Area             | Actually seen in code                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Local core       | `packages/local-engine` exists and registers multiple local routes.                                                       |
| DB contract      | `LocalDb` in `packages/local-engine/src/db.ts` is a SQLite abstraction.                                                   |
| Windows          | Electron uses `better-sqlite3`; DB in a stable AppData path.                                                              |
| Mobile           | Expo uses `expo-sqlite`; local DB initialized before the WebView opens.                                                   |
| Shared shell     | Mobile and desktop use `@hisabche/app-shell` and the `@hisabche/app-bridge` contract.                                     |
| Server sync      | Migration defines `sync_change_log`, `sync_mutations`, cursor and optimistic concurrency.                                 |
| Conflict         | Separate migration `sync_conflicts` keeps both versions and the recorded decision.                                        |
| Backup           | JSON export and v1 Export Package exist, but current export coverage is limited.                                          |
| Migration Center | Local import and migration center exist, but their contract alone does not prove complete migration of all Hisabche data. |

Direct code references (pinned to the reviewed commit):

- packages/local-engine/src/index.ts
- packages/local-engine/src/db.ts
- packages/app-bridge/src/index.ts
- apps/desktop/electron/main/db/database.ts
- apps/mobile/app/_layout.tsx
- packages/local-engine/src/export/exporter.ts
- docs/sync-engine-migration.sql
- docs/sync-conflicts-migration.sql

### Three gaps the prompts must address

1. Current backup is NOT a complete restorable backup. `backup.ts` exports from `localTableSchema`
   and `sync_queue` and sets `restorable: false` in metadata; `exporter.ts` exports only a fixed
   set of tables. Coverage must be reconciled with all real data, dependencies and migration info.
2. A Local Engine does NOT mean every capability runs fully offline. The engine rejects some
   routes offline via `endpointAvailability`. Each capability must be classified separately.
3. Hybrid Sync must be completed AND proven. Previously reported gaps (e.g. `order_deposits`
   missing from `DELTA_ENTITIES`, some movement tables missing from `localTableSchema`, no real
   restart/PostgreSQL tests) must be re-checked at current HEAD — never assumed fixed or still broken.

## Target architecture (two stages)

Stage 1 - Standalone Offline: Primary Device (Windows / Android / supported hosts) ->
Local Business Authority -> Shared Business Core -> Local Runtime (SQLite + Local Transactions +
Outbox). Day-to-day work without internet, even after restart.

Stage 2 - Hybrid Online + Offline: Local Device (SQLite Replica, offline capable) <-> Cloud
Backend (PostgreSQL, server authority) through Bidirectional Sync Protocol (Outbox, Idempotency,
Cursor, Version, Conflict Review, Audit).

Development topology: Standalone (one device) -> Local Server (one host + LAN Clients). Only
Standalone must be operational in phase one; Local Server contracts must not become an excuse for
a parallel system or premature local networking.

### Source of Truth

| Situation                                              | Authoritative reference                                                 |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| Before online migration                                | primary device local database                                           |
| After Hybrid activation, accepted/synchronized changes | server PostgreSQL                                                       |
| Changes recorded while offline                         | Local SQLite + Outbox, status Pending                                   |
| Conflict between local and server change               | both versions preserved for an authorized, recorded decision            |
| Changes received from server                           | local replica with cursor and version                                   |
| LAN device changes                                     | first through the local owner; not uncontrolled writes across databases |

## Owner acceptance criteria (final acceptance tests)

1. Full internet cut + create invoice: invoice is recorded and survives restart.
2. Offline changes + reconnect: each operation reaches the server exactly once.
3. Conflict on an invoice or payment: no version is deleted; conflict is reviewable.
4. Full Export + Import in a new workspace: data, relationships and financial balances preserved.
5. Continue working on phone and computer after migration: both work with controlled Sync.

Scope note: Standalone and Hybrid must become operational. Local Server and LAN Client get only
contracts and a development path for now; they must NOT be advertised as ready merely because a
few files or a UI option exist.

---

# PART 5 - MISSION: UNIFIED OFFLINE-FIRST BUSINESS CORE, PORTABLE CLOUD MIGRATION & HYBRID SYNC

## Autonomous Repository-Grounded Engineering Mission

### ROLE

You are the sole autonomous Staff+ Engineer responsible for completing Hisabche's shared
offline/online architecture. Work independently, sequentially and end-to-end. Do not use
subagents, parallel agents, background workers, or delegate repository investigation.

Communicate all progress and final reports in Persian. Write source code, identifiers, tests,
SQL comments and technical documentation in English. Do not ask the owner questions. Make
decisions from the actual repository, existing architecture and the approved product decisions
in PART 4. If a decision requires human approval or an external production action, implement
all safe preparatory work and report the exact blocker. Do not claim a capability is complete
without evidence.

### 1. APPROVED PRODUCT DECISIONS - NON-NEGOTIABLE

1. Initial offline mode `PRIMARY_DEVICE`: one device owns the local business database; the
   business operates without internet; Windows desktop and supported mobile devices use
   native/local persistence; restart must not lose committed local data; the first operational
   release does not require a LAN server.
2. After cloud migration `HYBRID`: local and cloud remain usable; the local device keeps working
   offline; the cloud backend is the authority for accepted/synchronized server state; both sides
   can originate mutations under an explicit synchronization protocol; pending offline changes are
   durable until acknowledged or explicitly resolved; the owner never loses a local operation
   merely because the server rejects it.
3. Device topology `FLEXIBLE`: support the initial standalone primary-device model; keep
   contracts extensible for a future Local Server + LAN Clients; do not build a second database
   engine, second business core, or unnecessary LAN subsystem during the initial phase; future
   topology support through explicit device roles and runtime boundaries, not speculative infra.
4. One business core: online and offline execute the same business rules and domain calculations;
   no parallel invoice, inventory, accounting, costing, permission or KPI engine; driver/runtime/
   transport may differ; business behavior must not differ merely by internet availability.
5. Migration: an offline customer exports complete business data into a portable archive; creates
   an online workspace, uploads, validates, previews, imports, reconciles and activates Hybrid;
   existing IDs and relationships preserved wherever the target schema allows; import retry-safe
   and auditable; no direct production restore from an uploaded SQLite file; no blind import into
   live business tables.

### 2. REPOSITORY BASELINE - VERIFY BEFORE TRUSTING

Baseline HEAD `b54636fae57806c6d75c710c7621a49c8a3132d0` (`fixed ci 33`). Confirmed structures:
`packages/local-engine`, `packages/app-bridge`, `apps/desktop/electron/main/db/database.ts`,
`apps/desktop/electron/main/ipc/register.ts`, `apps/mobile/app/_layout.tsx`,
`packages/local-engine/src/export`, `packages/local-engine/src/routes/backup.ts`,
`packages/local-engine/src/routes/import.ts`, `docs/sync-engine-migration.sql`,
`docs/sync-conflicts-migration.sql`, `docs/data-migration-center-migration.sql`.

Confirmed facts: local engine registers many offline routes; LocalDb abstracts SQLite; Windows
uses better-sqlite3; Android uses expo-sqlite via native host; shared shell/bridge; server sync
migration defines change log, mutations, optimistic concurrency, monotonic cursor; separate
conflicts migration; export package v1 with checksums and limited explicit table list; `/workspaces/backup`
marks output `restorable: false`; endpoint availability rules reject some routes offline; migration
system must not be assumed to support a complete native archive. This is a baseline, NOT permission
to assume the repo has not changed.

Mandatory first actions: inspect actual local HEAD/branch/git status; verify remote/main HEAD and
compare; read complete root AGENTS.md, CLAUDE.md and scoped instructions; inspect code-intelligence
status/freshness (stale -> record and use approved fallback; never treat empty index result as proof);
inspect actual implementations and callers for LocalDb, local schema/migrations, createLocalEngine,
endpoint availability, desktop DB init and IPC, mobile DB init and bridge, sync_queue/outbox, push
and pull runners, DELTA_ENTITIES, localTableSchema, sync_change_log, sync_mutations, sync_conflicts,
local backup/export, cloud migration/import, attachment storage, device/workspace identity,
auth and capability enforcement; inspect relevant tests and callers before editing; build a verified
architecture map from actual source files.

### 3. ABSOLUTE REPOSITORY SAFETY RULES

Follow AGENTS.md as canonical. Never commit/push; never reset/rebase/stash/checkout/clean/overwrite
user changes; preserve dirty/untracked work; never read/print/edit .env or secrets; never execute
DDL or writes against live Supabase/PostgreSQL; never install/upgrade/downgrade/remove dependencies;
never modify lockfiles; never run production builds unless explicitly authorized; never change Expo
SDK/RN version/New Architecture; never use any/@ts-ignore/eslint-disable/dead code/unused imports/
fake APIs/fake data/placeholders; respect exactOptionalPropertyTypes; never weaken tests/guards;
do not duplicate existing engines/resolvers/schemas; do not edit unrelated files; never mark an
external migration applied without human confirmation; if a native capability/dependency is
unavailable report it as a blocker, do not silently degrade to a fake offline implementation.

### 4. TARGET ARCHITECTURE

4.1 Shared business execution. Intended path: UI -> shared command/use case -> shared domain rules
-> persistence/runtime port -> local SQLite adapter OR server persistence adapter. Discover exact
package boundaries before changes; do not create packages if equivalents exist. The shared business
layer must not import Electron, Expo, React Native, browser-only APIs, Supabase client,
better-sqlite3, expo-sqlite, filesystem hosts, or network transports. Domain stays deterministic
and testable. Use existing canonical implementations for calculations, validation, permissions,
posting, costing, pricing, document transitions. Consolidate duplication only where safe. Do not
weaken server validation/authorization.

4.2 Persistence. Inspect whether LocalDb and adapters are sufficient; preserve unless evidence
proves a missing capability. Required: transactional writes, foreign keys, durable commits,
crash-safe migrations, stable IDs, explicit workspace scope, explicit device identity, durable
outbox, idempotent mutation processing, safe restart/recovery, no network requirement for local
reads/writes, no silent fallback from local DB failure to healthy online-only state. Local DB init
failure must be a distinct operational state, never an empty business shown as success. SQLite and
PostgreSQL need not have identical physical schemas, only compatible domain/portability contracts.

4.3 Runtime modes. Use explicit validated states; reuse existing enums. Conceptual:
OFFLINE_STANDALONE, HYBRID_CONNECTED, HYBRID_DISCONNECTED, LOCAL_SERVER, LAN_CLIENT. Introduce
the first four only where real supported behavior exists; LOCAL_SERVER/LAN_CLIENT may be contract-
level future capabilities, not advertised as operational. Never infer runtime mode from a boolean
internet flag alone. Distinguish: local db ready/unavailable, online authenticated/unauthenticated,
cloud reachable/unreachable, sync pending/blocked, conflict pending, migration required.

### 5. PHASE A - COMPLETE THE REAL OFFLINE PRIMARY DEVICE

5.1 Capability inventory from actual endpoint registry, local route table, UI callers and local
schema; record domain, endpoint/command, local impl, local tables, online impl, permissions, sync
behavior, offline availability, test coverage, limitation. Truthful statuses: AVAILABLE_OFFLINE,
PARTIALLY_AVAILABLE_OFFLINE, ONLINE_REQUIRED, NOT_IMPLEMENTED, BLOCKED. Do not equate route
registration with workflow support; verify complete user workflows. At minimum inspect onboarding/
workspace init, products/services, customers, invoices/items, payments/allocations, receivables/
payables, warehouses/stock, inventory movements, purchasing, accounting/journals, costing, till/POS,
employees/payroll, attendance, branches, taxes, pricing, industry capabilities, audit, permissions,
backup/restore, reports.

5.2 Offline bootstrap. No cloud call to open an already provisioned offline workspace; durable
local and device identity; local authorization not dependent on remote refresh per operation;
expired/invalid credentials handled explicitly; local auth not bypassing permission model; no
plaintext passwords or long-lived cloud secrets in business tables; use existing secure storage;
keep licensing validation separate from business-data availability; no license bypass. If offline
licensing needs an owner decision, implement the safe boundary and report the decision.

5.3 Native hosts. Windows: preserve Electron main-process ownership of native SQLite; keep DB out
of renderer; preserve IPC validation/authorization and existing DB path; never orphan data. Mobile:
preserve Expo/RN legacy constraints and expo-sqlite host; init local DB before WebView; native bridge
owns storage; no desktop-only imports in mobile; no third mobile-only business logic. Both hosts run
the same local engine where the dependency graph permits.

5.4 Offline workflow tests with real SQLite execution (not success mocks): fresh install, workspace
init, invoice create, payment record, inventory movement, accounting posting, close/restart, DB
reopen, integrity after restart, outbox persistence, offline permission checks, missing local DB,
failed schema migration, duplicate command retry, interrupted transaction recovery. Test adapters
independently where supported. A passing unit test is not evidence of native device operation.

### 6. PHASE B - HYBRID SYNCHRONIZATION

6.1 Authority model: no two independent final authorities. Before cloud activation local is
authority; after, PostgreSQL for accepted state, SQLite a durable replica/offline executor, offline
mutations locally committed and pending, accept/reject explicit, rejected financial operations
recoverable/reviewable. No Last-Write-Wins for invoices, payments, journal entries/lines,
inventory movements, cost layers, payroll postings or other financial records. Use existing
versioning/idempotency/conflict/audit/server transactions.

6.2 Outbox and mutation contract: inspect existing sync_queue, builders, push routing/ordering,
server endpoints; extend, do not create a second outbox. Every logical mutation has stable mutation
ID, workspace ID, origin device ID, entity type, entity ID, operation, base entity version, local
creation time, schema/contract version where required, durable payload, retry count/state, last
error classification. Retry reuses the same ID. Server returns stored result for duplicate instead
of re-executing financial effects. Lost HTTP response must not create duplicate invoices/payments.

6.3 Pull and change log: inspect monotonic cursor and sync_change_log. Cursor-based incremental
pull, deterministic ordering, workspace isolation, deletion/tombstone propagation, cursor advanced
only after durable local application, bounded batches, resumable pulls, own-origin echo handling,
schema compatibility checks, snapshot rehydration when cursor outside retention. Never advance a
cursor past an unapplied change; never timestamps as the only cursor; no new polling if event-driven
or explicit trigger exists.

6.4 Complete entity coverage: generate/verify registry from local tables, sync entities, server
routes and change-log triggers. Compare localTableSchema, CREATE statements, local migrations,
outbox registry, DELTA_ENTITIES, server trigger coverage, mutation handlers, permissions, deletion,
attachments. Every supported synced entity has a deliberate strategy; do not assume parent sync
covers child. Re-check specifically (verify current HEAD first, do not hardcode): order_deposits,
inventory movement tables, backup/restore coverage, entities with no server trigger, push-only or
pull-only entities. Create a machine-checkable coverage guard.

6.5 Conflict resolution: extend sync_conflicts. Preserve server version/row, client version/payload,
mutation ID, entity identity, divergent fields, financial-divergence indicator, origin device,
detected timestamp, resolution, reason, resolver, resolution timestamp, audit evidence. Never
discard client payload after rejection; never auto-overwrite financial server rows; never silently
discard local financial mutations; ordinary users cannot resolve without capability; use existing
auth/audit; automatic merge only for explicitly safe non-financial fields with deterministic tested
rules; financial conflicts require authorized review or domain workflow. Conflict survives restart,
logout/login where policy permits, network failure.

### 7. PHASE C - PORTABLE OFFLINE BUSINESS ARCHIVE

Audit and extend existing export code, do not duplicate. 7.1 One canonical versioned portable
archive format; evolve existing ExportPackage/checksum if safe; no competing formats. Include every
business-data category discovered from actual schema: workspace/business profile, settings,
currencies/units, industry/capability config, warehouses/shelves, products/services,
customers/suppliers, invoices/items, payments/allocations, receivables/payables, accounts, journal
entries/lines, inventory balances/movements, costing layers/consumptions, purchases/POs, employees/
workforce, payroll/attendance, taxes, branches, serials/batches/variants, audit history, attachments

- relationships, custom config, schema/feature metadata. Do not export passwords, tokens, cloud
  credentials, secure-store secrets, device secrets, rebuildable caches, duplicate projections.
  Preserve pending mutations and identities per documented policy; never import an old outbox as
  already accepted. 7.2 Versioned manifest: format id/version, source app version, source schema
  version, source device/workspace ID, export timestamp, business identity, section/table manifest,
  record counts, section checksums, total checksum, compatibility info. Deterministic serialization
  for checksums. Validate all contents before import. Checksum proves integrity not authenticity:
  use strongest existing supported encryption/authentication without inventing crypto or adding
  dependencies; if encryption cannot be done safely, stop the unsafe path and report the blocker;
  never claim an encrypted archive when only checksums exist. 7.3 Consistent snapshot via read
  transaction/SQLite snapshot; no mixed moments; export never mutates data; retry-safe; streaming/
  chunking for large archives; attachments as real binary with verified references/checksums. 7.4
  Safe local restore after auditing existing support: validate version, checksums, workspace identity,
  schema compatibility, required sections, FK relationships, attachment refs, counts, financial
  invariants; reject corrupted/unsupported; never silently skip a required table; never overwrite the
  only DB copy; preserve recovery. Archive suitable for migration and restore, not a diagnostic dump.

### 8. PHASE D - OFFLINE-TO-CLOUD MIGRATION CENTER

Extend existing Data Migration Center; no second center. Workflow: create cloud workspace -> upload
archive -> validate structure/integrity -> detect source versions -> verify supported path ->
preflight report -> record counts/business summary -> detect missing deps/incompatible data -> dry
run -> stage -> import in dependency order -> preserve IDs/relationships where possible -> reconcile
business/financial invariants -> detailed report -> activate workspace -> establish hybrid device
registration and cursor. No direct SQLite restore into PostgreSQL; no arbitrary/customer SQL; no
trusting metadata without validation. 8.1 Staging/idempotency: use existing job infra; durable job
state machine; upload/network/worker/client interruption never duplicates; stable source-to-target
identity ledger; preserve source IDs or deterministic mapping; use canonical creation/posting
services, not raw inserts to bypass invariants. 8.2 Financial reconciliation: invoice counts/totals
by currency, payment counts/totals by currency, allocations, receivables/payables by currency,
stock by product/warehouse, movement totals, journal/line counts, debit=credit, account balances,
cost layers/consumption refs, payroll/accounting links, attachment counts/refs. Unknown stays
unknown, never zero; no wrong rounding/currency conversion; integer minor units on server;
AFN zero-decimal, never generic /100. Mismatch blocks activation unless explicit audited authorized
resolution. 8.3 Atomic activation: staging, transactional boundaries, durable state; activate only
after validation+reconciliation; deterministic recovery; no broad compensating DELETE.

### 9. PHASE E - HYBRID ACTIVATION AND DEVICE REGISTRATION

Register original device against cloud workspace; preserve stable identity; establish initial
cursor/snapshot boundary; reconcile pending offline mutations; push eligible pending idempotently;
pull server changes; verify convergence; enable normal Hybrid. Initial migrated snapshot must not
be re-imported as new mutations. Distinguish imported historical state, pre-migration pending
mutations, post-activation cloud mutations, post-activation local mutations. No duplicate journal
entries/stock movements/payments/invoices. Import establishes baseline versions and cursor. Local
DB remains available and is never deleted; keep a recovery path until customer verifies cloud.

### 10. PHASE F - FUTURE FLEXIBLE TOPOLOGY

Prepare contracts for PRIMARY_DEVICE, LOCAL_SERVER, LAN_CLIENT; only PRIMARY_DEVICE must be fully
operational. No second business DB or sync engine for LAN. Future Local Server owns one authoritative
local DB for its LAN workspace, secure authenticated local API, workspace/capability permissions,
device registration, idempotent mutations, durable local change history, client reconnect and
cursor recovery, no two devices silently claiming primary, works without internet. LAN Client must
not write directly to server SQLite; use a transport boundary reusing application contracts. Do not
claim LAN support without real hosts, security tests, multi-device tests, restart and conflict tests.

### 11. SECURITY AND DATA PROTECTION

Workspace isolation; capability checks local and remote; server authorization mandatory;
authenticated device registration; secure local credential storage; archive confidentiality;
integrity verification; attachment path validation; no path traversal; upload size limits;
decompression limits; safe parsing of untrusted archives; no arbitrary SQL; audit events for
export/import/activation/conflict/device registration; no secrets in logs; no business data in
diagnostics unless safe and redacted. UI hiding is never a security boundary. Do not weaken RLS
or tenancy.

### 12. TESTING AND VERIFICATION

Behavior not claims. Shared-core parity (local SQLite vs online/server path) for representative
commands; offline tests (fresh startup, workspace load, invoice create/update/finalize, payment,
movement, posting, restart, persistent data/outbox, failed DB init, migration failure, duplicate
retry, local permissions, unsupported feature reporting); sync tests (registration, snapshot, push,
pull, duplicate push, lost response/retry, server/client restart, offline->reconnect, cursor
order/recovery, deletion, coverage guard, financial conflict, safe non-financial merge, conflict
persistence, resolution authorization, audit, multiple devices); migration tests (valid/corrupted/
checksum-mismatch/missing-section/unsupported-version/invalid-identity/missing-FK/duplicate-ID/
partial-upload/interrupted/retry/repeated/failed-reconciliation/successful-reconciliation/
activation-failure/preservation of local DB, attachments, historical accounting/inventory); real
SQLite; real PostgreSQL where permitted else mark BLOCKED (do not mock and claim success); native
adapter tests without production builds or physical-device claims.

### 13. MIGRATIONS AND DATABASE CHANGES

Inspect existing first; no duplicate tables/functions; create docs/<name>-migration.sql and
docs/VERIFY-<name>.sql and real *.pg.test.ts with RLS, workspace isolation, indexes/constraints,
idempotency/rollback, repository conventions; never execute against live Supabase; final status
`Post-migration verification query generated — PENDING HUMAN CONFIRMATION`; never write PASS for
unapplied migration.

### 14. USER EXPERIENCE

Use existing shared UI; no new navigation system. Clearly distinguish offline-ready, online-
synchronized, online with pending local changes, sync in progress/blocked, conflict requiring
review, local DB unavailable, migration validation failed/ready/importing/reconciliation failed/
completed, cloud activation pending. Clear backup/export and import/migration workflows. Never
show successful backup when required tables failed; never show successful sync with unacknowledged
mutations; never show successful migration when reconciliation failed. fa/af/en consistent, RTL
correct, no inert buttons.

### 15. IMPLEMENTATION STRATEGY

Sequential evidence-based slices, no repo-wide rewrite. Slice 0 audit/map (verify HEAD/dirty tree,
inspect sources/tests, evidence gap matrix, duplicates, exact files, blocked verification; no code
edits). Slice 1 shared contracts and offline primary runtime. Slice 2 entity coverage and durable
sync. Slice 3 portable archive. Slice 4 offline-to-cloud migration. Slice 5 hybrid activation.
Slice 6 flexible topology contracts. After each slice: inspect diff, targeted tests, type checks,
lint changed files, git diff --check, scope check, update evidence matrix, continue without asking
unless genuine external/owner decision. Do not stop after a plan; implement all safe in-scope work.

### 16. PERFORMANCE AND RESOURCE CONSTRAINTS

Optimize for low-memory Android and ordinary Windows; inspect transaction size, indexes, query
plans, outbox/pull batch size, archive memory, attachment streaming, startup latency, migration
time, import memory, restart recovery. No full archive in memory unnecessarily; no background
polling; no Redis; no all-cloud processing; bounded batches/resumable jobs; no optimization without
measurement/regression evidence.

### 17. REQUIRED FINAL DELIVERABLES (Persian)

A Executive status (one of VERIFIED_COMPLETE / IMPLEMENTED_NOT_LIVE_VERIFIED /
VERIFIED_WITH_LIMITATIONS / BLOCKED / NOT_IMPLEMENTED). B Actual architecture with file paths and
symbols for offline standalone, online, hybrid sync, archive export, cloud import, device
registration, future LAN. C Gap matrix (initial/final status, files, tests, evidence, blockers). D
Business capability matrix (genuine offline/partial/internet-required, not all available because
the app opens). E Migration evidence (format version, schema version, tables, attachments, counts,
checksum, dependency validation, reconciliation, idempotency, recovery). F Sync evidence (entity
coverage, push/pull, idempotency, cursor recovery, conflict persistence, financial conflict,
restart, multi-device). G Tests (exact command, passed/failed/skipped/blocked, exit code; never infer
from previous runs). H Production limitations (live PG, pending SQL, browser, Windows packaged,
Android physical device, network disconnection, real customer dataset migration). I Final changed-file
list with git status --short and git diff --stat. No commit/push.

### 18. DEFINITION OF DONE

Not complete merely because TypeScript passes: customer starts offline app without internet; primary
device creates/persists real transactions; restart loses nothing; shared rules not duplicated;
complete local dataset exported to validated archive; cloud workspace validates/imports safely;
imported workspace passes reconciliation; original device activates Hybrid without losing local
data; offline mutations sync idempotently; conflicts preserve both versions with authorized
resolution; local work continues during outages; no false offline/LAN advertising; all results
reproducible. Distinguish implementation completion from live verification. Do not fabricate
evidence. Final principle: one business core, one canonical rules set, one portable data contract,
multiple runtimes, durable offline, safe migration, controlled sync, no duplicate financial truth,
no silent data loss.

---

# PART 6 - MISSION: HISABCHE V2 - COMPLETE CODEBASE DEFECT ELIMINATION & PRODUCTION READINESS

## Follow-up Mission to the Unified Offline-First / Hybrid Architecture Implementation

### ROLE

Sole autonomous Staff+ Software Engineer, Architect, Security Engineer, QA Engineer and
Performance Engineer. Direct continuation of PART 5. Build on the actual implementation and repo
state left by that mission. Identify and eliminate all discoverable, reproducible, in-scope code
defects, incomplete workflows, integration gaps, architecture violations, security weaknesses,
performance bottlenecks and production-readiness gaps. Do not merely produce an audit:
Investigate -> Reproduce -> Fix -> Test -> Reinspect -> Verify -> Repeat. No subagents/parallel/
background/delegation. No questions. All reports Persian; code/identifiers/comments/SQL/tests
English.

### 1. MISSION RELATIONSHIP AND BASELINE

Must run after PART 5. At start: read previous mission report and changed-file list and results and
blocked items; inspect current HEAD and working tree (preserve user modifications); verify which
previous changes actually exist; verify latest code-intelligence index; read root/scoped AGENTS.md/
CLAUDE.md; build dependency map for affected subsystems. Never assume previous success from its
report. Revalidate critical outputs: shared core, local SQLite, Windows runtime, mobile runtime,
offline bootstrap, outbox, server sync, conflict handling, archive export, cloud import, financial
reconciliation, hybrid activation, device registration, migrations, entity coverage. Incomplete
previous requirements are defects here. Use actual current HEAD, not a historical SHA.

### 2. ABSOLUTE SAFETY RULES

AGENTS.md canonical. Never commit/push/reset/rebase/stash/checkout/clean/discard; never overwrite
user work; never read/edit .env/secrets; never execute DDL/writes against live Supabase/PostgreSQL;
never install/change dependencies or manifests/lockfiles; never production builds unless authorized;
never change Expo/RN/New Architecture; never use any/@ts-ignore/eslint-disable/unsafe casts/fake
APIs/placeholders/dead code; never weaken tests/validation/security/CI; respect
exactOptionalPropertyTypes; never add a second implementation of an existing engine/resolver/sync
engine/KPI engine/terminology system; never claim external verification without evidence; never
hide a failing test or unsupported workflow; never silently change financial/accounting behavior.
Preserve all dirty/untracked files; report all changes without committing.

### 3. ENGINEERING STANDARD

For every finding: affected capability, source of truth, full execution path, reproduce defect or
static invariant violation, root cause, data-integrity/backward-compatibility assessment, smallest
correct architectural layer, regression test, targeted tests, package validation, final diff,
evidence matrix. Classify: BUG_CONFIRMED / ARCHITECTURE_DEFECT / INCOMPLETE_WORKFLOW /
SECURITY_DEFECT / PERFORMANCE_DEFECT / DATA_INTEGRITY_RISK / UX_DEFECT / TEST_GAP /
ENVIRONMENT_BLOCKER / OWNER_DECISION_REQUIRED. No stylistic preferences as defects; no code changes
merely for cleanliness; prioritize correctness/security/financial integrity/user-data safety.

### 4. PHASE A - COMPLETE REPOSITORY DISCOVERY

Machine-readable inventory (existing scripts or safe repo-local audit script) of applications,
packages, services, API routes, DB schemas, migrations, entities, business services, UI routes,
navigation, hooks, stores, permissions, offline/online endpoints, background jobs, event handlers,
sync entities, import/export entities, tests, CI, generators, feature registries, industries,
capabilities, terminology, KPIs. Per UI route: route/nav/permission/render/data query/loading/empty/
error/write actions/backend route/local equivalent/tests. Per API endpoint: registration, auth,
authorization, workspace isolation, input/output validation, service, DB access, transactions,
idempotency, audit, errors, client caller, local equivalent, tests. Per DB table: owner, PK, FKs,
indexes, constraints, RLS, workspace scope, migration history, local schema, sync, archive,
deletion, audit. Zero-UI-caller endpoints are not automatic defects (internal/external/intentional/
orphaned - determine); hidden routes are not secure routes.

### 5. PHASE B - BUSINESS CORE AND ARCHITECTURE INTEGRITY

Verify one canonical core: domain/application boundaries, rule ownership, persistence ports, local/
server adapters, runtime selection, validation/event contracts, permission enforcement, terminology
overlays, KPI definitions, industry capability resolution. Find/fix duplicate calculations/invoice/
accounting/costing, inconsistent validation/rounding/lifecycle/permissions, circular deps,
UI-to-DB coupling, platform-specific rules, hidden cross-package deps, unsafe shared mutable state,
dead abstractions, unused registries, fake capability declarations. Same command => consistent
outcomes online/offline; no identical-SQL requirement; don't move rules into UI/backend merely to
remove duplication; keep domain/application/infrastructure/presentation/runtime separation; add
dependency guards if boundaries unenforced.

### 6. PHASE C - COMPLETE BUSINESS WORKFLOWS

Audit full UI+backend path per implemented capability: setup (registration, sign-in, offline
bootstrap, workspace creation/selection, onboarding, business type, multi-industry, size, currency,
fiscal settings, operational questions, capability composition, dashboard, switching, invites,
device registration); sales/invoicing (draft, line edit, product selection, pricing, discounts,
taxes, customer, partial/full payment, credit sale, finalization, cancellation, returns, credit
notes, refunds, print/export, history, details, audit); POS/till (open, cash balance, sales, payment
methods, partial settlement, close, reconciliation, variance, offline recovery); inventory
(products, services, variants, units, warehouses, shelves, movements, receipts, issues, transfers,
adjustments, cycle counts, batches, serials, expiry, reorder, dead stock, costing, valuation, POs,
receiving, supplier returns); purchasing/payables (suppliers, requests, POs, receiving, partial
receiving, invoices, allocation, balances, returns, reconciliation); accounting/finance (COA,
journals, lines, posting, reversals, trial balance, balance sheet, P&L, cash flow, AR/AP, opening
balances, periods, currency, FX, audit, close); CRM (creation, profile, history, balances, credit
limits, collections, statements, segmentation, contacts); workforce (employees, roles, attendance,
timesheets, shifts, payroll, advances, deductions, leave, balances, audit); manufacturing (BOM,
production orders, consumption, finished goods, WIP, waste, costing, work centers, batch/serial
traceability); all other registered modules/operators/workflows/feature packs/industries. Workflow
complete only if UI->permission->command/hook->validation->backend/local->transaction->persistence->
audit->sync->UI refresh->user-visible state exists. Route alone or UI alone or success mock is not
evidence. No fake implementations.

### 7. PHASE D - INDUSTRY AND BUSINESS-MODEL GENERALIZATION

General offline-first Business OS, not unrelated vertical apps. Inspect real industry/operator/
capability registries, operational DNA, terminology, feature packs, KPIs. Verify keys valid,
unknown industry never silently falls back to Retail, industry names not confused with capabilities,
registered != fully supported, unsupported workflows explicit, product/service businesses share
core, goods optional, capacity/pricing basis/asset custody/execution site/recurrence/approval depth/
regulated requirements explicit, terminology data-driven, KPIs consistent, multiple operators not
parallel engines, multi-industry ownership unambiguous. Classify SUPPORTED / SUPPORTED_WITH_LIMITS /
NOT_OFFERED with complete tested workflow evidence. Regulated domains (pharmacy, FX, gold, lending,
banking-like) need explicit compliance/audit/precision/ops constraints; no compliance claim without
qualified legal verification. Preserve owner decisions: order deposits are liabilities; refund uses
payment.record permission; refunds require reason+audit; AFN zero-decimal; no generic /100; credit
limit override needs permission+reason; finalized financial documents not silently mutated.

### 8. PHASE E - DATABASE, MIGRATIONS AND DATA INTEGRITY

Audit schemas/migrations: missing/incorrect FKs, unique constraints, indexes, nullable semantics,
defaults, orphans, duplicates, unsafe deletion, tenant constraints, transaction boundaries, races,
version consistency, migration ordering/idempotency, rollback/recovery, local-server/archive drift,
sync coverage. Financial: debit=credit, no duplicate payments, traceable movements, finalized
invoices immutable except explicit metadata/sync, auditable refunds, opening balances distinct,
currency precision, no silent rounding/deletion, no LWW for financial data. For necessary migrations:
docs/<name>-migration.sql + VERIFY + real *.pg.test.ts with RLS/tenant/constraints/indexes,
dependencies, deployment order; never execute production; never report unapplied as verified.

### 9. PHASE F - API AND BACKEND COMPLETENESS

Audit route registry and domains: auth, authorization, workspace isolation, Zod input validation,
query validation, response contracts, pagination/sorting/filtering, rate limits, idempotency,
transactions, audit, error normalization, safe retries, observability, offline-compatible command
semantics. Fix endpoints missing services, wrong status codes, inconsistent schemas, uncaught
exceptions, races, N+1, unsafe raw SQL, missing ownership, privilege escalation, duplicate mutation
paths, route/hook drift, incomplete error states, wrong local equivalents. No breaking changes
without versioning; no internal errors/stack traces/secrets exposed; no weakened permissions.

### 10. PHASE G - FRONTEND, DESKTOP AND MOBILE COMPLETENESS

Web: loading/suspense, auth/workspace guards, onboarding redirect, error boundaries, forms,
validation, empty states, permission-aware actions, responsive, RTL/LTR, localization, a11y, query
invalidation, optimistic updates, offline/sync state. Windows: Electron process boundaries, IPC
schemas, preload security, context isolation, DB lifecycle, persistent storage, native errors,
restart, window lifecycle, safe file access, offline, packaging inspection. Mobile: Expo lifecycle,
DB init, bridge, navigation, background/foreground, low memory, permissions, network transitions,
local persistence, offline, legacy RN. Shared UI: use packages/ui, no duplication, business logic
outside presentation, design system, every action real, every mutation loading/success/failure. No
full redesign without demonstrated defect.

### 11. PHASE H - SECURITY AUDIT

Threat-oriented: auth lifecycle, password/token handling, secure storage, device identity, session
invalidation, role/permission, tenant isolation, RLS, IPC authorization, local DB protection,
archive upload/download/parsing, path traversal, attachment validation, upload size/decompression
limits, injection, XSS, CSRF/SSRF where relevant, IDOR, mass assignment, unsafe deserialization,
secret/PII leakage in logs, insecure defaults, background-job auth, webhook verification, rate
limits, dependency vulns with available local tooling. Never test live customer accounts; no new
security deps; no penetration-test claim from static inspection; regression tests for confirmed
vulns. Statuses: SECURITY_VERIFIED / SECURITY_REVIEWED_WITH_LIMITATIONS / SECURITY_BLOCKED /
SECURITY_NOT_TESTED.

### 12. PHASE I - PERFORMANCE AND RESOURCE EFFICIENCY

Measure before optimize: startup, dashboard queries, large tables, list pagination, indexes, query
plans, React renders, state subscriptions, memory growth, bundle imports, duplicate requests,
outbox/pull batch, SQLite transaction duration, archive memory, import throughput, attachments,
low-memory Android, renderer/main IPC. Target real hardware. No polling, no Redis, no all-server
processing, no integrity-weakening optimization, no arbitrary thresholds without basis. Report per
issue baseline/method/result/target/change/post/regression-risk; device measurements blocked if no
real device.

### 13. PHASE J - OBSERVABILITY AND RECOVERY

Audit logging/error reporting/audit/diagnostics; add via existing infra without secrets/PII.
Inspect local DB/migration/sync/conflict/import/export/API/auth/job/background/attachment/startup
errors. Correlation IDs where supported. Recovery: restart, interrupted transaction/sync/import/
export, duplicate request, network loss, timeout, disk full, corruption detection, failed migration.
Never claim recovery without reproducible test.

### 14. PHASE K - AUTOMATED REGRESSION GUARDS

Add/extend guards for shared-core boundaries, duplicate engine detection, route-to-hook, UI-action-
to-command, permission, local endpoint, sync entity, archive entity, migration-VERIFY pairing, RLS,
i18n, Dari terminology, unknown industry, unsupported-capability honesty, financial invariants,
unsafe any/suppression, forbidden dependency changes, env-file access. Use existing generators/
guards; no redundant scripts; guards inspect real source and fail for real invariant violations, not
filename/comment presence.

### 15. PHASE L - TEST-DRIVEN DEFECT ELIMINATION

Loop: discover suites, run safest baseline, capture exact failures, group by root cause, fix defect,
add regression, rerun targeted, rerun affected package, broader regression, continue until all
relevant in-scope tests pass or explicitly blocked. Categories: unit, integration, PG, SQLite, API,
UI, browser E2E, desktop, mobile, offline, sync, import/export, financial, security, performance,
a11y, localization, architecture guards. No mocks for DB/network/native/device claims; no deleting
skips, no raising timeouts to hide failures, no test discovery as execution, no TypeScript as
behavioral correctness.

### 16. BUILD AND ENVIRONMENT POLICY

AGENTS.md. No builds unless requested; no tool install; no live production. When unavailable: record
prerequisite, continue independent verification, invent no substitute evidence, give exact later
command. Separate code-level / local integration / real PostgreSQL / browser / Windows packaged /
Android physical / production evidence.

### 17. PRIORITIZATION

P0 data loss, financial corruption, tenant isolation failure, auth bypass, privilege escalation,
broken migrations, unsafe import, duplicate posting, irreversible sync errors. P1 broken primary
workflows, missing local persistence, broken parity, incomplete invoice/payment/inventory/
accounting, sync data loss, severe perf, major UI/backend disconnects. P2 incomplete industry,
wrong reporting, missing audit, bad errors, poor recovery, a11y/localization. P3 minor UI/refactor.
No P3 while P0/P1 unresolved.

### 18. DEFINITION OF DONE

No known reproducible P0; no known P1 in supported scope; all primary workflows complete UI-to-
persistence; canonical rules online/offline; Windows/mobile durable persistence; sync preserves
financial data; archive validated/recoverable; every synced entity covered; every offline workflow
classified/tested; no unsupported industry falsely supported; no known security defect unresolved;
critical financial invariants have regression tests; migrations/tenant isolation reviewed; type
checks and lint pass for changed packages; all runnable tests pass; every blocked test has explicit
external reason; no tests weakened/removed; no fake implementation; dirty work preserved; final
report distinguishes implementation from live verification. State scope/evidence/limitations.

### 19. FINAL REPORT FORMAT (Persian)

A Executive summary (status, HEAD, initial/final dirty state, total/fixed/unresolved/blocked
findings). B Architecture status. C Business workflow matrix. D Defect register (ID/severity/
category/root cause/paths/fix/regression/evidence/status). E Security report. F Performance report.
G Data integrity report. H Test report (command/passed/failed/skipped/blocked/exit code). I Remaining
work (code defects, owner decisions, external infra, live verification, real device, unsupported
capabilities). J Final file change report (all files, purpose, git diff --stat, git status --short).
No commit/push. Final principle: correct, safe, maintainable, unified, offline-capable system; fix
actual defects not symptoms; preserve business truth/customer data/financial integrity/architecture;
never claim complete functionality without workflow-level evidence.

---

# PART 7 - MISSION: HISABCHE COMPLETE ONBOARDING REFACTOR & HARD ACCESS GATE

## OBJECTIVE

Complete repository-grounded redesign and implementation of onboarding from first account
registration to a valid, initialized, usable workspace. Not visual-only: audit and fix the entire
lifecycle Registration -> Authentication -> Workspace Creation -> Business Profile -> Operating
Model -> Capabilities -> Financial Configuration -> Initial Data Setup -> Activation -> Dashboard
Access.

### CRITICAL EXISTING DEFECT

The application allows users to reach the dashboard without completing onboarding. Treat as a
high-priority architectural and access-control defect. Do not assume the cause: trace and verify
actual behavior, including the previously observed empty-workspace response (`/api/workspaces=[]`).
Identify every frontend, backend, middleware, workspace-resolution, authentication and route-guard
path that can allow incomplete users into the dashboard.

### 1. REPOSITORY DISCOVERY

Before editing: read/follow AGENTS.md; inspect actual HEAD and dirty tree; trace registration, login,
workspace creation/selection, onboarding state, dashboard routing, API authorization, offline init;
identify existing schemas/tables/migrations/validators/hooks/stores/UI/tests; reuse architecture, no
parallel onboarding engine; never assume a historical implementation still exists.

### 2. ONBOARDING INFORMATION ARCHITECTURE

Adaptive journey stages: (1) account and identity; (2) business identity and location; (3) business
operating model and industry; (4) operational DNA and capabilities; (5) financial configuration;
(6) conditional inventory/service/production/operational settings; (7) optional team invitation and
role configuration; (8) initial data strategy and workspace activation. For every field document
stable identifier, data type, required/optional/conditional status, validation, justified default,
dependency/visibility, persistence location, effect on capabilities/permissions/accounting/
reporting, editability after onboarding, and fa/af/en localization. Do not collect unnecessary info.

### 3. TEN BUSINESS SCENARIOS

Verify against: clothing retail, grocery store, service business, language school (CEFR levels +
lesson/package credits), manufacturing, wholesale/distribution, pharmacy, currency exchange, gold,
project-based company. Scenarios are acceptance fixtures, not ten implementations; all use the same
business core and capability resolution. Unknown/unsupported industries must never silently fall
back to Retail or physical-goods assumptions.

### 4. FIELD AND STEP GOVERNANCE

Separate mandatory identity/workspace fields, conditional operating-model fields, optional initial
setup, advanced settings outside onboarding. Move cosmetic preferences, advanced KPI customization,
complete COA design, full product entry and advanced workflows out of mandatory onboarding. Support
save/resume, idempotent submissions, safe retries, partial progress, explicit validation errors,
accessible keyboard/mobile interactions, fa/af/en localization, correct Dari terminology.

### 5. HARD ONBOARDING ACCESS GATE

Implement authoritative onboarding-state resolver using existing workspace/auth architecture. States:
NOT_STARTED / IN_PROGRESS / READY_FOR_ACTIVATION / COMPLETED. Server-authoritative activation
predicate: a workspace must not become COMPLETED merely because the frontend reached the final
screen; only after backend validation confirms every mandatory prerequisite. Enforce the gate at
dashboard server entry points, protected app routes, workspace resolution, relevant backend APIs,
direct navigation/refresh, multi-workspace selection, desktop/mobile entry, offline entry. Incomplete
workspace resumes at its actual next required step; absent workspace leads to safe initialization,
not empty dashboard; API error or unknown state fails closed for protected operations (never treat
network failure as successful onboarding); do not block legitimate auth, onboarding recovery or
account-management endpoints; do not rely solely on frontend redirects/hidden nav.

### 6. OFFLINE AND HYBRID COMPATIBILITY

Preserve offline-first: no second business core; persist onboarding progress safely; idempotent
workspace init; preserve local data during reconnection; never overwrite newer local data with stale
server responses; define behavior for incomplete onboarding while disconnected; never falsely mark
an offline workspace cloud-activated; preserve future offline-to-cloud migration path.

### 7. DATA MODEL AND MIGRATIONS

Inspect existing schema first. If changes required: versioned migration SQL + verification SQL + PG
tests; constraints/indexes/FK/tenant isolation/RLS; preserve existing workspaces/users; never run
live DDL; no duplicate sources of truth for onboarding state.

### 8. REQUIRED TEST MATRIX

Regression tests: new registration, no workspace, empty workspace list, incomplete workspace, every
incomplete state, direct dashboard URL, direct protected API, refresh/browser restart, logout/login,
multiple workspaces different states, concurrent/repeated activation, API timeout/unknown state,
offline progress+reconnection, desktop/mobile entry, all ten scenarios, fa/af/en localization. Verify
real access decisions, not just redirect appearance. Never weaken/skip/delete/rewrite tests for green.

### 9. UX ACCEPTANCE CRITERIA

Explain why each required field is requested; meaningful progress; only relevant questions; safe
backward navigation; auto/explicit save; clear required vs optional; not overwhelming; useful
completion summary; clear first action after activation.

### 10. DEFINITION OF DONE

New user cannot access dashboard before successful activation; direct URL/API bypasses prevented;
workspace creation/activation idempotent; existing users/workspaces not broken; all ten scenarios pass;
online/offline/desktop/mobile consistent; required migrations and verification artifacts exist;
relevant regression tests pass; remaining blockers documented. Report in Persian with exact statuses
VERIFIED_COMPLETE / IMPLEMENTED_NOT_LIVE_VERIFIED / BLOCKED / NOT_IMPLEMENTED / PENDING HUMAN
CONFIRMATION. Separate verified evidence from assumptions. No commit/push/reset/rebase/stash/
checkout/clean; no .env access; no live DDL; no dependency changes; no production builds. Finish
autonomously and provide a precise file-by-file report.

---

# PART 8 - SLICE 0 AUDIT & EVIDENCE-BACKED GAP MATRIX (19 Nov 2026)

This part is the repository-grounded audit required before editing (PART 5 §15 Slice 0,
PART 6 §4, PART 7 §1). It records what was actually inspected at the current working
tree and separates verified facts from assumptions. No live database was touched.

## 8.1 Baseline verification

| Check                    | Measured result                                                                                                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git rev-parse HEAD`     | `b54636fae57806c6d75c710c7621a49c8a3132d0` — matches the mission baseline.                                                                                                                                       |
| Branch                   | `main`                                                                                                                                                                                                           |
| Dirty tree on entry      | 168 changed paths, all preserved; no dependency/lockfile/`.env` changes by this mission.                                                                                                                         |
| `pnpm code-intel status` | **PARTIALLY_STALE** — index HEAD `aa1d0896`, working HEAD `b54636fa`; 2196 files / 21161 symbols / 83700 relationships. Recorded; empty index results were NOT treated as proof of absence — grep fallback used. |

## 8.2 Verified architecture facts (files actually read)

| Symbol / file                                               | Verified fact                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/app-shell/src/features/sync/device-sync-state.ts` | `PULLED_TABLES` now includes `order_deposits`, `order_deposit_applications`, `order_deposit_refunds`, `product_variants`, `service_delivery_sessions`, `package_credit_ledger`, `repair_tickets`. The previously reported `order_deposits` gap is **CLOSED** at current HEAD. |
| same file                                                   | `DEVICE_WRITTEN_TABLES` includes `inventory_movement`, `payment`, `payment_allocation`, `journal_entry`, `journal_line`, `cost_consumption`.                                                                                                                                  |
| same file                                                   | `NOT_PULLED_YET` still lists `inventory_settings`, `cost_layer`, `account`, `stock_serials`, `stock_batches`. These are server-owned rows a local route reads but no pull delivers.                                                                                           |
| `packages/local-engine/src/routes/backup.ts`                | `/workspaces/backup` enumerates `[...localTableSchema.options, 'sync_queue']`, sets `restorable: false`, and records `failedTables`/`truncatedTables`. It is a diagnostic dump, NOT a restorable portable archive.                                                            |
| `backend/src/routes/auth.routes.ts`                         | `sanitizeUser` derives `onboardingCompleted: Boolean(profile?.onboarding_completed_at)` and all four response schemas declare it (a previously fixed serialization defect).                                                                                                   |
| `backend/src/routes/auth.routes.ts` (PATCH /auth/profile)   | **DEFECT CONFIRMED:** `onboarding_completed_at` was written solely from the client claim `body.onboardingCompleted === true`, with no server-side prerequisite check.                                                                                                         |
| `packages/ui/.../onboarding-container.tsx:254`              | The client does send `onboardingCompleted: true` (after workspace creation and `saveBookCurrency`). Confirms the route above is the real completion path.                                                                                                                     |
| `docs/onboarding-server-state-migration.sql`                | Adds `onboarding_completed_at`, `business_types`, `store_size`, `business_note` to `profiles` with a backfill for users who already have invoices. **PENDING HUMAN CONFIRMATION** — not run here.                                                                             |
| `packages/validation/src/schemas/operational-dna.ts`        | Existing workspace-level state vocabulary: `ONBOARDING_STATES` = NOT_STARTED, IN_PROGRESS, REQUIRES_CONFIGURATION, READY_TO_ACTIVATE, ACTIVE, PAUSED; `onboardingProgressSchema` is a closed shape.                                                                           |
| `backend/src/services/workspace-profile.ts`                 | `operationalProfileOf` reads `workspaces.operational_dna, operational_dna_version, onboarding_progress`; `setOnboardingProgress` writes only the closed schema.                                                                                                               |
| `backend/src/services/base-currency.ts`                     | Books currency is `workspaces.base_currency`; `baseCurrencyOf` treats a missing column as the AFN default and a missing value as the default — an «unknown is not zero» concern for migration work.                                                                           |
| `apps/web/app/[lang]/(dashboard)/dashboard-layout.tsx`      | The dashboard guard is **client-side**: `router.replace('/onboarding')`. There is no server-authoritative dashboard entry gate at current HEAD.                                                                                                                               |

## 8.3 Gap matrix

| ID     | Requirement                                                                                   | Initial status                 | Final status                  | Evidence / files                                                                                                                                                                                            | Blocker                                                                                                                                               |
| ------ | --------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUD-01 | Onboarding completion must be a server decision, not a client flag                            | DEFECT CONFIRMED               | IMPLEMENTED_NOT_LIVE_VERIFIED | new `onboarding-gate.domain.ts` predicate; new `activation-gate.service.ts`; `auth.routes.ts` PATCH gate returns 422 with `missing`; tests `onboarding-gate.test.ts` + `onboarding-activation-gate.test.ts` | no live PG witness                                                                                                                                    |
| AUD-02 | Hard gate at dashboard server entry / protected APIs / offline entry                          | DEFECT CONFIRMED (client-only) | NOT_IMPLEMENTED               | `dashboard-layout.tsx` still client-only; `app-shell/require-auth` also client-only                                                                                                                         | needs server-side route guard rollout across protected entry points; risk of breaking legitimate auth/onboarding recovery requires staged integration |
| AUD-03 | `order_deposits` in sync delta coverage                                                       | reported gap                   | CLOSED                        | `PULLED_TABLES` includes the three order-deposit tables                                                                                                                                                     | none                                                                                                                                                  |
| AUD-04 | `cost_layer`, `account`, `stock_serials`, `stock_batches`, `inventory_settings` pull coverage | gap                            | OPEN                          | `NOT_PULLED_YET`                                                                                                                                                                                            | needs server change-log triggers (DDL) + `*.pg.test.ts`; outside file-only scope                                                                      |
| AUD-05 | Portable, restorable archive with manifest/checksums                                          | gap                            | OPEN                          | `backup.ts` `restorable: false`; `exporter.ts` fixed table set                                                                                                                                              | design + migration + tests; no live archive round-trip possible here                                                                                  |
| AUD-06 | Offline capability inventory per workflow                                                     | partially documented           | VERIFIED_WITH_LIMITATIONS     | `docs/offline/01-CAPABILITY-MATRIX.md` exists; route registration ≠ workflow evidence                                                                                                                       | browser/device acceptance unavailable                                                                                                                 |
| AUD-07 | Live PostgreSQL / restart / multi-device evidence                                             | BLOCKED                        | BLOCKED                       | 168 backend `*.pg.test.ts` files cannot start embedded Postgres                                                                                                                                             | `SeCreateGlobalPrivilege` — owner: `secpol.msc` → Create global objects → sign out/in                                                                 |

## 8.4 Decisions taken from evidence

1. **A single completion timestamp, now server-gated.** No second onboarding state store was
   introduced. The existing `ONBOARDING_STATES` vocabulary is reused by the predicate, and the
   existing `profiles.onboarding_completed_at` stays the one source of truth.
2. **Fail closed on unknown.** A failed profile / membership / workspace read throws; the
   completion timestamp is never written on an exception, and a missing workspace is a 422.
3. **Backward compatibility.** The books currency is read from `workspaces.base_currency`, with a
   fallback to `onboarding_progress.answers.defaultCurrency` and a graceful missing-column path,
   so an installation that has not yet run every migration is not silently marked complete nor
   broken with a 500.
4. **No server DDL.** No migration was run or written for this slice: the profile columns already
   exist in `docs/onboarding-server-state-migration.sql` and remain pending human confirmation.

## 8.5 Scope boundary

PART 5/6/7 as written are multi-stage programmes (standalone offline completion, hybrid sync,
portable archive, migration center, device registration, full workflow audit, hard gate across
all hosts). This slice implements the bounded, reproducible P0 defect (AUD-01) plus the audit.
AUD-02/04/05 require server DDL, native-device or browser evidence and staged rollout; they are
documented honestly rather than claimed complete.

---

# PART 9 - IMPLEMENTATION LOG: SERVER-AUTHORITATIVE ONBOARDING ACTIVATION (19 Nov 2026)

**Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED` — HEAD unchanged `b54636fa`; no commit, no build,
no live Supabase DDL/write.

## What landed (AUD-01, the confirmed P0 access-control defect)

| File                                                                                                                                                            | Change                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/validation/src/schemas/onboarding-gate.domain.ts`                                                                                                     | NEW pure predicate `evaluateOnboardingActivation(facts, unreadable)`; mandatory prerequisites IDENTITY / WORKSPACE / WORKSPACE_PROFILE / DEFAULT_CURRENCY; reuses the existing `ONBOARDING_STATES` vocabulary (no second state machine); unknown values never satisfy a prerequisite.                          |
| `packages/validation/src/index.ts`                                                                                                                              | barrel export of the new domain.                                                                                                                                                                                                                                                                               |
| `packages/validation/src/__tests__/onboarding-gate.test.ts`                                                                                                     | NEW 6 tests: full activation, no identity/workspace, each missing prerequisite, AFN zero-decimal currency, unreadable facts, state-vocabulary reuse.                                                                                                                                                           |
| `backend/src/services/onboarding/activation-gate.service.ts`                                                                                                    | NEW service that reads ONLY server-owned facts (`profiles`, `workspace_members`, `workspaces.name`, `workspaces.base_currency`, `workspaces.onboarding_progress`); same-request overrides; graceful missing-column fallback; every read failure throws (fail closed).                                          |
| `backend/src/routes/auth.routes.ts`                                                                                                                             | `PATCH /api/auth/profile` now runs the gate before writing `onboarding_completed_at`; unmet prerequisites → `422 ONBOARDING_PREREQUISITES_MISSING` with `missing` / `state` / `unreadable`; no timestamp written on failure. Existing API contract unchanged (client still sends `onboardingCompleted: true`). |
| `backend/src/__tests__/onboarding-activation-gate.test.ts`                                                                                                      | NEW 7 tests with a thenable Supabase mock: complete account, no workspace, missing workspace profile/currency, same-request override, missing-column fallback, read failure throws; unknown currency after a missing-column fallback fails closed.                                                             |
| generated: `docs/architecture/capability-matrix.csv`, `docs/architecture/universal-core/ENGINE-WIRING.csv`, `docs/architecture/universal-core/UNUSED-HOOKS.csv` | regenerated because `auth.routes.ts` line numbers moved.                                                                                                                                                                                                                                                       |
| `docs/prompts/THE-LAST.md`                                                                                                                                      | PART 4-7 (three missions + decisions), PART 8 (audit + gap matrix), PART 9 (this log).                                                                                                                                                                                                                         |

## Measured verification (exact commands and real totals)

| Command                                                                                                                                                                                              | Result                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npx vitest run src/__tests__/onboarding-gate.test.ts` (validation)                                                                                                                                  | 1 file / **6 passed**                                                                            |
| `npx vitest run src/__tests__/onboarding-activation-gate.test.ts` (backend)                                                                                                                          | 1 file / **7 passed**                                                                            |
| `npx vitest run src/__tests__/auth-response-schema.test.ts src/__tests__/profile-write.test.ts src/__tests__/operational-profile.test.ts src/__tests__/onboarding-activation-gate.test.ts` (backend) | 4 files / **45 passed**                                                                          |
| `npx vitest run` (validation, full)                                                                                                                                                                  | 102 files / **1239 passed** (was 1233 before the 6 new tests)                                    |
| `npx tsc --noEmit`                                                                                                                                                                                   | validation **0**, backend **0**, app-bridge **0**, local-engine **0**, api **0**, apps/web **0** |
| `npx eslint <each changed source>`                                                                                                                                                                   | **0 errors, 0 warnings**                                                                         |
| generators `--check` (wiring-matrix, capability-matrix-csv, unused-hooks, campaign-status)                                                                                                           | all **exit 0**                                                                                   |
| `git diff --check`                                                                                                                                                                                   | **exit 0**                                                                                       |

## What was NOT done (honest scope boundary)

- **No server-side dashboard/API gate rollout** (AUD-02): the web and app-shell entry guards
  remain client-side. A staged, capability-aware server gate across every protected entry would
  risk breaking legitimate authentication, onboarding recovery and account-management endpoints
  without a browser/device witness; it is recorded as `NOT_IMPLEMENTED`, not claimed.
- **No server DDL**: `docs/onboarding-server-state-migration.sql` and the base-currency migration
  remain `PENDING HUMAN CONFIRMATION` — unchanged by this mission.
- **No live PostgreSQL / browser / Windows / Android verification**: environment blocked
  (`SeCreateGlobalPrivilege`); the 168 PG test files remain un-runnable here.
- **PART 5/6 remaining slices** (hybrid sync entity coverage for `cost_layer` / `account` /
  `stock_serials` / `stock_batches` / `inventory_settings`, portable restorable archive,
  migration center, device registration, full workflow audit) require server change-log DDL,
  native-device or browser evidence, or a staged rollout. They remain documented in PART 8
  rather than falsely promoted.

**Overall: `IMPLEMENTED_NOT_LIVE_VERIFIED` for the delivered slice; the three missions as a whole
remain `PARTIALLY_IMPLEMENTED`.**

---

# PART 10 - IMPLEMENTATION LOG: ACCESS GATE, ARCHIVE COVERAGE & ONBOARDING IA (19 Nov 2026)

**Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED`. HEAD unchanged `b54636fa`; no commit/build/live DDL.

## Work landed after PART 9 (in the owner's requested order)

| #                          | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Result |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AUD-02 (partial)           | `backend/src/middleware/onboarding.middleware.ts` (NEW): reusable, fail-closed `requireOnboardingComplete` — `428 ONBOARDING_REQUIRED` for an incomplete account, `503 ONBOARDING_STATE_UNAVAILABLE` on a DB read failure, `401` without identity. Missing migration column is treated as «not complete», never «done». Wired into `GET /api/analytics/dashboard` **before** `cacheMiddleware` so an incomplete user cannot be served a cached KPI. Tests: `onboarding-access-gate.test.ts` (5/5).                                                                                                                           |
| PART 5 / Slice 3 (partial) | `packages/local-engine/src/export/exporter.ts`: archive now covers **all** `localTableSchema` tables + `sync_queue` + the newer feature tables; `PRAGMA table_info`-driven reads so a table without `workspace_id` is exported instead of silently dropped; explicit `coverage` report (`missingRequired` / `missingOptional`); `verifyExportPackage` now refuses an archive with a missing REQUIRED table (`MISSING_REQUIRED_TABLES`). `types.ts` extended with optional `coverage` (backward compatible). Tests: `export.test.ts` (existing), `order-deposit-backup-restore.test.ts`, new `export-coverage.test.ts` (3/3). |
| PART 7 §2/§3               | `docs/onboarding/ONBOARDING-ARCHITECTURE.md` (NEW): full field governance table (id/type/status/validation/default/visibility/persistence/effect/editability/fa-af-en key), 8-stage adaptive journey, server-authoritative gate contract, and the **10 business scenarios** as acceptance fixtures — explicitly fixtures, not ten implementations; unknown trades stay `NOT_OFFERED`.                                                                                                                                                                                                                                        |
| Slice 2 guard              | Already existed and is strong (`device-operation-reads.test.ts`): `PULLED_TABLES` is derived from the real engine, every read is classified exactly once, the admitted gap is a closed list. **Not duplicated** — recorded as satisfied.                                                                                                                                                                                                                                                                                                                                                                                     |

## Measured verification (this round)

| Command                                                                           | Result                                                  |
| --------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `npx vitest run` validation (full)                                                | 102 files / **1239 passed**                             |
| `npx vitest run` local-engine (full)                                              | 103 files / **655 passed** (was 652; +3 coverage tests) |
| backend targeted (10 files: onboarding gates, auth, dashboard, capability guards) | **96 passed**                                           |
| `npx tsc --noEmit` validation / local-engine / backend                            | **0 / 0 / 0**                                           |
| `npx eslint` every changed source file                                            | **0 errors, 0 warnings**                                |
| 7 generators `--check`                                                            | all **exit 0**                                          |
| `git diff --check`                                                                | **exit 0**                                              |

## Honest remaining gaps (not claimed)

- **AUD-02 is still partial**: the gate is enforced at all five dashboard server entries (main KPI + low-stock-variants, today-sessions, package-credits-low, open-repair-tickets). A blanket gate
  across every protected route needs a staged rollout with an allow-list for auth/onboarding/
  account recovery; without a browser witness that risks breaking legitimate users, so it is not
  silently applied.
- **Archive**: coverage + checksums + verification exist; there is still **no safe restore path**
  and no import into a cloud workspace (PART 5 Slices 4-5).
- **The ten scenarios are documentation fixtures only** — no E2E/device test executes them.
- **Save/resume, idempotent submission, UX acceptance** for onboarding: not implemented.
- **Live PG / browser / Windows / Android / 5 owner acceptance tests**: BLOCKED (no environment).
- **Server DDL** (sync change-log triggers for `cost_layer` / `account` / `stock_serials` /
  `stock_batches` / `inventory_settings`, onboarding migration): `PENDING HUMAN CONFIRMATION`.

**Overall for the three missions: `PARTIALLY_IMPLEMENTED`.**

---

# PART 11 - IMPLEMENTATION LOG: SYNC ENTITY COVERAGE MIGRATION (19 Nov 2026)

**Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED`. All migration artifacts are FILES ONLY — nothing was
executed against a live database. HEAD unchanged `b54636fa`.

## What landed

| File                                                          | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/sync-entity-coverage-migration.sql` (NEW)               | Covers four of the five `NOT_PULLED_YET` entities: `cost_layers` → `cost_layer`, `stock_batches`, `stock_serials`, `inventory_settings`. Fail-closed preflight (requires `sync_change_log`, `sync_record_change()`, `sync_bump_version()` and the real columns); idempotent; version columns; change-log triggers inside the business transaction. A dedicated workspace-keyed trigger handles `inventory_settings`, whose primary key is `workspace_id` (no `id` column) — the generic trigger would raise on every write. |
| `docs/VERIFY-sync-entity-coverage.sql` (NEW)                  | Read-only checks for version columns, change-log and version triggers, entity names, and the explicit `account_blocked` state.                                                                                                                                                                                                                                                                                                                                                                                              |
| `docs/FINDING-sync-account-tenancy.sql` (NEW)                 | Evidence that `public.accounts` has `user_id` but **no `workspace_id`**; adding a change-log trigger would misroute or fail. Marked `OWNER_DECISION_REQUIRED` — no tenant was invented.                                                                                                                                                                                                                                                                                                                                     |
| `backend/src/__tests__/sync-entity-coverage.pg.test.ts` (NEW) | Real-Postgres test: applies the migration twice, runs VERIFY, asserts routed rows and version bumps for the four entities, and asserts `account` stays blocked. Guards `if (!sql) return` and an `if (started)` stop so the environment-blocked path finishes in <1s instead of timing out.                                                                                                                                                                                                                                 |
| `docs/MIGRATIONS-PENDING.md`                                  | regenerated — the migration is registered as row 255, **PENDING HUMAN CONFIRMATION**.                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Verified facts discovered during this phase

- `accounts` (base-schema-migration.sql:62) has `user_id`, NOT `workspace_id` → cannot be synced
  without a tenancy backfill decision. It was NOT silently added.
- `inventory_settings` is keyed by `workspace_id` and has no `id`; the generic
  `sync_record_change()` reads `NEW.id` and would break every write.
- `cost_layers`, `stock_batches`, `stock_serials` have both `id` and `workspace_id`.
- Onboarding save/resume already exists in the tree: `useSaveOnboardingProgress`
  (`packages/api/src/hooks/workspace-profile.ts`) is called by `onboarding-container.tsx`
  (lines 175–185, 279) with the closed `onboardingProgressSchema`; the local engine has the
  matching `PUT /workspace/onboarding-progress`. **Not reimplemented** — "one of everything".

## Measured verification

| Command                                                                  | Result                                                                               |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `npx vitest run src/__tests__/sync-entity-coverage.pg.test.ts` (backend) | 1 file / **5 passed** in environment-blocked mode (no PG witness; 0.85s, no timeout) |
| `npx tsc --noEmit` backend                                               | **0 errors**                                                                         |
| `npx eslint` the new PG test                                             | **0 errors, 0 warnings**                                                             |
| `node scripts/migrations/pending-ledger.mjs`                             | **exit 0**; new migration registered                                                 |

## Owner actions required

1. Apply `docs/sync-engine-migration.sql` first, then `docs/sync-entity-coverage-migration.sql`.
2. Run `docs/VERIFY-sync-entity-coverage.sql` and confirm all checks are true.
3. Run `cd backend && npx vitest run --project pg src/__tests__/sync-entity-coverage.pg.test.ts`
   after `SeCreateGlobalPrivilege` is resolved.
4. Decide the `accounts` tenancy backfill (FINDING) before any account delta can be enabled.
5. Only after the server triggers exist: add the four entities to `DELTA_ENTITIES`/`PULLED_TABLES`
   and shrink `NOT_PULLED_YET` — doing it earlier would make devices wait for changes no server emits.

`PENDING HUMAN CONFIRMATION` — no live DDL was run and no migration is claimed applied.

---

## PART 12 — FINAL CODE-COMPLETE CLOSURE (after owner applied migrations)

The owner reported that all migrations were applied and supplied `information_schema` evidence
that `accounts` has `id`, `user_id` and a NOT NULL `workspace_id`, and that `cost_layers`,
`stock_batches`, `stock_serials` and `inventory_settings` all carry `workspace_id`. This
resolves the earlier `OWNER_DECISION_REQUIRED` on `accounts`: the tenancy column was already
added by `docs/accounting-core-migration.sql`; the old finding read only
`base-schema-migration.sql`. No historical tenant was invented.

### Implementation performed

- `packages/validation/src/schemas/sync-protocol.schema.ts` — added the last five protocol
  entities: `cost_layer`, `stock_batches`, `stock_serials`, `inventory_settings`, `account`.
- `backend/src/services/sync.service.ts` — added all five to `ENTITY_TABLE`,
  `ENTITIES_WITH_VERSION`, `WRITABLE` (read-only), `PULL_COLUMNS` (lean, versioned),
  `SYNC_WRITE_CAPABILITY` and `DOMAIN_ONLY_ENTITIES` (push refused by name).
- `docs/sync-account-tenancy-coverage-migration.sql` + `docs/VERIFY-sync-account-tenancy-coverage.sql`
  (NEW) — version + bump + change-log trigger for `accounts`; stable `id` for
  `inventory_settings` so the keyset snapshot and the device upsert can address it.
- `docs/FINDING-sync-account-tenancy.sql` — rewritten as RESOLVED with the evidence that
  supersedes it.
- `packages/app-bridge/src/local-schema.ts` / `local-universal-core-schema.ts` — local `version`
  columns for all five tables, `id` for local `inventory_settings`, `kind` for local `account`,
  `variant_id` added to cost-layer writable columns; `SCHEMA_VERSION` 35 → 36.
- `packages/app-bridge/src/local-migrations.ts` — v36 migration (idempotent; duplicate column
  errors are already recognised by the host).
- `packages/app-shell/src/features/sync/sync-engine.ts` / `device-sync-state.ts` — five
  `FROM_LOG` mappers, five entries in `BACKGROUND_ENTITIES`/`PULLED_TABLES`, and
  `NOT_PULLED_YET` is now empty. Existing devices rehydrate on next sync because their stamps
  for the new tables are absent.
- Tests: `sync-entity-coverage-2.test.ts` (NEW, 14), extended
  `sync-entity-coverage.pg.test.ts`, NEW `sync-account-tenancy-coverage.pg.test.ts`, and the
  updated `device-operation-reads.test.ts` guard (11 passed).

### Evidence

- tsc: validation, app-bridge, app-shell, backend, api, apps/web — 0 errors.
- `backend` sync suites: 138 passed / 7 files (including both PG suites in env-blocked mode).
- `backend` new coverage guard: 14 passed.
- `packages/app-bridge`: 56 passed / 7 files.
- `apps/desktop` jest `device-operation-reads`: 11 passed.
- `docs/OWNER-ACTION-ITEMS.md` updated: one new migration to run; the tenancy decision and
  widening items are removed because they are no longer owner actions.

Status: `IMPLEMENTED_NOT_LIVE_VERIFIED`. The new migration is
`PENDING HUMAN CONFIRMATION` — apply and run its VERIFY file before deploying the backend.

---

## PART 13 — CLOSURE AT HEAD `f2df3731` (audit-driven round)

The owner audited commit `f2df3731` and named three immediate code-side gaps. All three are closed
here; only live evidence remains.

### 1. Temporary PostgreSQL data removed from the tree

`backend/src/__tests__/.pg-sync-scope-55723/` contained 968 embedded-Postgres files (39.19 MB:
`PG_VERSION`, `base/1/…`). All are deleted in the working tree (a clean deletion the owner commits —
no history rewrite, no `git reset`). `.gitignore` now ignores `backend/src/__tests__/.pg-*/` so a
future suite cannot re-commit its scratch cluster.

### 2. Restore is now an operational path, not just a function

- `POST /workspaces/restore` added to `packages/local-engine/src/routes/backup.ts`: checksummed
  portable archive in, one transaction out; workspace id from the caller's context, never the body;
  audit stamps ignored when deciding whether a pre-seeded default row is "the same" (two installs
  can never share `datetime('now')`, which otherwise refused every real restore to a fresh install).
- `packages/api/src/hooks/backup.ts` — `useRestoreWorkspaceBackup`; exported from `packages/api`.
- `packages/ui/src/components/ui/sync-center/backup-restore-panel.tsx` — file picker in the Sync
  Centre; reads the file only in the change handler; shows the real error code on refusal.
- `packages/validation` — new `data.restore` feature (a restore WRITES, so it cannot share the
  always-allowed read feature `data.backup`); endpoint matrix, capability CSV, industry coverage
  table and sellable evidence regenerated from code.
- i18n keys added in fa / af / en. Tests: `restore.test.ts` + `restore-route.test.ts` = 11 passed.
- `V72-OPERATIONS-RUNBOOKS.md` updated from `NOT_IMPLEMENTED (restore)` to
  `IMPLEMENTED_NOT_LIVE_VERIFIED (restore)`.

### 3. Sync coverage and ledger guards

All five earlier protocol entities are now in the server maps, device mappers, local schema v36 and
`PULLED_TABLES`; `NOT_PULLED_YET` is empty. The migration `docs/sync-account-tenancy-coverage-migration.sql`
closes accounts and inventory_settings; evidence that accounts has a NOT NULL workspace_id is recorded
in `docs/FINDING-sync-account-tenancy.sql` (RESOLVED). Ledger regenerated: 292 migrations · 173 with
VERIFY · 184 with a PG test.

### Verification at this HEAD

- tsc: validation, local-engine, app-bridge, app-shell, api, ui, backend, apps/web — 0 errors.
- vitest: validation **1251 passed / 103 files**; local-engine **663 passed / 3 pre-existing flaky
  restart tests** (all 3 pass when run together outside the full parallel suite — files untouched);
  app-bridge 56 passed; backend 9 targeted suites **98 passed**; app-shell guard 11 passed;
  sync coverage guard 14 passed.
- eslint: 0 across all edited source files. All 7 generators `--check`: exit 0. `git diff --check`: 0.
- HEAD unchanged `f2df3731`; no commit, push, build, dependency change, `.env` access or live DDL.

---

## PART 14 — ZERO CODE GAP ROUND

Exact inventory generated at `docs/audits/ZERO-CODE-GAP-INVENTORY.md`: **1,020 stable-ID items**
(8 closed code gaps, 689 offline endpoints, 21 sync entities, 67 industries, 227 migration
verification gaps, 8 external/owner items). Counts derived from the current files, not from an older
report.

### Code gaps found by the full local suites and closed

| ID      | Root cause                                             | Fix                                                            | Evidence                                |
| ------- | ------------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------- |
| FIX-001 | restore hook called a path with no server address      | explicit `POST /api/workspaces/restore` → `RESTORE_LOCAL_ONLY` | `client-route-contract` passed          |
| FIX-002 | activation gate resolved membership itself             | uses canonical `listAuthorizedWorkspaces`                      | `constitution-guards` passed            |
| FIX-003 | five new sync entities had no offline position         | `OFFLINE_POSITION` entries with reasons                        | `offline-contract` passed               |
| FIX-004 | onboarding gate returned 428 before cross-tenant check | fixture owners onboarded; gate unchanged                       | `tenant-isolation-http` passed          |
| FIX-005 | new restore route had no capability                    | `requireCapability('data.import')`                             | `write-routes-have-a-capability` passed |
| FIX-006 | two generated industry docs stale                      | builder regenerated                                            | `industry-specs-complete` passed        |
| FIX-007 | sync-pull mock lacked the 5 new entities               | fixture extended                                               | desktop jest 44 suites passed           |
| FIX-008 | activation-gate mock lacked `.order()`                 | fake query extended                                            | activation-gate tests passed            |

### Final verification

- backend `--project unit`: **5,881 passed / 470 files**
- validation: **1,251 passed**; local-engine: **666 passed**; app-bridge: **56 passed**;
  packages/ui: **2,873 passed**; desktop jest: **350 passed / 44 suites**
- tsc: 8 packages, 0 errors; eslint edited files: 0; 8 generators `--check`: 0;
  `git diff --check`: 0. HEAD unchanged.

Verdict: `CODE_GAPS_REMAIN` — 227 migration verification artifacts (119 missing VERIFY SQL,
108 missing PG tests) are code-addressable but require per-migration, domain-correct content; mass
boilerplate would be a placeholder, which repository rules forbid. All test-detected defects are
closed.
