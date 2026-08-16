// ============================================
// Sync centre — inspect the local queue, retry failures, force a sync.
// ============================================

import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'

import { Badge, Button, Card } from '@/components/ui/primitives'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@hisabche/ui'

/** Column shape for this screen's queue table. Local because it describes the
 *  IPC outbox rows, not a product entity. */
interface Column<T> {
  key: string
  header: string
  align?: 'end' | undefined
  render: (row: T) => React.ReactNode
}
import { PageHeader } from '@/components/layout/page-header'
import { bridge } from '@/shared/lib/bridge'
import { formatDate } from '@/shared/lib/currency'
import { useSyncQueue, useSyncStatus } from './use-sync'
import type { QueueEntry } from '../../../electron/shared/ipc-contract'

export default function SyncPage() {
  const { t } = useTranslation('desktop')
  const queue = useSyncQueue()
  const { isSyncing, sync, failedCount } = useSyncStatus()

  const retry = useCallback(
    async (entry: QueueEntry) => {
      // Reset the entry to pending, then drain the queue.
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

  const columns = useMemo<readonly Column<QueueEntry>[]>(
    () => [
      { key: 'entity', header: t('accounting.title'), width: '160px', render: (row) => row.entity },
      {
        key: 'operation',
        header: t('sales.status'),
        width: '120px',
        render: (row) => row.operation,
      },
      {
        key: 'status',
        header: t('sync.title'),
        width: '130px',
        render: (row) => (
          <Badge tone={row.status === 'failed' ? 'danger' : 'warning'}>
            {t(`sync.${row.status}`, { defaultValue: row.status })}
          </Badge>
        ),
      },
      {
        key: 'error',
        header: t('common.error'),
        width: '1fr',
        render: (row) => row.lastError ?? '—',
      },
      {
        key: 'created',
        header: t('sales.date'),
        width: '150px',
        render: (row) => formatDate(row.createdAt),
      },
      {
        key: 'retry',
        header: '',
        width: '90px',
        align: 'end',
        render: (row) =>
          row.status === 'failed' ? (
            <Button size="sm" variant="ghost" onClick={() => void retry(row)}>
              {t('common.retry')}
            </Button>
          ) : null,
      },
    ],
    [retry, t],
  )

  // The queue inspector is desktop-only — it reads the Electron SQLite outbox
  // over IPC — but its table is not: it renders the canonical Table primitives
  // web uses, rather than a private desktop table.
  const entries = queue.data ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={t('sync.title')}
        subtitle={failedCount > 0 ? `${failedCount} ${t('sync.failed')}` : undefined}
      >
        <Button size="sm" variant="primary" disabled={isSyncing} onClick={() => void sync()}>
          <RefreshCw size={14} className={isSyncing ? 'animate-spin' : undefined} />
          {t('sync.syncNow')}
        </Button>
      </PageHeader>

      {entries.length === 0 ? (
        <div className="p-4">
          <Card>
            <p className="text-center text-sm text-[hsl(var(--fg-secondary))]">
              {t('sync.queueEmpty')}
            </p>
          </Card>
        </div>
      ) : (
        <div className="overflow-x-auto p-4">
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
              {entries.map((row) => (
                <TableRow key={row.clientId}>
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
        </div>
      )}
    </div>
  )
}
