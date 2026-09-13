// ============================================
// backend/src/services/accounting/operational-reports.ts
//
// Cash flow and customer debt. Both were already workspace-scoped and correct,
// so the logic is unchanged — only its home moved.
//
// NOTE ON WHERE THIS BELONGS
//   Neither of these reads the ledger. Cash flow sums `transactions`; the debt
//   report sums unpaid `invoices` against customers. They are receivables and
//   treasury reports living in the accounting module because that is where the
//   routes point today. When the Payments / AR / AP core lands they move
//   there, and the ledger core goes back to being only the ledger.
// ============================================

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import { memoryCache } from '../../utils/pagination'
import type { TenancyContext } from '../tenancy.service'

import { round2 } from './accounting.domain'
import { fetchCustomerDebtAggregate } from '../aggregates/ledger-aggregates'

interface CashFlowSection {
  inflow: number
  outflow: number
  items: Array<{ description: string; amount: number; date: string; type: string }>
}

function emptySection(): CashFlowSection {
  return { inflow: 0, outflow: 0, items: [] }
}

function summarise(section: CashFlowSection) {
  return {
    inflow: round2(section.inflow),
    outflow: round2(section.outflow),
    net: round2(section.inflow - section.outflow),
    items: section.items,
  }
}

export async function getCashFlow(ctx: TenancyContext, startDate: string, endDate: string) {
  const { workspaceId } = ctx
  const cacheKey = `accounting:${workspaceId}:cash-flow:${startDate}:${endDate}`

  const cached = await memoryCache.get(cacheKey)
  if (cached) return cached

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('type, amount, description, date')
    .eq('workspace_id', workspaceId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  if (error) throw new DatabaseError('Failed to fetch cash flow', error)

  const operating = emptySection()
  const investing = emptySection()
  const financing = emptySection()

  for (const tx of transactions ?? []) {
    const amount = Number(tx.amount) || 0
    const item = { description: tx.description || tx.type, amount, date: tx.date }

    if (['sale', 'receipt'].includes(tx.type)) {
      operating.inflow += amount
      operating.items.push({ ...item, type: 'inflow' })
    } else if (['purchase', 'payment'].includes(tx.type)) {
      operating.outflow += amount
      operating.items.push({ ...item, type: 'outflow' })
    }
  }

  const netChange =
    operating.inflow -
    operating.outflow +
    investing.inflow -
    investing.outflow +
    financing.inflow -
    financing.outflow

  const result = {
    operating: summarise(operating),
    investing: summarise(investing),
    financing: summarise(financing),
    netChange: round2(netChange),
    period: { startDate, endDate },
  }

  await memoryCache.set(cacheKey, result, 300)
  return result
}

export async function getCustomerDebtReport(ctx: TenancyContext) {
  const { workspaceId } = ctx
  const cacheKey = `accounting:${workspaceId}:customer-debt`

  const cached = await memoryCache.get(cacheKey)
  if (cached) return cached

  // ⚠️ AGGREGATED IN POSTGRES FIRST. Both reads below are capped by PostgREST
  // max-rows (1000): debtors past that vanished and totals were understated.
  // They run only while `accounting_customer_debt` is not installed.
  const aggregate = await fetchCustomerDebtAggregate(workspaceId)
  if (aggregate) {
    await memoryCache.set(cacheKey, aggregate, 120)
    return aggregate
  }

  const [customersResult, invoicesResult] = await Promise.all([
    supabase
      .from('customers')
      .select('id, full_name, opening_balance')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true),
    supabase
      .from('invoices')
      .select('customer_id, total, paid_amount')
      .eq('workspace_id', workspaceId)
      .neq('status', 'paid'),
  ])

  if (customersResult.error) {
    throw new DatabaseError('Failed to fetch customers', customersResult.error)
  }
  if (invoicesResult.error) {
    throw new DatabaseError('Failed to fetch open invoices', invoicesResult.error)
  }

  const debtMap: Record<string, { name: string; balance: number; totalInvoices: number }> = {}

  for (const customer of customersResult.data ?? []) {
    debtMap[customer.id] = {
      name: customer.full_name,
      balance: Number(customer.opening_balance) || 0,
      totalInvoices: 0,
    }
  }

  for (const invoice of invoicesResult.data ?? []) {
    const entry = invoice.customer_id ? debtMap[invoice.customer_id] : undefined
    if (!entry) continue
    entry.balance += (Number(invoice.total) || 0) - (Number(invoice.paid_amount) || 0)
    entry.totalInvoices++
  }

  const debtors = Object.values(debtMap)
    .filter((d) => d.balance > 0)
    .sort((a, b) => b.balance - a.balance)

  const creditors = Object.values(debtMap)
    .filter((d) => d.balance < 0)
    .sort((a, b) => a.balance - b.balance)

  const result = {
    debtors,
    creditors,
    totalDebt: round2(debtors.reduce((sum, d) => sum + d.balance, 0)),
    totalCredit: round2(Math.abs(creditors.reduce((sum, d) => sum + d.balance, 0))),
  }

  await memoryCache.set(cacheKey, result, 120)
  return result
}
