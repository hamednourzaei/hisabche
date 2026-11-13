// ============================================
// packages/validation/src/schemas/business-capabilities.ts
//
// Single source of truth for business capabilities.
//
// STATUS DISCIPLINE (V53 — a registry entry must not claim more than the
// product can do):
//   'available' — the WHOLE chain is usable: shared rule, backend service,
//                 local engine, API hook and UI, with a parity test. Nothing
//                 the user would reasonably expect is missing.
//   'partial'   — real and usable at a stated scope (the evidence is real and
//                 its UI stays mounted), but at least one link of the chain is
//                 missing. The missing links are named in `limitations`; a
//                 partial capability is switched on for a profile and is NEVER
//                 presented as complete.
//   'planned'   — nothing usable yet. Carries no evidence, no profile.
//
// COMPOSITION (what the resolver below enforces):
//   `requires`  — capabilities that must be usable first, each with the lowest
//                 version the dependent was written against.
//   `conflicts` — capabilities that must not be switched on together. A
//                 conflict is symmetric; the later one in registry order loses.
//   `version`   — bumped when a capability's contract changes in a way a
//                 dependent must notice.
// ============================================

import { OFFLINE_ENDPOINT_MATRIX } from './offline-endpoint-matrix'
import type { PackId } from './feature-packs'

export const ENGINE_KEYS = [
  'sales_invoice',
  'sales_orders',
  'appointments_resources',
  'work_orders_repair',
  'projects_time',
  'production_bom',
  'procurement',
  'delivery_logistics',
  'quality_claims',
  'contracts_recurring',
  'assets_rental',
  'agriculture_livestock',
  'costing_ledger',
  'forecast_insights',
  'inventory_catalog',
  'pricing_rates',
  'deposits_installments',
  'package_credits',
  'workforce_payroll',
  'approvals_workflow',
] as const

export type EngineKey = (typeof ENGINE_KEYS)[number]

export type EngineOfflineStatus = 'available' | 'partial' | 'online_required' | 'unwired'
export type EngineOfflineMode = 'local' | 'online_required'

export interface EngineDefinition {
  readonly key: EngineKey
  readonly service: string | null
  readonly localEngine: string | null
  readonly localEngineRoute: string | null
  readonly clientHook: string | null
  readonly uiHost: string | null
  readonly matrixFeature: string | null
  readonly offlineStatus: EngineOfflineStatus
  readonly offline: EngineOfflineMode
  readonly pack: PackId
}

/** Derive engine offline mode strictly from OFFLINE_ENDPOINT_MATRIX. */
export function deriveEngineOfflineMode(matrixFeature: string | null): EngineOfflineMode {
  if (!matrixFeature) return 'online_required'
  const rows = Object.values(OFFLINE_ENDPOINT_MATRIX).filter(([feat]) => feat === matrixFeature)
  if (rows.length === 0) return 'online_required'
  return rows.every(([, status]) => status === 'available') ? 'local' : 'online_required'
}

export const ENGINES: Readonly<Record<EngineKey, EngineDefinition>> = {
  sales_invoice: {
    key: 'sales_invoice',
    service: 'backend/src/services/invoice.service.ts',
    localEngine: 'packages/local-engine/src/routes/invoices.ts',
    localEngineRoute: 'packages/local-engine/src/routes/invoices.ts',
    clientHook: 'packages/api/src/hooks/invoices.ts',
    uiHost:
      'packages/ui/src/components/ui/invoice-builder/containers/invoice-builder-container.tsx',
    matrixFeature: 'invoice.create',
    offlineStatus: 'available',
    offline: deriveEngineOfflineMode('invoice.create'),
    pack: 'core',
  },
  sales_orders: {
    key: 'sales_orders',
    service: 'backend/src/services/orders/orders.service.ts',
    localEngine: null,
    localEngineRoute: null,
    clientHook: 'packages/api/src/hooks/orders.ts',
    uiHost: 'packages/ui/src/components/ui/invoices/containers/sales-orders-container.tsx',
    matrixFeature: 'sales.orders',
    offlineStatus: 'online_required',
    offline: deriveEngineOfflineMode('sales.orders'),
    pack: 'operations',
  },
  appointments_resources: {
    key: 'appointments_resources',
    service: 'backend/src/services/service-delivery/service-delivery.service.ts',
    localEngine: 'packages/local-engine/src/routes/service-delivery.ts',
    localEngineRoute: 'packages/local-engine/src/routes/service-delivery.ts',
    clientHook: 'packages/api/src/hooks/universal-core.ts',
    uiHost:
      'packages/ui/src/components/ui/service-delivery/containers/service-delivery-container.tsx',
    matrixFeature: 'operations.service_delivery',
    offlineStatus: 'partial',
    offline: deriveEngineOfflineMode('operations.service_delivery'),
    pack: 'workforce',
  },
  work_orders_repair: {
    key: 'work_orders_repair',
    service: 'backend/src/services/repair/repair-ticket.service.ts',
    localEngine: 'packages/local-engine/src/routes/service-delivery.ts',
    localEngineRoute: 'packages/local-engine/src/routes/service-delivery.ts',
    clientHook: 'packages/api/src/hooks/business-packs.ts',
    uiHost: 'packages/ui/src/components/ui/business-packs/repair-tickets-section.tsx',
    matrixFeature: 'operations.repairs',
    offlineStatus: 'partial',
    offline: deriveEngineOfflineMode('operations.repairs'),
    pack: 'workforce',
  },
  projects_time: {
    key: 'projects_time',
    service: 'backend/src/services/project.service.ts',
    localEngine: null,
    localEngineRoute: null,
    clientHook: 'packages/api/src/hooks/projects.ts',
    uiHost: 'packages/ui/src/components/ui/timesheets/containers/timesheets-container.tsx',
    matrixFeature: 'project.manage',
    offlineStatus: 'online_required',
    offline: deriveEngineOfflineMode('project.manage'),
    pack: 'workforce',
  },
  production_bom: {
    key: 'production_bom',
    service: 'backend/src/services/manufacturing.service.ts',
    localEngine: null,
    localEngineRoute: null,
    clientHook: 'packages/api/src/hooks/manufacturing.ts',
    uiHost: 'packages/ui/src/components/ui/manufacturing/containers/manufacturing-container.tsx',
    matrixFeature: 'manufacturing.bom',
    offlineStatus: 'online_required',
    offline: deriveEngineOfflineMode('manufacturing.bom'),
    pack: 'manufacturing',
  },
  procurement: {
    key: 'procurement',
    service: 'backend/src/services/purchasing.service.ts',
    localEngine: 'packages/local-engine/src/routes/purchasing.ts',
    localEngineRoute: 'packages/local-engine/src/routes/purchasing.ts',
    clientHook: 'packages/api/src/hooks/purchasing.ts',
    uiHost: 'packages/ui/src/components/ui/warehouse/containers/Warehouse-container.tsx',
    matrixFeature: 'purchase.orders',
    offlineStatus: 'available',
    offline: deriveEngineOfflineMode('purchase.orders'),
    pack: 'operations',
  },
  delivery_logistics: {
    key: 'delivery_logistics',
    service: 'backend/src/services/transport/transport.service.ts',
    localEngine: null,
    localEngineRoute: null,
    clientHook: 'packages/api/src/hooks/universal-core.ts',
    uiHost: 'packages/ui/src/components/ui/invoices/containers/sales-orders-container.tsx',
    matrixFeature: 'trade.delivery_notes',
    offlineStatus: 'online_required',
    offline: deriveEngineOfflineMode('trade.delivery_notes'),
    pack: 'operations',
  },
  quality_claims: {
    key: 'quality_claims',
    service: 'backend/src/services/sales/warranty.service.ts',
    localEngine: 'packages/local-engine/src/routes/warranties.ts',
    localEngineRoute: 'packages/local-engine/src/routes/warranties.ts',
    clientHook: 'packages/api/src/hooks/universal-core.ts',
    uiHost: 'packages/ui/src/components/ui/invoices/warranties-section.tsx',
    matrixFeature: 'trade.warranties',
    offlineStatus: 'partial',
    offline: deriveEngineOfflineMode('trade.warranties'),
    pack: 'operations',
  },
  contracts_recurring: {
    key: 'contracts_recurring',
    service: 'backend/src/routes/contracts.routes.ts',
    localEngine: null,
    localEngineRoute: null,
    clientHook: 'packages/api/src/hooks/contracts.ts',
    uiHost: 'packages/ui/src/components/ui/customers/contracts-section.tsx',
    matrixFeature: 'commerce.contracts',
    offlineStatus: 'online_required',
    offline: deriveEngineOfflineMode('commerce.contracts'),
    pack: 'operations',
  },
  assets_rental: {
    key: 'assets_rental',
    service: 'backend/src/services/assets/assets.service.ts',
    localEngine: null,
    localEngineRoute: null,
    clientHook: 'packages/api/src/hooks/assets.ts',
    uiHost: 'packages/ui/src/components/ui/assets/containers/assets-container.tsx',
    matrixFeature: null,
    offlineStatus: 'online_required',
    offline: deriveEngineOfflineMode(null),
    pack: 'operations',
  },
  agriculture_livestock: {
    key: 'agriculture_livestock',
    service: 'backend/src/routes/agriculture.routes.ts',
    localEngine: null,
    localEngineRoute: null,
    clientHook: null,
    uiHost: null,
    matrixFeature: null,
    offlineStatus: 'unwired',
    offline: deriveEngineOfflineMode(null),
    pack: 'operations',
  },
  costing_ledger: {
    key: 'costing_ledger',
    service: 'backend/src/services/accounting/accounting.service.ts',
    localEngine: 'packages/local-engine/src/routes/accounting.ts',
    localEngineRoute: 'packages/local-engine/src/routes/accounting.ts',
    clientHook: 'packages/api/src/hooks/accounting.ts',
    uiHost: 'packages/ui/src/components/ui/accounting/tabs/IncomeStatementTab.tsx',
    matrixFeature: 'accounting.profit_report',
    offlineStatus: 'available',
    offline: deriveEngineOfflineMode('accounting.profit_report'),
    pack: 'core',
  },
  forecast_insights: {
    key: 'forecast_insights',
    service: 'backend/src/services/intelligence/forecast.service.ts',
    localEngine: 'packages/local-engine/src/routes/insights.ts',
    localEngineRoute: 'packages/local-engine/src/routes/insights.ts',
    clientHook: 'packages/api/src/hooks/inventory-operations.ts',
    uiHost: 'packages/ui/src/components/ui/dashboard/owner-command-center.tsx',
    matrixFeature: 'ai.cashflow_forecast',
    offlineStatus: 'partial',
    offline: deriveEngineOfflineMode('ai.cashflow_forecast'),
    pack: 'intelligence',
  },
  inventory_catalog: {
    key: 'inventory_catalog',
    service: 'backend/src/services/warehouse.service.ts',
    localEngine: 'packages/local-engine/src/routes/variants.ts',
    localEngineRoute: 'packages/local-engine/src/routes/variants.ts',
    clientHook: 'packages/api/src/hooks/universal-core.ts',
    uiHost: 'packages/ui/src/components/ui/warehouse/product-variants-section.tsx',
    matrixFeature: 'product.variants',
    offlineStatus: 'partial',
    offline: deriveEngineOfflineMode('product.variants'),
    pack: 'core',
  },
  pricing_rates: {
    key: 'pricing_rates',
    service: 'backend/src/services/pricing/metal-rates.service.ts',
    localEngine: 'packages/local-engine/src/routes/pricing.ts',
    localEngineRoute: 'packages/local-engine/src/routes/pricing.ts',
    clientHook: 'packages/api/src/hooks/price-lists.ts',
    uiHost: 'packages/ui/src/components/ui/promotions/price-lists-panel.tsx',
    matrixFeature: 'pricing.price_lists',
    offlineStatus: 'available',
    offline: deriveEngineOfflineMode('pricing.price_lists'),
    pack: 'core',
  },
  deposits_installments: {
    key: 'deposits_installments',
    service: 'backend/src/services/sales/order-deposit.service.ts',
    localEngine: 'packages/local-engine/src/routes/order-deposits.ts',
    localEngineRoute: 'packages/local-engine/src/routes/order-deposits.ts',
    clientHook: 'packages/api/src/hooks/universal-core.ts',
    uiHost: 'packages/ui/src/components/ui/invoices/containers/advances-container.tsx',
    matrixFeature: 'order.deposits',
    offlineStatus: 'available',
    offline: deriveEngineOfflineMode('order.deposits'),
    pack: 'operations',
  },
  package_credits: {
    key: 'package_credits',
    service: 'backend/src/routes/package-credits.routes.ts',
    localEngine: 'packages/local-engine/src/routes/package-credits.ts',
    localEngineRoute: 'packages/local-engine/src/routes/package-credits.ts',
    clientHook: 'packages/api/src/hooks/universal-core.ts',
    uiHost:
      'packages/ui/src/components/ui/service-delivery/containers/service-delivery-container.tsx',
    matrixFeature: 'operations.service_delivery',
    offlineStatus: 'partial',
    offline: deriveEngineOfflineMode('operations.service_delivery'),
    pack: 'workforce',
  },
  workforce_payroll: {
    key: 'workforce_payroll',
    service: 'backend/src/routes/human-resources.routes.ts',
    localEngine: 'packages/local-engine/src/routes/payroll.ts',
    localEngineRoute: 'packages/local-engine/src/routes/payroll.ts',
    clientHook: 'packages/api/src/hooks/payroll.ts',
    uiHost:
      'packages/ui/src/components/ui/human-resources/containers/employee-detail-container.tsx',
    matrixFeature: 'hr.payroll',
    offlineStatus: 'available',
    offline: deriveEngineOfflineMode('hr.payroll'),
    pack: 'workforce',
  },
  approvals_workflow: {
    key: 'approvals_workflow',
    service: 'backend/src/services/workflow.service.ts',
    localEngine: null,
    localEngineRoute: null,
    clientHook: 'packages/api/src/hooks/use-workflow.ts',
    uiHost: 'packages/ui/src/components/ui/workflow/containers/approvals-container.tsx',
    matrixFeature: 'approvals.workflows',
    offlineStatus: 'online_required',
    offline: deriveEngineOfflineMode('approvals.workflows'),
    pack: 'approvals',
  },
}

export const CAPABILITY_KEYS = [
  'measurement',
  'weight_pricing',
  'length_pricing',
  'volume_pricing',
  'area_pricing',
  'roll_cutting',
  'tiered_pricing',
  'multi_unit',
  'batch_expiry',
  'recipe_bom',
  'variants',
  'table_service',
  'serialized_items',
  'auto_fitments',
  'gold_purity',
  'making_charges',
  'resource_capacity',
  'work_queue_sla',
  'sales_orders',
  'procurement_planning',
  'three_way_match',
  'project_costing',
  'timesheet_billing',
  'contracts_recurring',
  'deposits_liability',
  'installments',
  'package_credits',
  'delivery_pod',
  'fleet_dispatch',
  'asset_rental',
  'quality_inspection',
  'warranty_claims',
  'cost_allocation',
  'approval_workflow',
  'owner_forecast',
  'livestock_register',
  'crop_cycle',
  'room_nights',
] as const

export type CapabilityKey = (typeof CAPABILITY_KEYS)[number]

export type CapabilityStatus = 'available' | 'partial' | 'planned'

export interface CapabilityEvidence {
  sources: readonly string[]
  tests: readonly string[]
}

export interface CapabilityRequirement {
  readonly key: CapabilityKey
  /** The lowest version of `key` this capability was written against. */
  readonly minVersion: number
}

export interface CapabilityDefinition {
  key: CapabilityKey
  status: CapabilityStatus
  engine: EngineKey | null
  labelKey: string
  evidence: CapabilityEvidence
  readonly version: number
  readonly requires: readonly CapabilityRequirement[]
  readonly conflicts: readonly CapabilityKey[]
  /**
   * Stable codes (not prose) for the links of the chain that are missing.
   * Non-empty exactly when `status` is 'partial'.
   */
  readonly limitations: readonly string[]
}

const NO_EVIDENCE: CapabilityEvidence = { sources: [], tests: [] }

type Relations = Pick<CapabilityDefinition, 'version' | 'requires' | 'conflicts' | 'limitations'>

const STANDALONE: Relations = { version: 1, requires: [], conflicts: [], limitations: [] }

const needs = (key: CapabilityKey): CapabilityRequirement => ({ key, minVersion: 1 })

export const CAPABILITIES: Record<CapabilityKey, CapabilityDefinition> = {
  measurement: {
    key: 'measurement',
    status: 'available',
    engine: 'sales_invoice',
    labelKey: 'capability.measurement',
    evidence: {
      sources: [
        'packages/validation/src/schemas/measurement.domain.ts',
        'backend/src/services/inventory/unit-conversion.domain.ts',
      ],
      tests: [
        'packages/validation/src/__tests__/measurement.test.ts',
        'packages/local-engine/src/__tests__/invoice-unit-parity.test.ts',
      ],
    },
    ...STANDALONE,
  },
  weight_pricing: {
    key: 'weight_pricing',
    status: 'available',
    engine: 'sales_invoice',
    labelKey: 'capability.weightPricing',
    evidence: {
      sources: [
        'packages/validation/src/schemas/invoice-grid.ts',
        'packages/ui/src/components/ui/invoice-builder/grid/grid-cell.tsx',
      ],
      tests: [
        'packages/validation/src/__tests__/column-multiplier.test.ts',
        'packages/local-engine/src/__tests__/parity.test.ts',
      ],
    },
    ...STANDALONE,
    requires: [needs('measurement')],
  },
  length_pricing: {
    key: 'length_pricing',
    status: 'partial',
    engine: 'sales_invoice',
    labelKey: 'capability.lengthPricing',
    evidence: {
      sources: [
        'packages/validation/src/schemas/measurement.domain.ts',
        'packages/local-engine/src/routes/invoices.ts',
        'packages/ui/src/components/ui/invoice-builder/grid/grid-cell.tsx',
      ],
      tests: ['packages/validation/src/__tests__/measurement.test.ts'],
    },
    ...STANDALONE,
    requires: [needs('measurement')],
    limitations: ['LINEAR_CUT_LOSS_NOT_TRACKED'],
  },
  volume_pricing: {
    key: 'volume_pricing',
    status: 'partial',
    engine: 'sales_invoice',
    labelKey: 'capability.volumePricing',
    evidence: {
      sources: [
        'packages/validation/src/schemas/measurement.domain.ts',
        'packages/local-engine/src/routes/invoices.ts',
        'packages/ui/src/components/ui/invoice-builder/grid/grid-cell.tsx',
      ],
      tests: ['packages/validation/src/__tests__/measurement.test.ts'],
    },
    ...STANDALONE,
    requires: [needs('measurement')],
    limitations: ['TANK_DIP_CALIBRATION_NOT_TRACKED'],
  },
  area_pricing: {
    key: 'area_pricing',
    status: 'partial',
    engine: 'sales_invoice',
    labelKey: 'capabilities.area_pricing.label',
    evidence: {
      sources: ['packages/validation/src/schemas/universal-core/area-dimension.domain.ts'],
      tests: ['packages/validation/src/__tests__/universal-core.test.ts'],
    },
    ...STANDALONE,
    requires: [needs('measurement')],
    limitations: ['NO_SERVER_ROUTE_OR_INVOICE_LINE_PICKER'],
  },
  roll_cutting: {
    key: 'roll_cutting',
    status: 'partial',
    engine: null,
    labelKey: 'capabilities.roll_cutting.label',
    evidence: {
      sources: ['packages/validation/src/schemas/universal-core/roll-batch.domain.ts'],
      tests: ['packages/validation/src/__tests__/universal-core.test.ts'],
    },
    ...STANDALONE,
    requires: [needs('measurement')],
    limitations: ['NO_SERVER_ROUTE_OR_UI_PICKER'],
  },
  tiered_pricing: {
    key: 'tiered_pricing',
    status: 'partial',
    engine: 'pricing_rates',
    labelKey: 'capabilities.tiered_pricing.label',
    evidence: {
      sources: [
        'packages/local-engine/src/routes/pricing.ts',
        'packages/api/src/hooks/price-lists.ts',
        'packages/ui/src/components/ui/promotions/price-lists-panel.tsx',
      ],
      tests: ['packages/local-engine/src/__tests__/parity.test.ts'],
    },
    ...STANDALONE,
    limitations: ['QUANTITY_BREAK_UI_BASIC'],
  },
  multi_unit: {
    key: 'multi_unit',
    status: 'available',
    engine: 'sales_invoice',
    labelKey: 'capability.multiUnit',
    evidence: {
      sources: [
        'packages/validation/src/schemas/common.schema.ts',
        'packages/local-engine/src/routes/invoices.ts',
        'backend/src/services/inventory/unit-conversion.domain.ts',
      ],
      tests: [
        'packages/ui/src/__tests__/product-unit-set.test.ts',
        'backend/src/__tests__/unit-conversion.test.ts',
        'packages/local-engine/src/__tests__/invoice-unit-parity.test.ts',
      ],
    },
    ...STANDALONE,
  },
  batch_expiry: {
    key: 'batch_expiry',
    status: 'partial',
    engine: 'inventory_catalog',
    // V55 P1: the workflow EXISTS and was audited — receive a batch with its
    // expiry, FEFO allocation, refuse issuing expired stock, expiry report with
    // the write-off value, and the warehouse receive screen names the batch.
    // V55 final completion: the device has the SAME identity now (local
    // migration v22: stock_batches + lot_allocations) and runs the SAME shared
    // FEFO core (`planAllocation`) offline — receive, list, plan and issue are
    // local routes; a cancelled offline sale gives back exactly what it took.
    labelKey: 'capability.batchExpiry',
    evidence: {
      sources: [
        'packages/validation/src/schemas/universal-core/lot-allocation.domain.ts',
        'backend/src/services/traceability/lot.domain.ts',
        'backend/src/services/traceability/traceability.service.ts',
        'backend/src/routes/operations.routes.ts',
        'packages/local-engine/src/routes/batches.ts',
        'packages/app-bridge/src/local-universal-core-schema.ts',
        'packages/api/src/hooks/expiry.ts',
        'packages/ui/src/components/ui/warehouse/add-to-warehouse-modal.tsx',
      ],
      tests: [
        'backend/src/__tests__/traceability-rules.test.ts',
        'packages/validation/src/__tests__/lot-allocation.test.ts',
        'packages/local-engine/src/__tests__/migration-v22.test.ts',
        'packages/local-engine/src/__tests__/offline-batch-identity.test.ts',
      ],
    },
    ...STANDALONE,
    // What remains: correcting a batch's dates, the expiry report and the lot
    // trail still run on the server only (their matrix rows stay
    // online_required), and a RETURN does not restore the batch it came from —
    // on the server either, so no policy was invented.
    limitations: ['BATCH_RETURN_RESTORE_MISSING'],
  },
  recipe_bom: {
    key: 'recipe_bom',
    status: 'partial',
    engine: 'production_bom',
    labelKey: 'capability.recipeBom',
    evidence: {
      sources: [
        'packages/validation/src/schemas/manufacturing-cost.ts',
        'backend/src/services/manufacturing.service.ts',
        'backend/src/routes/manufacturing.routes.ts',
        'packages/api/src/hooks/manufacturing.ts',
        'packages/ui/src/components/ui/manufacturing/manufacturing-view.tsx',
      ],
      tests: [
        'packages/validation/src/__tests__/manufacturing-cost.test.ts',
        'backend/src/__tests__/manufacturing-embed-fallback.test.ts',
        'backend/src/__tests__/manufacturing-page-500s.test.ts',
      ],
    },
    ...STANDALONE,
    limitations: ['SERVER_ONLY_NO_OFFLINE_ENGINE'],
  },
  variants: {
    key: 'variants',
    status: 'partial',
    engine: 'inventory_catalog',
    labelKey: 'capability.variants',
    evidence: {
      sources: [
        'packages/validation/src/schemas/universal-core/variants.domain.ts',
        'backend/src/services/product/variant.service.ts',
        'backend/src/services/purchasing.service.ts',
        'backend/src/routes/variant.routes.ts',
        'packages/local-engine/src/routes/variants.ts',
        'packages/local-engine/src/routes/invoices.ts',
        'packages/api/src/hooks/universal-core.ts',
        'packages/ui/src/components/ui/warehouse/product-variants-section.tsx',
        'packages/ui/src/components/ui/invoice-builder/row-variant-picker.tsx',
        'packages/ui/src/components/ui/warehouse-detail/containers/warehouse-detail-container.tsx',
      ],
      tests: [
        'packages/validation/src/__tests__/universal-core.test.ts',
        'packages/validation/src/__tests__/variant-binding.test.ts',
        'packages/validation/src/__tests__/variant-sales-availability.test.ts',
        'packages/local-engine/src/__tests__/migration-v9.test.ts',
        'packages/local-engine/src/__tests__/offline-variant-identity.test.ts',
        'packages/local-engine/src/__tests__/universal-core-parity.test.ts',
        'backend/src/__tests__/invoice-variant-binding.test.ts',
        'backend/src/__tests__/purchase-variant-binding.test.ts',
        'backend/src/__tests__/purchase-variant-binding-01.pg.test.ts',
      ],
    },
    ...STANDALONE,
    // V55 P2 vertical slice: an invoice line, a stock movement AND a purchase
    // line carry variant_id (server + offline), a sale is refused when THAT
    // variant has no stock (policy-gated), and a return restores the exact
    // sold variant. V55 final completion: the MOBILE_NO_VARIANT_PICKER
    // limitation was STALE — the mobile app hosts the shared shell
    // (apps/mobile/src/host/shell-webview.tsx), whose invoice builder is the
    // web builder: the row picker in the grid AND in the mobile
    // item-editor-sheet (packages/ui/.../invoice-builder/mobile), the offline
    // engine serves /operations/variants, and the serial picker is the
    // invoice-detail panel. What remains:
    limitations: ['COST_LAYERS_ARE_PRODUCT_KEYED'],
  },
  table_service: {
    key: 'table_service',
    status: 'planned',
    engine: null,
    labelKey: 'capability.tableService',
    evidence: NO_EVIDENCE,
    ...STANDALONE,
  },
  serialized_items: {
    key: 'serialized_items',
    status: 'partial',
    engine: 'inventory_catalog',
    labelKey: 'capability.serializedItems',
    evidence: {
      sources: [
        'packages/validation/src/schemas/universal-core/serial-batch.domain.ts',
        'backend/src/routes/operations.routes.ts',
        'packages/api/src/hooks/universal-core.ts',
        'packages/ui/src/components/ui/invoices/warranties-section.tsx',
        'packages/ui/src/components/ui/warehouse-detail/containers/warehouse-detail-container.tsx',
      ],
      tests: [
        'packages/validation/src/__tests__/universal-core.test.ts',
        'packages/local-engine/src/__tests__/universal-core-parity.test.ts',
      ],
    },
    ...STANDALONE,
    // V55 P1 (audited): the SALE claims its units through the DESIGNED flow —
    // the invoice records the stock and the money, then POST /operations/serials/issue
    // (`assignSerialsToSale`, guarded per unit) names the IMEIs ON that invoice,
    // the invoice-detail screen picks them from stock, and cancelling the
    // invoice releases them (`releaseClaims`). Not a call inside
    // `InvoiceService.create` — by design, not by omission. What remains:
    limitations: ['OFFLINE_SERIAL_IDENTITY_MISSING'],
  },
  auto_fitments: {
    key: 'auto_fitments',
    status: 'partial',
    engine: 'inventory_catalog',
    labelKey: 'capability.autoFitments',
    evidence: {
      sources: [
        'backend/src/services/inventory/fitment.service.ts',
        'backend/src/routes/operations.routes.ts',
        'packages/local-engine/src/routes/fitments.ts',
        'packages/api/src/hooks/universal-core.ts',
        'packages/ui/src/components/ui/warehouse/product-fitments-section.tsx',
        'packages/ui/src/components/ui/warehouse-detail/containers/warehouse-detail-container.tsx',
      ],
      tests: [
        'packages/validation/src/__tests__/universal-core.test.ts',
        'packages/local-engine/src/__tests__/universal-core-parity.test.ts',
      ],
    },
    ...STANDALONE,
    // Fitment records and search exist; the core-charge rule has no caller.
    limitations: ['CORE_CHARGE_NOT_APPLIED'],
  },
  gold_purity: {
    key: 'gold_purity',
    status: 'partial',
    engine: 'pricing_rates',
    labelKey: 'capability.goldPurity',
    evidence: {
      sources: [
        'packages/validation/src/schemas/universal-core/gold-jewellery.domain.ts',
        'backend/src/services/pricing/metal-rates.service.ts',
        'backend/src/routes/metal-rates.routes.ts',
        'packages/local-engine/src/routes/metal-rates.ts',
        'packages/api/src/hooks/universal-core.ts',
      ],
      tests: [
        'packages/validation/src/__tests__/universal-core.test.ts',
        'packages/local-engine/src/__tests__/universal-core-parity.test.ts',
      ],
    },
    ...STANDALONE,
    requires: [needs('weight_pricing')],
    // Metal rates are stored and served; no invoice line is priced from purity.
    limitations: ['LINE_PRICING_FROM_PURITY_NOT_WIRED'],
  },
  making_charges: {
    key: 'making_charges',
    status: 'partial',
    engine: 'pricing_rates',
    labelKey: 'capability.makingCharges',
    evidence: {
      sources: [
        'packages/validation/src/schemas/universal-core/gold-jewellery.domain.ts',
        'backend/src/services/pricing/metal-rates.service.ts',
        'backend/src/routes/metal-rates.routes.ts',
        'packages/local-engine/src/routes/metal-rates.ts',
        'packages/api/src/hooks/universal-core.ts',
      ],
      tests: [
        'packages/validation/src/__tests__/universal-core.test.ts',
        'packages/local-engine/src/__tests__/universal-core-parity.test.ts',
      ],
    },
    ...STANDALONE,
    requires: [needs('gold_purity')],
    limitations: ['MAKING_CHARGE_NOT_COMPUTED_ON_LINE'],
  },
  resource_capacity: {
    key: 'resource_capacity',
    status: 'partial',
    engine: 'appointments_resources',
    labelKey: 'capabilities.resource_capacity.label',
    evidence: {
      sources: [
        'packages/validation/src/schemas/resource-capacity.ts',
        'backend/src/services/salon/salon.service.ts',
        'backend/src/routes/salon.routes.ts',
        'packages/api/src/hooks/business-packs.ts',
        'packages/ui/src/components/ui/business-packs/salon-sections.tsx',
      ],
      tests: [
        'packages/validation/src/__tests__/resource-capacity.test.ts',
        'backend/src/__tests__/resource-capacity-01.pg.test.ts',
      ],
    },
    ...STANDALONE,
    limitations: ['CONCURRENT_SLOT_LOCK_SERVER_ONLY'],
  },
  work_queue_sla: {
    key: 'work_queue_sla',
    status: 'partial',
    engine: 'work_orders_repair',
    labelKey: 'capabilities.work_queue_sla.label',
    evidence: {
      sources: [
        'backend/src/services/repair/repair-ticket.service.ts',
        'backend/src/routes/repair.routes.ts',
        'packages/api/src/hooks/business-packs.ts',
        'packages/ui/src/components/ui/work-queue/containers/work-queue-container.tsx',
      ],
      tests: ['backend/src/__tests__/v59-1-repair-routes-http.test.ts'],
    },
    ...STANDALONE,
    limitations: ['SLA_BREACH_ALERT_ONLY'],
  },
  sales_orders: {
    key: 'sales_orders',
    status: 'partial',
    engine: 'sales_orders',
    labelKey: 'capabilities.sales_orders.label',
    evidence: {
      sources: [
        'backend/src/services/orders/orders.service.ts',
        'backend/src/routes/orders.routes.ts',
        'packages/api/src/hooks/orders.ts',
      ],
      tests: ['backend/src/__tests__/storefront-orders.test.ts'],
    },
    ...STANDALONE,
    limitations: ['SERVER_ONLY_NO_OFFLINE_ENGINE'],
  },
  procurement_planning: {
    key: 'procurement_planning',
    status: 'partial',
    engine: 'procurement',
    labelKey: 'capabilities.procurement_planning.label',
    evidence: {
      sources: [
        'packages/validation/src/schemas/procurement-match.ts',
        'backend/src/services/purchasing.service.ts',
        'packages/api/src/hooks/purchasing.ts',
        'packages/ui/src/components/ui/inventory-ops/inventory-ops-view.tsx',
      ],
      tests: ['packages/validation/src/__tests__/procurement-match.test.ts'],
    },
    ...STANDALONE,
    limitations: ['PACK_ROUNDING_SERVER_SIDE'],
  },
  three_way_match: {
    key: 'three_way_match',
    status: 'partial',
    engine: 'procurement',
    labelKey: 'capabilities.three_way_match.label',
    evidence: {
      sources: [
        'packages/validation/src/schemas/procurement-match.ts',
        'backend/src/services/purchasing.service.ts',
        'backend/src/routes/purchasing.routes.ts',
      ],
      tests: ['packages/validation/src/__tests__/procurement-match.test.ts'],
    },
    ...STANDALONE,
    limitations: ['SERVER_ONLY_THREE_WAY_MATCH'],
  },
  project_costing: {
    key: 'project_costing',
    status: 'partial',
    engine: 'projects_time',
    labelKey: 'capabilities.project_costing.label',
    evidence: {
      sources: [
        'backend/src/services/project.service.ts',
        'backend/src/routes/project.routes.ts',
        'packages/api/src/hooks/projects.ts',
      ],
      tests: ['backend/src/__tests__/project-members-tenancy.test.ts'],
    },
    ...STANDALONE,
    limitations: ['SERVER_ONLY_NO_OFFLINE_ENGINE', 'NO_OVERHEAD_ALLOCATION'],
  },
  timesheet_billing: {
    key: 'timesheet_billing',
    status: 'partial',
    engine: 'projects_time',
    labelKey: 'capabilities.timesheet_billing.label',
    evidence: {
      sources: [
        'backend/src/services/timesheets/billing.domain.ts',
        'backend/src/services/timesheets/timesheets.service.ts',
        'packages/api/src/hooks/timesheets.ts',
        'packages/ui/src/components/ui/timesheets/containers/timesheets-container.tsx',
      ],
      tests: ['backend/src/__tests__/project-members-tenancy.test.ts'],
    },
    ...STANDALONE,
    requires: [needs('project_costing')],
    limitations: ['MILESTONE_INVOICE_WIRING_PARTIAL'],
  },
  contracts_recurring: {
    key: 'contracts_recurring',
    status: 'partial',
    engine: 'contracts_recurring',
    labelKey: 'capabilities.contracts_recurring.label',
    evidence: {
      sources: [
        'packages/validation/src/schemas/contracts.ts',
        'backend/src/services/contracts/contracts.service.ts',
        'backend/src/routes/contracts.routes.ts',
        'packages/api/src/hooks/contracts.ts',
      ],
      tests: [
        'backend/src/__tests__/contracts-service.test.ts',
        'backend/src/__tests__/contracts-01.pg.test.ts',
      ],
    },
    ...STANDALONE,
    limitations: ['SERVER_ONLY_NO_OFFLINE_ENGINE'],
  },
  deposits_liability: {
    key: 'deposits_liability',
    status: 'partial',
    engine: 'deposits_installments',
    labelKey: 'capabilities.deposits_liability.label',
    evidence: {
      sources: [
        'packages/validation/src/schemas/universal-core/order-deposit.domain.ts',
        'backend/src/services/sales/order-deposit.service.ts',
        'packages/local-engine/src/routes/order-deposits.ts',
        'packages/ui/src/components/ui/invoices/containers/advances-container.tsx',
      ],
      tests: ['backend/src/__tests__/order-deposit-liability.test.ts'],
    },
    ...STANDALONE,
    limitations: ['DEPOSIT_AUTO_FORFEIT_NOT_WIRED'],
  },
  installments: {
    key: 'installments',
    status: 'partial',
    engine: 'deposits_installments',
    labelKey: 'capabilities.installments.label',
    evidence: {
      sources: [
        'backend/src/services/commerce/installment.service.ts',
        'backend/src/routes/installments.routes.ts',
        'packages/local-engine/src/routes/installments.ts',
        'packages/api/src/hooks/installments.ts',
      ],
      tests: ['backend/src/__tests__/installment-service.test.ts'],
    },
    ...STANDALONE,
    limitations: ['AUTO_DUNNING_REMINDERS_SERVER_ONLY'],
  },
  package_credits: {
    key: 'package_credits',
    status: 'partial',
    engine: 'package_credits',
    labelKey: 'capabilities.package_credits.label',
    evidence: {
      sources: [
        'packages/validation/src/schemas/universal-core/package-credit-ledger.domain.ts',
        'backend/src/routes/package-credits.routes.ts',
        'packages/local-engine/src/routes/package-credits.ts',
        'packages/ui/src/components/ui/service-delivery/containers/service-delivery-container.tsx',
      ],
      tests: ['packages/validation/src/__tests__/universal-core.test.ts'],
    },
    ...STANDALONE,
    limitations: ['GRANT_ONLINE_ONLY'],
  },
  delivery_pod: {
    key: 'delivery_pod',
    status: 'partial',
    engine: 'delivery_logistics',
    labelKey: 'capabilities.delivery_pod.label',
    evidence: {
      sources: [
        'backend/src/services/transport/transport.service.ts',
        'backend/src/routes/transport.routes.ts',
      ],
      tests: ['backend/src/__tests__/storefront-orders.test.ts'],
    },
    ...STANDALONE,
    limitations: ['SERVER_ONLY_NO_OFFLINE_ENGINE'],
  },
  fleet_dispatch: {
    key: 'fleet_dispatch',
    status: 'partial',
    engine: 'delivery_logistics',
    labelKey: 'capabilities.fleet_dispatch.label',
    evidence: {
      sources: [
        'backend/src/services/transport/transport.service.ts',
        'backend/src/routes/transport.routes.ts',
      ],
      tests: ['backend/src/__tests__/storefront-orders.test.ts'],
    },
    ...STANDALONE,
    limitations: ['SERVER_ONLY_NO_OFFLINE_ENGINE'],
  },
  asset_rental: {
    key: 'asset_rental',
    status: 'planned',
    engine: null,
    labelKey: 'capabilities.asset_rental.label',
    evidence: NO_EVIDENCE,
    ...STANDALONE,
  },
  quality_inspection: {
    key: 'quality_inspection',
    status: 'partial',
    engine: 'quality_claims',
    labelKey: 'capabilities.quality_inspection.label',
    evidence: {
      sources: [
        'packages/validation/src/schemas/quality.ts',
        'backend/src/services/quality/quality.service.ts',
        'backend/src/routes/quality.routes.ts',
        'packages/api/src/hooks/quality.ts',
      ],
      tests: [
        'backend/src/__tests__/quality-warranty-chain.test.ts',
        'backend/src/__tests__/quality-events-01.pg.test.ts',
      ],
    },
    ...STANDALONE,
    limitations: ['SERVER_ONLY_QUALITY_LOG'],
  },
  warranty_claims: {
    key: 'warranty_claims',
    status: 'partial',
    engine: 'quality_claims',
    labelKey: 'capabilities.warranty_claims.label',
    evidence: {
      sources: [
        'packages/validation/src/schemas/universal-core/warranty.domain.ts',
        'backend/src/services/sales/warranty.service.ts',
        'backend/src/services/quality/quality.service.ts',
        'packages/local-engine/src/routes/warranties.ts',
        'packages/ui/src/components/ui/invoices/warranties-section.tsx',
      ],
      tests: [
        'packages/validation/src/__tests__/universal-core.test.ts',
        'backend/src/__tests__/quality-warranty-chain.test.ts',
      ],
    },
    ...STANDALONE,
    limitations: ['CLAIMS_ONLINE_ONLY'],
  },
  cost_allocation: {
    key: 'cost_allocation',
    status: 'partial',
    engine: 'costing_ledger',
    labelKey: 'capabilities.cost_allocation.label',
    evidence: {
      sources: [
        'backend/src/services/dimensions/dimension.domain.ts',
        'backend/src/services/accounting/profit-report.domain.ts',
        'backend/src/services/accounting.service.ts',
      ],
      tests: ['backend/src/__tests__/profit-report.test.ts'],
    },
    ...STANDALONE,
    limitations: ['OVERHEAD_ALLOCATION_NOT_CONFIGURED'],
  },
  approval_workflow: {
    key: 'approval_workflow',
    status: 'partial',
    engine: 'approvals_workflow',
    labelKey: 'capabilities.approval_workflow.label',
    evidence: {
      sources: [
        'backend/src/services/workflow/approval-gate.domain.ts',
        'backend/src/services/workflow.service.ts',
        'packages/api/src/hooks/use-workflow.ts',
        'packages/ui/src/components/ui/workflow/containers/approvals-container.tsx',
      ],
      tests: ['backend/src/__tests__/approval-gate.test.ts'],
    },
    ...STANDALONE,
    limitations: ['PROCUREMENT_MATCH_APPROVAL_GATE_PARTIAL'],
  },
  owner_forecast: {
    key: 'owner_forecast',
    status: 'partial',
    engine: 'forecast_insights',
    labelKey: 'capabilities.owner_forecast.label',
    evidence: {
      sources: [
        'backend/src/services/intelligence/forecast.domain.ts',
        'backend/src/services/intelligence/forecast.service.ts',
        'backend/src/services/analytics/dashboard-visibility.domain.ts',
        'packages/ui/src/components/ui/dashboard/DashboardRegistry.ts',
        'packages/ui/src/components/ui/dashboard/owner-command-center.tsx',
      ],
      tests: [
        'backend/src/__tests__/forecast-followup.test.ts',
        'backend/src/__tests__/owner-command-center.test.ts',
        'packages/ui/src/__tests__/owner-command-center-ui.test.ts',
      ],
    },
    ...STANDALONE,
    limitations: ['FORECAST_HORIZON_FIXED', 'REQUIRES_OBSERVED_PAYMENT_HISTORY'],
  },
  livestock_register: {
    key: 'livestock_register',
    status: 'planned',
    engine: null,
    labelKey: 'capabilities.livestock_register.label',
    evidence: NO_EVIDENCE,
    ...STANDALONE,
  },
  crop_cycle: {
    key: 'crop_cycle',
    status: 'planned',
    engine: null,
    labelKey: 'capabilities.crop_cycle.label',
    evidence: NO_EVIDENCE,
    ...STANDALONE,
  },
  room_nights: {
    key: 'room_nights',
    status: 'planned',
    engine: null,
    labelKey: 'capabilities.room_nights.label',
    evidence: NO_EVIDENCE,
    ...STANDALONE,
  },
}

/** Capabilities whose whole chain is usable — the only ones that may be advertised as complete. */
export const AVAILABLE_CAPABILITIES: readonly CapabilityKey[] = CAPABILITY_KEYS.filter(
  (key) => CAPABILITIES[key].status === 'available',
)

/** Capabilities a profile may switch on: complete ones plus honest partial ones. */
export const USABLE_CAPABILITIES: readonly CapabilityKey[] = CAPABILITY_KEYS.filter(
  (key) => CAPABILITIES[key].status !== 'planned',
)

export function isAvailableCapability(key: string): key is CapabilityKey {
  return key in CAPABILITIES && CAPABILITIES[key as CapabilityKey].status === 'available'
}

export function isUsableCapability(key: string): key is CapabilityKey {
  return key in CAPABILITIES && CAPABILITIES[key as CapabilityKey].status !== 'planned'
}

// ─────────────────────────────────────────────────────────────────────────────
// Composition — ONE deterministic resolver for "which capabilities are really on"
// ─────────────────────────────────────────────────────────────────────────────

export type CapabilityRegistry = Readonly<Record<CapabilityKey, CapabilityDefinition>>

export type CapabilityDiagnosticCode =
  /** Asked for a key the registry does not have. */
  | 'UNKNOWN_CAPABILITY'
  /** Asked for a capability that is `planned`. */
  | 'CAPABILITY_PLANNED'
  /** Switched on only because another capability needs it. */
  | 'DEPENDENCY_ADDED'
  /** A required capability is planned or missing, so the dependent stays off. */
  | 'DEPENDENCY_UNUSABLE'
  /** A required capability is older than the dependent was written against. */
  | 'DEPENDENCY_VERSION'
  | 'DEPENDENCY_CYCLE'
  /** Two capabilities that must not coexist; the later in registry order is off. */
  | 'CONFLICT'

export interface CapabilityDiagnostic {
  readonly code: CapabilityDiagnosticCode
  /** The capability the diagnostic is about (a raw string for UNKNOWN_CAPABILITY). */
  readonly capability: string
  /** The other capabilities involved, in a stable order. */
  readonly related: readonly string[]
}

export interface CapabilityResolution {
  /** Every capability that is really on (available + partial), in registry order. */
  readonly capabilities: readonly CapabilityKey[]
  /** The subset of `capabilities` that is only partially implemented. */
  readonly partial: readonly CapabilityKey[]
  /** Requested capabilities that are NOT on, in registry order. */
  readonly rejected: readonly CapabilityKey[]
  readonly diagnostics: readonly CapabilityDiagnostic[]
}

interface Failure {
  readonly code: CapabilityDiagnosticCode
  readonly related: readonly string[]
}

function closureOf(
  root: CapabilityKey,
  registry: CapabilityRegistry,
): { readonly keys: ReadonlySet<CapabilityKey> } | Failure {
  const keys = new Set<CapabilityKey>()

  const visit = (key: CapabilityKey, path: readonly CapabilityKey[]): Failure | null => {
    if (path.includes(key)) {
      return { code: 'DEPENDENCY_CYCLE', related: [...path.slice(path.indexOf(key)), key] }
    }
    const definition = registry[key]
    if (definition.status === 'planned') {
      return {
        code: path.length === 0 ? 'CAPABILITY_PLANNED' : 'DEPENDENCY_UNUSABLE',
        related: [key],
      }
    }
    for (const requirement of definition.requires) {
      const dependency = registry[requirement.key]
      if (dependency.version < requirement.minVersion) {
        return { code: 'DEPENDENCY_VERSION', related: [requirement.key] }
      }
      const failure = visit(requirement.key, [...path, key])
      if (failure) return failure
    }
    keys.add(key)
    return null
  }

  const failure = visit(root, [])
  return failure ?? { keys }
}

function conflictsBetween(a: CapabilityKey, b: CapabilityKey, registry: CapabilityRegistry) {
  return registry[a].conflicts.includes(b) || registry[b].conflicts.includes(a)
}

/**
 * Decide which of the requested capabilities are really on.
 *
 * Pure and deterministic: the answer depends only on the SET requested, never
 * on its order, and every output is in registry order. Nothing is switched on
 * silently — a capability that is on only because another needs it is reported
 * as DEPENDENCY_ADDED, and everything that is refused says why.
 */
export function resolveCapabilities(
  requested: readonly string[],
  registry: CapabilityRegistry = CAPABILITIES,
): CapabilityResolution {
  const diagnostics: CapabilityDiagnostic[] = []

  const unknown = [...new Set(requested.filter((key) => !(key in registry)))].sort()
  for (const key of unknown)
    diagnostics.push({ code: 'UNKNOWN_CAPABILITY', capability: key, related: [] })

  const roots = CAPABILITY_KEYS.filter((key) => requested.includes(key))
  const accepted = new Map<CapabilityKey, ReadonlySet<CapabilityKey>>()
  const rejected = new Set<CapabilityKey>()

  for (const root of roots) {
    const outcome = closureOf(root, registry)
    if ('keys' in outcome) {
      accepted.set(root, outcome.keys)
    } else {
      rejected.add(root)
      diagnostics.push({ code: outcome.code, capability: root, related: outcome.related })
    }
  }

  // Remove conflicting pairs until none is left. The earlier capability in
  // registry order wins; every root that needs the loser goes with it.
  for (;;) {
    const union = new Set<CapabilityKey>([...accepted.values()].flatMap((set) => [...set]))
    const present = CAPABILITY_KEYS.filter((key) => union.has(key))
    let pair: readonly [CapabilityKey, CapabilityKey] | null = null
    for (let i = 0; i < present.length && !pair; i += 1) {
      for (let j = i + 1; j < present.length && !pair; j += 1) {
        if (conflictsBetween(present[i]!, present[j]!, registry)) pair = [present[i]!, present[j]!]
      }
    }
    if (!pair) break
    const [winner, loser] = pair
    for (const [root, keys] of [...accepted]) {
      if (!keys.has(loser)) continue
      accepted.delete(root)
      rejected.add(root)
      diagnostics.push({ code: 'CONFLICT', capability: root, related: [winner, loser] })
    }
  }

  const on = new Set<CapabilityKey>([...accepted.values()].flatMap((set) => [...set]))
  const capabilities = CAPABILITY_KEYS.filter((key) => on.has(key))

  for (const key of capabilities) {
    if (roots.includes(key)) continue
    const neededBy = [...accepted].filter(([, keys]) => keys.has(key)).map(([root]) => root)
    diagnostics.push({ code: 'DEPENDENCY_ADDED', capability: key, related: neededBy })
  }

  return {
    capabilities,
    partial: capabilities.filter((key) => registry[key].status === 'partial'),
    rejected: CAPABILITY_KEYS.filter((key) => rejected.has(key)),
    diagnostics,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry integrity — what the guard test holds the registry to
// ─────────────────────────────────────────────────────────────────────────────

export type CapabilityRegistryIssueCode =
  | 'KEY_MISMATCH'
  | 'VERSION_INVALID'
  | 'SELF_REQUIREMENT'
  | 'UNKNOWN_REQUIREMENT'
  | 'REQUIREMENT_VERSION_INVALID'
  | 'REQUIREMENT_VERSION_AHEAD'
  | 'UNKNOWN_CONFLICT'
  | 'SELF_CONFLICT'
  | 'REQUIRED_AND_CONFLICTING'
  | 'DEPENDENCY_CYCLE'
  | 'STATUS_ORDER'
  | 'LIMITATIONS_MISMATCH'
  | 'EVIDENCE_MISMATCH'

export interface CapabilityRegistryIssue {
  readonly code: CapabilityRegistryIssueCode
  readonly capability: CapabilityKey
  readonly detail: string
}

const STATUS_RANK: Readonly<Record<CapabilityStatus, number>> = {
  available: 2,
  partial: 1,
  planned: 0,
}

/**
 * Every structural fault in a registry, in a stable order. An empty list is
 * the only acceptable answer for the real registry (guard test).
 */
export function validateCapabilityRegistry(
  registry: CapabilityRegistry = CAPABILITIES,
): readonly CapabilityRegistryIssue[] {
  const issues: CapabilityRegistryIssue[] = []
  const add = (code: CapabilityRegistryIssueCode, capability: CapabilityKey, detail: string) =>
    issues.push({ code, capability, detail })
  const known = new Set<string>(CAPABILITY_KEYS)

  for (const key of CAPABILITY_KEYS) {
    const definition = registry[key]
    if (definition.key !== key) add('KEY_MISMATCH', key, definition.key)
    if (!Number.isInteger(definition.version) || definition.version < 1) {
      add('VERSION_INVALID', key, String(definition.version))
    }

    for (const requirement of definition.requires) {
      if (requirement.key === key) add('SELF_REQUIREMENT', key, requirement.key)
      else if (!known.has(requirement.key)) add('UNKNOWN_REQUIREMENT', key, requirement.key)
      else {
        const dependency = registry[requirement.key]
        if (!Number.isInteger(requirement.minVersion) || requirement.minVersion < 1) {
          add('REQUIREMENT_VERSION_INVALID', key, `${requirement.key}@${requirement.minVersion}`)
        } else if (dependency.version < requirement.minVersion) {
          add('REQUIREMENT_VERSION_AHEAD', key, `${requirement.key}@${requirement.minVersion}`)
        }
        if (
          definition.status !== 'planned' &&
          STATUS_RANK[dependency.status] < STATUS_RANK[definition.status]
        ) {
          add(
            'STATUS_ORDER',
            key,
            `${key} is ${definition.status} but needs ${dependency.status} ${requirement.key}`,
          )
        }
        if (definition.conflicts.includes(requirement.key) || dependency.conflicts.includes(key)) {
          add('REQUIRED_AND_CONFLICTING', key, requirement.key)
        }
      }
    }

    for (const other of definition.conflicts) {
      if (other === key) add('SELF_CONFLICT', key, other)
      else if (!known.has(other)) add('UNKNOWN_CONFLICT', key, other)
    }

    const hasLimitations = definition.limitations.length > 0
    if (hasLimitations !== (definition.status === 'partial')) {
      add('LIMITATIONS_MISMATCH', key, definition.status)
    }

    const hasEvidence =
      definition.evidence.sources.length > 0 || definition.evidence.tests.length > 0
    if (hasEvidence !== (definition.status !== 'planned')) {
      add('EVIDENCE_MISMATCH', key, definition.status)
    }
  }

  // Cycles: a depth-first walk that remembers the path.
  const settled = new Set<CapabilityKey>()
  const walk = (key: CapabilityKey, path: readonly CapabilityKey[]): void => {
    if (path.includes(key)) {
      add('DEPENDENCY_CYCLE', key, [...path.slice(path.indexOf(key)), key].join(' → '))
      return
    }
    if (settled.has(key)) return
    for (const requirement of registry[key].requires) {
      if (known.has(requirement.key) && requirement.key !== key)
        walk(requirement.key, [...path, key])
    }
    settled.add(key)
  }
  for (const key of CAPABILITY_KEYS) walk(key, [])

  return issues
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified Module Activation & Capability-Entitlement-Permission Gate (W2/W3)
// ─────────────────────────────────────────────────────────────────────────────

export interface ModuleActivationSignals {
  readonly offering?: readonly string[] | undefined
  readonly intake?: readonly string[] | undefined
  readonly inventory?: readonly string[] | undefined
  readonly settlement?: readonly string[] | undefined
  readonly workforce?: readonly string[] | undefined
  readonly topology?: readonly string[] | undefined
  readonly unitTracking?: string | undefined
  readonly pricingBasis?: readonly string[] | undefined
  readonly assetCustody?: string | undefined
  readonly executionSite?: string | undefined
  readonly recurrence?: string | undefined
  readonly approvalDepth?: string | undefined
  readonly regulatedDomain?: string | undefined
}

export interface UnifiedCapabilityPlan {
  readonly capabilities: CapabilityResolution
  readonly activeModules: readonly string[]
}

/**
 * Single pure module & capability derivation from normalized operational signals.
 * Both `resolveDnaCapabilities` and profile adapters delegate here so module lists
 * never diverge across resolvers.
 */
export function resolveCapabilityPlan(
  signals: ModuleActivationSignals,
  extraRequestedCapabilities: readonly string[] = [],
  registry: CapabilityRegistry = CAPABILITIES,
): UnifiedCapabilityPlan {
  const requested = new Set<string>(extraRequestedCapabilities)
  const activeModules = new Set<string>(['accounting', 'invoices', 'customers'])

  const offering = signals.offering ?? []
  const intake = signals.intake ?? []
  const inventory = signals.inventory ?? []
  const settlement = signals.settlement ?? []
  const workforce = signals.workforce ?? []
  const topology = signals.topology ?? []

  if (offering.includes('PHYSICAL_GOODS') || offering.includes('MIXED_OFFERING')) {
    activeModules.add('products')
    requested.add('measurement')
    requested.add('multi_unit')
  }
  if (offering.includes('TIME_SERVICE') || offering.includes('PACKAGE_SESSION')) {
    activeModules.add('services')
  }

  if (intake.includes('COUNTER_POS')) activeModules.add('pos')
  if (intake.includes('APPOINTMENT_BOOKING')) activeModules.add('appointments')
  if (intake.includes('CLASS_ATTENDANCE')) activeModules.add('attendance')
  if (intake.includes('JOB_TICKET')) {
    activeModules.add('job_tickets')
    requested.add('auto_fitments')
    requested.add('serialized_items')
  }

  if (
    inventory.includes('RETAIL_STOCK') ||
    inventory.includes('SPARE_PARTS') ||
    inventory.includes('RAW_MATERIALS') ||
    inventory.includes('FINISHED_GOODS') ||
    inventory.includes('HYBRID_INVENTORY')
  ) {
    activeModules.add('inventory')
    activeModules.add('warehouse')
    requested.add('variants')
  }
  if (inventory.includes('RAW_MATERIALS')) {
    requested.add('recipe_bom')
    requested.add('batch_expiry')
  }
  if (inventory.includes('SERVICE_CONSUMABLES')) {
    activeModules.add('consumables')
  }

  if (signals.unitTracking === 'SERIAL_NUMBERS' || signals.unitTracking === 'BOTH') {
    requested.add('serialized_items')
  }
  if (signals.unitTracking === 'EXPIRY_DATES' || signals.unitTracking === 'BOTH') {
    requested.add('batch_expiry')
  }

  if (settlement.includes('DEPOSIT_PREPAYMENT')) activeModules.add('order_deposits')
  if (settlement.includes('PACKAGE_CREDITS')) activeModules.add('package_credits')

  // Unknown workforce remains unresolved; only explicit staffed models activate team/payroll.
  if (workforce.length > 0 && !workforce.every((w) => w === 'SOLO_OWNER' || w === 'UNRESOLVED')) {
    activeModules.add('team')
    activeModules.add('payroll')
  }

  if (topology.includes('MULTI_BRANCH') || topology.includes('WAREHOUSE_NETWORK')) {
    activeModules.add('branches')
  }

  // V60 Axes 10–15: orthogonal signals mapped deterministically; regulatedDomain NEVER grants capabilities.
  const pricingBasis = signals.pricingBasis ?? []
  if (pricingBasis.includes('WEIGHT')) requested.add('weight_pricing')
  if (pricingBasis.includes('LENGTH')) requested.add('length_pricing')
  if (pricingBasis.includes('AREA')) requested.add('area_pricing')
  if (pricingBasis.includes('VOLUME')) requested.add('volume_pricing')
  if (pricingBasis.includes('TIERED')) requested.add('tiered_pricing')
  if (pricingBasis.includes('RATE_BOARD')) requested.add('multi_currency')

  if (intake.includes('JOB_TICKET')) {
    requested.add('work_queue_sla')
  }
  if (intake.includes('PROJECT_DELIVERY')) {
    requested.add('project_costing')
    requested.add('timesheet_billing')
  }
  if (settlement.includes('DEPOSIT_PREPAYMENT')) requested.add('deposits_liability')
  if (settlement.includes('INSTALLMENT_RECEIVABLES')) requested.add('installments')
  if (settlement.includes('PACKAGE_CREDITS')) requested.add('package_credits')

  if (signals.assetCustody === 'CUSTOMER_ASSET_IN_CUSTODY') {
    activeModules.add('job_tickets')
    requested.add('serialized_items')
    requested.add('work_queue_sla')
  } else if (signals.assetCustody === 'RENTED_OUT_ASSET') {
    activeModules.add('resources')
    requested.add('asset_rental')
  }

  if (signals.executionSite === 'CUSTOMER_SITE') {
    activeModules.add('delivery')
    requested.add('delivery_pod')
  } else if (signals.executionSite === 'MOBILE_ROUTE') {
    activeModules.add('delivery')
    requested.add('delivery_pod')
    requested.add('fleet_dispatch')
  }

  if (
    signals.recurrence === 'RECURRING_SERVICE' ||
    signals.recurrence === 'SUBSCRIPTION' ||
    signals.recurrence === 'LEASE'
  ) {
    activeModules.add('contracts')
    requested.add('contracts_recurring')
  }

  if (signals.approvalDepth === 'SINGLE' || signals.approvalDepth === 'MULTI_STEP') {
    activeModules.add('approvals')
    requested.add('approval_workflow')
  }

  return {
    capabilities: resolveCapabilities([...requested], registry),
    activeModules: [...activeModules],
  }
}

export interface FeatureAccessEvaluationInput {
  /** Capabilities turned on for the workspace business profile. */
  readonly enabledCapabilities: readonly CapabilityKey[]
  /** Optional business capability required by this action. */
  readonly capabilityKey?: CapabilityKey | undefined
  /** Plan entitlement decision (`resolveEntitlement` result kind). */
  readonly entitlementKind:
    'AVAILABLE' | 'REQUIRES_ONLINE' | 'NOT_ENTITLED' | 'REQUIRES_UPGRADE' | 'EXHAUSTED' | 'EXPIRED'
  /** Permission capabilities held by the acting user (`request.tenancy` / `/me/capabilities`). */
  readonly grantedPermissions: readonly string[]
  /** Required role permission capability (e.g. `'payroll.write'`). */
  readonly requiredPermission?: string | undefined
  readonly registry?: CapabilityRegistry | undefined
}

export interface FeatureAccessEvaluation {
  readonly allowed: boolean
  readonly blockedBy: 'capability' | 'entitlement' | 'permission' | null
  readonly capabilityStatus: CapabilityStatus | null
  readonly limitations: readonly string[]
  readonly partial: boolean
}

/**
 * Evaluates capability (business fit & maturity) vs entitlement (plan) vs
 * permission (actor role) as strictly independent axes (W3).
 *
 * - Neither plan nor role can turn on a `planned` capability.
 * - `partial` capabilities remain honestly marked with `limitations`.
 * - Business profile / entitlement never grant user permissions.
 */
export function evaluateFeatureAccess(
  input: FeatureAccessEvaluationInput,
): FeatureAccessEvaluation {
  const reg = input.registry ?? CAPABILITIES
  const def = input.capabilityKey ? reg[input.capabilityKey] : undefined
  const capStatus = def?.status ?? null
  const limitations = def?.limitations ?? []
  const partial = capStatus === 'partial'

  if (input.capabilityKey) {
    if (
      !def ||
      def.status === 'planned' ||
      !input.enabledCapabilities.includes(input.capabilityKey)
    ) {
      return {
        allowed: false,
        blockedBy: 'capability',
        capabilityStatus: capStatus,
        limitations,
        partial,
      }
    }
  }

  if (input.entitlementKind !== 'AVAILABLE') {
    return {
      allowed: false,
      blockedBy: 'entitlement',
      capabilityStatus: capStatus,
      limitations,
      partial,
    }
  }

  if (input.requiredPermission && !input.grantedPermissions.includes(input.requiredPermission)) {
    return {
      allowed: false,
      blockedBy: 'permission',
      capabilityStatus: capStatus,
      limitations,
      partial,
    }
  }

  return {
    allowed: true,
    blockedBy: null,
    capabilityStatus: capStatus,
    limitations,
    partial,
  }
}
