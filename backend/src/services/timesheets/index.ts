// ============================================
// backend/src/services/timesheets/index.ts
//
// Recorded, billable and billed are three different numbers, and the
// `invoice_id` on an entry IS the lock against billing an hour twice.
// ============================================

export { TimesheetsService } from './timesheets.service'

export {
  buildBillableLines,
  profitability,
  summarise,
  validateBilling,
  type BillableLine,
  type BillingMethod,
  type ProjectBillingConfig,
  type ProjectProfitability,
  type TimeEntry,
  type TimeTotals,
  type TimesheetRuleCode,
} from './billing.domain'

import { TimesheetsService } from './timesheets.service'

export const timesheets = new TimesheetsService()
