'use client'
// ============================================
// «چک‌ها» — the cheque register in Accounting › Treasury (V61 B.2.5).
//
// A cheque is a promise, not cash. Its state moves the money, on the server:
//   received → deposited → cleared | bounced     (incoming)
//   received → endorsed (to a supplier) → cleared | bounced
//   issued   → cleared | bounced                 (outgoing)
// ⚠️ A BOUNCE reverses the linked payment (the receivable comes back); an
//    ENDORSEMENT records ONE payment to the supplier (idempotent on the server).
// ⚠️ The buttons offered are exactly the moves `canTransitionCheque` allows —
//    the same rule the server enforces; nothing here decides on its own.
// ⚠️ Amounts are entered in the CHEQUE's currency, as minor units of that
//    currency (`typedMinor`), never "× 100".
// ============================================
import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiErrorMessage, useCheques, useCreateCheque, useTransitionCheque } from '@hisabche/api'
import {
  CHEQUE_STATUSES,
  CURRENCY_CODES,
  canTransitionCheque,
  type ChequeStatus,
} from '@hisabche/validation'
import { toIsoDay } from '@hisabche/formatting'

import { useBookCurrency } from '../../../../hooks/use-book-currency'
import { useDateFormat } from '../../../../hooks/use-date-format'
import { Button } from '../../button'
import { DataTable, type TableColumn } from '../../data-table'
import { EmptyState } from '../../empty-state'
import { Input } from '../../input'
import { JalaliDatePicker } from '../../jalali-datepicker'
import { SelectField } from '../../select-field'
import { useToast } from '../../toast-provider'
import {
  LabeledSelect,
  typedMinor,
  useCustomerOptions,
  useMoneyText,
} from '../../business-packs/pack-shared'
import { useTableLabel } from '../../erp-core/erp-shared'

/** Refusals this screen can explain; anything else gets the general sentence. */
export const CHEQUE_ERROR_CODES = [
  'CHEQUE_ILLEGAL_TRANSITION',
  'CHEQUE_ENDORSED_CANNOT_DEPOSIT',
  'CHEQUE_DIRECTION_INVALID_FOR_TRANSITION',
  'ENDORSED_SUPPLIER_REQUIRED',
  'CHEQUE_ALREADY_ENDORSED',
  'CHEQUE_CHANGED',
] as const

export interface ChequeRow {
  id: string
  direction: 'in' | 'out'
  status: ChequeStatus
  chequeNumber: string
  bankName: string | null
  dueDate: string
  amountMinor: number
  currency: string
}

/** The API returns raw rows; read each field, never trust the shape. */
export function toChequeRow(raw: Record<string, unknown>): ChequeRow | null {
  const status = String(raw.status ?? '')
  const direction = raw.direction === 'out' ? 'out' : raw.direction === 'in' ? 'in' : null
  if (typeof raw.id !== 'string' || !direction) return null
  if (!(CHEQUE_STATUSES as readonly string[]).includes(status)) return null
  return {
    id: raw.id,
    direction,
    status: status as ChequeStatus,
    chequeNumber: String(raw.cheque_number ?? ''),
    bankName: typeof raw.bank_name === 'string' ? raw.bank_name : null,
    dueDate: String(raw.due_date ?? ''),
    amountMinor: Number(raw.amount_minor ?? 0),
    currency: String(raw.currency ?? ''),
  }
}

/** The next states the shared rule allows for this cheque. */
export function nextChequeStates(row: Pick<ChequeRow, 'status' | 'direction'>): ChequeStatus[] {
  return CHEQUE_STATUSES.filter(
    (to) => to !== row.status && canTransitionCheque(row.status, to, row.direction).ok,
  )
}

export function ChequesTab() {
  const t = useTranslations('cheques')
  const tr = (key: string): string => t(key as Parameters<typeof t>[0])
  // The table's column keys are FULL keys («cheques.columns.number»); a reader
  // scoped to «cheques» looked up «cheques.cheques.…» and threw (12 Nov 2026).
  const label = useTableLabel()
  const tCurrency = useTranslations('currency')
  const toast = useToast()
  const { date } = useDateFormat()
  const money = useMoneyText()
  const bookCurrency = useBookCurrency()
  const parties = useCustomerOptions()

  const [statusFilter, setStatusFilter] = useState<string>('')
  const cheques = useCheques(statusFilter || undefined)
  const create = useCreateCheque()
  const transition = useTransitionCheque()

  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [number, setNumber] = useState('')
  const [bank, setBank] = useState('')
  const [dueDate, setDueDate] = useState(() => toIsoDay(new Date()))
  const [amountText, setAmountText] = useState('')
  const [currency, setCurrency] = useState<string>('')
  const [endorseFor, setEndorseFor] = useState<string | null>(null)
  const [endorseTo, setEndorseTo] = useState('')
  const [search, setSearch] = useState('')

  const chosenCurrency = currency || bookCurrency || ''

  const errorText = (error: unknown): string => {
    const raw = apiErrorMessage(error, '')
    const code = CHEQUE_ERROR_CODES.find((known) => raw.includes(known))
    return code ? tr(`errors.${code}`) : tr('errors.general')
  }

  const rows = useMemo(
    () =>
      (cheques.data ?? [])
        .map(toChequeRow)
        .filter((r): r is ChequeRow => r !== null)
        .filter((r) =>
          search.trim()
            ? `${r.chequeNumber} ${r.bankName ?? ''}`.toLowerCase().includes(search.toLowerCase())
            : true,
        ),
    [cheques.data, search],
  )

  const move = (row: ChequeRow, to: ChequeStatus) => {
    if (to === 'endorsed') {
      setEndorseFor(row.id)
      return
    }
    transition.mutate(
      { id: row.id, status: to },
      {
        onSuccess: () => toast.success(tr('moved')),
        onError: (e) => toast.error(errorText(e)),
      },
    )
  }

  const columns: TableColumn<ChequeRow>[] = [
    {
      id: 'number',
      labelKey: 'cheques.columns.number',
      labelFallback: 'شماره',
      locked: true,
      render: (r) => <span dir="ltr">{r.chequeNumber}</span>,
    },
    {
      id: 'direction',
      labelKey: 'cheques.columns.direction',
      labelFallback: 'نوع',
      render: (r) => tr(`direction.${r.direction}`),
    },
    {
      id: 'bank',
      labelKey: 'cheques.columns.bank',
      labelFallback: 'بانک',
      showFrom: 'md',
      render: (r) => r.bankName ?? '—',
    },
    {
      id: 'due',
      labelKey: 'cheques.columns.due',
      labelFallback: 'سررسید',
      render: (r) => (r.dueDate ? date(r.dueDate) : '—'),
      sortValue: (r) => r.dueDate,
    },
    {
      id: 'amount',
      labelKey: 'cheques.columns.amount',
      labelFallback: 'مبلغ',
      align: 'end',
      render: (r) => money(r.amountMinor, r.currency),
      sortValue: (r) => r.amountMinor,
    },
    {
      id: 'status',
      labelKey: 'cheques.columns.status',
      labelFallback: 'وضعیت',
      render: (r) => tr(`status.${r.status}`),
    },
    {
      id: 'actions',
      labelKey: 'cheques.columns.actions',
      labelFallback: 'اقدام',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {nextChequeStates(r).map((to) => (
            <Button
              key={to}
              size="sm"
              variant={to === 'bounced' || to === 'cancelled' ? 'outline' : 'default'}
              disabled={transition.isPending}
              onClick={() => move(r, to)}
            >
              {tr(`actions.${to}`)}
            </Button>
          ))}
        </div>
      ),
    },
  ]

  const submit = () => {
    const amountMinor = typedMinor(amountText, chosenCurrency)
    if (!number.trim() || !amountMinor || amountMinor <= 0 || !chosenCurrency) {
      toast.error(tr('errors.formIncomplete'))
      return
    }
    create.mutate(
      {
        direction,
        cheque_number: number.trim(),
        ...(bank.trim() ? { bank_name: bank.trim() } : {}),
        due_date: dueDate,
        amount_minor: amountMinor,
        currency: chosenCurrency,
      },
      {
        onSuccess: () => {
          setNumber('')
          setBank('')
          setAmountText('')
          toast.success(tr('saved'))
        },
        onError: (e) => toast.error(errorText(e)),
      },
    )
  }

  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-[hsl(var(--fg-secondary))]">{tr('intro')}</p>

      <div className="grid gap-3 rounded-2xl border border-[hsl(var(--border-default))] p-4 sm:grid-cols-3">
        <LabeledSelect
          name="direction"
          label={tr('form.direction')}
          value={direction}
          onChange={(v) => setDirection(v === 'out' ? 'out' : 'in')}
          options={[
            { value: 'in', label: tr('direction.in') },
            { value: 'out', label: tr('direction.out') },
          ]}
        />
        <label className="space-y-1 text-xs text-[hsl(var(--fg-secondary))]">
          {tr('form.number')}
          <Input
            name="cheque_number"
            dir="ltr"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-xs text-[hsl(var(--fg-secondary))]">
          {tr('form.bank')}
          <Input name="bank_name" value={bank} onChange={(e) => setBank(e.target.value)} />
        </label>
        <div className="space-y-1 text-xs text-[hsl(var(--fg-secondary))]" data-field="due_date">
          {tr('form.due')}
          <JalaliDatePicker value={dueDate} onChange={setDueDate} />
        </div>
        <label className="space-y-1 text-xs text-[hsl(var(--fg-secondary))]">
          {tr('form.amount')}
          <Input
            name="amount_minor"
            inputMode="decimal"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
          />
        </label>
        <LabeledSelect
          name="currency"
          label={tr('form.currency')}
          value={chosenCurrency}
          onChange={setCurrency}
          options={CURRENCY_CODES.map((code) => ({
            value: code,
            label: `${tCurrency(code.toLowerCase())} (${code})`,
          }))}
        />
        <div className="sm:col-span-3">
          <Button size="sm" disabled={create.isPending} onClick={submit}>
            {tr('form.save')}
          </Button>
        </div>
      </div>

      {endorseFor ? (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-[hsl(var(--border-default))] p-4">
          <LabeledSelect
            name="endorsed_to_supplier_id"
            label={tr('endorse.to')}
            value={endorseTo}
            onChange={setEndorseTo}
            options={parties}
          />
          <Button
            size="sm"
            disabled={!endorseTo || transition.isPending}
            onClick={() =>
              transition.mutate(
                { id: endorseFor, status: 'endorsed', endorsed_to_supplier_id: endorseTo },
                {
                  onSuccess: () => {
                    setEndorseFor(null)
                    setEndorseTo('')
                    toast.success(tr('moved'))
                  },
                  onError: (e) => toast.error(errorText(e)),
                },
              )
            }
          >
            {tr('endorse.confirm')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEndorseFor(null)}>
            {tr('endorse.cancel')}
          </Button>
        </div>
      ) : null}

      {cheques.isLoading ? (
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{tr('loading')}</p>
      ) : cheques.isError ? (
        <div
          role="alert"
          className="rounded-xl border border-[hsl(var(--color-destructive))] p-3 text-sm"
        >
          {tr('loadFailed')}{' '}
          <Button size="sm" variant="outline" onClick={() => void cheques.refetch()}>
            {tr('retry')}
          </Button>
        </div>
      ) : (
        <DataTable
          tableId="accounting-cheques"
          t={label}
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          searchValue={search}
          onSearchChange={setSearch}
          actions={
            <SelectField
              name="statusFilter"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: '', label: tr('filter.all') },
                ...CHEQUE_STATUSES.map((s) => ({ value: s, label: tr(`status.${s}`) })),
              ]}
            />
          }
          emptyState={<EmptyState title={tr('emptyTitle')} description={tr('emptyDescription')} />}
        />
      )}
    </div>
  )
}
