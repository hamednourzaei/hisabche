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

import type { OperationalDna } from '@hisabche/validation'
import { resolveDnaCapabilities } from '@hisabche/validation'

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
      dna.inventory.includes('RAW_MATERIALS') || dna.inventory.includes('FINISHED_GOODS'),
  },
  { path: '/team-and-payroll', keep: (m) => m.has('team') },
  { path: '/market-seller', keep: (m) => m.has('products') },
]

/** The menu paths this business's DNA suggests hiding, in menu order. */
export function suggestedHiddenMenuPaths(dna: OperationalDna): string[] {
  const modules = new Set(resolveDnaCapabilities(dna).activeModules)
  return SUGGESTIBLE.filter((item) => !item.keep(modules, dna)).map((item) => item.path)
}
