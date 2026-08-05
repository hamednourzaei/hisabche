// ============================================
// Invoice detail — line items, totals, A4 / thermal printing.
// ============================================

import React, { useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Printer, Receipt } from 'lucide-react'
import { useInvoice } from '@hisabche/api'
import type { InvoiceItem } from '@hisabche/validation'

import { Badge, Button, Card, Skeleton } from '@/components/ui/primitives'
import { PageHeader } from '@/components/layout/page-header'
import { formatDate, formatMoney } from '@/shared/lib/currency'
import { usePrintInvoice } from '@/shared/print/use-print-invoice'
import { useShortcuts } from '@/shared/hooks/use-shortcuts'
import { useCurrency } from '@/shared/stores/ui.store'

export default function InvoiceDetailPage() {
  const { t } = useTranslation('desktop')
  const { id } = useParams<{ id: string }>()
  const currency = useCurrency()

  const query = useInvoice(id)
  const invoice = query.data
  const print = usePrintInvoice(currency)

  const customerName = invoice?.customerId ?? '—'

  const printA4 = useCallback(() => {
    if (invoice) void print(invoice, customerName, { mode: 'a4' })
  }, [customerName, invoice, print])

  const printReceipt = useCallback(() => {
    if (invoice) void print(invoice, customerName, { mode: 'receipt' })
  }, [customerName, invoice, print])

  useShortcuts({ print: printA4 })

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-3 p-5">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (query.isError || !invoice) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('common.error')}</p>
          <Button size="sm" onClick={() => void query.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      </div>
    )
  }

  const items = (invoice.items ?? []) as InvoiceItem[]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={invoice.invoiceNumber} subtitle={formatDate(invoice.date)}>
        <Button size="sm" variant="secondary" onClick={printReceipt}>
          <Receipt size={14} />
          {t('common.print')}
        </Button>
        <Button size="sm" variant="primary" onClick={printA4}>
          <Printer size={14} />
          {t('sales.print')}
        </Button>
      </PageHeader>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_300px] gap-4 overflow-auto p-4">
        <Card className="p-0">
          <div className="grid grid-cols-[1fr_90px_130px_130px] gap-3 border-b border-[hsl(var(--border-default))] px-4 py-2 text-[11px] uppercase text-[hsl(var(--fg-tertiary))]">
            <span>{t('inventory.product')}</span>
            <span className="text-end">{t('inventory.stock')}</span>
            <span className="text-end">{t('inventory.price')}</span>
            <span className="text-end">{t('sales.amount')}</span>
          </div>

          {items.map((item, index) => (
            <div
              key={`${item.productName}-${index}`}
              className="grid grid-cols-[1fr_90px_130px_130px] gap-3 border-b border-[hsl(var(--border-default)/0.5)] px-4 py-2 text-sm"
            >
              <span className="truncate">{item.productName}</span>
              <span className="text-end tabular-nums">{item.quantity}</span>
              <span className="text-end tabular-nums">{formatMoney(item.unitPrice, currency)}</span>
              <span className="text-end font-medium tabular-nums">
                {formatMoney(item.totalPrice, currency)}
              </span>
            </div>
          ))}
        </Card>

        <div className="flex flex-col gap-3">
          <Card>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[hsl(var(--fg-secondary))]">{t('sales.status')}</span>
                <Badge tone={invoice.status === 'paid' ? 'success' : 'warning'}>
                  {t(`sales.status.${invoice.status}`, { defaultValue: invoice.status ?? '' })}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-[hsl(var(--fg-secondary))]">{t('accounting.income')}</span>
                <span className="tabular-nums">{formatMoney(invoice.paidAmount ?? 0, currency)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-[hsl(var(--border-strong))] pt-2 text-base font-bold">
                <span>{t('common.total')}</span>
                <span className="tabular-nums">{formatMoney(invoice.total ?? 0, currency)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
