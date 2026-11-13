'use client'
// ============================================
// «نشانه‌گذاری داده» — record-count snapshots. Data and sync hub.
//
// ⚠️ A SNAPSHOT IS A ROW COUNT, NOT A BACKUP. It says how many invoices,
// customers, products… the business had at a moment, and compares that with
// now. Nothing is restored from one; the first sentence on screen says so.
// (The old «restore to sandbox» route answered «restored» and restored
// nothing — it was removed in the V61 audit.)
// ⚠️ Manager and up (the server checks the role).
// ============================================
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  useSnapshotComparison,
  useSnapshots,
  useTakeSnapshot,
  type SnapshotView,
} from '@hisabche/api'

import { useDateFormat } from '../../../hooks/use-date-format'
import { Button } from '../button'
import { DataTable, type TableColumn } from '../data-table'
import { EmptyState } from '../empty-state'
import { Input } from '../input'
import { useToast } from '../toast-provider'
import { QueryState, fieldLabel, refusalText, useTableLabel } from './erp-shared'

type ChangeRow = { table: string; then: number | null; now: number | null; added: number | null }

export function SnapshotsSection() {
  const t = useTranslations('erpCore.snapshots')
  const tr = (key: string): string => t(key as Parameters<typeof t>[0])
  const label = useTableLabel()
  const toast = useToast()
  const { dateTime } = useDateFormat()
  const snapshots = useSnapshots()
  const take = useTakeSnapshot()
  const [name, setName] = useState('')
  const [compareId, setCompareId] = useState<string | null>(null)
  const comparison = useSnapshotComparison(compareId)

  const columns: TableColumn<SnapshotView>[] = [
    {
      id: 'label',
      labelKey: 'erpCore.snapshots.columns.label',
      labelFallback: 'نام',
      locked: true,
      render: (s) => s.label,
    },
    {
      id: 'takenAt',
      labelKey: 'erpCore.snapshots.columns.takenAt',
      labelFallback: 'زمان',
      render: (s) => dateTime(s.takenAt),
      sortValue: (s) => s.takenAt,
    },
    {
      id: 'actions',
      labelKey: 'erpCore.snapshots.columns.actions',
      labelFallback: 'اقدام',
      locked: true,
      render: (s) => (
        <Button size="sm" variant="outline" onClick={() => setCompareId(s.id)}>
          {tr('compare')}
        </Button>
      ),
    },
  ]

  const changeColumns: TableColumn<ChangeRow>[] = [
    {
      id: 'table',
      labelKey: 'erpCore.snapshots.columns.table',
      labelFallback: 'بخش',
      locked: true,
      render: (c) => c.table,
    },
    {
      id: 'then',
      labelKey: 'erpCore.snapshots.columns.then',
      labelFallback: 'آن زمان',
      render: (c) => (c.then === null ? '—' : c.then),
    },
    {
      id: 'now',
      labelKey: 'erpCore.snapshots.columns.now',
      labelFallback: 'اکنون',
      render: (c) => (c.now === null ? '—' : c.now),
    },
    {
      id: 'added',
      labelKey: 'erpCore.snapshots.columns.added',
      labelFallback: 'تغییر',
      // `null` = this count could not be read, which is not «no change».
      render: (c) => (c.added === null ? tr('unknown') : c.added),
    },
  ]

  const submit = () => {
    if (!name.trim()) {
      toast.error(tr('errors.labelRequired'))
      return
    }
    take.mutate(name.trim(), {
      onSuccess: () => {
        setName('')
        toast.success(tr('taken'))
      },
      onError: (e) => toast.error(refusalText(e, [], tr)),
    })
  }

  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-[hsl(var(--fg-secondary))]">{tr('intro')}</p>
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-[hsl(var(--border-default))] p-4">
        <label className={`${fieldLabel} min-w-[16rem] flex-1`}>
          {tr('form.label')}
          <Input name="label" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <Button size="sm" disabled={take.isPending} onClick={submit}>
          {tr('form.take')}
        </Button>
      </div>

      <QueryState
        isLoading={snapshots.isLoading}
        isError={snapshots.isError}
        onRetry={() => void snapshots.refetch()}
        loadingText={tr('loading')}
        errorText={tr('loadFailed')}
        retryText={tr('retry')}
      >
        <DataTable
          tableId="data-snapshots"
          t={label}
          rows={snapshots.data ?? []}
          columns={columns}
          rowKey={(s) => s.id}
          emptyState={<EmptyState title={tr('emptyTitle')} description={tr('emptyDescription')} />}
        />
      </QueryState>

      {compareId ? (
        <section className="space-y-3 rounded-2xl border border-[hsl(var(--border-default))] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{tr('comparisonTitle')}</h3>
            <Button size="sm" variant="outline" onClick={() => setCompareId(null)}>
              {tr('close')}
            </Button>
          </div>
          <QueryState
            isLoading={comparison.isLoading}
            isError={comparison.isError}
            onRetry={() => void comparison.refetch()}
            loadingText={tr('loading')}
            errorText={tr('loadFailed')}
            retryText={tr('retry')}
          >
            {comparison.data && !comparison.data.readable ? (
              <p role="status" className="text-sm text-[hsl(var(--fg-secondary))]">
                {tr('unreadable')}
              </p>
            ) : (
              <DataTable
                tableId="data-snapshot-changes"
                t={label}
                rows={Array.isArray(comparison.data?.changes) ? comparison.data.changes : []}
                columns={changeColumns}
                rowKey={(c) => c.table}
                paginate={false}
                emptyState={<EmptyState title={tr('noChanges')} />}
              />
            )}
          </QueryState>
        </section>
      ) : null}
    </div>
  )
}
