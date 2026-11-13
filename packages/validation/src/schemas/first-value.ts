// ============================================
// packages/validation/src/schemas/first-value.ts
//
// V65 · V64 §7 — the first-value guidance is derived from the DOMAIN, never
// from an industry switch in a component.
//
// The defect this replaces: `FirstValueChecklist` switched on `archetypeHint`
// and fell through to RETAIL for anything unknown, so a consultant was told to
// add a product and open the warehouse. A checklist step is also a promise: the
// destination must exist, the record it names must be the one that completes it,
// and a module that is not active must produce NO step at all.
//
// ⚠️ Pure. It reads the DNA and (optionally) the active modules the SAME
// resolver produced for the menu, so the checklist can never offer a screen the
// business is not entitled to.
// ============================================

import type { OperationalDna } from './operational-dna'

/** The real record that marks a step done. One key per dashboard read. */
export type FirstValueCompletion = 'products' | 'customers' | 'invoices' | 'sessions'

export interface FirstValueStep {
  readonly id: 'catalogue' | 'party' | 'appointment' | 'document'
  readonly titleKey: string
  readonly descKey: string
  /** A real address. `?add=true` opens the existing create dialog. */
  readonly route: string
  readonly completesOn: FirstValueCompletion
}

const isActive = (modules: readonly string[] | undefined, name: string): boolean =>
  modules === undefined || modules.includes(name)

/**
 * @param dna the composed Operational DNA (multi-activity aware).
 * @param activeModules `resolveDnaCapabilities(dna).activeModules`. Omitted
 *   means «trust the DNA alone»; a caller with a plan should pass it.
 */
export function firstValueSteps(
  dna: OperationalDna,
  activeModules?: readonly string[],
): readonly FirstValueStep[] {
  const offering = new Set(dna.offering)
  const hasStock = dna.inventory.some((value) => value !== 'NONE' && value !== 'UNRESOLVED')
  const hasGoods = offering.has('PHYSICAL_GOODS') || hasStock
  const hasService =
    offering.has('TIME_SERVICE') ||
    offering.has('DELIVERABLE_SERVICE') ||
    offering.has('PACKAGE_SESSION') ||
    offering.has('MIXED_OFFERING')

  const steps: FirstValueStep[] = []

  // 1. What the business sells. Never a product step for a business with no
  //    inventory and no goods — that is the Retail fall-through this replaces.
  if (hasGoods && isActive(activeModules, 'products')) {
    steps.push(
      hasService
        ? {
            id: 'catalogue',
            titleKey: 'firstValue.catalogue.mixedTitle',
            descKey: 'firstValue.catalogue.mixedDesc',
            route: '/warehouse?view=products',
            completesOn: 'products',
          }
        : {
            id: 'catalogue',
            titleKey: 'firstValue.catalogue.goodsTitle',
            descKey: 'firstValue.catalogue.goodsDesc',
            route: '/warehouse?add=true',
            completesOn: 'products',
          },
    )
  } else if (hasService && isActive(activeModules, 'services')) {
    steps.push({
      id: 'catalogue',
      titleKey: 'firstValue.catalogue.serviceTitle',
      descKey: 'firstValue.catalogue.serviceDesc',
      route: '/warehouse?view=products',
      completesOn: 'products',
    })
  }

  // 2. The party every document names. Part of the universal core.
  steps.push({
    id: 'party',
    titleKey: 'firstValue.party.title',
    descKey: 'firstValue.party.desc',
    route: '/customers?add=true',
    completesOn: 'customers',
  })

  // 3. The booked job, when bookings ARE the business. The sessions table is
  //    the record; an invoice alone would not represent work delivered.
  if (dna.intake.includes('APPOINTMENT_BOOKING') && isActive(activeModules, 'appointments')) {
    steps.push({
      id: 'appointment',
      titleKey: 'firstValue.appointment.title',
      descKey: 'firstValue.appointment.desc',
      route: '/customers?tab=sessions',
      completesOn: 'sessions',
    })
  }

  // 4. The first document that carries money. `/invoices/new` is the same form
  //    for a sale and for a repair order; the wording follows the intake.
  const isJob = dna.intake.includes('JOB_TICKET')
  steps.push({
    id: 'document',
    titleKey: isJob ? 'firstValue.document.jobTitle' : 'firstValue.document.saleTitle',
    descKey: isJob ? 'firstValue.document.jobDesc' : 'firstValue.document.saleDesc',
    route: '/invoices/new',
    completesOn: 'invoices',
  })

  return steps
}
