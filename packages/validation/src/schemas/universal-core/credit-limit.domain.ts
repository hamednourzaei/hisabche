// ============================================
// packages/validation/src/schemas/universal-core/credit-limit.domain.ts
//
// G-08: CREDIT LIMIT ENFORCEMENT & ADVICE
//
// Shared rule called by both server and local engine before posting invoices.
// Workspace setting `credit_limit_mode`:
//   'off'   -> no checks, allows all
//   'warn'  -> (default) allows sale, returns warning with excess amount
//   'block' -> refuses sale with coded error when limit is exceeded
//
// Customer `credit_limit`:
//   null    -> unlimited credit
//   0       -> cash only (no debt permitted)
//   > 0     -> maximum outstanding receivable in integer minor units
// ============================================

export type CreditLimitMode = 'off' | 'warn' | 'block'

export interface CreditEvaluationInput {
  readonly mode: CreditLimitMode
  readonly currentReceivableMinor: number
  readonly newInvoiceAmountMinor: number
  readonly creditLimitMinor: number | null | undefined
}

export type CreditEvaluationResult =
  | {
      readonly allowed: true
      readonly warning: null | {
        readonly overLimitMinor: number
        readonly totalProjectedReceivableMinor: number
        readonly creditLimitMinor: number
      }
    }
  | {
      readonly allowed: false
      readonly code: 'CREDIT_LIMIT_EXCEEDED' | 'CASH_ONLY_CUSTOMER'
      readonly overLimitMinor: number
      readonly totalProjectedReceivableMinor: number
      readonly creditLimitMinor: number
    }

/**
 * Pure evaluation of customer credit limit.
 * Vector: limit 1,000, receivable 800, invoice 300 -> warn shows 100 over;
 * block refuses; off ignores. Limit 0 and limit null differ.
 */
export function evaluateCreditLimit(input: CreditEvaluationInput): CreditEvaluationResult {
  const { mode, currentReceivableMinor, newInvoiceAmountMinor, creditLimitMinor } = input

  // If credit checking is off, always allow
  if (mode === 'off') {
    return { allowed: true, warning: null }
  }

  // Null or undefined limit means unlimited credit
  if (creditLimitMinor === null || creditLimitMinor === undefined) {
    return { allowed: true, warning: null }
  }

  const projectedReceivable = currentReceivableMinor + newInvoiceAmountMinor

  // Limit 0 means strict cash-only customer
  if (creditLimitMinor === 0) {
    if (newInvoiceAmountMinor > 0) {
      if (mode === 'block') {
        return {
          allowed: false,
          code: 'CASH_ONLY_CUSTOMER',
          overLimitMinor: newInvoiceAmountMinor,
          totalProjectedReceivableMinor: projectedReceivable,
          creditLimitMinor: 0,
        }
      }
      return {
        allowed: true,
        warning: {
          overLimitMinor: newInvoiceAmountMinor,
          totalProjectedReceivableMinor: projectedReceivable,
          creditLimitMinor: 0,
        },
      }
    }
    return { allowed: true, warning: null }
  }

  // Over-limit condition
  if (projectedReceivable > creditLimitMinor) {
    const overLimitMinor = projectedReceivable - creditLimitMinor

    if (mode === 'block') {
      return {
        allowed: false,
        code: 'CREDIT_LIMIT_EXCEEDED',
        overLimitMinor,
        totalProjectedReceivableMinor: projectedReceivable,
        creditLimitMinor,
      }
    }

    // Warn mode
    return {
      allowed: true,
      warning: {
        overLimitMinor,
        totalProjectedReceivableMinor: projectedReceivable,
        creditLimitMinor,
      },
    }
  }

  // Under limit
  return { allowed: true, warning: null }
}
