// ============================================
// backend/src/services/inventory-costing/unvalued-stock.domain.ts
//
// THE RULE MOVED. The implementation is
// packages/validation/src/schemas/unvalued-stock.domain.ts - one rule, two
// runtimes (the server and the offline device). This file re-exports every
// name so its importers are unchanged. It declares nothing.
// ============================================

export {
  findUnvaluedStock,
  uncoveredSoldUnits,
  type StockPosition,
  type UnvaluedRow,
  type UnvaluedStock,
} from '@hisabche/validation'
