// packages/ui/src/components/ui/human-resources/hr-view.tsx
'use client'

import { SelectField } from '../select-field'
import { cn } from '../../../lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select'
import {
  Plus,
  Trash2,
  Users,
  Download,
  Search,
  ArrowUpDown,
  Wallet,
  ChevronDown,
} from 'lucide-react'
import { useState, useMemo, useCallback, memo } from 'react'
import { useForm, useController } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { exportToCSV } from '../../../lib/export'
import { useSortFilter } from '../../../hooks/use-sort-filter'
import { JalaliDatePicker } from '../../ui/jalali-datepicker'
import { PhoneInput } from '../../ui/phone-input'
import { MoneyInput } from '../../ui/money-input'
import { useDateFormat } from '../../../hooks/use-date-format'

/* ═══════════════════════════════════════════════════════════════════════════
   HumanResourcesView v11 — تیم و حقوق (merged workspace + employees)
   ✅ memo · useCallback · useMemo
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Schema ─────────────────────────────────────────────────────────────────

const employeeSchema = z.object({
  firstName: z.string().min(1, 'نام الزامی است'),
  lastName: z.string().min(1, 'تخلص الزامی است'),
  fatherName: z.string().optional(),
  employeeCode: z.string().min(1, 'کد کارمند الزامی است'),
  nationalId: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('ایمیل معتبر نیست').optional().or(z.literal('')),
  address: z.string().optional(),
  position: z.string().optional(),
  hireDate: z.string().min(1, 'تاریخ استخدام الزامی است'),
  salary: z.string().optional(),
})

type EmployeeForm = z.infer<typeof employeeSchema>

interface Employee {
  id: string
  employee_code: string
  first_name: string
  last_name: string
  father_name?: string
  national_id?: string
  phone?: string
  email?: string
  department?: { name: string } | null
  position?: string
  status: string
  hire_date: string
  salary?: number
}

interface AccessGrant {
  email: string
  password: string
  role: 'admin' | 'member'
}

interface HumanResourcesViewProps {
  t: (key: string, fallback?: string) => string
  employees: Employee[]
  total: number
  page: number
  isLoading: boolean
  payrollTotal: number
  payrollByEmployee: Record<string, number>
  onPageChange: (page: number) => void
  onSearch: (query: string) => void
  onCreate: (values: Record<string, unknown>, access?: AccessGrant) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onView: (id: string) => void
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CSV_COLUMNS: { key: keyof Employee; label: string }[] = [
  { key: 'employee_code', label: 'کد' },
  { key: 'first_name', label: 'نام' },
  { key: 'last_name', label: 'تخلص' },
  { key: 'father_name', label: 'نام پدر' },
  { key: 'national_id', label: 'تذکره' },
  { key: 'phone', label: 'تلفن' },
  { key: 'email', label: 'ایمیل' },
  { key: 'position', label: 'وظیفه' },
  { key: 'status', label: 'وضعیت' },
  { key: 'hire_date', label: 'تاریخ استخدام' },
]

const SORTABLE_COLUMNS: { key: keyof Employee; label: string }[] = [
  { key: 'employee_code', label: 'کد' },
  { key: 'first_name', label: 'نام' },
  { key: 'status', label: 'وضعیت' },
  { key: 'hire_date', label: 'تاریخ استخدام' },
]

// ─── Status Badge ──────────────────────────────────────────────────────────
// وضعیت واقعی در schema: active | inactive | terminated | on_leave

function getStatusBadge(status: string, t: (key: string, fallback?: string) => string) {
  if (status === 'terminated') {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]">
        {t('hr.terminated', 'اخراج')}
      </span>
    )
  }
  if (status === 'on_leave') {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]">
        {t('hr.on_leave', 'مرخصی')}
      </span>
    )
  }
  if (status === 'inactive') {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[hsl(var(--fg-tertiary)/0.12)] text-[hsl(var(--fg-tertiary))]">
        {t('hr.inactive', 'غیرفعال')}
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]">
      {t('hr.active', 'کارمند')}
    </span>
  )
}

// ─── KPI Stat Card ─────────────────────────────────────────────────────────

const StatCard = memo(function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: React.ElementType
}) {
  return (
    <div className="flex-1 min-w-[180px] flex items-start justify-between gap-3 p-4 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
      <div>
        <p className="text-xs text-[hsl(var(--fg-secondary))]">{label}</p>
        <p className="text-xl font-bold tabular-nums text-[hsl(var(--fg-primary))] mt-1">{value}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0 bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]">
        <Icon className="size-5" aria-hidden="true" />
      </div>
    </div>
  )
})
StatCard.displayName = 'StatCard'

// ─── Sub-components ────────────────────────────────────────────────────────

const inputClass =
  'rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] transition-colors duration-150'
const errorClass =
  'border-[hsl(var(--color-destructive))] focus:border-[hsl(var(--color-destructive))]'

const FormField = memo(function FormField({
  name,
  label,
  type = 'text',
  register,
  errors,
}: {
  name: keyof EmployeeForm
  label: string
  type?: string
  register: any
  errors: Record<string, { message?: string } | undefined>
}) {
  const err = errors[name]
  return (
    <div>
      <input
        {...register(name)}
        type={type}
        placeholder={label}
        className={cn(inputClass, 'w-full', err && errorClass)}
      />
      {err && (
        <p className="text-xs text-[hsl(var(--color-destructive))] mt-1 px-1">{err.message}</p>
      )}
    </div>
  )
})
FormField.displayName = 'FormField'

// ─── Main Component ────────────────────────────────────────────────────────

export const HumanResourcesView = memo(function HumanResourcesView({
  t,
  employees,
  total,
  page,
  isLoading,
  payrollTotal,
  payrollByEmployee,
  onPageChange,
  onSearch,
  onCreate,
  onDelete,
  onView,
}: HumanResourcesViewProps) {
  // ⚠️ The calendar follows the language; these were hardcoded to `'fa-AF'`.
  const { date: fmtIntlDate, lang: dateLang } = useDateFormat()

  const [showForm, setShowForm] = useState(false)
  const [phoneValue, setPhoneValue] = useState('')
  const [grantAccess, setGrantAccess] = useState(false)
  const [accessRole, setAccessRole] = useState<'admin' | 'member'>('member')
  const [accessEmail, setAccessEmail] = useState('')
  const [accessPassword, setAccessPassword] = useState('')
  const {
    sortedData: sortedEmployees,
    sort,
    toggleSort,
    filter,
    setFilter,
  } = useSortFilter(employees)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      fatherName: '',
      employeeCode: '',
      nationalId: '',
      dateOfBirth: '',
      gender: '',
      phone: '',
      email: '',
      address: '',
      position: '',
      hireDate: '',
      salary: '',
    },
  })

  const { field: hireDateField } = useController({ name: 'hireDate', control })
  const { field: dateOfBirthField } = useController({ name: 'dateOfBirth', control })
  const { field: salaryField } = useController({ name: 'salary', control })
  // T7 — `register()` returns a native-element handler (an event), and
  // SelectField hands back the value. `useController` is the shape that fits,
  // and it is what every other non-native field in this form already uses.
  const { field: genderField } = useController({ name: 'gender', control })

  const accessInvalid = grantAccess && (!accessEmail.trim() || accessPassword.trim().length < 8)

  const resetAccessFields = useCallback(() => {
    setGrantAccess(false)
    setAccessRole('member')
    setAccessEmail('')
    setAccessPassword('')
  }, [])

  const onSubmit = useCallback(
    async (data: EmployeeForm) => {
      if (accessInvalid) return
      await onCreate(
        {
          firstName: data.firstName,
          lastName: data.lastName,
          fatherName: data.fatherName || undefined,
          employeeCode: data.employeeCode,
          nationalId: data.nationalId || undefined,
          dateOfBirth: data.dateOfBirth ? `${data.dateOfBirth}T00:00:00Z` : undefined,
          gender: data.gender || undefined,
          phone: phoneValue || undefined,
          email: data.email || undefined,
          address: data.address || undefined,
          position: data.position || undefined,
          hireDate: data.hireDate ? `${data.hireDate}T00:00:00Z` : new Date().toISOString(),
          salary: data.salary ? Number(data.salary) : 0,
          employmentType: 'full_time',
          salaryCurrency: 'AFN',
        },
        grantAccess
          ? { email: accessEmail.trim(), password: accessPassword, role: accessRole }
          : undefined,
      )
      setShowForm(false)
      setPhoneValue('')
      resetAccessFields()
      reset()
    },
    [
      onCreate,
      phoneValue,
      reset,
      grantAccess,
      accessEmail,
      accessPassword,
      accessRole,
      accessInvalid,
      resetAccessFields,
    ],
  )

  const handleExport = useCallback(() => {
    exportToCSV(sortedEmployees, CSV_COLUMNS, `employees-${new Date().toISOString().split('T')[0]}`)
  }, [sortedEmployees])

  const toggleForm = useCallback(() => {
    setShowForm((prev) => !prev)
  }, [])

  const totalPages = useMemo(() => Math.ceil(total / 20), [total])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-6 text-[hsl(var(--color-primary))]" />
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            {t('nav.team', 'تیم و حقوق')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {sortedEmployees.length > 0 && (
            <button
              type="button"
              onClick={handleExport}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium',
                'border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]',
                'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors',
              )}
            >
              <Download className="size-4" />
              <span className="hidden sm:inline">{t('action.export', 'خروجی')}</span>
            </button>
          )}
          <button
            onClick={toggleForm}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold',
              'bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]',
              'hover:brightness-110 transition',
            )}
          >
            <Plus className="size-4" />
            {t('hr.addEmployee', 'کارمند جدید')}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="flex gap-4 flex-wrap">
        <StatCard
          label={t('hr.totalPayroll', 'جمع حقوق پرداختی')}
          value={`${payrollTotal.toLocaleString('fa-AF')} AFN`}
          icon={Wallet}
        />
        <StatCard label={t('hr.totalEmployees', 'تعداد کارمندان')} value={total} icon={Users} />
      </div>

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField
              name="firstName"
              label={t('hr.firstName', 'نام *')}
              register={register}
              errors={errors}
            />
            <FormField
              name="lastName"
              label={t('hr.lastName', 'تخلص *')}
              register={register}
              errors={errors}
            />
            <FormField
              name="fatherName"
              label={t('hr.fatherName', 'نام پدر')}
              register={register}
              errors={errors}
            />
            <FormField
              name="employeeCode"
              label={t('hr.employeeCode', 'کد کارمند *')}
              register={register}
              errors={errors}
            />
            <FormField
              name="nationalId"
              label={t('hr.nationalId', 'تذکره')}
              register={register}
              errors={errors}
            />

            <div>
              <JalaliDatePicker
                value={dateOfBirthField.value || ''}
                onChange={dateOfBirthField.onChange}
                placeholder={t('hr.dateOfBirth', 'تاریخ تولد')}
              />
            </div>

            <SelectField
              value={(genderField.value as string) ?? ''}
              onChange={genderField.onChange}
              placeholder={t('hr.gender', 'جنسیت')}
              options={[
                { value: '', label: t('hr.gender', 'جنسیت') },
                { value: 'male', label: t('hr.male', 'مرد') },
                { value: 'female', label: t('hr.female', 'زن') },
              ]}
              className={cn(inputClass, 'appearance-none w-full')}
            />

            <div>
              <PhoneInput
                value={phoneValue}
                onChange={setPhoneValue}
                placeholder={t('hr.phone', 'شماره تماس')}
                defaultCountry="+93"
              />
            </div>

            <FormField
              name="email"
              type="email"
              label={t('hr.email', 'ایمیل')}
              register={register}
              errors={errors}
            />
            <FormField
              name="address"
              label={t('hr.address', 'آدرس')}
              register={register}
              errors={errors}
            />
            <FormField
              name="position"
              label={t('hr.position', 'وظیفه')}
              register={register}
              errors={errors}
            />

            <div>
              <JalaliDatePicker
                value={hireDateField.value || ''}
                onChange={hireDateField.onChange}
                placeholder={t('hr.hireDate', 'تاریخ استخدام *')}
              />
              {errors.hireDate && (
                <p className="text-xs text-[hsl(var(--color-destructive))] mt-1 px-1">
                  {errors.hireDate.message}
                </p>
              )}
            </div>

            <div>
              <MoneyInput
                value={salaryField.value ?? ''}
                onChange={salaryField.onChange}
                placeholder={t('hr.salary', 'معاش')}
                className={cn(inputClass, 'w-full h-auto', errors.salary && errorClass)}
              />
              {errors.salary && (
                <p className="text-xs text-[hsl(var(--color-destructive))] mt-1 px-1">
                  {errors.salary.message}
                </p>
              )}
            </div>
          </div>

          {/* Grant Site Access */}
          <div className="rounded-xl border border-[hsl(var(--border-default))] p-4 space-y-4">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                {t('hr.grantAccess', 'می‌خواهید به او دسترسی به سایت بدهید؟')}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={grantAccess}
                onClick={() => setGrantAccess((v) => !v)}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
                  grantAccess ? 'bg-[hsl(var(--color-primary))]' : 'bg-[hsl(var(--surface-muted))]',
                )}
              >
                <span
                  className={cn(
                    'inline-block size-4 transform rounded-full bg-white transition-transform',
                    grantAccess ? '-translate-x-6' : '-translate-x-1',
                  )}
                />
              </button>
            </label>

            {grantAccess && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <Select
                    value={accessRole}
                    onValueChange={(value) => setAccessRole(value as 'admin' | 'member')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">{t('workspace.admin', 'مدیر')}</SelectItem>
                      <SelectItem value="member">{t('workspace.employee', 'کارمند')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <ChevronDown className="absolute end-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none" />
                </div>
                <div />
                <input
                  type="email"
                  value={accessEmail}
                  onChange={(e) => setAccessEmail(e.target.value)}
                  placeholder={t('hr.accessEmail', 'ایمیل ورود *')}
                  className={cn(inputClass, 'w-full')}
                />
                <input
                  type="password"
                  value={accessPassword}
                  onChange={(e) => setAccessPassword(e.target.value)}
                  placeholder={t('hr.accessPassword', 'رمز عبور (حداقل ۸ کاراکتر) *')}
                  className={cn(inputClass, 'w-full')}
                />
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting || accessInvalid}
              className="rounded-full bg-[hsl(var(--color-primary))] text-white px-6 py-2.5 text-sm font-bold disabled:opacity-50"
            >
              {isSubmitting ? '...' : t('action.save', 'ذخیره')}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                resetAccessFields()
              }}
              className="rounded-full border border-[hsl(var(--border-default))] px-6 py-2.5 text-sm"
            >
              {t('action.cancel', 'لغو')}
            </button>
          </div>
        </form>
      )}

      {/* Search & Sort */}
      {employees.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))]" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('action.search', 'جستجو...')}
              className={cn(inputClass, 'w-full ps-9')}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {SORTABLE_COLUMNS.map((col) => (
              <button
                key={col.key as string}
                type="button"
                onClick={() => toggleSort(col.key)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                  sort.key === col.key
                    ? 'border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.08)] text-[hsl(var(--color-primary))]'
                    : 'border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]',
                )}
              >
                {col.label}
                <ArrowUpDown className="size-3" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-12 rounded-xl bg-[hsl(var(--surface-muted))] animate-pulse"
              />
            ))}
          </div>
        ) : sortedEmployees.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]" />
            <p className="text-[hsl(var(--fg-secondary))]">
              {t('hr.noEmployees', 'هیچ کارمندی ثبت نشده')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                  <th className="px-4 py-3 text-start font-medium whitespace-nowrap">
                    {t('hr.employeeCode', 'کد کارمند')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium whitespace-nowrap">
                    {t('hr.firstName', 'نام')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium whitespace-nowrap">
                    {t('hr.hireDate', 'تاریخ شروع کار')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium whitespace-nowrap">
                    {t('hr.status', 'وضعیت')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium whitespace-nowrap">
                    {t('hr.totalPayroll', 'جمع حقوق')}
                  </th>
                  <th className="px-4 py-3 text-center font-medium w-14 whitespace-nowrap">
                    {t('action.actions', '...')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    onClick={() => onView(emp.id)}
                    className="border-b border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted)/0.5)] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                      {emp.employee_code}
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {emp.first_name} {emp.last_name}
                    </td>
                    <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))] whitespace-nowrap">
                      {emp.hire_date ? fmtIntlDate(emp.hire_date) : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{getStatusBadge(emp.status, t)}</td>
                    <td className="px-4 py-3 text-xs font-medium whitespace-nowrap tabular-nums">
                      {(payrollByEmployee[emp.id] || 0).toLocaleString('fa-AF')} AFN
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(emp.id)
                          }}
                          className="p-1.5 rounded-lg hover:bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="rounded-full px-4 py-2 text-sm border border-[hsl(var(--border-default))] disabled:opacity-40"
          >
            {t('action.previous', 'قبلی')}
          </button>
          <span className="text-sm text-[hsl(var(--fg-secondary))]">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded-full px-4 py-2 text-sm border border-[hsl(var(--border-default))] disabled:opacity-40"
          >
            {t('action.next', 'بعدی')}
          </button>
        </div>
      )}
    </div>
  )
})

HumanResourcesView.displayName = 'HumanResourcesView'
