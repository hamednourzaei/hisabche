'use client'

// ============================================
// packages/ui/src/components/ui/branch/branch-scope.tsx
//
// K4 — «this report, for which branch?»
//
// ---------------------------------------------------------------------------
// THE BACKEND HAS BEEN READY THE WHOLE TIME
//
// `accounting.routes` reads `?branchId` (or the `x-branch-id` header),
// `branches.reportingScope()` narrows it to what the member is actually
// allowed to see, and `ledgerTotals(…, branchIds)` passes it to the trial
// balance RPC. Every statement could already be produced per branch.
//
// Nothing in the interface ever sent the parameter. A business with four
// branches could only ever see the four added together.
//
// ---------------------------------------------------------------------------
// ⚠️ THE SELECTION IS A REQUEST, NOT A PERMISSION
//
// Choosing a branch here NARROWS a report. It cannot widen one: a member
// restricted to one branch who selects «همه» still gets their own branch,
// because `reportingScope` intersects the request with the member's own
// assignment on the server. This control is a convenience, never a boundary —
// the boundary is `workspace_id`, and after it the member's `member_branches`.
//
// So it is safe for this to live in client state and in the URL.
// ============================================

import { SelectField } from '../select-field'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useBranches } from '@hisabche/api'

import { cn } from '../../../lib/utils'

interface BranchScopeValue {
  /** `null` means the consolidated business — every branch, added together. */
  branchId: string | null
  setBranchId: (id: string | null) => void
}

const BranchScopeContext = createContext<BranchScopeValue>({
  branchId: null,
  setBranchId: () => {},
})

/**
 * Holds the selected branch for everything rendered inside it.
 *
 * Deliberately NOT global state: a branch chosen on the accounting screen
 * should not silently re-scope the warehouse screen a user opens next. The
 * provider wraps a report surface, and the choice lives for as long as that
 * surface does.
 */
export function BranchScopeProvider({ children }: { children: ReactNode }) {
  const [branchId, setBranchId] = useState<string | null>(null)
  const value = useMemo(() => ({ branchId, setBranchId }), [branchId])
  return <BranchScopeContext.Provider value={value}>{children}</BranchScopeContext.Provider>
}

/** The branch a report should be produced for, and how to change it. */
export function useBranchScope(): BranchScopeValue {
  return useContext(BranchScopeContext)
}

export interface BranchSwitcherProps {
  t: (key: string, fallback: string) => string
  className?: string | undefined
}

/**
 * The control itself.
 *
 * Renders NOTHING when the workspace has fewer than two branches. A single-
 * branch shop — most Hisabche workspaces — gains no information from a
 * selector whose only option is «all», and a control that cannot change
 * anything is noise on every report header.
 */
export function BranchSwitcher({ t, className }: BranchSwitcherProps) {
  const { branchId, setBranchId } = useBranchScope()
  const { data: branches } = useBranches()

  const options = branches ?? []

  const onChange = useCallback(
    (value: string) => setBranchId(value === '' ? null : value),
    [setBranchId],
  )

  if (options.length < 2) return null

  return (
    <label className={cn('flex items-center gap-2 text-sm', className)}>
      <span className="text-[hsl(var(--fg-secondary))]">{t('branch.scope', 'شعبه')}</span>
      <SelectField
        value={branchId ?? ''}
        onChange={(value) => onChange(value)}
        options={[
          { value: '', label: t('branch.allBranches', 'همه‌ی شعب') },
          ...options.map((branch) => ({ value: branch.id, label: branch.name })),
        ]}
        className={
          'rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-2 py-1.5 text-sm text-[hsl(var(--fg-primary))] focus:border-[hsl(var(--color-primary)/0.5)] focus:outline-none'
        }
      />
    </label>
  )
}
