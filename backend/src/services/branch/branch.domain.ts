// ============================================
// backend/src/services/branch/branch.domain.ts
//
// Branches inside one business.
//
// ---------------------------------------------------------------------------
// A BRANCH IS NOT A SECOND COMPANY
//
// A workspace IS the company: it owns the chart of accounts, the catalogue and
// the customers, and it is the tenancy boundary. A branch is a place inside it
// — a second shop, a warehouse across town — that raises its own documents and
// can be reported on separately.
//
// So the split follows what a shopkeeper would expect:
//
//   SHARED across branches   products, customers, suppliers, chart of accounts
//   PER BRANCH               invoices, payments, journal entries, stock moves
//
// Making products per-branch would force the same phone to be created twice
// and would make a transfer between the branches impossible to price. Making
// invoices shared would make "how did the second shop do this month" a
// question with no answer.
//
// ---------------------------------------------------------------------------
// BRANCH ACCESS IS NARROWING, NEVER WIDENING
//
// A member restricted to one branch sees less than the workspace holds. A
// member with no restriction sees all of it. Nothing here can grant access to
// a workspace the tenancy layer did not already authorize — the branch filter
// composes with the workspace filter and never replaces it.
// ============================================

export interface Branch {
  id: string
  workspaceId: string
  code: string
  name: string
  parentBranchId: string | null
  isActive: boolean
}

export type BranchScope =
  /** Every branch in the workspace, and rows with no branch at all. */
  | { kind: 'all' }
  /** Only these branches. Never empty — an empty list is `none`. */
  | { kind: 'limited'; branchIds: string[] }
  /** No branch access. Distinct from `all`: it must never widen by accident. */
  | { kind: 'none' }

/**
 * What a member may see.
 *
 * An empty assignment means UNRESTRICTED, not "nothing": the overwhelming
 * majority of workspaces have one branch or none, and defaulting those members
 * to no access would lock every existing user out the moment branches shipped.
 * A member is restricted only by being explicitly assigned to branches.
 */
export function branchScopeFor(assignedBranchIds: string[]): BranchScope {
  if (assignedBranchIds.length === 0) return { kind: 'all' }
  return { kind: 'limited', branchIds: [...new Set(assignedBranchIds)] }
}

export function mayUseBranch(scope: BranchScope, branchId: string | null): boolean {
  if (scope.kind === 'none') return false
  if (scope.kind === 'all') return true
  // A row with no branch belongs to the workspace as a whole. A member
  // restricted to specific branches does not own it and must not see it in
  // their figures.
  if (!branchId) return false
  return scope.branchIds.includes(branchId)
}

export type BranchRuleCode =
  | 'BRANCH_NOT_PERMITTED'
  | 'BRANCH_REQUIRED'
  | 'BRANCH_INACTIVE'
  | 'BRANCH_CODE_DUPLICATE'
  | 'BRANCH_PARENT_UNKNOWN'
  | 'BRANCH_PARENT_CYCLE'
  | 'BRANCH_SELF_PARENT'

/**
 * The branch a request may act in.
 *
 * `requested` is a TARGET to be verified, exactly like a workspace id: it
 * comes from a header the client controls and is checked against what the
 * member is actually assigned to.
 *
 * A restricted member with exactly one branch and no request gets that branch
 * — the till in a single shop should not have to name itself. A restricted
 * member with several and no request is refused rather than guessed at:
 * choosing which shop a sale belongs to is not a decision the data can make.
 */
export function resolveActiveBranch(
  scope: BranchScope,
  requested: string | null,
  workspaceBranches: Branch[],
): { branchId: string | null } | { error: BranchRuleCode } {
  if (scope.kind === 'none') return { error: 'BRANCH_NOT_PERMITTED' }

  if (requested) {
    const branch = workspaceBranches.find((b) => b.id === requested)
    if (!branch) return { error: 'BRANCH_NOT_PERMITTED' }
    if (!branch.isActive) return { error: 'BRANCH_INACTIVE' }
    if (!mayUseBranch(scope, requested)) return { error: 'BRANCH_NOT_PERMITTED' }
    return { branchId: requested }
  }

  if (scope.kind === 'all') {
    // Unrestricted and nothing requested: act across the whole workspace.
    return { branchId: null }
  }

  const usable = scope.branchIds.filter((id) =>
    workspaceBranches.some((b) => b.id === id && b.isActive),
  )

  if (usable.length === 0) return { error: 'BRANCH_NOT_PERMITTED' }
  if (usable.length === 1) return { branchId: usable[0]! }

  return { error: 'BRANCH_REQUIRED' }
}

/** Placement rules for a branch in the workspace's branch tree. */
export function validateBranchPlacement(
  candidate: { id: string; code: string; parentBranchId: string | null },
  existing: Branch[],
): BranchRuleCode[] {
  const problems: BranchRuleCode[] = []

  if (existing.some((b) => b.code === candidate.code && b.id !== candidate.id)) {
    problems.push('BRANCH_CODE_DUPLICATE')
  }

  if (!candidate.parentBranchId) return problems

  if (candidate.id && candidate.parentBranchId === candidate.id) {
    problems.push('BRANCH_SELF_PARENT')
    return problems
  }

  const byId = new Map(existing.map((b) => [b.id, b]))
  if (!byId.has(candidate.parentBranchId)) {
    problems.push('BRANCH_PARENT_UNKNOWN')
    return problems
  }

  if (candidate.id) {
    let cursor: string | null = candidate.parentBranchId
    const seen = new Set<string>()
    while (cursor) {
      if (cursor === candidate.id) {
        problems.push('BRANCH_PARENT_CYCLE')
        break
      }
      if (seen.has(cursor)) break
      seen.add(cursor)
      cursor = byId.get(cursor)?.parentBranchId ?? null
    }
  }

  return problems
}

/**
 * A branch and everything under it.
 *
 * Reporting on a region means reporting on its shops too, so a branch filter
 * expands down the tree rather than matching one row.
 */
export function branchAndDescendants(branchId: string, branches: Branch[]): string[] {
  const children = new Map<string, string[]>()
  for (const branch of branches) {
    if (!branch.parentBranchId) continue
    children.set(branch.parentBranchId, [...(children.get(branch.parentBranchId) ?? []), branch.id])
  }

  const collected: string[] = []
  const queue = [branchId]
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

/** The branch ids a query should filter on, or null for "do not filter". */
export function reportingBranchIds(
  scope: BranchScope,
  requested: string | null,
  branches: Branch[],
): string[] | null {
  if (requested) return branchAndDescendants(requested, branches)
  if (scope.kind === 'limited') return scope.branchIds
  return null
}
