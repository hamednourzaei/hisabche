// ============================================
// backend/src/services/accounting/cross-core-reconcile.ts
//
// V100 Single Shared Core for Cross-Core Financial Reconciliation:
// Invoices <-> Payment Allocations <-> Payments <-> Posted Journal Entries <-> Order Deposits.
// Consumed by BOTH workspace tenant routes (`POST /api/accounting/reconcile-cross-core`)
// and Platform Admin Control Plane (`POST /api/admin/ops/reconcile-workspace`).
// ============================================

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import { fetchAllPages } from '../../utils/fetch-all-pages'

export interface CrossCoreReconcileException {
  code: string
  severity: 'error' | 'warning'
  currency: string | null
  entityType: string
  entityId: string
  amountMinor: number
  message: string
}

export interface CrossCorePerCurrencySummary {
  currency: string
  invoicePaidMinor: number
  allocatedToInvoicesMinor: number
  invoicePaidVsAllocationsVarianceMinor: number
  paymentsTotalMinor: number
  paymentsAllocatedMinor: number
  paymentsVsAllocationsVarianceMinor: number
  unallocatedAdvancesMinor: number
  underAllocatedPaymentsCount: number
  overAllocatedPaymentsCount: number
}

export interface CrossCoreReconcileResult {
  workspaceId: string
  checkedAt: string
  status: 'balanced' | 'unbalanced'
  balanced: boolean
  debits: number
  credits: number
  unallocated: number
  underallocated: number
  overallocated: number
  orphaned: number
  mismatched: number
  missingPostings: number
  duplicatePostings: number
  advanceLiabilityMismatch: number
  currencyMismatch: number
  roundingDifference: number
  reversalMismatch: number
  exceptions: CrossCoreReconcileException[]
  orphanAllocationsCount: number
  orphanPaymentAllocationsCount: number
  invoicePaidExceedsTotalCount: number
  perCurrency: CrossCorePerCurrencySummary[]
  ledger: {
    postedDebitMinor: number
    postedCreditMinor: number
    debitCreditVarianceMinor: number
    unpostedInvoicesCount: number
    unpostedPaymentsCount: number
    unpostedJournalLinesCount: number
  }
}

export async function reconcileWorkspaceCrossCore(wsId: string): Promise<CrossCoreReconcileResult> {
  const allInvoices = await fetchAllPages<{
    id: string
    currency: string
    total: number
    paid_amount: number
    status: string
  }>(
    (from, to) =>
      supabase
        .from('invoices')
        .select('id, currency, total, paid_amount, status')
        .eq('workspace_id', wsId)
        .order('id', { ascending: true })
        .range(from, to),
    'Failed to read workspace invoices for reconciliation',
  )
  const invoices = allInvoices.filter((i) => i.status !== 'cancelled')
  const cancelledInvoices = allInvoices.filter((i) => i.status === 'cancelled')

  const allPayments = await fetchAllPages<{
    id: string
    currency: string
    amount: number
    status: string
  }>(
    (from, to) =>
      supabase
        .from('payments')
        .select('id, currency, amount, status')
        .eq('workspace_id', wsId)
        .order('id', { ascending: true })
        .range(from, to),
    'Failed to read workspace payments for reconciliation',
  )
  const payments = allPayments.filter((p) => p.status !== 'cancelled' && p.status !== 'voided')
  const cancelledPayments = allPayments.filter(
    (p) => p.status === 'cancelled' || p.status === 'voided',
  )

  const allocations = await fetchAllPages<{
    payment_id: string
    invoice_id: string
    amount: number
  }>(
    (from, to) =>
      supabase
        .from('payment_allocations')
        .select('payment_id, invoice_id, amount')
        .eq('workspace_id', wsId)
        .order('payment_id', { ascending: true })
        .order('invoice_id', { ascending: true })
        .range(from, to),
    'Failed to read payment allocations for reconciliation',
  )

  const allJournalEntries = await fetchAllPages<{
    id: string
    source_type: string | null
    source_id: string | null
    reversal_of?: string | null
    status: string
  }>(
    (from, to) =>
      supabase
        .from('journal_entries')
        .select('id, source_type, source_id, reversal_of, status')
        .eq('workspace_id', wsId)
        .order('id', { ascending: true })
        .range(from, to),
    'Failed to read journal entries for reconciliation',
  )
  const journalEntries = allJournalEntries.filter((j) => j.status === 'posted')
  const postedEntryIds = new Set(journalEntries.map((j) => j.id))

  const journalLines = await fetchAllPages<{
    journal_id: string
    debit: number
    credit: number
  }>(
    (from, to) =>
      supabase
        .from('journal_lines')
        .select('journal_id, debit, credit')
        .eq('workspace_id', wsId)
        .order('id', { ascending: true })
        .range(from, to),
    'Failed to read journal lines for reconciliation',
  )

  const exceptions: CrossCoreReconcileException[] = []
  const invoiceById = new Map(invoices.map((i) => [i.id, i]))
  const paymentById = new Map(payments.map((p) => [p.id, p]))
  const allocByInvoice = new Map<string, number>()
  const allocByPayment = new Map<string, number>()
  let currencyMismatchCount = 0
  let inactiveDocAllocCount = 0

  for (const a of allocations) {
    const amt = Number(a.amount)
    if (!Number.isFinite(amt)) {
      throw new DatabaseError('CORRUPT_ALLOCATION_AMOUNT', new Error(a.invoice_id))
    }
    allocByInvoice.set(a.invoice_id, (allocByInvoice.get(a.invoice_id) ?? 0) + amt)
    allocByPayment.set(a.payment_id, (allocByPayment.get(a.payment_id) ?? 0) + amt)

    const inv = invoiceById.get(a.invoice_id)
    const pay = paymentById.get(a.payment_id)
    if (!inv) {
      exceptions.push({
        code: 'ORPHAN_INVOICE_ALLOCATION',
        severity: 'error',
        currency: pay?.currency ?? null,
        entityType: 'payment_allocation',
        entityId: `${a.payment_id}:${a.invoice_id}`,
        amountMinor: amt,
        message: `Allocation references missing invoice ${a.invoice_id}`,
      })
    }
    if (!pay) {
      exceptions.push({
        code: 'ORPHAN_PAYMENT_ALLOCATION',
        severity: 'error',
        currency: inv?.currency ?? null,
        entityType: 'payment_allocation',
        entityId: `${a.payment_id}:${a.invoice_id}`,
        amountMinor: amt,
        message: `Allocation references missing payment ${a.payment_id}`,
      })
    }
    if (inv && pay) {
      if (inv.currency.toUpperCase() !== pay.currency.toUpperCase()) {
        currencyMismatchCount += 1
        exceptions.push({
          code: 'ALLOCATION_CURRENCY_MISMATCH',
          severity: 'error',
          currency: `${pay.currency.toUpperCase()}->${inv.currency.toUpperCase()}`,
          entityType: 'payment_allocation',
          entityId: `${a.payment_id}:${a.invoice_id}`,
          amountMinor: amt,
          message: `Payment currency (${pay.currency}) differs from invoice currency (${inv.currency})`,
        })
      }
      if (inv.status === 'cancelled' || pay.status === 'cancelled' || pay.status === 'voided') {
        inactiveDocAllocCount += 1
        exceptions.push({
          code: 'ALLOCATION_ON_INACTIVE_DOCUMENT',
          severity: 'error',
          currency: inv.currency.toUpperCase(),
          entityType: 'payment_allocation',
          entityId: `${a.payment_id}:${a.invoice_id}`,
          amountMinor: amt,
          message: `Active allocation touches inactive document (${inv.status}/${pay.status})`,
        })
      }
    }
  }

  const currencyBuckets = new Map<
    string,
    {
      invoicePaidMinor: number
      allocatedToInvoicesMinor: number
      paymentsTotalMinor: number
      paymentsAllocatedMinor: number
      unallocatedAdvancesMinor: number
      underAllocatedPaymentsCount: number
      overAllocatedPaymentsCount: number
    }
  >()
  const initBucket = () => ({
    invoicePaidMinor: 0,
    allocatedToInvoicesMinor: 0,
    paymentsTotalMinor: 0,
    paymentsAllocatedMinor: 0,
    unallocatedAdvancesMinor: 0,
    underAllocatedPaymentsCount: 0,
    overAllocatedPaymentsCount: 0,
  })

  let invoicePaidExceedsTotalCount = 0
  for (const inv of invoices) {
    const cur = inv.currency.toUpperCase()
    const bucket = currencyBuckets.get(cur) ?? initBucket()
    const paidMinor = Number(inv.paid_amount)
    if (Number.isFinite(Number(inv.total)) && paidMinor > Number(inv.total)) {
      invoicePaidExceedsTotalCount += 1
      exceptions.push({
        code: 'INVOICE_PAID_EXCEEDS_TOTAL',
        severity: 'error',
        currency: cur,
        entityType: 'invoice',
        entityId: inv.id,
        amountMinor: paidMinor - Number(inv.total),
        message: `Invoice ${inv.id} paid_amount (${paidMinor}) exceeds total (${inv.total})`,
      })
    }
    bucket.invoicePaidMinor += paidMinor
    bucket.allocatedToInvoicesMinor += allocByInvoice.get(inv.id) ?? 0
    currencyBuckets.set(cur, bucket)
  }

  for (const pay of payments) {
    const cur = pay.currency.toUpperCase()
    const bucket = currencyBuckets.get(cur) ?? initBucket()
    const allocated = allocByPayment.get(pay.id) ?? 0
    const payAmt = Number(pay.amount)
    bucket.paymentsTotalMinor += payAmt
    bucket.paymentsAllocatedMinor += allocated
    if (allocated > payAmt) {
      bucket.overAllocatedPaymentsCount += 1
      exceptions.push({
        code: 'OVER_ALLOCATED_PAYMENT',
        severity: 'error',
        currency: cur,
        entityType: 'payment',
        entityId: pay.id,
        amountMinor: allocated - payAmt,
        message: `Payment ${pay.id} allocated (${allocated}) exceeds payment amount (${payAmt})`,
      })
    } else if (allocated < payAmt) {
      bucket.underAllocatedPaymentsCount += 1
      bucket.unallocatedAdvancesMinor += payAmt - allocated
      exceptions.push({
        code: 'UNDER_ALLOCATED_PAYMENT',
        severity: 'warning',
        currency: cur,
        entityType: 'payment',
        entityId: pay.id,
        amountMinor: payAmt - allocated,
        message: `Payment ${pay.id} has unallocated advance (${payAmt - allocated})`,
      })
    }
    currencyBuckets.set(cur, bucket)
  }

  const postedInvoiceIds = new Set(
    journalEntries
      .filter((j) => j.source_type === 'invoice' && j.source_id)
      .map((j) => j.source_id!),
  )
  const postedPaymentIds = new Set(
    journalEntries
      .filter((j) => j.source_type === 'payment' && j.source_id)
      .map((j) => j.source_id!),
  )

  const unpostedInvoices = invoices.filter(
    (i) => i.status === 'completed' && !postedInvoiceIds.has(i.id),
  )
  for (const inv of unpostedInvoices) {
    exceptions.push({
      code: 'UNPOSTED_INVOICE',
      severity: 'error',
      currency: inv.currency.toUpperCase(),
      entityType: 'invoice',
      entityId: inv.id,
      amountMinor: Number(inv.total ?? inv.paid_amount ?? 0),
      message: `Completed invoice ${inv.id} has no posted journal entry`,
    })
  }
  const unpostedPayments = payments.filter(
    (p) => p.status === 'posted' && !postedPaymentIds.has(p.id),
  )
  for (const pay of unpostedPayments) {
    exceptions.push({
      code: 'UNPOSTED_PAYMENT',
      severity: 'error',
      currency: pay.currency.toUpperCase(),
      entityType: 'payment',
      entityId: pay.id,
      amountMinor: Number(pay.amount),
      message: `Posted payment ${pay.id} has no posted journal entry`,
    })
  }
  const unpostedInvoicesCount = unpostedInvoices.length
  const unpostedPaymentsCount = unpostedPayments.length
  const missingPostings = unpostedInvoicesCount + unpostedPaymentsCount

  const entriesBySource = new Map<string, string[]>()
  const reversalsTargetIds = new Set(
    allJournalEntries
      .filter((j) => (j.status === 'posted' || j.status === 'reversed') && j.reversal_of)
      .map((j) => j.reversal_of!),
  )
  let duplicatePostings = 0
  for (const je of journalEntries) {
    if (!je.source_type || !je.source_id) continue
    const srcKey = `${je.source_type}:${je.source_id}`
    const list = entriesBySource.get(srcKey) ?? []
    list.push(je.id)
    entriesBySource.set(srcKey, list)
    if (list.length === 2) {
      duplicatePostings += 1
      exceptions.push({
        code: 'DUPLICATE_POSTING',
        severity: 'error',
        currency: null,
        entityType: je.source_type,
        entityId: je.source_id,
        amountMinor: 0,
        message: `Source ${srcKey} has multiple posted journal entries (${list.join(', ')})`,
      })
    }
  }

  let reversalMismatch = 0
  for (const inv of cancelledInvoices) {
    const activePosted = journalEntries.filter(
      (j) => j.source_type === 'invoice' && j.source_id === inv.id && !reversalsTargetIds.has(j.id),
    )
    if (activePosted.length > 0) {
      reversalMismatch += 1
      exceptions.push({
        code: 'REVERSAL_MISMATCH',
        severity: 'error',
        currency: inv.currency.toUpperCase(),
        entityType: 'invoice',
        entityId: inv.id,
        amountMinor: Number(inv.total ?? 0),
        message: `Cancelled invoice ${inv.id} still has unreversed posted entry`,
      })
    }
  }
  for (const pay of cancelledPayments) {
    const activePosted = journalEntries.filter(
      (j) => j.source_type === 'payment' && j.source_id === pay.id && !reversalsTargetIds.has(j.id),
    )
    if (activePosted.length > 0) {
      reversalMismatch += 1
      exceptions.push({
        code: 'REVERSAL_MISMATCH',
        severity: 'error',
        currency: pay.currency.toUpperCase(),
        entityType: 'payment',
        entityId: pay.id,
        amountMinor: Number(pay.amount ?? 0),
        message: `Cancelled payment ${pay.id} still has unreversed posted entry`,
      })
    }
  }

  let postedDebitMinor = 0
  let postedCreditMinor = 0
  let unpostedJournalLinesCount = 0
  let roundingDifference = 0
  for (const l of journalLines) {
    const dRaw = Number(l.debit)
    const cRaw = Number(l.credit)
    if (Math.abs(dRaw - Math.round(dRaw)) > 1e-6 || Math.abs(cRaw - Math.round(cRaw)) > 1e-6) {
      roundingDifference += Math.abs(dRaw - Math.round(dRaw)) + Math.abs(cRaw - Math.round(cRaw))
    }
    if (!postedEntryIds.has(l.journal_id)) {
      unpostedJournalLinesCount += 1
      exceptions.push({
        code: 'UNPOSTED_JOURNAL_LINE',
        severity: 'warning',
        currency: null,
        entityType: 'journal_line',
        entityId: l.journal_id,
        amountMinor: Math.round(dRaw) - Math.round(cRaw),
        message: `Non-posted journal entry ${l.journal_id} excluded from posted balance`,
      })
      continue
    }
    postedDebitMinor += dRaw
    postedCreditMinor += cRaw
  }
  const debitCreditVarianceMinor = Math.round(postedDebitMinor - postedCreditMinor)
  if (debitCreditVarianceMinor !== 0) {
    exceptions.push({
      code: 'DEBIT_CREDIT_IMBALANCE',
      severity: 'error',
      currency: null,
      entityType: 'ledger',
      entityId: wsId,
      amountMinor: debitCreditVarianceMinor,
      message: `Posted debits (${postedDebitMinor}) do not equal posted credits (${postedCreditMinor})`,
    })
  }

  const orderDeposits = await fetchAllPages<{
    id: string
    amount_minor: number
    applied_invoice_id: string | null
  }>(
    (from, to) =>
      supabase
        .from('order_deposits')
        .select('id, amount_minor, applied_invoice_id')
        .eq('workspace_id', wsId)
        .order('id', { ascending: true })
        .range(from, to),
    'Failed to read order deposits for reconciliation',
  )
  const unappliedDepositsMinor = orderDeposits
    .filter((d) => !d.applied_invoice_id)
    .reduce((s, d) => s + Number(d.amount_minor ?? 0), 0)
  const totalUnallocated = [...currencyBuckets.values()].reduce(
    (s, c) => s + c.unallocatedAdvancesMinor,
    0,
  )
  const depositUnpostedCount = orderDeposits.filter(
    (d) =>
      !d.applied_invoice_id &&
      !journalEntries.some((j) => j.source_type === 'order_deposit' && j.source_id === d.id),
  ).length
  const advanceLiabilityMismatch =
    depositUnpostedCount > 0 ? Math.max(unappliedDepositsMinor, totalUnallocated) : 0
  if (advanceLiabilityMismatch > 0) {
    exceptions.push({
      code: 'ADVANCE_LIABILITY_MISMATCH',
      severity: 'warning',
      currency: null,
      entityType: 'order_deposit',
      entityId: wsId,
      amountMinor: advanceLiabilityMismatch,
      message: `${depositUnpostedCount} unapplied customer deposit(s) lack clearing journal entries`,
    })
  }

  const perCurrency: CrossCorePerCurrencySummary[] = [...currencyBuckets.entries()].map(
    ([currency, b]) => {
      if (b.invoicePaidMinor !== b.allocatedToInvoicesMinor) {
        exceptions.push({
          code: 'INVOICE_PAID_VS_ALLOCATIONS_VARIANCE',
          severity: 'error',
          currency,
          entityType: 'currency_bucket',
          entityId: currency,
          amountMinor: b.invoicePaidMinor - b.allocatedToInvoicesMinor,
          message: `Invoice paid_amount (${b.invoicePaidMinor}) differs from allocated total (${b.allocatedToInvoicesMinor}) in ${currency}`,
        })
      }
      return {
        currency,
        invoicePaidMinor: b.invoicePaidMinor,
        allocatedToInvoicesMinor: b.allocatedToInvoicesMinor,
        invoicePaidVsAllocationsVarianceMinor: b.invoicePaidMinor - b.allocatedToInvoicesMinor,
        paymentsTotalMinor: b.paymentsTotalMinor,
        paymentsAllocatedMinor: b.paymentsAllocatedMinor,
        paymentsVsAllocationsVarianceMinor: b.paymentsAllocatedMinor - b.allocatedToInvoicesMinor,
        unallocatedAdvancesMinor: b.unallocatedAdvancesMinor,
        underAllocatedPaymentsCount: b.underAllocatedPaymentsCount,
        overAllocatedPaymentsCount: b.overAllocatedPaymentsCount,
      }
    },
  )

  const orphanAllocationsCount = allocations.filter((a) => !invoiceById.has(a.invoice_id)).length
  const orphanPaymentAllocationsCount = allocations.filter(
    (a) => !paymentById.has(a.payment_id),
  ).length
  const totalUnderallocated = perCurrency.reduce((s, c) => s + c.underAllocatedPaymentsCount, 0)
  const totalOverallocated = perCurrency.reduce((s, c) => s + c.overAllocatedPaymentsCount, 0)
  const orphanedTotal = orphanAllocationsCount + orphanPaymentAllocationsCount
  const mismatchedTotal = currencyMismatchCount + inactiveDocAllocCount
  const balanced =
    debitCreditVarianceMinor === 0 &&
    missingPostings === 0 &&
    duplicatePostings === 0 &&
    reversalMismatch === 0 &&
    advanceLiabilityMismatch === 0 &&
    Math.abs(roundingDifference) < 1e-6 &&
    orphanedTotal === 0 &&
    mismatchedTotal === 0 &&
    invoicePaidExceedsTotalCount === 0 &&
    perCurrency.every(
      (c) =>
        c.invoicePaidVsAllocationsVarianceMinor === 0 &&
        c.paymentsVsAllocationsVarianceMinor === 0 &&
        c.overAllocatedPaymentsCount === 0,
    )

  return {
    workspaceId: wsId,
    checkedAt: new Date().toISOString(),
    status: balanced ? ('balanced' as const) : ('unbalanced' as const),
    balanced,
    debits: postedDebitMinor,
    credits: postedCreditMinor,
    unallocated: totalUnallocated,
    underallocated: totalUnderallocated,
    overallocated: totalOverallocated,
    orphaned: orphanedTotal,
    mismatched: mismatchedTotal,
    missingPostings,
    duplicatePostings,
    advanceLiabilityMismatch,
    currencyMismatch: currencyMismatchCount,
    roundingDifference: Number(roundingDifference.toFixed(6)),
    reversalMismatch,
    exceptions,
    orphanAllocationsCount,
    orphanPaymentAllocationsCount,
    invoicePaidExceedsTotalCount,
    perCurrency,
    ledger: {
      postedDebitMinor,
      postedCreditMinor,
      debitCreditVarianceMinor,
      unpostedInvoicesCount,
      unpostedPaymentsCount,
      unpostedJournalLinesCount,
    },
  }
}
