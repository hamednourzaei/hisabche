// ============================================
// backend/src/services/inventory/reorder.domain.ts
//
// THE RULE MOVED. The implementation is
// packages/validation/src/schemas/reorder.domain.ts - one rule, two runtimes
// (the server and the offline device). This file re-exports every name so its
// importers are unchanged. It declares nothing.
// ============================================

export {
  DEFAULT_LEAD_TIME_DAYS,
  DEMAND_WINDOW_DAYS,
  type DemandInput,
  type ReorderPoint,
  averageDailySales,
  reorderPointFor,
  availablePosition,
  suggestedOrderQuantity,
  DEAD_STOCK_DEFAULT_DAYS,
  type DeadStockInput,
  type DeadStockLine,
  findDeadStock,
  buildReorderSuggestions,
  buildDeadStock,
  type ReorderLine,
} from '@hisabche/validation'
