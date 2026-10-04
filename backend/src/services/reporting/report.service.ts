// ============================================
// backend/src/services/reporting/report.service.ts
//
// Capability #145 — the report builder: a question kept under a name, run
// against live data.
//
// ⚠️ ONLY WHAT CAN BE COMPUTED FROM ONE EXISTING SOURCE IS OFFERED. The domain
// (`dataset.domain`) lists eight datasets and thirteen measures; this service
// RUNS one dataset — sale invoices, from the `invoice_outstanding` view — and
// the three measures that view already defines: how many, what is still owed,
// what was collected. A report asking for anything else is refused at save
// time (`REPORT_NOT_RUNNABLE`), not stored and left to fail later. Profit,
// cost and margin are NOT here: they belong to the accounting core's profit
// report, and summing invoice totals would be a second definition of revenue.
//
// ⚠️ MONEY IS NEVER ADDED ACROSS CURRENCIES. A report with a money measure is
// always grouped by currency — the service adds that grouping itself and says
// so in the saved definition.
//
// ⚠️ NO SILENT CAP. A run reads every invoice (paged), and when the result has
// more groups than `maxRows` the answer says how many there were.
//
// The shape rules are the domain's (`validateReport`): unknown measure, too
// many groupings, a non-additive figure spread over time.
// ============================================

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { selectAllPages } from '../../utils/fetch-all-pages'
import type { TenancyContext } from '../tenancy.service'
import {
  allMeasures,
  validateReport,
  type DimensionKey,
  type ReportDefinition,
} from './dataset.domain'

const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])

export const RUNNABLE_DATASET = 'invoices' as const
export const RUNNABLE_DIMENSIONS = ['month', 'quarter', 'customer', 'currency'] as const
export const RUNNABLE_MEASURES = ['count', 'outstanding', 'collected'] as const
export type RunnableDimension = (typeof RUNNABLE_DIMENSIONS)[number]
export type RunnableMeasure = (typeof RUNNABLE_MEASURES)[number]
const REPORT_MAX_ROWS = 500

export class ReportsNotConfiguredError extends BaseError {
  constructor() {
    super('REPORTS_MIGRATION_PENDING', 503)
    this.name = 'ReportsNotConfiguredError'
  }
}

export interface SavedReportView {
  id: string
  name: string
  groupBy: RunnableDimension[]
  measures: RunnableMeasure[]
  isActive: boolean
}

export interface ReportRun {
  report: SavedReportView
  asOf: string
  /** How many groups the data has; `rows` holds at most `maxRows` of them. */
  totalRows: number
  maxRows: number
  rows: Array<{
    dimensions: Partial<Record<RunnableDimension, string | null>>
    /** For a `customer` grouping: the name, or null for a sale with no customer. */
    customerName?: string | null
    values: Partial<Record<RunnableMeasure, number>>
  }>
}

interface ReportRow {
  id: string
  name: string
  definition: { groupBy?: unknown; measures?: unknown }
  is_active: boolean
}
interface InvoiceRow {
  invoice_id: string
  customer_id: string | null
  invoice_date: string | null
  currency: string | null
  allocated: number | string | null
  outstanding: number | string | null
}

const isMoney = (key: string) =>
  allMeasures().find((measure) => measure.key === key)?.unit === 'money'
const toMinor = (major: unknown) => Math.round((Number(major) || 0) * 100)

function toView(row: ReportRow): SavedReportView {
  const pick = <T extends string>(value: unknown, allowed: readonly T[]): T[] =>
    Array.isArray(value)
      ? (value.filter((item) => (allowed as readonly unknown[]).includes(item)) as T[])
      : []
  return {
    id: row.id,
    name: row.name,
    groupBy: pick(row.definition?.groupBy, RUNNABLE_DIMENSIONS),
    measures: pick(row.definition?.measures, RUNNABLE_MEASURES),
    isActive: row.is_active,
  }
}

function fail(error: { code?: string; message: string }, what: string): never {
  if (MISSING_SCHEMA.has(error.code ?? '')) throw new ReportsNotConfiguredError()
  if (error.code === '23505') throw new ConflictError('REPORT_NAME_TAKEN')
  throw new DatabaseError(what, error)
}

export class ReportService {
  /** What the builder may offer — exactly what `run` can compute. */
  catalog() {
    return {
      dataset: RUNNABLE_DATASET,
      dimensions: [...RUNNABLE_DIMENSIONS],
      measures: RUNNABLE_MEASURES.map((key) => ({
        key,
        unit: allMeasures().find((measure) => measure.key === key)?.unit ?? 'count',
      })),
    }
  }

  /** The definition as it will be stored: checked, and with `currency` added when money is asked for. */
  private definitionOf(input: {
    name: string
    groupBy: string[]
    measures: string[]
  }): ReportDefinition {
    const runnable =
      input.measures.every((key) => (RUNNABLE_MEASURES as readonly string[]).includes(key)) &&
      input.groupBy.every((key) => (RUNNABLE_DIMENSIONS as readonly string[]).includes(key))
    if (!runnable) throw new ValidationError('REPORT_NOT_RUNNABLE')

    const groupBy = [...new Set(input.groupBy)] as DimensionKey[]
    if (input.measures.some(isMoney) && !groupBy.includes('currency')) groupBy.push('currency')

    const definition: ReportDefinition = {
      key: 'saved',
      name: input.name.trim(),
      dataset: RUNNABLE_DATASET,
      groupBy,
      measures: input.measures,
      maxRows: REPORT_MAX_ROWS,
    }
    const problems = validateReport(definition)
    if (problems.length > 0) throw new ValidationError(`REPORT_${problems[0]}`)
    return definition
  }

  async list(ctx: TenancyContext): Promise<SavedReportView[]> {
    const { data, error } = await supabase
      .from('saved_reports')
      .select('id, name, definition, is_active')
      .eq('workspace_id', ctx.workspaceId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(200)
    if (error) fail(error, 'Failed to read saved reports')
    return ((data ?? []) as ReportRow[]).map(toView)
  }

  async save(
    ctx: TenancyContext,
    input: { name: string; groupBy: string[]; measures: string[] },
  ): Promise<SavedReportView> {
    const definition = this.definitionOf(input)
    const { data, error } = await supabase
      .from('saved_reports')
      .insert({
        workspace_id: ctx.workspaceId,
        created_by: ctx.userId,
        name: definition.name,
        definition: {
          dataset: definition.dataset,
          groupBy: definition.groupBy,
          measures: definition.measures,
          maxRows: definition.maxRows,
        },
      })
      .select('id, name, definition, is_active')
      .single()
    if (error) fail(error, 'Failed to save the report')
    return toView(data as ReportRow)
  }

  /** Retire. Never a delete. */
  async retire(ctx: TenancyContext, id: string): Promise<void> {
    const { data, error } = await supabase
      .from('saved_reports')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .select('id')
      .maybeSingle()
    if (error) fail(error, 'Failed to retire the report')
    if (!data) throw new NotFoundError('Report')
  }

  async run(ctx: TenancyContext, id: string): Promise<ReportRun> {
    const { data: saved, error } = await supabase
      .from('saved_reports')
      .select('id, name, definition, is_active')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .maybeSingle()
    if (error) fail(error, 'Failed to read the report')
    if (!saved) throw new NotFoundError('Report')
    const report = toView(saved as ReportRow)
    // Re-checked at run time: a stored definition is data, and data can be old.
    this.definitionOf({ name: report.name, groupBy: report.groupBy, measures: report.measures })

    const invoices = await selectAllPages<InvoiceRow, { message: string; code?: string }>(
      (from, to) =>
        supabase
          .from('invoice_outstanding')
          .select('invoice_id, customer_id, invoice_date, currency, allocated, outstanding')
          .eq('workspace_id', ctx.workspaceId)
          .eq('type', 'sale')
          .order('invoice_id', { ascending: true })
          .range(from, to),
    )
    if (invoices.error)
      throw new DatabaseError('Failed to read invoices for the report', invoices.error)

    const dimensionOf = (row: InvoiceRow, dimension: RunnableDimension): string | null => {
      const day = String(row.invoice_date ?? '').slice(0, 10)
      switch (dimension) {
        case 'month':
          return day ? day.slice(0, 7) : null
        case 'quarter':
          return day
            ? `${day.slice(0, 4)}-Q${Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1}`
            : null
        case 'customer':
          return row.customer_id
        case 'currency':
          return row.currency
      }
    }

    const groups = new Map<
      string,
      {
        dimensions: Partial<Record<RunnableDimension, string | null>>
        count: number
        outstandingMinor: number
        collectedMinor: number
      }
    >()
    for (const row of invoices.data ?? []) {
      const dimensions: Partial<Record<RunnableDimension, string | null>> = {}
      for (const dimension of report.groupBy) dimensions[dimension] = dimensionOf(row, dimension)
      const key = JSON.stringify(report.groupBy.map((dimension) => dimensions[dimension] ?? null))
      const group = groups.get(key) ?? {
        dimensions,
        count: 0,
        outstandingMinor: 0,
        collectedMinor: 0,
      }
      group.count += 1
      group.outstandingMinor += Math.max(0, toMinor(row.outstanding))
      group.collectedMinor += toMinor(row.allocated)
      groups.set(key, group)
    }

    // Largest first by the first measure asked for; ties by the group key, so
    // two runs of the same data come back in the same order.
    const first = report.measures[0] ?? 'count'
    const valueOf = (group: { count: number; outstandingMinor: number; collectedMinor: number }) =>
      first === 'count'
        ? group.count
        : first === 'outstanding'
          ? group.outstandingMinor
          : group.collectedMinor
    const ordered = [...groups.entries()].sort(
      ([keyA, a], [keyB, b]) => valueOf(b) - valueOf(a) || keyA.localeCompare(keyB),
    )
    const kept = ordered.slice(0, REPORT_MAX_ROWS).map(([, group]) => group)

    const names = report.groupBy.includes('customer')
      ? await this.customerNames(
          ctx.workspaceId,
          kept
            .map((group) => group.dimensions.customer)
            .filter((value): value is string => !!value),
        )
      : new Map<string, string>()

    return {
      report,
      asOf: new Date().toISOString().slice(0, 10),
      totalRows: ordered.length,
      maxRows: REPORT_MAX_ROWS,
      rows: kept.map((group) => {
        const values: Partial<Record<RunnableMeasure, number>> = {}
        for (const measure of report.measures) {
          values[measure] =
            measure === 'count'
              ? group.count
              : measure === 'outstanding'
                ? group.outstandingMinor / 100
                : group.collectedMinor / 100
        }
        return {
          dimensions: group.dimensions,
          ...(report.groupBy.includes('customer')
            ? {
                customerName: group.dimensions.customer
                  ? (names.get(group.dimensions.customer) ?? null)
                  : null,
              }
            : {}),
          values,
        }
      }),
    }
  }

  private async customerNames(workspaceId: string, ids: readonly string[]) {
    const unique = [...new Set(ids)]
    const names = new Map<string, string>()
    const CHUNK = 200
    for (let index = 0; index < unique.length; index += CHUNK) {
      const { data, error } = await supabase
        .from('customers')
        .select('id, full_name')
        // Re-applied: these ids came from a view, and a name must never be read
        // across the workspace boundary.
        .eq('workspace_id', workspaceId)
        .in('id', unique.slice(index, index + CHUNK))
      if (error) throw new DatabaseError('Failed to read customer names', error)
      for (const row of (data ?? []) as Array<{ id: string; full_name: string | null }>) {
        if (row.full_name) names.set(row.id, row.full_name)
      }
    }
    return names
  }
}

export const reportService = new ReportService()
