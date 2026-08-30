// ============================================
// backend/src/services/dimensions/index.ts
//
// A dimension TAGS a posting; a branch OWNS one. Collapsing the two forces a
// business with three shops and four projects to create twelve branches.
// ============================================

export { DimensionsService } from './dimensions.service'

export {
  coverageGapMinor,
  requirementApplies,
  totalsByDimension,
  validateLine,
  valueAndDescendants,
  type Dimension,
  type DimensionRequirement,
  type DimensionRuleCode,
  type DimensionTotals,
  type DimensionValue,
  type PostingLine,
} from './dimension.domain'

import { DimensionsService } from './dimensions.service'

export const dimensions = new DimensionsService()
