// ============================================
// backend/src/services/accounting/profit-report.domain.ts
//
// ⚠️ THE RULE MOVED. The implementation is
// `packages/validation/src/schemas/profit-report.domain.ts` — one rule, two
// runtimes (the server and the offline device). Phase 2 of the offline edition
// moved it and left this file re-exporting every name, so its importers
// (`accounting.service.ts`, `accounting.repository.ts`, `evidence.domain.ts`,
// `break-even.domain.ts`, `benchmark.domain.ts` and the tests) are unchanged.
//
// It declares nothing. Look in the shared file for `buildProfitReport`,
// `invoiceMargins`, `restateAtRates` and `isCostDeterminate`.
// ============================================

export {
  buildProfitReport,
  invoiceMargins,
  isCostDeterminate,
  lineRevenues,
  restateAtRates,
} from '@hisabche/validation'

export type {
  CostStatus,
  InvoiceMargin,
  ProductProfitRow,
  ProfitConsumption,
  ProfitInvoice,
  ProfitLine,
  ProfitPayroll,
  ProfitReport,
} from '@hisabche/validation'
