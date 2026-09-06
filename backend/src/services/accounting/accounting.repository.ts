// ============================================
// backend/src/services/accounting/accounting.repository.ts
//
// Every read and write the accounting core makes. It is the only file in the
// core that knows Supabase exists, and the only one that knows a column name.
//
// ONE RULE, EVERYWHERE: the tenancy boundary is workspaceId. `userId` is
// recorded as the actor and never appears in a WHERE clause. The service this
// replaced filtered the ledger by user_id while invoice.service looked up the
// same chart of accounts by workspace_id — so the two never saw each other's
// rows, and a second member of a shop could not see the books they were
// writing into.
// ============================================

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import type { TenancyContext } from '../tenancy.service'

import type { AccountRootType, DraftLine, PeriodLock } from './accounting.domain'
import type { LedgerTotals } from './accounting.reports'
/**
 * J1 — does this error mean `accounting_period_locks.branch_id` has not been
 * created yet, rather than that the query is wrong?
 *
 *   42703    — undefined_column (Postgres)
 *   PGRST204 — PostgREST could not find the column in its schema cache
 *
 * The period lock sits on the posting path of every financial document, so it
 * must keep working — and keep REFUSING — either side of the migration.
 */
function isMissingBranchColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42703' || error.code === 'PGRST204') return true
  return /branch_id/i.test(error.message ?? '')
}

const ACCOUNT_COLUMNS = 'id, code, name, type, role, parent_id, is_group, is_active, created_at'

export interface AccountRow {
  id: string
  code: string
  name: string
  type: AccountRootType
  role: string | null
  parentId: string | null
  isGroup: boolean
  isActive: boolean
  createdAt: string | null
}

export interface JournalEntryRow {
  id: string
  entryNumber: string | null
  date: string
  description: string
  reference: string
  status: 'draft' | 'posted' | 'reversed' | 'cancelled'
  sourceType: string | null
  sourceId: string | null
  reversalOf: string | null
  postedAt: string | null
  createdAt: string | null
  lines: JournalLineRow[]
}

export interface JournalLineRow {
  id: string
  accountId: string
  accountCode?: string | undefined
  accountName?: string | undefined
  debit: number
  credit: number
}

function mapAccount(raw: Record<string, any>): AccountRow {
  return {
    id: raw.id,
    code: raw.code,
    name: raw.name,
    type: raw.type,
    role: raw.role ?? null,
    parentId: raw.parent_id ?? null,
    isGroup: raw.is_group === true,
    isActive: raw.is_active !== false,
    createdAt: raw.created_at ?? null,
  }
}

function mapEntry(raw: Record<string, any>): JournalEntryRow {
  return {
    id: raw.id,
    entryNumber: raw.entry_number ?? null,
    date: String(raw.date ?? '').slice(0, 10),
    description: raw.description ?? '',
    reference: raw.reference ?? '',
    status: raw.status ?? 'draft',
    sourceType: raw.source_type ?? null,
    sourceId: raw.source_id ?? null,
    reversalOf: raw.reversal_of ?? null,
    postedAt: raw.posted_at ?? null,
    createdAt: raw.created_at ?? null,
    lines: (raw.lines ?? []).map((line: Record<string, any>) => ({
      id: line.id,
      accountId: line.account_id,
      accountCode: line.account?.code,
      accountName: line.account?.name,
      debit: Number(line.debit) || 0,
      credit: Number(line.credit) || 0,
    })),
  }
}

/**
 * A Postgres error raised by our own RAISE EXCEPTION, rather than a driver or
 * constraint failure. The posting function reports domain refusals this way so
 * the service can turn them back into the same error codes the pure rules use.
 */
export function domainErrorCode(error: unknown): string | null {
  const message = (error as { message?: string } | null)?.message ?? ''
  const match = /\b([A-Z][A-Z_]{6,})\b/.exec(message)
  return match?.[1] ?? null
}

export class AccountingRepository {
  // ─── Chart of accounts ────────────────────────────────────────────────────

  async listAccounts(workspaceId: string, includeInactive = true): Promise<AccountRow[]> {
    let query = supabase
      .from('accounts')
      .select(ACCOUNT_COLUMNS)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('code')

    if (!includeInactive) query = query.eq('is_active', true)

    const { data, error } = await query
    if (error) throw new DatabaseError('Failed to fetch accounts', error)
    return (data ?? []).map(mapAccount)
  }

  async getAccount(workspaceId: string, id: string): Promise<AccountRow | null> {
    const { data, error } = await supabase
      .from('accounts')
      .select(ACCOUNT_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch account', error)
    return data ? mapAccount(data) : null
  }

  async insertAccount(ctx: TenancyContext, values: Record<string, unknown>): Promise<AccountRow> {
    const { data, error } = await supabase
      .from('accounts')
      .insert({ ...values, workspace_id: ctx.workspaceId, user_id: ctx.userId })
      .select(ACCOUNT_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create account', error)
    return mapAccount(data)
  }

  async updateAccount(
    workspaceId: string,
    id: string,
    values: Record<string, unknown>,
  ): Promise<AccountRow> {
    const { data, error } = await supabase
      .from('accounts')
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .select(ACCOUNT_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update account', error)
    return mapAccount(data)
  }

  /** Whether anything has ever been posted to this account. */
  async accountHasPostings(workspaceId: string, accountId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('journal_lines')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('account_id', accountId)

    if (error) throw new DatabaseError('Failed to check account usage', error)
    return (count ?? 0) > 0
  }

  async accountHasChildren(workspaceId: string, accountId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('accounts')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('parent_id', accountId)
      .is('deleted_at', null)

    if (error) throw new DatabaseError('Failed to check account children', error)
    return (count ?? 0) > 0
  }

  // ─── Journal entries ──────────────────────────────────────────────────────

  async listEntries(
    workspaceId: string,
    options: { limit: number; status?: string },
  ): Promise<JournalEntryRow[]> {
    let query = supabase
      .from('journal_entries')
      .select(
        `id, entry_number, date, description, reference, status, source_type, source_id,
         reversal_of, posted_at, created_at,
         lines:journal_lines(id, account_id, debit, credit)`,
      )
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .order('entry_number', { ascending: false })
      .limit(options.limit)

    if (options.status) query = query.eq('status', options.status)

    const { data, error } = await query
    if (error) throw new DatabaseError('Failed to fetch journal entries', error)
    return (data ?? []).map(mapEntry)
  }

  async getEntry(workspaceId: string, id: string): Promise<JournalEntryRow | null> {
    const { data, error } = await supabase
      .from('journal_entries')
      .select(
        `id, entry_number, date, description, reference, status, source_type, source_id,
         reversal_of, posted_at, created_at,
         lines:journal_lines(id, account_id, debit, credit, account:accounts(id, code, name, type))`,
      )
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch journal entry', error)
    return data ? mapEntry(data) : null
  }

  /** The live entry a source document already produced, if there is one. */
  async findEntryBySource(
    workspaceId: string,
    sourceType: string,
    sourceId: string,
  ): Promise<JournalEntryRow | null> {
    const { data, error } = await supabase
      .from('journal_entries')
      .select(
        `id, entry_number, date, description, reference, status, source_type, source_id,
         reversal_of, posted_at, created_at,
         lines:journal_lines(id, account_id, debit, credit)`,
      )
      .eq('workspace_id', workspaceId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .neq('status', 'cancelled')
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to look up source entry', error)
    return data ? mapEntry(data) : null
  }

  /** Highest sequence used this year, so the next number continues it. */
  async lastEntrySequence(workspaceId: string, year: number): Promise<number> {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('entry_number')
      .eq('workspace_id', workspaceId)
      .like('entry_number', `JV-${year}-%`)
      .order('entry_number', { ascending: false })
      .limit(1)

    if (error) throw new DatabaseError('Failed to read entry numbering', error)

    const last = data?.[0]?.entry_number as string | undefined
    const match = /^JV-\d{4}-(\d{6})$/.exec(last ?? '')
    return match ? Number(match[1]) : 0
  }

  /**
   * The single write path into the ledger.
   *
   * `accounting_post_journal_entry` writes the header and its lines in ONE
   * transaction and re-checks balance, period lock and account validity while
   * holding it. The code this replaced inserted a header, inserted lines, and
   * DELETED the header if the second insert failed — a compensating write that
   * cannot run if the process dies in between, which leaves a header with no
   * lines permanently in the books.
   */
  async postEntry(
    ctx: TenancyContext,
    entry: {
      date: string
      description: string
      reference: string
      status: 'draft' | 'posted'
      entryNumber: string | null
      sourceType: string | null
      sourceId: string | null
      reversalOf: string | null
    },
    lines: DraftLine[],
  ): Promise<string> {
    const { data, error } = await supabase.rpc('accounting_post_journal_entry', {
      p_workspace_id: ctx.workspaceId,
      p_user_id: ctx.userId,
      p_entry: {
        date: entry.date,
        description: entry.description,
        reference: entry.reference,
        status: entry.status,
        entry_number: entry.entryNumber,
        source_type: entry.sourceType,
        source_id: entry.sourceId,
        reversal_of: entry.reversalOf,
      },
      p_lines: lines.map((line) => ({
        account_id: line.accountId,
        debit: line.debit,
        credit: line.credit,
      })),
    })

    if (error) throw error
    return data as string
  }

  /** Marks a posted entry as reversed. The entry itself is never rewritten. */
  async markReversed(workspaceId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('journal_entries')
      .update({ status: 'reversed', updated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .eq('status', 'posted')

    if (error) throw new DatabaseError('Failed to mark entry reversed', error)
  }

  async setEntryStatus(
    workspaceId: string,
    id: string,
    from: string,
    to: string,
    extra: Record<string, unknown> = {},
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('journal_entries')
      .update({ status: to, updated_at: new Date().toISOString(), ...extra })
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .eq('status', from)
      .select('id')

    if (error) throw new DatabaseError('Failed to change entry status', error)
    return (data ?? []).length > 0
  }

  // ─── Period lock ──────────────────────────────────────────────────────────

  /**
   * The company lock — `branch_id IS NULL`.
   *
   * Kept with its original name and shape because several callers read it as
   * "the" lock. J1 added branch locks beside it; `listPeriodLocks` below is the
   * one that sees all of them.
   */
  async getPeriodLock(
    workspaceId: string,
  ): Promise<{ lockedUntil: string; reason: string } | null> {
    const read = (scoped: boolean) => {
      const query = supabase
        .from('accounting_period_locks')
        .select('locked_until, reason')
        .eq('workspace_id', workspaceId)

      // Before phase-j-01 there is no branch_id column and exactly one row per
      // workspace, so the unscoped read is the correct fallback.
      return scoped ? query.is('branch_id', null).maybeSingle() : query.maybeSingle()
    }

    let { data, error } = await read(true)
    if (error && isMissingBranchColumn(error)) ({ data, error } = await read(false))

    if (error) throw new DatabaseError('Failed to read the period lock', error)
    if (!data) return null
    return { lockedUntil: String(data.locked_until).slice(0, 10), reason: data.reason ?? '' }
  }

  /**
   * J1 — every lock for the workspace: the company one and each branch's.
   *
   * One read, not one per branch. `evaluatePeriodLock` decides from the whole
   * set, so the precedence rule lives in one pure function rather than in a
   * query that has to be got right at every call site.
   */
  async listPeriodLocks(workspaceId: string): Promise<PeriodLock[]> {
    const { data, error } = await supabase
      .from('accounting_period_locks')
      .select('branch_id, locked_until, reason')
      .eq('workspace_id', workspaceId)

    if (error) {
      // Pre-migration: no branch_id column. Fall back to the single company
      // lock so posting keeps working — and keeps being CHECKED — either side
      // of the migration.
      if (isMissingBranchColumn(error)) {
        const company = await this.getPeriodLock(workspaceId)
        return company ? [{ branchId: null, ...company }] : []
      }
      throw new DatabaseError('Failed to read the period locks', error)
    }

    return (data ?? []).map((row: Record<string, any>) => ({
      branchId: row.branch_id ?? null,
      lockedUntil: String(row.locked_until).slice(0, 10),
      reason: row.reason ?? '',
    }))
  }

  /**
   * Set one lock. `branchId === null` sets the company lock.
   *
   * The conflict target differs per scope because the uniqueness is expressed
   * by two PARTIAL indexes — a company lock conflicts on workspace alone, a
   * branch lock on the pair.
   */
  async setPeriodLock(
    ctx: TenancyContext,
    lockedUntil: string,
    reason: string,
    branchId: string | null = null,
  ): Promise<void> {
    const row = {
      workspace_id: ctx.workspaceId,
      branch_id: branchId,
      locked_until: lockedUntil,
      reason,
      locked_by: ctx.userId,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('accounting_period_locks')
      .upsert(row, { onConflict: branchId ? 'workspace_id,branch_id' : 'workspace_id' })

    if (!error) return

    if (isMissingBranchColumn(error)) {
      // A BRANCH lock cannot be stored before the migration, and quietly
      // storing it as a company lock would close every branch instead of one.
      // Refused loudly; the company lock still works.
      if (branchId) {
        throw new DatabaseError(
          'ACCOUNTING_BRANCH_LOCK_NOT_MIGRATED: accounting_period_locks.branch_id does not exist. Run docs/phase-j-01-branch-period-lock-migration.sql.',
          error,
        )
      }

      const { branch_id: _ignored, ...companyRow } = row
      const { error: fallbackError } = await supabase
        .from('accounting_period_locks')
        .upsert(companyRow, { onConflict: 'workspace_id' })

      if (fallbackError) throw new DatabaseError('Failed to set the period lock', fallbackError)
      return
    }

    throw new DatabaseError('Failed to set the period lock', error)
  }

  // ─── Aggregation ──────────────────────────────────────────────────────────

  /**
   * Summed in Postgres, by ENTRY DATE and posted entries only.
   *
   * The old trial balance filtered on `created_at`, so an entry booked today
   * for last month appeared in this month's figures and never in last month's,
   * and it pulled every journal line into Node to add them up with no limit.
   */
  /**
   * Every posted line on one account, oldest first.
   *
   * ⚠️ `journal_lines.journal_id` — NOT `entry_id`. The column has been
   * guessed wrong more than once in this codebase.
   *
   * ⚠️ Only POSTED entries. A draft is not part of the ledger, and a drill-down
   * that included drafts would not add up to the trial balance beside it —
   * which is precisely the number the user clicked to get here.
   */
  async ledgerLines(
    workspaceId: string,
    accountId: string,
    fromDate: string | null,
    toDate: string | null,
  ): Promise<
    Array<{
      lineId: string
      entryId: string
      /** H3 — shown instead of a raw uuid, so a line is identifiable by eye. */
      entryNumber: string
      date: string
      description: string
      reference: string
      /**
       * H3 — what PRODUCED this line: 'invoice', 'payment', 'payroll',
       * 'manual'…, and the id of that document.
       *
       * Selected so a drill-down can send someone from a figure in the Trial
       * Balance to the invoice behind it. Without these the general ledger is
       * a list of amounts whose origin is unreachable — which is most of why
       * the endpoint went unused.
       */
      sourceType: string | null
      sourceId: string | null
      debit: number
      credit: number
    }>
  > {
    let query = supabase
      .from('journal_lines')
      .select(
        'id, journal_id, debit, credit, journal_entries!inner(id, entry_number, date, description, reference, status, source_type, source_id, workspace_id)',
      )
      .eq('workspace_id', workspaceId)
      .eq('account_id', accountId)
      .eq('journal_entries.status', 'posted')
      .order('id', { ascending: true })
      .limit(5_000)

    if (fromDate) query = query.gte('journal_entries.date', fromDate)
    if (toDate) query = query.lte('journal_entries.date', toDate)

    const { data, error } = await query
    if (error) throw new DatabaseError('Failed to read the general ledger', error)

    return (
      (data ?? [])
        .map((row: Record<string, any>) => {
          const entry = Array.isArray(row.journal_entries)
            ? row.journal_entries[0]
            : row.journal_entries
          return {
            lineId: row.id,
            entryId: row.journal_id,
            entryNumber: String(entry?.entry_number ?? ''),
            date: String(entry?.date ?? '').slice(0, 10),
            description: String(entry?.description ?? ''),
            reference: String(entry?.reference ?? ''),
            // `null`, not `''`. A drill-down must be able to tell «this line
            // came from no document» (a manual entry) from «this line came
            // from a document whose type we failed to read» — the first is
            // normal and gets no link, the second is a defect.
            sourceType: entry?.source_type ?? null,
            sourceId: entry?.source_id ?? null,
            debit: Number(row.debit) || 0,
            credit: Number(row.credit) || 0,
          }
        })
        // Ordered by DATE, then by the id that broke the tie in SQL. Ordering by
        // id alone puts a backdated entry in the wrong place and the running
        // balance then reads as nonsense to anybody checking it by hand.
        .sort((left, right) => (left.date === right.date ? 0 : left.date < right.date ? -1 : 1))
    )
  }

  async ledgerTotals(
    workspaceId: string,
    fromDate: string | null,
    toDate: string | null,
    /** Branches to include. `null` is a consolidated statement, all branches. */
    branchIds: string[] | null = null,
  ): Promise<LedgerTotals[]> {
    const { data, error } = await supabase.rpc('accounting_trial_balance', {
      p_workspace_id: workspaceId,
      p_from_date: fromDate,
      p_to_date: toDate,
      p_branch_ids: branchIds,
    })

    if (error) throw new DatabaseError('Failed to aggregate the ledger', error)

    return (data ?? []).map((row: Record<string, any>) => ({
      accountId: row.account_id,
      accountCode: row.account_code,
      accountName: row.account_name,
      accountType: row.account_type as AccountRootType,
      debit: Number(row.total_debit) || 0,
      credit: Number(row.total_credit) || 0,
    }))
  }
}
