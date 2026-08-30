// ============================================
// backend/src/services/payments/payments.domain.ts
//
// What a payment settles, what is still owed, and how overdue it is — as pure
// functions.
//
// The rule that shapes all of it: an invoice's outstanding balance is
// `total − everything allocated to it`. It is DERIVED. The stored
// `paid_amount` is a cache that any PATCH on the invoice could overwrite, and
// a debt figure anyone can overwrite is not a debt figure.
// ============================================

export type PaymentDirection = 'in' | 'out'
export type PartyType = 'customer' | 'supplier'

export interface OpenInvoice {
  invoiceId: string
  invoiceNumber: string
  total: number
  allocated: number
  /** The day the money is due. Falls back to the invoice date when unset. */
  dueDate: string
  invoiceDate: string
}

export interface AllocationRequest {
  invoiceId: string
  amount: number
}

export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

/** Money is compared as integer minor units; floats do not compare equal. */
function minor(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100)
}

export function outstandingOf(invoice: OpenInvoice): number {
  return round2(invoice.total - invoice.allocated)
}

/** Only invoices with something left to pay, oldest due date first. */
export function openInvoices(invoices: OpenInvoice[]): OpenInvoice[] {
  return invoices
    .filter((invoice) => minor(outstandingOf(invoice)) > 0)
    .sort((a, b) => {
      const left = a.dueDate || a.invoiceDate
      const right = b.dueDate || b.invoiceDate
      return left < right ? -1 : left > right ? 1 : 0
    })
}

export type AllocationRuleCode =
  | 'PAYMENT_AMOUNT_INVALID'
  | 'PAYMENT_OVER_ALLOCATED'
  | 'PAYMENT_ALLOCATION_EXCEEDS_OUTSTANDING'
  | 'PAYMENT_ALLOCATION_INVOICE_UNKNOWN'
  | 'PAYMENT_ALLOCATION_AMOUNT_INVALID'
  | 'PAYMENT_ALLOCATION_DUPLICATE'

/**
 * Every reason this payment may not be recorded as asked.
 *
 * Under-allocating is deliberately NOT one of them: a customer who pays more
 * than they owe has made an advance, and the remainder stays on the payment
 * rather than being refused or quietly dropped.
 */
export function validateAllocations(
  amount: number,
  allocations: AllocationRequest[],
  invoices: OpenInvoice[],
): AllocationRuleCode[] {
  const problems: AllocationRuleCode[] = []

  if (!Number.isFinite(amount) || minor(amount) <= 0) {
    problems.push('PAYMENT_AMOUNT_INVALID')
  }

  const byId = new Map(invoices.map((i) => [i.invoiceId, i]))
  const seen = new Set<string>()
  let total = 0

  for (const allocation of allocations) {
    if (!Number.isFinite(allocation.amount) || minor(allocation.amount) <= 0) {
      problems.push('PAYMENT_ALLOCATION_AMOUNT_INVALID')
      continue
    }

    if (seen.has(allocation.invoiceId)) {
      // Two rows against one invoice would each be checked against the same
      // outstanding balance and together exceed it.
      problems.push('PAYMENT_ALLOCATION_DUPLICATE')
      continue
    }
    seen.add(allocation.invoiceId)

    const invoice = byId.get(allocation.invoiceId)
    if (!invoice) {
      problems.push('PAYMENT_ALLOCATION_INVOICE_UNKNOWN')
      continue
    }

    if (minor(allocation.amount) > minor(outstandingOf(invoice))) {
      problems.push('PAYMENT_ALLOCATION_EXCEEDS_OUTSTANDING')
    }

    total += minor(allocation.amount)
  }

  if (total > minor(amount)) problems.push('PAYMENT_OVER_ALLOCATED')

  return [...new Set(problems)]
}

export interface AutoAllocation {
  allocations: AllocationRequest[]
  /** What is left over — an advance, not an error. */
  unallocated: number
}

/**
 * Spread a payment over the open invoices, oldest due first.
 *
 * This is what a shopkeeper means by "he paid me 500": settle the oldest
 * unpaid bills until the money runs out. The remainder stays on the payment
 * and can be applied to whatever they buy next.
 */
export function autoAllocate(amount: number, invoices: OpenInvoice[]): AutoAllocation {
  let remaining = minor(amount)
  const allocations: AllocationRequest[] = []

  for (const invoice of openInvoices(invoices)) {
    if (remaining <= 0) break

    const take = Math.min(remaining, minor(outstandingOf(invoice)))
    if (take <= 0) continue

    allocations.push({ invoiceId: invoice.invoiceId, amount: take / 100 })
    remaining -= take
  }

  return { allocations, unallocated: round2(remaining / 100) }
}

/** How much of a payment has not been applied to anything. */
export function unallocatedOf(amount: number, allocations: AllocationRequest[]): number {
  const used = allocations.reduce((sum, a) => sum + minor(a.amount), 0)
  return round2((minor(amount) - used) / 100)
}

// ─── Aging ───────────────────────────────────────────────────────────────────

export interface AgingBuckets {
  current: number
  days1to30: number
  days31to60: number
  days61to90: number
  over90: number
  total: number
}

export function emptyAging(): AgingBuckets {
  return { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0, total: 0 }
}

/** Whole days between two dates, ignoring the time of day entirely. */
export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${String(from).slice(0, 10)}T00:00:00Z`)
  const end = Date.parse(`${String(to).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.round((end - start) / 86_400_000)
}

/**
 * How overdue each unpaid amount is, as of `asOf`.
 *
 * Measured from the DUE date, falling back to the invoice date when a business
 * does not set due dates — measuring from the invoice date when a due date
 * exists would report a bill inside its payment terms as overdue.
 */
export function ageInvoices(invoices: OpenInvoice[], asOf: string): AgingBuckets {
  const buckets = emptyAging()

  for (const invoice of openInvoices(invoices)) {
    const outstanding = outstandingOf(invoice)
    const overdueBy = daysBetween(invoice.dueDate || invoice.invoiceDate, asOf)

    if (overdueBy <= 0) buckets.current += outstanding
    else if (overdueBy <= 30) buckets.days1to30 += outstanding
    else if (overdueBy <= 60) buckets.days31to60 += outstanding
    else if (overdueBy <= 90) buckets.days61to90 += outstanding
    else buckets.over90 += outstanding

    buckets.total += outstanding
  }

  return {
    current: round2(buckets.current),
    days1to30: round2(buckets.days1to30),
    days31to60: round2(buckets.days31to60),
    days61to90: round2(buckets.days61to90),
    over90: round2(buckets.over90),
    total: round2(buckets.total),
  }
}

// ─── Party ledger ────────────────────────────────────────────────────────────

export interface LedgerMovement {
  date: string
  kind: 'sale' | 'purchase' | 'payment_in' | 'payment_out' | 'return'
  amount: number
  reference: string
}

/**
 * A party's running balance. Positive means they owe us.
 *
 * The signs are the whole point. The balance this replaces ADDED receipts to
 * the customer's debt: taking money from a customer made them owe more. A
 * receipt is money arriving — it can only reduce what they owe.
 */
export function partyBalance(movements: LedgerMovement[]): number {
  let balance = 0

  for (const movement of movements) {
    switch (movement.kind) {
      case 'sale':
        balance += movement.amount // we billed them
        break
      case 'payment_in':
      case 'return':
        balance -= movement.amount // they paid, or we credited them
        break
      case 'purchase':
        balance -= movement.amount // we owe them
        break
      case 'payment_out':
        balance += movement.amount // we settled what we owed
        break
    }
  }

  return round2(balance)
}

/** The ledger with a running balance on each row, oldest first. */
export function runningLedger(movements: LedgerMovement[]) {
  const ordered = [...movements].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  let balance = 0

  return ordered.map((movement) => {
    balance = partyBalance([{ ...movement }]) + balance
    return { ...movement, balance: round2(balance) }
  })
}
