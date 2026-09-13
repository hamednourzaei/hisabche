// ============================================
// packages/validation/src/schemas/hr.schema.ts
// ============================================

import { z } from 'zod'
import {
  uuidSchema,
  nonEmptyStringSchema,
  optionalStringSchema,
  positiveNumberSchema,
  isoDateSchema,
  nonNegativeNumberSchema,
} from './common.schema'

/** YYYY-MM-DD, or a full ISO datetime. For fields that mean a day. */
const calendarDaySchema = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.string().datetime()])

// ============================================
// Department (دپارتمان)
// ============================================

export const departmentSchema = z.object({
  id: uuidSchema.optional(),
  name: nonEmptyStringSchema,
  nameEn: optionalStringSchema,
  parentId: uuidSchema.nullable().optional(),
  managerId: uuidSchema.nullable().optional(),
  description: optionalStringSchema,
  isActive: z.boolean().default(true),
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type Department = z.infer<typeof departmentSchema>

export const createDepartmentSchema = departmentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type CreateDepartment = z.infer<typeof createDepartmentSchema>

export const updateDepartmentSchema = departmentSchema.partial().extend({
  id: uuidSchema,
})

export type UpdateDepartment = z.infer<typeof updateDepartmentSchema>

// ============================================
// Employee (کارمند)
// ============================================

export const employeeSchema = z.object({
  id: uuidSchema.optional(),
  employeeCode: nonEmptyStringSchema,
  firstName: nonEmptyStringSchema,
  lastName: nonEmptyStringSchema,
  fatherName: optionalStringSchema,
  nationalId: optionalStringSchema,
  passportNumber: optionalStringSchema,
  dateOfBirth: calendarDaySchema.optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
  email: z.string().email().optional().nullable(),
  phone: optionalStringSchema,
  emergencyContact: optionalStringSchema,
  address: optionalStringSchema,
  city: optionalStringSchema,
  province: optionalStringSchema,
  photoUrl: z.string().url().optional().nullable(),

  // Employment
  departmentId: uuidSchema.nullable().optional(),
  position: optionalStringSchema,
  employmentType: z
    .enum(['full_time', 'part_time', 'contractor', 'intern', 'consultant'])
    .default('full_time'),
  // A calendar DAY, not an instant: the form sends YYYY-MM-DD, and requiring a
  // full datetime rejected every new employee with a 400 ("body/hireDate must
  // match format date-time"). A datetime is still accepted.
  hireDate: calendarDaySchema,
  terminationDate: calendarDaySchema.optional().nullable(),
  status: z.enum(['active', 'inactive', 'terminated', 'suspended', 'on_leave']).default('active'),

  // Compensation
  salary: nonNegativeNumberSchema.default(0),
  salaryCurrency: z.enum(['AFN', 'USD', 'PKR', 'IRR']).default('AFN'),
  bankAccount: optionalStringSchema,
  bankName: optionalStringSchema,

  /**
   * G2 — the branch this person works at.
   *
   * ⚠️ NOT a column on `employees`. It is written to
   * `employee_branch_assignments` as the primary posting, because an employee
   * has a home branch AND can be temporarily posted elsewhere, and an
   * assignment has a start date that a column would silently overwrite on
   * transfer. See docs/phase-d-01-employee-branch-assignments-migration.sql.
   *
   * Optional: an unassigned employee is "not yet assigned", and refusing to
   * create one would block hiring before the branch exists.
   */
  branchId: uuidSchema.nullable().optional(),

  // System
  userId: uuidSchema.optional().nullable(),
  notes: optionalStringSchema,
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type Employee = z.infer<typeof employeeSchema>

export const createEmployeeSchema = employeeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type CreateEmployee = z.infer<typeof createEmployeeSchema>

export const updateEmployeeSchema = employeeSchema.partial().extend({
  id: uuidSchema,
})

export type UpdateEmployee = z.infer<typeof updateEmployeeSchema>

// ============================================
// Attendance (حضور و غیاب)
// ============================================

export const attendanceSchema = z.object({
  id: uuidSchema.optional(),
  employeeId: uuidSchema,
  date: isoDateSchema,
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  status: z
    .enum(['present', 'absent', 'late', 'half_day', 'holiday', 'weekend'])
    .default('present'),
  notes: optionalStringSchema,
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type Attendance = z.infer<typeof attendanceSchema>

export const createAttendanceSchema = attendanceSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type CreateAttendance = z.infer<typeof createAttendanceSchema>

export const updateAttendanceSchema = attendanceSchema.partial().extend({
  id: uuidSchema,
})

export type UpdateAttendance = z.infer<typeof updateAttendanceSchema>

// ============================================
// Payroll (حقوق و دستمزد)
// ============================================

export const payrollSchema = z.object({
  id: uuidSchema.optional(),
  employeeId: uuidSchema,
  periodStart: isoDateSchema,
  periodEnd: isoDateSchema,
  baseSalary: nonNegativeNumberSchema,
  bonuses: nonNegativeNumberSchema.default(0),
  deductions: nonNegativeNumberSchema.default(0),
  overtimeHours: nonNegativeNumberSchema.default(0),
  overtimeRate: nonNegativeNumberSchema.default(0),
  overtimeAmount: nonNegativeNumberSchema.default(0),
  taxAmount: nonNegativeNumberSchema.default(0),
  netSalary: nonNegativeNumberSchema,
  currency: z.enum(['AFN', 'USD', 'PKR', 'IRR']).default('AFN'),
  status: z.enum(['draft', 'approved', 'paid', 'cancelled']).default('draft'),
  paymentDate: isoDateSchema.optional().nullable(),
  notes: optionalStringSchema,
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type Payroll = z.infer<typeof payrollSchema>

export const createPayrollSchema = payrollSchema.omit({
  id: true,
  netSalary: true,
  overtimeAmount: true,
  createdAt: true,
  updatedAt: true,
})

export type CreatePayroll = z.infer<typeof createPayrollSchema>

export const updatePayrollSchema = payrollSchema.partial().extend({
  id: uuidSchema,
})

export type UpdatePayroll = z.infer<typeof updatePayrollSchema>

// ============================================
// Leave (مرخصی)
// ============================================

export const leaveSchema = z.object({
  id: uuidSchema.optional(),
  employeeId: uuidSchema,
  leaveType: z.enum(['annual', 'sick', 'maternity', 'paternity', 'unpaid', 'bereavement', 'other']),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  totalDays: positiveNumberSchema,
  /**
   * Leave length in HALF-DAY steps (Patch 3 / I1).
   *
   * ⚠️ Mirrors the `leaves_duration_half_day_steps` CHECK in the database, so
   * a half-day request is refused here with a readable message rather than as
   * a 23514 from Postgres.
   *
   * Optional: omitting it means «whole days», and the service falls back to
   * the calendar-day count. `totalDays` is kept alongside for readers that
   * have not moved over — see the migration.
   */
  durationUnits: z
    .number()
    .positive()
    .refine((value) => value * 2 === Math.trunc(value * 2), {
      message: 'validation.halfDaySteps',
    })
    .optional(),
  /**
   * The branch the leave belongs to.
   *
   * ⚠️ Resolved SERVER-SIDE from the employee's assignment active on the leave
   * date — never accepted from the client, which is why it is omitted from
   * `createLeaveSchema` below. A client-supplied branch would let a request
   * name a branch the employee was never in.
   */
  branchId: uuidSchema.optional().nullable(),
  /** The auth user who asked. Set server-side, like `approvedBy`. */
  requestedBy: uuidSchema.optional().nullable(),
  reason: optionalStringSchema,
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).default('pending'),
  approvedBy: uuidSchema.optional().nullable(),
  approvedAt: isoDateSchema.optional().nullable(),
  notes: optionalStringSchema,
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type Leave = z.infer<typeof leaveSchema>

export const createLeaveSchema = leaveSchema.omit({
  id: true,
  totalDays: true,
  approvedBy: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
  // ⚠️ Both are set by the server. `branchId` comes from the employee's
  // assignment on the leave date, and `requestedBy` from the verified session
  // — accepting either from the client would let a request name a branch the
  // employee was never in, or claim to have been made by somebody else.
  branchId: true,
  requestedBy: true,
})

export type CreateLeave = z.infer<typeof createLeaveSchema>

export const updateLeaveSchema = leaveSchema.partial().extend({
  id: uuidSchema,
})

export type UpdateLeave = z.infer<typeof updateLeaveSchema>
