// ============================================
// backend/src/services/aggregates/ledger-aggregates.ts
//
// Database-side aggregates for the customer-debt report and the budget
// consumption check. SQL: docs/perf-aggregates-ledger-migration.sql
//
// `null` means ONLY «function not installed» — the caller runs its original
// path. Any other failure throws (see aggregate-rpc.ts).
// ============================================

import { z } from 'zod'

import { round2 } from '../accounting/accounting.domain'
import { callAggregate } from './aggregate-rpc'

// ─── Customer debt ──────────────────────────────────────────────────────────

const debtEntry = z.object({ name: z.string(), balance: z.number(), total_invoices: z.number() })

const customerDebtSchema = z.object({
  debtors: z.array(debtEntry),
  creditors: z.array(debtEntry),
})

export interface CustomerDebtReport {
  debtors: { name: string; balance: number; totalInvoices: number }[]
  creditors: { name: string; balance: number; totalInvoices: number }[]
  totalDebt: number
  totalCredit: number
}

export async function fetchCustomerDebtAggregate(
  workspaceId: string,
): Promise<CustomerDebtReport | null> {
  const agg = await callAggregate(
    'accounting_customer_debt',
    { p_workspace_id: workspaceId },
    customerDebtSchema,
  )
  if (!agg) return null

  const toEntry = (e: z.infer<typeof debtEntry>) => ({
    name: e.name,
    balance: e.balance,
    totalInvoices: e.total_invoices,
  })
  const debtors = agg.debtors.map(toEntry)
  const creditors = agg.creditors.map(toEntry)

  return {
    debtors,
    creditors,
    totalDebt: round2(debtors.reduce((sum, d) => sum + d.balance, 0)),
    totalCredit: round2(Math.abs(creditors.reduce((sum, d) => sum + d.balance, 0))),
  }
}

// ─── Budget consumption ─────────────────────────────────────────────────────

const budgetConsumptionSchema = z.object({
  actual_minor: z.number().int(),
  committed_minor: z.number().int(),
})

export async function fetchBudgetConsumptionAggregate(
  workspaceId: string,
  budgetId: string,
  accountId: string,
  start: string,
  end: string,
): Promise<{ actualMinor: number; committedMinor: number } | null> {
  const agg = await callAggregate(
    'budget_consumption',
    {
      p_workspace_id: workspaceId,
      p_budget_id: budgetId,
      p_account_id: accountId,
      p_start: start,
      p_end: end,
    },
    budgetConsumptionSchema,
  )
  if (!agg) return null
  return { actualMinor: agg.actual_minor, committedMinor: agg.committed_minor }
}
