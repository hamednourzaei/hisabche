// ============================================
// packages/validation/src/__tests__/capability-composition.test.ts
//
// V53 — the capability registry is a graph, and the profile resolver answers
// from that graph. These tests hold three things:
//
//   1. the REAL registry is structurally sound and says only what is true;
//   2. the resolver is deterministic and explains every refusal;
//   3. the effective business profile is built from the resolver, and is a
//      value nobody can edit.
//
// Faulty registries are built by patching the real one, so a fault cannot hide
// behind a hand-written fixture that drifts from the real shape.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  CAPABILITIES,
  CAPABILITY_KEYS,
  USABLE_CAPABILITIES,
  resolveCapabilities,
  validateCapabilityRegistry,
  type CapabilityDefinition,
  type CapabilityKey,
  type CapabilityRegistry,
} from '../schemas/business-capabilities'
import { INDUSTRY_KEYS, resolveBusinessProfile } from '../schemas/industry-profiles'

function registryWith(
  patch: Partial<Record<CapabilityKey, Partial<CapabilityDefinition>>>,
): CapabilityRegistry {
  return Object.fromEntries(
    CAPABILITY_KEYS.map((key) => [key, { ...CAPABILITIES[key], ...patch[key] }]),
  ) as CapabilityRegistry
}

const needs = (key: CapabilityKey, minVersion = 1) => ({ key, minVersion })

describe('the real capability registry', () => {
  it('has no structural fault', () => {
    expect(validateCapabilityRegistry()).toEqual([])
  })

  it('names, for every partial capability, what is missing — and only for those', () => {
    for (const key of CAPABILITY_KEYS) {
      const { status, limitations } = CAPABILITIES[key]
      expect(limitations.length > 0, key).toBe(status === 'partial')
    }
  })

  it('does not call the five audited overclaims complete', () => {
    for (const key of [
      'variants',
      'serialized_items',
      'auto_fitments',
      'gold_purity',
      'making_charges',
    ] as const) {
      expect(CAPABILITIES[key].status, key).toBe('partial')
    }
  })

  it('keeps the capabilities whose chain is whole', () => {
    expect(CAPABILITY_KEYS.filter((key) => CAPABILITIES[key].status === 'available')).toEqual([
      'measurement',
      'weight_pricing',
      'multi_unit',
    ])
  })
})

describe('validateCapabilityRegistry catches every kind of fault', () => {
  const codes = (registry: CapabilityRegistry) =>
    validateCapabilityRegistry(registry).map((issue) => issue.code)

  it('a dependency cycle', () => {
    const cyclic = registryWith({ measurement: { requires: [needs('weight_pricing')] } })
    expect(codes(cyclic)).toContain('DEPENDENCY_CYCLE')
  })

  it('a requirement on something that does not exist', () => {
    const ghost = registryWith({ measurement: { requires: [needs('ghost' as CapabilityKey)] } })
    expect(codes(ghost)).toContain('UNKNOWN_REQUIREMENT')
  })

  it('a requirement on itself', () => {
    expect(codes(registryWith({ measurement: { requires: [needs('measurement')] } }))).toContain(
      'SELF_REQUIREMENT',
    )
  })

  it('a complete capability that needs a partial one', () => {
    const weak = registryWith({ weight_pricing: { requires: [needs('variants')] } })
    expect(codes(weak)).toContain('STATUS_ORDER')
  })

  it('a partial capability with no stated limitation', () => {
    expect(codes(registryWith({ variants: { limitations: [] } }))).toContain('LIMITATIONS_MISMATCH')
  })

  it('an available capability that states a limitation', () => {
    expect(codes(registryWith({ measurement: { limitations: ['SOMETHING'] } }))).toContain(
      'LIMITATIONS_MISMATCH',
    )
  })

  it('a planned capability that carries evidence', () => {
    // recipe_bom is the planned fixture since V55 P1: batch_expiry became
    // partial (the FEFO workflow exists — traceability + warehouse receive).
    const lying = registryWith({
      recipe_bom: { evidence: { sources: ['a.ts'], tests: ['b.test.ts'] } },
    })
    expect(codes(lying)).toContain('EVIDENCE_MISMATCH')
  })

  it('a version that is not a positive integer, or a requirement ahead of its target', () => {
    expect(codes(registryWith({ measurement: { version: 0 } }))).toContain('VERSION_INVALID')
    expect(
      codes(registryWith({ weight_pricing: { requires: [needs('measurement', 2)] } })),
    ).toContain('REQUIREMENT_VERSION_AHEAD')
  })

  it('a capability that both requires and conflicts with the same one', () => {
    const both = registryWith({ weight_pricing: { conflicts: ['measurement'] } })
    expect(codes(both)).toContain('REQUIRED_AND_CONFLICTING')
  })
})

describe('resolveCapabilities', () => {
  it('switches on a dependency and says that it did', () => {
    const result = resolveCapabilities(['making_charges'])
    expect(result.capabilities).toEqual([
      'measurement',
      'weight_pricing',
      'gold_purity',
      'making_charges',
    ])
    expect(result.partial).toEqual(['gold_purity', 'making_charges'])
    expect(
      result.diagnostics
        .filter((entry) => entry.code === 'DEPENDENCY_ADDED')
        .map((e) => e.capability),
    ).toEqual(['measurement', 'weight_pricing', 'gold_purity'])
  })

  it('does not depend on the order or the repetition of the request', () => {
    const forward = resolveCapabilities(['making_charges', 'multi_unit', 'variants'])
    const backward = resolveCapabilities(['variants', 'multi_unit', 'making_charges', 'variants'])
    expect(backward).toEqual(forward)
  })

  it('refuses a planned capability and names it', () => {
    const result = resolveCapabilities(['recipe_bom', 'multi_unit'])
    expect(result.capabilities).toEqual(['multi_unit'])
    expect(result.rejected).toEqual(['recipe_bom'])
    expect(result.diagnostics).toContainEqual({
      code: 'CAPABILITY_PLANNED',
      capability: 'recipe_bom',
      related: ['recipe_bom'],
    })
  })

  it('reports a key the registry has never heard of, without crashing', () => {
    const result = resolveCapabilities(['ghost', 'measurement'])
    expect(result.capabilities).toEqual(['measurement'])
    expect(result.diagnostics).toContainEqual({
      code: 'UNKNOWN_CAPABILITY',
      capability: 'ghost',
      related: [],
    })
  })

  it('keeps a dependent off when what it needs is not usable', () => {
    const broken = registryWith({
      measurement: { status: 'planned', evidence: { sources: [], tests: [] } },
    })
    const result = resolveCapabilities(['weight_pricing'], broken)
    expect(result.capabilities).toEqual([])
    expect(result.rejected).toEqual(['weight_pricing'])
    expect(result.diagnostics).toContainEqual({
      code: 'DEPENDENCY_UNUSABLE',
      capability: 'weight_pricing',
      related: ['measurement'],
    })
  })

  it('refuses a version that is older than the dependent was written against', () => {
    const stale = registryWith({ weight_pricing: { requires: [needs('measurement', 2)] } })
    const result = resolveCapabilities(['weight_pricing'], stale)
    expect(result.capabilities).toEqual([])
    expect(result.diagnostics.map((entry) => entry.code)).toEqual(['DEPENDENCY_VERSION'])
  })

  it('survives a cycle in the registry by refusing what is in it', () => {
    const cyclic = registryWith({ measurement: { requires: [needs('weight_pricing')] } })
    const result = resolveCapabilities(['weight_pricing', 'multi_unit'], cyclic)
    expect(result.capabilities).toEqual(['multi_unit'])
    expect(result.rejected).toEqual(['weight_pricing'])
    expect(result.diagnostics[0]?.code).toBe('DEPENDENCY_CYCLE')
  })

  it('never switches on two capabilities that conflict — the earlier one wins, either way round', () => {
    const declaredOnTheWinner = registryWith({ variants: { conflicts: ['serialized_items'] } })
    const declaredOnTheLoser = registryWith({ serialized_items: { conflicts: ['variants'] } })
    for (const registry of [declaredOnTheWinner, declaredOnTheLoser]) {
      const result = resolveCapabilities(['serialized_items', 'variants'], registry)
      expect(result.capabilities).toEqual(['variants'])
      expect(result.rejected).toEqual(['serialized_items'])
      expect(result.diagnostics).toContainEqual({
        code: 'CONFLICT',
        capability: 'serialized_items',
        related: ['variants', 'serialized_items'],
      })
    }
  })

  it('drops everything a conflict loser dragged in, but keeps what was asked for separately', () => {
    const clash = registryWith({ making_charges: { conflicts: ['multi_unit'] } })
    const result = resolveCapabilities(['making_charges', 'multi_unit'], clash)
    expect(result.capabilities).toEqual(['multi_unit'])
    expect(result.rejected).toEqual(['making_charges'])
  })
})

describe('the effective business profile is built from the resolver', () => {
  it('a trade with only complete capabilities has nothing partial to confess', () => {
    const profile = resolveBusinessProfile(['jewellery'])
    expect(profile.capabilities).toEqual(['measurement', 'weight_pricing', 'multi_unit'])
    expect(profile.partialCapabilities).toEqual([])
    expect(profile.notes).not.toContain('industry.supportNote.partial')
  })

  it('a trade on a partial capability keeps it on and says it is not complete', () => {
    const profile = resolveBusinessProfile(['clothing'])
    expect(profile.capabilities).toEqual(['variants'])
    expect(profile.partialCapabilities).toEqual(['variants'])
    expect(profile.notes).toContain('industry.supportNote.partial')
  })

  it('a trade whose capability became real keeps it, and says it is not complete', () => {
    // The pharmacy's batch_expiry was planned at V54 and reported as
    // unsupported; the FEFO workflow exists since V55 P1, so the trade now
    // KEEPS it — partial, with the support note, never silently complete.
    const profile = resolveBusinessProfile(['pharmacy'])
    expect(profile.capabilities).toEqual(['multi_unit', 'batch_expiry'])
    expect(profile.partialCapabilities).toEqual(['batch_expiry'])
    expect(profile.unsupported).toEqual([])
    expect(profile.notes).toContain('industry.supportNote.partial')
  })

  it('gives the same answer however the trades were clicked', () => {
    const one = resolveBusinessProfile(['clothing', 'jewellery', 'pharmacy'])
    const two = resolveBusinessProfile(['pharmacy', 'jewellery', 'clothing', 'clothing'])
    expect(two).toEqual(one)
  })

  it('never switches on a planned capability, for any trade', () => {
    for (const key of INDUSTRY_KEYS) {
      for (const capability of resolveBusinessProfile([key]).capabilities) {
        expect(USABLE_CAPABILITIES, `${key} → ${capability}`).toContain(capability)
      }
    }
  })

  it('is a value: neither the profile nor anything inside it can be edited', () => {
    const profile = resolveBusinessProfile(['clothing'])
    expect(Object.isFrozen(profile)).toBe(true)
    expect(Object.isFrozen(profile.capabilities)).toBe(true)
    expect(Object.isFrozen(profile.primaryDefinition)).toBe(true)
    expect(Object.isFrozen(profile.primaryDefinition.productDefaults)).toBe(true)
    expect(() => (profile.capabilities as CapabilityKey[]).push('measurement')).toThrow(TypeError)
  })
})
