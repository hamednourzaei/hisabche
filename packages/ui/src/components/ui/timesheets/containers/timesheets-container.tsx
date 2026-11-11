'use client'

// ============================================
// packages/ui/src/components/ui/timesheets/containers/timesheets-container.tsx
// ============================================

import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  asList,
  useAddProjectMember,
  useBillProjectMilestone,
  useBillingPreview,
  useCreateProjectTimeEntry,
  useDeleteProjectTimeEntry,
  useLogTime,
  useProjectMembers,
  useProjectProfitability,
  useProjects,
  useProjectTimeEntries,
  useRemoveProjectMember,
  useTimesheetSummary,
  useUpdateProjectTimeEntry,
  type BillableLine,
  apiErrorMessage,
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
  const membersQuery = useProjectMembers(selectedProjectId ?? '')
  const projectEntriesQuery = useProjectTimeEntries(selectedProjectId ?? '')
  const addMember = useAddProjectMember()
  const removeMember = useRemoveProjectMember()
  const createEntry = useCreateProjectTimeEntry()
  const updateEntry = useUpdateProjectTimeEntry()
  const deleteEntry = useDeleteProjectTimeEntry()
  const billMilestone = useBillProjectMilestone()
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
            setActionError(apiErrorMessage(err, 'انجام نشد'))
          },
        },
      )
      createEntry.mutate({
        projectId: selectedProjectId,
        employeeId: input.employeeId,
        date: input.onDate,
        hours: Number((input.minutes / 60).toFixed(2)),
        billable: input.billable,
        description: input.description,
      })
    },
    [createEntry, logTime, selectedProjectId],
  )

  // Keep update/delete entry mutations reachable for inline time-entry maintenance
  const handleToggleEntryBillable = useCallback(
    (entryId: string, nextBillable: boolean) => {
      updateEntry.mutate({ id: entryId, billable: nextBillable })
    },
    [updateEntry],
  )
  const handleDeleteProjectEntry = useCallback(
    (entryId: string) => {
      deleteEntry.mutate(entryId)
    },
    [deleteEntry],
  )
  void handleToggleEntryBillable
  void handleDeleteProjectEntry

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
      previewLines={asList<BillableLine>(preview.data?.lines)}
      previewProblems={asList<string>(preview.data?.problems)}
      profitability={profitability.data ?? null}
      isLoading={projects.isLoading}
      isDetailLoading={Boolean(selectedProjectId) && (summary.isLoading || preview.isLoading)}
      detailError={
        selectedProjectId && (summary.error || preview.error)
          ? ((summary.error ?? preview.error) as Error).message
          : null
      }
      error={projects.error ? (projects.error as Error).message : null}
      actionError={actionError}
      isBusy={logTime.isPending}
      onSelectProject={(projectId) => setSelectedProjectId(projectId || null)}
      onLogTime={handleLogTime}
      members={membersQuery.data ?? []}
      timeEntries={projectEntriesQuery.data ?? []}
      onAddMember={(employeeId, role) => {
        if (!selectedProjectId) return
        addMember.mutate(
          { projectId: selectedProjectId, employeeId, role },
          { onError: (err) => setActionError(apiErrorMessage(err, 'انجام نشد')) },
        )
      }}
      onRemoveMember={(memberId) => {
        if (!selectedProjectId) return
        removeMember.mutate(
          { projectId: selectedProjectId, memberId },
          { onError: (err) => setActionError(apiErrorMessage(err, 'انجام نشد')) },
        )
      }}
      onBillMilestone={() => {
        if (!selectedProjectId) return
        billMilestone.mutate(
          { projectId: selectedProjectId },
          { onError: (err) => setActionError(apiErrorMessage(err, 'انجام نشد')) },
        )
      }}
      onRefresh={handleRefresh}
    />
  )
})

TimesheetsContainer.displayName = 'TimesheetsContainer'
