import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'
import {
  calculateExpenseReportTotal,
  canApproveExpenseReport,
  canRejectExpenseReport,
  canReimburseExpenseReport,
  expenseReportCurrency,
  tillMinorToMajor,
  type ExpenseClaimLine,
  type ExpenseReportStatus,
} from '@hisabche/validation'
import { PaymentsService } from '../payments/payments.service'

/**
 * V61 B.2.18 — an employee pays for something, claims it back, a manager decides,
 * and the money leaves through the ONE payment path.
 *
 * ⚠️ MONEY IS MINOR UNITS OF THE CLAIM'S OWN CURRENCY. The reimbursement used to
 * call `totalMinor / 100`, which is wrong twice: AFN has no minor unit at all
 * (`tillMinorToMajor` reads the real decimal count per currency), and it applied
 * the book currency's decimals to a claim that may be in another currency.
 *
 * ⚠️ TWO CURRENCIES IN ONE CLAIM CANNOT BE ADDED. `calculateExpenseReportTotal`
 * returns null for that — the claim is refused, not silently «totalled».
 *
 * ⚠️ APPROVAL BOOKS NOTHING YET, ON PURPOSE (owner decision pending).
 * It used to call `ledger.postDocument({ lines: [] })` with
 * `sourceType: 'expense_claim' as never` and `.catch(() => undefined)` — a cast
 * around a type that does not contain it, an entry with no lines, and an error
 * swallowed. Nothing was ever posted and nothing said so. A correct entry needs
 * an expense account ROLE (there is none: `accountRoles` has `salary_expense`,
 * `cogs`, `purchase` — no operating expense), which is a schema change plus a
 * decision about which account a business's expense goes to. Until then the
 * claim is a record of a decision; the screen says so.
 */
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

  /** Reads a claim and its lines, or throws NotFound. Every read is workspace-scoped. */
  private async load(tenancy: TenancyContext, reportId: string) {
    const { data: report, error } = await supabase
      .from('expense_reports')
      .select('*, expense_lines(*)')
      .eq('id', reportId)
      .eq('workspace_id', tenancy.workspaceId)
      .single()

    if (error) throw new DatabaseError('Failed to load expense report', error)
    if (!report) throw new NotFoundError('Expense report')
    return report
  }

  private linesOf(report: { expense_lines?: unknown }): ExpenseClaimLine[] {
    const rows = Array.isArray(report.expense_lines)
      ? (report.expense_lines as Array<Record<string, unknown>>)
      : []
    return rows.map((l): ExpenseClaimLine => ({
      id: String(l.id),
      category: String(l.category),
      amountMinor: Number(l.amount_minor),
      currency: String(l.currency),
    }))
  }

  async approve(tenancy: TenancyContext, reportId: string) {
    const report = await this.load(tenancy, reportId)
    if (!canApproveExpenseReport(report.status as ExpenseReportStatus)) {
      throw new ValidationError('EXPENSE_CLAIM_CANNOT_APPROVE')
    }

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
    // No journal entry — see the class comment: there is no expense account role
    // to book to, and a fake empty posting is worse than none.
    return { ...updated, expense_lines: report.expense_lines ?? [] }
  }

  async reject(tenancy: TenancyContext, reportId: string, reason: string) {
    const report = await this.load(tenancy, reportId)
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
    return { ...updated, expense_lines: report.expense_lines ?? [] }
  }

  async reimburse(tenancy: TenancyContext, reportId: string, currency: string) {
    const report = await this.load(tenancy, reportId)
    if (!canReimburseExpenseReport(report.status as ExpenseReportStatus, report.payment_id)) {
      throw new ValidationError('EXPENSE_CLAIM_ALREADY_REIMBURSED_OR_UNAPPROVED')
    }

    const lines = this.linesOf(report)
    if (lines.length === 0) throw new ValidationError('EXPENSE_CLAIM_HAS_NO_LINES')
    // Both nulls are the same fact: lines in more than one currency have no
    // total, so the claim cannot be paid — and nothing is guessed instead.
    const claimCurrency = expenseReportCurrency(lines)
    const totalMinor = calculateExpenseReportTotal({ lines })
    if (claimCurrency === null || totalMinor === null) {
      throw new ValidationError('EXPENSE_CLAIM_MIXED_CURRENCY')
    }
    // ⚠️ No conversion here. Paying 5,000 AFN of a 5,000 USD claim is a different
    // amount of money, and a rate this module guessed would be invented.
    if (claimCurrency !== currency.toUpperCase()) {
      throw new ValidationError('EXPENSE_CLAIM_CURRENCY_MISMATCH')
    }

    const payment = await this.paymentsService.recordPayment(
      tenancy,
      {
        direction: 'out',
        // ⚠️ `payments` allows only customer|supplier (payments_party_check), and
        // an employee is neither. The payment is real — the money, the date and
        // the method are true — but its party label is a known limitation: a
        // first-class `employee` party is an owner decision, not something to
        // invent here.
        partyType: 'supplier',
        partyId: report.employee_id,
        // Minor units of the claim's own currency → major, using that currency's
        // real decimals (AFN: none). Never `/ 100`.
        amount: tillMinorToMajor(totalMinor, claimCurrency),
        currency: claimCurrency,
        method: 'cash',
        reference: report.id,
        notes: `Expense reimbursement: ${report.title}`,
        // ⚠️ A RETRIED REIMBURSEMENT IS NOT A SECOND PAYMENT. The key is the claim,
        // so a lost response and a second click both answer with the payment that
        // already exists instead of paying the employee twice.
      },
      { clientRequestId: `expense-claim:${report.id}` },
    )

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
    return { ...updated, expense_lines: report.expense_lines ?? [] }
  }
}

export const expenseClaimsService = new ExpenseClaimsService()
