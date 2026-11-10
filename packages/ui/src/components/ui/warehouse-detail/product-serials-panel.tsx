'use client'

// ============================================
// «شماره سریال / IMEI» on the product page (QA report, Mobile Retail DNA;
// 10 Nov 2026). Mounted when the business tracks serialized goods.
//
// Register the units that arrived (one number per line, with what each cost)
// and look one up — in stock, sold (on which invoice), returned. Selling a
// SPECIFIC unit is done on the sale itself (invoice page → «سریال‌های فروخته‌شده»);
// this panel never changes stock: the purchase invoice did that.
// ============================================

import { useCallback, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useHoldSerial, useReceiveSerials, useSerials, type SerialStatus } from '@hisabche/api'
import { FRACTION_DIGITS } from '@hisabche/formatting'

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

/** One number per line; blanks and repeats dropped (the server refuses repeats too). */
export function serialLines(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\n,،;]+/)
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ]
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
  const toast = useToast()
  const bookCurrency = useBookCurrency()
  const { date } = useDateFormat()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [cost, setCost] = useState(defaultUnitCost > 0 ? String(defaultUnitCost) : '')
  const [search, setSearch] = useState('')
  // Mobile Retail DNA (10 Nov 2026): hold one phone for one customer.
  const hold = useHoldSerial(productId)
  const customers = useCustomerOptions()
  const [holding, setHolding] = useState<string | null>(null)
  const [holdFor, setHoldFor] = useState('')
  const holdFailed = useCallback(
    (error: unknown) =>
      toast.error(
        refusalText(
          error,
          t,
          'productSerials',
          ['SERIAL_NOT_IN_STOCK', 'SERIAL_NOT_HELD', 'SERIAL_HOLD_NOT_READY'],
          t('productSerials.holdFailed', 'انجام نشد'),
        ),
      ),
    [toast, t],
  )

  const numbers = serialLines(text)
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
        })),
    [list.data, search],
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
        render: (row) => t(STATUS_KEY[row.status] ?? STATUS_KEY.in_stock),
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
        labelFallback: 'رزرو',
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
          ) : row.status !== 'in_stock' ? null : holding === row.id ? (
            <div className="flex items-center gap-1">
              <SelectField
                name="customerId"
                value={holdFor}
                placeholder={t('productSerials.holdFor', 'برای کدام مشتری')}
                onChange={setHoldFor}
                options={customers}
                searchable
              />
              <Button
                size="sm"
                disabled={!holdFor || hold.isPending}
                onClick={() =>
                  hold.mutate(
                    { serialId: row.id, customerId: holdFor },
                    {
                      onSuccess: () => {
                        setHolding(null)
                        setHoldFor('')
                      },
                      onError: holdFailed,
                    },
                  )
                }
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
    [date, t, hold, holding, holdFor, customers, holdFailed],
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
        {open ? null : (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('productSerials.add', 'ثبت شماره‌های رسیده')}
          </Button>
        )}
      </div>

      {open ? (
        <div className="mt-4 space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('productSerials.numbers', 'شماره‌ها (هر خط یکی)')}
            </span>
            <textarea
              name="serialNumbers"
              rows={4}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-2 font-mono text-sm"
            />
          </label>
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
