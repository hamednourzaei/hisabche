'use client'

// ============================================
// «سریال‌های فروخته‌شده» on a sale (QA report, Mobile Retail DNA; 10 Nov 2026).
//
// A phone shop sells THIS phone, not «one of the model». The invoice moved
// the stock and the money as for any product; here the seller names which
// units left, picked from the ones in stock. The server checks each number
// is this product's, still in stock, and that no more are named than the
// line sold (POST /operations/serials/issue). Deleting the invoice puts the
// units back in stock on their own.
// ============================================

import { useState } from 'react'
import { useAssignSerialsToSale, useSerials } from '@hisabche/api'

import { Button } from '../button'
import { useToast } from '../toast-provider'
import { refusalText } from '../../../lib/refusal-text'

type Translate = (key: string, fallback?: string) => string

export interface InvoiceSerialLine {
  productId: string
  name: string
  quantity: number
}

function SerialLine({
  t,
  invoiceId,
  line,
}: {
  t: Translate
  invoiceId: string
  line: InvoiceSerialLine
}) {
  const sold = useSerials(line.productId, 'sold', invoiceId)
  const inStock = useSerials(line.productId, 'in_stock')
  const assign = useAssignSerialsToSale()
  const toast = useToast()
  const [picked, setPicked] = useState<string[]>([])

  const named = sold.data ?? []
  const remaining = Math.max(0, Math.floor(line.quantity) - named.length)
  const choices = inStock.data ?? []

  const toggle = (serial: string) =>
    setPicked((current) =>
      current.includes(serial)
        ? current.filter((value) => value !== serial)
        : current.length < remaining
          ? [...current, serial]
          : current,
    )

  const submit = () =>
    assign.mutate(
      { invoiceId, productId: line.productId, serialNumbers: picked },
      {
        onSuccess: () => {
          toast.success(t('invoiceSerials.saved', 'شماره‌ها روی این فروش ثبت شد'))
          setPicked([])
        },
        onError: (error) =>
          toast.error(
            refusalText(
              error,
              t,
              'invoiceSerials',
              [
                'SERIAL_COUNT_MISMATCH',
                'SERIAL_NOT_IN_STOCK',
                'SERIAL_UNKNOWN',
                'SERIAL_SALE_ONLY',
              ],
              t('invoiceSerials.failed', 'شماره‌ها ثبت نشد'),
            ),
          ),
      },
    )

  return (
    <div className="space-y-2 rounded-xl border border-[hsl(var(--border-default))] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium text-[hsl(var(--fg-primary))]">{line.name}</span>
        <span className="text-xs text-[hsl(var(--fg-secondary))]">
          {named.length} / {Math.floor(line.quantity)} {t('invoiceSerials.named', 'نام‌برده')}
        </span>
      </div>
      {named.length > 0 ? (
        <p className="font-mono text-xs text-[hsl(var(--fg-secondary))]">
          {named.map((unit) => unit.serialNumber).join(' · ')}
        </p>
      ) : null}
      {remaining > 0 ? (
        choices.length === 0 ? (
          <p className="text-xs text-[hsl(var(--color-warning))]">
            {t('invoiceSerials.noneInStock', 'هیچ شماره‌ی ثبت‌شده‌ای از این کالا در انبار نیست.')}
          </p>
        ) : (
          <>
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {choices.map((unit) => (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => toggle(unit.serialNumber)}
                  aria-pressed={picked.includes(unit.serialNumber)}
                  className={
                    picked.includes(unit.serialNumber)
                      ? 'rounded-md border border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.1)] px-2 py-1 font-mono text-xs text-[hsl(var(--fg-primary))]'
                      : 'rounded-md border border-[hsl(var(--border-default))] px-2 py-1 font-mono text-xs text-[hsl(var(--fg-secondary))]'
                  }
                >
                  {unit.serialNumber}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              onClick={submit}
              disabled={picked.length === 0}
              loading={assign.isPending}
            >
              {t('invoiceSerials.submit', 'ثبت روی این فروش')} ({picked.length})
            </Button>
          </>
        )
      ) : null}
    </div>
  )
}

export function InvoiceSerialsPanel({
  t,
  invoiceId,
  lines,
}: {
  t: Translate
  invoiceId: string
  lines: InvoiceSerialLine[]
}) {
  if (lines.length === 0) return null
  return (
    <section
      className="space-y-3 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4"
      data-guide="invoice-serials"
    >
      <div>
        <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {t('invoiceSerials.title', 'سریال / IMEI فروخته‌شده')}
        </h3>
        <p className="text-xs text-[hsl(var(--fg-secondary))]">
          {t(
            'invoiceSerials.hint',
            'بگویید دقیقاً کدام دستگاه‌ها با این فاکتور رفتند؛ موجودی را خود فاکتور کم کرده است.',
          )}
        </p>
      </div>
      {lines.map((line) => (
        <SerialLine key={line.productId} t={t} invoiceId={invoiceId} line={line} />
      ))}
    </section>
  )
}
