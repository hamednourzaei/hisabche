// packages/ui/src/components/ui/accounting/tabs/JournalTab.tsx
'use client'

import { memo, useState, useCallback, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { useJournalEntries, useCreateJournalEntry, useAccounts } from '@hisabche/api'
import { JournalEntryRow } from '../components/JournalEntryRow'
import {
  CreateJournalEntryDialog,
  type CreateJournalEntryInput,
} from '../components/CreateJournalEntryDialog'
import { ExportButton, type ExportColumn } from '../components/ExportButton'
import { AccountingSkeleton } from '../AccountingSkeleton'
import { AccountingEmptyState } from '../AccountingEmptyState'
import { useLedgerNumber } from '../components/ledger-table'
import { DataTable, matchesSearch, type TableColumn } from '../../data-table'
import { useDateFormat } from '../../../../hooks/use-date-format'
import type { JournalEntry } from '@hisabche/api'

const exportColumns: ExportColumn<JournalEntry>[] = [
  { key: 'date', header: 'تاریخ', accessor: (e) => e.date },
  { key: 'description', header: 'شرح', accessor: (e) => e.description },
  { key: 'reference', header: 'مرجع', accessor: (e) => e.reference || '' },
  { key: 'total', header: 'جمع', accessor: (e) => e.lines.reduce((s, l) => s + l.debit, 0) },
]

export const JournalTab = memo(function JournalTab() {
  const t = useTranslations()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { data: entries, isLoading } = useJournalEntries()
  const { data: accounts } = useAccounts()
  const { mutate: createJournalEntry, isPending } = useCreateJournalEntry()
  const { date } = useDateFormat()
  const n = useLedgerNumber()
  const [search, setSearch] = useState('')
  // The entry whose lines are open under the table.
  const [openId, setOpenId] = useState<string | null>(null)

  // A missing key renders its fallback, never the key.
  const safeT = useCallback(
    (key: string, fallback?: string): string => {
      const value = t(key as never)
      return value && value !== key ? value : (fallback ?? key)
    },
    [t],
  )

  const rows = useMemo(
    () =>
      (entries ?? []).filter((entry) =>
        matchesSearch(search, [entry.description, entry.reference, entry.entryNumber ?? '']),
      ),
    [entries, search],
  )
  const openEntry = openId ? (entries ?? []).find((entry) => entry.id === openId) : undefined

  const columns = useMemo<TableColumn<JournalEntry>[]>(
    () => [
      {
        id: 'date',
        labelKey: 'accounting.journal.date',
        labelFallback: 'تاریخ',
        sortValue: (entry) => entry.date,
        render: (entry) => (
          <span className="whitespace-nowrap text-[hsl(var(--fg-secondary))]">
            {date(entry.date)}
          </span>
        ),
      },
      {
        id: 'description',
        labelKey: 'accounting.journal.description',
        labelFallback: 'شرح',
        locked: true,
        sortValue: (entry) => entry.description,
        render: (entry) => <span className="font-medium">{entry.description}</span>,
      },
      {
        id: 'reference',
        labelKey: 'accounting.journal.reference',
        labelFallback: 'مرجع',
        showFrom: 'md',
        sortValue: (entry) => entry.reference,
        render: (entry) => (
          <span className="text-xs text-[hsl(var(--fg-tertiary))]" dir="ltr">
            {entry.reference || '—'}
          </span>
        ),
      },
      {
        id: 'total',
        labelKey: 'accounting.journal.totalDebit',
        labelFallback: 'جمع بدهکار',
        align: 'end',
        sortValue: (entry) => entry.lines.reduce((sum, line) => sum + line.debit, 0),
        render: (entry) => (
          <span className="font-semibold tabular-nums">
            {n(
              entry.lines.reduce((sum, line) => sum + line.debit, 0),
              'zero',
            )}
          </span>
        ),
      },
    ],
    [date, n],
  )

  // One key per entry being written: a retry of the same submit reuses it
  // (the server answers with the first entry), a new entry gets a new one.
  const entryKeyRef = useRef<string | null>(null)
  const handleOpenDialog = useCallback(() => {
    entryKeyRef.current = crypto.randomUUID()
    setIsDialogOpen(true)
  }, [])
  const handleCloseDialog = useCallback(() => setIsDialogOpen(false), [])

  const handleSubmit = useCallback(
    (input: CreateJournalEntryInput) => {
      entryKeyRef.current ??= crypto.randomUUID()
      createJournalEntry(
        { ...input, idempotencyKey: entryKeyRef.current },
        {
          onSuccess: () => {
            entryKeyRef.current = null
            setIsDialogOpen(false)
          },
        },
      )
    },
    [createJournalEntry],
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 px-3 md:px-4 lg:px-5 py-2.5 md:py-3 lg:py-4 border-b border-[hsl(var(--border-default))]">
        <h2 className="text-xs md:text-sm lg:text-base font-semibold text-[hsl(var(--fg-primary))]">
          {t('accounting.journal.title')}
        </h2>
        <div className="flex items-center gap-1.5 md:gap-2">
          <ExportButton data={entries || []} columns={exportColumns} filename="journal-entries" />
          <button
            type="button"
            onClick={handleOpenDialog}
            className={cn(
              'flex items-center gap-1.5 rounded-lg font-medium transition-opacity',
              'px-2.5 md:px-3 lg:px-4 py-1.5 md:py-2',
              'text-sm',
              'bg-[hsl(var(--color-primary))] text-white hover:opacity-90',
            )}
          >
            <Plus className="size-3.5 md:size-4" aria-hidden="true" />
            {t('accounting.journal.create')}
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3 md:p-4">
        {isLoading ? (
          <AccountingSkeleton />
        ) : (
          <DataTable
            tableId="journal-entries"
            t={safeT}
            rows={rows}
            columns={columns}
            rowKey={(entry) => entry.id}
            // A row opens its entry under the table; pressing it again closes it.
            onRowClick={(entry) => setOpenId((current) => (current === entry.id ? null : entry.id))}
            searchValue={search}
            onSearchChange={setSearch}
            minWidthClass="min-w-[420px]"
            emptyState={
              (entries ?? []).length === 0 ? (
                <AccountingEmptyState
                  title={t('accounting.journal.empty.title')}
                  subtitle={t('accounting.journal.empty.subtitle')}
                />
              ) : (
                <AccountingEmptyState
                  title={safeT('accounting.journal.noMatch', 'سندی با این جست‌وجو نیست')}
                />
              )
            }
          />
        )}

        {openEntry ? (
          <div className="rounded-[var(--radius-md)] border border-[hsl(var(--border-default))]">
            <JournalEntryRow
              key={openEntry.id}
              entry={openEntry}
              accounts={accounts || []}
              defaultOpen
            />
          </div>
        ) : null}
      </div>
      <CreateJournalEntryDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        isSubmitting={isPending}
        accounts={accounts || []}
      />
    </div>
  )
})
