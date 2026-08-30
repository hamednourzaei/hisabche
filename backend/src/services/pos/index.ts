// ============================================
// backend/src/services/pos/index.ts
//
// The till core's public surface.
// ============================================

export { PosService } from './pos.service'

export {
  buildPosting,
  cashTakenMinor,
  expectedCashMinor,
  findAbandoned,
  movementsNetMinor,
  summarise,
  validateClose,
  validateMovement,
  validateOrder,
  type AbandonedSession,
  type CashMovement,
  type PaymentMethod,
  type PosOrder,
  type PosSession,
  type SessionStatus,
  type SessionTotals,
} from './pos.domain'

import { PosService } from './pos.service'

export const pos = new PosService()
