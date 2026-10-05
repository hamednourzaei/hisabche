// packages/ui/src/components/ui/accounting/tabs/AccountsTab.tsx
'use client'

// The chart of accounts — the shared DataTable, like every other list: search,
// saved views, column settings, and a type filter in the table's own toolbar.

import { memo, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import { useAccounts, useCreateAccount } from '@hisabche/api'
import { ACCOUNT_TYPES, AccountStatusMark, AccountTypeBadge } from '../components/AccountRow'
import { CreateAccountDialog, type CreateAccountInput } from '../components/CreateAccountDialog'
import { ExportButton, type ExportColumn } from '../components/ExportButton'
import { DateRangePicker } from '../components/DateRangePicker'
import { AccountingSkeleton } from '../AccountingSkeleton'
import { AccountingEmptyState } from '../AccountingEmptyState'
import { DataTable, TableFilterSelect, matchesSearch, type TableColumn } from '../../data-table'
import type { Account } from '@hisabche/api'

const exportColumns: ExportColumn<Account>[] = [
  { key: 'code', header: 'کد', accessor: (a) => a.code },
  { key: 'name', header: 'نام', accessor: (a) => a.name },
  { key: 'type', header: 'نوع', accessor: (a) => a.type },
  { key: 'isActive', header: 'وضعیت', accessor: (a) => (a.isActive ? 'فعال' : 'غیرفعال') },
]

const ALL = 'all'

/**
 * Whether an account was opened inside the period. With no period set, every
 * account passes. An account with no recorded opening date cannot be placed in
 * ANY period, so a set period leaves it out rather than guessing.
 */
export function openedWithin(createdAt: string | null, from: string, to: string): boolean {
  if (!from && !to) return true
  if (!createdAt) return false
  const day = createdAt.slice(0, 10)
  return (!from || day >= from) && (!to || day <= to)
}

const COLUMNS: TableColumn<Account>[] = [
  {
    id: 'code',
    labelKey: 'accounting.accounts.code',
    labelFallback: 'کد',
    sortValue: (account) => account.code,
    render: (account) => (
      <span className="font-mono text-xs text-[hsl(var(--fg-secondary))]" dir="ltr">
        {account.code}
      </span>
    ),
  },
  {
    id: 'name',
    labelKey: 'accounting.accounts.name',
    labelFallback: 'نام',
    locked: true,
    sortValue: (account) => account.name,
    render: (account) => <span className="font-medium">{account.name}</span>,
  },
  {
    id: 'type',
    labelKey: 'accounting.accounts.type',
    labelFallback: 'نوع',
    sortValue: (account) => ACCOUNT_TYPES.indexOf(account.type as (typeof ACCOUNT_TYPES)[number]),
    render: (account) => <AccountTypeBadge type={account.type} />,
  },
  {
    id: 'status',
    labelKey: 'accounting.accounts.status',
    labelFallback: 'وضعیت',
    sortValue: (account) => (account.isActive ? 0 : 1),
    render: (account) => <AccountStatusMark isActive={account.isActive} />,
  },
]

export const AccountsTab = memo(function AccountsTab() {
  const t = useTranslations()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState(ALL)
  // Accounts OPENED in this period. Both empty = every account.
  const [openedFrom, setOpenedFrom] = useState('')
  const [openedTo, setOpenedTo] = useState('')
  const { data: accounts, isLoading } = useAccounts()
  const { mutate: createAccount, isPending } = useCreateAccount()

  // A missing key renders its fallback, never the key.
  const safeT = useCallback(
    (key: string, fallback?: string): string => {
      const value = t(key as never)
      return value && value !== key ? value : (fallback ?? key)
    },
    [t],
  )

  const parentOptions = useMemo(
    () => (accounts || []).map((a) => ({ id: a.id, label: `${a.code} - ${a.name}` })),
    [accounts],
  )

  const rows = useMemo(
    () =>
      (accounts ?? [])
        .filter((account) => typeFilter === ALL || account.type === typeFilter)
        .filter((account) => openedWithin(account.createdAt, openedFrom, openedTo))
        .filter((account) => matchesSearch(search, [account.code, account.name])),
    [accounts, search, typeFilter, openedFrom, openedTo],
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
        <div className="flex flex-wrap items-end justify-end gap-1.5 md:gap-2">
          <DateRangePicker
            from={openedFrom}
            to={openedTo}
            onFromChange={setOpenedFrom}
            onToChange={setOpenedTo}
          />
          {/* The export follows what is on screen: the same filters. */}
          <ExportButton data={rows} columns={exportColumns} filename="accounts" />
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

      <div className="flex-1 overflow-y-auto p-3 md:p-4">
        {isLoading ? (
          <AccountingSkeleton />
        ) : (
          <DataTable
            tableId="accounts"
            t={safeT}
            rows={rows}
            columns={COLUMNS}
            rowKey={(account) => account.id}
            searchValue={search}
            onSearchChange={setSearch}
            actions={
              <TableFilterSelect
                label={t('accounting.accounts.type')}
                value={typeFilter}
                onChange={setTypeFilter}
                allValue={ALL}
                options={[
                  { value: ALL, label: safeT('common.all', 'همه') },
                  ...ACCOUNT_TYPES.map((type) => ({
                    value: type as string,
                    label: t(`accounting.accountTypes.${type}`),
                  })),
                ]}
              />
            }
            minWidthClass="min-w-[420px]"
            emptyState={
              // «No accounts yet» only when there really are none; otherwise the
              // filter or the search emptied the table.
              (accounts ?? []).length === 0 ? (
                <AccountingEmptyState
                  title={t('accounting.accounts.empty.title')}
                  subtitle={t('accounting.accounts.empty.subtitle')}
                />
              ) : (
                <AccountingEmptyState
                  title={safeT('accounting.accounts.noMatch', 'حسابی با این فیلتر نیست')}
                />
              )
            }
          />
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
