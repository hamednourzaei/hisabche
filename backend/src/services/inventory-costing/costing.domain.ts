// ============================================
// backend/src/services/inventory-costing/costing.domain.ts
//
// ⚠️ THE RULE MOVED. The implementation is
// `packages/validation/src/schemas/costing.domain.ts` — one rule, two runtimes
// (the server and the offline device). Phase 2 of the offline edition moved it
// and left this file re-exporting every name, so the nine existing importers
// (`costing.service.ts`, `repost.domain.ts`, `stock-count.domain.ts`,
// `transfer.domain.ts`, `unvalued-stock.domain.ts`, the repository, the index
// and the tests) are unchanged.
//
// It declares nothing. `coverSoldUnits` in `costing.service.ts` is the
// DB-backed method that consumes `planConsumption`; the arithmetic is here.
// ============================================

export {
  averageUnitCost,
  fifoOrder,
  grossProfit,
  lastKnownCost,
  // ⚠️ `layersValue`, the permanent name (owner decision, 19 Oct 2026): it is
  // Σ(remaining layer × unit cost). The one-time alias to `stockValue` is gone,
  // so the name a reader sees here is the name of the rule.
  layersValue,
  mayIssue,
  onHand,
  planConsumption,
  roundMoney,
  roundQty,
} from '@hisabche/validation'

export type {
  ConsumptionPlan,
  ConsumptionStep,
  CostLayer,
  CostingMethod,
  NegativeStockPolicy,
} from '@hisabche/validation'
