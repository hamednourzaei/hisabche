// ============================================
// backend/src/services/conflict/index.ts
//
// The Offline Conflict Resolution core's public surface.
//
// The sync path calls `conflicts.record(...)` when it refuses a stale write.
// Everything else here is the review queue and the authorized decision.
// ============================================

export { ConflictService } from './conflict.service'
export type { ConflictRow } from './conflict.service'

export {
  applyResolution,
  classifyConflict,
  diverging,
  isFinancialField,
  orderMutations,
  validateResolution,
  type ConflictEntity,
  type ConflictVerdict,
  type FieldDivergence,
  type ResolutionChoice,
  type ResolutionRequest,
} from './conflict.domain'

import { ConflictService } from './conflict.service'

/** The one instance the sync path files conflicts through. */
export const conflicts = new ConflictService()
