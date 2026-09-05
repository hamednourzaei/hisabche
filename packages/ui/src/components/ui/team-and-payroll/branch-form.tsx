'use client'

// ============================================
// packages/ui/src/components/ui/team-and-payroll/branch-form.tsx
//
// G2 — «افزودن شعبه»: name, code, optional parent, optional manager.
//
// A CONTROLLED form. The employee form beside it was not — every input was
// uncontrolled with no value or onChange, and Save submitted `{}` — so nothing
// anyone typed was ever read. That is the failure this file is written not to
// repeat: every field here is bound to state and every field is submitted.
// ============================================

import { memo, useCallback, useState } from 'react'

interface BranchOption {
  id: string
  code: string
  name: string
}

interface EmployeeOption {
  id: string
  firstName: string
  lastName: string
}

export interface BranchFormValues {
  code: string
  name: string
  parentBranchId?: string | undefined
  managerEmployeeId?: string | null | undefined
}

interface BranchFormProps {
  t: (key: string, fallback?: string) => string
  branches: BranchOption[]
  employees: EmployeeOption[]
  isSubmitting?: boolean
  error?: string | null
  onSubmit: (values: BranchFormValues) => void | Promise<void>
  onCancel: () => void
}

const FIELD =
  'rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]'

export const BranchForm = memo(function BranchForm({
  t,
  branches,
  employees,
  isSubmitting = false,
  error,
  onSubmit,
  onCancel,
}: BranchFormProps) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [parentBranchId, setParentBranchId] = useState('')
  const [managerEmployeeId, setManagerEmployeeId] = useState('')

  // Name and code are the only required fields — a branch with no parent is a
  // top-level branch, and a branch with no manager is one nobody has been named
  // for yet. Both are normal.
  const canSubmit = name.trim().length > 0 && code.trim().length > 0 && !isSubmitting

  const submit = useCallback(() => {
    if (!canSubmit) return
    onSubmit({
      name: name.trim(),
      code: code.trim(),
      // '' means "not chosen"; it must not reach the server as an empty uuid.
      parentBranchId: parentBranchId || undefined,
      managerEmployeeId: managerEmployeeId || null,
    })
  }, [canSubmit, name, code, parentBranchId, managerEmployeeId, onSubmit])

  return (
    <div className="space-y-4 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6">
      <h2 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
        {t('branch.addTitle', 'افزودن شعبه')}
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-[hsl(var(--fg-secondary))]">
            {t('branch.name', 'نام شعبه')}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('branch.namePlaceholder', 'مثلاً شعبه مرکزی')}
            className={FIELD}
            disabled={isSubmitting}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-[hsl(var(--fg-secondary))]">
            {t('branch.code', 'کد شعبه')}
          </span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('branch.codePlaceholder', 'مثلاً MAIN')}
            className={FIELD}
            disabled={isSubmitting}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-[hsl(var(--fg-secondary))]">
            {t('branch.parent', 'شعبه والد (اختیاری)')}
          </span>
          <select
            value={parentBranchId}
            onChange={(e) => setParentBranchId(e.target.value)}
            className={FIELD}
            disabled={isSubmitting}
          >
            <option value="">{t('branch.noParent', 'بدون والد — شعبه اصلی')}</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-[hsl(var(--fg-secondary))]">
            {t('branch.manager', 'مدیر شعبه (اختیاری)')}
          </span>
          <select
            value={managerEmployeeId}
            onChange={(e) => setManagerEmployeeId(e.target.value)}
            className={FIELD}
            disabled={isSubmitting}
          >
            <option value="">{t('branch.noManager', 'هنوز مشخص نشده')}</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.firstName} {employee.lastName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="text-sm text-[hsl(var(--color-destructive))]" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-full border border-[hsl(var(--border-default))] px-6 py-2.5 text-sm font-medium transition-colors hover:bg-[hsl(var(--surface-muted))]"
        >
          {t('action.cancel', 'لغو')}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="rounded-full bg-[hsl(var(--color-primary))] px-6 py-2.5 text-sm font-bold text-[hsl(var(--color-primary-fg))] transition-all hover:brightness-110 disabled:opacity-50"
        >
          {isSubmitting ? '...' : t('action.save', 'ذخیره')}
        </button>
      </div>
    </div>
  )
})
