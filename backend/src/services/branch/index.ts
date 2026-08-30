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
  reportingBranchIds,
  resolveActiveBranch,
  validateBranchPlacement,
  type Branch,
  type BranchRuleCode,
  type BranchScope,
} from './branch.domain'

import { BranchService } from './branch.service'

/** The one instance the rest of the backend resolves branches through. */
export const branches = new BranchService()
