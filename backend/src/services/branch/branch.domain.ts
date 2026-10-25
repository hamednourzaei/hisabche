// ============================================
// backend/src/services/branch/branch.domain.ts
//
// The branch rules — nesting, scope, active-branch resolution, placement —
// now live in `@hisabche/validation` (schemas/branch.domain.ts), so the
// offline engine applies the SAME rule as the server instead of a copy of it.
// This file keeps the old import path working.
// ============================================

export {
  branchAndDescendants,
  branchScopeFor,
  mayUseBranch,
  nestBranches,
  reportingBranchIds,
  resolveActiveBranch,
  validateBranchPlacement,
  type Branch,
  type BranchEmployee,
  type BranchRuleCode,
  type BranchScope,
  type BranchTreeNode,
} from '@hisabche/validation'
