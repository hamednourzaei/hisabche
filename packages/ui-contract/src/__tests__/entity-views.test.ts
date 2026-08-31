// ============================================
// Which views and sections an entity actually has.
//
// Held to the same standard as NAV_CONTRACT: an entry here that no screen
// renders is a lie in the contract, and an empty tab costs a click, teaches
// the user the app is unfinished, and has to be maintained anyway.
// ============================================

import { describe, expect, it } from 'vitest'

import { CAPABILITY_NAMES } from './capability-names'
import {
  DETAIL_SECTIONS,
  ENTITY_KINDS,
  ENTITY_SECTIONS,
  hasView,
  sectionRequiresCapability,
  sectionsFor,
  viewsFor,
  visibleSections,
} from '../entity-views'

describe('every entity is browsable and openable', () => {
  it.each(ENTITY_KINDS)('%s has at least list and detail', (entity) => {
    // An entity you cannot browse or open is not a business object.
    expect(hasView(entity, 'list')).toBe(true)
    expect(hasView(entity, 'detail')).toBe(true)
  })

  it('gives a payment no form — it is recorded or cancelled, never edited', () => {
    expect(hasView('payment', 'form')).toBe(false)
  })

  it('gives an invoice no board — its status is the ledger, not a stage', () => {
    // Dragging an invoice from `posted` back to `draft` is not something the
    // books permit, so offering the gesture would be a lie.
    expect(hasView('invoice', 'board')).toBe(false)
  })

  it('gives a project a board, because it genuinely has stages', () => {
    expect(hasView('project', 'board')).toBe(true)
  })

  it('claims no calendar, timeline or analytics view anywhere yet', () => {
    // These are in §6 and none of them is built. Naming them here before a
    // screen renders them is exactly the manufactured completeness §71.5
    // forbids.
    for (const entity of ENTITY_KINDS) {
      expect(viewsFor(entity)).not.toContain('calendar')
      expect(viewsFor(entity)).not.toContain('timeline')
      expect(viewsFor(entity)).not.toContain('analytics')
    }
  })
})

describe('detail sections', () => {
  it('keeps one order for every entity, so learning one page teaches them all', () => {
    for (const entity of ENTITY_KINDS) {
      const sections = sectionsFor(entity)
      const canonical = DETAIL_SECTIONS.filter((section) => sections.includes(section))
      expect(sections).toEqual(canonical)
    }
  })

  it('gives lines only to an invoice', () => {
    const withLines = ENTITY_KINDS.filter((entity) => ENTITY_SECTIONS[entity].includes('lines'))
    expect(withLines).toEqual(['invoice'])
  })

  it('never lists a section that is not in the canonical set', () => {
    for (const entity of ENTITY_KINDS) {
      for (const section of ENTITY_SECTIONS[entity]) {
        expect(DETAIL_SECTIONS).toContain(section)
      }
    }
  })
})

describe('capability-gated sections', () => {
  it('names only capabilities the server actually has', () => {
    // A gate naming a capability the backend does not know would never open,
    // and nobody would find out until a customer could not see their own
    // payroll.
    for (const entity of ENTITY_KINDS) {
      for (const section of sectionsFor(entity)) {
        const required = sectionRequiresCapability(entity, section)
        if (required !== null) expect(CAPABILITY_NAMES).toContain(required)
      }
    }
  })

  it('hides the cost of stock from someone without the capability', () => {
    // A seller sells at the sell price and has no reason to know the margin.
    const visible = visibleSections('product', ['product.read'])
    expect(visible).not.toContain('financial')
  })

  it('shows it once the capability is held', () => {
    const visible = visibleSections('product', ['inventory.cost.read'])
    expect(visible).toContain('financial')
  })

  it('never hides a section that has no gate', () => {
    expect(visibleSections('customer', [])).toContain('overview')
  })

  it('is a rendering hint, not the authorization', () => {
    // Documented so nobody later mistakes it for a security control: §1.8 —
    // hiding a tab is not security, and each endpoint enforces this itself.
    expect(sectionRequiresCapability('employee', 'financial')).toBe('report.financial.read')
  })
})
