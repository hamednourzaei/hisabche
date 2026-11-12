'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  apiErrorMessage,
  useBillContractPeriod,
  useContracts,
  useCreateContract,
  useFlagContractSlaBreach,
  useMyCapabilities,
  useReturnLeaseAsset,
  useServiceResources,
  useTerminateContract,
} from '@hisabche/api'
import {
  CONTRACT_CADENCES,
  CONTRACT_TYPES,
  RETURN_CONDITIONS,
  type ContractCadence,
  type ContractType,
} from '@hisabche/validation'

import { useBookCurrency } from '../../../hooks/use-book-currency'
import { useDateFormat } from '../../../hooks/use-date-format'
import { Button } from '../button'
import { DataTable, type TableColumn } from '../data-table'
import { EmptyState } from '../empty-state'
import { Input } from '../input'
import { SelectField } from '../select-field'
import { useToast } from '../toast-provider'
import { typedMinor, useCustomerOptions, useMoneyText } from '../business-packs/pack-shared'

interface ContractRow {
  id: string
  title: string
  contract_type: string
  status: string
  customer_id: string
  billing_cadence: string
  amount_minor: number
  deposit_minor: number
  sla_breached?: boolean | null
  resource_booking_id?: string | null
  serial_id?: string | null
  start_date?: string | null
}

function toIsoDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function ContractsSection() {
  const t = useTranslations()
  const tr = (key: string): string => t(key as never)
  const toast = useToast()
  const capabilities = useMyCapabilities()
  const bookCurrency = useBookCurrency()
  const money = useMoneyText()
  const { date: fmtDate } = useDateFormat()

  const canRead = capabilities.can('invoice.read') !== false
  const canWrite = capabilities.can('invoice.create') === true

  const contracts = useContracts()
  const partyOptions = useCustomerOptions()
  const resources = useServiceResources()

  const createContract = useCreateContract()
  const billPeriod = useBillContractPeriod()
  const terminateContract = useTerminateContract()
  const flagSla = useFlagContractSlaBreach()
  const returnLease = useReturnLeaseAsset()

  const [title, setTitle] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [contractType, setContractType] = useState<ContractType>('service')
  const [billingCadence, setBillingCadence] = useState<ContractCadence>('monthly')
  const [amountText, setAmountText] = useState('')
  const [depositText, setDepositText] = useState('')
  const [resourceBookingId, setResourceBookingId] = useState('')
  const [serialId, setSerialId] = useState('')
  const [startDate, setStartDate] = useState(() => toIsoDay(new Date()))
  const [search, setSearch] = useState('')

  const [periodKey, setPeriodKey] = useState(() => toIsoDay(new Date()).slice(0, 7))
  const [dueDate, setDueDate] = useState(() => toIsoDay(new Date()))
  const [slaReason, setSlaReason] = useState('')
  const [slaHours, setSlaHours] = useState('4')
  const [returnCond, setReturnCond] = useState<(typeof RETURN_CONDITIONS)[number]>('sealed')

  const resourceOptions = useMemo(() => {
    const raw = resources.data
    const list = Array.isArray(raw) ? raw : (raw?.resources ?? [])
    return list.map((r) => ({
      value: r.id,
      label: r.name,
    }))
  }, [resources.data])

  const rows = useMemo<ContractRow[]>(() => {
    const list = (contracts.data ?? []) as unknown as ContractRow[]
    if (!search.trim()) return list
    const q = search.trim().toLowerCase()
    return list.filter(
      (row) =>
        row.title.toLowerCase().includes(q) ||
        row.contract_type.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q),
    )
  }, [contracts.data, search])

  const handleCreate = async () => {
    if (!title.trim() || !customerId || !bookCurrency) return
    const amountMinor = typedMinor(amountText || '0', bookCurrency) ?? 0
    const depositMinor = typedMinor(depositText || '0', bookCurrency) ?? 0
    try {
      await createContract.mutateAsync({
        title: title.trim(),
        customerId,
        contractType,
        billingCadence,
        amountMinor,
        depositMinor,
        startDate,
        ...(resourceBookingId ? { resourceBookingId } : {}),
        ...(serialId.trim() ? { serialId: serialId.trim() } : {}),
      })
      setTitle('')
      setAmountText('')
      setDepositText('')
      setSerialId('')
      toast.success(tr('contracts.created'))
    } catch (err) {
      toast.error(apiErrorMessage(err, tr('contracts.createFailed')))
    }
  }

  if (!canRead) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border-default))] p-4 text-sm text-[hsl(var(--fg-secondary))]">
        {tr('contracts.noReadAccess')}
      </div>
    )
  }

  const columns: TableColumn<ContractRow>[] = [
    {
      id: 'title',
      labelKey: 'contracts.columns.title',
      labelFallback: tr('contracts.columns.title'),
      locked: true,
      sortValue: (row) => row.title,
      render: (row) => (
        <div className="space-y-0.5">
          <div className="font-medium text-[hsl(var(--fg-primary))]">{row.title}</div>
          <div className="text-xs text-[hsl(var(--fg-tertiary))]">
            {tr(`contracts.kind.${row.contract_type}`)} ·{' '}
            {tr(`contracts.period.${row.billing_cadence}`)}
          </div>
        </div>
      ),
    },
    {
      id: 'status',
      labelKey: 'contracts.columns.status',
      labelFallback: tr('contracts.columns.status'),
      sortValue: (row) => row.status,
      render: (row) => (
        <div className="space-y-0.5 text-xs">
          <span>{tr(`contracts.status.${row.status}`)}</span>
          {row.sla_breached ? (
            <div className="font-medium text-[hsl(var(--color-destructive))]">
              {tr('contracts.slaBreached')}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: 'amount',
      labelKey: 'contracts.columns.amount',
      labelFallback: tr('contracts.columns.amount'),
      align: 'end',
      sortValue: (row) => row.amount_minor,
      render: (row) => (
        <span className="tabular-nums">
          {bookCurrency ? money(row.amount_minor, bookCurrency) : '—'}
        </span>
      ),
    },
    {
      id: 'startDate',
      labelKey: 'contracts.columns.startDate',
      labelFallback: tr('contracts.columns.startDate'),
      showFrom: 'md',
      sortValue: (row) => row.start_date ?? '',
      render: (row) => <span>{row.start_date ? fmtDate(row.start_date) : '—'}</span>,
    },
    ...(canWrite
      ? [
          {
            id: 'actions',
            labelKey: 'contracts.columns.actions',
            labelFallback: tr('contracts.columns.actions'),
            render: (row: ContractRow) => (
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={billPeriod.isPending || row.status !== 'active'}
                  onClick={async () => {
                    try {
                      await billPeriod.mutateAsync({ id: row.id, periodKey, dueDate })
                      toast.success(tr('contracts.billedSuccess'))
                    } catch (err) {
                      toast.error(apiErrorMessage(err, tr('contracts.actionFailed')))
                    }
                  }}
                >
                  {tr('contracts.actions.billPeriod')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={flagSla.isPending}
                  onClick={async () => {
                    try {
                      await flagSla.mutateAsync({
                        id: row.id,
                        reason: slaReason.trim() || tr('contracts.slaDefaultReason'),
                        elapsedHours: Number(slaHours) || 1,
                      })
                      toast.success(tr('contracts.slaFlagged'))
                    } catch (err) {
                      toast.error(apiErrorMessage(err, tr('contracts.actionFailed')))
                    }
                  }}
                >
                  {tr('contracts.actions.flagSla')}
                </Button>
                {row.contract_type === 'lease' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={returnLease.isPending || row.status !== 'active'}
                    onClick={async () => {
                      try {
                        await returnLease.mutateAsync({
                          id: row.id,
                          conditionCode: returnCond,
                        })
                        toast.success(tr('contracts.leaseReturned'))
                      } catch (err) {
                        toast.error(apiErrorMessage(err, tr('contracts.actionFailed')))
                      }
                    }}
                  >
                    {tr('contracts.actions.leaseReturn')}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={terminateContract.isPending || row.status !== 'active'}
                  onClick={async () => {
                    try {
                      await terminateContract.mutateAsync(row.id)
                      toast.success(tr('contracts.terminated'))
                    } catch (err) {
                      toast.error(apiErrorMessage(err, tr('contracts.actionFailed')))
                    }
                  }}
                >
                  {tr('contracts.actions.terminate')}
                </Button>
              </div>
            ),
          } satisfies TableColumn<ContractRow>,
        ]
      : []),
  ]

  return (
    <div className="space-y-4" data-contracts-section="">
      {canWrite && (
        <div className="space-y-3 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4">
          <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {tr('contracts.createTitle')}
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tr('contracts.fields.title')}
            />
            <SelectField
              value={customerId}
              onChange={setCustomerId}
              options={partyOptions}
              placeholder={tr('contracts.fields.party')}
              searchable
            />
            <SelectField
              value={contractType}
              onChange={(v) => setContractType(v as ContractType)}
              options={CONTRACT_TYPES.map((k: ContractType) => ({
                value: k,
                label: tr(`contracts.kind.${k}`),
              }))}
            />
            <SelectField
              value={billingCadence}
              onChange={(v) => setBillingCadence(v as ContractCadence)}
              options={CONTRACT_CADENCES.map((p: ContractCadence) => ({
                value: p,
                label: tr(`contracts.period.${p}`),
              }))}
            />
            <Input
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder={`${tr('contracts.fields.amount')} (${bookCurrency ?? ''})`}
            />
            <Input
              inputMode="decimal"
              value={depositText}
              onChange={(e) => setDepositText(e.target.value)}
              placeholder={`${tr('contracts.fields.deposit')} (${bookCurrency ?? ''})`}
            />
            {contractType === 'lease' && (
              <>
                <SelectField
                  value={resourceBookingId}
                  onChange={setResourceBookingId}
                  options={resourceOptions}
                  placeholder={tr('contracts.fields.resource')}
                  searchable
                />
                <Input
                  value={serialId}
                  onChange={(e) => setSerialId(e.target.value)}
                  placeholder={tr('contracts.fields.serialId')}
                />
              </>
            )}
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Input
                className="w-32"
                value={periodKey}
                onChange={(e) => setPeriodKey(e.target.value)}
                placeholder={tr('contracts.fields.periodKey')}
              />
              <Input
                type="date"
                className="w-36"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <Input
                className="w-40"
                value={slaReason}
                onChange={(e) => setSlaReason(e.target.value)}
                placeholder={tr('contracts.fields.slaReason')}
              />
              <Input
                className="w-20"
                inputMode="numeric"
                value={slaHours}
                onChange={(e) => setSlaHours(e.target.value)}
              />
              <SelectField
                className="w-36"
                value={returnCond}
                onChange={(v) => setReturnCond(v as (typeof RETURN_CONDITIONS)[number])}
                options={RETURN_CONDITIONS.map((c) => ({
                  value: c,
                  label: tr(`contracts.returnCondition.${c}`),
                }))}
              />
            </div>
            <Button
              size="sm"
              disabled={createContract.isPending || !title.trim() || !customerId || !bookCurrency}
              onClick={() => void handleCreate()}
            >
              {tr('contracts.actions.create')}
            </Button>
          </div>
        </div>
      )}

      {contracts.isLoading ? (
        <p role="status" className="p-4 text-sm text-[hsl(var(--fg-secondary))]">
          {tr('common.loading')}
        </p>
      ) : contracts.isError ? (
        <div
          role="alert"
          className="rounded-xl border border-[hsl(var(--color-destructive))] p-4 text-sm text-[hsl(var(--color-destructive))]"
        >
          {apiErrorMessage(contracts.error, tr('contracts.loadFailed'))}
        </div>
      ) : (
        <DataTable
          tableId="customers-contracts"
          t={tr}
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          searchValue={search}
          onSearchChange={setSearch}
          emptyState={
            <EmptyState
              title={tr('contracts.emptyTitle')}
              description={tr('contracts.emptyDescription')}
            />
          }
        />
      )}
    </div>
  )
}
