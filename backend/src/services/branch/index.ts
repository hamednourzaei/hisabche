// ============================================
// backend/src/services/branch/index.ts
//
// The Branch core's public surface.
//
// A branch NARROWS what a workspace already authorized. Nothing exported here
// can widen access, and every branch filter composes with the workspace filter
// rather than replacing it.
// ============================================

export { BranchService } from './branch.service'

export {
  branchAndDescendants,
  branchScopeFor,
  mayUseBranch,
  // G2: nesting a flat branch list is pure, so the rule is tested without a
  // database — including the case that is easy to get wrong (an orphan whose
  // parent is out of scope must still appear).
  nestBranches,
  reportingBranchIds,
  resolveActiveBranch,
  validateBranchPlacement,
  type Branch,
  type BranchEmployee,
  type BranchRuleCode,
  type BranchScope,
  type BranchTreeNode,
} from './branch.domain'

import { BranchService } from './branch.service'

/** The one instance the rest of the backend resolves branches through. */
export const branches = new BranchService()
