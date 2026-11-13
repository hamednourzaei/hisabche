import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import { BaseError } from '../../errors/base.error'
import type { TenancyContext } from '../tenancy.service'
import { buildAccrualPeriods, tillMinorToMajor } from '@hisabche/validation'
import { ValidationError } from '../../errors/validation.error'
import { baseCurrencyOf } from '../base-currency'
import { ledger } from './index'

/** The create function is not installed yet — never fall back to the two-call write. */
export class AccrualCreateNotInstalledError extends BaseError {
  constructor() {
    super('ACCRUAL_CREATE_NOT_INSTALLED', 503)
    this.name = 'AccrualCreateNotInstalledError'
  }
}

/** Codes `accrual_schedule_create` raises that the person can act on. */
const ACCRUAL_REFUSALS = [
  'ACCRUAL_ACCOUNTS_MUST_DIFFER',
  'ACCRUAL_ACCOUNT_NOT_FOUND',
  'ACCRUAL_PERIODS_DO_NOT_ADD_UP',
  'ACCRUAL_AMOUNT_TOO_SMALL_FOR_PERIODS',
] as const

export class AccrualSchedulesService {
  async list(tenancy: TenancyContext) {
    const { data, error } = await supabase
      .from('accrual_schedules')
      .select('*, accrual_schedule_periods(*)')
      .eq('workspace_id', tenancy.workspaceId)
      .order('created_at', { ascending: false })
    if (error) throw new DatabaseError('Failed to list accrual schedules', error)
    return data ?? []
  }

  async create(
    tenancy: TenancyContext,
    input: {
      source_document_type: string
      source_document_id: string
      description: string
      total_amount_minor: number
      currency: string
      periods_count: number
      start_date: string
      debit_account_id: string
      credit_account_id: string
    },
  ) {
    // The ledger books in the book currency; a schedule in another currency
    // would be posted with no conversion at all. Refused, not converted.
    const book = await baseCurrencyOf(tenancy.workspaceId)
    if (input.currency.toUpperCase() !== book.toUpperCase()) {
      throw new ValidationError('ACCRUAL_CURRENCY_MUST_BE_BOOK')
    }
    // Every period must be at least one minor unit (the table's CHECK). A
    // total smaller than the number of periods cannot be split — refused here
    // with a clear code instead of failing half-way through a write.
    if (input.total_amount_minor < input.periods_count) {
      throw new ValidationError('ACCRUAL_AMOUNT_TOO_SMALL_FOR_PERIODS')
    }
    const planned = buildAccrualPeriods(
      input.total_amount_minor,
      input.periods_count,
      input.start_date,
    )

    // ⚠️ V61 audit (12 Nov 2026): ONE transaction. The schedule and its periods
    // used to be two inserts; a failed second left a schedule with no periods
    // that `runDue` never posts (CLAUDE.md rule 4). The function also proves
    // both accounts are this workspace's.
    const { data, error } = await supabase.rpc('accrual_schedule_create', {
      p_workspace_id: tenancy.workspaceId,
      p_created_by: tenancy.userId,
      p_schedule: {
        source_document_type: input.source_document_type,
        source_document_id: input.source_document_id,
        description: input.description,
        total_amount_minor: input.total_amount_minor,
        currency: input.currency,
        periods_count: input.periods_count,
        start_date: input.start_date.slice(0, 10),
        debit_account_id: input.debit_account_id,
        credit_account_id: input.credit_account_id,
      },
      p_periods: planned.map((p) => ({
        period_index: p.periodIndex,
        period_date: p.periodDate,
        amount_minor: p.amountMinor,
      })),
    })
    if (error) {
      if (error.code === 'PGRST202' || error.code === '42883') {
        throw new AccrualCreateNotInstalledError()
      }
      const message = String(error.message ?? '')
      const refusal = ACCRUAL_REFUSALS.find((code) => message.includes(code))
      if (refusal) throw new ValidationError(refusal)
      throw new DatabaseError('Failed to create accrual schedule', error)
    }
    return data
  }

  async runDue(tenancy: TenancyContext, asOfDate: string) {
    const postedPeriods: string[] = []
    const lockedFailures: Array<{ periodId: string; error: string }> = []
    const autoReversed: string[] = []

    const { data: duePeriods, error: pErr } = await supabase
      .from('accrual_schedule_periods')
      .select(
        '*, accrual_schedules!inner(id, description, debit_account_id, credit_account_id, status, currency)',
      )
      .eq('workspace_id', tenancy.workspaceId)
      .eq('status', 'pending')
      .lte('period_date', asOfDate)

    if (pErr) throw new DatabaseError('Failed to query due accrual periods', pErr)

    for (const row of duePeriods ?? []) {
      const sched = Array.isArray(row.accrual_schedules)
        ? row.accrual_schedules[0]
        : row.accrual_schedules
      if (!sched || sched.status !== 'active') continue

      try {
        // ⚠️ minor → major with the currency's own digits. This was `/ 100`:
        // a 5,000 AFN accrual (AFN has no minor unit) booked 50.
        const amount = tillMinorToMajor(Number(row.amount_minor), String(sched.currency))
        const outcome = await ledger.postDocument(tenancy, {
          sourceType: 'accrual_schedule' as never,
          sourceId: row.id,
          date: row.period_date,
          description: `${sched.description} (${row.period_index})`,
          reference: `accrual-${row.schedule_id}-${row.period_index}`,
          lines: [
            { accountId: sched.debit_account_id, debit: amount, credit: 0 },
            { accountId: sched.credit_account_id, debit: 0, credit: amount },
          ],
        })
        const entryId =
          outcome.status === 'posted' || outcome.status === 'already_posted'
            ? outcome.entryId
            : null
        await supabase
          .from('accrual_schedule_periods')
          .update({
            status: 'posted',
            journal_entry_id: entryId,
            posted_at: new Date().toISOString(),
          })
          .eq('id', row.id)
          .eq('workspace_id', tenancy.workspaceId)
        postedPeriods.push(row.id)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('ACCOUNTING_PERIOD_LOCKED')) {
          await supabase
            .from('accrual_schedule_periods')
            .update({ status: 'locked_failed', error_code: 'ACCOUNTING_PERIOD_LOCKED' })
            .eq('id', row.id)
            .eq('workspace_id', tenancy.workspaceId)
          lockedFailures.push({ periodId: row.id, error: 'ACCOUNTING_PERIOD_LOCKED' })
          continue
        }
        throw err
      }
    }

    // Auto-reversing journals flagged with reverse_on <= asOfDate
    const { data: dueReversals, error: rErr } = await supabase
      .from('journal_entries')
      .select('id, reverse_on')
      .eq('workspace_id', tenancy.workspaceId)
      .eq('status', 'posted')
      .is('auto_reversed_entry_id', null)
      .lte('reverse_on', asOfDate)

    if (rErr) throw new DatabaseError('Failed to query auto-reversing journals', rErr)

    for (const je of dueReversals ?? []) {
      const reversal = await ledger.reverseJournalEntry(tenancy, je.id, {
        date: je.reverse_on,
        reason: `auto-reverse-${je.id}`,
      })
      if (reversal?.id) {
        await supabase
          .from('journal_entries')
          .update({ auto_reversed_entry_id: reversal.id })
          .eq('id', je.id)
          .eq('workspace_id', tenancy.workspaceId)
        autoReversed.push(je.id)
      }
    }

    return { postedPeriods, lockedFailures, autoReversed }
  }
}

export const accrualSchedulesService = new AccrualSchedulesService()
