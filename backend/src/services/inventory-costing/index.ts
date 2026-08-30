// ============================================
// backend/src/services/inventory-costing/index.ts
//
// The Inventory Costing Core's public surface.
//
// Sales, purchasing and manufacturing use `costing` (the port) and nothing
// else. Reaching into the repository or the layer tables from outside would
// put the choice of WHICH layer to consume in a module that has no business
// making it — which is how cost of goods sold became "current buy price".
// ============================================

export { CostingService } from './costing.service'
export { CostingRepository } from './costing.repository'
export type { InventorySettings, ConsumptionRow } from './costing.repository'

export type {
  CostingPort,
  CostingSourceType,
  IssueRequest,
  IssueResult,
  ReceiptRequest,
  ValuationRow,
} from './costing.port'

export {
  averageUnitCost,
  fifoOrder,
  grossProfit,
  lastKnownCost,
  mayIssue,
  onHand,
  planConsumption,
  roundMoney,
  roundQty,
  stockValue,
  type ConsumptionPlan,
  type ConsumptionStep,
  type CostLayer,
  type CostingMethod,
  type NegativeStockPolicy,
} from './costing.domain'

import { CostingService } from './costing.service'

/** The one instance other cores cost through. */
export const costing = new CostingService()
