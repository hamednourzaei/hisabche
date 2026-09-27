// ============================================
// useReceiptPrint — print a thermal receipt for an issued invoice, and say
// what happened. Printing is its own state: a failure here never touches the
// invoice, and «print again» is always allowed (lib/print/print-receipt.ts).
// ============================================
'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CURRENCY_SIGN, formatNumber } from '@hisabche/formatting'

import { useToast } from '../components/ui/toast-provider'
import { useDateFormat } from './use-date-format'
import { printReceipt, type PrintOutcome } from '../lib/print/print-receipt'
import { loadPrinterSettings } from '../lib/print/printer-settings'
import { renderReceiptHtml, type ReceiptData } from '../lib/print/receipt-html'

/** The parts of an invoice a receipt shows (the detail page's display shape). */
export interface ReceiptSource {
  invoiceNumber: string
  date: string
  currency: string
  customerName?: string | null | undefined
  businessName?: string | null | undefined
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
  paidAmount: number
  items: Array<{
    productName?: string | null | undefined
    quantity?: number | undefined
    unitPrice?: number | undefined
    totalPrice?: number | undefined
  }>
}

export function useReceiptPrint() {
  const t = useTranslations()
  const toast = useToast()
  const { date, lang } = useDateFormat()
  const [printing, setPrinting] = useState(false)

  const print = useCallback(
    async (source: ReceiptSource): Promise<PrintOutcome> => {
      setPrinting(true)
      try {
        const settings = loadPrinterSettings()
        const money = (value: number) => formatNumber(value, lang, 2)
        // A value the invoice does not carry prints as a dash, never as 0.
        const orDash = (value: number | undefined, show: (n: number) => string) =>
          typeof value === 'number' && Number.isFinite(value) ? show(value) : '—'
        const currency =
          source.currency in CURRENCY_SIGN
            ? CURRENCY_SIGN[source.currency as keyof typeof CURRENCY_SIGN]
            : source.currency
        const data: ReceiptData = {
          businessName: source.businessName?.trim() || t('app.name'),
          invoiceNumber: source.invoiceNumber,
          date: date(source.date),
          customerName: source.customerName || undefined,
          lines: source.items.map((item) => ({
            name: item.productName ?? '',
            quantity: orDash(item.quantity, (n) => formatNumber(n, lang, 3)),
            unitPrice: orDash(item.unitPrice, money),
            total: orDash(item.totalPrice, money),
          })),
          subtotal: money(source.subtotal),
          discount: source.discountTotal > 0 ? money(source.discountTotal) : undefined,
          tax: source.taxTotal > 0 ? money(source.taxTotal) : undefined,
          total: money(source.total),
          paid: money(source.paidAmount),
          remaining: money(Math.max(0, source.total - source.paidAmount)),
          currency,
          footer: t('receipt.thanks'),
        }
        const html = renderReceiptHtml(
          data,
          {
            invoice: t('receipt.invoice'),
            date: t('receipt.date'),
            customer: t('receipt.customer'),
            item: t('receipt.item'),
            quantity: t('receipt.quantity'),
            price: t('receipt.price'),
            amount: t('receipt.amount'),
            subtotal: t('receipt.subtotal'),
            discount: t('receipt.discount'),
            tax: t('receipt.tax'),
            total: t('receipt.total'),
            paid: t('receipt.paid'),
            remaining: t('receipt.remaining'),
          },
          { widthMm: settings.widthMm, direction: lang === 'en' ? 'ltr' : 'rtl', lang },
        )
        const outcome = await printReceipt(html, settings)
        if (outcome.status === 'printed') toast.success(t('receipt.printed'))
        if (outcome.status === 'failed') {
          toast.error(
            outcome.reason === 'drawer' ? t('receipt.drawerFailed') : t('receipt.printFailed'),
            outcome.reason === 'drawer' ? undefined : t('receipt.printFailedHint'),
          )
        }
        return outcome
      } finally {
        setPrinting(false)
      }
    },
    [date, lang, t, toast],
  )

  return { print, printing }
}
