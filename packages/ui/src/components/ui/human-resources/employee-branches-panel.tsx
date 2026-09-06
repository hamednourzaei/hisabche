'use client'

// ============================================
// packages/ui/src/components/ui/human-resources/employee-branches-panel.tsx
//
// H5 — which branch(es) this person actually works at.
//
// `employee_branch_assignments` was created in Phase D and G2's employee form
// WRITES to it. Nothing ever read it back: the profile showed a department and
// no branch, so an assignment made in the form was invisible the moment the
// form closed.
//
// ⚠️ The employees table has never had a `branch_id` column — the audit
// document claimed it did. The assignment is a row, and a person can hold more
// than one, exactly one of which is primary.
// ============================================

import { Building2 } from 'lucide-react'

import { cn } from '../../../lib/utils'

export interface EmployeeBranch {
  branchId: string
  branchName: string | null
  branchCode: string | null
  isPrimary: boolean
  startedAt: string | null
}

export interface EmployeeBranchesPanelProps {
  t: (key: string, fallback: string) => string
  branches: EmployeeBranch[]
  onOpenBranch?: ((branchId: string) => void) | undefined
  className?: string | undefined
}

export function EmployeeBranchesPanel({
  t,
  branches,
  onOpenBranch,
  className,
}: EmployeeBranchesPanelProps) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4',
        className,
      )}
    >
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
        <Building2 className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
        {t('employee.branches', 'شعبه‌های این کارمند')}
      </h2>

      {branches.length === 0 ? (
        // «ثبت نشده», not «ندارد». An unassigned employee and a database that
        // has not run phase-d look identical from here, and claiming the first
        // would be a guess (§12).
        <p className="text-sm text-[hsl(var(--fg-tertiary))]">
          {t('employee.noBranches', 'شعبه‌ای برای این کارمند ثبت نشده است.')}
        </p>
      ) : (
        <ul className="space-y-2">
          {branches.map((branch) => (
            <li
              key={branch.branchId}
              className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border-default))] px-3 py-2"
            >
              <button
                type="button"
                onClick={() => onOpenBranch?.(branch.branchId)}
                disabled={!onOpenBranch}
                className={cn(
                  'min-w-0 text-start text-sm',
                  onOpenBranch
                    ? 'rounded text-[hsl(var(--color-primary))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]'
                    : 'text-[hsl(var(--fg-primary))]',
                )}
              >
                <span className="block truncate">
                  {branch.branchName ?? t('employee.unknownBranch', 'شعبه‌ی نامشخص')}
                </span>
                {branch.branchCode ? (
                  <span className="block truncate font-mono text-xs text-[hsl(var(--fg-tertiary))]">
                    {branch.branchCode}
                  </span>
                ) : null}
              </button>

              {/* «اصلی» is a real constraint, not a label: the database has a
                  partial unique index allowing exactly one primary posting per
                  employee, so this badge can never appear twice. */}
              {branch.isPrimary ? (
                <span className="shrink-0 rounded-full border border-[hsl(var(--color-primary)/0.2)] bg-[hsl(var(--color-primary)/0.12)] px-2 py-0.5 text-xs font-semibold text-[hsl(var(--color-primary))]">
                  {t('employee.primaryBranch', 'اصلی')}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
