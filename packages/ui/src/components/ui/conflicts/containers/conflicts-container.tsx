'use client'

// ============================================
// packages/ui/src/components/ui/conflicts/containers/conflicts-container.tsx
//
// Data and intent for the offline conflict queue. Web and desktop both mount
// this module; the view below it holds no query of its own.
// ============================================

import { memo, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  asList,
  useConflict,
  useConflicts,
  useResolveConflict,
  type ConflictSummary,
  type ResolutionChoice,
  apiErrorMessage,
} from '@hisabche/api'
import { ConflictsView } from '../conflicts-view'

export const ConflictsContainer = memo(function ConflictsContainer() {
  const translate = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const value = translate(key as Parameters<typeof translate>[0])
    return value && value !== key ? value : (fallback ?? key)
  }

  const router = useRouter()

  const [status, setStatus] = useState<'open' | 'resolved' | 'all'>('open')
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const conflicts = useConflicts(status)
  const list = asList<ConflictSummary>(conflicts.data)

  // Nothing is selected by default. Unlike a bank statement, the first row here
  // is not the one somebody came for — opening a financial decision the person
  // did not ask to see invites resolving the wrong one.
  const selectedId = chosenId
  const detail = useConflict(selectedId ?? '')

  // The list already carries every field the view needs, so the detail query is
  // a refresh rather than a prerequisite: the panel opens instantly and
  // sharpens when the fetch lands.
  const selected = detail.data ?? list.find((row) => row.id === selectedId) ?? null

  const resolve = useResolveConflict()

  const handleResolve = useCallback(
    (input: {
      choice: ResolutionChoice
      fieldChoices?: Record<string, 'server' | 'client'>
      reason: string
    }) => {
      if (!selectedId) return
      setActionError(null)

      resolve.mutate(
        { conflictId: selectedId, ...input },
        {
          // The dialog closes only once the server has accepted the decision;
          // a refusal keeps it open with the reason still typed.
          onSuccess: () => setChosenId(null),
          onError: (err) => {
            // Server refusals are shown verbatim: CONFLICT_ALREADY_RESOLVED and
            // CONFLICT_MERGE_FIELD_UNKNOWN each tell the person something they
            // can act on, which "an error occurred" does not.
            const message = apiErrorMessage(err, t('common.saveError', 'انجام نشد'))
            setActionError(message)
          },
        },
      )
    },
    [resolve, selectedId],
  )

  const handleSelect = useCallback((id: string | null) => {
    setActionError(null)
    setChosenId(id)
  }, [])

  const handleRefresh = useCallback(() => {
    setActionError(null)
    conflicts.refetch()
    if (selectedId) detail.refetch()
  }, [conflicts, detail, selectedId])

  const handleStatusChange = useCallback((next: 'open' | 'resolved' | 'all') => {
    setStatus(next)
    // The selection belongs to the previous filter. Keeping it would leave a
    // resolved conflict open in the panel under the "open" tab.
    setChosenId(null)
    setActionError(null)
  }, [])

  return (
    <ConflictsView
      t={t}
      conflicts={list}
      status={status}
      selected={selected}
      isLoading={conflicts.isLoading}
      error={conflicts.error ? (conflicts.error as Error).message : null}
      actionError={actionError}
      isBusy={resolve.isPending}
      // The server is the authority: resolving carries the same bar as
      // reversing a posted entry (`requireCapability('ledger.reverse')`), and
      // it refuses with 403 if the role is wrong. The refusal is surfaced
      // verbatim rather than pre-empted here — a client-side guess at
      // permissions is one that drifts from the server's.
      canResolve={true}
      onStatusChange={handleStatusChange}
      onSelect={handleSelect}
      onResolve={handleResolve}
      onOpenRecord={(route) => router.push(route)}
      onRefresh={handleRefresh}
    />
  )
})

ConflictsContainer.displayName = 'ConflictsContainer'
