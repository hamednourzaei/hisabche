// ============================================
// packages/validation/src/__tests__/operational-dna.test.ts
//
// V54.0 Phase 5.2 & 5.3 Tests
// Validates 8-axis Operational DNA, Archetype Presets & Inference Resolver
// ============================================

import { describe, expect, it } from 'vitest'
import {
  ARCHETYPE_PRESETS,
  operationalDnaSchema,
  resolveDnaCapabilities,
  inferOperationalDna,
} from '../schemas/operational-dna'

describe('Operational DNA (8 Axes) & Resolver', () => {
  it('validates canonical archetype presets against operationalDnaSchema', () => {
    for (const [key, preset] of Object.entries(ARCHETYPE_PRESETS)) {
      const parsed = operationalDnaSchema.parse(preset)
      expect(parsed.version).toBe(1)
      expect(parsed.offering.length).toBeGreaterThan(0)
      expect(parsed.archetypeHint).toBe(key)
    }
  })

  it('resolves NAIL_TECH_BEAUTY DNA without checking industry string in financial core', () => {
    const preset = ARCHETYPE_PRESETS.NAIL_TECH_BEAUTY!
    const resolved = resolveDnaCapabilities(preset)

    // Intake: APPOINTMENT_BOOKING + WALK_IN
    expect(resolved.activeModules).toContain('appointments')

    // Settlement: DEPOSIT_PREPAYMENT
    expect(resolved.activeModules).toContain('order_deposits')

    // Inventory: SERVICE_CONSUMABLES + RETAIL_STOCK
    expect(resolved.activeModules).toContain('consumables')
    expect(resolved.activeModules).toContain('inventory')

    // Terminology: client, service, appointment
    expect(resolved.terminology.partyLabelKey).toBe('common.client')
    expect(resolved.terminology.itemLabelKey).toBe('common.service')
  })

  it('resolves LANGUAGE_TEACHER DNA into package_credits and class attendance', () => {
    const preset = ARCHETYPE_PRESETS.LANGUAGE_TEACHER!
    const resolved = resolveDnaCapabilities(preset)

    expect(resolved.activeModules).toContain('attendance')
    expect(resolved.activeModules).toContain('package_credits')
    expect(resolved.activeModules).not.toContain('inventory')
    expect(resolved.terminology.partyLabelKey).toBe('common.student')
  })

  it('resolves SERVICE_REPAIR DNA into job tickets and spare parts', () => {
    const preset = ARCHETYPE_PRESETS.SERVICE_REPAIR!
    const resolved = resolveDnaCapabilities(preset)

    expect(resolved.activeModules).toContain('job_tickets')
    expect(resolved.activeModules).toContain('order_deposits')
    expect(resolved.activeModules).toContain('warehouse')
    expect(resolved.capabilities.capabilities).toContain('auto_fitments')
  })

  it('infers DNA dynamically from operational characteristics instead of trade name alone', () => {
    // 1. A service salon that takes appointments and uses consumables
    const salonDna = inferOperationalDna({
      takesAppointments: 'yes',
      holdsStock: 'yes',
      hasStaff: 'yes',
    })
    expect(salonDna.offering).toContain('TIME_SERVICE')
    expect(salonDna.intake).toContain('APPOINTMENT_BOOKING')
    expect(salonDna.inventory).toContain('SERVICE_CONSUMABLES')
    expect(salonDna.workforce).toContain('HOURLY_STAFF')
    expect(salonDna.archetypeHint).toBe('NAIL_TECH_BEAUTY')

    // 2. An education center that teaches courses with packages
    const eduDna = inferOperationalDna({
      deliversCoursesOrPackages: 'yes',
      holdsStock: 'no',
    })
    expect(eduDna.offering).toContain('PACKAGE_SESSION')
    expect(eduDna.intake).toContain('CLASS_ATTENDANCE')
    expect(eduDna.inventory).toContain('NONE')
    expect(eduDna.settlement).toContain('PACKAGE_CREDITS')
    expect(eduDna.archetypeHint).toBe('LANGUAGE_TEACHER')

    // 3. A pure generic/unknown service business with NO stock and NO appointments
    const genericDna = inferOperationalDna({
      holdsStock: 'no',
      takesAppointments: 'no',
    })
    expect(genericDna.inventory).toContain('NONE')
    expect(genericDna.intake).toContain('WALK_IN')
    expect(genericDna.archetypeHint).toBe('GENERIC_BUSINESS')
    expect(genericDna.archetypeHint).not.toBe('RETAIL_STORE')
  })
})
