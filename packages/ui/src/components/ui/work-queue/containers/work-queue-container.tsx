'use client'

// ============================================
// packages/ui/src/components/ui/work-queue/containers/work-queue-container.tsx
//
// The counts behind "3 invoices overdue · 2 approvals waiting".
//
// ---------------------------------------------------------------------------
// A COUNT THAT FAILED IS `null`, NEVER `0`
//
// Every source here reports `null` while it is loading or after it errored.
// The contract drops a null item rather than rendering it, so a failed request
// shows NOTHING instead of "0 conflicts" — which would tell a shopkeeper there
// is nothing to review when the truth is that nobody checked.
//
// ---------------------------------------------------------------------------
// ONLY THE SOURCES THAT EXIST
//
// `low_stock`, `expiring_stock` and `unmatched_bank` are in the contract but
// are not passed here: no hook exposes those counts yet. Passing a guessed
// zero would silently hide real work; passing a fabricated number would be
// worse. They appear the day their hook does.
// ============================================

import { memo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useConflicts, useWorkflowInstances } from '@hisabche/api'
import { useSyncStore } from '@hisabche/store'
import type { WorkCounts } from '@hisabche/ui-contract'

import { WorkQueuePanel } from '../work-queue-panel'

export interface WorkQueueContainerProps {
  /** Capabilities the SERVER granted this actor. Never invented locally. */
  capabilities: readonly string[]
  onNavigate: (path: string) => void
}

export const WorkQueueContainer = memo(function WorkQueueContainer({
  capabilities,
  onNavigate,
}: WorkQueueContainerProps) {
  const translate = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const value = translate(key as Parameters<typeof translate>[0])
      return value && value !== key ? value : (fallback ?? key)
    },
    [translate],
  )

  const { pendingCount } = useSyncStore()
  const conflicts = useConflicts('open')
  const approvals = useWorkflowInstances({ status: 'pending' })

  // The two queries answer in different shapes: conflicts is a plain array,
  // workflow instances is a paged envelope whose `total` is the real count.
  // Reading `data.length` there would report the PAGE size and quietly cap the
  // badge at the page limit — "2 approvals waiting" on a shop that has forty.
  const conflictCount =
    conflicts.isLoading || conflicts.isError ? null : (conflicts.data?.length ?? 0)

  const approvalCount =
    approvals.isLoading || approvals.isError ? null : (approvals.data?.total ?? 0)

  const counts: WorkCounts = {
    conflicts: conflictCount,
    approvals: approvalCount,
    pending_sync: pendingCount,
  }

  return (
    <WorkQueuePanel t={t} counts={counts} capabilities={capabilities} onNavigate={onNavigate} />
  )
})

WorkQueueContainer.displayName = 'WorkQueueContainer'
