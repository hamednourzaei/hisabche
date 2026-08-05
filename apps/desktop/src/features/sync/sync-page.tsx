// ============================================
// Sync centre — inspect the local queue, retry failures, force a sync.
// ============================================

import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'

import { Badge, Button, Card } from '@/components/ui/primitives'
import { DataTable, type Column } from '@/components/ui/data-table'
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
    [queue, sync]
  )

  const columns = useMemo<readonly Column<QueueEntry>[]>(
    () => [
      { key: 'entity', header: t('accounting.title'), width: '160px', render: (row) => row.entity },
      { key: 'operation', header: t('sales.status'), width: '120px', render: (row) => row.operation },
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
      { key: 'error', header: t('common.error'), width: '1fr', render: (row) => row.lastError ?? '—' },
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
    [retry, t]
  )

  const entries = queue.data ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={t('sync.title')} subtitle={failedCount > 0 ? `${failedCount} ${t('sync.failed')}` : undefined}>
        <Button size="sm" variant="primary" disabled={isSyncing} onClick={() => void sync()}>
          <RefreshCw size={14} className={isSyncing ? 'animate-spin' : undefined} />
          {t('sync.syncNow')}
        </Button>
      </PageHeader>

      {entries.length === 0 ? (
        <div className="p-4">
          <Card>
            <p className="text-center text-sm text-[hsl(var(--fg-secondary))]">{t('sync.queueEmpty')}</p>
          </Card>
        </div>
      ) : (
        <DataTable
          rows={entries}
          columns={columns}
          rowKey={(row) => row.clientId}
          loading={queue.isLoading}
          emptyLabel={t('sync.queueEmpty')}
        />
      )}
    </div>
  )
}
