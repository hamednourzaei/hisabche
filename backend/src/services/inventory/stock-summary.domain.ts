// The rule lives in @hisabche/validation so the device's local engine computes
// the warehouse cards the same way (packages/validation/src/schemas/stock-summary.ts).
export {
  DEFAULT_MIN_STOCK_LEVEL,
  summarizeStock,
  type StockSummary,
  type StockSummaryRow,
} from '@hisabche/validation'
