// ============================================
// packages/local-engine/src/routes/employees.ts
//
// Employees, offline — the list, one employee, create, edit, deactivate.
//
// ⚠️ THE SERVER'S SHAPE, NOT A SMALLER ONE. The rows answer in the server's own
// snake_case columns (`first_name`, `hire_date`, `employee_code` …) with the same
// `{ employees, total }` envelope, because every employee screen reads them and
// typing them camelCase blanks every name (CLAUDE.md §8). Bodies are parsed with
// the SAME zod schemas the server's route uses (`createEmployeeSchema`,
// `updateEmployeeSchema`).
//
// What the device honestly does NOT hold:
//   · departments — there is no departments endpoint on the device, so
//     `department` is null while `department_id` is kept as given.
//   · an attendance credential (fingerprint / card enrolment) — it belongs to a
//     terminal. A body that names one is refused out loud
//     (EMPLOYEE_ATTENDANCE_CREDENTIAL_OFFLINE), never accepted and dropped.
//   · a photo — `photo_url` is not stored.
// ============================================

import { createEmployeeSchema, updateEmployeeSchema } from '@hisabche/validation'
import { NotFoundError, ValidationError } from '../errors'
import type { LocalDb } from '../db'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'
import { bodyOf, newId, nowIso, parseWith } from './people-common'

export interface EmployeeRow {
  id: string
  workspace_id: string
  full_name: string
  role: string | null
  phone: string | null
  salary: number | null
  is_active: number
  created_at: string
  updated_at: string
  employee_code: string | null
  first_name: string | null
  last_name: string | null
  father_name: string | null
  national_id: string | null
  passport_number: string | null
  date_of_birth: string | null
  gender: string | null
  marital_status: string | null
  email: string | null
  emergency_contact: string | null
  address: string | null
  city: string | null
  province: string | null
  department_id: string | null
  position: string | null
  employment_type: string | null
  hire_date: string | null
  termination_date: string | null
  status: string | null
  salary_currency: string | null
  bank_account: string | null
  bank_name: string | null
  notes: string | null
}

/** The list shape of the server (`EMPLOYEE_LIST_COLUMNS`). */
export function employeeListRow(row: EmployeeRow) {
  return {
    id: row.id,
    employee_code: row.employee_code,
    // A row cached before v5 has only a full name: that is what is shown, and
    // it is not split into a first and last name by guesswork.
    first_name: row.first_name ?? row.full_name,
    last_name: row.last_name ?? '',
    phone: row.phone,
    email: row.email,
    department_id: row.department_id,
    position: row.position ?? row.role,
    employment_type: row.employment_type,
    hire_date: row.hire_date,
    status: row.status,
    salary: row.salary ?? 0,
    salary_currency: row.salary_currency,
    department: null,
  }
}

function employeeDetailRow(row: EmployeeRow, branches: unknown[]) {
  return {
    ...employeeListRow(row),
    father_name: row.father_name,
    national_id: row.national_id,
    passport_number: row.passport_number,
    date_of_birth: row.date_of_birth,
    gender: row.gender,
    marital_status: row.marital_status,
    emergency_contact: row.emergency_contact,
    address: row.address,
    city: row.city,
    province: row.province,
    photo_url: null,
    termination_date: row.termination_date,
    bank_account: row.bank_account,
    bank_name: row.bank_name,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    branches,
  }
}

function findEmployee(db: LocalDb, workspaceId: string, id: string): EmployeeRow {
  const row = db.get<EmployeeRow>(
    'SELECT * FROM employee WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
    [id, workspaceId],
  )
  if (!row) throw new NotFoundError('Employee', id)
  return row
}

/** The branches this employee is currently assigned to, primary first. */
function currentBranches(db: LocalDb, workspaceId: string, employeeId: string) {
  return db
    .all<{
      branch_id: string
      is_primary: number
      starts_at: string
      name: string | null
      code: string | null
    }>(
      `SELECT a.branch_id, a.is_primary, a.starts_at, b.name, b.code
         FROM employee_branch_assignment a
         LEFT JOIN branch b ON b.id = a.branch_id
        WHERE a.workspace_id = ? AND a.employee_id = ? AND a.ends_at IS NULL
        ORDER BY a.is_primary DESC`,
      [workspaceId, employeeId],
    )
    .map((row) => ({
      branchId: row.branch_id,
      branchName: row.name ?? null,
      branchCode: row.code ?? null,
      isPrimary: Boolean(row.is_primary),
      startedAt: row.starts_at ?? null,
    }))
}

function today(): string {
  return nowIso().slice(0, 10)
}

export function registerEmployeeRoutes(router: Router): void {
  router.get('/employees', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const clauses = ['workspace_id = ?', 'deleted_at IS NULL']
    const params: unknown[] = [ctx.workspaceId]
    if (query.departmentId) {
      clauses.push('department_id = ?')
      params.push(query.departmentId)
    }
    const rows = db.all<EmployeeRow>(
      `SELECT * FROM employee WHERE ${clauses.join(' AND ')} ORDER BY COALESCE(first_name, full_name), id`,
      params,
    )
    const employees = rows.map(employeeListRow)
    return { employees, total: employees.length }
  })

  router.get('/employees/:id', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const row = findEmployee(db, ctx.workspaceId, params.id ?? '')
    return employeeDetailRow(row, currentBranches(db, ctx.workspaceId, row.id))
  })

  router.post('/employees', (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const raw = bodyOf(body)
    const data = parseWith(createEmployeeSchema, raw)

    // A terminal's credential is enrolled on the terminal, not on this device.
    if (data.attendanceMethod || data.attendanceCredential) {
      throw new ValidationError(
        'EMPLOYEE_ATTENDANCE_CREDENTIAL_OFFLINE: a fingerprint, face or card is enrolled on the attendance terminal. Set it when you are online.',
      )
    }

    // The branch is verified BEFORE the employee exists.
    const branch = db.get<{ id: string }>(
      'SELECT id FROM branch WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [data.branchId, ctx.workspaceId],
    )
    if (!branch) throw new NotFoundError('Branch')

    const id = (typeof raw.id === 'string' && raw.id) || newId()
    const now = nowIso()
    const fullName = `${data.firstName} ${data.lastName}`.trim()

    return db.transaction(() => {
      db.run(
        `INSERT INTO employee (
           id, workspace_id, full_name, role, phone, salary, is_active,
           created_at, updated_at, origin, sync_state,
           employee_code, first_name, last_name, father_name, national_id, passport_number,
           date_of_birth, gender, marital_status, email, emergency_contact, address, city,
           province, department_id, position, employment_type, hire_date, termination_date,
           status, salary_currency, bank_account, bank_name, notes
         ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 'local', 'local_only',
                   ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          ctx.workspaceId,
          fullName,
          data.position || null,
          data.phone || null,
          data.salary,
          now,
          now,
          data.employeeCode,
          data.firstName,
          data.lastName,
          data.fatherName || null,
          data.nationalId || null,
          data.passportNumber || null,
          data.dateOfBirth || null,
          data.gender || null,
          data.maritalStatus || null,
          data.email || null,
          data.emergencyContact || null,
          data.address || null,
          data.city || null,
          data.province || null,
          data.departmentId || null,
          data.position || null,
          data.employmentType,
          data.hireDate,
          null,
          data.status,
          // None named = the currency this business keeps its books in.
          data.salaryCurrency ?? ctx.baseCurrency,
          data.bankAccount || null,
          data.bankName || null,
          data.notes || null,
        ],
      )

      // The branch is an assignment with a start date, not a column that a
      // transfer would overwrite.
      db.run(
        `INSERT INTO employee_branch_assignment (
           id, workspace_id, employee_id, branch_id, is_primary, starts_at, created_at, updated_at,
           origin, sync_state
         ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, 'local', 'local_only')`,
        [newId(), ctx.workspaceId, id, data.branchId, today(), now, now],
      )

      return employeeListRow(findEmployee(db, ctx.workspaceId, id))
    })
  })

  router.patch('/employees/:id', (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    const id = params.id ?? ''
    const data = parseWith(updateEmployeeSchema, { ...bodyOf(body), id })
    const current = findEmployee(db, ctx.workspaceId, id)

    // The same fields the server's `updateEmployee` writes — no more.
    const updates: Record<string, unknown> = {}
    if (data.firstName !== undefined) updates.first_name = data.firstName
    if (data.lastName !== undefined) updates.last_name = data.lastName
    if (data.phone !== undefined) updates.phone = data.phone
    if (data.email !== undefined) updates.email = data.email
    if (data.departmentId !== undefined) updates.department_id = data.departmentId
    if (data.position !== undefined) updates.position = data.position
    if (data.salary !== undefined) updates.salary = data.salary
    if (data.status !== undefined) updates.status = data.status
    if (data.terminationDate !== undefined) updates.termination_date = data.terminationDate
    if (data.notes !== undefined) updates.notes = data.notes

    const firstName =
      (updates.first_name as string | undefined) ?? current.first_name ?? current.full_name
    const lastName = (updates.last_name as string | undefined) ?? current.last_name ?? ''
    if (updates.first_name !== undefined || updates.last_name !== undefined) {
      updates.full_name = `${firstName} ${lastName}`.trim()
    }
    updates.updated_at = nowIso()

    const columns = Object.keys(updates)
    db.run(
      `UPDATE employee SET ${columns.map((column) => `${column} = ?`).join(', ')}
        WHERE id = ? AND workspace_id = ?`,
      [...columns.map((column) => updates[column]), id, ctx.workspaceId],
    )
    return employeeListRow(findEmployee(db, ctx.workspaceId, id))
  })

  // The HTTP verb is DELETE because that is what the user means; the effect is a
  // deactivation because that is what the books require (an employee has payrolls).
  router.delete('/employees/:id', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const id = params.id ?? ''
    const result = db.run(
      'UPDATE employee SET is_active = 0, updated_at = ? WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
      [nowIso(), id, ctx.workspaceId],
    )
    if (result.changes === 0) throw new NotFoundError('Employee')
    return { id }
  })
}
