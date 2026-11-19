// ============================================
// WP-15 — NO_OVERHEAD_ALLOCATION.
//
// A project's real cost comes from transactions that already exist: purchases,
// stock issues, approved time and ledger entries. This file only COMBINES them
// and applies an overhead policy the shop sets explicitly. It never guesses a
// missing figure — a purchase amount that could not be read stays unknown.
// ============================================

export interface ProjectCostInput {
  /** Direct purchases charged to the project. Integer minor units. */
  purchaseMinor: number
  /** Stock issued to the project. Integer minor units. */
  inventoryMinor: number
  /** Approved timesheets, valued by the shared time rule. Integer minor units. */
  timeMinor: number
  /** Other ledger entries charged to the project. Integer minor units. */
  ledgerMinor: number
}

export type ProjectOverheadBasis = 'none' | 'percent_of_direct' | 'fixed'

export interface OverheadPolicy {
  basis: ProjectOverheadBasis
  /** Percentage for `percent_of_direct`, integer minor units for `fixed`. */
  value: number
}

/** Off by default: most shops do not load overhead onto a project. */
export const DEFAULT_OVERHEAD_POLICY: OverheadPolicy = { basis: 'none', value: 0 }

export interface ProjectCost {
  directMinor: number
  overheadMinor: number
  totalMinor: number
}

function knownMinor(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

/**
 * Direct cost + configured overhead, or `null` when ANY component is unknown.
 *
 * ⚠️ UNKNOWN IS NOT ZERO. A project whose stock issue failed to read must not be
 * shown as «cheap» — it must say the cost cannot be calculated.
 */
export function projectCostOf(
  input: ProjectCostInput,
  policy: OverheadPolicy = DEFAULT_OVERHEAD_POLICY,
): ProjectCost | null {
  for (const value of [
    input.purchaseMinor,
    input.inventoryMinor,
    input.timeMinor,
    input.ledgerMinor,
  ]) {
    if (!knownMinor(value)) return null
  }
  if (!Number.isFinite(policy.value) || policy.value < 0) return null

  const directMinor =
    input.purchaseMinor + input.inventoryMinor + input.timeMinor + input.ledgerMinor
  if (!Number.isSafeInteger(directMinor)) return null

  let overheadMinor = 0
  if (policy.basis === 'percent_of_direct') {
    if (policy.value > 100) return null
    overheadMinor = Math.round((directMinor * policy.value) / 100)
  } else if (policy.basis === 'fixed') {
    if (!Number.isSafeInteger(policy.value)) return null
    overheadMinor = policy.value
  } else if (policy.basis !== 'none') {
    return null
  }

  const totalMinor = directMinor + overheadMinor
  return Number.isSafeInteger(totalMinor) ? { directMinor, overheadMinor, totalMinor } : null
}

/**
 * Budget variance. `null` when either side is unknown — never «on budget» by
 * assuming a zero cost for a project that has spend nobody read.
 */
export function budgetVarianceOf(
  budgetMinor: number,
  cost: ProjectCost | null,
): { varianceMinor: number; overBudget: boolean } | null {
  if (!knownMinor(budgetMinor) || cost === null) return null
  return {
    varianceMinor: budgetMinor - cost.totalMinor,
    overBudget: cost.totalMinor > budgetMinor,
  }
}
