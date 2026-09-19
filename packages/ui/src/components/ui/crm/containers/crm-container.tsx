// packages/ui/src/components/ui/crm/containers/crm-container.tsx
'use client'

import { useState, useCallback, useMemo, memo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  useInteractions,
  useCreateInteraction,
  useUpdateInteractionStatus,
  useRecordCustomerOutcome,
  useSubjectSuggestions,
  useEmployees,
} from '@hisabche/api'
import type { TaskStatus } from '@hisabche/api'
import { CrmView, type CrmTabId, type EmployeeOption } from '../crm-view'

/* ═══════════════════════════════════════════════════════════════════════════
   CrmContainer — Memoized · Performance Optimized
   ✅ memo · useCallback · safeT wrapper
   ═══════════════════════════════════════════════════════════════════════════ */

// نگاشت locale بلند (fa-AF/fa-IR/en) به پیشوند واقعی مسیر (af/fa/en) —
// همان نگاشت استفاده‌شده در invoice-document.tsx برای لینک عمومی فاکتور.
function urlLangFromLocale(locale: string): string {
  if (locale.startsWith('fa-AF')) return 'af'
  if (locale.startsWith('fa')) return 'fa'
  return 'en'
}

export const CrmContainer = memo(function CrmContainer() {
  const tOriginal = useTranslations()
  const locale = useLocale()
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])
    return v && v !== key ? v : (fallback ?? key)
  }

  const [activeTab, setActiveTab] = useState<CrmTabId>('interactions')

  const {
    data: interactions,
    isLoading: isInteractionsLoading,
    error: interactionsError,
  } = useInteractions()

  // Reuse the HR employees list (same data source as /human-resources) —
  // no separate employee source invented for this feature.
  const { data: employeesData, isLoading: isEmployeesLoading } = useEmployees({ limit: 200 })

  const employees: EmployeeOption[] = useMemo(() => {
    type EmployeeRow = {
      id: string
      first_name?: string
      last_name?: string
      employee_code?: string
    }
    const rows: EmployeeRow[] = employeesData?.employees ?? []
    return rows.map((emp) => ({
      id: emp.id,
      name: [emp.first_name, emp.last_name].filter(Boolean).join(' ') || emp.employee_code || '',
    }))
  }, [employeesData])

  const isLoading =
    activeTab === 'interactions'
      ? isInteractionsLoading || isEmployeesLoading
      : isInteractionsLoading
  const error = interactionsError

  const handleTabChange = useCallback((tab: CrmTabId) => setActiveTab(tab), [])

  const { mutateAsync: createInteraction, isPending: isCreatingInteraction } =
    useCreateInteraction()
  const { mutateAsync: updateStatus, isPending: isUpdatingStatus } = useUpdateInteractionStatus()
  const { mutateAsync: recordOutcome } = useRecordCustomerOutcome()
  const { data: subjectSuggestions } = useSubjectSuggestions()

  // Which customer row is mid-write, so only that row spins.
  const [pendingCustomerId, setPendingCustomerId] = useState<string | null>(null)

  const handleCreateInteraction = useCallback(
    async (input: {
      customerId: string
      customerIds: string[]
      employeeId: string
      employeeName: string
      type: string
      subject: string
      content: string
    }) => {
      await createInteraction(input)
    },
    [createInteraction],
  )

  const handleUpdateStatus = useCallback(
    async (id: string, status: TaskStatus, assignee?: { id: string; name: string }) => {
      await updateStatus({
        id,
        status,
        ...(assignee ? { employeeId: assignee.id, employeeName: assignee.name } : {}),
      })
    },
    [updateStatus],
  )

  const handleRecordOutcome = useCallback(
    async (
      taskId: string,
      input: { customerId: string; outcome: 'done' | 'failed'; note?: string },
    ) => {
      setPendingCustomerId(input.customerId)
      try {
        await recordOutcome({ id: taskId, ...input })
      } finally {
        // Cleared unconditionally so a failed write does not leave the row
        // spinning forever with no way to retry.
        setPendingCustomerId(null)
      }
    },
    [recordOutcome],
  )

  const getPublicTaskUrl = useCallback(
    (token: string) => {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://hisabche.com'
      const lang = urlLangFromLocale(locale)
      return `${origin}/${lang}/public-task/${token}`
    },
    [locale],
  )

  return (
    <CrmView
      t={t}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      interactions={interactions ?? []}
      employees={employees}
      isLoading={isLoading}
      error={error?.message || null}
      isCreatingInteraction={isCreatingInteraction}
      isUpdatingStatus={isUpdatingStatus}
      onCreateInteraction={handleCreateInteraction}
      onUpdateStatus={handleUpdateStatus}
      onRecordOutcome={handleRecordOutcome}
      pendingCustomerId={pendingCustomerId}
      subjectSuggestions={subjectSuggestions ?? []}
      getPublicTaskUrl={getPublicTaskUrl}
    />
  )
})

CrmContainer.displayName = 'CrmContainer'
