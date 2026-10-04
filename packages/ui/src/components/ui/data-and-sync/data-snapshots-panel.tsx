'use client'

// ============================================
// «نشانه‌ی وضعیت داده» — a marker of how many records the business holds at a
// moment, and what has been added since (#42–#46).
//
// ⚠️ NOT A BACKUP. The first sentence under the title says so: a marker copies
// no rows and nothing can be restored from it.
// ⚠️ «Not known» is shown as «—», never as 0 — a table that could not be
// counted, or a difference with an unknown side.
// ⚠️ A marker is never changed or removed.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatNumber } from '@hisabche/formatting'
import {
  apiErrorMessage,
  useDataSnapshotComparison,
  useDataSnapshots,
  useTakeDataSnapshot,
} from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { useDateFormat } from '../../../hooks/use-date-format'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { Button } from '../button'

/** The tables a marker counts; an unknown name from the server is shown as it is. */
export const SNAPSHOT_TABLE_NAMES = [
  'journal_entries',
  'journal_lines',
  'accounts',
  'invoices',
  'invoice_items',
  'payments',
  'payment_allocations',
  'customers',
  'suppliers',
  'products',
] as const

const th = 'px-3 py-2 text-start text-xs font-medium text-[hsl(var(--fg-secondary))]'
const td = 'px-3 py-2 text-sm text-[hsl(var(--fg-primary))] tabular-nums'

export function DataSnapshotsPanel() {
  const t = useTranslations('snapshots')
  const locale = useIntlLocale()
  const { dateTime } = useDateFormat()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const snapshots = useDataSnapshots(open)
  const take = useTakeDataSnapshot()
  const comparison = useDataSnapshotComparison(selected)

  const message = (error: unknown): string => {
    if ((error as { response?: { status?: number } } | null)?.response?.status === 403)
      return t('forbidden')
    return apiErrorMessage(error, '').includes('SNAPSHOTS_MIGRATION_PENDING')
      ? t('errors.SNAPSHOTS_MIGRATION_PENDING')
      : t('errors.general')
  }
  const number = (value: number | null) => (value === null ? '—' : formatNumber(value, locale, 0))
  const tableName = (table: string) =>
    (SNAPSHOT_TABLE_NAMES as readonly string[]).includes(table) ? t(`tables.${table}`) : table

  return (
    <section className="space-y-3 rounded-2xl border border-[hsl(var(--border-default))] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-[hsl(var(--fg-primary))]">{t('title')}</h3>
          <p className="mt-0.5 text-xs text-[hsl(var(--fg-tertiary))]">{t('notBackup')}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen((value) => !value)}>
          {open ? t('hide') : t('show')}
        </Button>
      </div>

      {open && snapshots.isLoading ? (
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('loading')}</p>
      ) : null}
      {open && snapshots.error ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {message(snapshots.error)}
        </p>
      ) : null}

      {open && snapshots.data ? (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="block text-xs text-[hsl(var(--fg-secondary))]">{t('label')}</span>
              <input
                name="label"
                value={label}
                maxLength={80}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={t('labelPlaceholder')}
                className="h-10 w-64 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 text-sm outline-none focus:border-[hsl(var(--color-primary))]"
              />
            </label>
            <Button
              size="sm"
              disabled={take.isPending || label.trim() === ''}
              onClick={() =>
                take.mutate(label, {
                  onSuccess: (snapshot) => {
                    setLabel('')
                    setSelected(snapshot.id)
                  },
                })
              }
            >
              {t('take')}
            </Button>
          </div>
          {take.error ? (
            <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
              {message(take.error)}
            </p>
          ) : null}

          {snapshots.data.length === 0 ? (
            <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('empty')}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {snapshots.data.map((snapshot) => (
                <li key={snapshot.id}>
                  <Button
                    size="sm"
                    variant={selected === snapshot.id ? 'default' : 'outline'}
                    onClick={() => setSelected(snapshot.id)}
                  >
                    {snapshot.label} · {dateTime(snapshot.takenAt)}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {selected ? (
            comparison.isLoading ? (
              <div className="h-24 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))] motion-reduce:animate-none" />
            ) : comparison.error || !comparison.data ? (
              <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
                {message(comparison.error)}
              </p>
            ) : (
              <div className="space-y-2">
                {!comparison.data.readable ? (
                  <p className="rounded-lg bg-[hsl(var(--color-warning)/0.12)] px-3 py-2 text-xs text-[hsl(var(--fg-primary))]">
                    {t('notReadable')}
                  </p>
                ) : null}
                <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border-default))]">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                        <th className={th}>{t('what')}</th>
                        <th className={th}>{t('then')}</th>
                        <th className={th}>{t('now')}</th>
                        <th className={th}>{t('added')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.data.changes.map((change) => (
                        <tr
                          key={change.table}
                          className="border-b border-[hsl(var(--border-default))]"
                        >
                          <td className={cn(td, 'font-medium')}>{tableName(change.table)}</td>
                          <td className={td}>{number(change.then)}</td>
                          <td className={td}>{number(change.now)}</td>
                          <td className={td} dir="ltr">
                            {change.added === null
                              ? '—'
                              : `${change.added > 0 ? '+' : ''}${formatNumber(change.added, locale, 0)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('limits')}</p>
              </div>
            )
          ) : null}
        </>
      ) : null}
    </section>
  )
}
