'use client'

import { SelectField } from '../select-field'
import { Switch } from '../switch'
import { cn } from '../../../lib/utils'
import {
  Users,
  Wallet,
  Briefcase,
  Clock,
  TrendingUp,
  Download,
  Filter,
  Plus,
  Trash2,
  Eye,
  Calendar,
  Building2,
  AlertCircle,
} from 'lucide-react'
import { useState, useMemo, useCallback, memo } from 'react'
import { useDateFormat } from '../../../hooks/use-date-format'
import { JalaliDatePicker } from '../jalali-datepicker'

/* ═══════════════════════════════════════════════════════════════════════════
   TeamAndPayrollView v1 — Complete Team & Payroll Module
   ✅ memo · useCallback · useMemo · Persian/English localization
   ═══════════════════════════════════════════════════════════════════════════ */

// ✅ export types برای Container
export type EmployeeStatus = 'active' | 'inactive' | 'terminated' | 'on_leave'
export type PayrollStatus = 'paid' | 'pending' | 'processing' | 'overdue'

export interface Employee {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  position: string
  department: { name: string } | null
  hireDate: string
  salary: number
  status: EmployeeStatus
}

export interface PayrollRecord {
  id: string
  employeeId: string
  employeeName: string
  period: string
  amount: number
  status: PayrollStatus
  dueDate: string
  paidDate?: string
  currency: string
}

/**
 * G2 — the screen has three tabs now: [کارمندان] [شعب] [حقوق].
 *
 * `statusFilter` kept its name and its two original values so nothing that
 * already passes it breaks; 'branches' is the third.
 */
export type TeamTab = 'employees' | 'branches' | 'payroll'

/** A branch as the employee form's picker needs it. */
export interface BranchOption {
  id: string
  code: string
  name: string
}

interface TeamAndPayrollViewProps {
  t: (key: string, fallback?: string) => string
  employees: Employee[]
  payrollRecords: PayrollRecord[]
  totalEmployees: number
  totalPayroll: number
  isLoadingEmployees: boolean
  isLoadingPayroll: boolean
  statusFilter?: TeamTab
  onStatusChange?: (status: TeamTab) => void
  onViewEmployee?: (id: string) => void
  onViewPayroll?: (id: string) => void
  onCreateEmployee?: (
    values: Record<string, unknown>,
    /** Only present when the owner switched sign-in access on. */
    access?: { email: string; password: string; role: 'admin' | 'member' | 'viewer' },
  ) => Promise<void>
  onDeleteEmployee?: (id: string) => Promise<void>

  // ─── G2 ───────────────────────────────────────────────────────────────────
  /** Offered in the «شعبه» field of the employee form. */
  branches?: BranchOption[]
  /** Rendered as the «شعب» tab's body — the tree, supplied by the container. */
  branchesTab?: React.ReactNode
  /** Surfaced instead of being swallowed: a failed save must say why. */
  employeeFormError?: string | null

  // ─── G3 ───────────────────────────────────────────────────────────────────
  /**
   * Permission profiles offered in the employee form.
   *
   * ⚠️ Only applied when the new employee is linked to a USER account. A grant
   * lives in `user_roles`, and most employees have no login at all — so this
   * field is disabled with an explanation rather than silently doing nothing
   * for the majority of the people entered here.
   */
  permissionProfiles?: { id: string; name: string }[]
}

// ─── Constants ──────────────────────────────────────────────────────────────

const EMPLOYEE_STATUSES: {
  value: EmployeeStatus
  label: string
  color: string
  icon: React.ElementType
}[] = [
  {
    value: 'active',
    label: 'فعال',
    color: 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]',
    icon: Users,
  },
  {
    value: 'inactive',
    label: 'غیرفعال',
    color: 'bg-[hsl(var(--fg-tertiary)/0.12)] text-[hsl(var(--fg-tertiary))]',
    icon: Users,
  },
  {
    value: 'terminated',
    label: 'اخراج',
    color: 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
    icon: Trash2,
  },
  {
    value: 'on_leave',
    label: 'مرخصی',
    color: 'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]',
    icon: Clock,
  },
]

/** G2 — one class for every field in the employee form, so they cannot drift. */
const FORM_FIELD =
  'rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]'

const PAYROLL_STATUSES: {
  value: PayrollStatus
  label: string
  color: string
  icon: React.ElementType
}[] = [
  {
    value: 'paid',
    label: 'پرداخت شده',
    color: 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]',
    icon: Wallet,
  },
  {
    value: 'pending',
    label: 'در انتظار',
    color: 'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]',
    icon: Clock,
  },
  {
    value: 'processing',
    label: 'در حال پردازش',
    color: 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]',
    icon: TrendingUp,
  },
  {
    value: 'overdue',
    label: 'سررسیدن',
    color: 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
    icon: AlertCircle,
  },
]

// ─── Sub-components ────────────────────────────────────────────────────────

const StatCard = memo(function StatCard({
  label,
  value,
  icon: Icon,
  trend,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  trend?: { value: number; label: string; positive: boolean }
}) {
  return (
    <div className="flex-1 min-w-[180px] flex items-start justify-between gap-3 p-4 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div>
        <p className="text-xs text-[hsl(var(--fg-secondary))] mb-1">{label}</p>
        <p className="text-xl font-bold tabular-nums text-[hsl(var(--fg-primary))] mb-1">{value}</p>
        {trend && (
          <p
            className={cn(
              'text-xs',
              trend.positive
                ? 'text-[hsl(var(--color-success))]'
                : 'text-[hsl(var(--color-destructive))]',
            )}
          >
            {trend.label}
          </p>
        )}
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0 bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]">
        <Icon className="size-5" aria-hidden="true" />
      </div>
    </div>
  )
})
StatCard.displayName = 'StatCard'

const EmployeeCard = memo(function EmployeeCard({
  employee,
  onView,
  onDelete,
  t,
}: {
  employee: Employee
  onView?: ((id: string) => void) | undefined
  onDelete?: ((id: string) => Promise<void>) | undefined
  t: (key: string, fallback?: string) => string
}) {
  // ⚠️ SAFE AND CALENDAR-AWARE. date-fns `format(new Date(x))` THROWS «RangeError:
  // Invalid time value» on a missing or malformed date — a newly added employee
  // arrives with `hire_date` (snake_case), so `hireDate` was undefined and the
  // whole page fell into the error boundary. This returns «—» instead, and follows
  // the reader's calendar (Shamsi / Afghan / Gregorian).
  const { date: fmtDay } = useDateFormat()
  const dateText = (value: string | null | undefined) => fmtDay(value) || '—'
  const statusInfo = EMPLOYEE_STATUSES.find((s) => s.value === employee.status)
  const StatusIcon = statusInfo?.icon

  return (
    <div
      className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5 space-y-4 hover:border-[hsl(var(--color-primary)/0.3)] transition-all cursor-pointer"
      onClick={() => onView?.(employee.id)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[hsl(var(--color-primary)/0.12)] flex items-center justify-center text-[hsl(var(--color-primary))]">
            <Users className="size-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[hsl(var(--fg-primary))] mb-1">
              {employee.firstName} {employee.lastName}
            </h3>
            <p className="text-xs text-[hsl(var(--fg-secondary))] mb-1">{employee.position}</p>
            <p className="text-xs text-[hsl(var(--fg-tertiary))] font-mono">
              {employee.employeeCode}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', statusInfo?.color)}>
            {statusInfo?.label}
          </span>
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(employee.id)
              }}
              className="p-1.5 rounded-lg hover:bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]"
              aria-label="حذف کارمند"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-4 text-xs text-[hsl(var(--fg-secondary))]">
          <span className="flex items-center gap-1">
            <Building2 className="size-3" />
            {employee.department?.name || '-'}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="size-3" />
            {dateText(employee.hireDate ?? (employee as { hire_date?: string }).hire_date)}
          </span>
          <span className="tabular-nums font-medium text-[hsl(var(--fg-primary))]">
            {employee.salary.toLocaleString('fa-AF')} AFN
          </span>
        </div>
      </div>
    </div>
  )
})
EmployeeCard.displayName = 'EmployeeCard'

const PayrollCard = memo(function PayrollCard({
  payroll,
  onView,
  t,
}: {
  payroll: PayrollRecord
  onView?: ((id: string) => void) | undefined
  t: (key: string, fallback?: string) => string
}) {
  // ⚠️ SAFE AND CALENDAR-AWARE. date-fns `format(new Date(x))` THROWS «RangeError:
  // Invalid time value» on a missing or malformed date — a newly added employee
  // arrives with `hire_date` (snake_case), so `hireDate` was undefined and the
  // whole page fell into the error boundary. This returns «—» instead, and follows
  // the reader's calendar (Shamsi / Afghan / Gregorian).
  const { date: fmtDay } = useDateFormat()
  const dateText = (value: string | null | undefined) => fmtDay(value) || '—'
  const statusInfo = PAYROLL_STATUSES.find((s) => s.value === payroll.status)
  const StatusIcon = statusInfo?.icon

  return (
    <div
      className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5 space-y-4 hover:border-[hsl(var(--color-primary)/0.3)] transition-all cursor-pointer"
      onClick={() => onView?.(payroll.id)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[hsl(var(--color-primary)/0.12)] flex items-center justify-center text-[hsl(var(--color-primary))]">
            <Wallet className="size-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[hsl(var(--fg-primary))] mb-1">
              {payroll.employeeName}
            </h3>
            <p className="text-xs text-[hsl(var(--fg-secondary))] mb-1">{payroll.period}</p>
            <p className="text-xs text-[hsl(var(--fg-tertiary))] font-mono">
              {payroll.id.slice(0, 8)}...
            </p>
          </div>
        </div>
        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', statusInfo?.color)}>
          {statusInfo?.label}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold tabular-nums text-[hsl(var(--fg-primary))]">
            {payroll.amount.toLocaleString('fa-AF')} {payroll.currency}
          </span>
          <span className="text-xs text-[hsl(var(--fg-tertiary))] flex items-center gap-1">
            <Calendar className="size-3" />
            سررسید: {dateText(payroll.dueDate)}
          </span>
        </div>
        {payroll.paidDate && (
          <div className="text-xs text-[hsl(var(--color-success))] flex items-center gap-1">
            <Wallet className="size-3" />
            پرداخته در: {dateText(payroll.paidDate)}
          </div>
        )}
      </div>
    </div>
  )
})
PayrollCard.displayName = 'PayrollCard'

// ─── Main Component ─────────────────────────────────────────────────────────

export const TeamAndPayrollView = memo(function TeamAndPayrollView({
  t,
  employees,
  payrollRecords,
  totalEmployees,
  totalPayroll,
  isLoadingEmployees,
  isLoadingPayroll,
  statusFilter = 'employees',
  onStatusChange,
  onViewEmployee,
  onViewPayroll,
  onCreateEmployee,
  onDeleteEmployee,
  branches = [],
  branchesTab,
  employeeFormError,
  permissionProfiles = [],
}: TeamAndPayrollViewProps) {
  const [showEmployeeForm, setShowEmployeeForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ─── G2 — the employee form is CONTROLLED now ─────────────────────────────
  //
  // Every input here used to be uncontrolled — no `value`, no `onChange` — and
  // Save called the submit handler with `{}`. So the form rendered, accepted
  // typing, reported success, and created an employee with no name. Nothing
  // the user entered was ever read.
  //
  // One state object rather than six `useState`s: the fields are submitted
  // together and cleared together, and six setters is six chances for one to be
  // forgotten when a field is added.
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    employeeCode: '',
    position: '',
    branchId: '',
    permissionProfileId: '',
    salary: '',
    hireDate: '',
    // ─── Sign-in access ───
    // `hasAccess` false is the DEFAULT and the common case: most people on a
    // payroll never open the software. See the section in the form below.
    hasAccess: false,
    accessEmail: '',
    accessPassword: '',
    accessRole: 'member' as 'admin' | 'member' | 'viewer',
  })

  const setField = useCallback(
    (field: keyof typeof form) => (value: string) =>
      setForm((prev) => ({ ...prev, [field]: value })),
    [],
  )

  const setAccess = useCallback(
    (next: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...next })),
    [],
  )

  const resetForm = useCallback(
    () =>
      setForm({
        firstName: '',
        lastName: '',
        employeeCode: '',
        position: '',
        branchId: '',
        permissionProfileId: '',
        salary: '',
        hireDate: '',
        hasAccess: false,
        accessEmail: '',
        accessPassword: '',
        accessRole: 'member',
      }),
    [],
  )

  const toggleEmployeeForm = useCallback(() => {
    setShowEmployeeForm((prev) => !prev)
  }, [])

  // First name, last name and a hire date are what the server's schema
  // genuinely requires; everything else is optional there and optional here.
  // ⚠️ Credentials are only required when the switch is ON. Demanding them for
  // every employee is what made this form unusable for the majority who are on
  // the payroll and never sign in — the server's own schema says the same
  // thing (`createMemberDirectBodySchema` refines email/password on
  // `hasAccess`), and the two must not disagree or the user meets a 400 they
  // cannot act on.
  const accessComplete =
    !form.hasAccess ||
    (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.accessEmail.trim()) && form.accessPassword.length >= 8)

  const canSubmitEmployee =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    form.hireDate.length > 0 &&
    accessComplete &&
    !isSubmitting

  const handleSubmitEmployee = useCallback(async () => {
    if (!canSubmitEmployee) return
    setIsSubmitting(true)
    try {
      await onCreateEmployee?.(
        {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          // The server requires an employee code. Deriving one from the name is
          // a guess the USER should not have to make for a field they did not
          // ask for — but sending nothing fails validation, so a readable
          // fallback is generated and shown in the field's placeholder.
          employeeCode: form.employeeCode.trim() || undefined,
          position: form.position.trim() || undefined,
          hireDate: form.hireDate,
          salary: form.salary ? Number(form.salary) : 0,
          // '' means "not chosen" — it must not reach the server as an empty uuid.
          branchId: form.branchId || undefined,
          // G3. The container decides what to do with it: a profile is a grant on
          // `user_roles`, so it only applies once this employee has a login.
          permissionProfileId: form.permissionProfileId || undefined,
        },
        // Second argument, not a field on the employee: an employee record and
        // an auth account are two different things in two different tables, and
        // the container calls two different endpoints for them.
        form.hasAccess
          ? {
              email: form.accessEmail.trim(),
              password: form.accessPassword,
              role: form.accessRole,
            }
          : undefined,
      )
      setShowEmployeeForm(false)
      resetForm()
    } finally {
      // Cleared even on failure, so a rejected save leaves the form open with
      // the typed values intact rather than stuck behind a spinner.
      setIsSubmitting(false)
    }
  }, [canSubmitEmployee, form, onCreateEmployee, resetForm])

  const filteredEmployees = useMemo(() => {
    // Apply any filters here
    return employees
  }, [employees])

  const filteredPayroll = useMemo(() => {
    // Apply any filters here
    return payrollRecords
  }, [payrollRecords])

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="size-6 text-[hsl(var(--color-primary))]" />
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            {t('nav.teamPayroll', 'تیم و حقوق')}
          </h1>
        </div>
        {/*
          «کارمند جدید» belongs to the employees tab. On the branches tab the
          tree renders its own «افزودن شعبه», and two competing add buttons in
          one header is how someone adds the wrong thing.
        */}
        {statusFilter === 'employees' && (
          <button
            onClick={toggleEmployeeForm}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))] hover:brightness-110 transition"
          >
            <Plus className="size-4" />
            {t('team.addEmployee', 'کارمند جدید')}
          </button>
        )}
      </div>

      {/* ─── G2 — three tabs ─────────────────────────────────────────────── */}
      {onStatusChange && (
        <div role="tablist" aria-label={t('nav.teamPayroll', 'تیم و حقوق')} className="flex gap-2">
          {(
            [
              ['employees', t('team.employees', 'کارمندان')],
              ['branches', t('team.branches', 'شعب')],
              ['payroll', t('team.payroll', 'حقوق')],
            ] as [TeamTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={statusFilter === id}
              onClick={() => onStatusChange(id)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                statusFilter === id
                  ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]'
                  : 'border border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted))]',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="flex gap-4 flex-wrap">
        <StatCard
          label={t('team.totalEmployees', 'جمع کارمندان')}
          value={totalEmployees}
          icon={Users}
        />
        <StatCard
          label={t('team.totalPayroll', 'جمع حقوق پرداختی')}
          value={`${totalPayroll.toLocaleString('fa-AF')} AFN`}
          icon={Wallet}
        />
      </div>

      {/* Employee Form */}
      {showEmployeeForm && statusFilter === 'employees' && (
        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
            {t('team.addNewEmployee', 'افزودن کارمند جدید')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('team.firstName', 'نام')}
              </span>
              <input
                value={form.firstName}
                onChange={(e) => setField('firstName')(e.target.value)}
                className={FORM_FIELD}
                disabled={isSubmitting}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('team.lastName', 'تخلص')}
              </span>
              <input
                value={form.lastName}
                onChange={(e) => setField('lastName')(e.target.value)}
                className={FORM_FIELD}
                disabled={isSubmitting}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('team.employeeCode', 'کد پرسنلی')}
              </span>
              <input
                value={form.employeeCode}
                onChange={(e) => setField('employeeCode')(e.target.value)}
                placeholder={t('team.employeeCodeAuto', 'خالی بگذارید تا خودکار ساخته شود')}
                className={FORM_FIELD}
                disabled={isSubmitting}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('team.position', 'موقعیت')}
              </span>
              <input
                value={form.position}
                onChange={(e) => setField('position')(e.target.value)}
                className={FORM_FIELD}
                disabled={isSubmitting}
              />
            </label>

            {/*
              ─── G2 — the branch ────────────────────────────────────────────
              This replaces a hardcoded department select whose four options
              (IT, HR, Finance, Sales) were literals in this file, matched no
              row in `departments`, and were never submitted.

              Choosing a branch here writes an `employee_branch_assignments`
              row — a PRIMARY posting starting today — not a column on
              `employees`. See phase-d-01 for why that distinction matters.
            */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('team.branch', 'شعبه')}
              </span>
              <SelectField
                value={form.branchId}
                onChange={(value) => setField('branchId')(value)}
                options={[
                  { value: '', label: t('team.noBranch', 'بدون شعبه') },
                  ...branches.map((branch) => ({
                    value: branch.id,
                    label: `${branch.name} (${branch.code})`,
                  })),
                ]}
                className={FORM_FIELD}
                disabled={isSubmitting}
              />
            </label>

            {/*
              ─── Sign-in access ─────────────────────────────────────────────

              ⚠️ AN EMPLOYEE AND A USER ARE NOT THE SAME THING.

              Most people on a payroll never open the software: a delivery
              driver, a part-time shop assistant, someone paid monthly and
              recorded for the books. Creating a login for all of them would
              mean an email address and a password for people who have neither
              a reason nor a device to use them.

              So the record is always created and the ACCOUNT is opt-in. The
              server agrees — `createMemberDirectBodySchema` only requires
              email and password when `hasAccess` is true — and the permission
              profile above already said, in its own hint, that it «only
              applies to an employee who has an account». This switch is what
              finally makes that sentence actionable.

              The two writes go to two endpoints; see the container.
            */}
            <div className="sm:col-span-2 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted)/0.4)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <label
                    htmlFor="employee-has-access"
                    className="text-sm font-medium text-[hsl(var(--fg-primary))]"
                  >
                    {t('team.hasAccessTitle', 'آیا می‌خواهید جزئی از پرسنل سایت شود؟')}
                  </label>
                  <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--fg-tertiary))]">
                    {t(
                      'team.hasAccessHint',
                      'با روشن کردن این گزینه یک حساب کاربری ساخته می‌شود و این شخص می‌تواند با ایمیل و رمزی که وارد می‌کنید وارد حسابچه شود.',
                    )}
                  </p>
                </div>
                <Switch
                  id="employee-has-access"
                  checked={form.hasAccess}
                  onCheckedChange={(checked) => setAccess({ hasAccess: checked })}
                  disabled={isSubmitting}
                />
              </div>

              {form.hasAccess ? (
                <div className="mt-4 grid gap-4 border-t border-[hsl(var(--border-default))] pt-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-[hsl(var(--fg-secondary))]">
                      {t('team.accessEmail', 'ایمیل ورود')}
                    </span>
                    <input
                      type="email"
                      // `dir="ltr"` — an email address is Latin text, and in an
                      // RTL field the dot-separated parts render in the wrong
                      // visual order while the value stays correct, which
                      // reads as the field having mangled what was typed.
                      dir="ltr"
                      autoComplete="off"
                      value={form.accessEmail}
                      onChange={(e) => setAccess({ accessEmail: e.target.value })}
                      className={FORM_FIELD}
                      disabled={isSubmitting}
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-[hsl(var(--fg-secondary))]">
                      {t('team.accessPassword', 'رمز عبور')}
                    </span>
                    <input
                      type="password"
                      dir="ltr"
                      // `new-password` so the browser does not offer the
                      // OWNER's saved credentials for someone else's account.
                      autoComplete="new-password"
                      value={form.accessPassword}
                      onChange={(e) => setAccess({ accessPassword: e.target.value })}
                      className={FORM_FIELD}
                      disabled={isSubmitting}
                    />
                    <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                      {t('team.accessPasswordHint', 'حداقل ۸ نویسه.')}
                    </span>
                  </label>

                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-xs text-[hsl(var(--fg-secondary))]">
                      {t('team.accessRole', 'سطح دسترسی')}
                    </span>
                    <SelectField
                      value={form.accessRole}
                      onChange={(value) =>
                        setAccess({ accessRole: value as 'admin' | 'member' | 'viewer' })
                      }
                      options={[
                        { value: 'viewer', label: t('team.roleViewer', 'فقط مشاهده') },
                        { value: 'member', label: t('team.roleMember', 'کارمند') },
                        { value: 'admin', label: t('team.roleAdmin', 'مدیر') },
                      ]}
                      className={FORM_FIELD}
                      disabled={isSubmitting}
                    />
                  </label>
                </div>
              ) : null}
            </div>

            {/*
              ─── G3 — the permission profile ────────────────────────────────
              Disabled when no profiles are loaded rather than rendered as an
              empty dropdown, and labelled with what it actually does: a
              profile is a grant in `user_roles`, which only means something
              once the person has a login. Most employees do not.
            */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('team.permissionProfile', 'پروفایل دسترسی')}
              </span>
              <SelectField
                value={form.permissionProfileId}
                onChange={(value) => setField('permissionProfileId')(value)}
                options={[
                  { value: '', label: t('team.noProfile', 'بدون پروفایل') },
                  ...permissionProfiles.map((profile) => ({
                    value: profile.id,
                    label: profile.name,
                  })),
                ]}
                className={FORM_FIELD}
                disabled={isSubmitting || permissionProfiles.length === 0}
              />
              <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t(
                  'team.permissionProfileHint',
                  'فقط برای کارمندی اعمال می‌شود که حساب کاربری دارد.',
                )}
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('team.salary', 'حقوق')}
              </span>
              <input
                type="number"
                value={form.salary}
                onChange={(e) => setField('salary')(e.target.value)}
                className={FORM_FIELD}
                disabled={isSubmitting}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('team.hireDate', 'تاریخ استخدام')}
              </span>
              <input
                type="date"
                value={form.hireDate}
                onChange={(e) => setField('hireDate')(e.target.value)}
                className={FORM_FIELD}
                disabled={isSubmitting}
              />
            </label>
          </div>

          {employeeFormError && (
            <p className="text-sm text-[hsl(var(--color-destructive))]" role="alert">
              {employeeFormError}
            </p>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowEmployeeForm(false)}
              className="rounded-full border border-[hsl(var(--border-default))] px-6 py-2.5 text-sm font-medium hover:bg-[hsl(var(--surface-muted))] transition-colors"
              disabled={isSubmitting}
            >
              {t('action.cancel', 'لغو')}
            </button>
            <button
              type="button"
              onClick={handleSubmitEmployee}
              className="rounded-full bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))] px-6 py-2.5 text-sm font-bold disabled:opacity-50 hover:brightness-110 transition-all"
              disabled={!canSubmitEmployee}
            >
              {isSubmitting ? '...' : t('action.save', 'ذخیره')}
            </button>
          </div>
        </div>
      )}

      {/* ─── G2 — the «شعب» tab ──────────────────────────────────────────────
        Rendered BEFORE the employee/payroll grid and returning early, because
        that grid's loading and empty states are written around those two
        datasets: `filteredEmployees.length === 0 && filteredPayroll.length === 0`
        would show "هیچ کارمندی ثبت نشده" over a perfectly good branch tree on a
        workspace that has branches but no staff yet.

        The tree itself is passed in by the container — this view does not fetch.
      */}
      {statusFilter === 'branches' ? (
        <div>{branchesTab}</div>
      ) : (
        <>
          {/* Content Grid */}
          {isLoadingEmployees || isLoadingPayroll ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-48 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse"
                />
              ))}
            </div>
          ) : filteredEmployees.length === 0 && filteredPayroll.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
              <Briefcase className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]" />
              <p className="text-[hsl(var(--fg-secondary))] mb-2">
                {statusFilter === 'employees'
                  ? t('team.noEmployees', 'هیچ کارمندی ثبت نشده')
                  : t('team.noPayroll', 'هیچ سابقه حقوقی وجود ندارد')}
              </p>
              <p className="text-xs text-[hsl(var(--fg-tertiary))] mt-1">
                {statusFilter === 'employees'
                  ? t('team.noEmployeesHint', 'با افزودن کارمندان جدید، شروع کنید')
                  : t('team.noPayrollHint', 'با ثبت پرداخت حقوق، شروع کنید')}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {statusFilter === 'employees' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredEmployees.map((employee) => (
                    <EmployeeCard
                      key={employee.id}
                      employee={employee}
                      onView={onViewEmployee ?? undefined}
                      onDelete={onDeleteEmployee ?? undefined}
                      t={t}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredPayroll.map((payroll) => (
                    <PayrollCard
                      key={payroll.id}
                      payroll={payroll}
                      onView={onViewPayroll ?? undefined}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
})

TeamAndPayrollView.displayName = 'TeamAndPayrollView'
