// ============================================
// backend/src/services/banking/banking.service.ts
//
// Importing a bank statement and reconciling it against the books.
// ============================================

import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import { fetchAllPages } from '../../utils/fetch-all-pages'
import type { TenancyContext } from '../tenancy.service'
import { learnPatterns, learnedBonus } from './match-learning.domain'

import {
  statementLineKey,
  suggestMatches,
  summariseReconciliation,
  validateReconcile,
  type BookEntry,
  type StatementLine,
} from './reconciliation.domain'

/**
 * J2 — does this error mean `bank_statement_lines.matched_kind` has not been
 * created yet, rather than that the write is wrong?
 *
 *   42703    — undefined_column (Postgres)
 *   PGRST204 — PostgREST could not find the column in its schema cache
 */
function isMissingMatchedKind(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42703' || error.code === 'PGRST204') return true
  return /matched_kind/i.test(error.message ?? '')
}

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
    // ⚠️ EVERY line, in ordered pages. `.limit(5000)` was silently capped at
    // PostgREST max-rows (1000), and the reconciliation difference was then
    // computed over a statement missing its tail.
    const data = await fetchAllPages(
      (from, to) =>
        supabase
          .from('bank_statement_lines')
          .select('id, external_ref, on_date, amount_minor, description, matched_to')
          .eq('workspace_id', ctx.workspaceId)
          .eq('statement_id', statementId)
          .order('on_date')
          .order('id', { ascending: true })
          .range(from, to),
      'Failed to fetch statement lines',
    )
    return data.map(mapLine)
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
    // ─── J2.2 — TWO candidate sources, not one ───────────────────────────────
    //
    // This read `payments` alone. Not because payments are the right scope —
    // `reconciliation.domain.ts` has modelled `kind: 'payment' | 'invoice' |
    // 'journal'` and scored all three since it was written — but because
    // `bank_statement_lines.matched_to` was a bare uuid with no kind, so a
    // match to anything else could never be resolved back.
    //
    // phase-j-02 adds `matched_kind`, which is what makes a second source
    // safe. Journal entries are added first because they are what a bank fee,
    // an interest credit or a manual adjustment actually IS in this system —
    // the very lines a statement carries and `payments` never explains.
    //
    // ⚠️ Both read EVERY row, in ordered pages. They were `.limit(2000)`, which
    // PostgREST silently caps at max-rows (1000) — and `getReconciliation` sums
    // these entries into the book balance, so a busy month reconciled against
    // a truncated book.
    const [payments, journals] = await Promise.all([
      fetchAllPages(
        (pageFrom, pageTo) =>
          supabase
            .from('payments')
            .select('id, payment_number, direction, amount, entry_date, party_id')
            .eq('workspace_id', ctx.workspaceId)
            .eq('status', 'posted')
            .gte('entry_date', from)
            .lte('entry_date', to)
            .order('id', { ascending: true })
            .range(pageFrom, pageTo),
        'Failed to fetch payments',
      ),

      // Only entries touching THIS bank account, and only posted ones. A draft
      // is not money that moved, and an entry on an unrelated account is noise
      // that makes every suggestion worse.
      fetchAllPages(
        (pageFrom, pageTo) =>
          supabase
            .from('journal_entries')
            .select(
              'id, entry_number, date, description, journal_lines!inner(account_id, debit, credit)',
            )
            .eq('workspace_id', ctx.workspaceId)
            .eq('status', 'posted')
            .eq('journal_lines.account_id', accountId)
            .gte('date', from)
            .lte('date', to)
            .order('id', { ascending: true })
            .range(pageFrom, pageTo),
        'Failed to fetch journal candidates',
      ).then(
        (data) => ({ data, error: null }),
        (error: unknown) => ({ data: null, error: error as Error }),
      ),
    ])

    const entries: BookEntry[] = payments.map((row) => ({
      id: row.id,
      kind: 'payment' as const,
      onDate: String(row.entry_date ?? '').slice(0, 10),
      // Money in is positive, matching the statement's convention.
      amountMinor: Math.round((Number(row.amount) || 0) * 100) * (row.direction === 'in' ? 1 : -1),
      reference: row.payment_number ?? row.id,
      partyName: null,
    }))

    if (journals.error) {
      // Degraded, not broken: the payment candidates are still worth offering.
      // Reported rather than swallowed — a matcher quietly showing half its
      // candidates looks like "no match found" (lesson 4).
      console.warn(
        '[BankingService] journal candidates unavailable; suggesting payments only.',
        journals.error.message,
      )
      return entries
    }

    for (const row of (journals.data ?? []) as Record<string, any>[]) {
      const lines = (row.journal_lines ?? []) as Record<string, any>[]

      // The entry's effect ON THIS ACCOUNT, not its total. A four-line entry
      // that moves 500 through the bank and 500 through two other accounts
      // must offer 500 as a candidate, not its gross.
      //
      // Debit on a bank (asset) account is money IN — the same sign the
      // statement uses.
      const netMinor = lines.reduce(
        (sum, line) =>
          sum + Math.round(((Number(line.debit) || 0) - (Number(line.credit) || 0)) * 100),
        0,
      )

      if (netMinor === 0) continue

      entries.push({
        id: row.id,
        kind: 'journal',
        onDate: String(row.date ?? '').slice(0, 10),
        amountMinor: netMinor,
        reference: row.entry_number ?? row.id,
        partyName: row.description ?? null,
      })
    }

    return entries
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

    // ─── N1 — what previous reconciliations teach this one ─────────────────
    //
    // `suggestMatches` already scores reference, amount, date and party. The
    // signal it lacked is HISTORY: a bill arriving every month as «DABS KABUL
    // 4471» has been matched to the same supplier eleven times and was still
    // scored from scratch.
    //
    // The hint only ever RAISES a score, is capped below the exact-reference
    // signal, and reconciles nothing — a person still confirms every match.
    const learned = await this.learnedPatterns(ctx)

    const suggestions = suggestMatches(lines, entries).map((suggestion) => {
      const line = lines.find((candidate) => candidate.id === suggestion.statementLineId)
      const entry = entries.find((candidate) => candidate.id === suggestion.bookEntryId)
      if (!line || !entry) return suggestion

      // Keyed on the PARTY NAME, not the entry id: an entry id is unique to one
      // month's payment and would make every pattern unlearnable.
      const { bonus, pattern } = learnedBonus(line.description, entry.partyName ?? null, learned)
      if (bonus <= 0) return suggestion

      // Capped at 1: a bonus that pushed a score past certainty would make a
      // habit look like a fact.
      const score = Math.min(1, suggestion.score + bonus)

      return {
        ...suggestion,
        score,
        reasons: [...suggestion.reasons, 'learned_pattern' as const],
        learnedPattern: pattern,
      }
    })

    return { statementId, suggestions }
  }

  /**
   * N1 — the confirmed matches this workspace has already made.
   *
   * Read from lines that a person actually reconciled. Unconfirmed suggestions
   * are deliberately NOT included: learning from the system's own guesses is
   * how one early mistake becomes self-reinforcing.
   */
  private async learnedPatterns(ctx: TenancyContext) {
    const { data, error } = await supabase
      .from('bank_statement_lines')
      .select('description, matched_party')
      .eq('workspace_id', ctx.workspaceId)
      .not('matched_party', 'is', null)
      .order('on_date', { ascending: false })
      // The most recent thousand confirmed matches — a heuristic's sample, not
      // a total, so bounded on purpose. It said 2000; PostgREST returns at
      // most 1000 (max-rows), so the number now says what actually happens.
      .limit(1000)

    // History is an enhancement. Without it the suggestions are exactly what
    // they were before N1, which is a working feature — failing the whole
    // reconciliation screen over it would be a worse trade.
    if (error || !data) return new Map()

    return learnPatterns(
      data.map((row: Record<string, any>) => ({
        description: String(row.description ?? ''),
        counterpartyId: String(row.matched_party),
      })),
    )
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

    // J2.2 — the target may be a payment OR a journal entry. Which one it is
    // gets recorded, because `matched_to` alone cannot say.
    const entry = await this.resolveBookEntry(ctx, input.bookEntryId)
    if (!entry) throw new NotFoundError('Book entry')

    const problems = validateReconcile(mapLine(line), entry, {
      ...(input.differenceReason ? { differenceReason: input.differenceReason } : {}),
    })
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    const values: Record<string, unknown> = {
      matched_to: input.bookEntryId,
      matched_kind: entry.kind,
      matched_at: new Date().toISOString(),
      matched_by: ctx.userId,
      difference_reason: input.differenceReason ?? null,
      // N1 — the stable fact, kept so the scorer can learn from it.
      //
      // `matched_to` is the ENTRY id: unique to this month's payment, and
      // therefore useless as a pattern. The party name is what repeats, and it
      // is discarded the moment this method returns unless it is written here.
      matched_party: entry.partyName ?? null,
    }

    const write = (payload: Record<string, unknown>) =>
      supabase
        .from('bank_statement_lines')
        .update(payload)
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', input.statementLineId)
        // Only an UNMATCHED line matches. Two people confirming at once means
        // the second finds nothing to update rather than overwriting the first.
        .is('matched_to', null)

    let { error: updateError } = await write(values)

    if (updateError && isMissingMatchedKind(updateError)) {
      // ⚠️ A JOURNAL match is REFUSED before the migration, not silently
      // downgraded. Writing it without the kind puts back the exact ambiguity
      // phase-j-02 exists to remove — and a later reader would resolve it as a
      // payment id that does not exist.
      if (entry.kind !== 'payment') {
        throw new ConflictError(
          'BANK_MATCH_KIND_NOT_MIGRATED: bank_statement_lines.matched_kind does not exist. Run docs/phase-j-02-reconciliation-hardening-migration.sql.',
        )
      }
      delete values.matched_kind
      ;({ error: updateError } = await write(values))
    }

    if (updateError) throw new DatabaseError('Failed to record the match', updateError)

    // J2 — reconciling is a financial control decision and is auditable.
    // It had no audit event at all.
    this.audit(ctx, 'reconcile', input.statementLineId, {
      matchedTo: input.bookEntryId,
      matchedKind: entry.kind,
      amountMinor: entry.amountMinor,
      differenceReason: input.differenceReason ?? null,
    })

    await this.invalidate(ctx.workspaceId)
    return { statementLineId: input.statementLineId, bookEntryId: input.bookEntryId }
  }

  /**
   * J2.2 — resolve a candidate id to the book entry it names.
   *
   * Tries a payment first, then a journal entry. The id space is shared, so
   * "which table" cannot be inferred from the value — but both reads are
   * workspace-scoped, so an id belonging to another business resolves to
   * nothing rather than to their record (lesson 17).
   */
  private async resolveBookEntry(
    ctx: TenancyContext,
    bookEntryId: string,
  ): Promise<BookEntry | null> {
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, payment_number, direction, amount, entry_date')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', bookEntryId)
      .maybeSingle()

    if (paymentError) throw new DatabaseError('Failed to fetch the payment', paymentError)

    if (payment) {
      return {
        id: payment.id,
        kind: 'payment',
        onDate: String(payment.entry_date ?? '').slice(0, 10),
        amountMinor:
          Math.round((Number(payment.amount) || 0) * 100) * (payment.direction === 'in' ? 1 : -1),
        reference: payment.payment_number ?? payment.id,
      }
    }

    const { data: journal, error: journalError } = await supabase
      .from('journal_entries')
      .select('id, entry_number, date, description, journal_lines(account_id, debit, credit)')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', bookEntryId)
      .eq('status', 'posted')
      .maybeSingle()

    if (journalError) throw new DatabaseError('Failed to fetch the journal entry', journalError)
    if (!journal) return null

    const lines = ((journal as Record<string, any>).journal_lines ?? []) as Record<string, any>[]

    const netMinor = lines.reduce(
      (sum, line) =>
        sum + Math.round(((Number(line.debit) || 0) - (Number(line.credit) || 0)) * 100),
      0,
    )

    return {
      id: journal.id,
      kind: 'journal',
      onDate: String((journal as Record<string, any>).date ?? '').slice(0, 10),
      amountMinor: netMinor,
      reference: (journal as Record<string, any>).entry_number ?? journal.id,
      partyName: (journal as Record<string, any>).description ?? null,
    }
  }

  /**
   * Record a reconciliation decision.
   *
   * Fire-and-forget on purpose: a failed audit write must not roll back a
   * reconciliation the user already confirmed. It is logged, never swallowed.
   */
  private audit(
    ctx: TenancyContext,
    action: string,
    statementLineId: string,
    detail: Record<string, unknown>,
  ) {
    void supabase
      .from('audit_logs')
      .insert({
        workspace_id: ctx.workspaceId,
        user_id: ctx.userId,
        action: action === 'reconcile' ? 'update' : 'update',
        entity_type: 'bank_statement_line',
        entity_id: statementLineId,
        new_data: { action, ...detail },
      })
      .then(({ error }) => {
        if (error) console.error('[BankingService] audit write failed:', error.message)
      })
  }

  async unmatch(ctx: TenancyContext, statementLineId: string) {
    if (ctx.role === 'seller') throw new ConflictError('BANK_RECONCILE_FORBIDDEN')

    // What it WAS matched to, read before the match is removed — an audit
    // event saying only "unmatched" does not say what was undone.
    const { data: before } = await supabase
      .from('bank_statement_lines')
      .select('matched_to, matched_kind')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', statementLineId)
      .maybeSingle()

    const { error } = await supabase
      .from('bank_statement_lines')
      // N1 — `matched_party` is cleared too. A match somebody UNDID must stop
      // teaching the scorer, or a corrected mistake reinforces itself.
      .update({
        matched_to: null,
        matched_kind: null,
        matched_at: null,
        matched_by: null,
        matched_party: null,
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', statementLineId)

    if (error) throw new DatabaseError('Failed to unmatch', error)

    // J2.6 — un-matching is the documented way to release a reconciled line,
    // and it is exactly the act that must leave a trace. It had none.
    this.audit(ctx, 'unreconcile', statementLineId, {
      previousMatchedTo: (before as Record<string, any>)?.matched_to ?? null,
      previousMatchedKind: (before as Record<string, any>)?.matched_kind ?? null,
    })

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
