// packages/ui/src/components/ui/accounting/tabs/AccountsTab.tsx
'use client'

import { memo, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { useAccounts, useCreateAccount } from '@hisabche/api'
import { AccountRow } from '../components/AccountRow'
import { LedgerHead, LedgerTable, LedgerTh } from '../components/ledger-table'
import { CreateAccountDialog, type CreateAccountInput } from '../components/CreateAccountDialog'
import { ExportButton, type ExportColumn } from '../components/ExportButton'
import { AccountingSkeleton } from '../AccountingSkeleton'
import { AccountingEmptyState } from '../AccountingEmptyState'
import type { Account } from '@hisabche/api'

const exportColumns: ExportColumn<Account>[] = [
  { key: 'code', header: 'کد', accessor: (a) => a.code },
  { key: 'name', header: 'نام', accessor: (a) => a.name },
  { key: 'type', header: 'نوع', accessor: (a) => a.type },
  { key: 'isActive', header: 'وضعیت', accessor: (a) => (a.isActive ? 'فعال' : 'غیرفعال') },
]

export const AccountsTab = memo(function AccountsTab() {
  const t = useTranslations()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { data: accounts, isLoading } = useAccounts()
  const { mutate: createAccount, isPending } = useCreateAccount()

  const parentOptions = useMemo(
    () => (accounts || []).map((a) => ({ id: a.id, label: `${a.code} - ${a.name}` })),
    [accounts],
  )

  const handleOpenDialog = useCallback(() => setIsDialogOpen(true), [])
  const handleCloseDialog = useCallback(() => setIsDialogOpen(false), [])

  const handleSubmit = useCallback(
    (input: CreateAccountInput) => {
      createAccount(input, {
        onSuccess: () => setIsDialogOpen(false),
      })
    },
    [createAccount],
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 px-3 md:px-4 lg:px-5 py-2.5 md:py-3 lg:py-4 border-b border-[hsl(var(--border-default))]">
        <h2 className="text-xs md:text-sm lg:text-base font-semibold text-[hsl(var(--fg-primary))]">
          {t('accounting.accounts.title')}
        </h2>
        <div className="flex items-center gap-1.5 md:gap-2">
          <ExportButton data={accounts || []} columns={exportColumns} filename="accounts" />
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
            {t('accounting.accounts.create')}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <AccountingSkeleton />
        ) : !accounts || accounts.length === 0 ? (
          <AccountingEmptyState
            title={t('accounting.accounts.empty.title')}
            subtitle={t('accounting.accounts.empty.subtitle')}
          />
        ) : (
          <LedgerTable caption={t('accounting.tabs.accounts')}>
            <LedgerHead>
              <LedgerTh>{t('accounting.accounts.code')}</LedgerTh>
              <LedgerTh>{t('accounting.accounts.name')}</LedgerTh>
              <LedgerTh>{t('accounting.accounts.type')}</LedgerTh>
              <LedgerTh>{t('accounting.accounts.status')}</LedgerTh>
            </LedgerHead>
            <tbody>
              {accounts.map((account) => (
                <AccountRow key={account.id} account={account} />
              ))}
            </tbody>
          </LedgerTable>
        )}
      </div>

      <CreateAccountDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        isSubmitting={isPending}
        parentOptions={parentOptions}
      />
    </div>
  )
})
