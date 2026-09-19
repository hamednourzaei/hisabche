'use client'

import { KpiCard } from '../kpi-card'
import { SUPPORTED_CURRENCIES } from '@hisabche/store'
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
import { EmployeeListTable, type EmployeeRow } from './employee-list-table'
import { PayrollListTable, type PayrollRow } from './payroll-list-table'
import { useDateFormat } from '../../../hooks/use-date-format'
import { JalaliDatePicker } from '../jalali-datepicker'

/* ═══════════════════════════════════════════════════════════════════════════
   TeamAndPayrollView v1 — Complete Team & Payroll Module
   ✅ memo · useCallback · useMemo · Persian/English localization
   ═══════════════════════════════════════════════════════════════════════════ */

// ✅ export types برای Container
export type EmployeeStatus = 'active' | 'inactive' | 'terminated' | 'on_leave'
export type PayrollStatus = 'paid' | 'pending' | 'processing' | 'overdue'

/**
 * ⚠️ snake_case, because that is what `GET /api/employees` sends: the database
 * row, untouched. This interface used to declare camelCase, so `firstName` was
 * always `undefined` — every employee card showed a blank name and the branch
 * form's «مدیر شعبه» dropdown offered «undefined undefined» (request #98-ز).
 * A type annotation is not a runtime check (راهنمای سشن، §۷٫۲).
 */
export type Employee = EmployeeRow

/**
 * ⚠️ snake_case — the row `GET /api/payrolls` actually sends, with the employee
 * embedded. This declared `employeeName` / `period` / `amount` / `dueDate`,
 * none of which exist on the response (request #100).
 */
export type PayrollRecord = PayrollRow

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
  /**
   * field name → the server's reason for refusing it.
   *
   * Rendered under the input that carries that `name`, because a form that
   * says only «ذخیره ناموفق بود» leaves the user guessing which of eighteen
   * fields to change (request #102).
   */
  employeeFieldErrors?: Record<string, string>

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

// ─── Sub-components ────────────────────────────────────────────────────────

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
  onCreateEmployee,
  onDeleteEmployee,
  branches = [],
  branchesTab,
  employeeFormError,
  employeeFieldErrors = {},
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
    // «مدیر بتونه با هر ارزی حقوق بده» — the contract currency. AFN is the
    // default, not an assumption baked into the field.
    salaryCurrency: 'AFN',
    hireDate: '',
    // The same fields the employee detail page shows. A detail page that lists
    // «کد ملی / تاریخ تولد / جنسیت / تماس / ایمیل / آدرس / نوع قرارداد» which
    // the form could never fill was a page of permanent dashes.
    nationalId: '',
    dateOfBirth: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
    employmentType: 'full_time',
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
        salaryCurrency: 'AFN',
        hireDate: '',
        nationalId: '',
        dateOfBirth: '',
        gender: '',
        phone: '',
        email: '',
        address: '',
        employmentType: 'full_time',
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

  /**
   * Empty is fine — the email is optional and simply is not sent. What is not
   * fine is a non-empty value that is not an address: the server's
   * `z.string().email()` refuses it with a 400 and the whole form comes back
   * as one unexplained «Error».
   */
  /** The server's complaint about one field, or nothing. */
  const fieldError = (name: string) =>
    employeeFieldErrors[name] ? (
      <span className="text-xs text-[hsl(var(--color-destructive))]" role="alert">
        {employeeFieldErrors[name]}
      </span>
    ) : null

  const emailValue = form.email.trim()
  const emailLooksValid = emailValue.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)

  const canSubmitEmployee =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    form.hireDate.length > 0 &&
    // An employee belongs to a branch (request #98-و). The server refuses one
    // without it too; this keeps the user from filling a form that cannot save.
    form.branchId.trim().length > 0 &&
    // An address the server will refuse anyway. Caught here so the owner is
    // told which field is wrong instead of losing a filled-in form to a 400.
    emailLooksValid &&
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
          salaryCurrency: form.salaryCurrency,
          employmentType: form.employmentType,
          // Optional personal fields: '' is "not given" and is not sent, so the
          // server's enum/email/date validation never sees an empty string.
          ...(form.nationalId.trim() ? { nationalId: form.nationalId.trim() } : {}),
          ...(form.dateOfBirth ? { dateOfBirth: form.dateOfBirth } : {}),
          ...(form.gender ? { gender: form.gender } : {}),
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
          ...(form.email.trim() ? { email: form.email.trim() } : {}),
          ...(form.address.trim() ? { address: form.address.trim() } : {}),
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

  // «اول شعبه، بعد کارمند» — one source for the button, the submit gate and
  // the empty state, so they can never disagree.
  const hasBranch = branches.length > 0

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
        {/*
          ⚠️ «هیچ کارمندی بدون شعبه اضافه نباید بشه و باید اول نام شعبه اضافه
          بشه» (request #98-و). The gate is on the button AND on the submit
          below AND on the server's schema — a disabled button is a hint, not
          a rule.
        */}
        {statusFilter === 'employees' && (
          <button
            onClick={toggleEmployeeForm}
            disabled={!hasBranch}
            title={
              hasBranch
                ? undefined
                : t('team.branchFirstHint', 'اول یک شعبه ثبت کنید؛ هر کارمند باید شعبه داشته باشد.')
            }
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))] hover:brightness-110 transition disabled:cursor-not-allowed disabled:opacity-40"
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
        <KpiCard
          label={t('team.totalEmployees', 'جمع کارمندان')}
          value={totalEmployees}
          icon={Users}
          className="min-w-[180px] flex-1"
        />
        <KpiCard
          label={t('team.totalPayroll', 'جمع حقوق پرداختی')}
          value={`${totalPayroll.toLocaleString('fa-AF')} AFN`}
          icon={Wallet}
          className="min-w-[180px] flex-1"
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
                name="firstName"
                className={FORM_FIELD}
                disabled={isSubmitting}
              />
              {fieldError('firstName')}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('team.lastName', 'تخلص')}
              </span>
              <input
                value={form.lastName}
                onChange={(e) => setField('lastName')(e.target.value)}
                name="lastName"
                className={FORM_FIELD}
                disabled={isSubmitting}
              />
              {fieldError('lastName')}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('team.employeeCode', 'کد پرسنلی')}
              </span>
              <input
                value={form.employeeCode}
                onChange={(e) => setField('employeeCode')(e.target.value)}
                name="employeeCode"
                placeholder={t('team.employeeCodeAuto', 'خالی بگذارید تا خودکار ساخته شود')}
                className={FORM_FIELD}
                disabled={isSubmitting}
              />
              {fieldError('employeeCode')}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('team.position', 'موقعیت')}
              </span>
              <input
                value={form.position}
                onChange={(e) => setField('position')(e.target.value)}
                name="position"
                className={FORM_FIELD}
                disabled={isSubmitting}
              />
              {fieldError('position')}
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
                data-field="branchId"
                options={[
                  // No «بدون شعبه»: an employee belongs to a branch, and the
                  // form cannot be submitted without one.
                  { value: '', label: t('team.chooseBranch', 'انتخاب شعبه') },
                  ...branches.map((branch) => ({
                    value: branch.id,
                    label: `${branch.name} (${branch.code})`,
                  })),
                ]}
                className={FORM_FIELD}
                disabled={isSubmitting}
              />
              {fieldError('branchId')}
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
                data-field="permissionProfileId"
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
              {fieldError('permissionProfileId')}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('hr.nationalId', 'کد ملی')}
              </span>
              <input
                value={form.nationalId}
                onChange={(e) => setField('nationalId')(e.target.value)}
                name="nationalId"
                className={FORM_FIELD}
                dir="ltr"
                disabled={isSubmitting}
              />
              {fieldError('nationalId')}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('hr.dateOfBirth', 'تاریخ تولد')}
              </span>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setField('dateOfBirth')(e.target.value)}
                name="dateOfBirth"
                className={FORM_FIELD}
                disabled={isSubmitting}
              />
              {fieldError('dateOfBirth')}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('hr.gender', 'جنسیت')}
              </span>
              <SelectField
                value={form.gender}
                onChange={(value) => setField('gender')(value)}
                data-field="gender"
                options={[
                  { value: '', label: t('team.notSpecified', 'مشخص نشده') },
                  { value: 'male', label: t('hr.gender_male', 'مرد') },
                  { value: 'female', label: t('hr.gender_female', 'زن') },
                  { value: 'other', label: t('hr.gender_other', 'دیگر') },
                ]}
                disabled={isSubmitting}
              />
              {fieldError('gender')}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('hr.phone', 'شماره تماس')}
              </span>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setField('phone')(e.target.value)}
                name="phone"
                className={FORM_FIELD}
                dir="ltr"
                disabled={isSubmitting}
              />
              {fieldError('phone')}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('hr.email', 'ایمیل')}
              </span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField('email')(e.target.value)}
                name="email"
                className={FORM_FIELD}
                dir="ltr"
                aria-invalid={!emailLooksValid}
                disabled={isSubmitting}
              />
              {/* The message sits ON the field that is wrong — a disabled
                  Save button with no reason beside it is the same dead end as
                  the 400 was. */}
              {!emailLooksValid && (
                <span className="text-xs text-[hsl(var(--color-destructive))]" role="alert">
                  {t('hr.emailInvalid', 'ایمیل معتبر نیست — باید شامل @ و دامنه باشد.')}
                </span>
              )}
              {fieldError('email')}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('hr.employmentType', 'نوع قرارداد')}
              </span>
              <SelectField
                value={form.employmentType}
                onChange={(value) => setField('employmentType')(value)}
                data-field="employmentType"
                options={(
                  ['full_time', 'part_time', 'contractor', 'intern', 'consultant'] as const
                ).map((type) => ({ value: type, label: t(`hr.employment_${type}`, type) }))}
                disabled={isSubmitting}
              />
              {fieldError('employmentType')}
            </label>

            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('hr.address', 'آدرس')}
              </span>
              <input
                value={form.address}
                onChange={(e) => setField('address')(e.target.value)}
                name="address"
                className={FORM_FIELD}
                disabled={isSubmitting}
              />
              {fieldError('address')}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('team.salary', 'حقوق')}
              </span>
              <input
                type="number"
                value={form.salary}
                onChange={(e) => setField('salary')(e.target.value)}
                name="salary"
                className={FORM_FIELD}
                disabled={isSubmitting}
              />
              {fieldError('salary')}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('team.salaryCurrency', 'ارز حقوق')}
              </span>
              <SelectField
                value={form.salaryCurrency}
                onChange={(value) => setField('salaryCurrency')(value)}
                data-field="salaryCurrency"
                options={SUPPORTED_CURRENCIES.map((code) => ({ value: code, label: code }))}
                className={FORM_FIELD}
                disabled={isSubmitting}
              />
              {fieldError('salaryCurrency')}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('team.hireDate', 'تاریخ استخدام')}
              </span>
              <input
                type="date"
                value={form.hireDate}
                onChange={(e) => setField('hireDate')(e.target.value)}
                name="hireDate"
                className={FORM_FIELD}
                disabled={isSubmitting}
              />
              {fieldError('hireDate')}
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
                <EmployeeListTable
                  t={t}
                  employees={filteredEmployees}
                  onView={onViewEmployee ?? undefined}
                  onDelete={onDeleteEmployee ?? undefined}
                  onAdd={toggleEmployeeForm}
                  canAdd={hasBranch}
                />
              ) : (
                <PayrollListTable
                  t={t}
                  payrolls={filteredPayroll}
                  onView={onViewEmployee ?? undefined}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
})

TeamAndPayrollView.displayName = 'TeamAndPayrollView'
