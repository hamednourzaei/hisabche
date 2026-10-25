// ============================================
// backend/src/services/pos/pos.domain.ts
//
// ⚠️ THE RULE MOVED. The implementation is
// `packages/validation/src/schemas/pos.domain.ts` — one rule, two runtimes (the
// server and the offline device's till). This file re-exports every name so the
// importers (`pos.service`, `services/pos/index.ts`, the tests) are unchanged.
// It declares nothing.
// ============================================

export {
  buildDrawerLedger,
  buildPosting,
  cashTakenMinor,
  checkSuspendChange,
  dailyCashFlow,
  expectedCashMinor,
  findAbandoned,
  movementsNetMinor,
  paymentMargin,
  settlementsNetMinor,
  summarise,
  transfersNetMinor,
  validateClose,
  validateMovement,
  validateOrder,
} from '@hisabche/validation'

export type {
  AbandonedSession,
  CashEvent,
  CashFlowDay,
  CashMovement,
  CashMovementKind,
  CashSettlement,
  CloseRequest,
  DrawerEntry,
  DrawerEntryKind,
  PosOrder,
  PosPayment,
  PosPaymentMethod as PaymentMethod,
  PosRuleCode,
  PosSession,
  SessionPosting,
  SessionStatus,
  SessionTotals,
} from '@hisabche/validation'
