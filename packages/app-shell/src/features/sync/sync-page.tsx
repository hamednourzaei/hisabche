// ============================================
// Sync centre — every queued change, stage by stage; retry what the server
// refused; force a sync. The stages are decided in outbox-stage.ts.
// ============================================

import React, { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'

import { Badge, Button, Card, type BadgeTone } from '@/components/ui/primitives'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@hisabche/ui'
import { PageHeader } from '@/components/layout/page-header'
import { bridge } from '@/shared/lib/bridge'
import { formatDate } from '@/shared/lib/currency'
import { useSyncQueue, useSyncStatus } from './use-sync'
import { MAX_ATTEMPTS, stagesSnapshot, subscribeStages } from './sync-engine'
import { reasonOf, stageOf, type OutboxStage } from './outbox-stage'
import type { QueueEntry } from '@hisabche/app-bridge'

/** Column shape for this screen's queue table. Local because it describes the
 *  IPC outbox rows, not a product entity. */
interface Column<T> {
  key: string
  header: string
  align?: 'end' | undefined
  render: (row: T) => React.ReactNode
}

const TONE: Record<OutboxStage | 'committed', BadgeTone> = {
  queued: 'neutral',
  sending: 'info',
  retrying: 'warning',
  rejected: 'danger',
  committed: 'success',
}

export default function SyncPage() {
  const { t } = useTranslation('desktop')
  const queue = useSyncQueue()
  const { isSyncing, sync } = useSyncStatus()
  const stages = useSyncExternalStore(subscribeStages, stagesSnapshot, stagesSnapshot)

  const retry = useCallback(
    async (entry: QueueEntry) => {
      // Re-queued FRESH (attempts 0, no error) — the same clientId, so the
      // server still treats it as the same change — then drained.
      await bridge()?.db.enqueue({
        entity: entry.entity,
        operation: entry.operation,
        clientId: entry.clientId,
        payload: entry.payload,
      })
      await sync()
      await queue.refetch()
    },
    [queue, sync],
  )

  const entries = queue.data ?? []
  const staged = useMemo(
    () => entries.map((entry) => ({ entry, stage: stageOf(entry, stages.inFlight, MAX_ATTEMPTS) })),
    [entries, stages.inFlight],
  )
  const rejected = staged.filter((row) => row.stage === 'rejected').length

  const label = useCallback(
    (group: 'entity' | 'op', value: string) => t(`sync.${group}.${value}`, { defaultValue: value }),
    [t],
  )

  const columns = useMemo<readonly Column<(typeof staged)[number]>[]>(
    () => [
      {
        key: 'record',
        header: t('sync.col.record'),
        render: ({ entry }) => label('entity', entry.entity),
      },
      {
        key: 'operation',
        header: t('sync.col.operation'),
        render: ({ entry }) => label('op', entry.operation),
      },
      {
        key: 'stage',
        header: t('sync.col.stage'),
        render: ({ stage }) => <Badge tone={TONE[stage]}>{t(`sync.stage.${stage}`)}</Badge>,
      },
      {
        key: 'reason',
        header: t('sync.col.reason'),
        render: ({ entry }) => reasonOf(entry.lastError) ?? '—',
      },
      {
        key: 'time',
        header: t('sync.col.time'),
        render: ({ entry }) => formatDate(entry.createdAt),
      },
      {
        key: 'retry',
        header: '',
        align: 'end',
        render: ({ entry, stage }) =>
          stage === 'rejected' || stage === 'retrying' ? (
            <Button size="sm" variant="ghost" onClick={() => void retry(entry)}>
              {t('common.retry')}
            </Button>
          ) : null,
      },
    ],
    [label, retry, t],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={t('sync.title')}
        subtitle={rejected > 0 ? `${rejected} ${t('sync.stage.rejected')}` : undefined}
      >
        <Button size="sm" variant="primary" disabled={isSyncing} onClick={() => void sync()}>
          <RefreshCw size={14} className={isSyncing ? 'animate-spin' : undefined} />
          {t('sync.syncNow')}
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-4 overflow-x-auto p-4">
        {staged.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-[hsl(var(--fg-secondary))]">
              {t('sync.queueEmpty')}
            </p>
          </Card>
        ) : (
          <>
            {rejected > 0 ? (
              <p className="text-sm text-[hsl(var(--color-destructive))]" role="alert">
                {t('sync.rejectedHint')}
              </p>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead
                      key={column.key}
                      className={column.align === 'end' ? 'text-end' : undefined}
                    >
                      {column.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {staged.map((row) => (
                  <TableRow key={row.entry.clientId}>
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={column.align === 'end' ? 'text-end' : undefined}
                      >
                        {column.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}

        {stages.committed.length > 0 ? (
          <section aria-labelledby="sync-committed" className="flex flex-col gap-2">
            <h2 id="sync-committed" className="text-sm font-semibold">
              {t('sync.committedTitle')}
            </h2>
            <p className="text-xs text-[hsl(var(--fg-secondary))]">{t('sync.committedHint')}</p>
            <ul className="flex flex-col gap-1">
              {stages.committed.map((row) => (
                <li key={row.clientId} className="flex items-center gap-2 text-sm">
                  <Badge tone={TONE.committed}>{t('sync.stage.committed')}</Badge>
                  <span>
                    {label('entity', row.entity)} · {label('op', row.operation)}
                  </span>
                  <span className="ms-auto text-xs text-[hsl(var(--fg-secondary))]">
                    {formatDate(row.committedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}
