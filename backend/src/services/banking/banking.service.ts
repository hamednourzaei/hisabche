// ============================================
// backend/src/services/banking/banking.service.ts
//
// Importing a bank statement and reconciling it against the books.
// ============================================

import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import type { TenancyContext } from '../tenancy.service'

import {
  statementLineKey,
  suggestMatches,
  summariseReconciliation,
  validateReconcile,
  type BookEntry,
  type StatementLine,
} from './reconciliation.domain'

function mapLine(raw: Record<string, any>): StatementLine {
  return {
    id: raw.id,
    externalRef: raw.external_ref ?? null,
    onDate: String(raw.on_date ?? '').slice(0, 10),
    amountMinor: Number(raw.amount_minor) || 0,
    description: raw.description ?? '',
    matchedTo: raw.matched_to ?? null,
  }
}

export class BankingService {
  private async invalidate(workspaceId: string) {
    await memoryCache.invalidate(`banking:${workspaceId}`)
  }

  /**
   * Import a statement.
   *
   * Lines are keyed on the bank's own reference where there is one, so a file
   * imported twice — which happens constantly, because people re-download
   * when they are unsure — produces the same lines rather than a duplicate set
   * that doubles the account.
   */
  /**
   * The statements imported for this workspace, newest first.
   *
   * Without this a reconciliation screen is only reachable in the seconds
   * after an import: every other endpoint here is keyed by a statement id the
   * user has no way to look up. A capability nobody can navigate to is not a
   * capability.
   */
  async listStatements(ctx: TenancyContext, accountId?: string) {
    let query = supabase
      .from('bank_statements')
      .select(
        'id, account_id, statement_date, opening_balance_minor, closing_balance_minor, imported_at',
      )
      .eq('workspace_id', ctx.workspaceId)
      .order('statement_date', { ascending: false })
      .limit(200)

    if (accountId) query = query.eq('account_id', accountId)

    const { data, error } = await query
    if (error) throw new DatabaseError('Failed to fetch statements', error)

    return (data ?? []).map((row: Record<string, any>) => ({
      id: row.id,
      accountId: row.account_id,
      statementDate: String(row.statement_date ?? '').slice(0, 10),
      openingBalanceMinor: Number(row.opening_balance_minor) || 0,
      closingBalanceMinor: Number(row.closing_balance_minor) || 0,
      importedAt: row.imported_at ?? null,
    }))
  }

  async importStatement(
    ctx: TenancyContext,
    input: {
      accountId: string
      statementDate: string
      openingBalanceMinor: number
      closingBalanceMinor: number
      lines: Array<{
        externalRef?: string | null | undefined
        onDate: string
        amountMinor: number
        description: string
      }>
    },
  ) {
    if (ctx.role === 'seller') throw new ConflictError('BANK_IMPORT_FORBIDDEN')
    if (input.lines.length === 0) throw new ValidationError('BANK_STATEMENT_EMPTY')

    const { data: statement, error } = await supabase
      .from('bank_statements')
      .insert({
        workspace_id: ctx.workspaceId,
        account_id: input.accountId,
        statement_date: input.statementDate.slice(0, 10),
        opening_balance_minor: input.openingBalanceMinor,
        closing_balance_minor: input.closingBalanceMinor,
        imported_by: ctx.userId,
      })
      .select('id')
      .single()

    if (error) throw new DatabaseError('Failed to create the statement', error)

    const rows = input.lines.map((line, index) => ({
      workspace_id: ctx.workspaceId,
      statement_id: statement.id,
      line_key: statementLineKey(
        {
          externalRef: line.externalRef ?? null,
          onDate: line.onDate,
          amountMinor: line.amountMinor,
          description: line.description,
        },
        index,
      ),
      external_ref: line.externalRef ?? null,
      on_date: line.onDate.slice(0, 10),
      amount_minor: line.amountMinor,
      description: line.description,
    }))

    const { error: linesError } = await supabase
      .from('bank_statement_lines')
      .upsert(rows, { onConflict: 'workspace_id,statement_id,line_key', ignoreDuplicates: true })

    if (linesError) throw new DatabaseError('Failed to import the statement lines', linesError)

    await this.invalidate(ctx.workspaceId)
    return { statementId: statement.id, imported: rows.length }
  }

  private async loadLines(ctx: TenancyContext, statementId: string): Promise<StatementLine[]> {
    const { data, error } = await supabase
      .from('bank_statement_lines')
      .select('id, external_ref, on_date, amount_minor, description, matched_to')
      .eq('workspace_id', ctx.workspaceId)
      .eq('statement_id', statementId)
      .order('on_date')
      .limit(5000)

    if (error) throw new DatabaseError('Failed to fetch statement lines', error)
    return (data ?? []).map(mapLine)
  }

  /**
   * Candidate book entries for a statement's date window.
   *
   * Payments and journal entries within a month either side. Anything further
   * away is not the same transaction whatever the amount says, so fetching it
   * only makes the scoring slower and the suggestions worse.
   */
  private async loadBookEntries(
    ctx: TenancyContext,
    accountId: string,
    from: string,
    to: string,
  ): Promise<BookEntry[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('id, payment_number, direction, amount, entry_date, party_id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('status', 'posted')
      .gte('entry_date', from)
      .lte('entry_date', to)
      .limit(2000)

    if (error) throw new DatabaseError('Failed to fetch payments', error)

    return (data ?? []).map((row) => ({
      id: row.id,
      kind: 'payment' as const,
      onDate: String(row.entry_date ?? '').slice(0, 10),
      // Money in is positive, matching the statement's convention.
      amountMinor: Math.round((Number(row.amount) || 0) * 100) * (row.direction === 'in' ? 1 : -1),
      reference: row.payment_number ?? row.id,
      partyName: null,
    }))
  }

  async getSuggestions(ctx: TenancyContext, statementId: string) {
    const { data: statement, error } = await supabase
      .from('bank_statements')
      .select('id, account_id, statement_date')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', statementId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch the statement', error)
    if (!statement) throw new NotFoundError('Bank statement')

    const lines = await this.loadLines(ctx, statementId)
    if (lines.length === 0) return { statementId, suggestions: [] }

    const dates = lines.map((line) => line.onDate).sort()
    const windowStart = dates[0]!
    const windowEnd = dates[dates.length - 1]!

    const entries = await this.loadBookEntries(ctx, statement.account_id, windowStart, windowEnd)

    return { statementId, suggestions: suggestMatches(lines, entries) }
  }

  /**
   * Confirm one match.
   *
   * A person confirms every one. A confident automatic match on the wrong
   * payment moves money between two customers' accounts, and the person who
   * finds out is the one chased for a debt they already paid.
   */
  async reconcile(
    ctx: TenancyContext,
    input: {
      statementLineId: string
      bookEntryId: string
      differenceReason?: string | undefined
    },
  ) {
    if (ctx.role === 'seller') throw new ConflictError('BANK_RECONCILE_FORBIDDEN')

    const { data: line, error } = await supabase
      .from('bank_statement_lines')
      .select('id, external_ref, on_date, amount_minor, description, matched_to')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', input.statementLineId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch the statement line', error)
    if (!line) throw new NotFoundError('Statement line')

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, payment_number, direction, amount, entry_date')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', input.bookEntryId)
      .maybeSingle()

    if (paymentError) throw new DatabaseError('Failed to fetch the payment', paymentError)
    if (!payment) throw new NotFoundError('Payment')

    const entry: BookEntry = {
      id: payment.id,
      kind: 'payment',
      onDate: String(payment.entry_date ?? '').slice(0, 10),
      amountMinor:
        Math.round((Number(payment.amount) || 0) * 100) * (payment.direction === 'in' ? 1 : -1),
      reference: payment.payment_number ?? payment.id,
    }

    const problems = validateReconcile(mapLine(line), entry, {
      ...(input.differenceReason ? { differenceReason: input.differenceReason } : {}),
    })
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    const { error: updateError } = await supabase
      .from('bank_statement_lines')
      .update({
        matched_to: input.bookEntryId,
        matched_at: new Date().toISOString(),
        matched_by: ctx.userId,
        difference_reason: input.differenceReason ?? null,
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', input.statementLineId)
      // Only an UNMATCHED line matches. Two people confirming at once means
      // the second finds nothing to update rather than overwriting the first.
      .is('matched_to', null)

    if (updateError) throw new DatabaseError('Failed to record the match', updateError)

    await this.invalidate(ctx.workspaceId)
    return { statementLineId: input.statementLineId, bookEntryId: input.bookEntryId }
  }

  async unmatch(ctx: TenancyContext, statementLineId: string) {
    if (ctx.role === 'seller') throw new ConflictError('BANK_RECONCILE_FORBIDDEN')

    const { error } = await supabase
      .from('bank_statement_lines')
      .update({ matched_to: null, matched_at: null, matched_by: null })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', statementLineId)

    if (error) throw new DatabaseError('Failed to unmatch', error)
    await this.invalidate(ctx.workspaceId)
  }

  /**
   * The reconciliation statement.
   *
   * The value is not the difference figure — it is that the difference is
   * ENUMERATED. "Out by 4,300" is a problem; "out by 4,300, which is these
   * three uncleared cheques" is a reconciliation.
   */
  async getReconciliation(ctx: TenancyContext, statementId: string) {
    const { data: statement, error } = await supabase
      .from('bank_statements')
      .select('id, account_id, closing_balance_minor')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', statementId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch the statement', error)
    if (!statement) throw new NotFoundError('Bank statement')

    const lines = await this.loadLines(ctx, statementId)
    const dates = lines.map((line) => line.onDate).sort()

    const entries =
      dates.length > 0
        ? await this.loadBookEntries(ctx, statement.account_id, dates[0]!, dates[dates.length - 1]!)
        : []

    const bookBalanceMinor = entries.reduce((sum, entry) => sum + entry.amountMinor, 0)

    return summariseReconciliation(
      lines,
      entries,
      Number(statement.closing_balance_minor) || 0,
      bookBalanceMinor,
    )
  }
}
