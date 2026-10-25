// ============================================
// packages/local-engine/src/routes/budgets.ts
//
// Budgets, offline — the list, a draft, submit / approve / archive, a revision
// of an approved one, the revision history, the budgets page, the variance
// report and the «may this document spend this much» check.
//
// ⚠️ NO SECOND ENGINE. What a saved budget looks like (`mapBudget`), how its
// period is split (`planFor`), what a save stores (`planBudgetSave`), which
// transitions are legal (`planBudgetSubmit` / `planBudgetApprove` /
// `planBudgetArchive`), what a revision changes (`planBudgetRevision`), how the
// page and the variance are assembled (`buildBudgetReport`, `varianceReport`)
// and how the spend check decides (`controllingBudgets`, `decideBudgetSpend`)
// are the functions backend/src/services/budgeting/budget.service.ts calls. This
// file only fetches the figures from SQLite and writes the rows.
//
// What the device honestly does NOT hold:
//   · cost centres / dimensions — a budget naming one is refused out loud
//     (BUDGET_DIMENSION_OFFLINE), never accepted and dropped.
//   · open commitments — they are made by purchase orders, which are not on the
//     device. So «committed» is 0 here because nothing can commit, not because
//     it was measured.
//   · separation of duties between a drafter and an approver — the device has
//     one person, the owner, and the server's own default for a one-person
//     business is «off».
//   · the audit trail of budget changes (audit.trail is a cloud feature).
// ============================================

import {
  actualsFromDays,
  approveBudgetBodySchema,
  budgetBodySchema,
  budgetReportQuerySchema,
  buildBudgetReport,
  checkBudgetSpendBodySchema,
  controllingBudgets,
  decideBudgetSpend,
  filterBudgets,
  mapBudget,
  periodFor,
  planBudgetApprove,
  planBudgetArchive,
  planBudgetRevision,
  planBudgetSave,
  planBudgetSubmit,
  rateFor,
  reportWindow,
  reviseBudgetBodySchema,
  toMinorUnits,
  varianceReport,
  type AccountDayNet,
  type BudgetConsumption,
  type BudgetReportEntry,
  type PlannedBudget,
} from '@hisabche/validation'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { LocalDb } from '../db'
import type { Router } from '../router'
import type { LocalContext, RouteHandlerContext } from '../types'
import { bodyOf, newId, nowIso, parseWith } from './people-common'

function budgetsOf(db: LocalDb, ctx: LocalContext): PlannedBudget[] {
  return db
    .all<Record<string, any>>(
      'SELECT * FROM budget WHERE workspace_id = ? ORDER BY starts_on DESC, id LIMIT 500',
      [ctx.workspaceId],
    )
    .map((raw) => mapBudget(raw, ctx.baseCurrency))
}

function oneBudget(db: LocalDb, ctx: LocalContext, id: string): PlannedBudget {
  const budget = budgetsOf(db, ctx).find((b) => b.id === id)
  if (!budget) throw new NotFoundError('Budget')
  return budget
}

/** Net movement (debit − credit, minor units) of each budgeted account, per day, in a window. */
function netByAccountDay(
  db: LocalDb,
  workspaceId: string,
  accountIds: readonly string[],
  start: string,
  end: string,
): Map<string, AccountDayNet[]> {
  const out = new Map<string, AccountDayNet[]>()
  if (accountIds.length === 0) return out
  const rows = db.all<{ account_id: string; day: string; debit: number; credit: number }>(
    `SELECT l.account_id AS account_id, e.date AS day, l.debit AS debit, l.credit AS credit
       FROM journal_line l
       JOIN journal_entry e ON e.id = l.journal_id
      WHERE l.workspace_id = ? AND e.status = 'posted'
        AND e.deleted_at IS NULL AND l.deleted_at IS NULL
        AND substr(e.date, 1, 10) >= ? AND substr(e.date, 1, 10) <= ?
        AND l.account_id IN (${accountIds.map(() => '?').join(', ')})
      ORDER BY e.date, l.id`,
    [workspaceId, start, end, ...accountIds],
  )
  for (const row of rows) {
    const list = out.get(row.account_id) ?? []
    list.push({
      day: String(row.day).slice(0, 10),
      net: toMinorUnits((Number(row.debit) || 0) - (Number(row.credit) || 0)),
    })
    out.set(row.account_id, list)
  }
  return out
}

function consumptionOf(
  db: LocalDb,
  ctx: LocalContext,
  budget: PlannedBudget,
  onDate: string,
): BudgetConsumption {
  const { start, end } = periodFor(budget, onDate)
  const days = netByAccountDay(db, ctx.workspaceId, [budget.accountId], start, end).get(
    budget.accountId,
  )
  return {
    actualMinor: actualsFromDays(budget, onDate, days ?? []).actualMinor,
    // Nothing can commit on the device (no purchase orders), so nothing is open.
    committedMinor: 0,
  }
}

function today(): string {
  return nowIso().slice(0, 10)
}

/** The figures the budgets page and the variance are assembled from, for these budgets. */
function entriesFor(
  db: LocalDb,
  ctx: LocalContext,
  budgets: readonly PlannedBudget[],
  onDate: string,
): BudgetReportEntry[] {
  const window = reportWindow(budgets, onDate)
  const days = window
    ? netByAccountDay(
        db,
        ctx.workspaceId,
        [...new Set(budgets.map((b) => b.accountId))],
        window.start,
        window.end,
      )
    : new Map<string, AccountDayNet[]>()
  return budgets.map((budget) => {
    const { actualMinor, seriesActual } = actualsFromDays(
      budget,
      onDate,
      days.get(budget.accountId) ?? [],
    )
    // Nothing can commit on the device (no purchase orders), so nothing is open.
    return { budget, actualMinor, openMinor: 0, seriesActual }
  })
}

function transition(
  db: LocalDb,
  ctx: LocalContext,
  id: string,
  from: string,
  to: string,
  extra: Record<string, unknown>,
): PlannedBudget {
  const changes: Record<string, unknown> = { status: to, updated_at: nowIso(), ...extra }
  const columns = Object.keys(changes)
  // Guarded on the status we read: a concurrent transition updates nothing.
  const result = db.run(
    `UPDATE budget SET ${columns.map((column) => `${column} = ?`).join(', ')}
      WHERE id = ? AND workspace_id = ? AND status = ?`,
    [
      ...columns.map((column) => (changes[column] === false ? 0 : changes[column])),
      id,
      ctx.workspaceId,
      from,
    ],
  )
  if (result.changes === 0) throw new ConflictError('BUDGET_INVALID_TRANSITION')
  return oneBudget(db, ctx, id)
}

export function registerBudgetRoutes(router: Router): void {
  router.get('/operations/budgets', (c: RouteHandlerContext) => budgetsOf(c.db, c.ctx))

  // Registered before `/operations/budgets/:id/*`.
  router.get('/operations/budgets/report', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const parsed = parseWith(budgetReportQuerySchema, query)
    const onDate = parsed.onDate ?? today()
    const budgets = filterBudgets(budgetsOf(db, ctx), {
      type: parsed.type,
      status: parsed.status,
      branchId: parsed.branchId,
    })
    return buildBudgetReport(onDate, 'batch', entriesFor(db, ctx, budgets, onDate))
  })

  router.get('/operations/budgets/variance', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const onDate = query.onDate || today()
    const report = buildBudgetReport(
      onDate,
      'batch',
      entriesFor(db, ctx, budgetsOf(db, ctx), onDate),
    )
    return varianceReport(
      report.rows.map((row) => ({
        budget: row.budget,
        periodStart: row.periodStart,
        actualMinor: row.performance.actualMinor,
      })),
    )
  })

  router.post('/operations/budgets/check', (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const posting = parseWith(checkBudgetSpendBodySchema, bodyOf(body))
    const controlling = controllingBudgets(budgetsOf(db, ctx), posting)
    const consumption = new Map<string, BudgetConsumption>()
    for (const budget of controlling) {
      consumption.set(budget.id, consumptionOf(db, ctx, budget, posting.onDate))
    }
    return decideBudgetSpend(controlling, consumption, posting)
  })

  router.put('/operations/budgets/:id', (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    const input = parseWith(budgetBodySchema, { ...bodyOf(body), id: params.id ?? '' })

    // A cost centre is a dimension, and the device holds none.
    if (input.dimensionValueId) {
      throw new ValidationError(
        'BUDGET_DIMENSION_OFFLINE: a budget for one cost centre is set when you are online.',
      )
    }

    // The amount and the period are checked first, by the SHARED rule.
    const currency = input.currency ?? ctx.baseCurrency
    const early = planBudgetSave(input, { baseCurrency: ctx.baseCurrency, fxRate: null })
    if (!early.ok && !early.problem.startsWith('BUDGET_FX_RATE_MISSING')) {
      throw new ValidationError(early.problem)
    }

    const existing = budgetsOf(db, ctx).find((b) => b.id === input.id)
    if (existing && existing.status === 'approved') {
      throw new ConflictError('BUDGET_APPROVED_REQUIRES_REVISION')
    }

    // The account and the branch must be this business's.
    const account = db.get<{ id: string }>(
      'SELECT id FROM account WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [input.accountId, ctx.workspaceId],
    )
    if (!account) throw new ValidationError('BUDGET_ACCOUNT_INVALID')
    if (input.branchId) {
      const branch = db.get<{ id: string }>(
        'SELECT id FROM branch WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
        [input.branchId, ctx.workspaceId],
      )
      if (!branch) throw new ValidationError('BUDGET_BRANCH_INVALID')
    }

    // A foreign entry is converted at this business's own quote for the period
    // start — the most recent ON OR BEFORE it, never a later one.
    let quoteRate: number | null = null
    if (currency !== ctx.baseCurrency) {
      const quotes = db
        .all<{ currency_code: string; rate: number; rate_date: string }>(
          `SELECT currency_code, rate, rate_date FROM exchange_rate
            WHERE workspace_id = ? AND currency_code = ? AND deleted_at IS NULL
              AND substr(rate_date, 1, 10) <= ?
            ORDER BY rate_date DESC LIMIT 1`,
          [ctx.workspaceId, currency, input.startsOn.slice(0, 10)],
        )
        .map((row) => ({
          currency: row.currency_code,
          rate: Number(row.rate) || 0,
          onDate: String(row.rate_date ?? '').slice(0, 10),
        }))
      const quote = rateFor(quotes, currency, input.startsOn.slice(0, 10))
      if ('error' in quote) throw new ValidationError(`BUDGET_FX_RATE_MISSING: ${currency}`)
      quoteRate = quote.rate
    }
    const planned = planBudgetSave(input, { baseCurrency: ctx.baseCurrency, fxRate: quoteRate })
    if (!planned.ok) throw new ValidationError(planned.problem)
    const { amountMinor, enteredMinor, fxRate, distribution } = planned.plan

    const now = nowIso()
    const distributionJson = distribution ? JSON.stringify(distribution) : null
    if (existing) {
      db.run(
        `UPDATE budget SET account_id = ?, branch_id = ?, period = ?, starts_on = ?, amount_minor = ?,
           action = ?, warn_at_percent = ?, is_active = ?, name = ?, budget_type = ?, notes = ?,
           distribution = ?, currency = ?, amount_currency_minor = ?, fx_rate = ?, updated_at = ?
         WHERE id = ? AND workspace_id = ?`,
        [
          input.accountId,
          input.branchId ?? null,
          input.period,
          input.startsOn,
          amountMinor,
          input.action,
          input.warnAtPercent,
          input.isActive ? 1 : 0,
          input.name ?? null,
          input.type,
          input.notes ?? null,
          distributionJson,
          currency,
          enteredMinor,
          fxRate,
          now,
          input.id,
          ctx.workspaceId,
        ],
      )
    } else {
      db.run(
        `INSERT INTO budget (
           id, workspace_id, account_id, branch_id, period, starts_on, amount_minor, action,
           warn_at_percent, is_active, name, budget_type, status, version, distribution, notes,
           created_by, currency, amount_currency_minor, fx_rate, created_at, updated_at,
           origin, sync_state
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
        [
          input.id,
          ctx.workspaceId,
          input.accountId,
          input.branchId ?? null,
          input.period,
          input.startsOn,
          amountMinor,
          input.action,
          input.warnAtPercent,
          input.isActive ? 1 : 0,
          input.name ?? null,
          input.type,
          distributionJson,
          input.notes ?? null,
          ctx.userId,
          currency,
          enteredMinor,
          fxRate,
          now,
          now,
        ],
      )
    }
    return oneBudget(db, ctx, input.id)
  })

  router.post('/operations/budgets/:id/submit', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const budget = oneBudget(db, ctx, params.id ?? '')
    const planned = planBudgetSubmit(budget)
    if (!planned.ok) throw new ConflictError(planned.problem)
    return transition(db, ctx, budget.id, planned.plan.from, planned.plan.to, planned.plan.extra)
  })

  router.post('/operations/budgets/:id/approve', (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    // An override reason belongs to a separation-of-duties policy; a one-person
    // device has none, so the body is validated and nothing more is asked of it.
    parseWith(approveBudgetBodySchema, bodyOf(body))
    const budget = oneBudget(db, ctx, params.id ?? '')
    const planned = planBudgetApprove(budget, budgetsOf(db, ctx), ctx.userId, nowIso())
    if (!planned.ok) throw new ConflictError(planned.problem)
    return transition(db, ctx, budget.id, planned.plan.from, planned.plan.to, planned.plan.extra)
  })

  router.post('/operations/budgets/:id/archive', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const budget = oneBudget(db, ctx, params.id ?? '')
    const planned = planBudgetArchive(budget)
    if (!planned.ok) throw new ConflictError(planned.problem)
    return transition(db, ctx, budget.id, planned.plan.from, planned.plan.to, planned.plan.extra)
  })

  // Revise an APPROVED budget. The previous version survives in budget_revision;
  // posted journal entries are never touched. Atomic and version-locked.
  router.post('/operations/budgets/:id/revise', (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    const input = parseWith(reviseBudgetBodySchema, bodyOf(body))
    const budget = oneBudget(db, ctx, params.id ?? '')
    const now = nowIso()
    const planned = planBudgetRevision(budget, input, { actorId: ctx.userId, at: now })
    if (!planned.ok) {
      throw planned.kind === 'conflict'
        ? new ConflictError(planned.problem)
        : new ValidationError(planned.problem)
    }
    const { revision } = planned.plan

    return db.transaction(() => {
      const result = db.run(
        `UPDATE budget SET amount_minor = ?, distribution = ?, action = ?, warn_at_percent = ?,
           version = ?, approved_by = ?, approved_at = ?, updated_at = ?
         WHERE id = ? AND workspace_id = ? AND status = 'approved' AND version = ?`,
        [
          planned.plan.amountMinor,
          JSON.stringify(planned.plan.distribution),
          planned.plan.action,
          planned.plan.warnAtPercent,
          revision.version,
          ctx.userId,
          now,
          now,
          budget.id,
          ctx.workspaceId,
          input.expectedVersion,
        ],
      )
      if (result.changes === 0) throw new ConflictError('BUDGET_VERSION_CONFLICT')

      db.run(
        `INSERT INTO budget_revision (
           id, workspace_id, budget_id, version, previous_version, reason, actor_id,
           previous_values, new_values, lines, approved_by, created_at, origin, sync_state
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
        [
          newId(),
          ctx.workspaceId,
          budget.id,
          revision.version,
          revision.previousVersion,
          revision.reason,
          ctx.userId,
          JSON.stringify({
            amount_minor: budget.amountMinor,
            distribution: budget.distribution
              ? budget.distribution.map((d) => ({ start: d.start, amount_minor: d.amountMinor }))
              : null,
            action: budget.action,
            warn_at_percent: budget.warnAtPercent,
          }),
          JSON.stringify({
            amount_minor: planned.plan.amountMinor,
            distribution: planned.plan.distribution,
            action: planned.plan.action,
            warn_at_percent: planned.plan.warnAtPercent,
          }),
          JSON.stringify(
            revision.lines.map((line) => ({
              line_key: line.lineKey,
              before_minor: line.beforeMinor,
              after_minor: line.afterMinor,
            })),
          ),
          ctx.userId,
          now,
        ],
      )
      return { ...revision, result: { version: revision.version } }
    })
  })

  router.get('/operations/budgets/:id/revisions', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const budget = oneBudget(db, ctx, params.id ?? '')
    const parse = (text: string | null) => {
      if (text === null) return null
      try {
        return JSON.parse(text)
      } catch {
        return null
      }
    }
    return db
      .all<Record<string, any>>(
        'SELECT * FROM budget_revision WHERE workspace_id = ? AND budget_id = ? ORDER BY version DESC LIMIT 200',
        [ctx.workspaceId, budget.id],
      )
      .map((row) => ({
        id: row.id,
        version: row.version,
        previous_version: row.previous_version,
        reason: row.reason,
        actor_id: row.actor_id,
        previous_values: parse(row.previous_values),
        new_values: parse(row.new_values),
        lines: parse(row.lines) ?? [],
        approved_by: row.approved_by,
        created_at: row.created_at,
      }))
  })
}
