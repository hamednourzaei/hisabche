'use client'

// ============================================
// packages/ui/src/components/ui/work-queue/work-queue-panel.tsx
//
// PHASE 12 — what needs doing, as a list of jobs rather than a list of facts.
//
// The decision of WHAT is in the queue, in what order, and whether this person
// may act on it, lives in `@hisabche/ui-contract`. This file only paints it.
//
// Renders nothing when there is no work. Not an encouraging empty state: a
// panel that says "nothing to do!" on a dashboard every day is a panel people
// learn to skip, and then miss the day it says something.
// ============================================

import { memo } from 'react'
import {
  buildWorkQueue,
  hasWork,
  type WorkCounts,
  type WorkItemUrgency,
} from '@hisabche/ui-contract'

import { Badge as UiBadge } from '../badge'
import { Button } from '../button'
import { Card, CardContent, CardHeader, CardTitle } from '../card'

const URGENCY_VARIANT: Record<WorkItemUrgency, 'destructive' | 'warning' | 'outline'> = {
  blocking: 'destructive',
  due: 'warning',
  attention: 'outline',
}

export interface WorkQueuePanelProps {
  t: (key: string, fallback?: string) => string
  counts: WorkCounts
  /** Capabilities the SERVER said this actor holds. Never invented locally. */
  capabilities: readonly string[]
  onNavigate: (path: string) => void
}

export const WorkQueuePanel = memo(function WorkQueuePanel({
  t,
  counts,
  capabilities,
  onNavigate,
}: WorkQueuePanelProps) {
  const items = buildWorkQueue(counts, capabilities)
  if (!hasWork(items)) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('workQueue.title', 'کارهای امروز')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.kind} className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <UiBadge variant={URGENCY_VARIANT[item.urgency]}>
                  <span className="tabular-nums" dir="ltr">
                    {item.count}
                  </span>
                </UiBadge>
                <span className="text-sm text-[hsl(var(--fg-secondary))]">{t(item.labelKey)}</span>
              </span>

              {/* The verb. A work item without somewhere to go is a complaint. */}
              <Button variant="outline" size="sm" onClick={() => onNavigate(item.path)}>
                {t('workQueue.go', 'رسیدگی')}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
})

WorkQueuePanel.displayName = 'WorkQueuePanel'
