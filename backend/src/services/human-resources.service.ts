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
import { DatabaseError } from '../errors/database.error'
import type { TenancyContext } from './tenancy.service'
import { memoryCache } from '../utils/pagination'
import { logBusinessEvent } from './event-log.service'

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

    await memoryCache.set(cacheKey, data, 300) // 5 minutes
    return data
  }

  async createEmployee(ctx: TenancyContext, data: CreateEmployee) {
    const { workspaceId, userId } = ctx
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
        status: 'draft',
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

    await this.invalidatePayrollCache(workspaceId)
    return payroll
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

    const { data: leave, error } = await supabase
      .from('leaves')
      .insert({
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
      })
      .select(LEAVE_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create leave', error)

    await this.invalidateLeaveCache(workspaceId, data.employeeId)
    return leave
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
