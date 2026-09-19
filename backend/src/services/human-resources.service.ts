// ============================================
// backend/src/services/human-resources.service.ts — Optimized v2.1
// FIXED: Added cache, pagination, count: estimated, projection
// ============================================

import { supabase } from '../db'
import {
  CreateDepartment,
  UpdateDepartment,
  CreateEmployee,
  UpdateEmployee,
  CreateAttendance,
  UpdateAttendance,
  CreatePayroll,
  UpdatePayroll,
  CreateLeave,
  UpdateLeave,
} from '@hisabche/validation'
import { DatabaseError, NotFoundError } from '../errors/database.error'
import type { TenancyContext } from './tenancy.service'
import { memoryCache } from '../utils/pagination'
import { logBusinessEvent } from './event-log.service'
import { ledger, type DraftLine } from './accounting'
import type { AccountRole } from '@hisabche/validation'
import { linesBalance, payrollLines } from './payroll/payroll-ledger.domain'

/**
 * G2 — does this error mean `employee_branch_assignments` has not been created
 * yet, rather than that the write was wrong?
 *
 *   42P01    — undefined_table (Postgres)
 *   PGRST205 — PostgREST could not find the table in its schema cache
 *
 * Both are what a database that has not run phase-d-01 returns for a table the
 * code already knows about.
 */
function isMissingAssignmentsTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  return /employee_branch_assignments/i.test(error.message ?? '')
}

// ✅ Column Selection Constants
const DEPARTMENT_COLUMNS =
  'id, name, name_en, parent_id, manager_id, description, is_active, created_at'
const DEPARTMENT_MINIMAL = 'id, name, is_active'

const EMPLOYEE_LIST_COLUMNS = `
  id, employee_code, first_name, last_name, phone, email,
  department_id, position, employment_type, hire_date, status, salary, salary_currency
`
const EMPLOYEE_DETAIL_COLUMNS = `
  id, employee_code, first_name, last_name, father_name, national_id, passport_number,
  date_of_birth, gender, marital_status, email, phone, emergency_contact,
  address, city, province, photo_url, department_id, position, employment_type,
  hire_date, termination_date, status, salary, salary_currency,
  bank_account, bank_name, notes, created_at, updated_at
`
const ATTENDANCE_COLUMNS = 'id, employee_id, date, check_in, check_out, status, notes, created_at'
const ATTENDANCE_MINIMAL = 'id, employee_id, date, status'

const PAYROLL_COLUMNS = `
  id, employee_id, period_start, period_end, base_salary, bonuses, deductions,
  overtime_hours, overtime_rate, overtime_amount, tax_amount, net_salary,
  currency, status, payment_date, notes, created_at
`
const PAYROLL_MINIMAL =
  'id, employee_id, period_start, period_end, net_salary, status, payment_date, currency'

const LEAVE_COLUMNS = `
  id, employee_id, leave_type, start_date, end_date, total_days,
  reason, status, approved_by, approved_at, notes, created_at
`
const LEAVE_MINIMAL = 'id, employee_id, leave_type, start_date, end_date, status'

export class HumanResourcesService {
  // ─── Cache Keys ──────────────────────────────────────────────
  private getDepartmentsCacheKey(workspaceId: string) {
    return `hr:departments:${workspaceId}`
  }

  private getEmployeesCacheKey(workspaceId: string, departmentId?: string) {
    return `hr:employees:${workspaceId}:${departmentId || 'all'}`
  }

  private getEmployeeCacheKey(workspaceId: string, id: string) {
    return `hr:employee:${workspaceId}:${id}`
  }

  private getAttendanceCacheKey(workspaceId: string, employeeId: string, month?: string) {
    return `hr:attendance:${workspaceId}:${employeeId}:${month || 'all'}`
  }

  private getPayrollsCacheKey(workspaceId: string, employeeId?: string) {
    return `hr:payrolls:${workspaceId}:${employeeId || 'all'}`
  }

  private getLeavesCacheKey(workspaceId: string, employeeId?: string) {
    return `hr:leaves:${workspaceId}:${employeeId || 'all'}`
  }

  // ─── Departments ─────────────────────────────────────────────
  async listDepartments(ctx: TenancyContext) {
    const { workspaceId, userId } = ctx
    const cacheKey = this.getDepartmentsCacheKey(workspaceId)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('departments')
      .select(DEPARTMENT_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('name')

    if (error) throw new DatabaseError('Failed to fetch departments', error)

    const result = data || []
    await memoryCache.set(cacheKey, result, 300) // 5 minutes
    return result
  }

  async createDepartment(ctx: TenancyContext, data: CreateDepartment) {
    const { workspaceId, userId } = ctx
    const { data: dept, error } = await supabase
      .from('departments')
      .insert({
        name: data.name,
        name_en: data.nameEn || null,
        parent_id: data.parentId || null,
        manager_id: data.managerId || null,
        description: data.description || null,
        is_active: data.isActive,
        workspace_id: workspaceId,
        user_id: userId,
      })
      .select(DEPARTMENT_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create department', error)

    await memoryCache.invalidate(this.getDepartmentsCacheKey(workspaceId))
    return dept
  }

  async updateDepartment(ctx: TenancyContext, id: string, data: UpdateDepartment) {
    const { workspaceId, userId } = ctx
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.name !== undefined) updates.name = data.name
    if (data.nameEn !== undefined) updates.name_en = data.nameEn
    if (data.parentId !== undefined) updates.parent_id = data.parentId
    if (data.managerId !== undefined) updates.manager_id = data.managerId
    if (data.description !== undefined) updates.description = data.description
    if (data.isActive !== undefined) updates.is_active = data.isActive

    const { data: dept, error } = await supabase
      .from('departments')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select(DEPARTMENT_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update department', error)

    await memoryCache.invalidate(this.getDepartmentsCacheKey(workspaceId))
    return dept
  }

  // ─── Employees ──────────────────────────────────────────────

  /**
   * Remove a person from the roster — by DEACTIVATING them, never by deleting.
   *
   * ---------------------------------------------------------------------------
   * WHY THIS IS NOT A DELETE
   *
   * An employee is referenced by payroll runs, leave records, timesheets and
   * every activity row they generated. Deleting the row orphans all of it, and
   * a payroll for a person who no longer exists is a hole in the books that
   * cannot be audited.
   *
   * The client has always called `DELETE /employees/:id` — it 404'd, so the
   * button did nothing. This makes the verb honest: the HTTP method is DELETE
   * because that is what the user means, and the effect is a soft delete
   * because that is what the books require.
   */
  async deactivateEmployee(ctx: TenancyContext, id: string): Promise<{ id: string }> {
    const { data, error } = await supabase
      .from('employees')
      .update({ is_active: false })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to deactivate the employee', error)
    if (!data) throw new NotFoundError('Employee')

    return { id: data.id as string }
  }

  async listEmployees(ctx: TenancyContext, departmentId?: string) {
    const { workspaceId, userId } = ctx
    const cacheKey = this.getEmployeesCacheKey(workspaceId, departmentId)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    let query = supabase
      .from('employees')
      .select(`${EMPLOYEE_LIST_COLUMNS}, department:departments(${DEPARTMENT_MINIMAL})`)
      .eq('workspace_id', workspaceId)

    if (departmentId) query = query.eq('department_id', departmentId)

    const { data, error } = await query.order('first_name')
    if (error) throw new DatabaseError('Failed to fetch employees', error)

    const result = data || []
    await memoryCache.set(cacheKey, result, 120) // 2 minutes
    return result
  }

  async getEmployee(id: string, ctx: TenancyContext) {
    const { workspaceId, userId } = ctx
    const cacheKey = this.getEmployeeCacheKey(workspaceId, id)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('employees')
      .select(`${EMPLOYEE_DETAIL_COLUMNS}, department:departments(${DEPARTMENT_COLUMNS})`)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !data) throw new DatabaseError('Employee not found', error)

    // ─── H5 — which branch(es) this person actually works at ────────────────
    //
    // `employee_branch_assignments` was created in Phase D and the
    // `employee_current_branches` view over it had ZERO readers: the
    // assignment was written by G2's form and could not be read back
    // anywhere. An employee profile showed a department and no branch.
    //
    // ⚠️ A SEPARATE QUERY, NOT AN EMBED. Adding it to the select above would
    // make the WHOLE employee read fail with 42P01 on a database that has not
    // run phase-d — the same reasoning that kept `document_status` out of the
    // invoice insert (lesson 65). Here the profile still loads; it just shows
    // no branches.
    const branches = await this.currentBranches(workspaceId, id)

    const enriched = { ...data, branches }
    await memoryCache.set(cacheKey, enriched, 300) // 5 minutes
    return enriched
  }

  /**
   * The branches this employee is currently assigned to, primary first.
   *
   * Returns `[]` rather than throwing when the table does not exist — the
   * caller is a profile screen, and a missing migration should cost the branch
   * section, not the whole page.
   */
  private async currentBranches(workspaceId: string, employeeId: string) {
    const { data, error } = await supabase
      .from('employee_branch_assignments')
      .select('branch_id, is_primary, started_at, branch:branches(id, name, code)')
      .eq('workspace_id', workspaceId)
      .eq('employee_id', employeeId)
      // An assignment that has ended is history, not a current posting.
      .is('ended_at', null)
      .order('is_primary', { ascending: false })

    if (error) {
      if (isMissingAssignmentsTable(error)) return []
      console.error('[HR] failed to read branch assignments:', error)
      return []
    }

    return (data ?? []).map((row: Record<string, any>) => {
      // PostgREST hands back an embedded to-one as an ARRAY when it cannot
      // prove the relationship — a missing FK, which this schema has several
      // of. Both shapes are handled or the branch name renders blank on
      // exactly the databases with that problem.
      const branch = Array.isArray(row.branch) ? row.branch[0] : row.branch
      return {
        branchId: row.branch_id,
        branchName: branch?.name ?? null,
        branchCode: branch?.code ?? null,
        isPrimary: Boolean(row.is_primary),
        startedAt: row.started_at ?? null,
      }
    })
  }

  async createEmployee(ctx: TenancyContext, data: CreateEmployee) {
    const { workspaceId, userId } = ctx

    // The branch is verified BEFORE the employee row exists. It used to be
    // checked after the insert, so a branch from another workspace (or a
    // deleted one) left the employee created and answered 500 — and the retry
    // then failed again on the now-duplicate employee code.
    if (data.branchId) {
      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id')
        .eq('id', data.branchId)
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .maybeSingle()
      if (branchError) throw new DatabaseError('Failed to verify branch', branchError)
      if (!branch) throw new NotFoundError('Branch')
    }

    const { data: emp, error } = await supabase
      .from('employees')
      .insert({
        employee_code: data.employeeCode,
        first_name: data.firstName,
        last_name: data.lastName,
        father_name: data.fatherName || null,
        national_id: data.nationalId || null,
        passport_number: data.passportNumber || null,
        date_of_birth: data.dateOfBirth || null,
        gender: data.gender || null,
        marital_status: data.maritalStatus || null,
        email: data.email || null,
        phone: data.phone || null,
        emergency_contact: data.emergencyContact || null,
        address: data.address || null,
        city: data.city || null,
        province: data.province || null,
        department_id: data.departmentId || null,
        position: data.position || null,
        employment_type: data.employmentType,
        hire_date: data.hireDate,
        salary: data.salary,
        salary_currency: data.salaryCurrency,
        bank_account: data.bankAccount || null,
        bank_name: data.bankName || null,
        notes: data.notes || null,
        workspace_id: workspaceId,
        user_id: userId,
      })
      .select(EMPLOYEE_LIST_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create employee', error)

    // G2 — the branch, if one was chosen on the form.
    //
    // Written to `employee_branch_assignments`, NOT to a column on `employees`.
    // A column would say "this person is at this branch, forever, with no
    // record of when that started" — and would be overwritten on transfer, so
    // last quarter's payroll could no longer say where they actually worked.
    if (data.branchId) {
      await this.assignPrimaryBranch(ctx, emp.id, data.branchId)
    }

    await this.invalidateEmployeeCache(workspaceId)

    logBusinessEvent({
      userId,
      entityType: 'employee',
      entityId: emp.id,
      action: 'created',
      title: `کارمند جدید: ${emp.first_name} ${emp.last_name}`,
      description: emp.position || undefined,
      notify: false,
    }).catch((err) => console.error('[HumanResourcesService] logBusinessEvent failed:', err))

    return emp
  }

  /**
   * G2 — post an employee to their home branch.
   *
   * Opens a PRIMARY assignment starting today. Any open primary the employee
   * already has is closed first: `employee_branch_assignments_one_primary` is a
   * partial unique index over open primaries, so a second one is not merely
   * wrong, it is refused by the database.
   *
   * ⚠️ Fails LOUDLY if the assignments table is missing. The alternative —
   * creating the employee and swallowing the branch — tells the user their
   * choice was saved when it was discarded, which is the silent-failure shape
   * the database skill forbids on any write that specifically needed a column.
   */
  private async assignPrimaryBranch(ctx: TenancyContext, employeeId: string, branchId: string) {
    const { workspaceId, userId } = ctx

    // The branch must be ours. `branch_id` has a foreign key to `branches`,
    // which proves the branch exists — not that it belongs to this business
    // (lesson 17).
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('id')
      .eq('id', branchId)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (branchError) throw new DatabaseError('Failed to verify branch', branchError)
    if (!branch) throw new NotFoundError('Branch')

    const today = new Date().toISOString().slice(0, 10)

    const { error: closeError } = await supabase
      .from('employee_branch_assignments')
      .update({ ends_at: today })
      .eq('workspace_id', workspaceId)
      .eq('employee_id', employeeId)
      .eq('is_primary', true)
      .is('ends_at', null)

    if (closeError && !isMissingAssignmentsTable(closeError)) {
      throw new DatabaseError('Failed to close the previous branch assignment', closeError)
    }

    const { error: insertError } = await supabase.from('employee_branch_assignments').insert({
      workspace_id: workspaceId,
      employee_id: employeeId,
      branch_id: branchId,
      is_primary: true,
      starts_at: today,
      created_by: userId,
    })

    if (insertError) {
      if (isMissingAssignmentsTable(insertError)) {
        throw new DatabaseError(
          'EMPLOYEE_BRANCH_NOT_MIGRATED: employee_branch_assignments does not exist. Run docs/phase-d-01-employee-branch-assignments-migration.sql.',
          insertError,
        )
      }
      throw new DatabaseError('Failed to assign the employee to a branch', insertError)
    }

    await memoryCache.invalidate(`branch:${workspaceId}`)
  }

  async updateEmployee(ctx: TenancyContext, id: string, data: UpdateEmployee) {
    const { workspaceId, userId } = ctx
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
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

    const { data: emp, error } = await supabase
      .from('employees')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select(EMPLOYEE_LIST_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update employee', error)

    await this.invalidateEmployeeCache(workspaceId, id)
    return emp
  }

  // ─── Attendance ─────────────────────────────────────────────
  async listAttendance(ctx: TenancyContext, employeeId: string, month?: string) {
    const { workspaceId, userId } = ctx
    const cacheKey = this.getAttendanceCacheKey(workspaceId, employeeId, month)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    let query = supabase
      .from('attendance')
      .select(ATTENDANCE_MINIMAL)
      .eq('workspace_id', workspaceId)
      .eq('employee_id', employeeId)

    if (month) {
      query = query.gte('date', `${month}-01`).lte('date', `${month}-31`)
    }

    const { data, error } = await query.order('date', { ascending: false })
    if (error) throw new DatabaseError('Failed to fetch attendance', error)

    const result = data || []
    await memoryCache.set(cacheKey, result, 60) // 1 minute
    return result
  }

  async createAttendance(ctx: TenancyContext, data: CreateAttendance) {
    const { workspaceId, userId } = ctx
    const { data: att, error } = await supabase
      .from('attendance')
      .insert({
        employee_id: data.employeeId,
        date: data.date,
        check_in: data.checkIn || null,
        check_out: data.checkOut || null,
        status: data.status,
        notes: data.notes || null,
        workspace_id: workspaceId,
        user_id: userId,
      })
      .select(ATTENDANCE_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to record attendance', error)

    await this.invalidateAttendanceCache(workspaceId, data.employeeId)
    return att
  }

  async updateAttendance(ctx: TenancyContext, id: string, data: UpdateAttendance) {
    const { workspaceId, userId } = ctx
    // ✅ ابتدا employeeId را برای invalidate کش بگیر
    const { data: existing } = await supabase
      .from('attendance')
      .select('employee_id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.checkIn !== undefined) updates.check_in = data.checkIn
    if (data.checkOut !== undefined) updates.check_out = data.checkOut
    if (data.status !== undefined) updates.status = data.status
    if (data.notes !== undefined) updates.notes = data.notes

    const { data: att, error } = await supabase
      .from('attendance')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select(ATTENDANCE_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update attendance', error)

    if (existing) {
      await this.invalidateAttendanceCache(workspaceId, existing.employee_id)
    }
    return att
  }

  // ─── Payroll ────────────────────────────────────────────────
  async listPayrolls(ctx: TenancyContext, employeeId?: string) {
    const { workspaceId, userId } = ctx
    const cacheKey = this.getPayrollsCacheKey(workspaceId, employeeId)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    let query = supabase
      .from('payrolls')
      .select(`${PAYROLL_MINIMAL}, employee:employees(first_name, last_name)`)
      .eq('workspace_id', workspaceId)

    if (employeeId) query = query.eq('employee_id', employeeId)

    const { data, error } = await query.order('period_start', { ascending: false })
    if (error) throw new DatabaseError('Failed to fetch payrolls', error)

    const result = data || []
    await memoryCache.set(cacheKey, result, 120) // 2 minutes
    return result
  }

  async createPayroll(ctx: TenancyContext, data: CreatePayroll) {
    const { workspaceId, userId } = ctx
    const overtimeAmount = data.overtimeHours * data.overtimeRate
    const netSalary =
      data.baseSalary + data.bonuses + overtimeAmount - data.deductions - data.taxAmount

    const { data: payroll, error } = await supabase
      .from('payrolls')
      .insert({
        employee_id: data.employeeId,
        period_start: data.periodStart,
        period_end: data.periodEnd,
        base_salary: data.baseSalary,
        bonuses: data.bonuses,
        deductions: data.deductions,
        overtime_hours: data.overtimeHours,
        overtime_rate: data.overtimeRate,
        overtime_amount: overtimeAmount,
        tax_amount: data.taxAmount,
        net_salary: netSalary,
        currency: data.currency,
        // ═══════════════════════════════════════════════════════════════════
        // ⚠️ THE CALLER'S STATUS AND PAYMENT DATE USED TO BE DISCARDED.
        //
        // This wrote `status: 'draft'` unconditionally and never wrote
        // `payment_date` at all. «ثبت پرداخت» on an employee sends
        // `status: 'paid'` with the date the owner picked — and got back a
        // draft with no payment date. The row then rendered its PERIOD start
        // instead of the payment date, and no payment ever counted as paid.
        // That is «حقوق کار نمی‌کند» (request #98-ح).
        //
        // The schema's own default is 'draft', so a caller that says nothing
        // still gets a draft; one that states an outcome is now believed.
        // ═══════════════════════════════════════════════════════════════════
        status: data.status,
        payment_date: data.paymentDate ?? null,
        notes: data.notes || null,
        workspace_id: workspaceId,
        user_id: userId,
      })
      .select(PAYROLL_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create payroll', error)

    await this.invalidatePayrollCache(workspaceId, data.employeeId)
    return payroll
  }

  async updatePayrollStatus(ctx: TenancyContext, id: string, data: UpdatePayroll) {
    const { workspaceId, userId } = ctx
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.status !== undefined) updates.status = data.status
    if (data.paymentDate !== undefined) updates.payment_date = data.paymentDate

    const { data: payroll, error } = await supabase
      .from('payrolls')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select(PAYROLL_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update payroll', error)

    // ─── J4 — A PAID SALARY REACHES THE BOOKS ────────────────────────────────
    //
    // This method used to end here. A payroll moved to `paid` and nothing was
    // written to the ledger: a salary expense and a cash outflow, both real and
    // both material, happened entirely outside the books. Every income
    // statement was short by exactly the payroll, every month, and nothing
    // reported an error because nothing knew an entry was owed.
    if (data.status === 'paid') {
      await this.bookPayroll(ctx, payroll as Record<string, unknown>)
    }

    await this.invalidatePayrollCache(workspaceId)
    return payroll
  }

  /**
   * J4 — the journal entry behind a paid payroll.
   *
   * Booked through the ledger port, so it is idempotent per (sourceType,
   * sourceId): marking the same payroll paid twice books once.
   *
   * ⚠️ A chart of accounts that cannot express it leaves the payroll RECORDED
   * and says so, rather than refusing to pay someone's wages. That is the same
   * choice `payments.service.bookPayment` makes for the same reason — and it is
   * why `payroll_posting_readiness` exists, so the gap is visible rather than
   * only in a log line.
   */
  private async bookPayroll(ctx: TenancyContext, payroll: Record<string, unknown>): Promise<void> {
    const toMinor = (value: unknown) => Math.round((Number(value) || 0) * 100)

    const amounts = {
      // Gross is what the business BEARS: base plus bonuses plus overtime.
      // `net_salary` is what the employee receives and is not the expense.
      grossMinor:
        toMinor(payroll.base_salary) + toMinor(payroll.bonuses) + toMinor(payroll.overtime_amount),
      taxMinor: toMinor(payroll.tax_amount),
      deductionsMinor: toMinor(payroll.deductions),
      netMinor: toMinor(payroll.net_salary),
    }

    // Cash unless the business keeps no cash account. A shop paying wages by
    // transfer and one paying from the till book the same entry with a
    // different credit side.
    const { accounts: available } = await ledger.resolveAccountsByRole(ctx, ['cash', 'bank'])
    const cashRole: 'cash' | 'bank' = available.cash ? 'cash' : 'bank'

    const lines = payrollLines(amounts, cashRole)

    if (lines.length === 0) {
      // A payroll of zero. Not booked — `accounting_post_journal_entry` refuses
      // a zero entry, and a zero payroll is a data problem to look at rather
      // than an entry to file.
      console.warn(
        `[HumanResources] payroll ${String(payroll.id)} has no gross amount; not booked.`,
      )
      return
    }

    if (!linesBalance(lines)) {
      // Refused here rather than discovered as a Postgres exception three
      // layers down. If this ever fires, the payroll's own figures do not add
      // up and the row is the thing to fix.
      console.error(
        `[HumanResources] payroll ${String(payroll.id)} produced unbalanced lines; not booked.`,
      )
      return
    }

    const needed = [...new Set(lines.map((line) => line.role))] as AccountRole[]
    const { accounts, missing } = await ledger.ensureAccountsForRoles(ctx, needed)

    if (missing.length > 0) {
      console.warn(
        `[HumanResources] payroll ${String(payroll.id)} not booked: no account for ${missing.join(', ')}. See payroll_posting_readiness.`,
      )
      return
    }

    const entryDate = String(payroll.payment_date ?? payroll.period_end ?? '').slice(0, 10)

    await ledger.postDocument(ctx, {
      sourceType: 'payroll',
      sourceId: String(payroll.id),
      // Lesson 7: the ACCOUNTING date, not created_at. A payroll for last month
      // paid today belongs to last month's figures.
      date: entryDate || new Date().toISOString().slice(0, 10),
      description: `حقوق — ${String(payroll.period_start ?? '')} تا ${String(payroll.period_end ?? '')}`,
      lines: lines.map((line) => ({
        accountId: accounts[line.role as AccountRole] as string,
        debit: line.debitMinor / 100,
        credit: line.creditMinor / 100,
      })) as DraftLine[],
    })
  }

  // ─── Payroll Summary (جمع حقوق) ──────────────────────────────
  // aggregate سمت سرور — جمع کل پرداختی‌ها و جمع هر کارمند، برای
  // کارت‌های KPI و ستون «جمع حقوق» بدون محاسبه‌ی سنگین سمت کلاینت.
  async getPayrollSummary(ctx: TenancyContext) {
    const { workspaceId, userId } = ctx
    const { data, error } = await supabase
      .from('payrolls')
      .select('employee_id, net_salary')
      .eq('workspace_id', workspaceId)

    if (error) throw new DatabaseError('Failed to fetch payroll summary', error)

    const byEmployee: Record<string, number> = {}
    let total = 0
    for (const row of data || []) {
      const amount = Number(row.net_salary) || 0
      total += amount
      byEmployee[row.employee_id] = (byEmployee[row.employee_id] || 0) + amount
    }

    return { total, byEmployee }
  }

  // ─── Leaves ─────────────────────────────────────────────────
  async listLeaves(ctx: TenancyContext, employeeId?: string) {
    const { workspaceId, userId } = ctx
    const cacheKey = this.getLeavesCacheKey(workspaceId, employeeId)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    let query = supabase
      .from('leaves')
      .select(`${LEAVE_MINIMAL}, employee:employees(first_name, last_name)`)
      .eq('workspace_id', workspaceId)

    if (employeeId) query = query.eq('employee_id', employeeId)

    const { data, error } = await query.order('start_date', { ascending: false })
    if (error) throw new DatabaseError('Failed to fetch leaves', error)

    const result = data || []
    await memoryCache.set(cacheKey, result, 120) // 2 minutes
    return result
  }

  async createLeave(ctx: TenancyContext, data: CreateLeave) {
    const { workspaceId, userId } = ctx
    const start = new Date(data.startDate)
    const end = new Date(data.endDate)
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // Patch 3 / I1 — which branch this leave belongs to.
    const branchId = await this.branchForLeave(ctx, data.employeeId, data.startDate)

    // The columns every database has, patched or not.
    const base = {
      employee_id: data.employeeId,
      leave_type: data.leaveType,
      start_date: data.startDate,
      end_date: data.endDate,
      total_days: totalDays,
      reason: data.reason || null,
      status: 'pending',
      notes: data.notes || null,
      workspace_id: workspaceId,
      user_id: userId,
    }

    /**
     * The three columns patch-03 adds.
     *
     * ⚠️ SPLIT OUT SO A DATABASE WITHOUT THE PATCH STILL ACCEPTS A LEAVE.
     *
     * Migrations here are applied by hand, so code and schema are not
     * simultaneous. An INSERT naming a column that does not exist yet fails
     * with 42703 — and that would take leave requests down completely on
     * every environment between this deploy and that migration.
     */
    const patched = {
      // Patch 3 / I1 — the half-day-capable figure. `total_days` is kept
      // beside it for readers that have not moved over yet.
      duration_units: data.durationUnits ?? totalDays,
      // ⚠️ From the employee's assignment ACTIVE ON THE LEAVE DATE, never
      // today's primary. A leave in March belongs to the branch the person
      // worked in during March.
      branch_id: branchId,
      // ⚠️ Separate from `approved_by` so "the person who asked also approved
      // it" is answerable (I1). Same actor model — the auth user.
      requested_by: userId,
    }

    let { data: leave, error } = await supabase
      .from('leaves')
      .insert({ ...base, ...patched })
      .select(LEAVE_COLUMNS)
      .single()

    if (error && ['42703', 'PGRST204'].includes(error.code)) {
      // patch-03 has not been applied on this database. Record what can be
      // recorded rather than refusing the request — the leave itself is not
      // the thing that is missing.
      console.warn(
        '[HumanResourcesService] leaves is missing the patch-03 columns; ' +
          'recording without duration_units/branch_id/requested_by.',
      )
      ;({ data: leave, error } = await supabase
        .from('leaves')
        .insert(base)
        .select(LEAVE_COLUMNS)
        .single())
    }

    if (error) throw new DatabaseError('Failed to create leave', error)
    // `.single()` guarantees a row when there is no error; the narrowing is
    // for the compiler, which cannot know that across the retry above.
    if (!leave) throw new DatabaseError('Leave did not persist', null)

    await this.invalidateLeaveCache(workspaceId, data.employeeId)

    // ⚠️ I1 REQUIRES AN AUDIT EVENT FOR EVERY LEAVE CHANGE, AND THERE WAS NONE.
    //
    // Before this patch the only audited action in this whole service was
    // employee creation. Leave — which is time off work, approved by one
    // person for another, and feeds payroll — produced no record of who did
    // what. That is the gap I1 named.
    logBusinessEvent({
      userId,
      entityType: 'leave',
      entityId: leave.id,
      action: 'created',
      title: `درخواست مرخصی: ${data.leaveType}`,
      description: `${data.startDate} → ${data.endDate}`,
      notify: false,
    }).catch((err) => console.error('[HumanResourcesService] leave audit failed:', err))

    return leave
  }

  /**
   * The branch an employee belonged to ON A GIVEN DATE.
   *
   * ⚠️ NOT their current primary branch. `employee_branch_assignments` carries
   * `starts_at`/`ends_at` precisely so «where did this person work in March»
   * has an answer; using today's branch for a March leave would state that the
   * leave happened somewhere the person had not started working.
   *
   * Returns null when no assignment covers the date. Null is «unknown», and
   * the caller must not substitute a default — guardrail 12.
   */
  private async branchForLeave(
    ctx: TenancyContext,
    employeeId: string,
    onDate: string,
  ): Promise<string | null> {
    const day = onDate.slice(0, 10)

    const { data, error } = await supabase
      .from('employee_branch_assignments')
      .select('branch_id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('employee_id', employeeId)
      .eq('is_primary', true)
      .lte('starts_at', day)
      .or(`ends_at.is.null,ends_at.gte.${day}`)
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      // The assignments table may not exist on an older database. An absent
      // branch is a supported state, so this degrades rather than failing a
      // leave request.
      if (['42P01', 'PGRST205', '42703', 'PGRST204'].includes(error.code)) return null
      throw new DatabaseError('Failed to resolve the leave branch', error)
    }

    return (data as { branch_id: string } | null)?.branch_id ?? null
  }

  async updateLeaveStatus(ctx: TenancyContext, id: string, data: UpdateLeave) {
    const { workspaceId, userId } = ctx
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.status !== undefined) {
      updates.status = data.status
      if (data.status === 'approved') {
        updates.approved_by = userId
        updates.approved_at = new Date().toISOString()
      }
    }

    const { data: leave, error } = await supabase
      .from('leaves')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select(LEAVE_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update leave', error)

    await this.invalidateLeaveCache(workspaceId)

    // The other half of the I1 audit requirement. Approval and rejection are
    // the decisions worth being able to reconstruct later — who allowed this
    // time off, and when.
    if (data.status !== undefined) {
      logBusinessEvent({
        userId,
        entityType: 'leave',
        entityId: id,
        action: data.status === 'approved' ? 'approved' : data.status,
        title: `مرخصی: ${data.status}`,
        notify: false,
      }).catch((err) => console.error('[HumanResourcesService] leave audit failed:', err))
    }

    return leave
  }

  // ─── Invalidate Cache ───────────────────────────────────────
  private async invalidateEmployeeCache(workspaceId: string, employeeId?: string) {
    await memoryCache.invalidate(this.getEmployeesCacheKey(workspaceId))
    if (employeeId) {
      await memoryCache.invalidate(this.getEmployeeCacheKey(workspaceId, employeeId))
    }
  }

  private async invalidateAttendanceCache(workspaceId: string, employeeId?: string) {
    if (employeeId) {
      await memoryCache.invalidate(this.getAttendanceCacheKey(workspaceId, employeeId))
    }
  }

  private async invalidatePayrollCache(workspaceId: string, employeeId?: string) {
    await memoryCache.invalidate(this.getPayrollsCacheKey(workspaceId))
    if (employeeId) {
      await memoryCache.invalidate(this.getPayrollsCacheKey(workspaceId, employeeId))
    }
  }

  private async invalidateLeaveCache(workspaceId: string, employeeId?: string) {
    await memoryCache.invalidate(this.getLeavesCacheKey(workspaceId))
    if (employeeId) {
      await memoryCache.invalidate(this.getLeavesCacheKey(workspaceId, employeeId))
    }
  }
}

export default HumanResourcesService
