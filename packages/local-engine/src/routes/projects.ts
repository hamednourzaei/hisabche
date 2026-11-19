// ============================================
// packages/local-engine/src/routes/projects.ts
//
// WP-15 — OFFLINE PROJECT COST, TIME AND MILESTONES.
//
// A project manager records time and a milestone without signal. The device
// never issues an invoice: the shared rules decide what is APPROVED and what
// may be billed, and the server's existing /api/projects/:id/bill does the rest.
// No rule lives here — @hisabche/validation owns the money and readiness.
// ============================================

import {
  billableTimeOf,
  budgetVarianceOf,
  DEFAULT_OVERHEAD_POLICY,
  milestoneReadiness,
  projectCostOf,
  type TimeEntryForBilling,
} from '@hisabche/validation'
import { requireCapability } from '../auth'
import { NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

interface ProjectRow {
  id: string
  workspace_id: string
  name: string
  customer_id: string | null
  currency: string
  budget_minor: number
  status: string
  client_request_id: string | null
}

interface TimeRow {
  id: string
  workspace_id: string
  project_id: string
  hours: number
  rate_minor: number
  billable: number
  approved: number
  work_date: string
}

function projectOf(c: RouteHandlerContext, id: string): ProjectRow {
  const row = c.db.get<ProjectRow>(
    `SELECT * FROM local_projects WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [id, c.ctx.workspaceId],
  )
  if (!row) throw new NotFoundError('Project', id)
  return row
}

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function randomUuid(): string {
  return crypto.randomUUID()
}

function timeRows(c: RouteHandlerContext, projectId: string): TimeRow[] {
  return c.db.all<TimeRow>(
    `SELECT * FROM project_time_entries WHERE workspace_id = ? AND project_id = ? ORDER BY work_date ASC`,
    [c.ctx.workspaceId, projectId],
  )
}

function timeInputs(rows: readonly TimeRow[]): TimeEntryForBilling[] {
  return rows.map((row) => ({
    id: row.id,
    hours: Number(row.hours),
    approved: Boolean(row.approved),
    billable: Boolean(row.billable),
    rateMinor: Number(row.rate_minor),
  }))
}

export function registerProjectRoutes(router: Router): void {
  router.get('/local-projects', (c: RouteHandlerContext) => ({
    data: c.db.all<ProjectRow>(
      `SELECT * FROM local_projects WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
      [c.ctx.workspaceId],
    ),
  }))

  router.post('/local-projects', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const body = (c.body || {}) as Record<string, unknown>
    const name = trim(body.name)
    const currency = trim(body.currency)
    if (!name) throw new ValidationError('PROJECT_NAME_REQUIRED')
    if (!currency) throw new ValidationError('PROJECT_CURRENCY_REQUIRED')

    const requestId = trim(c.headers?.['idempotency-key']) || trim(body.id)
    const now = new Date().toISOString()
    return c.db.transaction(() => {
      if (requestId) {
        const existing = c.db.get<ProjectRow>(
          `SELECT * FROM local_projects WHERE workspace_id = ? AND client_request_id = ?`,
          [c.ctx.workspaceId, requestId],
        )
        if (existing) return { __status: 200, __data: existing }
      }
      const id = trim(body.id) || randomUuid()
      c.db.run(
        `INSERT INTO local_projects
           (id, workspace_id, name, customer_id, currency, budget_minor, status,
            client_request_id, created_at, updated_at, origin, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, 'local', 'local_only')`,
        [
          id,
          c.ctx.workspaceId,
          name,
          trim(body.customerId) || null,
          currency.toUpperCase(),
          Number.isSafeInteger(body.budgetMinor) ? Number(body.budgetMinor) : 0,
          requestId || null,
          now,
          now,
        ],
      )
      return projectOf(c, id)
    })
  })

  router.get('/local-projects/:id/time-entries', (c: RouteHandlerContext) => ({
    data: timeRows(c, c.params.id ?? ''),
  }))

  router.post('/local-projects/:id/time-entries', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const project = projectOf(c, c.params.id ?? '')
    const body = (c.body || {}) as Record<string, unknown>
    const hours = Number(body.hours)
    const rateMinor = Number(body.rateMinor)
    if (!Number.isFinite(hours) || hours <= 0) throw new ValidationError('TIME_HOURS_INVALID')
    if (!Number.isSafeInteger(rateMinor) || rateMinor < 0) {
      throw new ValidationError('TIME_RATE_INVALID')
    }
    const id = trim(body.id) || randomUuid()
    const now = new Date().toISOString()
    c.db.run(
      `INSERT INTO project_time_entries
         (id, workspace_id, project_id, hours, rate_minor, billable, approved, work_date,
          notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        id,
        c.ctx.workspaceId,
        project.id,
        hours,
        rateMinor,
        body.billable === false ? 0 : 1,
        trim(body.workDate) || now.slice(0, 10),
        trim(body.notes) || null,
        now,
        now,
      ],
    )
    return c.db.get<TimeRow>('SELECT * FROM project_time_entries WHERE id = ?', [id])
  })

  // Approval is a decision, not a silent field flip: it needs a manager capability.
  router.post('/local-projects/time-entries/:id/approve', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'ledger.post')
    const row = c.db.get<TimeRow>(
      `SELECT * FROM project_time_entries WHERE id = ? AND workspace_id = ?`,
      [c.params.id, c.ctx.workspaceId],
    )
    if (!row) throw new NotFoundError('Time entry', c.params.id ?? '')
    c.db.run(
      `UPDATE project_time_entries SET approved = 1, updated_at = ? WHERE id = ? AND workspace_id = ?`,
      [new Date().toISOString(), row.id, c.ctx.workspaceId],
    )
    return {
      __status: 200,
      __data: c.db.get<TimeRow>('SELECT * FROM project_time_entries WHERE id = ?', [row.id]),
    }
  })

  router.get('/local-projects/:id/cost', (c: RouteHandlerContext) => {
    const project = projectOf(c, c.params.id ?? '')
    const rows = timeRows(c, project.id)
    const time = billableTimeOf(timeInputs(rows))
    if (time === null) return { __status: 200, __data: { cost: null, variance: null } }
    const cost = projectCostOf(
      {
        purchaseMinor: 0,
        inventoryMinor: 0,
        timeMinor: time.amountMinor,
        ledgerMinor: 0,
      },
      DEFAULT_OVERHEAD_POLICY,
    )
    return {
      __status: 200,
      __data: { cost, variance: budgetVarianceOf(Number(project.budget_minor), cost) },
    }
  })

  router.get('/local-projects/:id/billing', (c: RouteHandlerContext) => {
    const project = projectOf(c, c.params.id ?? '')
    const time = billableTimeOf(timeInputs(timeRows(c, project.id)))
    if (time === null) return { __status: 200, __data: { billing: null } }
    const milestones = c.db.all<{
      id: string
      title: string
      required_hours: number
      amount_minor: number
      status: string
    }>(
      `SELECT id, title, required_hours, amount_minor, status FROM project_milestones
       WHERE workspace_id = ? AND project_id = ? ORDER BY created_at ASC`,
      [c.ctx.workspaceId, project.id],
    )
    return {
      __status: 200,
      __data: {
        time,
        milestones: milestones.map((m) => ({
          ...m,
          readiness: milestoneReadiness(time, Number(m.required_hours)),
        })),
      },
    }
  })

  router.post('/local-projects/:id/milestones', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const project = projectOf(c, c.params.id ?? '')
    const body = (c.body || {}) as Record<string, unknown>
    const title = trim(body.title)
    const requiredHours = Number(body.requiredHours)
    const amountMinor = Number(body.amountMinor)
    if (!title) throw new ValidationError('MILESTONE_TITLE_REQUIRED')
    if (!Number.isFinite(requiredHours) || requiredHours <= 0) {
      throw new ValidationError('MILESTONE_HOURS_INVALID')
    }
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
      throw new ValidationError('MILESTONE_AMOUNT_INVALID')
    }
    const id = trim(body.id) || randomUuid()
    const now = new Date().toISOString()
    c.db.run(
      `INSERT INTO project_milestones
         (id, workspace_id, project_id, title, required_hours, amount_minor, status,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'planned', ?, ?)`,
      [id, c.ctx.workspaceId, project.id, title, requiredHours, amountMinor, now, now],
    )
    return c.db.get<{ id: string; title: string }>(
      'SELECT id, title FROM project_milestones WHERE id = ?',
      [id],
    )
  })
}
