'use client'

// ============================================
// packages/ui/src/components/ui/budgets/containers/budgets-container.tsx
//
// Queries and mutations for the budgets page. Every figure comes from
// `useBudgetReport`; nothing is recomputed here.
// ============================================

import { memo, useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  asList,
  useAccounts,
  useApproveBudget,
  useArchiveBudget,
  useBranches,
  useBudgetReport,
  useBudgetRevisions,
  useCheckSpend,
  useReviseBudget,
  useSaveBudget,
  useSubmitBudget,
  useMyCapabilities,
  type Account,
  type BudgetCheck,
  type SaveBudgetInput,
  apiErrorMessage,
} from '@hisabche/api'

import { BudgetsView, type BudgetFilters } from '../budgets-view'

function errorMessage(err: unknown): string | null {
  // Empty input means «no error»; the shared reader always returns a string,
  // so the caller's own empty sentinel is what turns it back into null.
  return err ? apiErrorMessage(err, 'انجام نشد') : null
}

function localToday(): string {
  // The shop's calendar day, not UTC's: Kabul is UTC+4:30 and a UTC day would
  // report tomorrow's budget position after 19:30.
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const BudgetsContainer = memo(function BudgetsContainer() {
  const translate = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const value = translate(key as Parameters<typeof translate>[0])
      return value && value !== key ? value : (fallback ?? key)
    },
    [translate],
  )

  const [filters, setFilters] = useState<BudgetFilters>(() => ({
    type: 'all',
    status: 'all',
    branchId: '',
    onDate: localToday(),
  }))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [checkResult, setCheckResult] = useState<BudgetCheck | null>(null)

  const report = useBudgetReport(filters.onDate, {
    ...(filters.type !== 'all' ? { type: filters.type } : {}),
    ...(filters.status !== 'all' ? { status: filters.status } : {}),
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
  })
  // A role without budget.read never fetches the report (it would 403); the
  // page says so instead of rendering an empty body.
  const canRead = useMyCapabilities().can('budget.read')
  const accounts = useAccounts()
  const branches = useBranches()
  const revisions = useBudgetRevisions(selectedId)

  const save = useSaveBudget()
  const submit = useSubmitBudget()
  const approve = useApproveBudget()
  const archive = useArchiveBudget()
  const revise = useReviseBudget()
  const checkSpend = useCheckSpend()

  // ⚠️ DISPLAY ONLY — from the server's EFFECTIVE capabilities for this
  // workspace (roles are editable per workspace now, so a local copy of the
  // default table would show the wrong buttons). The server re-checks every
  // call and answers 403 regardless of what is shown.
  const capabilities = useMyCapabilities()
  const canManage = capabilities.can('budget.manage') === true
  const canApprove = capabilities.can('budget.approve') === true

  // A refusal the person can act on is shown in words. The server's codes
  // (BUDGET_OVERLAP, SOD_BLOCKED, ...) are translated; anything unknown is
  // shown as the server sent it rather than swallowed.
  const onError = useCallback(
    (err: unknown) => {
      const raw = errorMessage(err)
      const code = raw ? /^([A-Z][A-Z_]{5,})/.exec(raw)?.[1] : undefined
      setActionError(code ? t(`budgets.error_${code}`, raw ?? code) : raw)
    },
    [t],
  )

  const handleSave = useCallback(
    (input: SaveBudgetInput) => {
      setActionError(null)
      save.mutate(input, { onError })
    },
    [onError, save],
  )

  const handleCheckSpend = useCallback(
    (input: { accountId: string; amountMinor: number; onDate: string }) => {
      setActionError(null)
      // A stale "allowed" left on screen while a new check runs is the one
      // thing this control must never show.
      setCheckResult(null)
      checkSpend.mutate(input, { onSuccess: setCheckResult, onError })
    },
    [checkSpend, onError],
  )

  const handleRefresh = useCallback(() => {
    setActionError(null)
    setCheckResult(null)
    report.refetch()
  }, [report])

  const isBusy =
    save.isPending ||
    submit.isPending ||
    approve.isPending ||
    archive.isPending ||
    revise.isPending ||
    checkSpend.isPending

  return (
    <BudgetsView
      t={t}
      report={report.data}
      isLoading={report.isLoading}
      error={
        canRead === false
          ? t('budgets.no_access', 'دسترسی مشاهده‌ی بودجه برای نقش شما فعال نیست.')
          : report.error
            ? errorMessage(report.error)
            : null
      }
      filters={filters}
      onFiltersChange={setFilters}
      accounts={asList<Account>(accounts.data)}
      branches={asList<{ id: string; name: string }>(branches.data)}
      canManage={canManage}
      canApprove={canApprove}
      actionError={actionError}
      isBusy={isBusy}
      onRefresh={handleRefresh}
      onSave={handleSave}
      onSubmit={(id) => {
        setActionError(null)
        submit.mutate(id, { onError })
      }}
      onApprove={(id) => {
        setActionError(null)
        approve.mutate(id, { onError })
      }}
      onArchive={(id) => {
        setActionError(null)
        archive.mutate(id, { onError })
      }}
      onRevise={(input) => {
        setActionError(null)
        revise.mutate(input, { onError })
      }}
      selectedId={selectedId}
      onSelect={setSelectedId}
      revisions={revisions.data ?? []}
      isRevisionsLoading={revisions.isLoading}
      checkResult={checkResult}
      onCheckSpend={handleCheckSpend}
      newId={() => crypto.randomUUID()}
    />
  )
})

BudgetsContainer.displayName = 'BudgetsContainer'
