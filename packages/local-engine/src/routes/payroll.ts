// ============================================
// packages/local-engine/src/routes/payroll.ts
//
// Payroll, leaves and the «what will undoing this do» question, offline.
//
// ⚠️ NO SECOND ENGINE. The figures (`computePayrollFigures`), the settle rule
// (`planPayrollOutcome`), the summary (`summarizePayrolls`), the journal entry a
// paid salary makes (`payrollDraftLines`), the leave length and decision
// (`leaveTotalDays`, `planLeaveDecision`) and the branch a leave belongs to
// (`branchOnDate`) are the functions backend/src/services/human-resources.service
// calls. This file only reads and writes SQLite around them.
//
// ⚠️ A PAID SALARY REACHES THE BOOKS (J4) — the same entry the server posts:
// debit salary expense, credit tax / payables / cash-or-bank. It is written in
// the SAME transaction as the status change, so a salary is never «paid» with
// no entry behind it (the server cannot promise that; it books after the write).
// ============================================

import {
  STANDARD_ACCOUNT_FOR_ROLE,
  branchOnDate,
  compensationForRoute,
  computePayrollFigures,
  createLeaveSchema,
  createPayrollSchema,
  leaveTotalDays,
  linesBalance,
  payrollBookingAmounts,
  payrollDraftLines,
  payrollLines,
  planLeaveDecision,
  planPayrollOutcome,
  requiresWarning,
  summarizePayrolls,
  updateLeaveSchema,
  updatePayrollSchema,
  type AccountRole,
} from '@hisabche/validation'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { LocalDb } from '../db'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'
import { bodyOf, newId, nowIso, parseWith, requireEmployee } from './people-common'

interface PayrollRow {
  id: string
  workspace_id: string
  employee_id: string
  period_start: string
  period_end: string
  base_salary: number
  bonuses: number
  deductions: number
  overtime_hours: number
  overtime_rate: number
  overtime_amount: number
  tax_amount: number
  net_salary: number
  currency: string
  status: string | null
  payment_date: string | null
  notes: string | null
  journal_entry_id: string | null
  created_at: string
  updated_at: string
}

interface LeaveRow {
  id: string
  workspace_id: string
  employee_id: string
  leave_type: string
  start_date: string
  end_date: string
  total_days: number
  duration_units: number | null
  reason: string | null
  status: string
  approved_by: string | null
  approved_at: string | null
  requested_by: string | null
  branch_id: string | null
  notes: string | null
  created_at: string
}

/** The server's PAYROLL_COLUMNS. */
function payrollRow(row: PayrollRow) {
  return {
    id: row.id,
    employee_id: row.employee_id,
    period_start: row.period_start,
    period_end: row.period_end,
    base_salary: row.base_salary,
    bonuses: row.bonuses,
    deductions: row.deductions,
    overtime_hours: row.overtime_hours,
    overtime_rate: row.overtime_rate,
    overtime_amount: row.overtime_amount,
    tax_amount: row.tax_amount,
    net_salary: row.net_salary,
    currency: row.currency,
    status: row.status,
    payment_date: row.payment_date,
    notes: row.notes,
    created_at: row.created_at,
  }
}

/** The server's list shape (`PAYROLL_MINIMAL` + the employee's name). */
function payrollListRow(
  row: PayrollRow,
  employee: { first_name: string | null; full_name: string; last_name: string | null } | undefined,
) {
  return {
    id: row.id,
    employee_id: row.employee_id,
    period_start: row.period_start,
    period_end: row.period_end,
    net_salary: row.net_salary,
    status: row.status,
    payment_date: row.payment_date,
    currency: row.currency,
    notes: row.notes,
    employee: employee
      ? {
          first_name: employee.first_name ?? employee.full_name,
          last_name: employee.last_name ?? '',
        }
      : null,
  }
}

function leaveRow(row: LeaveRow) {
  return {
    id: row.id,
    employee_id: row.employee_id,
    leave_type: row.leave_type,
    start_date: row.start_date,
    end_date: row.end_date,
    total_days: row.total_days,
    reason: row.reason,
    status: row.status,
    approved_by: row.approved_by,
    approved_at: row.approved_at,
    notes: row.notes,
    created_at: row.created_at,
  }
}

type EmployeeName = {
  id: string
  first_name: string | null
  last_name: string | null
  full_name: string
}

function employeeNames(db: LocalDb, workspaceId: string): Map<string, EmployeeName> {
  return new Map(
    db
      .all<EmployeeName>(
        'SELECT id, first_name, last_name, full_name FROM employee WHERE workspace_id = ?',
        [workspaceId],
      )
      .map((row) => [row.id, row]),
  )
}

/** The account for a role: the business's own, else the standard one — created once. */
function accountForRole(db: LocalDb, workspaceId: string, role: AccountRole): string | null {
  const own = db.get<{ id: string }>(
    'SELECT id FROM account WHERE workspace_id = ? AND role = ? AND is_active = 1 AND deleted_at IS NULL ORDER BY code LIMIT 1',
    [workspaceId, role],
  )
  if (own) return own.id

  const standard = STANDARD_ACCOUNT_FOR_ROLE[role]
  if (!standard) return null
  // The standard code may already belong to an account of ANOTHER role (the
  // device's invoice engine seeds its own numbering): that account is not this
  // role, and a duplicate code is not created over it.
  const taken = db.get<{ id: string }>(
    'SELECT id FROM account WHERE workspace_id = ? AND code = ? AND deleted_at IS NULL',
    [workspaceId, standard.code],
  )
  if (taken) return null

  const id = newId()
  const now = nowIso()
  db.run(
    `INSERT INTO account (id, workspace_id, code, name, type, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, workspaceId, standard.code, standard.name, standard.type, role, now, now],
  )
  return id
}

/**
 * J4 — the journal entry behind a paid payroll. Idempotent per payroll: marking
 * the same one paid twice books once. Returns the entry id, or null when the
 * payroll has nothing to book (a zero gross is a data problem, not an entry) or
 * the chart cannot express it (the payroll stays recorded, and says nothing false).
 */
function bookPayroll(db: LocalDb, workspaceId: string, payroll: PayrollRow): string | null {
  const existing = db.get<{ id: string }>(
    "SELECT id FROM journal_entry WHERE workspace_id = ? AND source_type = 'payroll' AND source_id = ? AND deleted_at IS NULL",
    [workspaceId, payroll.id],
  )
  if (existing) return existing.id

  const amounts = payrollBookingAmounts(payroll)
  // Cash unless the business keeps no cash account: wages by transfer and wages
  // from the till are the same entry with a different credit side.
  const hasCash = Boolean(
    db.get<{ id: string }>(
      "SELECT id FROM account WHERE workspace_id = ? AND role = 'cash' AND is_active = 1 AND deleted_at IS NULL LIMIT 1",
      [workspaceId],
    ),
  )
  const hasBank = Boolean(
    db.get<{ id: string }>(
      "SELECT id FROM account WHERE workspace_id = ? AND role = 'bank' AND is_active = 1 AND deleted_at IS NULL LIMIT 1",
      [workspaceId],
    ),
  )
  const cashRole: 'cash' | 'bank' = hasCash || !hasBank ? 'cash' : 'bank'

  const lines = payrollLines(amounts, cashRole)
  if (lines.length === 0 || !linesBalance(lines)) return null

  const drafts = payrollDraftLines(payroll, cashRole)
  const accountByRole = new Map<string, string>()
  for (const role of new Set(drafts.map((line) => line.role))) {
    const accountId = accountForRole(db, workspaceId, role as AccountRole)
    if (!accountId) return null
    accountByRole.set(role, accountId)
  }

  const entryDate = String(payroll.payment_date ?? payroll.period_end ?? '').slice(0, 10)
  const date = entryDate || nowIso().slice(0, 10)
  const journalId = newId()
  const now = nowIso()
  db.run(
    `INSERT INTO journal_entry (
       id, workspace_id, entry_number, date, description, reference, status,
       source_type, source_id, posted_at, created_at, updated_at, origin, sync_state
     ) VALUES (?, ?, ?, ?, ?, ?, 'posted', 'payroll', ?, ?, ?, ?, 'local', 'local_only')`,
    [
      journalId,
      workspaceId,
      `J-${date.slice(0, 4)}-PAY-${payroll.id.slice(0, 8)}`,
      date,
      `حقوق — ${payroll.period_start} تا ${payroll.period_end}`,
      payroll.id.slice(0, 8),
      payroll.id,
      now,
      now,
      now,
    ],
  )
  for (const line of drafts) {
    db.run(
      `INSERT INTO journal_line (
         id, workspace_id, journal_id, account_id, debit, credit, description,
         created_at, updated_at, origin, sync_state
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
      [
        newId(),
        workspaceId,
        journalId,
        accountByRole.get(line.role),
        line.debit,
        line.credit,
        payroll.id.slice(0, 8),
        now,
        now,
      ],
    )
  }
  return journalId
}

export function registerPayrollRoutes(router: Router): void {
  // ─── Payroll ────────────────────────────────────────────────
  router.get('/payrolls', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const clauses = ['workspace_id = ?', 'deleted_at IS NULL']
    const params: unknown[] = [ctx.workspaceId]
    if (query.employeeId) {
      clauses.push('employee_id = ?')
      params.push(query.employeeId)
    }
    const names = employeeNames(db, ctx.workspaceId)
    return db
      .all<PayrollRow>(
        `SELECT * FROM payroll WHERE ${clauses.join(' AND ')} ORDER BY period_start DESC, id`,
        params,
      )
      .map((row) => payrollListRow(row, names.get(row.employee_id)))
  })

  router.get('/payrolls/summary', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    return summarizePayrolls(
      db.all<{ employee_id: string; net_salary: number; status: string | null }>(
        'SELECT employee_id, net_salary, status FROM payroll WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY id',
        [ctx.workspaceId],
      ),
    )
  })

  router.post('/payrolls', (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const raw = bodyOf(body)
    const data = parseWith(createPayrollSchema, raw)
    requireEmployee(db, ctx.workspaceId, data.employeeId)

    const { overtimeAmount, netSalary } = computePayrollFigures(data)
    const id = (typeof raw.id === 'string' && raw.id) || newId()
    const now = nowIso()

    return db.transaction(() => {
      db.run(
        `INSERT INTO payroll (
           id, workspace_id, employee_id, period_start, period_end, base_salary, bonuses,
           deductions, overtime_hours, overtime_rate, overtime_amount, tax_amount, net_salary,
           currency, status, payment_date, notes, created_at, updated_at, origin, sync_state
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'local_only')`,
        [
          id,
          ctx.workspaceId,
          data.employeeId,
          data.periodStart,
          data.periodEnd,
          data.baseSalary,
          data.bonuses,
          data.deductions,
          data.overtimeHours,
          data.overtimeRate,
          overtimeAmount,
          data.taxAmount,
          netSalary,
          // None named = the currency this business keeps its books in.
          data.currency ?? ctx.baseCurrency,
          data.status,
          data.paymentDate ?? null,
          data.notes || null,
          now,
          now,
        ],
      )
      const created = db.get<PayrollRow>('SELECT * FROM payroll WHERE id = ?', [id])!
      // A salary recorded as already paid reaches the books too.
      if (data.status === 'paid') {
        const journalId = bookPayroll(db, ctx.workspaceId, created)
        if (journalId) {
          db.run('UPDATE payroll SET journal_entry_id = ? WHERE id = ?', [journalId, id])
        }
      }
      return payrollRow(created)
    })
  })

  router.patch('/payrolls/:id', (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    const id = params.id ?? ''
    const data = parseWith(updatePayrollSchema, { ...bodyOf(body), id })

    return db.transaction(() => {
      const current = db.get<PayrollRow>(
        'SELECT * FROM payroll WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
        [id, ctx.workspaceId],
      )
      if (!current) throw new NotFoundError('Payroll')

      const now = nowIso()
      const outcome = planPayrollOutcome(current, data, now)
      if (!outcome.ok) {
        if (outcome.problem === 'PAYROLL_ALREADY_PAID') {
          throw new ConflictError(
            'PAYROLL_ALREADY_PAID',
            'PAYROLL_ALREADY_PAID: a paid salary is in the books and cannot be changed',
          )
        }
        throw new ValidationError('PAYROLL_REASON_REQUIRED: say why this salary was not paid')
      }

      const changes: Record<string, unknown> = { ...outcome.changes, updated_at: now }
      const columns = Object.keys(changes)
      db.run(
        `UPDATE payroll SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ? AND workspace_id = ?`,
        [...columns.map((column) => changes[column]), id, ctx.workspaceId],
      )
      const updated = db.get<PayrollRow>('SELECT * FROM payroll WHERE id = ?', [id])!
      if (data.status === 'paid') {
        const journalId = bookPayroll(db, ctx.workspaceId, updated)
        if (journalId)
          db.run('UPDATE payroll SET journal_entry_id = ? WHERE id = ?', [journalId, id])
      }
      return payrollRow(updated)
    })
  })

  // ─── Leaves ─────────────────────────────────────────────────
  router.get('/leaves', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const clauses = ['workspace_id = ?', 'deleted_at IS NULL']
    const params: unknown[] = [ctx.workspaceId]
    if (query.employeeId) {
      clauses.push('employee_id = ?')
      params.push(query.employeeId)
    }
    const names = employeeNames(db, ctx.workspaceId)
    return db
      .all<LeaveRow>(
        `SELECT * FROM leave WHERE ${clauses.join(' AND ')} ORDER BY start_date DESC, id`,
        params,
      )
      .map((row) => {
        const employee = names.get(row.employee_id)
        return {
          id: row.id,
          employee_id: row.employee_id,
          leave_type: row.leave_type,
          start_date: row.start_date,
          end_date: row.end_date,
          status: row.status,
          employee: employee
            ? {
                first_name: employee.first_name ?? employee.full_name,
                last_name: employee.last_name ?? '',
              }
            : null,
        }
      })
  })

  router.post('/leaves', (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const raw = bodyOf(body)
    const data = parseWith(createLeaveSchema, raw)
    requireEmployee(db, ctx.workspaceId, data.employeeId)

    const totalDays = leaveTotalDays(data.startDate, data.endDate)
    // From the posting ACTIVE ON THE LEAVE DATE, never today's primary; null is
    // «unknown» and is not replaced by a default.
    const assignments = db.all<{
      branch_id: string
      is_primary: number
      starts_at: string
      ends_at: string | null
    }>(
      'SELECT branch_id, is_primary, starts_at, ends_at FROM employee_branch_assignment WHERE workspace_id = ? AND employee_id = ? AND is_primary = 1',
      [ctx.workspaceId, data.employeeId],
    )
    const branchId = branchOnDate(assignments, data.startDate)

    const id = (typeof raw.id === 'string' && raw.id) || newId()
    const now = nowIso()
    db.run(
      `INSERT INTO leave (
         id, workspace_id, employee_id, leave_type, start_date, end_date, total_days,
         duration_units, reason, status, requested_by, branch_id, notes,
         created_at, updated_at, origin, sync_state
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, 'local', 'local_only')`,
      [
        id,
        ctx.workspaceId,
        data.employeeId,
        data.leaveType,
        data.startDate,
        data.endDate,
        totalDays,
        data.durationUnits ?? totalDays,
        data.reason || null,
        ctx.userId,
        branchId,
        data.notes || null,
        now,
        now,
      ],
    )
    return leaveRow(db.get<LeaveRow>('SELECT * FROM leave WHERE id = ?', [id])!)
  })

  router.patch('/leaves/:id', (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    const id = params.id ?? ''
    const data = parseWith(updateLeaveSchema, { ...bodyOf(body), id })

    return db.transaction(() => {
      const current = db.get<LeaveRow>(
        'SELECT * FROM leave WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
        [id, ctx.workspaceId],
      )
      if (!current) throw new NotFoundError('Leave')

      const now = nowIso()
      const decision = planLeaveDecision(current, data, ctx.userId, now)
      if (!decision.ok) {
        throw new ConflictError(
          'LEAVE_ALREADY_DECIDED',
          'LEAVE_ALREADY_DECIDED: this leave request has already been decided',
        )
      }

      const changes: Record<string, unknown> = { ...decision.changes, updated_at: now }
      const columns = Object.keys(changes)
      db.run(
        `UPDATE leave SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ? AND workspace_id = ?`,
        [...columns.map((column) => changes[column]), id, ctx.workspaceId],
      )
      return leaveRow(db.get<LeaveRow>('SELECT * FROM leave WHERE id = ?', [id])!)
    })
  })

  // ─── What will undoing this do? (#81) ───────────────────────
  // The same table and the same «must we warn» rule as the server; it describes
  // the product's own commands, not anybody's data.
  router.get('/compensation', (c: RouteHandlerContext) => {
    const route = (c.query.route ?? '').trim()
    if (route.length < 3 || route.length > 120) {
      throw new ValidationError('route is required')
    }
    const plan = compensationForRoute(route)
    return {
      route,
      plan: plan
        ? {
            kind: plan.kind,
            strategy: plan.strategy,
            touchesBooks: plan.touchesBooks,
            needsHuman: plan.needsHuman,
          }
        : null,
      warn: requiresWarning(plan),
    }
  })
}
