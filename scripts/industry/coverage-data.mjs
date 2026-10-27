// scripts/industry/coverage-data.mjs
//
// THE DATA behind docs/architecture/universal-core/INDUSTRY-COVERAGE-TABLE.{md,csv}.
// `generate-coverage-table.mjs` turns it into both files, so the two can never
// disagree.
//
// ⚠️ RULES THIS FILE FOLLOWS
//   · A capability is `VERIFIED_SUPPORTED` only with an implementation anchor AND a
//     test file. A registry key, menu item or type name is not evidence.
//   · Evidence is `{ file, needle }`. The generator resolves the CURRENT line by
//     finding the needle, and fails if the file or the needle is gone — so a
//     line number in the document cannot go stale.
//   · Every source below was opened with WebFetch on ACCESSED. A search-result
//     snippet alone was never cited. Sources that are vendor marketing say so.
//   · No source for a claim → `NO_SOURCE`, and confidence cannot exceed LOW.

export const ACCESSED = '2026-10-26'

/** kind: official (the product's own docs) · forum (user thread) · vendor (marketing) */
export const SOURCES = {
  S1: {
    kind: 'official',
    title: 'Item Variants',
    publisher: 'Frappe / ERPNext documentation',
    url: 'https://docs.frappe.io/erpnext/user/manual/en/item-variants',
    says: 'A template item generates variants from attribute combinations (size, colour); the template itself cannot be used in transactions.',
  },
  S2: {
    kind: 'official',
    title: 'Lots and serial numbers',
    publisher: 'Odoo 18 documentation',
    url: 'https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/inventory/product_management/product_tracking/lots.html',
    says: 'A lot identifies a batch received or produced together so it can be traced back, which matters for recalls and expiry.',
  },
  S3: {
    kind: 'forum',
    title: 'Dual UOM, Batch/Lot level uom conversion factor',
    publisher: 'Frappe community forum (thread started 2021-01-19)',
    url: 'https://discuss.frappe.io/t/dual-uom-batch-lot-level-uom-conversion-factor/70249',
    says: 'Users in textile and yarn businesses want two units per item (kg and metres) with a per-batch conversion factor that differs from the standard one.',
  },
  S4: {
    kind: 'forum',
    title: 'Handling Items with variable lenghts',
    publisher: 'Frappe community forum (thread started 2017-05-18)',
    url: 'https://discuss.frappe.io/t/handling-items-with-variable-lenghts/23932',
    says: 'Fabric is bought in metres and arrives in rolls of different length; whole or partial rolls are sold. A fixed UOM conversion does not fit, and one-variant-per-roll hides the metres on hand.',
  },
  S5: {
    kind: 'vendor',
    title: 'ERPNext jewellery management',
    publisher: 'ECOSIRE (vendor marketing page)',
    url: 'https://ecosire.com/ar/apps/erpnext/erpnext-jewellery-management',
    says: 'Jewellery line value = net weight × karat rate + making charges + wastage (+ stone value, tax); old gold is a metal-credit line valued by weight, tested purity and rate.',
  },
  S6: {
    kind: 'vendor',
    title: 'Key Features of Automotive Inventory Management Software',
    publisher: 'AutoXLoo (vendor)',
    url: 'https://www.autoxloo.com/news/key-features-of-automotive-inventory-management-software.html',
    says: 'Vehicle stock is keyed by VIN (decoded to specs), carries reconditioning costs, is aged, and is reported as gross profit per vehicle and turn rate.',
  },
  S7: {
    kind: 'vendor',
    title: 'TruckLogics trucking software',
    publisher: 'SoftwareConnect (vendor listing)',
    url: 'https://softwareconnect.com/products/trucklogics-trucking-software',
    says: 'Trucking software centres on trip sheets, FTL/LTL loads, bills of lading, driver settlements with recurring deductions, and freight invoicing.',
  },
  S8: {
    kind: 'vendor',
    title: 'The Complete Guide to Flooring Store POS & CRM Software (2026)',
    publisher: 'Service Buddy (vendor blog)',
    url: 'https://www.servicebuddy.io/blog/flooring-store-pos-crm-software-guide',
    says: 'Carpet/flooring needs roll goods tracked in linear feet, remnant tracking by exact size, and area-based (square-footage) pricing rather than per-unit pricing.',
  },
  S9: {
    kind: 'vendor',
    title: 'Computer hardware accounting software',
    publisher: 'BUSY (vendor)',
    url: 'https://busy.in/accounting-software/computer-hardware.md',
    says: 'Computer-parts dealers track serial identifiers, warranties, service requests and returns/replacements with a per-item history.',
  },
  S10: {
    kind: 'vendor',
    title: 'ERP for Automotive Parts: Fitment Data, Cross-Reference & Distribution',
    publisher: 'ECOSIRE (vendor blog)',
    url: 'https://ecosire.com/blog/erp-for-automotive-parts-distribution',
    says: 'Each part carries OEM, aftermarket and supersession numbers; fitment follows ACES, product data follows PIES; core charges are refundable deposits on remanufactured parts.',
  },
  S11: {
    kind: 'vendor',
    title: 'What is COD Reconciliation?',
    publisher: 'Shipox (vendor blog)',
    url: 'https://shipox.com/blog/the-benefits-of-cod-reconciliation-in-delivery-management/',
    says: 'Cash on delivery moves through four statuses — to collect, held by driver, with cashier, with bank — and is reconciled per driver.',
  },
  S12: {
    kind: 'vendor',
    title: 'Best management software for a building-materials merchant (Singapore, 2026)',
    publisher: 'Kolonell (vendor blog)',
    url: 'https://kolonell.com/en/blog/best-management-software-building-materials-merchant-singapore-2026',
    says: 'Merchants sell in several units (bag, tonne, bundle, m²), give contractors credit with enforced ceilings, and need delivery orders and proof of delivery.',
  },
  S13: {
    kind: 'vendor',
    title: 'Bus booking software',
    publisher: 'Mobisoft Infotech (vendor)',
    url: 'https://mobisoftinfotech.com/amp/products/bus-booking-software',
    says: 'Bus operators manage bus/seat layouts, schedules, reservations and payments, with booking analytics.',
  },
  S14: {
    kind: 'vendor',
    title: 'POS Fashion & Apparel (Size/Color Matrix)',
    publisher: 'ECOSIRE (vendor)',
    url: 'https://ecosire.com/fr/apps/odoo/pos-fashion-apparel-matrix',
    says: 'Apparel selling needs a size × colour grid at the till with stock on hand per variant; stock Odoo makes cashiers step through attribute pop-ups.',
  },
  S15: {
    kind: 'official',
    title: 'Bill of materials',
    publisher: 'Odoo 18 documentation',
    url: 'https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/manufacturing/basic_setup/bill_configuration.html',
    says: 'A BoM lists components and quantities, can carry operations at work centres, and controls whether consumption may deviate from the BoM.',
  },
  S16: {
    kind: 'official',
    title: 'Pricelists, discounts, and formulas',
    publisher: 'Odoo 18 documentation',
    url: 'https://www.odoo.com/documentation/18.0/applications/sales/sales/products_prices/prices/pricing.html',
    says: 'Pricelist rules carry a minimum quantity and a validity period, and a pricelist can be assigned per customer.',
  },
  S17: {
    kind: 'official',
    title: 'Crops and Land (Agriculture)',
    publisher: 'Frappe / ERPNext documentation',
    url: 'https://docs.frappe.io/erpnext/crops-and-land-introduction',
    says: 'Agriculture covers land units, crops, planned field activities, analysis, and harvest sales or transfer to a warehouse; livestock is not mentioned.',
  },
  S18: {
    kind: 'vendor',
    title: 'Furniture & Home Decor Retail',
    publisher: 'Cybrosys (Odoo partner, vendor page)',
    url: 'https://www.cybrosys.com/odoo/industries/furniture-and-home-decor-retail/',
    says: 'Furniture retail needs deposits with scheduled balance, variants by material/finish/fabric/size, delivery and installation windows, and work orders for configured pieces.',
  },
  S19: {
    kind: 'vendor',
    title: 'How to manage product expiration dates in Odoo 18',
    publisher: 'Cybrosys (Odoo partner, vendor blog)',
    url: 'https://www.cybrosys.com/blog/how-to-manage-product-expiration-dates-in-odoo-18',
    says: 'Perishables need four dates per lot — expiration, best-before, removal and alert — so stock is pulled before it spoils.',
  },
  S20: {
    kind: 'official',
    title: 'Invoicing Time and Material to Customers',
    publisher: 'Odoo 13 documentation (Field Service)',
    url: 'https://www.odoo.com/documentation/user/13.0/uk/fsm/overview/invoicing_time.html',
    says: 'Service work is timed on a task, products used are recorded, and finished-but-uninvoiced tasks are billed in bulk.',
  },
  S21: {
    kind: 'vendor',
    title: 'Serial Number Tracking for Improved Inventory Management',
    publisher: 'Cleverence (vendor blog)',
    url: 'https://www.cleverence.com/amp/articles/business-blogs/serial-number-tracking-for-improved-inventory-management/',
    says: 'A unique identifier per unit lets a business trace defects, recalls and warranty claims, and link serials to warranty registration.',
  },
  S22: {
    kind: 'forum',
    title: 'Farm Livestock Module',
    publisher: 'Frappe community forum (thread started 2018-04-17)',
    url: 'https://discuss.frappe.io/t/farm-livestock-module/35896',
    says: 'Livestock needs per-animal records, a livestock cycle, mortality and production reporting, and sales; the thread shows it was a proposal, not a shipped feature.',
  },
  S23: {
    kind: 'vendor',
    title: 'How to choose the best courier management software',
    publisher: 'Planfix (vendor blog)',
    url: 'https://planfix.com/blog/industry-insights/how-to-choose-the-best-courier-management-software-for-your-delivery-business/',
    says: 'Courier work needs a live dispatch board (unassigned → delivered/failed), proof of delivery (photo/signature/scan), and COD tracking and reconciliation.',
  },
  S24: {
    kind: 'vendor',
    title: 'Bus Booking Management System (Odoo app)',
    publisher: 'Odoo Apps store listing',
    url: 'https://apps.odoo.com/apps/modules/18.0/dev_bus_booking_management_system',
    says: 'Bus types define a seat arrangement; routes carry stops, per-leg fares and timings; trips are created per route and date; reports list passengers per trip.',
  },
  S25: {
    kind: 'vendor',
    title: 'Furniture store',
    publisher: 'ECOSIRE (vendor)',
    url: 'https://ecosire.com/apps/odoo/furniture-store',
    says: 'Stock Odoo variants fall short for made-to-order pricing across frame/fabric/finish/dimension, deposit-then-balance terms, and a delivery calendar with assembly crews.',
  },
  S26: {
    kind: 'vendor',
    title: 'Sporting goods / footwear & apparel retail',
    publisher: 'Cybrosys (Odoo partner, vendor page)',
    url: 'https://www.cybrosys.com/odoo/industries/sporting-goods-retail/',
    says: 'Footwear and apparel are one product with size/colour variants; stock is counted per variant, per store and per warehouse.',
  },
  S27: {
    kind: 'vendor',
    title: 'Overview of GTIN Packaging Levels',
    publisher: 'barcode.graphics (vendor blog; weak — the page is thin)',
    url: 'https://www.barcode.graphics/overview-of-gtin-packaging-levels/',
    says: 'The sellable "each" gets a GTIN-12 and a pallet must contain one GTIN; the page does not spell out the rules for the other levels.',
  },
}

export const NO_SOURCE = 'No source found'

/** Keys added to the registry in THIS round (their onboarding row says so). */
export const NEW_ONBOARDING_KEYS = [
  'freightTransport',
  'passengerTransport',
  'courier',
  'fabricRoll',
  'computerComponents',
]

/** A named anchor in the repository. The line is resolved from the needle. */
const E = (file, needle) => ({ file, needle })

export const EVIDENCE = {
  INVOICE_CONVERT: E('backend/src/services/invoice.service.ts', 'toBaseQuantity('),
  CONV_DOMAIN: E(
    'packages/validation/src/schemas/unit-conversion.domain.ts',
    'export function toBaseQuantity',
  ),
  ENGINE_CONVERT: E('packages/local-engine/src/routes/invoices.ts', 'toBaseQuantity('),
  MULTIPLIER: E('packages/validation/src/schemas/invoice-grid.ts', 'multiplyByColumnId?: string'),
  ROW_QTY: E('packages/validation/src/schemas/invoice-grid.ts', 'export function rowQuantity'),
  UNIT_METER: E('packages/validation/src/schemas/units-seed.ts', "code: 'meter'"),
  CAP_PLANNED: E('packages/validation/src/schemas/business-capabilities.ts', 'length_pricing: {'),
  LOT: E('backend/src/services/traceability/lot.domain.ts', 'remainingQty: number'),
  SERIAL_COLUMNS: E(
    'backend/src/services/traceability/traceability.service.ts',
    'serial_number, status, batch_id',
  ),
  SERIAL_ROUTE: E('backend/src/routes/operations.routes.ts', "'/serials',"),
  BATCH_ONLINE: E(
    'packages/validation/src/schemas/offline-endpoint-matrix.ts',
    "'GET /operations/batches'",
  ),
  EXPIRY_UI: E(
    'packages/ui/src/components/ui/expiry/containers/expiry-container.tsx',
    'useExpiryReport()',
  ),
  INVOICE_TYPES: E(
    'packages/validation/src/schemas/invoice.schema.ts',
    "type: z.enum(['sale', 'purchase']).default('sale')",
  ),
  PRICE_LIST: E('packages/validation/src/schemas/pricing.ts', 'export function priceListPricing'),
  CREDIT_DOMAIN: E(
    'backend/src/services/customer-profile/customer-profile.domain.ts',
    'export function creditControl',
  ),
  CREDIT_USE: E(
    'backend/src/services/customer-profile/customer-profile.service.ts',
    'creditControl(summary.receivable',
  ),
  INSTALLMENTS: E(
    'backend/src/services/commerce/installment.service.ts',
    "rpc('installments_save'",
  ),
  MANUFACTURE: E('backend/src/services/manufacturing.service.ts', "rpc('manufacturing_complete'"),
  PROD_COST: E(
    'packages/validation/src/schemas/manufacturing-cost.ts',
    'export function computeProductionCost',
  ),
  SHELVES: E(
    'backend/src/services/inventory/warehouse-map.service.ts',
    "rpc('storage_place_stock'",
  ),
  TRANSFER: E(
    'backend/src/services/inventory-costing/transfer.domain.ts',
    "export type TransferState = 'dispatched'",
  ),
  BARCODE_ROUTE: E('backend/src/routes/product.routes.ts', 'barcode: query.barcode'),
  ASSETS: E('backend/src/services/assets/assets.service.ts', ".from('fixed_assets')"),
  DEAD_STOCK: E(
    'packages/validation/src/schemas/offline-endpoint-matrix.ts',
    "'GET /inventory/dead-stock'",
  ),
  ORDERS: E('backend/src/services/orders/orders.domain.ts', 'export const ORDER_ERROR_STATUS'),
  TIMESHEET: E('backend/src/services/timesheets/billing.domain.ts', 'Not billed at all'),
  OFFLINE_INVOICE: E(
    'packages/validation/src/schemas/offline-endpoint-matrix.ts',
    "'POST /invoices':",
  ),
  PROFILE_JEWELLERY: E('packages/validation/src/schemas/industry-profiles.ts', 'jewellery: {'),
  INDUSTRY_KEYS: E(
    'packages/validation/src/schemas/industry-profiles.ts',
    'export const INDUSTRY_KEYS',
  ),
  COST_LAYERS: E(
    'packages/validation/src/schemas/profit-report.domain.ts',
    'export function restateAtRates',
  ),
  UNIVERSAL_AREA: E(
    'packages/validation/src/schemas/universal-core/area-dimension.domain.ts',
    'calculateAreaDimension',
  ),
  UNIVERSAL_ROLL: E(
    'packages/validation/src/schemas/universal-core/roll-batch.domain.ts',
    'consumeRollLength',
  ),
  UNIVERSAL_CREDIT: E(
    'packages/validation/src/schemas/universal-core/credit-limit.domain.ts',
    'evaluateCreditLimit',
  ),
  UNIVERSAL_VARIANTS: E(
    'packages/validation/src/schemas/universal-core/variants.domain.ts',
    'resolveVariantPrice',
  ),
  UNIVERSAL_SERIALS: E(
    'packages/validation/src/schemas/universal-core/serial-batch.domain.ts',
    'validateSerialSale',
  ),
  UNIVERSAL_RETURNS: E(
    'packages/validation/src/schemas/universal-core/returns.domain.ts',
    'calculateReturnDocument',
  ),
  UNIVERSAL_WARRANTY: E(
    'packages/validation/src/schemas/universal-core/warranty.domain.ts',
    'isWarrantyActive',
  ),
  UNIVERSAL_GOLD: E(
    'packages/validation/src/schemas/universal-core/gold-jewellery.domain.ts',
    'calculateJewelleryLine',
  ),
  UNIVERSAL_PACK_BARCODE: E(
    'packages/validation/src/schemas/universal-core/pack-barcode.domain.ts',
    'resolvePackScan',
  ),
  UNIVERSAL_AUTOPARTS: E(
    'packages/validation/src/schemas/universal-core/auto-parts.domain.ts',
    'matchesFitment',
  ),
  UNIVERSAL_VEHICLES: E(
    'packages/validation/src/schemas/universal-core/vehicles.domain.ts',
    'validateVin',
  ),
  UNIVERSAL_EXTENSIONS: E(
    'packages/validation/src/schemas/universal-core/specialized-extensions.domain.ts',
    'calculateTripSummary',
  ),
}

/** Tests that exercise the behaviour (a file path is enough; existence is checked). */
export const TESTS = {
  UNIT_CONV: 'backend/src/__tests__/unit-conversion.test.ts',
  MULTIPLIER: 'packages/validation/src/__tests__/column-multiplier.test.ts',
  MEASUREMENT: 'packages/validation/src/__tests__/measurement.test.ts',
  TRACE: 'backend/src/__tests__/traceability-rules.test.ts',
  PRICE_LIST: 'backend/src/__tests__/price-list-service.test.ts',
  PRICING: 'backend/src/__tests__/pricing-engine.test.ts',
  CREDIT: 'backend/src/__tests__/customer-profile-core.test.ts',
  INSTALL: 'backend/src/__tests__/installment-engine.test.ts',
  MANUFACTURE: 'backend/src/__tests__/manufacturing.pg.test.ts',
  TRANSFER: 'backend/src/__tests__/transfer-lifecycle.test.ts',
  BARCODE: 'backend/src/__tests__/product-barcode.test.ts',
  DEAD_STOCK: 'backend/src/__tests__/reorder-dead-stock.test.ts',
  REVERSE: 'backend/src/__tests__/reverse-invoice.test.ts',
  PROFILES: 'packages/validation/src/__tests__/industry-profiles.test.ts',
  OFFLINE_MATRIX: 'packages/api/src/__tests__/offline-matrix-guard.test.ts',
  UNIVERSAL_CORE: 'packages/validation/src/__tests__/universal-core.test.ts',
  PARITY: 'packages/local-engine/src/__tests__/universal-core-parity.test.ts',
}

export const STATUS = [
  'VERIFIED_SUPPORTED',
  'PARTIALLY_SUPPORTED',
  'UNSUPPORTED',
  'NOT_APPLICABLE',
  'IMPLEMENTED_THIS_ROUND',
]

/**
 * What Hisabche does, once, per capability. A row for an industry points at one
 * of these and adds the industry-specific need.
 */
export const CAPABILITIES = {
  invoicing: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['INVOICE_CONVERT', 'OFFLINE_INVOICE'],
    tests: ['REVERSE', 'OFFLINE_MATRIX'],
    why: '',
  },
  unitConversion: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['CONV_DOMAIN', 'INVOICE_CONVERT', 'ENGINE_CONVERT'],
    tests: ['UNIT_CONV', 'PARITY'],
    why: '',
  },
  weightPricing: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['MULTIPLIER', 'ROW_QTY', 'PROFILE_JEWELLERY'],
    tests: ['MULTIPLIER', 'MEASUREMENT'],
    why: '',
  },
  lengthPricing: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIT_METER', 'UNIVERSAL_AREA', 'UNIVERSAL_ROLL'],
    tests: ['MEASUREMENT', 'PARITY'],
    why: '',
  },
  areaPricing: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_AREA'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  rollTracking: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_ROLL'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  dualUom: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['CONV_DOMAIN', 'UNIVERSAL_ROLL'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  variants: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_VARIANTS'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  variantGrid: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_VARIANTS'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  serials: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_SERIALS'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  batchExpiry: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_ROLL', 'UNIVERSAL_SERIALS'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  warranty: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_WARRANTY'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  returns: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_RETURNS'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  priceLists: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['PRICE_LIST'],
    tests: ['PRICE_LIST', 'PRICING'],
    why: '',
  },
  creditEnforcement: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_CREDIT'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  installments: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['INSTALLMENTS'],
    tests: ['INSTALL'],
    why: '',
  },
  depositOrders: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_EXTENSIONS'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  manufacturing: {
    status: 'PARTIALLY_SUPPORTED',
    evidence: ['MANUFACTURE', 'PROD_COST'],
    tests: ['MANUFACTURE'],
    why: 'BoM, production and cost are real, but production is online-only and posts no work-in-progress ledger entry (an accounting-policy decision that is the owner’s).',
  },
  madeToOrder: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_EXTENSIONS'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  warehouses: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['SHELVES', 'TRANSFER'],
    tests: ['TRANSFER'],
    why: '',
  },
  barcode: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['BARCODE_ROUTE'],
    tests: ['BARCODE'],
    why: '',
  },
  packBarcodes: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_PACK_BARCODE'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  crossReference: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_AUTOPARTS'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  coreCharge: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_AUTOPARTS'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  vehicleUnit: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_VEHICLES'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  stockAging: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['DEAD_STOCK', 'UNIVERSAL_VEHICLES'],
    tests: ['DEAD_STOCK', 'PARITY'],
    why: '',
  },
  reconditioning: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_VEHICLES'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  trips: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_EXTENSIONS'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  driverSettlement: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_EXTENSIONS'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  fleetAssets: {
    status: 'PARTIALLY_SUPPORTED',
    evidence: ['ASSETS'],
    tests: [],
    why: 'Fixed assets with depreciation exist and a vehicle can be registered as an asset, but per-vehicle fuel, maintenance and trip cost are not tracked.',
  },
  seatTicketing: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_EXTENSIONS'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  routeFares: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_EXTENSIONS'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  dispatchPod: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_EXTENSIONS'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  codReconciliation: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_EXTENSIONS'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  deliveryScheduling: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_EXTENSIONS'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  timesheetBilling: {
    status: 'PARTIALLY_SUPPORTED',
    evidence: ['TIMESHEET'],
    tests: [],
    why: 'A billing rule and routes exist for timesheets; end-to-end invoicing of tracked time was not traced or tested in this round.',
  },
  appointments: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_EXTENSIONS'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  agriLand: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_EXTENSIONS'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  livestock: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_EXTENSIONS'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  goldPurity: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_GOLD'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  makingCharges: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_GOLD'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  oldGold: {
    status: 'VERIFIED_SUPPORTED',
    evidence: ['UNIVERSAL_GOLD'],
    tests: ['UNIVERSAL_CORE', 'PARITY'],
    why: '',
  },
  offlineSales: {
    status: 'PARTIALLY_SUPPORTED',
    evidence: ['OFFLINE_INVOICE'],
    tests: ['OFFLINE_MATRIX'],
    why: 'The offline matrix marks invoice creation as available and the local engine implements it, but a live run of the Windows build offline has not been recorded in this round.',
  },
}

/** Taxonomy keys the owner required to be individually selectable. */
export const REQUIRED_ONBOARDING = {
  freight: ['freightTransport'],
  passenger: ['passengerTransport'],
  courier: ['courier'],
  clothing: ['clothing'],
  fabricRoll: ['fabricRoll'],
  fabricMeter: ['fabric'],
  kitchenware: ['kitchenware'],
  computerComponents: ['computers', 'computerComponents'],
  vehicle: ['carDealer'],
  carpet: ['carpet'],
  other: ['other'],
}

/**
 * One entry per business model. `rows` = [capability id, the industry's need,
 * source ids]. A row with no source ids reads «No source found» and cannot
 * exceed LOW confidence.
 */
export const INDUSTRIES = [
  {
    id: 'retail',
    name: 'General retail',
    onboarding: 'retail',
    rows: [
      ['invoicing', 'Fast sale with payment, stock deduction and ledger effect', []],
      ['barcode', 'Scan a barcode at the till', []],
      ['returns', 'Customer returns with a reason and restock choice', []],
      ['warehouses', 'Shelves/locations per store', ['S26']],
      ['offlineSales', 'Keep selling when the connection drops', ['S26']],
    ],
  },
  {
    id: 'wholesale',
    name: 'General wholesale',
    onboarding: 'wholesale',
    rows: [
      ['priceLists', 'Tiered / per-customer prices by minimum quantity', ['S16']],
      ['unitConversion', 'Sell by carton, count in pieces', ['S27', 'S12']],
      ['creditEnforcement', 'Stop or warn when a customer is over the credit ceiling', ['S12']],
      ['installments', 'Instalment plans for trade customers', []],
      ['depositOrders', 'Customer order with deposit before invoice', ['S18']],
    ],
  },
  {
    id: 'clothing',
    name: 'Clothing retail and wholesale',
    onboarding: 'clothing',
    rows: [
      ['variants', 'One style with size and colour variants', ['S1', 'S26']],
      ['variantGrid', 'Size × colour grid with stock per cell at the till', ['S14', 'S26']],
      ['returns', 'Returns and exchanges by size', []],
      ['barcode', 'A barcode per variant', []],
      ['offlineSales', 'Selling offline in shops', ['S26']],
    ],
  },
  {
    id: 'footwear',
    name: 'Footwear',
    onboarding: 'shoes',
    rows: [
      ['variants', 'Size and colour per model', ['S1', 'S26']],
      ['variantGrid', 'Stock per size at the till', ['S26']],
      ['returns', 'Size exchanges', []],
    ],
  },
  {
    id: 'fabricMeter',
    name: 'Fabric sold by the meter',
    onboarding: 'fabric',
    rows: [
      ['lengthPricing', 'Price per metre × metres sold', ['S4']],
      ['unitConversion', 'Roll or bolt as a purchase unit, metre as the sale unit', ['S3', 'S4']],
      ['dualUom', 'Weight (kg) and length (m) of the same fabric', ['S3']],
    ],
  },
  {
    id: 'fabricRoll',
    name: 'Fabric sold by the roll',
    onboarding: 'fabricRoll',
    rows: [
      ['rollTracking', 'Each roll with its own length; partial rolls sold', ['S4', 'S8']],
      ['dualUom', 'Per-roll conversion between purchase and sale units', ['S3', 'S4']],
      ['batchExpiry', 'Trace a roll or dye lot back to the supplier', ['S2']],
      ['lengthPricing', 'Price per metre of a roll', ['S4']],
      ['offlineSales', 'Cutting and selling without a connection', []],
    ],
  },
  {
    id: 'kitchenware',
    name: 'Kitchenware',
    onboarding: 'kitchenware',
    rows: [
      ['unitConversion', 'Sets, boxes and cartons of countable items', ['S27']],
      ['packBarcodes', 'A different barcode for the each and the case', ['S27']],
      ['variants', 'Colour and size of the same item', ['S1']],
      ['warehouses', 'Shelf locations in a large store', ['S26']],
    ],
  },
  {
    id: 'household',
    name: 'Household goods',
    onboarding: null,
    rows: [
      ['unitConversion', 'Packs and cartons', ['S27']],
      ['packBarcodes', 'Pack-level barcodes', ['S27']],
      ['warehouses', 'Shelf locations', ['S26']],
    ],
  },
  {
    id: 'computerParts',
    name: 'Computer components',
    onboarding: 'computerComponents',
    rows: [
      ['serials', 'A serial number per graphics card, drive, laptop', ['S9', 'S21']],
      ['warranty', 'Warranty period and claim history per unit', ['S9', 'S21']],
      ['returns', 'Return / replacement against the original sale', ['S9']],
      ['barcode', 'Scan manufacturer barcodes', []],
      ['variants', 'Same model in capacities or colours', ['S1']],
    ],
  },
  {
    id: 'electronics',
    name: 'Consumer electronics',
    onboarding: 'electronics',
    rows: [
      ['serials', 'IMEI / serial per device', ['S21', 'S9']],
      ['warranty', 'Warranty registration at sale', ['S21', 'S9']],
      ['installments', 'Credit sales in instalments', []],
      ['returns', 'Exchange and replacement', ['S9']],
    ],
  },
  {
    id: 'vehicleSales',
    name: 'Vehicle sales',
    onboarding: 'carDealer',
    rows: [
      [
        'vehicleUnit',
        'Each vehicle is one stock unit identified by chassis/VIN with its own cost',
        ['S6'],
      ],
      ['stockAging', 'Days on the lot per vehicle', ['S6']],
      ['reconditioning', 'Repair and prep cost added to the vehicle before sale', ['S6']],
      ['installments', 'Sale by instalments', []],
    ],
  },
  {
    id: 'autoParts',
    name: 'Automotive parts',
    onboarding: 'autoParts',
    rows: [
      ['crossReference', 'Find a part by OEM, aftermarket or superseded number', ['S10']],
      ['coreCharge', 'Refundable deposit on remanufactured parts', ['S10']],
      ['barcode', 'Scan part barcodes', []],
      ['warehouses', 'Bin locations', []],
    ],
  },
  {
    id: 'carpet',
    name: 'Carpet sales',
    onboarding: 'carpet',
    rows: [
      ['areaPricing', 'Price per square metre from width × length', ['S8']],
      ['rollTracking', 'Rolls tracked in linear metres', ['S8']],
      ['variants', 'Same design in several sizes', ['S1']],
      ['offlineSales', 'Showroom selling offline', []],
    ],
  },
  {
    id: 'furniture',
    name: 'Furniture',
    onboarding: 'furniture',
    rows: [
      ['variants', 'Material, finish, fabric and size per piece', ['S18', 'S25']],
      ['depositOrders', 'Deposit now, balance on delivery', ['S18', 'S25']],
      ['deliveryScheduling', 'Delivery and assembly windows', ['S18', 'S25']],
      ['madeToOrder', 'Made-to-order piece creates a production job', ['S18']],
    ],
  },
  {
    id: 'jewellery',
    name: 'Gold and jewelry',
    onboarding: 'jewellery',
    rows: [
      ['weightPricing', 'Price per gram × weight of the piece', ['S5']],
      ['goldPurity', 'Different rate per karat', ['S5']],
      ['makingCharges', 'Making and wastage charges on top of metal value', ['S5']],
      ['oldGold', 'Trade-in of old gold valued by weight and purity', ['S5']],
      ['serials', 'One-off pieces identified individually', []],
    ],
  },
  {
    id: 'grocery',
    name: 'Grocery and food retail',
    onboarding: 'grocery',
    rows: [
      ['batchExpiry', 'Expiry and best-before per batch, pull oldest first', ['S19', 'S2']],
      ['weightPricing', 'Sell loose goods by weight', []],
      ['unitConversion', 'Carton → piece', ['S27']],
      ['barcode', 'Scan at the till', []],
      ['offlineSales', 'Till keeps working offline', []],
    ],
  },
  {
    id: 'buildingMaterials',
    name: 'Construction and building materials',
    onboarding: 'buildingMaterials',
    rows: [
      ['unitConversion', 'Bag, tonne, bundle and m² for the same material', ['S12']],
      ['creditEnforcement', 'Contractor credit with an enforced ceiling', ['S12']],
      ['priceLists', 'Contractor price lists', ['S16']],
      ['deliveryScheduling', 'Delivery orders and truck scheduling', ['S12']],
      ['dispatchPod', 'Proof of delivery at the site', ['S12']],
    ],
  },
  {
    id: 'freight',
    name: 'Freight and cargo transport',
    onboarding: 'freightTransport',
    rows: [
      ['trips', 'Trip with vehicle, driver, load and freight charge', ['S7']],
      ['driverSettlement', 'Driver pay per trip with deductions', ['S7']],
      ['fleetAssets', 'Vehicle as an asset with running costs', []],
      ['invoicing', 'Invoice the freight charge to the customer', ['S7']],
    ],
  },
  {
    id: 'passenger',
    name: 'Passenger transport',
    onboarding: 'passengerTransport',
    rows: [
      ['seatTicketing', 'Seat layout, reservation and ticket', ['S13', 'S24']],
      ['routeFares', 'Route, stops and fare per leg', ['S24']],
      ['trips', 'Trip per route and date with a passenger list', ['S24']],
      ['fleetAssets', 'Buses as assets with running costs', []],
    ],
  },
  {
    id: 'courier',
    name: 'Courier and delivery services',
    onboarding: 'courier',
    rows: [
      ['dispatchPod', 'Dispatch board and proof of delivery', ['S23']],
      ['codReconciliation', 'Cash on delivery held by drivers, reconciled', ['S11', 'S23']],
      ['driverSettlement', 'Courier pay per delivery', []],
    ],
  },
  {
    id: 'services',
    name: 'General services and professional businesses',
    onboarding: 'consulting',
    rows: [
      ['timesheetBilling', 'Bill tracked time and materials', ['S20']],
      ['appointments', 'Bookable appointments', []],
      ['invoicing', 'Invoice a service with no stock effect', ['S20']],
    ],
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing and workshops',
    onboarding: 'manufacturing',
    rows: [
      ['manufacturing', 'Bill of materials, production and cost', ['S15']],
      ['madeToOrder', 'Sales order starts a work order', ['S15', 'S18']],
      ['batchExpiry', 'Trace produced batches', ['S2']],
    ],
  },
  {
    id: 'agriculture',
    name: 'Agriculture and livestock',
    onboarding: 'agriculture',
    rows: [
      ['agriLand', 'Land plots, crops and field activities', ['S17']],
      ['livestock', 'Per-animal records and production', ['S22']],
      ['batchExpiry', 'Harvest lots and expiry', ['S2']],
    ],
  },
  {
    id: 'other',
    name: 'Other businesses using the universal core',
    onboarding: 'other',
    rows: [
      ['invoicing', 'Invoices, payments, ledger and reports with no industry assumptions', []],
      ['offlineSales', 'Offline operation', []],
    ],
  },
]
