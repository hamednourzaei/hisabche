// ============================================
// backend/src/services/reporting/dashboard.service.ts
//
// Capability #146 — the dashboard builder.
//
// A dashboard is an ARRANGEMENT of saved reports: which, in what order, how
// wide. It computes nothing and stores no result — each tile is a saved report
// that the client runs through the report service, exactly as the report
// builder does. There is no second way to produce a figure here.
//
// The rule is the domain's (`validateDashboard`): a dashboard is not empty,
// names only reports that exist, names none twice, and puts no two in one
// place. «Exist» means ACTIVE reports of THIS workspace.
//
// ⚠️ A REPORT RETIRED LATER DOES NOT BREAK THE DASHBOARD. The tile stays and
// says its report was retired — it is not silently dropped, which would make a
// dashboard quietly show less than it was built to.
//
// A dashboard is RETIRED, never deleted or edited.
// ============================================

import { z } from 'zod'

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'
import { validateDashboard } from './dataset.domain'
import { reportService, type SavedReportView } from './report.service'

const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])
const COLUMNS = 'id, name, tiles, is_active, created_at'

/** The most tiles a dashboard holds. Each is a live query when it is opened. */
export const MAX_DASHBOARD_TILES = 6

export class DashboardsNotConfiguredError extends BaseError {
  constructor() {
    super('DASHBOARDS_MIGRATION_PENDING', 503)
    this.name = 'DashboardsNotConfiguredError'
  }
}

export const dashboardInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  /** Saved report ids, in the order they are shown. */
  tiles: z
    .array(
      z.object({
        reportId: z.string().uuid(),
        span: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
      }),
    )
    .max(MAX_DASHBOARD_TILES),
})

export interface DashboardTile {
  reportId: string
  position: number
  span: 1 | 2 | 3
  /** The report's current name, or null when it has since been retired. */
  reportName: string | null
}

export interface DashboardView {
  id: string
  name: string
  tiles: DashboardTile[]
}

interface DashboardRow {
  id: string
  name: string
  tiles: unknown
  is_active: boolean
}

function fail(error: { code?: string; message: string }, what: string): never {
  if (MISSING_SCHEMA.has(error.code ?? '')) throw new DashboardsNotConfiguredError()
  if (error.code === '23505') throw new ConflictError('DASHBOARD_NAME_TAKEN')
  throw new DatabaseError(what, error)
}

const storedTile = z.object({
  reportId: z.string(),
  position: z.number().int(),
  span: z.union([z.literal(1), z.literal(2), z.literal(3)]),
})

/** A stored row → what the screen shows. A tile that cannot be read is left out by shape, not guessed. */
function toView(row: DashboardRow, reports: readonly SavedReportView[]): DashboardView {
  const names = new Map(reports.map((report) => [report.id, report.name]))
  const tiles = (Array.isArray(row.tiles) ? row.tiles : [])
    .map((tile) => storedTile.safeParse(tile))
    .flatMap((parsed) => (parsed.success ? [parsed.data] : []))
    .sort((a, b) => a.position - b.position)
    .map((tile) => ({ ...tile, reportName: names.get(tile.reportId) ?? null }))
  return { id: row.id, name: row.name, tiles }
}

export interface DashboardReports {
  list(ctx: TenancyContext): Promise<SavedReportView[]>
}

export class DashboardService {
  constructor(private readonly reports: DashboardReports = reportService) {}

  async list(ctx: TenancyContext): Promise<DashboardView[]> {
    const { data, error } = await supabase
      .from('report_dashboards')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(100)
    if (error) fail(error, 'Failed to read dashboards')
    const rows = (data ?? []) as DashboardRow[]
    if (rows.length === 0) return []
    const reports = await this.reports.list(ctx)
    return rows.map((row) => toView(row, reports))
  }

  async save(ctx: TenancyContext, raw: unknown): Promise<DashboardView> {
    const input = dashboardInputSchema.parse(raw)
    const reports = await this.reports.list(ctx)
    const tiles = input.tiles.map((tile, position) => ({
      reportId: tile.reportId,
      position,
      span: tile.span,
    }))

    const problems = validateDashboard(
      {
        key: 'new',
        name: input.name,
        tiles: tiles.map((tile) => ({
          reportKey: tile.reportId,
          position: tile.position,
          span: tile.span,
        })),
      },
      reports.map((report) => ({ key: report.id })),
    )
    if (problems.length > 0) throw new ValidationError(`DASHBOARD_${problems[0]}`)

    const { data, error } = await supabase
      .from('report_dashboards')
      .insert({
        workspace_id: ctx.workspaceId,
        created_by: ctx.userId,
        name: input.name,
        tiles,
      })
      .select(COLUMNS)
      .single()
    if (error) fail(error, 'Failed to save the dashboard')
    return toView(data as DashboardRow, reports)
  }

  /** Retire. Never a delete. */
  async retire(ctx: TenancyContext, id: string): Promise<void> {
    const { data, error } = await supabase
      .from('report_dashboards')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .select('id')
      .maybeSingle()
    if (error) fail(error, 'Failed to retire the dashboard')
    if (!data) throw new NotFoundError('Dashboard')
  }
}

export const dashboardService = new DashboardService()
