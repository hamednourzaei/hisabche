'use client'

// ============================================
// packages/ui/src/components/ui/timesheets/containers/timesheets-container.tsx
// ============================================

import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  useBillingPreview,
  useLogTime,
  useProjectProfitability,
  useProjects,
  useTimesheetSummary,
} from '@hisabche/api'
import { TimesheetsView, type TimesheetProjectOption } from '../timesheets-view'

export const TimesheetsContainer = memo(function TimesheetsContainer() {
  const translate = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const value = translate(key as Parameters<typeof translate>[0])
    return value && value !== key ? value : (fallback ?? key)
  }

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const projects = useProjects()
  const summary = useTimesheetSummary(selectedProjectId ?? '')
  const preview = useBillingPreview(selectedProjectId ?? '')
  const profitability = useProjectProfitability(selectedProjectId ?? '')
  const logTime = useLogTime()

  // `/projects` is an older endpoint and answers with either a bare array or a
  // `{ projects }` envelope depending on the caller. Both are handled rather
  // than assumed: guessing wrong renders an empty picker with no error.
  const projectOptions = useMemo<TimesheetProjectOption[]>(() => {
    const raw = projects.data as unknown
    const list = Array.isArray(raw)
      ? raw
      : ((raw as { projects?: unknown[] } | undefined)?.projects ?? [])

    return (list as Array<Record<string, unknown>>)
      .filter((row) => typeof row?.id === 'string')
      .map((row) => ({
        id: row.id as string,
        name: (row.name as string) ?? (row.title as string) ?? (row.id as string),
      }))
  }, [projects.data])

  const handleLogTime = useCallback(
    (input: {
      employeeId: string
      onDate: string
      minutes: number
      billable: boolean
      description: string
    }) => {
      if (!selectedProjectId) return
      setActionError(null)
      logTime.mutate(
        { projectId: selectedProjectId, ...input },
        {
          onError: (err) => {
            const message =
              (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
              (err as Error)?.message
            setActionError(message ?? null)
          },
        },
      )
    },
    [logTime, selectedProjectId],
  )

  const handleRefresh = useCallback(() => {
    setActionError(null)
    projects.refetch()
    if (selectedProjectId) {
      summary.refetch()
      preview.refetch()
      profitability.refetch()
    }
  }, [preview, profitability, projects, selectedProjectId, summary])

  return (
    <TimesheetsView
      t={t}
      projects={projectOptions}
      selectedProjectId={selectedProjectId}
      config={summary.data?.config ?? null}
      totals={summary.data?.totals ?? null}
      previewLines={preview.data?.lines ?? []}
      previewProblems={preview.data?.problems ?? []}
      profitability={profitability.data ?? null}
      isLoading={projects.isLoading}
      isDetailLoading={Boolean(selectedProjectId) && summary.isLoading}
      error={projects.error ? (projects.error as Error).message : null}
      actionError={actionError}
      isBusy={logTime.isPending}
      onSelectProject={(projectId) => setSelectedProjectId(projectId || null)}
      onLogTime={handleLogTime}
      onRefresh={handleRefresh}
    />
  )
})

TimesheetsContainer.displayName = 'TimesheetsContainer'
