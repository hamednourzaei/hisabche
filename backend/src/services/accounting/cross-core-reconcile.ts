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
import { majorToMinor, safeCurrencyDigits } from '../../utils/money-units'
import { baseCurrencyOf } from '../base-currency'

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
  const workspaceBaseCurrency = await baseCurrencyOf(wsId).catch(() => 'AFN')
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
  const allInvoiceById = new Map(allInvoices.map((i) => [i.id, i]))
  const allPaymentById = new Map(allPayments.map((p) => [p.id, p]))
  const allocByInvoiceMinor = new Map<string, number>()
  const allocByPaymentMinor = new Map<string, number>()
  let currencyMismatchCount = 0
  let inactiveDocAllocCount = 0

  for (const a of allocations) {
    const inv = invoiceById.get(a.invoice_id)
    const pay = paymentById.get(a.payment_id)
    const anyInv = allInvoiceById.get(a.invoice_id)
    const anyPay = allPaymentById.get(a.payment_id)
    const allocCur = (
      pay?.currency ??
      inv?.currency ??
      anyPay?.currency ??
      anyInv?.currency ??
      workspaceBaseCurrency
    ).toUpperCase()
    const amtRaw = Number(a.amount)
    if (!Number.isFinite(amtRaw)) {
      throw new DatabaseError('CORRUPT_ALLOCATION_AMOUNT', new Error(a.invoice_id))
    }
    const amtMinor = majorToMinor(amtRaw, allocCur)
    allocByInvoiceMinor.set(a.invoice_id, (allocByInvoiceMinor.get(a.invoice_id) ?? 0) + amtMinor)
    allocByPaymentMinor.set(a.payment_id, (allocByPaymentMinor.get(a.payment_id) ?? 0) + amtMinor)

    if (!inv) {
      exceptions.push({
        code: 'ORPHAN_INVOICE_ALLOCATION',
        severity: 'error',
        currency: pay?.currency ?? null,
        entityType: 'payment_allocation',
        entityId: `${a.payment_id}:${a.invoice_id}`,
        amountMinor: amtMinor,
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
        amountMinor: amtMinor,
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
          amountMinor: amtMinor,
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
          amountMinor: amtMinor,
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
    const paidMinor = majorToMinor(inv.paid_amount ?? 0, cur)
    const totalMinor = majorToMinor(inv.total ?? 0, cur)
    if (paidMinor > totalMinor) {
      invoicePaidExceedsTotalCount += 1
      exceptions.push({
        code: 'INVOICE_PAID_EXCEEDS_TOTAL',
        severity: 'error',
        currency: cur,
        entityType: 'invoice',
        entityId: inv.id,
        amountMinor: paidMinor - totalMinor,
        message: `Invoice ${inv.id} paid_amount (${paidMinor}) exceeds total (${totalMinor})`,
      })
    }
    bucket.invoicePaidMinor += paidMinor
    bucket.allocatedToInvoicesMinor += allocByInvoiceMinor.get(inv.id) ?? 0
    currencyBuckets.set(cur, bucket)
  }

  for (const pay of payments) {
    const cur = pay.currency.toUpperCase()
    const bucket = currencyBuckets.get(cur) ?? initBucket()
    const allocatedMinor = allocByPaymentMinor.get(pay.id) ?? 0
    const payAmtMinor = majorToMinor(pay.amount ?? 0, cur)
    bucket.paymentsTotalMinor += payAmtMinor
    bucket.paymentsAllocatedMinor += allocatedMinor
    if (allocatedMinor > payAmtMinor) {
      bucket.overAllocatedPaymentsCount += 1
      exceptions.push({
        code: 'OVER_ALLOCATED_PAYMENT',
        severity: 'error',
        currency: cur,
        entityType: 'payment',
        entityId: pay.id,
        amountMinor: allocatedMinor - payAmtMinor,
        message: `Payment ${pay.id} allocated (${allocatedMinor}) exceeds payment amount (${payAmtMinor})`,
      })
    } else if (allocatedMinor < payAmtMinor) {
      bucket.underAllocatedPaymentsCount += 1
      bucket.unallocatedAdvancesMinor += payAmtMinor - allocatedMinor
      exceptions.push({
        code: 'UNDER_ALLOCATED_PAYMENT',
        severity: 'warning',
        currency: cur,
        entityType: 'payment',
        entityId: pay.id,
        amountMinor: payAmtMinor - allocatedMinor,
        message: `Payment ${pay.id} has unallocated advance (${payAmtMinor - allocatedMinor})`,
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
    (i) =>
      i.status !== 'draft' &&
      i.status !== 'cancelled' &&
      i.status !== 'voided' &&
      i.status !== 'awaiting_approval' &&
      majorToMinor(i.total ?? 0, i.currency.toUpperCase()) > 0 &&
      !postedInvoiceIds.has(i.id),
  )
  for (const inv of unpostedInvoices) {
    const cur = inv.currency.toUpperCase()
    exceptions.push({
      code: 'UNPOSTED_INVOICE',
      severity: 'error',
      currency: cur,
      entityType: 'invoice',
      entityId: inv.id,
      amountMinor: majorToMinor(inv.total ?? inv.paid_amount ?? 0, cur),
      message: `Eligible invoice ${inv.id} (${inv.status}) has no posted journal entry`,
    })
  }
  const unpostedPayments = payments.filter(
    (p) => p.status === 'posted' && !postedPaymentIds.has(p.id),
  )
  for (const pay of unpostedPayments) {
    const cur = pay.currency.toUpperCase()
    exceptions.push({
      code: 'UNPOSTED_PAYMENT',
      severity: 'error',
      currency: cur,
      entityType: 'payment',
      entityId: pay.id,
      amountMinor: majorToMinor(pay.amount ?? 0, cur),
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

  const orderDeposits = await fetchAllPages<{
    id: string
    amount_minor: number
    applied_invoice_id: string | null
    currency?: string | null
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

  const entryById = new Map(allJournalEntries.map((j) => [j.id, j]))
  const currencyOfEntry = (journalId: string): string => {
    const je = entryById.get(journalId)
    if (!je?.source_id) return workspaceBaseCurrency
    if (je.source_type === 'invoice') {
      return (allInvoiceById.get(je.source_id)?.currency ?? workspaceBaseCurrency).toUpperCase()
    }
    if (je.source_type === 'payment') {
      return (allPaymentById.get(je.source_id)?.currency ?? workspaceBaseCurrency).toUpperCase()
    }
    if (je.source_type === 'order_deposit') {
      const dep = orderDeposits.find((d) => d.id === je.source_id)
      return (dep?.currency ?? workspaceBaseCurrency).toUpperCase()
    }
    return workspaceBaseCurrency
  }

  let postedDebitMinor = 0
  let postedCreditMinor = 0
  let unpostedJournalLinesCount = 0
  let roundingDifference = 0
  const ledgerByCurrency = new Map<string, { debitMinor: number; creditMinor: number }>()
  const entryTotalsByJournalId = new Map<
    string,
    { debitMinor: number; creditMinor: number; hasLines: boolean }
  >()

  for (const l of journalLines) {
    const cur = currencyOfEntry(l.journal_id)
    const digits = safeCurrencyDigits(cur)
    const scale = digits === 0 ? 1 : digits === 2 ? 100 : 1000
    const dRaw = Number(l.debit)
    const cRaw = Number(l.credit)
    const dScaled = dRaw * scale
    const cScaled = cRaw * scale
    if (
      Math.abs(dScaled - Math.round(dScaled)) > 1e-4 ||
      Math.abs(cScaled - Math.round(cScaled)) > 1e-4
    ) {
      roundingDifference +=
        Math.abs(dScaled - Math.round(dScaled)) + Math.abs(cScaled - Math.round(cScaled))
    }
    const dMinor = majorToMinor(dRaw, cur)
    const cMinor = majorToMinor(cRaw, cur)

    if (!postedEntryIds.has(l.journal_id)) {
      unpostedJournalLinesCount += 1
      exceptions.push({
        code: 'UNPOSTED_JOURNAL_LINE',
        severity: 'warning',
        currency: cur,
        entityType: 'journal_line',
        entityId: l.journal_id,
        amountMinor: dMinor - cMinor,
        message: `Non-posted journal entry ${l.journal_id} excluded from posted balance`,
      })
      continue
    }

    const et = entryTotalsByJournalId.get(l.journal_id) ?? {
      debitMinor: 0,
      creditMinor: 0,
      hasLines: false,
    }
    et.debitMinor += dMinor
    et.creditMinor += cMinor
    et.hasLines = true
    entryTotalsByJournalId.set(l.journal_id, et)

    const lc = ledgerByCurrency.get(cur) ?? { debitMinor: 0, creditMinor: 0 }
    lc.debitMinor += dMinor
    lc.creditMinor += cMinor
    ledgerByCurrency.set(cur, lc)

    postedDebitMinor += dMinor
    postedCreditMinor += cMinor
  }

  let debitCreditVarianceMinor = 0
  for (const [cur, lc] of ledgerByCurrency.entries()) {
    const variance = lc.debitMinor - lc.creditMinor
    if (variance !== 0) {
      debitCreditVarianceMinor += Math.abs(variance)
      exceptions.push({
        code: 'DEBIT_CREDIT_IMBALANCE',
        severity: 'error',
        currency: cur,
        entityType: 'ledger',
        entityId: wsId,
        amountMinor: variance,
        message: `Posted debits (${lc.debitMinor}) do not equal posted credits (${lc.creditMinor}) in ${cur}`,
      })
    }
  }

  // Verify actual posted journal amounts for invoices and payments when journal lines exist
  for (const inv of invoices) {
    const cur = inv.currency.toUpperCase()
    const expectedMinor = majorToMinor(inv.total ?? 0, cur)
    const je = journalEntries.find((j) => j.source_type === 'invoice' && j.source_id === inv.id)
    if (je) {
      const totals = entryTotalsByJournalId.get(je.id)
      if (totals?.hasLines && totals.debitMinor !== expectedMinor) {
        exceptions.push({
          code: 'JOURNAL_AMOUNT_MISMATCH',
          severity: 'error',
          currency: cur,
          entityType: 'invoice',
          entityId: inv.id,
          amountMinor: Math.abs(expectedMinor - totals.debitMinor),
          message: `Invoice ${inv.id} posted journal debit (${totals.debitMinor}) differs from invoice total (${expectedMinor})`,
        })
      }
    }
  }
  for (const pay of payments) {
    const cur = pay.currency.toUpperCase()
    const expectedMinor = majorToMinor(pay.amount ?? 0, cur)
    const je = journalEntries.find((j) => j.source_type === 'payment' && j.source_id === pay.id)
    if (je) {
      const totals = entryTotalsByJournalId.get(je.id)
      if (totals?.hasLines && totals.debitMinor !== expectedMinor) {
        exceptions.push({
          code: 'JOURNAL_AMOUNT_MISMATCH',
          severity: 'error',
          currency: cur,
          entityType: 'payment',
          entityId: pay.id,
          amountMinor: Math.abs(expectedMinor - totals.debitMinor),
          message: `Payment ${pay.id} posted journal debit (${totals.debitMinor}) differs from payment amount (${expectedMinor})`,
        })
      }
    }
  }

  const totalUnallocated = [...currencyBuckets.values()].reduce(
    (s, c) => s + c.unallocatedAdvancesMinor,
    0,
  )
  let advanceLiabilityMismatch = 0
  for (const dep of orderDeposits) {
    if (dep.applied_invoice_id) continue
    const depMinor = Number(dep.amount_minor ?? 0)
    const depCur = (dep.currency ?? workspaceBaseCurrency).toUpperCase()
    const je = journalEntries.find(
      (j) => j.source_type === 'order_deposit' && j.source_id === dep.id,
    )
    if (!je) {
      advanceLiabilityMismatch += depMinor
      exceptions.push({
        code: 'ADVANCE_LIABILITY_MISMATCH',
        severity: 'warning',
        currency: depCur,
        entityType: 'order_deposit',
        entityId: dep.id,
        amountMinor: depMinor,
        message: `Unapplied customer deposit ${dep.id} lacks clearing journal entry (${depMinor})`,
      })
    } else {
      const totals = entryTotalsByJournalId.get(je.id)
      if (totals?.hasLines && totals.debitMinor !== depMinor) {
        const diff = Math.abs(depMinor - totals.debitMinor)
        advanceLiabilityMismatch += diff
        exceptions.push({
          code: 'ADVANCE_LIABILITY_MISMATCH',
          severity: 'warning',
          currency: depCur,
          entityType: 'order_deposit',
          entityId: dep.id,
          amountMinor: diff,
          message: `Unapplied customer deposit ${dep.id} journal amount (${totals.debitMinor}) differs from deposit (${depMinor})`,
        })
      }
    }
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
  const journalAmountMismatchCount = exceptions.filter(
    (e) => e.code === 'JOURNAL_AMOUNT_MISMATCH',
  ).length
  const mismatchedTotal = currencyMismatchCount + inactiveDocAllocCount + journalAmountMismatchCount
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
