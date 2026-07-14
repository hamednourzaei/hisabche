// ============================================
// backend/src/services/human-resources.service.ts — Optimized v2.0
// ============================================

import { supabase } from '../db'
import {
  CreateDepartment, UpdateDepartment,
  CreateEmployee, UpdateEmployee,
  CreateAttendance, UpdateAttendance,
  CreatePayroll, UpdatePayroll,
  CreateLeave, UpdateLeave,
} from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'

// ✅ Column Selection Constants
const DEPARTMENT_COLUMNS = 'id, name, name_en, parent_id, manager_id, description, is_active, created_at'
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
const PAYROLL_COLUMNS = `
  id, employee_id, period_start, period_end, base_salary, bonuses, deductions,
  overtime_hours, overtime_rate, overtime_amount, tax_amount, net_salary,
  currency, status, payment_date, notes, created_at
`
const LEAVE_COLUMNS = `
  id, employee_id, leave_type, start_date, end_date, total_days,
  reason, status, approved_by, approved_at, notes, created_at
`

export class HumanResourcesService {
  // ─── Departments ─────────────────────────────────────────
  async listDepartments(userId: string) {
    const { data, error } = await supabase
      .from('departments')
      .select(DEPARTMENT_COLUMNS)
      .eq('user_id', userId)
      .order('name')

    if (error) throw new DatabaseError('Failed to fetch departments', error)
    return data || []
  }

  async createDepartment(userId: string, data: CreateDepartment) {
    const { data: dept, error } = await supabase
      .from('departments')
      .insert({
        name: data.name, name_en: data.nameEn || null,
        parent_id: data.parentId || null, manager_id: data.managerId || null,
        description: data.description || null, is_active: data.isActive, user_id: userId,
      })
      .select(DEPARTMENT_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create department', error)
    return dept
  }

  async updateDepartment(userId: string, id: string, data: UpdateDepartment) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.name !== undefined) updates.name = data.name
    if (data.nameEn !== undefined) updates.name_en = data.nameEn
    if (data.parentId !== undefined) updates.parent_id = data.parentId
    if (data.managerId !== undefined) updates.manager_id = data.managerId
    if (data.description !== undefined) updates.description = data.description
    if (data.isActive !== undefined) updates.is_active = data.isActive

    const { data: dept, error } = await supabase
      .from('departments')
      .update(updates).eq('id', id).eq('user_id', userId)
      .select(DEPARTMENT_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update department', error)
    return dept
  }

  // ─── Employees ───────────────────────────────────────────
  async listEmployees(userId: string, departmentId?: string) {
    let query = supabase
      .from('employees')
      .select(`${EMPLOYEE_LIST_COLUMNS}, department:departments(name)`)
      .eq('user_id', userId)

    if (departmentId) query = query.eq('department_id', departmentId)

    const { data, error } = await query.order('first_name')
    if (error) throw new DatabaseError('Failed to fetch employees', error)
    return data || []
  }

  async getEmployee(id: string, userId: string) {
    const { data, error } = await supabase
      .from('employees')
      .select(`${EMPLOYEE_DETAIL_COLUMNS}, department:departments(${DEPARTMENT_COLUMNS})`)
      .eq('id', id).eq('user_id', userId)
      .single()

    if (error || !data) throw new DatabaseError('Employee not found', error)
    return data
  }

  async createEmployee(userId: string, data: CreateEmployee) {
    const { data: emp, error } = await supabase
      .from('employees')
      .insert({
        employee_code: data.employeeCode, first_name: data.firstName, last_name: data.lastName,
        father_name: data.fatherName || null, national_id: data.nationalId || null,
        passport_number: data.passportNumber || null, date_of_birth: data.dateOfBirth || null,
        gender: data.gender || null, marital_status: data.maritalStatus || null,
        email: data.email || null, phone: data.phone || null,
        emergency_contact: data.emergencyContact || null,
        address: data.address || null, city: data.city || null, province: data.province || null,
        department_id: data.departmentId || null, position: data.position || null,
        employment_type: data.employmentType, hire_date: data.hireDate,
        salary: data.salary, salary_currency: data.salaryCurrency,
        bank_account: data.bankAccount || null, bank_name: data.bankName || null,
        notes: data.notes || null, user_id: userId,
      })
      .select(EMPLOYEE_LIST_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create employee', error)
    return emp
  }

  async updateEmployee(userId: string, id: string, data: UpdateEmployee) {
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
      .from('employees').update(updates).eq('id', id).eq('user_id', userId)
      .select(EMPLOYEE_LIST_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update employee', error)
    return emp
  }

  // ─── Attendance ──────────────────────────────────────────
  async listAttendance(userId: string, employeeId: string, month?: string) {
    let query = supabase
      .from('attendance')
      .select(ATTENDANCE_COLUMNS)
      .eq('user_id', userId).eq('employee_id', employeeId)

    if (month) {
      query = query.gte('date', `${month}-01`).lte('date', `${month}-31`)
    }

    const { data, error } = await query.order('date', { ascending: false })
    if (error) throw new DatabaseError('Failed to fetch attendance', error)
    return data || []
  }

  async createAttendance(userId: string, data: CreateAttendance) {
    const { data: att, error } = await supabase
      .from('attendance')
      .insert({
        employee_id: data.employeeId, date: data.date,
        check_in: data.checkIn || null, check_out: data.checkOut || null,
        status: data.status, notes: data.notes || null, user_id: userId,
      })
      .select(ATTENDANCE_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to record attendance', error)
    return att
  }

  async updateAttendance(userId: string, id: string, data: UpdateAttendance) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.checkIn !== undefined) updates.check_in = data.checkIn
    if (data.checkOut !== undefined) updates.check_out = data.checkOut
    if (data.status !== undefined) updates.status = data.status
    if (data.notes !== undefined) updates.notes = data.notes

    const { data: att, error } = await supabase
      .from('attendance').update(updates).eq('id', id).eq('user_id', userId)
      .select(ATTENDANCE_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update attendance', error)
    return att
  }

  // ─── Payroll ─────────────────────────────────────────────
  async listPayrolls(userId: string, employeeId?: string) {
    let query = supabase
      .from('payrolls')
      .select(`${PAYROLL_COLUMNS}, employee:employees(first_name, last_name)`)
      .eq('user_id', userId)

    if (employeeId) query = query.eq('employee_id', employeeId)

    const { data, error } = await query.order('period_start', { ascending: false })
    if (error) throw new DatabaseError('Failed to fetch payrolls', error)
    return data || []
  }

  async createPayroll(userId: string, data: CreatePayroll) {
    const overtimeAmount = data.overtimeHours * data.overtimeRate
    const netSalary = data.baseSalary + data.bonuses + overtimeAmount - data.deductions - data.taxAmount

    const { data: payroll, error } = await supabase
      .from('payrolls')
      .insert({
        employee_id: data.employeeId, period_start: data.periodStart, period_end: data.periodEnd,
        base_salary: data.baseSalary, bonuses: data.bonuses, deductions: data.deductions,
        overtime_hours: data.overtimeHours, overtime_rate: data.overtimeRate,
        overtime_amount: overtimeAmount, tax_amount: data.taxAmount,
        net_salary: netSalary, currency: data.currency, status: 'draft',
        notes: data.notes || null, user_id: userId,
      })
      .select(PAYROLL_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create payroll', error)
    return payroll
  }

  async updatePayrollStatus(userId: string, id: string, data: UpdatePayroll) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.status !== undefined) updates.status = data.status
    if (data.paymentDate !== undefined) updates.payment_date = data.paymentDate

    const { data: payroll, error } = await supabase
      .from('payrolls').update(updates).eq('id', id).eq('user_id', userId)
      .select(PAYROLL_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update payroll', error)
    return payroll
  }

  // ─── Leaves ──────────────────────────────────────────────
  async listLeaves(userId: string, employeeId?: string) {
    let query = supabase
      .from('leaves')
      .select(`${LEAVE_COLUMNS}, employee:employees(first_name, last_name)`)
      .eq('user_id', userId)

    if (employeeId) query = query.eq('employee_id', employeeId)

    const { data, error } = await query.order('start_date', { ascending: false })
    if (error) throw new DatabaseError('Failed to fetch leaves', error)
    return data || []
  }

  async createLeave(userId: string, data: CreateLeave) {
    const start = new Date(data.startDate)
    const end = new Date(data.endDate)
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

    const { data: leave, error } = await supabase
      .from('leaves')
      .insert({
        employee_id: data.employeeId, leave_type: data.leaveType,
        start_date: data.startDate, end_date: data.endDate, total_days: totalDays,
        reason: data.reason || null, status: 'pending', notes: data.notes || null, user_id: userId,
      })
      .select(LEAVE_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create leave', error)
    return leave
  }

  async updateLeaveStatus(userId: string, id: string, data: UpdateLeave) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.status !== undefined) {
      updates.status = data.status
      if (data.status === 'approved') {
        updates.approved_by = userId
        updates.approved_at = new Date().toISOString()
      }
    }

    const { data: leave, error } = await supabase
      .from('leaves').update(updates).eq('id', id).eq('user_id', userId)
      .select(LEAVE_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update leave', error)
    return leave
  }
}