'use client'

// ============================================
// «صرافی» — the money changer's desk (QA document §10, 10 Nov 2026).
//
//   trades       buy / sell foreign currency at a rate copied onto the trade;
//                selling more than is held is refused by the database
//   rates        the shop's buy and sell price per currency (history kept)
//   positions    what is held of each currency, at what average cost, what
//                sales earned above it, and the book-currency cash effect
//   remittances  hawala out / in, with a payout code shown once
//
// ⚠️ Stated on the screen: none of this posts to the general ledger or a
// till yet (the ledger is single-currency) — the QA document's own rule.
// ============================================

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import {
  useCreateFxTrade,
  useCreateRemittance,
  useFxPositions,
  useFxRates,
  useFxSettings,
  useFxTrades,
  useMoveRemittance,
  usePartnerBalances,
  useRemittances,
  useSaveFxSettings,
  useSetFxRate,
  useVoidFxTrade,
  type FxPosition,
  type FxTrade,
  type Remittance,
} from '@hisabche/api'
import {
  convertAtRate,
  currencyCodeSchema,
  FX_ID_TYPES,
  identityRequired,
  parseRate,
  REMITTANCE_MOVES,
  type FxSide,
  type RemittanceDirection,
} from '@hisabche/validation'

import { Button } from '../button'
import { Input } from '../input'
import { SelectField } from '../select-field'
import { SegmentedControl } from '../segmented-control'
import { DataTable, type TableColumn } from '../data-table'
import { useToast } from '../toast-provider'
import { refusalText } from '../../../lib/refusal-text'
import { useDateFormat } from '../../../hooks/use-date-format'
import {
  labelOf,
  NotReady,
  packCard,
  typedMinor,
  useCustomerOptions,
  useMoneyText,
  usePackT,
} from './pack-shared'

export const EXCHANGE_VIEWS = ['trades', 'rates', 'positions', 'remittances'] as const
export type ExchangeView = (typeof EXCHANGE_VIEWS)[number]

const ERRORS = [
  'FX_POSITION_SHORT',
  'FX_KYC_REQUIRED',
  'FX_SAME_AS_BOOK_CURRENCY',
  'FX_RATE_SPREAD_NEGATIVE',
  'FX_RATE_INVALID',
  'FX_VOID_WOULD_GO_SHORT',
  'FX_ALREADY_VOIDED',
  'FX_NOT_READY',
  'REMITTANCE_CODE_REQUIRED',
  'REMITTANCE_CODE_WRONG',
  'REMITTANCE_CANCEL_REASON_REQUIRED',
  'REMITTANCE_CHANGED',
  'REMITTANCE_MOVE_NOT_ALLOWED',
]

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

function IdentityFields({
  value,
  onChange,
}: {
  value: { fullName: string; idType: string; idNumber: string }
  onChange: (next: { fullName: string; idType: string; idNumber: string }) => void
}) {
  const t = usePackT()
  return (
    <div className="sm:col-span-2 grid gap-2 rounded-xl border border-[hsl(var(--color-warning))] p-3 sm:grid-cols-3">
      <p className="sm:col-span-3 text-xs">
        {t('exchange.kycNeeded', 'این مبلغ از حد تعیین‌شده بیشتر است؛ مشخصات شناسایی لازم است.')}
      </p>
      <Input
        name="identity.fullName"
        value={value.fullName}
        placeholder={t('exchange.fullName', 'نام کامل')}
        onChange={(e) => onChange({ ...value, fullName: e.target.value })}
      />
      <SelectField
        name="identity.idType"
        value={value.idType}
        onChange={(v) => onChange({ ...value, idType: v })}
        options={FX_ID_TYPES.map((v) => ({ value: v, label: t(`exchange.idTypes.${v}`, v) }))}
      />
      <Input
        name="identity.idNumber"
        value={value.idNumber}
        placeholder={t('exchange.idNumber', 'شماره سند')}
        onChange={(e) => onChange({ ...value, idNumber: e.target.value })}
      />
    </div>
  )
}

function TradesView({ book, threshold }: { book: string; threshold: number | null }) {
  const t = usePackT()
  const toast = useToast()
  const money = useMoneyText()
  const { date } = useDateFormat()
  const trades = useFxTrades()
  const rates = useFxRates()
  const create = useCreateFxTrade()
  const voidTrade = useVoidFxTrade()
  const customers = useCustomerOptions()

  const [side, setSide] = useState<FxSide>('buy')
  const [currency, setCurrency] = useState('USD')
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [identity, setIdentity] = useState({ fullName: '', idType: 'national_id', idNumber: '' })
  const [requestId, setRequestId] = useState(newKey)
  const [voiding, setVoiding] = useState<FxTrade | null>(null)
  const [reason, setReason] = useState('')

  // The board's price for this side, offered — the person may still type another.
  const board = rates.data?.rates.find((r) => r.currency === currency)
  const suggested = board ? (side === 'sell' ? board.sellRate : board.buyRate) : ''
  const rateText = rate || suggested
  const amountMinor = typedMinor(amount, currency)
  const micro = rateText ? parseRate(rateText) : null
  const bookMinor =
    amountMinor !== null && micro !== null
      ? convertAtRate(amountMinor, micro, currency, book)
      : null
  const needsId = side !== 'opening' && bookMinor !== null && identityRequired(threshold, bookMinor)

  const submit = () => {
    if (amountMinor === null || micro === null) return
    create.mutate(
      {
        requestId,
        side,
        currency,
        amountMinor,
        rate: rateText,
        ...(customerId && side !== 'opening' ? { customerId } : {}),
        ...(needsId
          ? { identity: { ...identity, idType: identity.idType as (typeof FX_ID_TYPES)[number] } }
          : {}),
      },
      {
        onSuccess: () => {
          toast.success(t('exchange.tradeSaved', 'معامله ثبت شد'))
          setAmount('')
          setRate('')
          setRequestId(newKey())
        },
        onError: (e) =>
          toast.error(refusalText(e, t, 'exchange', ERRORS, t('exchange.failed', 'انجام نشد'))),
      },
    )
  }

  const columns: TableColumn<FxTrade>[] = [
    {
      id: 'number',
      labelKey: 'exchange.number',
      labelFallback: 'شماره',
      locked: true,
      render: (r) => `#${r.number}`,
    },
    {
      id: 'side',
      labelKey: 'exchange.side',
      labelFallback: 'نوع',
      render: (r) => t(`exchange.sides.${r.side}`, r.side),
    },
    {
      id: 'amount',
      labelKey: 'exchange.amount',
      labelFallback: 'مبلغ ارز',
      align: 'end',
      render: (r) => money(r.amountMinor, r.currency),
    },
    {
      id: 'rate',
      labelKey: 'exchange.rate',
      labelFallback: 'نرخ',
      align: 'end',
      render: (r) => r.rate,
    },
    {
      id: 'book',
      labelKey: 'exchange.bookAmount',
      labelFallback: 'معادل',
      align: 'end',
      render: (r) => money(r.bookAmountMinor, r.bookCurrency),
    },
    {
      id: 'customer',
      labelKey: 'exchange.customer',
      labelFallback: 'مشتری',
      showFrom: 'md',
      render: (r) => (r.customerId ? labelOf(customers, r.customerId) : (r.identityName ?? '—')),
    },
    {
      id: 'date',
      labelKey: 'exchange.date',
      labelFallback: 'تاریخ',
      showFrom: 'md',
      render: (r) => date(r.createdAt),
    },
    {
      id: 'status',
      labelKey: 'exchange.status',
      labelFallback: 'وضعیت',
      locked: true,
      render: (r) =>
        r.status === 'voided' ? (
          <span title={r.voidReason ?? ''}>{t('exchange.voided', 'باطل')}</span>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setVoiding(r)}>
            {t('exchange.void', 'ابطال')}
          </Button>
        ),
    },
  ]

  return (
    <div className="space-y-3">
      <div className={`${packCard} grid gap-3 sm:grid-cols-2`}>
        <SegmentedControl
          label={t('exchange.side', 'نوع')}
          options={(['buy', 'sell', 'opening'] as const).map((value) => ({
            value,
            label: t(`exchange.sides.${value}`, value),
          }))}
          value={side}
          onChange={(v) => setSide(v as FxSide)}
        />
        <SelectField
          name="currency"
          value={currency}
          onChange={setCurrency}
          options={currencyCodeSchema.options
            .filter((c) => c !== book)
            .map((c) => ({ value: c, label: c }))}
        />
        <Input
          name="amountMinor"
          inputMode="decimal"
          value={amount}
          placeholder={`${t('exchange.amount', 'مبلغ ارز')} (${currency})`}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Input
          name="rate"
          inputMode="decimal"
          value={rate}
          placeholder={
            suggested ? `${t('exchange.rate', 'نرخ')}: ${suggested}` : t('exchange.rate', 'نرخ')
          }
          onChange={(e) => setRate(e.target.value)}
        />
        {side !== 'opening' ? (
          <SelectField
            name="customerId"
            value={customerId}
            placeholder={t('exchange.customerOptional', 'مشتری (اختیاری)')}
            onChange={setCustomerId}
            options={customers}
          />
        ) : null}
        <p className="self-center text-sm">
          {bookMinor !== null
            ? `${t('exchange.equals', 'معادل')}: ${money(bookMinor, book)}`
            : t('exchange.typeAmount', 'مبلغ و نرخ را وارد کنید')}
        </p>
        {needsId ? <IdentityFields value={identity} onChange={setIdentity} /> : null}
        <div className="sm:col-span-2">
          <Button
            onClick={submit}
            disabled={amountMinor === null || micro === null || create.isPending}
          >
            {t('exchange.record', 'ثبت معامله')}
          </Button>
        </div>
      </div>

      {voiding ? (
        <div className={`${packCard} flex flex-wrap items-center gap-2`}>
          <Input
            className="flex-1"
            name="reason"
            value={reason}
            placeholder={t('exchange.voidReason', 'چرا باطل می‌شود؟')}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            size="sm"
            variant="destructive"
            disabled={reason.trim().length < 3 || voidTrade.isPending}
            onClick={() =>
              voidTrade.mutate(
                { id: voiding.id, reason: reason.trim() },
                {
                  onSuccess: () => {
                    setVoiding(null)
                    setReason('')
                  },
                  onError: (e) =>
                    toast.error(
                      refusalText(e, t, 'exchange', ERRORS, t('exchange.failed', 'انجام نشد')),
                    ),
                },
              )
            }
          >
            {t('exchange.void', 'ابطال')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setVoiding(null)}>
            {t('exchange.close', 'انصراف')}
          </Button>
        </div>
      ) : null}

      <DataTable
        tableId="fx-trades"
        t={t}
        rows={trades.data?.trades ?? []}
        columns={columns}
        rowKey={(r) => r.id}
        emptyState={
          <p className="p-4 text-sm">{t('exchange.noTrades', 'هنوز معامله‌ای ثبت نشده.')}</p>
        }
      />
    </div>
  )
}

function RatesView({ book, threshold }: { book: string; threshold: number | null }) {
  const t = usePackT()
  const toast = useToast()
  const money = useMoneyText()
  const { date } = useDateFormat()
  const rates = useFxRates()
  const setRate = useSetFxRate()
  const saveSettings = useSaveFxSettings()
  const [currency, setCurrency] = useState('USD')
  const [buy, setBuy] = useState('')
  const [sell, setSell] = useState('')
  const [limit, setLimit] = useState(threshold === null ? '' : String(threshold))

  const fail = (e: unknown) =>
    toast.error(refusalText(e, t, 'exchange', ERRORS, t('exchange.failed', 'انجام نشد')))

  return (
    <div className="space-y-3">
      <div className={`${packCard} flex flex-wrap items-end gap-2`}>
        <SelectField
          name="currency"
          value={currency}
          onChange={setCurrency}
          options={currencyCodeSchema.options
            .filter((c) => c !== book)
            .map((c) => ({ value: c, label: c }))}
        />
        <Input
          name="buyRate"
          className="w-32"
          inputMode="decimal"
          value={buy}
          placeholder={t('exchange.buyRate', 'خرید')}
          onChange={(e) => setBuy(e.target.value)}
        />
        <Input
          name="sellRate"
          className="w-32"
          inputMode="decimal"
          value={sell}
          placeholder={t('exchange.sellRate', 'فروش')}
          onChange={(e) => setSell(e.target.value)}
        />
        <Button
          size="sm"
          disabled={!buy || !sell || setRate.isPending}
          onClick={() =>
            setRate.mutate(
              { currency, buyRate: buy, sellRate: sell },
              {
                onSuccess: () => {
                  setBuy('')
                  setSell('')
                },
                onError: fail,
              },
            )
          }
        >
          {t('exchange.setRate', 'ثبت نرخ')}
        </Button>
      </div>
      <DataTable
        tableId="fx-rates"
        t={t}
        rows={rates.data?.rates ?? []}
        rowKey={(r) => r.currency}
        paginate={false}
        columns={[
          {
            id: 'currency',
            labelKey: 'exchange.currency',
            labelFallback: 'ارز',
            locked: true,
            render: (r) => r.currency,
          },
          {
            id: 'buy',
            labelKey: 'exchange.buyRate',
            labelFallback: 'خرید',
            align: 'end',
            render: (r) => r.buyRate,
          },
          {
            id: 'sell',
            labelKey: 'exchange.sellRate',
            labelFallback: 'فروش',
            align: 'end',
            render: (r) => r.sellRate,
          },
          {
            id: 'at',
            labelKey: 'exchange.setAt',
            labelFallback: 'به‌روز شده',
            render: (r) => date(r.setAt),
          },
        ]}
        emptyState={<p className="p-4 text-sm">{t('exchange.noRates', 'نرخی ثبت نشده.')}</p>}
      />
      <div className={`${packCard} flex flex-wrap items-end gap-2`}>
        <label className="flex-1 space-y-1 text-sm">
          <span className="text-[hsl(var(--fg-secondary))]">
            {t(
              'exchange.kycLimit',
              'حد مبلغی که بالاتر از آن مشخصات شناسایی لازم است (خالی = هرگز)',
            )}{' '}
            — {book}
          </span>
          <Input
            name="kycThresholdMinor"
            inputMode="decimal"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </label>
        <Button
          size="sm"
          variant="outline"
          disabled={saveSettings.isPending}
          onClick={() => {
            const minor = limit.trim() ? typedMinor(limit, book) : null
            saveSettings.mutate(
              { kycThresholdMinor: minor && minor > 0 ? minor : null },
              {
                onSuccess: () => toast.success(t('exchange.settingsSaved', 'ذخیره شد')),
                onError: fail,
              },
            )
          }}
        >
          {t('exchange.saveLimit', 'ذخیره‌ی حد')}
        </Button>
        {threshold !== null ? (
          <p className="w-full text-xs text-[hsl(var(--fg-secondary))]">
            {t('exchange.currentLimit', 'حد فعلی')}: {money(threshold, book)}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function PositionsView() {
  const t = usePackT()
  const money = useMoneyText()
  const positions = useFxPositions()
  const book = positions.data?.bookCurrency ?? ''
  const columns: TableColumn<FxPosition>[] = [
    {
      id: 'currency',
      labelKey: 'exchange.currency',
      labelFallback: 'ارز',
      locked: true,
      render: (r) => r.currency,
    },
    {
      id: 'held',
      labelKey: 'exchange.held',
      labelFallback: 'موجودی',
      align: 'end',
      render: (r) => money(r.heldMinor, r.currency),
    },
    {
      id: 'avg',
      labelKey: 'exchange.averageRate',
      labelFallback: 'میانگین بها',
      align: 'end',
      render: (r) => r.averageRate ?? '—',
    },
    {
      id: 'cost',
      labelKey: 'exchange.cost',
      labelFallback: 'بهای موجودی',
      align: 'end',
      render: (r) => (book ? money(r.costMinor, book) : '—'),
    },
    {
      id: 'realized',
      labelKey: 'exchange.realized',
      labelFallback: 'سود محقق‌شده',
      align: 'end',
      render: (r) => (book ? money(r.realizedMinor, book) : '—'),
    },
    {
      id: 'short',
      labelKey: 'exchange.short',
      labelFallback: 'کسری',
      showFrom: 'md',
      align: 'end',
      render: (r) => (r.shortMinor > 0 ? money(r.shortMinor, r.currency) : '—'),
    },
  ]
  return (
    <div className="space-y-3">
      <DataTable
        tableId="fx-positions"
        t={t}
        rows={positions.data?.positions ?? []}
        columns={columns}
        rowKey={(r) => r.currency}
        paginate={false}
        emptyState={
          <p className="p-4 text-sm">{t('exchange.noPositions', 'هنوز ارزی نگه داشته نمی‌شود.')}</p>
        }
      />
      {book ? (
        <p className="text-sm">
          {t('exchange.bookCash', 'اثر معاملات روی نقد به ارز دفاتر')}:{' '}
          <b>{money(positions.data?.bookCashMinor ?? 0, book)}</b>
        </p>
      ) : null}
    </div>
  )
}

function RemittancesView({ book, threshold }: { book: string; threshold: number | null }) {
  const t = usePackT()
  const toast = useToast()
  const money = useMoneyText()
  const { date } = useDateFormat()
  const list = useRemittances()
  const balances = usePartnerBalances()
  const create = useCreateRemittance()
  const move = useMoveRemittance()
  const [direction, setDirection] = useState<RemittanceDirection>('outgoing')
  const [form, setForm] = useState({
    counterparty: '',
    senderName: '',
    receiverName: '',
    receiverPhone: '',
    destination: '',
    currency: book || 'USD',
    amount: '',
    fee: '',
    payoutCode: '',
  })
  const [identity, setIdentity] = useState({ fullName: '', idType: 'national_id', idNumber: '' })
  const [withId, setWithId] = useState(false)
  const [shownCode, setShownCode] = useState<string | null>(null)
  const [requestId, setRequestId] = useState(newKey)
  const [acting, setActing] = useState<{ row: Remittance; to: 'paid' | 'cancelled' } | null>(null)
  const [actText, setActText] = useState('')
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  const amountMinor = typedMinor(form.amount, form.currency)
  const feeMinor = form.fee.trim() ? typedMinor(form.fee, form.currency) : 0
  // Only the same currency as the books can be compared here; the server decides the rest.
  const mustId =
    form.currency === book && amountMinor !== null && identityRequired(threshold, amountMinor)
  const fail = (e: unknown) =>
    toast.error(refusalText(e, t, 'exchange', ERRORS, t('exchange.failed', 'انجام نشد')))

  const submit = () => {
    if (amountMinor === null || feeMinor === null) return
    create.mutate(
      {
        requestId,
        direction,
        counterparty: form.counterparty.trim(),
        senderName: form.senderName.trim(),
        receiverName: form.receiverName.trim(),
        ...(form.receiverPhone.trim() ? { receiverPhone: form.receiverPhone.trim() } : {}),
        ...(form.destination.trim() ? { destination: form.destination.trim() } : {}),
        currency: form.currency,
        amountMinor,
        feeMinor,
        ...(direction === 'incoming' ? { payoutCode: form.payoutCode.trim() } : {}),
        ...(mustId || withId
          ? { identity: { ...identity, idType: identity.idType as (typeof FX_ID_TYPES)[number] } }
          : {}),
      },
      {
        onSuccess: (result) => {
          setShownCode(result.payoutCode ?? null)
          setRequestId(newKey())
          setForm((f) => ({
            ...f,
            amount: '',
            fee: '',
            payoutCode: '',
            senderName: '',
            receiverName: '',
            receiverPhone: '',
          }))
          toast.success(t('exchange.remittanceSaved', 'حواله ثبت شد'))
        },
        onError: fail,
      },
    )
  }

  const columns: TableColumn<Remittance>[] = [
    {
      id: 'number',
      labelKey: 'exchange.number',
      labelFallback: 'شماره',
      locked: true,
      render: (r) => `#${r.number}`,
    },
    {
      id: 'direction',
      labelKey: 'exchange.direction',
      labelFallback: 'نوع',
      render: (r) => t(`exchange.directions.${r.direction}`, r.direction),
    },
    {
      id: 'counterparty',
      labelKey: 'exchange.counterparty',
      labelFallback: 'طرف (دفتر/نماینده)',
      render: (r) => r.counterparty,
    },
    {
      id: 'people',
      labelKey: 'exchange.people',
      labelFallback: 'فرستنده ← گیرنده',
      showFrom: 'md',
      render: (r) => `${r.senderName} ← ${r.receiverName}`,
    },
    {
      id: 'amount',
      labelKey: 'exchange.amount',
      labelFallback: 'مبلغ',
      align: 'end',
      render: (r) => money(r.amountMinor, r.currency),
    },
    {
      id: 'fee',
      labelKey: 'exchange.fee',
      labelFallback: 'کارمزد',
      align: 'end',
      showFrom: 'md',
      render: (r) => money(r.feeMinor, r.currency),
    },
    {
      id: 'date',
      labelKey: 'exchange.date',
      labelFallback: 'تاریخ',
      showFrom: 'lg',
      render: (r) => date(r.createdAt),
    },
    {
      id: 'status',
      labelKey: 'exchange.status',
      labelFallback: 'وضعیت',
      locked: true,
      render: (r) => (
        <div className="flex flex-wrap items-center gap-1">
          <span>{t(`exchange.remittanceStatus.${r.status}`, r.status)}</span>
          {REMITTANCE_MOVES[r.direction][r.status].map((to) => (
            <Button
              key={to}
              size="sm"
              variant={to === 'cancelled' ? 'ghost' : 'outline'}
              disabled={move.isPending}
              onClick={() =>
                to === 'sent'
                  ? move.mutate({ id: r.id, status: 'sent' }, { onError: fail })
                  : to === 'paid' && r.direction === 'outgoing'
                    ? move.mutate({ id: r.id, status: 'paid' }, { onError: fail })
                    : setActing({ row: r, to: to as 'paid' | 'cancelled' })
              }
            >
              {t(`exchange.remittanceMove.${to}`, to)}
            </Button>
          ))}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-3">
      <div className={`${packCard} grid gap-3 sm:grid-cols-2`}>
        <SegmentedControl
          label={t('exchange.direction', 'نوع')}
          options={(['outgoing', 'incoming'] as const).map((value) => ({
            value,
            label: t(`exchange.directions.${value}`, value),
          }))}
          value={direction}
          onChange={(v) => setDirection(v as RemittanceDirection)}
        />
        <Input
          name="counterparty"
          value={form.counterparty}
          placeholder={t('exchange.counterparty', 'طرف (دفتر/نماینده)')}
          onChange={(e) => set('counterparty')(e.target.value)}
        />
        <Input
          name="senderName"
          value={form.senderName}
          placeholder={t('exchange.sender', 'فرستنده')}
          onChange={(e) => set('senderName')(e.target.value)}
        />
        <Input
          name="receiverName"
          value={form.receiverName}
          placeholder={t('exchange.receiver', 'گیرنده')}
          onChange={(e) => set('receiverName')(e.target.value)}
        />
        <Input
          name="receiverPhone"
          value={form.receiverPhone}
          placeholder={t('exchange.receiverPhone', 'تلفن گیرنده')}
          onChange={(e) => set('receiverPhone')(e.target.value)}
        />
        <Input
          name="destination"
          value={form.destination}
          placeholder={t('exchange.destination', 'شهر / مقصد')}
          onChange={(e) => set('destination')(e.target.value)}
        />
        <SelectField
          name="currency"
          value={form.currency}
          onChange={set('currency')}
          options={currencyCodeSchema.options.map((c) => ({ value: c, label: c }))}
        />
        <div className="flex gap-2">
          <Input
            name="amountMinor"
            inputMode="decimal"
            value={form.amount}
            placeholder={t('exchange.amount', 'مبلغ')}
            onChange={(e) => set('amount')(e.target.value)}
          />
          <Input
            name="feeMinor"
            inputMode="decimal"
            value={form.fee}
            placeholder={t('exchange.fee', 'کارمزد')}
            onChange={(e) => set('fee')(e.target.value)}
          />
        </div>
        {direction === 'incoming' ? (
          <Input
            name="payoutCode"
            value={form.payoutCode}
            placeholder={t('exchange.partnerCode', 'رمز حواله که طرف داده')}
            onChange={(e) => set('payoutCode')(e.target.value)}
          />
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={withId || mustId}
            disabled={mustId}
            onChange={(e) => setWithId(e.target.checked)}
          />
          {t('exchange.recordIdentity', 'ثبت مشخصات شناسایی')}
        </label>
        {mustId || withId ? <IdentityFields value={identity} onChange={setIdentity} /> : null}
        <div className="sm:col-span-2">
          <Button
            onClick={submit}
            disabled={
              amountMinor === null ||
              feeMinor === null ||
              !form.counterparty.trim() ||
              form.senderName.trim().length < 2 ||
              form.receiverName.trim().length < 2 ||
              (direction === 'incoming' && form.payoutCode.trim().length < 4) ||
              create.isPending
            }
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t('exchange.recordRemittance', 'ثبت حواله')}
          </Button>
        </div>
      </div>

      {shownCode ? (
        <div role="status" className={`${packCard} border-[hsl(var(--color-success))]`}>
          <p className="text-sm">
            {t(
              'exchange.codeOnce',
              'رمز حواله — فقط همین یک بار نشان داده می‌شود؛ به فرستنده بدهید:',
            )}
          </p>
          <p className="mt-1 font-mono text-2xl tracking-widest">{shownCode}</p>
          <Button size="sm" variant="ghost" onClick={() => setShownCode(null)}>
            {t('exchange.close', 'بستن')}
          </Button>
        </div>
      ) : null}

      {acting ? (
        <div className={`${packCard} flex flex-wrap items-center gap-2`}>
          <Input
            className="flex-1"
            name={acting.to === 'paid' ? 'payoutCode' : 'reason'}
            value={actText}
            placeholder={
              acting.to === 'paid'
                ? t('exchange.receiverCode', 'رمزی که گیرنده نشان می‌دهد')
                : t('exchange.cancelReason', 'دلیل لغو')
            }
            onChange={(e) => setActText(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!actText.trim() || move.isPending}
            onClick={() =>
              move.mutate(
                {
                  id: acting.row.id,
                  status: acting.to,
                  ...(acting.to === 'paid'
                    ? { payoutCode: actText.trim() }
                    : { reason: actText.trim() }),
                },
                {
                  onSuccess: () => {
                    setActing(null)
                    setActText('')
                  },
                  onError: fail,
                },
              )
            }
          >
            {t(`exchange.remittanceMove.${acting.to}`, acting.to)}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setActing(null)}>
            {t('exchange.close', 'انصراف')}
          </Button>
        </div>
      ) : null}

      <DataTable
        tableId="fx-remittances"
        t={t}
        rows={list.data?.remittances ?? []}
        columns={columns}
        rowKey={(r) => r.id}
        emptyState={
          <p className="p-4 text-sm">{t('exchange.noRemittances', 'حواله‌ای ثبت نشده.')}</p>
        }
      />

      {(balances.data?.balances.length ?? 0) > 0 ? (
        <div className={packCard}>
          <h4 className="mb-2 text-sm font-semibold">
            {t('exchange.partnerBalances', 'حساب با طرف‌ها')}
          </h4>
          <ul className="space-y-1 text-sm">
            {balances.data?.balances.map((b) => (
              <li key={`${b.counterparty}|${b.currency}`}>
                {b.counterparty}: {money(Math.abs(b.balanceMinor), b.currency)}{' '}
                {b.balanceMinor >= 0
                  ? t('exchange.theyOwe', '(طلب ما)')
                  : t('exchange.weOwe', '(بدهی ما)')}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export function ExchangeSection({ view }: { view: ExchangeView }) {
  const t = usePackT()
  const settings = useFxSettings()
  const data = settings.data
  const book = data?.bookCurrency ?? ''
  const threshold = data?.kycThresholdMinor ?? null

  const body = useMemo(() => {
    if (!data) return null
    if (!data.ready) return <NotReady t={t} migration="exchange-01" />
    if (view === 'rates') return <RatesView book={book} threshold={threshold} />
    if (view === 'positions') return <PositionsView />
    if (view === 'remittances') return <RemittancesView book={book} threshold={threshold} />
    return <TradesView book={book} threshold={threshold} />
  }, [data, view, book, threshold, t])

  return (
    <section className="space-y-3" data-guide="exchange">
      <p className="rounded-xl bg-[hsl(var(--surface-muted))] p-3 text-xs text-[hsl(var(--fg-secondary))]">
        {t(
          'exchange.notInLedger',
          'معاملات ارز و حواله‌ها فعلاً در دفتر کل و صندوق ثبت نمی‌شوند (دفتر کل هنوز چندارزی نیست). موجودی هر ارز و سود آن از همین معاملات خوانده می‌شود.',
        )}
      </p>
      {settings.isError ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {t('exchange.loadFailed', 'تنظیمات صرافی خوانده نشد.')}
        </p>
      ) : (
        body
      )}
    </section>
  )
}
