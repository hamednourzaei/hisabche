// ============================================
// backend/src/services/assets/index.ts
// ============================================

export { AssetsService } from './assets.service'
export type { FixedAsset } from './assets.service'

export {
  bookValueMinor,
  buildSchedule,
  disposeAsset,
  duePostings,
  validateAsset,
  type AssetInput,
  type AssetRuleCode,
  type DepreciationEntry,
  type DepreciationMethod,
  type DisposalResult,
} from './depreciation.domain'

import { AssetsService } from './assets.service'

export const assets = new AssetsService()
