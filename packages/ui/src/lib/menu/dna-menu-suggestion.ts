// ============================================
// V54 5.6 — the menu Hisabche SUGGESTS from the business's Operational DNA.
//
// ⚠️ A SUGGESTION, NEVER A LOCK (owner decision N-8, taken as «suggestion»).
// It is written once into the person's own menu look (`usePageLook('menu')`)
// and only while they have no saved menu of their own. Everything it hides is
// still in Settings → «صفحه‌ها و تب‌ها» and in the header wrench, one tap away.
// It is not permission: a page it keeps can still be denied by the role, and a
// page it hides is not denied to anyone.
//
// ⚠️ CONSERVATIVE BY DESIGN. Only pages that clearly serve a model the business
// does not have are suggested away. The money pages (invoices, accounting,
// customers, settings, dashboard) are never touched — a nail technician still
// sells, and a retailer still has customers.
//
// The rule reads the RESOLVED modules and the inventory axis (the shared
// resolver's output), never an industry name.
// ============================================

import {
  resolveDnaCapabilities,
  resolveTerminologyProfile,
  type OperationalDna,
  type TerminologyProfile,
} from '@hisabche/validation'

type DnaAxis = 'offering' | 'inventory' | 'workforce' | 'intake' | 'topology' | 'settlement'

/**
 * The axis that decides each module. ⚠️ PER AXIS, NOT ALL-OR-NOTHING (owner,
 * 15 Nov 2026): onboarding never resolves `workforce` (D-01 is open), and the
 * old rule «any of offering / inventory / workforce UNRESOLVED → hide nothing»
 * therefore hid nothing for EVERY new business — a beauty salon was shown the
 * till and manufacturing, and its guide led there. A module whose own axis is
 * unresolved still counts as present: nothing is hidden on a guess.
 */
const AXES_OF_MODULE: Readonly<Record<string, readonly DnaAxis[]>> = {
  products: ['offering'],
  services: ['offering'],
  pos: ['intake'],
  appointments: ['intake'],
  attendance: ['intake'],
  job_tickets: ['intake'],
  inventory: ['inventory'],
  warehouse: ['inventory'],
  consumables: ['inventory'],
  team: ['workforce'],
  payroll: ['workforce'],
  branches: ['topology'],
  order_deposits: ['settlement'],
  package_credits: ['settlement'],
}

const unresolvedAxis = (dna: OperationalDna, axis: DnaAxis): boolean =>
  (dna[axis] as readonly string[] | undefined)?.includes('UNRESOLVED') ?? true

/** Menu paths the suggestion may hide, each with the reason it is kept. */
const SUGGESTIBLE: ReadonlyArray<{
  path: string
  keep: (modules: ReadonlySet<string>, dna: OperationalDna) => boolean
}> = [
  {
    path: '/warehouse',
    keep: (m) => m.has('inventory') || m.has('products') || m.has('consumables'),
  },
  { path: '/till', keep: (m) => m.has('pos') },
  {
    path: '/manufacturing',
    keep: (_m, dna) =>
      unresolvedAxis(dna, 'inventory') ||
      dna.inventory.includes('RAW_MATERIALS') ||
      dna.inventory.includes('FINISHED_GOODS'),
  },
  { path: '/team-and-payroll', keep: (m) => m.has('team') },
  { path: '/market-seller', keep: (m) => m.has('products') },
]

/**
 * The menu paths this business's DNA suggests hiding, in menu order.
 *
 * ⚠️ V55: an UNRESOLVED axis (the business did not say, and no trade carries
 * the evidence) hides nothing THAT DEPENDS ON IT (per axis — AXES_OF_MODULE).
 * A suggestion built on a guess is exactly the
 * fabrication the DNA exists to prevent.
 */
export function suggestedHiddenMenuPaths(dna: OperationalDna): string[] {
  const modules = dnaActiveModules(dna)
  const suggested = SUGGESTIBLE.filter((item) => !item.keep(modules, dna)).map((item) => item.path)
  // A presentation profile's own list is a whole-business statement: only once
  // the business is known on the core axes.
  const known = !(['offering', 'inventory', 'workforce'] as const).some((axis) =>
    unresolvedAxis(dna, axis),
  )
  const explicitHidden = known ? (dna.presentation?.navigation?.hiddenPaths ?? []) : []
  return [...new Set([...suggested, ...explicitHidden])]
}

/**
 * The modules this business runs: what the DNA resolves, PLUS every module
 * whose deciding axis is still UNRESOLVED (it may run it — nothing is hidden on
 * a guess). One rule for the menu suggestion and the in-app guide
 * (`useGuideScope`).
 */
export function dnaActiveModules(dna: OperationalDna): ReadonlySet<string> {
  const active = new Set(resolveDnaCapabilities(dna).activeModules)
  for (const [module, axes] of Object.entries(AXES_OF_MODULE)) {
    if (axes.some((axis) => unresolvedAxis(dna, axis))) active.add(module)
  }
  return active
}

/** Combines suggested hidden paths with the DNA-resolved terminology profile (never retail on UNRESOLVED). */
export function suggestedNavigationContext(
  dna: OperationalDna,
  selectedIndustry?: string | null,
): { readonly hiddenPaths: string[]; readonly terminology: TerminologyProfile } {
  return {
    hiddenPaths: suggestedHiddenMenuPaths(dna),
    terminology: resolveTerminologyProfile(dna, selectedIndustry),
  }
}
