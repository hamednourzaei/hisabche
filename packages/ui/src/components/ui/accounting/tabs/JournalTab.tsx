// packages/ui/src/components/ui/accounting/tabs/JournalTab.tsx
'use client'

import { memo, useState, useCallback, useRef } from 'react'
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

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <AccountingSkeleton />
        ) : !entries || entries.length === 0 ? (
          <AccountingEmptyState
            title={t('accounting.journal.empty.title')}
            subtitle={t('accounting.journal.empty.subtitle')}
          />
        ) : (
          <div>
            {entries.map((entry) => (
              <JournalEntryRow key={entry.id} entry={entry} accounts={accounts || []} />
            ))}
          </div>
        )}
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
