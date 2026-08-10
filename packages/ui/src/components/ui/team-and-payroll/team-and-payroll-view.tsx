'use client'

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
import { format } from 'date-fns'
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

interface TeamAndPayrollViewProps {
  t: (key: string, fallback?: string) => string
  employees: Employee[]
  payrollRecords: PayrollRecord[]
  totalEmployees: number
  totalPayroll: number
  isLoadingEmployees: boolean
  isLoadingPayroll: boolean
  statusFilter?: 'employees' | 'payroll'
  onStatusChange?: (status: 'employees' | 'payroll') => void
  onViewEmployee?: (id: string) => void
  onViewPayroll?: (id: string) => void
  onCreateEmployee?: (values: Record<string, unknown>) => Promise<void>
  onDeleteEmployee?: (id: string) => Promise<void>
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
            {format(new Date(employee.hireDate), 'MMM dd, yyyy')}
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
            سررسید: {format(new Date(payroll.dueDate), 'MMM dd, yyyy')}
          </span>
        </div>
        {payroll.paidDate && (
          <div className="text-xs text-[hsl(var(--color-success))] flex items-center gap-1">
            <Wallet className="size-3" />
            پرداخته در: {format(new Date(payroll.paidDate), 'MMM dd, yyyy')}
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
}: TeamAndPayrollViewProps) {
  const [showEmployeeForm, setShowEmployeeForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const toggleEmployeeForm = useCallback(() => {
    setShowEmployeeForm((prev) => !prev)
  }, [])

  const handleSubmitEmployee = useCallback(
    async (values: Record<string, unknown>) => {
      setIsSubmitting(true)
      try {
        await onCreateEmployee?.(values)
        setShowEmployeeForm(false)
      } finally {
        setIsSubmitting(false)
      }
    },
    [onCreateEmployee],
  )

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
        <button
          onClick={toggleEmployeeForm}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))] hover:brightness-110 transition"
        >
          <Plus className="size-4" />
          {t('team.addEmployee', 'کارمند جدید')}
        </button>
      </div>

      {/* Status Filter */}
      {onStatusChange && (
        <div className="flex gap-2">
          <button
            onClick={() => onStatusChange('employees')}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              statusFilter === 'employees'
                ? 'bg-[hsl(var(--color-primary))] text-white'
                : 'border border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted))]',
            )}
          >
            {t('team.employees', 'کارمندان')}
          </button>
          <button
            onClick={() => onStatusChange('payroll')}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              statusFilter === 'payroll'
                ? 'bg-[hsl(var(--color-primary))] text-white'
                : 'border border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted))]',
            )}
          >
            {t('team.payroll', 'حقوق')}
          </button>
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
      {showEmployeeForm && (
        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
            {t('team.addNewEmployee', 'افزودن کارمند جدید')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              placeholder={t('team.firstName', 'نام')}
              className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
              disabled={isSubmitting}
            />
            <input
              placeholder={t('team.lastName', 'تخلص')}
              className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
              disabled={isSubmitting}
            />
            <input
              placeholder={t('team.position', 'موقعیت')}
              className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
              disabled={isSubmitting}
            />
            <select
              className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
              disabled={isSubmitting}
            >
              <option value="">انتخاب دپارتمنت</option>
              <option value="IT">IT</option>
              <option value="HR">Human Resources</option>
              <option value="Finance">Finance</option>
              <option value="Sales">Sales</option>
            </select>
            <input
              type="number"
              placeholder={t('team.salary', 'حقوق')}
              className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
              disabled={isSubmitting}
            />
            <input
              type="date"
              placeholder={t('team.hireDate', 'تاریخ استخدام')}
              className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
              disabled={isSubmitting}
            />
          </div>
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
              onClick={() => handleSubmitEmployee({})}
              className="rounded-full bg-[hsl(var(--color-primary))] text-white px-6 py-2.5 text-sm font-bold disabled:opacity-50 hover:brightness-110 transition-all"
              disabled={isSubmitting}
            >
              {isSubmitting ? '...' : t('action.save', 'ذخیره')}
            </button>
          </div>
        </div>
      )}

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
    </div>
  )
})

TeamAndPayrollView.displayName = 'TeamAndPayrollView'
