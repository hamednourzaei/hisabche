// ============================================
// backend/src/services/traceability/index.ts
//
// FEFO by default for anything that expires, and an expired batch is a
// REFUSAL rather than a warning.
// ============================================

export { TraceabilityService } from './traceability.service'

export {
  bucketByExpiry,
  daysUntilExpiry,
  expiredValueMinor,
  expiryState,
  isIssuable,
  orderBatches,
  planAllocation,
  serialCostMinor,
  validateSerialIssue,
  type AllocationPlan,
  type AllocationStrategy,
  type BatchAllocation,
  type ExpiryBucket,
  type ExpiryState,
  type SerialStatus,
  type SerialUnit,
  type StockBatch,
  type TrackingMode,
} from './lot.domain'

import { TraceabilityService } from './traceability.service'

export const traceability = new TraceabilityService()
