// ============================================
// backend/src/services/dimensions/dimension.domain.ts
//
// The other ways a business cuts its numbers: cost centre, project, campaign,
// vehicle — whatever it actually manages by.
//
// ---------------------------------------------------------------------------
// A DIMENSION IS NOT A BRANCH
//
// Branch already exists and is deliberately NOT one of these. A branch is a
// place with its own documents and its own reporting boundary; a dimension is
// a TAG on a posting that lets the same document be sliced several ways at
// once. One invoice belongs to one branch and can carry a cost centre, a
// project and a campaign simultaneously.
//
// Collapsing the two would force a business with three shops and four projects
// to create twelve branches.
//
// ---------------------------------------------------------------------------
// REQUIRED-NESS IS PER ACCOUNT, NOT GLOBAL
//
// "Every posting must name a cost centre" is unworkable: the bank account does
// not have one. What businesses actually need is "every EXPENSE posting must
// name a cost centre", and that is what this models — a requirement attached
// to an account or an account type, checked when the entry is posted.
//
// A requirement that fires everywhere gets switched off within a week.
// ============================================

export interface Dimension {
  id: string
  /** Stable machine key: `cost_center`, `project`, `campaign`. */
  code: string
  labelKey: string
  isActive: boolean
  /** Values may nest — a region containing cost centres. */
  allowsHierarchy: boolean
}

export interface DimensionValue {
  id: string
  dimensionId: string
  code: string
  name: string
  parentId: string | null
  isActive: boolean
}

/** Which dimensions a posting must carry, and when. */
export interface DimensionRequirement {
  dimensionId: string
  /** Required only for postings touching these account types. */
  accountTypes?: Array<'asset' | 'liability' | 'equity' | 'revenue' | 'expense'>
  /** Required only for these specific accounts. Wins over the type rule. */
  accountIds?: string[]
  /** Never required for these, even if the type rule would catch them. */
  exceptAccountIds?: string[]
}

export type DimensionRuleCode =
  | 'DIMENSION_REQUIRED'
  | 'DIMENSION_VALUE_UNKNOWN'
  | 'DIMENSION_VALUE_INACTIVE'
  | 'DIMENSION_VALUE_IS_GROUP'
  | 'DIMENSION_NOT_ALLOWED'

export interface PostingLine {
  accountId: string
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  /** dimensionId → valueId. */
  dimensions: Record<string, string>
}

/** Whether a requirement applies to this particular line. */
export function requirementApplies(requirement: DimensionRequirement, line: PostingLine): boolean {
  if (requirement.exceptAccountIds?.includes(line.accountId)) return false

  // A specific account beats the type rule in both directions: naming it makes
  // it required even when its type is not listed.
  if (requirement.accountIds?.length) return requirement.accountIds.includes(line.accountId)
  if (requirement.accountTypes?.length) return requirement.accountTypes.includes(line.accountType)

  // No narrowing at all means every line.
  return true
}

/**
 * Whether a posting line carries the dimensions it must.
 *
 * A value that is a GROUP is refused: posting to "North Region" when the
 * region contains three cost centres produces a total nobody can break down,
 * which is the opposite of why dimensions exist.
 */
export function validateLine(
  line: PostingLine,
  requirements: DimensionRequirement[],
  values: DimensionValue[],
): DimensionRuleCode[] {
  const problems: DimensionRuleCode[] = []
  const byId = new Map(values.map((value) => [value.id, value]))
  const hasChildren = new Set(values.map((value) => value.parentId).filter(Boolean) as string[])

  for (const requirement of requirements) {
    if (!requirementApplies(requirement, line)) continue
    if (!line.dimensions[requirement.dimensionId]) problems.push('DIMENSION_REQUIRED')
  }

  for (const [dimensionId, valueId] of Object.entries(line.dimensions)) {
    const value = byId.get(valueId)

    if (!value) {
      problems.push('DIMENSION_VALUE_UNKNOWN')
      continue
    }
    if (value.dimensionId !== dimensionId) problems.push('DIMENSION_NOT_ALLOWED')
    if (!value.isActive) problems.push('DIMENSION_VALUE_INACTIVE')
    if (hasChildren.has(value.id)) problems.push('DIMENSION_VALUE_IS_GROUP')
  }

  return [...new Set(problems)]
}

/** A value and everything under it — what a report on a group must cover. */
export function valueAndDescendants(valueId: string, values: DimensionValue[]): string[] {
  const children = new Map<string, string[]>()
  for (const value of values) {
    if (!value.parentId) continue
    children.set(value.parentId, [...(children.get(value.parentId) ?? []), value.id])
  }

  const collected: string[] = []
  const queue = [valueId]
  const seen = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()!
    if (seen.has(current)) continue
    seen.add(current)
    collected.push(current)
    queue.push(...(children.get(current) ?? []))
  }

  return collected
}

export interface DimensionTotals {
  valueId: string
  valueName: string
  debitMinor: number
  creditMinor: number
  /** Signed on the account's natural side, like a trial balance row. */
  balanceMinor: number
}

/**
 * Totals per dimension value.
 *
 * Lines carrying NO value for the dimension are collected under a named
 * `unassigned` bucket rather than dropped. Dropping them makes the slices sum
 * to less than the account and quietly hides exactly the postings somebody
 * forgot to tag — which are the ones worth finding.
 */
export function totalsByDimension(
  lines: Array<{ dimensions: Record<string, string>; debitMinor: number; creditMinor: number }>,
  dimensionId: string,
  values: DimensionValue[],
): DimensionTotals[] {
  const byId = new Map(values.map((value) => [value.id, value]))
  const totals = new Map<string, DimensionTotals>()

  for (const line of lines) {
    const valueId = line.dimensions[dimensionId] ?? 'unassigned'

    const entry = totals.get(valueId) ?? {
      valueId,
      valueName: byId.get(valueId)?.name ?? 'unassigned',
      debitMinor: 0,
      creditMinor: 0,
      balanceMinor: 0,
    }

    entry.debitMinor += line.debitMinor
    entry.creditMinor += line.creditMinor
    entry.balanceMinor = entry.debitMinor - entry.creditMinor

    totals.set(valueId, entry)
  }

  return [...totals.values()].sort((a, b) => Math.abs(b.balanceMinor) - Math.abs(a.balanceMinor))
}

/**
 * Does the dimension breakdown account for the whole figure?
 *
 * Returns what is missing. A slice that does not sum back to the account total
 * is a slice somebody will build a decision on and be wrong.
 */
export function coverageGapMinor(totals: DimensionTotals[], accountBalanceMinor: number): number {
  return accountBalanceMinor - totals.reduce((sum, row) => sum + row.balanceMinor, 0)
}
