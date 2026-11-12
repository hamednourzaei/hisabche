import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import type { TenancyContext } from '../tenancy.service'
import { buildAccrualPeriods } from '@hisabche/validation'
import { ledger } from './index'

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
    const { data: sched, error: schedErr } = await supabase
      .from('accrual_schedules')
      .insert({
        workspace_id: tenancy.workspaceId,
        source_document_type: input.source_document_type,
        source_document_id: input.source_document_id,
        description: input.description,
        total_amount_minor: input.total_amount_minor,
        currency: input.currency,
        periods_count: input.periods_count,
        start_date: input.start_date,
        debit_account_id: input.debit_account_id,
        credit_account_id: input.credit_account_id,
        created_by: tenancy.userId,
      })
      .select('*')
      .single()

    if (schedErr || !sched) throw new DatabaseError('Failed to create accrual schedule', schedErr)

    const planned = buildAccrualPeriods(
      input.total_amount_minor,
      input.periods_count,
      input.start_date,
    )
    const { error: perErr } = await supabase.from('accrual_schedule_periods').insert(
      planned.map((p) => ({
        workspace_id: tenancy.workspaceId,
        schedule_id: sched.id,
        period_index: p.periodIndex,
        period_date: p.periodDate,
        amount_minor: p.amountMinor,
        status: 'pending',
      })),
    )
    if (perErr) throw new DatabaseError('Failed to create accrual periods', perErr)
    return { ...sched, periods: planned }
  }

  async runDue(tenancy: TenancyContext, asOfDate: string) {
    const postedPeriods: string[] = []
    const lockedFailures: Array<{ periodId: string; error: string }> = []
    const autoReversed: string[] = []

    const { data: duePeriods, error: pErr } = await supabase
      .from('accrual_schedule_periods')
      .select(
        '*, accrual_schedules!inner(id, description, debit_account_id, credit_account_id, status)',
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
        const amount = Number(row.amount_minor) / 100
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
