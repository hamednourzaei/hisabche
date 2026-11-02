// ============================================
// «When a plan ends, the WRITES stop and the records stay readable» — checked against the whole registry.
//
// `resolveEntitlement` already has the rule (alwaysAllowed → AVAILABLE in the expired / banned / exhausted states).
// What was never checked is that the REGISTRY says it for every feature that only reads, and that a feature marked
// «always allowed» does not also carry a write the rule would then let through.
//
//   1. a feature whose every endpoint is a GET is alwaysAllowed, or is in the closed list of reads that are metered or
//      derived (AI, benchmarks, growth) — with a reason. The invoice LIST was neither: the detail opened and the list
//      did not, the moment a plan ended.
//   2. a feature that is alwaysAllowed and ALSO has a POST/PUT/PATCH/DELETE endpoint lets that write through in the very
//      states meant to stop writes. One key, two meanings. The ledger names them; it can only shrink.
//   3. «always allowed» is never «runs on a device that cannot run it»: an offline device answers REQUIRES_ONLINE for a
//      server-only feature in EVERY state, not AVAILABLE followed by a 501.
// ============================================

import { describe, expect, it } from 'vitest'
import { resolveEntitlement, type WorkspaceEntitlementState } from '../schemas/entitlement-resolver'
import { FEATURE_REGISTRY, type FeatureKey } from '../schemas/feature-registry'
import { OFFLINE_ENDPOINT_MATRIX } from '../schemas/offline-endpoint-matrix'

const registry = FEATURE_REGISTRY as Record<
  FeatureKey,
  { alwaysAllowed?: boolean; execution: string }
>

const methodsOf = new Map<string, Set<string>>()
for (const [route, [feature]] of Object.entries(OFFLINE_ENDPOINT_MATRIX)) {
  const set = methodsOf.get(feature) ?? new Set<string>()
  set.add(route.split(' ')[0]!)
  methodsOf.set(feature, set)
}

/** Reads that are NOT the business's own records: metered, derived or growth features. Owner decision to widen. */
const READ_BUT_NOT_ALWAYS: Readonly<Record<string, string>> = {
  'dashboard.ai_insight': 'AI call — metered',
  'ai.cashflow_forecast': 'AI call — metered',
  'dashboard.kpi': 'derived dashboard — NEEDS_OWNER_DECISION whether an ended plan keeps it',
  'dashboard.sales_chart':
    'derived dashboard — NEEDS_OWNER_DECISION whether an ended plan keeps it',
  'analysis.benchmark': 'compares with other businesses — a plan feature',
  'settings.currency_catalogue': "reference list of the platform, not the business's records",
  'referral.program': 'growth programme, not records',
  'sync.overview': 'the sync centre of a connected device — NEEDS_OWNER_DECISION',
}

/** Always-allowed features that ALSO have a write endpoint (the key means two things). NEEDS_OWNER_DECISION to split. */
const ALWAYS_WITH_A_WRITE = [
  'accounting.chart',
  'accounting.financing',
  'accounting.journal',
  'accounting.unvalued_stock',
  'activity.feed',
  'customer.crm',
  'customer.terms',
  'hr.attendance',
  'hr.leaves',
  'hr.payroll',
  'hr.shifts',
  'product.barcode',
  'settings.currencies',
  'settings.workspace_profile',
  'stock.placement',
  'stock.storage_locations',
]

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

describe('reads never stop', () => {
  it('a feature that only reads is alwaysAllowed, unless it is in the closed list with a reason', () => {
    const offenders = [...methodsOf]
      .filter(([, methods]) => [...methods].every((method) => method === 'GET'))
      .map(([feature]) => feature)
      .filter(
        (feature) =>
          registry[feature as FeatureKey] && !registry[feature as FeatureKey].alwaysAllowed,
      )
      .filter((feature) => !(feature in READ_BUT_NOT_ALWAYS))
    expect(offenders, 'these records stop being readable when a plan ends').toEqual([])
  })

  it('every line of the closed list is still a read-only feature that is not alwaysAllowed', () => {
    for (const feature of Object.keys(READ_BUT_NOT_ALWAYS)) {
      const methods = methodsOf.get(feature)
      expect(methods, feature).toBeDefined()
      expect(
        [...methods!].every((method) => method === 'GET'),
        feature,
      ).toBe(true)
      expect(registry[feature as FeatureKey].alwaysAllowed, feature).not.toBe(true)
    }
  })
})

describe('«always allowed» features that also write', () => {
  const found = () =>
    [...methodsOf]
      .filter(
        ([feature, methods]) =>
          registry[feature as FeatureKey]?.alwaysAllowed &&
          [...methods].some((m) => WRITE_METHODS.has(m)),
      )
      .map(([feature]) => feature)
      .sort()

  it('are exactly the ledger — a new one fails, a fixed one must leave the ledger', () => {
    expect(found()).toEqual([...ALWAYS_WITH_A_WRITE].sort())
  })
})

describe('the verdict of a device that cannot run the feature', () => {
  const STATES: WorkspaceEntitlementState[] = [
    'OFFLINE_ACTIVE',
    'OFFLINE_EXPIRED',
    'OFFLINE_BANNED',
    'FREE_EXHAUSTED',
  ]

  it('is REQUIRES_ONLINE for a server-only, always-allowed feature in every state — never AVAILABLE then a 501', () => {
    const serverReads = (Object.keys(registry) as FeatureKey[]).filter(
      (feature) => registry[feature].alwaysAllowed && registry[feature].execution === 'server',
    )
    const offenders: string[] = []
    for (const feature of serverReads) {
      for (const state of STATES) {
        const verdict = resolveEntitlement({ state, plan: 'FREE', edition: 'local' }, feature)
        if (verdict.kind === 'AVAILABLE') offenders.push(`${feature} @ ${state}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
