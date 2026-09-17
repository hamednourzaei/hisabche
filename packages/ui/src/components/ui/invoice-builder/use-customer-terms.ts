'use client'

// ============================================
// The invoice's customer's terms, applied on the form (Customer 360 phase 3).
//
//   * Payment terms: an EMPTY due date is filled with invoice date + terms.
//     A due date the user picked is never overwritten.
//   * Credit limit: a sale that takes the customer past their limit is
//     WARNED about, not blocked — same policy as the stock warning. Blocking
//     is a product decision nobody has made.
//
// Credit used is the server's receivable (Customer Profile Core); only this
// invoice's own total is added here.
// ============================================

import { useEffect } from 'react'
import { useCustomerProfile } from '@hisabche/api'

export interface CreditBreach {
  creditLimit: number
  used: number
  after: number
}

/** YYYY-MM-DD (or a full ISO date) + days → ISO date at UTC midnight. */
export function dueDateFromTerms(invoiceDate: string, days: number | null): string | null {
  if (days === null || !Number.isInteger(days) || days < 0) return null
  const day = /^\d{4}-\d{2}-\d{2}/.exec(invoiceDate)?.[0]
  if (!day) return null
  const due = new Date(`${day}T00:00:00Z`)
  due.setUTCDate(due.getUTCDate() + days)
  return due.toISOString()
}

export function creditBreach(
  credit: { creditLimit: number; used: number } | null | undefined,
  invoiceTotal: number,
): CreditBreach | null {
  if (!credit || !(invoiceTotal > 0)) return null
  const after = credit.used + invoiceTotal
  return after > credit.creditLimit
    ? { creditLimit: credit.creditLimit, used: credit.used, after }
    : null
}

export function useCustomerTerms(input: {
  customerId: string | undefined
  transactionType: 'sale' | 'purchase'
  date: string
  dueDate: string | null
  invoiceTotal: number
  setDueDate: (value: string) => void
}): CreditBreach | null {
  const isSale = input.transactionType === 'sale'
  const { data } = useCustomerProfile(isSale ? input.customerId : undefined)
  const days = data?.paymentTermsDays ?? null
  const { date, dueDate, setDueDate } = input

  useEffect(() => {
    if (!isSale || dueDate !== null) return
    const next = dueDateFromTerms(date, days)
    if (next) setDueDate(next)
  }, [isSale, date, dueDate, days, setDueDate])

  return isSale ? creditBreach(data?.credit, input.invoiceTotal) : null
}
