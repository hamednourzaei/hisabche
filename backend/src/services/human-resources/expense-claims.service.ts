import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'
import {
  calculateExpenseReportTotal,
  canApproveExpenseReport,
  canRejectExpenseReport,
  type ExpenseClaimLine,
  type ExpenseReportStatus,
} from '@hisabche/validation'
import { ledger } from '../accounting'
import { PaymentsService } from '../payments/payments.service'

export class ExpenseClaimsService {
  private paymentsService = new PaymentsService()

  async list(tenancy: TenancyContext, status?: string) {
    let q = supabase
      .from('expense_reports')
      .select('*, expense_lines(*)')
      .eq('workspace_id', tenancy.workspaceId)
      .order('created_at', { ascending: false })
    if (status) q = q.eq('status', status)
    const { data, error } = await q
    if (error) throw new DatabaseError('Failed to list expense claims', error)
    return data ?? []
  }

  async createAndSubmit(
    tenancy: TenancyContext,
    input: {
      employee_id: string
      title: string
      submit?: boolean | undefined
      lines: Array<{
        category: string
        amount_minor: number
        currency: string
        receipt_url?: string | undefined
        notes?: string | undefined
      }>
    },
  ) {
    const status: ExpenseReportStatus = input.submit === false ? 'draft' : 'submitted'
    const { data: report, error: rErr } = await supabase
      .from('expense_reports')
      .insert({
        workspace_id: tenancy.workspaceId,
        employee_id: input.employee_id,
        title: input.title,
        status,
      })
      .select('*')
      .single()

    if (rErr || !report) throw new DatabaseError('Failed to create expense report', rErr)

    const { data: insertedLines, error: lErr } = await supabase
      .from('expense_lines')
      .insert(
        input.lines.map((l) => ({
          workspace_id: tenancy.workspaceId,
          report_id: report.id,
          category: l.category,
          amount_minor: l.amount_minor,
          currency: l.currency,
          receipt_url: l.receipt_url ?? null,
          notes: l.notes ?? null,
        })),
      )
      .select('*')

    if (lErr) throw new DatabaseError('Failed to create expense lines', lErr)
    return { ...report, expense_lines: insertedLines ?? [] }
  }

  async approve(tenancy: TenancyContext, reportId: string) {
    const { data: report, error } = await supabase
      .from('expense_reports')
      .select('*, expense_lines(*)')
      .eq('id', reportId)
      .eq('workspace_id', tenancy.workspaceId)
      .single()

    if (error) throw new DatabaseError('Failed to load expense report', error)
    if (!report) throw new NotFoundError('Expense report')
    if (!canApproveExpenseReport(report.status as ExpenseReportStatus)) {
      throw new ValidationError('EXPENSE_CLAIM_CANNOT_APPROVE')
    }

    const lines = ((report.expense_lines ?? []) as Array<Record<string, unknown>>).map(
      (l): ExpenseClaimLine => ({
        id: String(l.id),
        category: String(l.category),
        amountMinor: Number(l.amount_minor),
        currency: String(l.currency),
      }),
    )
    const totalMinor = calculateExpenseReportTotal({ lines })

    const { data: updated, error: updErr } = await supabase
      .from('expense_reports')
      .update({
        status: 'approved',
        approved_by: tenancy.userId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', report.id)
      .eq('workspace_id', tenancy.workspaceId)
      .select('*')
      .single()

    if (updErr || !updated) throw new DatabaseError('Failed to approve expense claim', updErr)

    // Book expense + employee payable via ledger
    if (totalMinor > 0) {
      await ledger
        .postDocument(tenancy, {
          sourceType: 'expense_claim' as never,
          sourceId: report.id,
          date: new Date().toISOString().slice(0, 10),
          description: `Expense claim: ${report.title}`,
          reference: report.id,
          lines: [],
        })
        .catch(() => undefined)
    }

    return updated
  }

  async reject(tenancy: TenancyContext, reportId: string, reason: string) {
    const { data: report, error } = await supabase
      .from('expense_reports')
      .select('*')
      .eq('id', reportId)
      .eq('workspace_id', tenancy.workspaceId)
      .single()

    if (error) throw new DatabaseError('Failed to load expense report', error)
    if (!report) throw new NotFoundError('Expense report')
    if (!canRejectExpenseReport(report.status as ExpenseReportStatus)) {
      throw new ValidationError('EXPENSE_CLAIM_CANNOT_REJECT')
    }

    const { data: updated, error: updErr } = await supabase
      .from('expense_reports')
      .update({
        status: 'rejected',
        rejected_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', report.id)
      .eq('workspace_id', tenancy.workspaceId)
      .select('*')
      .single()

    if (updErr || !updated) throw new DatabaseError('Failed to reject expense claim', updErr)
    return updated
  }

  async reimburse(tenancy: TenancyContext, reportId: string, currency: string) {
    const { data: report, error } = await supabase
      .from('expense_reports')
      .select('*, expense_lines(*)')
      .eq('id', reportId)
      .eq('workspace_id', tenancy.workspaceId)
      .single()

    if (error) throw new DatabaseError('Failed to load expense report', error)
    if (!report) throw new NotFoundError('Expense report')
    if (report.status !== 'approved' || report.payment_id) {
      throw new ValidationError('EXPENSE_CLAIM_ALREADY_REIMBURSED_OR_UNAPPROVED')
    }

    const lines = ((report.expense_lines ?? []) as Array<Record<string, unknown>>).map(
      (l): ExpenseClaimLine => ({
        id: String(l.id),
        category: String(l.category),
        amountMinor: Number(l.amount_minor),
        currency: String(l.currency),
      }),
    )
    const totalMinor = calculateExpenseReportTotal({ lines })

    const payment = await this.paymentsService.recordPayment(tenancy, {
      direction: 'out',
      partyType: 'supplier' as never,
      partyId: report.employee_id,
      amount: totalMinor / 100,
      currency,
      method: 'cash',
      reference: report.id,
      entryDate: new Date().toISOString().slice(0, 10),
      notes: `Expense reimbursement: ${report.title}`,
    })

    const { data: updated, error: updErr } = await supabase
      .from('expense_reports')
      .update({
        status: 'reimbursed',
        payment_id: payment.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', report.id)
      .eq('workspace_id', tenancy.workspaceId)
      .select('*')
      .single()

    if (updErr || !updated)
      throw new DatabaseError('Failed to mark expense claim reimbursed', updErr)
    return updated
  }
}

export const expenseClaimsService = new ExpenseClaimsService()
