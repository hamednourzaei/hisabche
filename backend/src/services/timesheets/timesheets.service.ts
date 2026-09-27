// ============================================
// backend/src/services/timesheets/timesheets.service.ts
//
// Logging time, and turning the billable part of it into invoice lines.
// ============================================

import { selectAllPages } from '../../utils/fetch-all-pages'
import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import type { TenancyContext } from '../tenancy.service'

import {
  buildBillableLines,
  profitability,
  summarise,
  validateBilling,
  type BillingMethod,
  type ProjectBillingConfig,
  type TimeEntry,
} from './billing.domain'

const ENTRY_COLUMNS =
  'id, project_id, task_id, employee_id, on_date, minutes, billable, rate_minor, invoice_id, description'

function mapEntry(raw: Record<string, any>): TimeEntry {
  return {
    id: raw.id,
    projectId: raw.project_id,
    taskId: raw.task_id ?? null,
    employeeId: raw.employee_id,
    onDate: String(raw.on_date ?? '').slice(0, 10),
    minutes: Number(raw.minutes) || 0,
    billable: raw.billable !== false,
    rateMinor: raw.rate_minor === null ? null : Number(raw.rate_minor),
    invoiceId: raw.invoice_id ?? null,
    description: raw.description ?? '',
  }
}

const DEFAULT_CONFIG = (projectId: string): ProjectBillingConfig => ({
  projectId,
  method: 'non_billable',
  defaultRateMinor: 0,
})

export class TimesheetsService {
  private async invalidate(workspaceId: string) {
    await memoryCache.invalidate(`timesheets:${workspaceId}`)
  }

  async getConfig(ctx: TenancyContext, projectId: string): Promise<ProjectBillingConfig> {
    const { data, error } = await supabase
      .from('project_billing_config')
      .select('project_id, method, default_rate_minor, budget_cap_minor')
      .eq('workspace_id', ctx.workspaceId)
      .eq('project_id', projectId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to read the billing config', error)

    // A project with no configuration is NON-BILLABLE, not hourly at zero.
    // Defaulting to hourly would silently make internal work look billable.
    if (!data) return DEFAULT_CONFIG(projectId)

    return {
      projectId: data.project_id,
      method: data.method as BillingMethod,
      defaultRateMinor: Number(data.default_rate_minor) || 0,
      budgetCapMinor: data.budget_cap_minor === null ? null : Number(data.budget_cap_minor),
    }
  }

  async setConfig(
    ctx: TenancyContext,
    input: {
      projectId: string
      method: BillingMethod
      defaultRateMinor: number
      budgetCapMinor?: number | null | undefined
    },
  ): Promise<ProjectBillingConfig> {
    if (ctx.role === 'seller') throw new ConflictError('TIMESHEET_CONFIG_FORBIDDEN')

    const { error } = await supabase.from('project_billing_config').upsert(
      {
        project_id: input.projectId,
        workspace_id: ctx.workspaceId,
        method: input.method,
        default_rate_minor: input.defaultRateMinor,
        budget_cap_minor: input.budgetCapMinor ?? null,
      },
      { onConflict: 'project_id' },
    )

    if (error) throw new DatabaseError('Failed to save the billing config', error)

    await this.invalidate(ctx.workspaceId)
    return this.getConfig(ctx, input.projectId)
  }

  async listEntries(
    ctx: TenancyContext,
    filters: { projectId?: string; employeeId?: string; from?: string; to?: string } = {},
  ): Promise<TimeEntry[]> {
    // Every entry (27 Sep 2026): project profitability sums these, and the
    // `.limit(5000)` was cut to 1000 by PostgREST.
    const { data, error } = await selectAllPages((lo, hi) => {
      let query = supabase
        .from('time_entries')
        .select(ENTRY_COLUMNS)
        .eq('workspace_id', ctx.workspaceId)
      if (filters.projectId) query = query.eq('project_id', filters.projectId)
      if (filters.employeeId) query = query.eq('employee_id', filters.employeeId)
      if (filters.from) query = query.gte('on_date', filters.from.slice(0, 10))
      if (filters.to) query = query.lte('on_date', filters.to.slice(0, 10))
      return query
        .order('on_date', { ascending: false })
        .order('id', { ascending: true })
        .range(lo, hi)
    })
    if (error) throw new DatabaseError('Failed to fetch time entries', error)
    return (data ?? []).map(mapEntry)
  }

  async logTime(
    ctx: TenancyContext,
    input: {
      projectId: string
      taskId?: string | null | undefined
      employeeId: string
      onDate: string
      minutes: number
      billable?: boolean | undefined
      rateMinor?: number | null | undefined
      description?: string | undefined
    },
  ): Promise<TimeEntry> {
    if (input.minutes <= 0) throw new ValidationError('TIME_ZERO_MINUTES')

    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        workspace_id: ctx.workspaceId,
        project_id: input.projectId,
        task_id: input.taskId ?? null,
        employee_id: input.employeeId,
        on_date: input.onDate.slice(0, 10),
        minutes: input.minutes,
        billable: input.billable !== false,
        rate_minor: input.rateMinor ?? null,
        description: input.description ?? '',
      })
      .select(ENTRY_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to log time', error)

    await this.invalidate(ctx.workspaceId)
    return mapEntry(data)
  }

  /**
   * Change a time entry.
   *
   * An INVOICED entry is refused outright. Editing hours a client has already
   * been billed for makes the invoice and the timesheet disagree, and the
   * invoice is the one the client holds.
   */
  async updateEntry(
    ctx: TenancyContext,
    entryId: string,
    input: {
      minutes?: number | undefined
      billable?: boolean | undefined
      rateMinor?: number | null | undefined
      description?: string | undefined
    },
  ): Promise<TimeEntry> {
    const { data: existing, error: readError } = await supabase
      .from('time_entries')
      .select(ENTRY_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', entryId)
      .maybeSingle()

    if (readError) throw new DatabaseError('Failed to read the time entry', readError)
    if (!existing) throw new NotFoundError('Time entry')
    if (existing.invoice_id) throw new ConflictError('TIME_ALREADY_INVOICED')

    const values: Record<string, unknown> = {}
    if (input.minutes !== undefined) values.minutes = input.minutes
    if (input.billable !== undefined) values.billable = input.billable
    if (input.rateMinor !== undefined) values.rate_minor = input.rateMinor
    if (input.description !== undefined) values.description = input.description

    const { data, error } = await supabase
      .from('time_entries')
      .update(values)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', entryId)
      .is('invoice_id', null)
      .select(ENTRY_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update the time entry', error)

    await this.invalidate(ctx.workspaceId)
    return mapEntry(data)
  }

  async getSummary(ctx: TenancyContext, projectId: string) {
    const [entries, config] = await Promise.all([
      this.listEntries(ctx, { projectId }),
      this.getConfig(ctx, projectId),
    ])

    return { projectId, config, totals: summarise(entries, config) }
  }

  /** The invoice lines this project's unbilled time would produce. */
  async previewBilling(ctx: TenancyContext, projectId: string) {
    const [entries, config] = await Promise.all([
      this.listEntries(ctx, { projectId }),
      this.getConfig(ctx, projectId),
    ])

    const unbilled = entries.filter((entry) => !entry.invoiceId && entry.billable)

    return {
      projectId,
      problems: validateBilling(unbilled, config),
      lines: buildBillableLines(entries, config),
    }
  }

  /**
   * Mark time as invoiced.
   *
   * The `invoice_id` IS the lock — not a flag that can be cleared. Written
   * with `is('invoice_id', null)` so two people invoicing at once cannot both
   * claim the same hours.
   */
  async markBilled(ctx: TenancyContext, entryIds: string[], invoiceId: string) {
    if (entryIds.length === 0) return { billed: 0 }

    const { data, error } = await supabase
      .from('time_entries')
      .update({ invoice_id: invoiceId })
      .eq('workspace_id', ctx.workspaceId)
      .in('id', entryIds)
      .is('invoice_id', null)
      .select('id')

    if (error) throw new DatabaseError('Failed to mark the time as billed', error)

    const billed = (data ?? []).length

    if (billed !== entryIds.length) {
      // Some entries were taken by another invoice between the preview and
      // this write. Said out loud: the invoice is short of what was expected
      // and somebody has to know which hours went elsewhere.
      console.warn(
        `[Timesheets] invoice ${invoiceId} claimed ${billed} of ${entryIds.length} entries; the rest were already billed`,
      )
    }

    await this.invalidate(ctx.workspaceId)
    return { billed, requested: entryIds.length }
  }

  /**
   * Whether the project made money.
   *
   * Labour at COST — what the employee is paid — not at the billing rate.
   */
  async getProfitability(ctx: TenancyContext, projectId: string) {
    const [entries, employees, invoices] = await Promise.all([
      this.listEntries(ctx, { projectId }),
      // Every row (27 Sep 2026): a .limit(N) here was cut to 1000 by PostgREST, and this feeds a total.
      selectAllPages((lo, hi) =>
        supabase
          .from('employees')
          .select('id, cost_rate_minor')
          .eq('workspace_id', ctx.workspaceId)
          .order('id', { ascending: true })
          .range(lo, hi),
      ),
      selectAllPages((lo, hi) =>
        supabase
          .from('invoices')
          .select('total')
          .eq('workspace_id', ctx.workspaceId)
          .eq('project_id', projectId)
          .eq('type', 'sale')
          .order('id', { ascending: true })
          .range(lo, hi),
      ),
    ])

    if (employees.error) throw new DatabaseError('Failed to read employees', employees.error)

    const costRateByEmployee = new Map(
      (employees.data ?? []).map((row) => [row.id, Number(row.cost_rate_minor) || 0]),
    )

    const revenueMinor = (invoices.data ?? []).reduce(
      (sum, row: any) => sum + Math.round((Number(row.total) || 0) * 100),
      0,
    )

    return profitability({ projectId, revenueMinor, expenseMinor: 0, entries, costRateByEmployee })
  }
}
