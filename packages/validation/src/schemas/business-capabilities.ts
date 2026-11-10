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
    status: 'planned',
    labelKey: 'capability.lengthPricing',
    evidence: NO_EVIDENCE,
    ...STANDALONE,
    requires: [needs('measurement')],
  },
  volume_pricing: {
    key: 'volume_pricing',
    status: 'planned',
    labelKey: 'capability.volumePricing',
    evidence: NO_EVIDENCE,
    ...STANDALONE,
    requires: [needs('measurement')],
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
    ...STANDALONE,
  },
  batch_expiry: {
    key: 'batch_expiry',
    status: 'partial',
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
    status: 'planned',
    labelKey: 'capability.recipeBom',
    evidence: NO_EVIDENCE,
    ...STANDALONE,
  },
  variants: {
    key: 'variants',
    status: 'partial',
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
    labelKey: 'capability.tableService',
    evidence: NO_EVIDENCE,
    ...STANDALONE,
  },
  serialized_items: {
    key: 'serialized_items',
    status: 'partial',
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
