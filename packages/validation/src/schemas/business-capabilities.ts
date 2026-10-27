// ============================================
// packages/validation/src/schemas/business-capabilities.ts
//
// Single source of truth for business capabilities.
//
// STATUS DISCIPLINE:
//   'available' — Capability has full implementation chain (shared rule,
//                 backend service, local engine, API hook, UI) and has passed
//                 golden vector and parity tests.
//   'planned'   — Capability is in development or waiting for full integration.
//                 Must not be advertised in active onboarding.
// ============================================

export const CAPABILITY_KEYS = [
  'measurement',
  'weight_pricing',
  'length_pricing',
  'volume_pricing',
  'multi_unit',
  'batch_expiry',
  'recipe_bom',
  'variants',
  'table_service',
  'serialized_items',
  'auto_fitments',
  'gold_purity',
  'making_charges',
] as const

export type CapabilityKey = (typeof CAPABILITY_KEYS)[number]

export type CapabilityStatus = 'available' | 'planned'

export interface CapabilityEvidence {
  sources: readonly string[]
  tests: readonly string[]
}

export interface CapabilityDefinition {
  key: CapabilityKey
  status: CapabilityStatus
  labelKey: string
  evidence: CapabilityEvidence
}

const NO_EVIDENCE: CapabilityEvidence = { sources: [], tests: [] }

export const CAPABILITIES: Record<CapabilityKey, CapabilityDefinition> = {
  measurement: {
    key: 'measurement',
    status: 'available',
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
  },
  weight_pricing: {
    key: 'weight_pricing',
    status: 'available',
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
  },
  length_pricing: {
    key: 'length_pricing',
    status: 'planned',
    labelKey: 'capability.lengthPricing',
    evidence: NO_EVIDENCE,
  },
  volume_pricing: {
    key: 'volume_pricing',
    status: 'planned',
    labelKey: 'capability.volumePricing',
    evidence: NO_EVIDENCE,
  },
  multi_unit: {
    key: 'multi_unit',
    status: 'available',
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
  },
  batch_expiry: {
    key: 'batch_expiry',
    status: 'planned',
    labelKey: 'capability.batchExpiry',
    evidence: NO_EVIDENCE,
  },
  recipe_bom: {
    key: 'recipe_bom',
    status: 'planned',
    labelKey: 'capability.recipeBom',
    evidence: NO_EVIDENCE,
  },
  variants: {
    key: 'variants',
    status: 'available',
    labelKey: 'capability.variants',
    evidence: {
      sources: [
        'packages/validation/src/schemas/universal-core/variants.domain.ts',
        'backend/src/services/product/variant.service.ts',
        'backend/src/routes/variant.routes.ts',
        'packages/local-engine/src/routes/variants.ts',
        'packages/api/src/hooks/universal-core.ts',
        'packages/ui/src/components/ui/warehouse/product-variants-section.tsx',
        'packages/ui/src/components/ui/warehouse-detail/containers/warehouse-detail-container.tsx',
      ],
      tests: [
        'packages/validation/src/__tests__/universal-core.test.ts',
        'packages/local-engine/src/__tests__/migration-v9.test.ts',
        'packages/local-engine/src/__tests__/universal-core-parity.test.ts',
      ],
    },
  },
  table_service: {
    key: 'table_service',
    status: 'planned',
    labelKey: 'capability.tableService',
    evidence: NO_EVIDENCE,
  },
  serialized_items: {
    key: 'serialized_items',
    status: 'available',
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
  },
  auto_fitments: {
    key: 'auto_fitments',
    status: 'available',
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
  },
  gold_purity: {
    key: 'gold_purity',
    status: 'available',
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
  },
  making_charges: {
    key: 'making_charges',
    status: 'available',
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
  },
}

/** Capabilities the product can honestly advertise and switch on. */
export const AVAILABLE_CAPABILITIES: readonly CapabilityKey[] = CAPABILITY_KEYS.filter(
  (key) => CAPABILITIES[key].status === 'available',
)

export function isAvailableCapability(key: string): key is CapabilityKey {
  return key in CAPABILITIES && CAPABILITIES[key as CapabilityKey].status === 'available'
}
