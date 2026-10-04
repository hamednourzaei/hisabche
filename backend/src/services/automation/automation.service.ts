// ============================================
// backend/src/services/automation/automation.service.ts
//
// Standing arrangements: a business says «issue this invoice on the 1st of
// every month», and it happens — once per slot, through the same code a person
// pressing «ثبت» goes through, with a row of history for every slot whether it
// ran, was skipped or failed.
//
// WHO DECIDES WHAT
//
//   schedule.domain.ts   WHEN a slot is due, WHETHER its conditions pass, and
//                        what the failure policy says. Pure.
//   this file            reads the rows, walks the days, calls the action, and
//                        writes the history.
//   InvoiceService       issues the invoice. This file writes no invoice, no
//                        stock movement and no ledger line of its own.
//
// ⚠️ THREE LOCKS, BECAUSE AN INVOICE ISSUED TWICE IS MONEY ASKED FOR TWICE.
//
//   1. the nightly pass runs once per day across instances (`runScheduledOnce`)
//   2. the invoice is created with a request key derived from (automation,
//      slot) — InvoiceService returns the invoice it already made for that key
//   3. `automation_runs` allows ONE success per (automation, slot)
//
// So a manual «run now» racing the nightly pass, or a pass retried after a
// crash, produces one invoice.
//
// ⚠️ A LATE RUN IS STILL CORRECT. Each row remembers the last day it was
// evaluated; the pass walks every day after it. A server that was down on the
// 1st issues the 1st's invoice the next morning, DATED the 1st.
//
// ⚠️ THE ACTOR IS A REAL MEMBER. A run acts as the person who created the
// arrangement, with the access they have TODAY. If they have left the
// workspace the run fails and says so — it does not continue as a ghost.
// ============================================

import { createInvoiceSchema, type CreateInvoice } from '@hisabche/validation'
import {
  addIsoDays,
  monthBounds,
  type AutomationCadence,
  type ScheduleCalendar,
  type UpdateAutomation,
} from '@hisabche/validation'

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { sourceIdOf } from '../../utils/deterministic-id'
import { logBusinessEvent } from '../event-log.service'
import { InvoiceService } from '../invoice.service'
import { AccountingService } from '../accounting'
import { runMonthEnd } from '../accounting/month-end.service'
import { holds } from '../authorization/authorization.domain'
import { requireWorkspace, type TenancyContext } from '../tenancy.service'
import {
  afterFailure,
  isDueOn,
  shouldRun,
  type ActionType,
  type Automation,
  type AutomationState,
} from './schedule.domain'

/** PostgREST/Postgres codes for «docs/automation-01-migration.sql has not been run». */
const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])

/** The actions this backend can actually perform. A closed set, on purpose. */
export const EXECUTABLE_ACTIONS: readonly ActionType[] = ['recurring_invoice', 'month_end']

/** How far back a missed slot is still issued. Older ones are recorded, not run. */
export const MAX_CATCH_UP_DAYS = 35

export class AutomationNotConfiguredError extends BaseError {
  constructor() {
    super('AUTOMATION_MIGRATION_PENDING', 503)
    this.name = 'AutomationNotConfiguredError'
  }
}

const AUTOMATION_COLUMNS =
  'id, workspace_id, name, action_type, cadence, conditions, payload, enabled, on_failure, max_attempts, attempts, disabled_reason, last_checked_on, last_run_at, archived_at, created_by, created_at'

interface AutomationRow {
  id: string
  workspace_id: string
  name: string
  action_type: string
  cadence: AutomationCadence
  conditions: Automation['conditions']
  payload: {
    invoice?: Record<string, unknown>
    dueInDays?: number | null
    /** month_end: the month (1–12, in the cadence's calendar) that ends the fiscal year. */
    fiscalYearEndMonth?: number
    /** month_end: seal the period after the steps succeed. */
    lock?: boolean
  }
  enabled: boolean
  on_failure: 'stop' | 'keep' | 'ignore'
  max_attempts: number
  attempts: number
  disabled_reason: string | null
  last_checked_on: string | null
  last_run_at: string | null
  archived_at: string | null
  created_by: string
  created_at: string
}

export interface AutomationView {
  id: string
  name: string
  actionType: string
  cadence: AutomationCadence
  enabled: boolean
  /** Why it is off, when the failure policy — not a person — switched it off. */
  disabledReason: string | null
  onFailure: 'stop' | 'keep' | 'ignore'
  attempts: number
  maxAttempts: number
  lastRunAt: string | null
  /** The next day it is due, looking at most a year ahead. Null = never again. */
  nextRunOn: string | null
  /** For a recurring invoice: what it will issue. */
  summary: {
    type: string | null
    total: number | null
    currency: string | null
    customerId: string | null
  }
  /** For a month-end arrangement: what it was told. Null for anything else. */
  monthEnd: { fiscalYearEndMonth: number; lock: boolean } | null
  createdAt: string
}

export interface AutomationRunView {
  id: string
  slot: string
  outcome: 'ran' | 'skipped' | 'failed'
  detail: string
  documentType: string | null
  documentId: string | null
  createdAt: string
}

export type SlotResult =
  | { outcome: 'ran'; documentId: string | null }
  | { outcome: 'already_ran' }
  | { outcome: 'skipped'; reason: string }
  | { outcome: 'failed'; reason: string; disabled: boolean }

const isoDay = (date: Date) => date.toISOString().slice(0, 10)

/** `days` after an ISO day, as an ISO day. Built from a Date, never by string maths. */
export function addDays(day: string, days: number): string {
  const [year, month, dayOfMonth] = day.split('-').map(Number)
  return isoDay(
    new Date(Date.UTC(year as number, (month as number) - 1, (dayOfMonth as number) + days)),
  )
}

function toAutomation(row: AutomationRow): Automation {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    cadence: row.cadence,
    conditions: row.conditions ?? null,
    action: { type: row.action_type as ActionType, payload: row.payload ?? {} },
    onFailure: row.on_failure,
    maxAttempts: row.max_attempts,
  }
}

/** The next due day strictly after `after`, within a year. */
export function nextRunOn(automation: Automation, after: string): string | null {
  if (!automation.enabled) return null
  for (let offset = 1; offset <= 366; offset += 1) {
    const day = addDays(after, offset)
    if (isDueOn(automation, day)) return day
  }
  return null
}

function toView(row: AutomationRow, today: string): AutomationView {
  const invoice = row.payload?.invoice ?? {}
  return {
    id: row.id,
    name: row.name,
    actionType: row.action_type,
    cadence: row.cadence,
    enabled: row.enabled,
    disabledReason: row.disabled_reason,
    onFailure: row.on_failure,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    lastRunAt: row.last_run_at,
    nextRunOn: nextRunOn(toAutomation(row), today),
    summary: {
      type: typeof invoice.type === 'string' ? invoice.type : null,
      total: typeof invoice.total === 'number' ? invoice.total : null,
      currency: typeof invoice.currency === 'string' ? invoice.currency : null,
      customerId: typeof invoice.customerId === 'string' ? invoice.customerId : null,
    },
    monthEnd:
      row.action_type === 'month_end'
        ? {
            fiscalYearEndMonth: Number(row.payload?.fiscalYearEndMonth) || 0,
            lock: row.payload?.lock !== false,
          }
        : null,
    createdAt: row.created_at,
  }
}

/** A reason a person can read and a log can store: short, and never a stack. */
function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/\s+/g, ' ').trim().slice(0, 300) || 'UNKNOWN_ERROR'
}

/**
 * The invoice a recurring arrangement issues for one slot: the template, dated
 * that slot, unpaid.
 *
 * ⚠️ Parsed with the INVOICE'S OWN schema, at save time and again at run time —
 * a template the invoice route would refuse is refused here with the same
 * message, and a schema that tightened since the template was saved is caught
 * on the run rather than written past.
 */
export function invoiceForSlot(
  template: Record<string, unknown>,
  slot: string,
  dueInDays: number | null | undefined,
): CreateInvoice {
  const {
    payments: _payments,
    paidAmount: _paid,
    paymentMethod: _method,
    date: _date,
    dueDate: _due,
    ...rest
  } = template
  return createInvoiceSchema.parse({
    ...rest,
    // The invoice schema takes an instant, not a calendar day: midnight UTC of
    // the slot, so the issue date is the slot in every reader's calendar maths.
    date: `${slot}T00:00:00.000Z`,
    ...(dueInDays !== null && dueInDays !== undefined
      ? { dueDate: `${addDays(slot, dueInDays)}T00:00:00.000Z` }
      : {}),
    paidAmount: 0,
  }) as CreateInvoice
}

export class AutomationService {
  private readonly invoices = new InvoiceService()
  private readonly accounting = new AccountingService()

  private failure(message: string, error: { code?: string; message?: string }): BaseError {
    if (MISSING_SCHEMA.has(error.code ?? '')) return new AutomationNotConfiguredError()
    return new DatabaseError(message, error)
  }

  // ─── What a member sees and changes ──────────────────────────

  async list(ctx: TenancyContext): Promise<AutomationView[]> {
    const { data, error } = await supabase
      .from('automations')
      .select(AUTOMATION_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
    if (error) throw this.failure('Failed to list automations', error)

    const today = isoDay(new Date())
    return ((data ?? []) as unknown as AutomationRow[]).map((row) => toView(row, today))
  }

  async createRecurringInvoice(
    ctx: TenancyContext,
    input: {
      name: string
      cadence: AutomationCadence
      dueInDays?: number | undefined
      invoice: Record<string, unknown>
      onFailure: 'stop' | 'keep' | 'ignore'
      maxAttempts: number
    },
  ): Promise<AutomationView> {
    const today = isoDay(new Date())

    // The template must be an invoice the invoice route would accept today.
    const probe = invoiceForSlot(input.invoice, today, input.dueInDays)
    const { date: _date, dueDate: _due, ...template } = probe as Record<string, unknown>

    const { data, error } = await supabase
      .from('automations')
      .insert({
        workspace_id: ctx.workspaceId,
        name: input.name,
        action_type: 'recurring_invoice',
        cadence: input.cadence,
        conditions: null,
        payload: { invoice: template, dueInDays: input.dueInDays ?? null },
        enabled: true,
        on_failure: input.onFailure,
        max_attempts: input.maxAttempts,
        // Evaluated from TOMORROW: creating an arrangement never issues
        // anything for today or for days already past.
        last_checked_on: today,
        created_by: ctx.userId,
      })
      .select(AUTOMATION_COLUMNS)
      .single()
    if (error) throw this.failure('Failed to create the automation', error)

    const row = data as unknown as AutomationRow
    logBusinessEvent({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      entityType: 'automation',
      entityId: row.id,
      action: 'created',
      title: 'فاکتور تکراری تعریف شد',
      metadata: { name: row.name, cadence: row.cadence },
      notify: false,
    }).catch((err) => console.error('[AutomationService] logBusinessEvent failed:', err))

    return toView(row, today)
  }

  /**
   * Capability #58 — close each month automatically, on the 1st of the next.
   *
   * ⚠️ THE YEAR END IS STATED, NOT ASSUMED. The product has no fiscal-year
   * setting, and December is wrong for a shop whose year ends in Esfand or in
   * March. So the person switching this on says which month ends their year,
   * in their own calendar, and that answer lives on the arrangement.
   *
   * One per workspace: two would close the same month twice a night.
   */
  async createMonthEnd(
    ctx: TenancyContext,
    input: { calendar: ScheduleCalendar; fiscalYearEndMonth: number; lock: boolean },
  ): Promise<AutomationView> {
    const today = isoDay(new Date())

    const { data: existing, error: existingError } = await supabase
      .from('automations')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('action_type', 'month_end')
      .is('archived_at', null)
      .limit(1)
    if (existingError) throw this.failure('Failed to read automations', existingError)
    if ((existing ?? []).length > 0) throw new ConflictError('AUTOMATION_MONTH_END_EXISTS')

    const { data, error } = await supabase
      .from('automations')
      .insert({
        workspace_id: ctx.workspaceId,
        name: 'month-end',
        action_type: 'month_end',
        cadence: {
          kind: 'monthly',
          dayOfMonth: 1,
          calendar: input.calendar,
          from: addIsoDays(today, 1),
        },
        conditions: null,
        payload: { fiscalYearEndMonth: input.fiscalYearEndMonth, lock: input.lock },
        enabled: true,
        on_failure: 'stop',
        max_attempts: 3,
        last_checked_on: today,
        created_by: ctx.userId,
      })
      .select(AUTOMATION_COLUMNS)
      .single()
    if (error) throw this.failure('Failed to create the automation', error)

    const row = data as unknown as AutomationRow
    logBusinessEvent({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      entityType: 'automation',
      entityId: row.id,
      action: 'created',
      title: 'بستن خودکار ماه روشن شد',
      metadata: { ...input },
      notify: false,
    }).catch((err) => console.error('[AutomationService] logBusinessEvent failed:', err))

    return toView(row, today)
  }

  async update(ctx: TenancyContext, id: string, patch: UpdateAutomation): Promise<AutomationView> {
    const today = isoDay(new Date())
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (patch.name !== undefined) updates.name = patch.name
    if (patch.cadence !== undefined) updates.cadence = patch.cadence
    if (patch.enabled !== undefined) {
      updates.enabled = patch.enabled
      if (patch.enabled) {
        // Resuming starts a clean count and does NOT replay the paused days:
        // «paused» meant «do not issue these».
        updates.attempts = 0
        updates.disabled_reason = null
        updates.last_checked_on = today
      } else {
        updates.disabled_reason = 'PAUSED'
      }
    }

    const { data, error } = await supabase
      .from('automations')
      .update(updates)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .is('archived_at', null)
      .select(AUTOMATION_COLUMNS)
      .maybeSingle()
    if (error) throw this.failure('Failed to update the automation', error)
    if (!data) throw new NotFoundError('Automation')

    logBusinessEvent({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      entityType: 'automation',
      entityId: id,
      action: patch.enabled === false ? 'paused' : patch.enabled === true ? 'resumed' : 'updated',
      title: 'فاکتور تکراری تغییر کرد',
      metadata: { ...patch },
      notify: false,
    }).catch((err) => console.error('[AutomationService] logBusinessEvent failed:', err))

    return toView(data as unknown as AutomationRow, today)
  }

  /** Removed from the list; its history and the invoices it issued stay. */
  async archive(ctx: TenancyContext, id: string): Promise<void> {
    const { data, error } = await supabase
      .from('automations')
      .update({
        archived_at: new Date().toISOString(),
        enabled: false,
        disabled_reason: 'ARCHIVED',
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .is('archived_at', null)
      .select('id')
      .maybeSingle()
    if (error) throw this.failure('Failed to remove the automation', error)
    if (!data) throw new NotFoundError('Automation')

    logBusinessEvent({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      entityType: 'automation',
      entityId: id,
      action: 'archived',
      title: 'فاکتور تکراری حذف شد',
      notify: false,
    }).catch((err) => console.error('[AutomationService] logBusinessEvent failed:', err))
  }

  async runs(ctx: TenancyContext, id: string, limit = 50): Promise<AutomationRunView[]> {
    const { data, error } = await supabase
      .from('automation_runs')
      .select('id, slot, outcome, detail, document_type, document_id, created_at')
      .eq('workspace_id', ctx.workspaceId)
      .eq('automation_id', id)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw this.failure('Failed to read the automation history', error)

    return (data ?? []).map((row) => ({
      id: row.id as string,
      slot: row.slot as string,
      outcome: row.outcome as AutomationRunView['outcome'],
      detail: (row.detail as string) ?? '',
      documentType: (row.document_type as string | null) ?? null,
      documentId: (row.document_id as string | null) ?? null,
      createdAt: row.created_at as string,
    }))
  }

  /** Issue today's, now — whether or not today is a due day. Once per day. */
  async runNow(ctx: TenancyContext, id: string): Promise<SlotResult> {
    const { data, error } = await supabase
      .from('automations')
      .select(AUTOMATION_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .is('archived_at', null)
      .maybeSingle()
    if (error) throw this.failure('Failed to read the automation', error)
    if (!data) throw new NotFoundError('Automation')

    const result = await this.executeSlot(data as unknown as AutomationRow, isoDay(new Date()), {
      ignoreEnabled: true,
    })
    if (result.outcome === 'already_ran') throw new ConflictError('AUTOMATION_ALREADY_RAN_TODAY')
    return result
  }

  // ─── The nightly pass ────────────────────────────────────────

  /**
   * Evaluate every live arrangement for every day since it was last evaluated.
   * One arrangement failing never stops the others.
   */
  async runDue(today: string = isoDay(new Date())): Promise<{
    evaluated: number
    ran: number
    skipped: number
    failed: number
  }> {
    const totals = { evaluated: 0, ran: 0, skipped: 0, failed: 0 }
    const PAGE = 500

    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('automations')
        .select(AUTOMATION_COLUMNS)
        .eq('enabled', true)
        .is('archived_at', null)
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) {
        if (MISSING_SCHEMA.has(error.code ?? '')) return totals
        throw new DatabaseError('Failed to read due automations', error)
      }

      const rows = (data ?? []) as unknown as AutomationRow[]
      for (const row of rows) {
        totals.evaluated += 1
        try {
          for (const slot of this.slotsToEvaluate(row, today)) {
            const result = await this.executeSlot(row, slot.day, { tooLate: slot.tooLate })
            if (result.outcome === 'ran') totals.ran += 1
            else if (result.outcome === 'skipped') totals.skipped += 1
            else if (result.outcome === 'failed') {
              totals.failed += 1
              // The policy switched it off: later slots of this pass do not run.
              if (result.disabled) break
            }
          }
          await supabase
            .from('automations')
            .update({ last_checked_on: today })
            .eq('id', row.id)
            .eq('workspace_id', row.workspace_id)
        } catch (err) {
          totals.failed += 1
          console.error(`[automation] ${row.workspace_id}/${row.id} could not be evaluated:`, err)
        }
      }
      if (rows.length < PAGE) break
    }
    return totals
  }

  /** The due days after the last evaluated one, up to today. */
  private slotsToEvaluate(row: AutomationRow, today: string): { day: string; tooLate: boolean }[] {
    const automation = toAutomation(row)
    const start = row.last_checked_on ?? addDays(today, -1)
    const oldest = addDays(today, -MAX_CATCH_UP_DAYS)
    const slots: { day: string; tooLate: boolean }[] = []
    // Bounded walk: at most a year of days even for a row untouched for longer.
    for (
      let day = addDays(start, 1), guard = 0;
      day <= today && guard < 400;
      day = addDays(day, 1), guard += 1
    ) {
      if (isDueOn(automation, day)) slots.push({ day, tooLate: day < oldest })
    }
    return slots
  }

  private async executeSlot(
    row: AutomationRow,
    slot: string,
    options: { ignoreEnabled?: boolean; tooLate?: boolean } = {},
  ): Promise<SlotResult> {
    const startedAt = Date.now()
    const automation = toAutomation(row)

    const { data: existing, error: existingError } = await supabase
      .from('automation_runs')
      .select('id')
      .eq('automation_id', row.id)
      .eq('slot', slot)
      .eq('outcome', 'ran')
      .maybeSingle()
    if (existingError) throw this.failure('Failed to read the automation history', existingError)
    if (existing) return { outcome: 'already_ran' }

    if (options.tooLate) {
      // Recorded, not issued: an invoice dated two months ago appearing today
      // would be a surprise in a closed period, and nobody asked for it.
      await this.record(row, slot, 'skipped', 'TOO_LATE', startedAt)
      return { outcome: 'skipped', reason: 'TOO_LATE' }
    }

    const state: AutomationState = {
      automationId: row.id,
      lastRunAt: row.last_run_at,
      attempts: row.attempts,
      stillEnabled: true,
    }
    const daysSinceLastRun = row.last_run_at
      ? Math.floor((Date.parse(`${slot}T00:00:00Z`) - Date.parse(row.last_run_at)) / 86_400_000)
      : null
    const decision = shouldRun(
      options.ignoreEnabled ? { ...automation, enabled: true } : automation,
      {
        dayOfMonth: Number(slot.slice(8, 10)),
        daysSinceLastRun,
        amountMinor: null,
        hasOpenItems: false,
      },
      state,
    )
    if (!decision.run) {
      await this.record(row, slot, 'skipped', decision.reason, startedAt)
      return { outcome: 'skipped', reason: decision.reason }
    }

    try {
      if (!EXECUTABLE_ACTIONS.includes(automation.action.type)) {
        throw new ValidationError('AUTOMATION_ACTION_NOT_SUPPORTED')
      }
      // The creator, with the access they have TODAY — or a refusal.
      const actor = await requireWorkspace(row.created_by, row.workspace_id)
      const documentId =
        automation.action.type === 'month_end'
          ? await this.closeMonth(actor, row, slot)
          : await this.issueInvoice(actor, row, slot)

      const recorded = await this.record(
        row,
        slot,
        'ran',
        'OK',
        startedAt,
        automation.action.type === 'month_end' ? undefined : { type: 'invoice', id: documentId },
      )
      if (!recorded) return { outcome: 'already_ran' }

      await supabase
        .from('automations')
        .update({ attempts: 0, last_run_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('workspace_id', row.workspace_id)
      return { outcome: 'ran', documentId }
    } catch (err) {
      const reason = reasonOf(err)
      const attempts = row.attempts + 1
      const policy = afterFailure(automation, attempts)
      await this.record(row, slot, 'failed', reason, startedAt)
      await supabase
        .from('automations')
        .update({
          attempts,
          ...(policy.disable ? { enabled: false, disabled_reason: 'FAILED_TOO_OFTEN' } : {}),
        })
        .eq('id', row.id)
        .eq('workspace_id', row.workspace_id)
      // Carried into the next slot of the same pass.
      row.attempts = attempts

      // Said to a person: a schedule that fails quietly is one the shop
      // believes is working.
      logBusinessEvent({
        userId: row.created_by,
        workspaceId: row.workspace_id,
        entityType: 'automation',
        entityId: row.id,
        action: policy.disable ? 'disabled' : 'failed',
        title: policy.disable
          ? `«${row.name}» پس از چند بار خطا متوقف شد`
          : `«${row.name}» اجرا نشد`,
        description: reason,
        metadata: { slot, attempts, reason },
        notifyType: 'warning',
        actionUrl: '/invoices',
      }).catch((error) => console.error('[AutomationService] logBusinessEvent failed:', error))

      return { outcome: 'failed', reason, disabled: policy.disable }
    }
  }

  /**
   * Capability #58 — close the month that ended the day before `slot`.
   *
   * The slot is the 1st of a month in the arrangement's calendar; the period
   * is the whole month before it, in that same calendar. Every step is the
   * existing month-end package (`runMonthEnd`) — depreciation, revaluation,
   * the year-end close when this month ends the fiscal year, and the lock.
   *
   * ⚠️ A PACKAGE THAT STOPPED EARLY IS A FAILURE HERE. `runMonthEnd` returns
   * 200 with `failedAt` for a person to read; a scheduled run has nobody
   * reading, so it is recorded as failed, with the step, and the failure
   * policy applies — a close that silently did half its work is the most
   * expensive kind of quiet failure in this product.
   */
  private async closeMonth(actor: TenancyContext, row: AutomationRow, slot: string): Promise<null> {
    if (!holds(actor, 'ledger.lock_period'))
      throw new ValidationError('AUTOMATION_ACTOR_NOT_ALLOWED')

    const calendar: ScheduleCalendar =
      row.cadence.kind === 'monthly' ? (row.cadence.calendar ?? 'gregory') : 'gregory'
    const yearEndMonth = Number(row.payload?.fiscalYearEndMonth)
    if (!Number.isInteger(yearEndMonth) || yearEndMonth < 1 || yearEndMonth > 12) {
      throw new ValidationError('AUTOMATION_FISCAL_YEAR_END_MISSING')
    }

    const period = monthBounds(addIsoDays(slot, -1), calendar)
    const summary = await runMonthEnd(
      actor,
      {
        fromDate: period.from,
        toDate: period.to,
        // Required by the package and unused once `closesYear` is stated.
        fiscalYearEnd: period.to.slice(5, 10),
        closesYear: period.month === yearEndMonth,
        lock: row.payload?.lock !== false,
      },
      this.accounting,
    )
    if (summary.failedAt)
      throw new ValidationError(`MONTH_END_FAILED_AT_${summary.failedAt.toUpperCase()}`)
    return null
  }

  private async issueInvoice(actor: TenancyContext, row: AutomationRow, slot: string) {
    const template = row.payload?.invoice
    if (!template) throw new ValidationError('AUTOMATION_TEMPLATE_MISSING')

    const invoice = invoiceForSlot(template, slot, row.payload?.dueInDays)
    const created = (await this.invoices.create(actor, invoice, null, {
      // The same key for the same (arrangement, slot), always: a retried run
      // gets back the invoice the first attempt created.
      clientRequestId: sourceIdOf(row.workspace_id, 'recurring_invoice', row.id, slot),
    })) as { id?: string } | null
    return created?.id ?? null
  }

  /** Append one history row. `false` = a success for this slot already exists. */
  private async record(
    row: AutomationRow,
    slot: string,
    outcome: 'ran' | 'skipped' | 'failed',
    detail: string,
    startedAt: number,
    document?: { type: string; id: string | null },
  ): Promise<boolean> {
    const { error } = await supabase.from('automation_runs').insert({
      workspace_id: row.workspace_id,
      automation_id: row.id,
      slot,
      outcome,
      detail,
      document_type: document?.type ?? null,
      document_id: document?.id ?? null,
      duration_ms: Date.now() - startedAt,
    })
    if (!error) return true
    if (error.code === '23505') return false
    throw this.failure('Failed to record the automation run', error)
  }
}

export const automationService = new AutomationService()
