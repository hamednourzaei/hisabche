'use client'

// ============================================
// «شماره سریال / IMEI» on the product page (QA report + V59.1 Mobile completion).
//
// Uses canonical `parseBulkImeis` from `@hisabche/validation` for paste/scanner input,
// exposes hold expiry + release-expired controls, and connects sold IMEI returns
// (`useReturnSerial` -> `routeReturnedSerial`) to invoice financial credit reversals.
// ============================================

import { useCallback, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import {
  useHoldSerial,
  useReceiveSerials,
  useReleaseExpiredSerialHolds,
  useReturnSerial,
  useSerials,
  type SerialStatus,
} from '@hisabche/api'
import { FRACTION_DIGITS } from '@hisabche/formatting'
import { parseBulkImeis, type ReturnCondition } from '@hisabche/validation'

import { Button } from '../button'
import { Input } from '../input'
import { DataTable, type TableColumn } from '../data-table'
import { useToast } from '../toast-provider'
import { typedNumber } from '../../../lib/typed-number'
import { refusalText } from '../../../lib/refusal-text'
import { useBookCurrency } from '../../../hooks/use-book-currency'
import { useDateFormat } from '../../../hooks/use-date-format'
import { SelectField } from '../select-field'
import { useCustomerOptions } from '../business-packs/pack-shared'

type Translate = (key: string, fallback?: string) => string

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5'

/** Canonical bulk IMEI parser wrapper: newline, comma, semicolon, or whitespace separated. */
export function serialLines(text: string): string[] {
  return parseBulkImeis(text).unique
}

const STATUS_KEY: Record<SerialStatus, string> = {
  in_stock: 'productSerials.status.in_stock',
  reserved: 'productSerials.status.reserved',
  sold: 'productSerials.status.sold',
  returned: 'productSerials.status.returned',
  scrapped: 'productSerials.status.scrapped',
}

interface SerialRow {
  id: string
  serialNumber: string
  status: SerialStatus
  receivedOn: string
  reservedUntil: string | null
  invoiceId: string | null
}

export function ProductSerialsPanel({
  t,
  productId,
  defaultUnitCost,
}: {
  t: Translate
  productId: string
  /** The product's buy price, offered as each unit's cost. */
  defaultUnitCost: number
}) {
  const list = useSerials(productId, 'all')
  const receive = useReceiveSerials()
  const hold = useHoldSerial(productId)
  const releaseExpired = useReleaseExpiredSerialHolds(productId)
  const returnSerial = useReturnSerial(productId)
  const toast = useToast()
  const bookCurrency = useBookCurrency()
  const { date } = useDateFormat()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [cost, setCost] = useState(defaultUnitCost > 0 ? String(defaultUnitCost) : '')
  const [search, setSearch] = useState('')
  const customers = useCustomerOptions()
  const [holding, setHolding] = useState<string | null>(null)
  const [holdFor, setHoldFor] = useState('')
  const [holdHours, setHoldHours] = useState('24')
  const [returningId, setReturningId] = useState<string | null>(null)
  const [returnCondition, setReturnCondition] = useState<ReturnCondition>('opened')

  const holdFailed = useCallback(
    (error: unknown) =>
      toast.error(
        refusalText(
          error,
          t,
          'productSerials',
          [
            'SERIAL_NOT_IN_STOCK',
            'SERIAL_NOT_HELD',
            'SERIAL_HOLD_NOT_READY',
            'SERIAL_RESERVED_FOR_ANOTHER_CUSTOMER',
          ],
          t('productSerials.holdFailed', 'انجام نشد'),
        ),
      ),
    [toast, t],
  )

  const parsedBulk = useMemo(() => parseBulkImeis(text), [text])
  const numbers = parsedBulk.unique
  const duplicateImeis = parsedBulk.duplicates
  const unitCost = typedNumber(cost)
  const digits = bookCurrency
    ? ((FRACTION_DIGITS as Record<string, number>)[bookCurrency] ?? 2)
    : null
  const ready = numbers.length > 0 && unitCost !== null && unitCost >= 0 && digits !== null

  const rows = useMemo<SerialRow[]>(
    () =>
      (list.data ?? [])
        .filter((unit) => !search || unit.serialNumber.includes(search.trim()))
        .map((unit) => ({
          id: unit.id,
          serialNumber: unit.serialNumber,
          status: unit.status,
          receivedOn: unit.receivedOn,
          reservedUntil: unit.reservedUntil ?? null,
          invoiceId: unit.invoiceId ?? null,
        })),
    [list.data, search],
  )

  const hasReserved = rows.some((row) => row.status === 'reserved')

  const holdHoursOptions = useMemo(
    () => [
      { value: '24', label: t('productSerials.hold24h', '۲۴ ساعت') },
      { value: '72', label: t('productSerials.hold72h', '۷۲ ساعت') },
      { value: 'none', label: t('productSerials.holdNoExpiry', 'بدون انقضا') },
    ],
    [t],
  )

  const conditionOptions = useMemo(
    () => [
      { value: 'sealed', label: t('returns.condition.sealed', 'پلمپ / دست‌نخورده') },
      { value: 'opened', label: t('returns.condition.opened', 'بازشده و سالم') },
      { value: 'used', label: t('returns.condition.used', 'استفاده‌شده') },
      { value: 'defective', label: t('returns.condition.defective', 'معیوب') },
      { value: 'damaged', label: t('returns.condition.damaged', 'آسیب‌دیده') },
      { value: 'incomplete', label: t('returns.condition.incomplete', 'ناقص') },
    ],
    [t],
  )

  const columns = useMemo<TableColumn<SerialRow>[]>(
    () => [
      {
        id: 'serial',
        labelKey: 'productSerials.number',
        labelFallback: 'شماره',
        render: (row) => <span className="font-mono tabular-nums">{row.serialNumber}</span>,
      },
      {
        id: 'status',
        labelKey: 'productSerials.statusLabel',
        labelFallback: 'وضعیت',
        render: (row) => (
          <div className="space-y-0.5">
            <span>{t(STATUS_KEY[row.status] ?? STATUS_KEY.in_stock)}</span>
            {row.status === 'reserved' && row.reservedUntil ? (
              <div className="text-xs text-[hsl(var(--fg-secondary))]">
                {t('productSerials.expiresAt', 'انقضا')}: {date(row.reservedUntil)}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: 'received',
        labelKey: 'productSerials.received',
        labelFallback: 'تاریخ ورود',
        render: (row) => date(row.receivedOn),
      },
      {
        id: 'hold',
        labelKey: 'productSerials.hold',
        labelFallback: 'رزرو / عملیات',
        locked: true,
        render: (row) =>
          row.status === 'reserved' ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={hold.isPending}
              onClick={() =>
                hold.mutate({ serialId: row.id, customerId: null }, { onError: holdFailed })
              }
            >
              {t('productSerials.release', 'آزاد کردن')}
            </Button>
          ) : row.status === 'sold' ? (
            returningId === row.id ? (
              <div className="flex flex-wrap items-center gap-1">
                <SelectField
                  name="returnCondition"
                  value={returnCondition}
                  onChange={(value) => setReturnCondition(value as ReturnCondition)}
                  options={conditionOptions}
                />
                <Button
                  size="sm"
                  disabled={returnSerial.isPending}
                  onClick={() =>
                    returnSerial.mutate(
                      { serialId: row.id, conditionCode: returnCondition },
                      {
                        onSuccess: () => {
                          setReturningId(null)
                          toast.success(
                            t(
                              'productSerials.returnedWithReversal',
                              'دستگاه و برگشت مالی فاکتور ثبت شد',
                            ),
                          )
                        },
                        onError: holdFailed,
                      },
                    )
                  }
                >
                  {t('productSerials.confirmReturn', 'تایید مرجوعی')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setReturningId(null)}>
                  {t('common.cancel', 'انصراف')}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setReturningId(row.id)}>
                {t('productSerials.returnAction', 'مرجوعی IMEI')}
              </Button>
            )
          ) : row.status !== 'in_stock' ? null : holding === row.id ? (
            <div className="flex flex-wrap items-center gap-1">
              <SelectField
                name="customerId"
                value={holdFor}
                placeholder={t('productSerials.holdFor', 'برای کدام مشتری')}
                onChange={setHoldFor}
                options={customers}
                searchable
              />
              <SelectField
                name="holdHours"
                value={holdHours}
                onChange={setHoldHours}
                options={holdHoursOptions}
              />
              <Button
                size="sm"
                disabled={!holdFor || hold.isPending}
                onClick={() => {
                  const hours = holdHours === 'none' ? null : Number(holdHours)
                  hold.mutate(
                    {
                      serialId: row.id,
                      customerId: holdFor,
                      holdMinutes: hours && Number.isFinite(hours) ? hours * 60 : null,
                    },
                    {
                      onSuccess: () => {
                        setHolding(null)
                        setHoldFor('')
                      },
                      onError: holdFailed,
                    },
                  )
                }}
              >
                {t('productSerials.holdSave', 'رزرو')}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setHolding(row.id)}>
              {t('productSerials.holdAction', 'رزرو برای مشتری')}
            </Button>
          ),
      },
    ],
    [
      date,
      t,
      hold,
      holding,
      holdFor,
      holdHours,
      holdHoursOptions,
      customers,
      holdFailed,
      returningId,
      returnCondition,
      conditionOptions,
      returnSerial,
      toast,
    ],
  )

  const submit = () => {
    if (!ready || unitCost === null || digits === null) return
    receive.mutate(
      {
        productId,
        serialNumbers: numbers,
        unitCostMinor: Math.round(unitCost * 10 ** digits),
      },
      {
        onSuccess: () => {
          toast.success(t('productSerials.saved', 'شماره‌ها ثبت شد'))
          setText('')
          setOpen(false)
        },
        onError: (error) =>
          toast.error(
            refusalText(
              error,
              t,
              'productSerials',
              ['SERIAL_DUPLICATE'],
              t('productSerials.failed', 'شماره‌ها ثبت نشد'),
            ),
          ),
      },
    )
  }

  return (
    <section className={card} data-guide="product-serials">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {t('productSerials.title', 'شماره سریال / IMEI')}
          </h3>
          <p className="text-xs text-[hsl(var(--fg-secondary))]">
            {t(
              'productSerials.hint',
              'هر دستگاه با شماره‌ی خودش: کدام در انبار است و کدام روی کدام فاکتور فروخته شد.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasReserved ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={releaseExpired.isPending}
              onClick={() =>
                releaseExpired.mutate(undefined, {
                  onSuccess: (res) => {
                    toast.success(
                      `${t('productSerials.releasedExpired', 'رزروهای منقضی آزاد شد')}: ${res.releasedCount}`,
                    )
                  },
                  onError: holdFailed,
                })
              }
            >
              {t('productSerials.releaseExpiredAction', 'آزادسازی منقضی‌ها')}
            </Button>
          ) : null}
          {open ? null : (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              {t('productSerials.add', 'ثبت شماره‌های رسیده')}
            </Button>
          )}
        </div>
      </div>

      {open ? (
        <div className="mt-4 space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('productSerials.numbers', 'شماره‌ها (چسباندن گروهی / اسکن، هر خط یا ویرگول)')}
            </span>
            <textarea
              name="serialNumbers"
              rows={4}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-2 font-mono text-sm"
            />
          </label>
          {duplicateImeis.length > 0 ? (
            <p
              role="status"
              className="rounded-lg border border-[hsl(var(--color-warning)/0.4)] bg-[hsl(var(--color-warning)/0.08)] px-3 py-1.5 text-xs text-[hsl(var(--fg-secondary))]"
            >
              {t('productSerials.duplicateImeiNotice', 'IMEI تکراری نادیده گرفته شد')}:{' '}
              <span className="font-mono">{duplicateImeis.join(', ')}</span>
            </p>
          ) : null}
          <label className="block space-y-1 text-sm">
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('productSerials.unitCost', 'بهای هر دستگاه')} {bookCurrency ?? ''}
            </span>
            <Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={!ready} loading={receive.isPending}>
              {t('productSerials.submit', 'ثبت')} ({numbers.length})
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel', 'انصراف')}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <DataTable
          tableId="product-serials"
          t={t}
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          searchValue={search}
          onSearchChange={setSearch}
          emptyState={
            <p className="p-4 text-center text-sm text-[hsl(var(--fg-secondary))]">
              {list.isError
                ? t('productSerials.loadFailed', 'شماره‌ها خوانده نشد.')
                : t('productSerials.empty', 'هنوز شماره‌ای ثبت نشده.')}
            </p>
          }
        />
      </div>
    </section>
  )
}
