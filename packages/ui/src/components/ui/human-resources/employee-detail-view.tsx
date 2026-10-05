// packages/ui/src/components/ui/human-resources/employee-detail-view.tsx
'use client'

import { cn } from '../../../lib/utils'
import {
  ArrowRight,
  Save,
  User,
  Mail,
  MapPin,
  Briefcase,
  Calendar,
  Banknote,
  CreditCard,
  UserCircle,
  Hash,
  Clock,
  UserPlus,
  Edit,
  Phone,
  Plus,
  X,
  Wallet,
} from 'lucide-react'
import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { JalaliDatePicker } from '../../ui/jalali-datepicker'
import { SelectField } from '../select-field'
import { SUPPORTED_CURRENCIES } from '@hisabche/store'
import { PhoneInput } from '../../ui/phone-input'
import { MoneyInput } from '../../ui/money-input'
import { PayrollOutcome } from '../team-and-payroll/payroll-outcome'
import { useDateFormat } from '../../../hooks/use-date-format'
import { toIsoDay } from '@hisabche/formatting'

/* ═══════════════════════════════════════════════════════════════════════════
   EmployeeDetailView v2 — Memoized · Performance Optimized
   ✅ memo · useCallback · useMemo
   ═══════════════════════════════════════════════════════════════════════════ */

interface EmployeeData {
  id: string
  employee_code: string
  first_name: string
  last_name: string
  father_name?: string
  national_id?: string
  date_of_birth?: string
  gender?: string
  phone?: string
  email?: string
  address?: string
  position?: string
  department?: { id: string; name: string } | null
  hire_date: string
  salary: number
  salary_currency: string
  status: string
  employment_type: string
}

interface TimelineEvent {
  id: string
  action: string
  date: string
  title: string
  description?: string
}

interface Payroll {
  id: string
  employee_id: string
  period_start: string
  period_end: string
  net_salary: number
  status: string
  payment_date?: string | null
  currency?: string
  /** What this payment was for — written by the «توضیحات» field. */
  notes?: string | null
}

interface EmployeeDetailViewProps {
  t: (key: string, fallback?: string) => string
  employee: EmployeeData | null | undefined
  isLoading: boolean
  payrolls: Payroll[]
  isLoadingPayrolls: boolean
  onUpdate: (values: Record<string, unknown>) => Promise<void>
  onAddPayment: (values: {
    amount: number
    date: string
    notes?: string
    currency?: string
  }) => Promise<void>
  onBack: () => void
  /** H5 & H6 — branch postings and this record's audit trail. */
  extraSlot?: React.ReactNode
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateTimeline(
  emp: EmployeeData,
  t: (key: string, fallback?: string) => string,
): TimelineEvent[] {
  const hireDate = (emp.hire_date || toIsoDay(new Date())) as string
  const today = toIsoDay(new Date()) as string

  const events: TimelineEvent[] = [
    {
      id: '1',
      action: 'create',
      date: hireDate,
      title: t('hr.hired', 'استخدام شد'),
      // The message has a {position} placeholder; this `t` takes no values, so
      // it is filled here rather than shown to the user as «{position}».
      description: t('hr.hiredDesc', 'به عنوان {position} شروع به کار کرد').replace(
        '{position}',
        emp.position || t('hr.employee', 'کارمند'),
      ),
    },
  ]

  if (emp.status === 'on_leave') {
    events.unshift({
      id: '2',
      action: 'update',
      date: today,
      title: t('hr.onLeaveStatus', 'در مرخصی'),
      description: t('hr.onLeaveDesc', 'وضعیت به مرخصی تغییر کرد'),
    })
  }

  // ⚠️ REMOVED: a «حقوق ثبت شد» event dated 30 days ago was generated for every
  // employee with a salary. No payment stood behind it — it was invented, and
  // showed «{amount}» besides. Real salary payments are listed in their own
  // section from the payroll records.

  return events.sort((a, b) => b.date.localeCompare(a.date))
}

// ─── Status Badge ──────────────────────────────────────────────────────────

const statusBadgeMap: Record<string, string> = {
  active: 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]',
  inactive: 'bg-[hsl(var(--fg-tertiary)/0.12)] text-[hsl(var(--fg-tertiary))]',
  terminated: 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
  on_leave: 'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]',
}

function getStatusBadge(
  status: string | null | undefined,
  t: (key: string, fallback?: string) => string,
) {
  // A NULL status is «not recorded», not «active»: rows created before the
  // column had a default have nothing, and rendering `hr.null` or guessing
  // «فعال» are both wrong.
  const known = status && statusBadgeMap[status] ? status : null
  const cls = known ? statusBadgeMap[known] : statusBadgeMap.inactive
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', cls)}>
      {known ? t(`hr.${known}`, known) : t('hr.status_unknown', 'وضعیت ثبت نشده')}
    </span>
  )
}

// ─── Status Actions ────────────────────────────────────────────────────────

const STATUS_ACTIONS = [
  { status: 'active', labelKey: 'hr.active' },
  { status: 'on_leave', labelKey: 'hr.on_leave' },
  { status: 'inactive', labelKey: 'hr.inactive' },
  { status: 'terminated', labelKey: 'hr.terminated' },
] as const

// ─── Sub-components ────────────────────────────────────────────────────────

const TimelineIcon = memo(function TimelineIcon({ action }: { action: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    create: <UserPlus className="size-4 text-[hsl(var(--color-success))]" />,
    update: <Edit className="size-4 text-[hsl(var(--color-primary))]" />,
  }
  const icon = iconMap[action] || <Clock className="size-4 text-[hsl(var(--fg-tertiary))]" />
  const bgClass =
    action === 'create'
      ? 'border-[hsl(var(--color-success)/0.3)] bg-[hsl(var(--color-success)/0.08)]'
      : 'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]'

  return (
    <div
      className={cn(
        'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2',
        bgClass,
      )}
    >
      {icon}
    </div>
  )
})
TimelineIcon.displayName = 'TimelineIcon'

// ─── Field Component ──────────────────────────────────────────────────────

const Field = memo(function Field({
  icon: Icon,
  label,
  value,
  field,
  editable,
  type,
  form,
  setForm,
  isEditing,
  t,
}: {
  icon: any
  label: string
  value: string | number
  field?: keyof EmployeeData
  editable?: boolean
  type?: string
  form?: Partial<EmployeeData>
  setForm?: (form: Partial<EmployeeData>) => void
  isEditing?: boolean
  t?: (key: string, fallback?: string) => string
}) {
  const isEditable = isEditing && editable && field

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]">
      <Icon className="size-5 text-[hsl(var(--fg-tertiary))] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">{label}</p>
        {isEditable && field === 'date_of_birth' ? (
          <JalaliDatePicker
            value={(form?.[field] as string) || ''}
            onChange={(date) => setForm?.({ ...form, date_of_birth: date })}
            placeholder={label}
          />
        ) : isEditable && field === 'phone' ? (
          <PhoneInput
            value={form?.phone || ''}
            onChange={(val) => setForm?.({ ...form, phone: val })}
            placeholder={label}
            defaultCountry="+93"
          />
        ) : isEditable && field === 'salary' ? (
          <MoneyInput
            value={form?.salary ?? ''}
            onChange={(raw) => setForm?.({ ...form, salary: Number(raw) || 0 })}
            placeholder={label}
            className="w-full bg-transparent border-b border-[hsl(var(--border-default))] rounded-none px-0 py-1 h-auto text-sm font-medium focus:outline-none focus:ring-0 focus:border-[hsl(var(--color-primary))]"
          />
        ) : isEditable && field ? (
          <input
            type={type || 'text'}
            value={(form?.[field] as string) || ''}
            onChange={(e) =>
              setForm?.({
                ...form,
                [field]: type === 'number' ? Number(e.target.value) : e.target.value,
              })
            }
            className="w-full bg-transparent border-b border-[hsl(var(--border-default))] py-1 text-sm font-medium focus:outline-none focus:border-[hsl(var(--color-primary))]"
          />
        ) : (
          <p className="font-medium text-[hsl(var(--fg-primary))]">{value || '-'}</p>
        )}
      </div>
    </div>
  )
})
Field.displayName = 'Field'

// ─── Salary Payments Section ──────────────────────────────────────────────

const AddPaymentForm = memo(function AddPaymentForm({
  t,
  onSubmit,
  onCancel,
  defaultCurrency,
}: {
  defaultCurrency: string
  t: (key: string, fallback?: string) => string
  onSubmit: (values: {
    amount: number
    date: string
    notes?: string
    currency?: string
  }) => Promise<void>
  onCancel: () => void
}) {
  const [amount, setAmount] = useState<string>('')
  const [date, setDate] = useState<string>('')
  // «در بخش ثبت حقوق … می‌خوام بخش توضیحات هم وجود داشته باشد» — what this
  // payment was for (advance, bonus, deduction) is the thing nobody remembers
  // three months later. `payrolls.notes` already exists; nothing was writing it.
  const [notes, setNotes] = useState<string>('')
  // «شاید در ایران یکی حقوقش را با تتر یا یورو یا دلار بگیرد» — the payment
  // carries its own currency, which need not be the contract's. Defaults to
  // the employee's salary currency so the common case is one click.
  const [currency, setCurrency] = useState<string>(defaultCurrency)
  const [submitting, setSubmitting] = useState(false)

  const isValid = Number(amount) > 0 && !!date

  const handleSubmit = useCallback(async () => {
    if (!isValid) return
    setSubmitting(true)
    try {
      await onSubmit({
        amount: Number(amount),
        date,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        currency,
      })
      setAmount('')
      setDate('')
      setNotes('')
    } finally {
      setSubmitting(false)
    }
  }, [amount, date, notes, currency, isValid, onSubmit])

  return (
    <div className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MoneyInput
          value={amount}
          onChange={setAmount}
          placeholder={t('hr.paymentAmount', 'مبلغ پرداخت')}
          className="w-full"
        />
        <JalaliDatePicker
          value={date}
          onChange={setDate}
          placeholder={t('hr.paymentDate', 'تاریخ پرداخت')}
        />
        <SelectField
          value={currency}
          onChange={setCurrency}
          options={SUPPORTED_CURRENCIES.map((code) => ({ value: code, label: code }))}
          className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm"
        />
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder={t('hr.paymentNotes', 'توضیحات (اختیاری)')}
        className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="rounded-full bg-[hsl(var(--color-primary))] text-white px-5 py-2 text-sm font-bold disabled:opacity-50"
        >
          {submitting ? '...' : t('action.save', 'ذخیره')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-[hsl(var(--border-default))] px-5 py-2 text-sm"
        >
          {t('action.cancel', 'لغو')}
        </button>
      </div>
    </div>
  )
})
AddPaymentForm.displayName = 'AddPaymentForm'

// ─── Main Component ────────────────────────────────────────────────────────

export const EmployeeDetailView = memo(function EmployeeDetailView({
  t,
  employee,
  isLoading,
  payrolls,
  isLoadingPayrolls,
  onUpdate,
  onAddPayment,
  onBack,
  extraSlot,
}: EmployeeDetailViewProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<Partial<EmployeeData>>({})
  const [showAddPayment, setShowAddPayment] = useState(false)

  useEffect(() => {
    if (employee) setForm(employee)
  }, [employee])

  const handleSave = useCallback(async () => {
    await onUpdate({
      firstName: form.first_name,
      lastName: form.last_name,
      fatherName: form.father_name,
      nationalId: form.national_id,
      dateOfBirth: form.date_of_birth,
      gender: form.gender,
      phone: form.phone,
      email: form.email,
      address: form.address,
      position: form.position,
      salary: form.salary,
    })
    setIsEditing(false)
  }, [form, onUpdate])

  const handleEditToggle = useCallback(() => {
    if (isEditing) {
      handleSave()
    } else {
      setIsEditing(true)
    }
  }, [isEditing, handleSave])

  const timeline = useMemo(() => (employee ? generateTimeline(employee, t) : []), [employee, t])

  const { date: fmtDay } = useDateFormat()
  const sortedPayrolls = useMemo(
    () =>
      [...payrolls].sort((a, b) =>
        (b.payment_date || b.period_start).localeCompare(a.payment_date || a.period_start),
      ),
    [payrolls],
  )

  const handleAddPayment = useCallback(
    async (values: { amount: number; date: string }) => {
      await onAddPayment(values)
      setShowAddPayment(false)
    },
    [onAddPayment],
  )

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 p-8">
        <div className="h-8 w-48 rounded bg-[hsl(var(--surface-muted))] animate-pulse" />
        <div className="h-60 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center">
        <User className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]" />
        <p className="text-[hsl(var(--fg-secondary))]">{t('hr.notFound', 'کارمند پیدا نشد')}</p>
        <button onClick={onBack} className="mt-4 text-sm text-[hsl(var(--color-primary))]">
          {t('action.back', 'برگشت')}
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]"
        >
          <ArrowRight className="size-4" />
          {t('action.back', 'برگشت')}
        </button>
        <button
          onClick={handleEditToggle}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold',
            isEditing
              ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]'
              : 'border border-[hsl(var(--border-default))]',
          )}
        >
          {isEditing ? <Save className="size-4" /> : null}
          {isEditing ? t('action.save', 'ذخیره') : t('action.edit', 'ویرایش')}
        </button>
      </div>

      {/* Main Card */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--color-primary)/0.12)] text-xl font-bold text-[hsl(var(--color-primary))]">
            {employee.first_name?.charAt(0)}
            {employee.last_name?.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[hsl(var(--fg-primary))]">
              {employee.first_name} {employee.last_name}
            </h1>
            <p className="text-sm text-[hsl(var(--fg-secondary))]">
              {employee.father_name ? t('hr.sonOf', `فرزند ${employee.father_name}`) : ''}
            </p>
          </div>
          <div className="ms-auto">{getStatusBadge(employee.status, t)}</div>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            icon={Hash}
            label={t('hr.employeeCode', 'کد کارمند')}
            value={employee.employee_code}
            isEditing={isEditing}
            form={form}
            setForm={setForm}
            t={t}
          />
          <Field
            icon={CreditCard}
            label={t('hr.nationalId', 'تذکره')}
            value={employee.national_id || '-'}
            field="national_id"
            editable
            isEditing={isEditing}
            form={form}
            setForm={setForm}
            t={t}
          />
          <Field
            icon={Calendar}
            label={t('hr.dateOfBirth', 'تاریخ تولد')}
            value={employee.date_of_birth || '-'}
            field="date_of_birth"
            editable
            isEditing={isEditing}
            form={form}
            setForm={setForm}
            t={t}
          />
          <Field
            icon={UserCircle}
            label={t('hr.gender', 'جنسیت')}
            value={
              employee.gender === 'male'
                ? t('hr.male', 'مرد')
                : employee.gender === 'female'
                  ? t('hr.female', 'زن')
                  : '-'
            }
            isEditing={isEditing}
            form={form}
            setForm={setForm}
            t={t}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            icon={Phone}
            label={t('hr.phone', 'شماره تماس')}
            value={employee.phone || '-'}
            field="phone"
            editable
            isEditing={isEditing}
            form={form}
            setForm={setForm}
            t={t}
          />
          <Field
            icon={Mail}
            label={t('hr.email', 'ایمیل')}
            value={employee.email || '-'}
            field="email"
            editable
            isEditing={isEditing}
            form={form}
            setForm={setForm}
            t={t}
          />
          <div className="sm:col-span-2">
            <Field
              icon={MapPin}
              label={t('hr.address', 'آدرس')}
              value={employee.address || '-'}
              field="address"
              editable
              isEditing={isEditing}
              form={form}
              setForm={setForm}
              t={t}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            icon={Briefcase}
            label={t('hr.position', 'وظیفه')}
            value={employee.position || '-'}
            field="position"
            editable
            isEditing={isEditing}
            form={form}
            setForm={setForm}
            t={t}
          />
          <Field
            icon={Calendar}
            label={t('hr.hireDate', 'تاریخ استخدام')}
            value={employee.hire_date || '-'}
            isEditing={isEditing}
            form={form}
            setForm={setForm}
            t={t}
          />
          <Field
            icon={Banknote}
            label={t('hr.salary', 'معاش')}
            value={`${(employee.salary || 0).toLocaleString('fa-AF')} ${employee.salary_currency || 'AFN'}`}
            field="salary"
            editable
            type="number"
            isEditing={isEditing}
            form={form}
            setForm={setForm}
            t={t}
          />
          <Field
            icon={Briefcase}
            label={t('hr.employmentType', 'نوع قرارداد')}
            value={employee.employment_type || '-'}
            isEditing={isEditing}
            form={form}
            setForm={setForm}
            t={t}
          />
        </div>

        {/* ─── Status change ────────────────────────────────────────────
          A SELECT, not a row of pills. Four coloured buttons competing for the
          same corner read as four separate actions and took a whole line of
          the card; picking a status is one choice out of a known list, which
          is what a select is for. Same `SelectField` as the rest of the app.
        */}
        {employee.status !== 'terminated' && (
          <div className="flex items-center gap-2 pt-4 border-t border-[hsl(var(--border-default))]">
            <span className="text-xs text-[hsl(var(--fg-tertiary))] shrink-0">
              {t('hr.changeStatus', 'تغییر وضعیت:')}
            </span>
            <SelectField
              value={employee.status}
              onChange={(next) => {
                // The current status is the shown value, so choosing it again
                // is not a change and must not fire a write.
                if (next && next !== employee.status) void onUpdate({ status: next })
              }}
              options={STATUS_ACTIONS.map((action) => ({
                value: action.status,
                label: t(action.labelKey, action.status),
              }))}
              className="min-w-0 flex-1 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>

      {/* Salary Payments */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="size-5 text-[hsl(var(--color-primary))]" />
            <h2 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
              {t('hr.salaryPayments', 'پرداخت‌های حقوق')}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowAddPayment((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold bg-[hsl(var(--color-primary))] text-white"
          >
            {showAddPayment ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {t('hr.addPayment', 'ثبت پرداخت')}
          </button>
        </div>

        {showAddPayment && (
          <AddPaymentForm
            t={t}
            onSubmit={handleAddPayment}
            onCancel={() => setShowAddPayment(false)}
            defaultCurrency={employee.salary_currency || 'AFN'}
          />
        )}

        {isLoadingPayrolls ? (
          <div className="h-16 rounded-xl bg-[hsl(var(--surface-muted))] animate-pulse" />
        ) : sortedPayrolls.length === 0 ? (
          <p className="text-sm text-[hsl(var(--fg-secondary))] text-center py-4">
            {t('hr.noPayments', 'هنوز پرداختی ثبت نشده')}
          </p>
        ) : (
          <div className="space-y-2">
            {sortedPayrolls.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border-default))] p-3"
              >
                <span className="flex min-w-0 flex-col text-xs text-[hsl(var(--fg-secondary))]">
                  <span className="text-sm font-bold tabular-nums text-[hsl(var(--fg-primary))]">
                    {Number(p.net_salary).toLocaleString('fa-AF')} {p.currency || 'AFN'}
                  </span>
                  <span className="tabular-nums">{fmtDay(p.payment_date || p.period_start)}</span>
                  {p.notes && p.status !== 'cancelled' && (
                    <span className="truncate text-[hsl(var(--fg-tertiary))]">{p.notes}</span>
                  )}
                </span>
                {/* Paid or not, why not, and the two buttons that decide it. */}
                <PayrollOutcome t={t} row={p} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6">
        <div className="flex items-center gap-2 mb-5">
          <Clock className="size-5 text-[hsl(var(--color-primary))]" />
          <h2 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
            {t('hr.activityHistory', 'تاریخچه فعالیت')}
          </h2>
        </div>

        {timeline.length === 0 ? (
          <p className="text-sm text-[hsl(var(--fg-secondary))] text-center py-4">
            {t('hr.noActivity', 'بدون فعالیت')}
          </p>
        ) : (
          <div className="relative">
            <div className="absolute start-[19px] top-2 bottom-2 w-px bg-[hsl(var(--border-default))]" />
            <div className="space-y-4">
              {timeline.map((event) => (
                <div key={event.id} className="relative flex items-start gap-4">
                  <TimelineIcon action={event.action} />
                  <div className="flex-1 min-w-0 pt-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
                        {event.title}
                      </p>
                      <span className="text-[10px] text-[hsl(var(--fg-tertiary))]">
                        {event.date}
                      </span>
                    </div>
                    {event.description && (
                      <p className="text-xs text-[hsl(var(--fg-secondary))] mt-0.5">
                        {event.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* H5 & H6 — where this person works, and what has been recorded
            about this record. Owned by the container, which holds the
            queries. */}
        {extraSlot}
      </div>
    </div>
  )
})

EmployeeDetailView.displayName = 'EmployeeDetailView'
