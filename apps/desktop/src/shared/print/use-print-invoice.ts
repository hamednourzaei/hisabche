// ============================================
// Printing hook — A4 through the native dialog, receipts through ESC/POS.
// ============================================

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { Invoice, InvoiceItem } from '@hisabche/validation'

import { bridge } from '@/shared/lib/bridge'
import { currencySign, formatAmount, formatDate, type CurrencyCode } from '@/shared/lib/currency'
import { directionOf, type SupportedLanguage } from '@/shared/i18n'
import { encodeReceipt } from './escpos'
import { renderInvoiceHtml, type PrintableInvoice, type PrintLabels } from './invoice-template'

export interface PrintTarget {
  mode: 'a4' | 'receipt'
  deviceName?: string | undefined
  silent?: boolean
}

export function usePrintInvoice(currency: CurrencyCode) {
  const { t, i18n } = useTranslation('desktop')

  const toPrintable = useCallback(
    (invoice: Invoice, customerName: string): PrintableInvoice => ({
      invoiceNumber: invoice.invoiceNumber,
      date: formatDate(invoice.date),
      customerName,
      lines: ((invoice.items ?? []) as InvoiceItem[]).map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      subtotal: formatAmount(invoice.subtotal ?? 0),
      total: formatAmount(invoice.total ?? 0),
      paid: formatAmount(invoice.paidAmount ?? 0),
      currencySign: currencySign(currency),
    }),
    [currency]
  )

  const labels = useCallback(
    (): PrintLabels => ({
      title: t('sales.print'),
      invoiceNumber: t('sales.invoiceNumber'),
      customer: t('sales.customer'),
      date: t('sales.date'),
      product: t('inventory.product'),
      quantity: t('inventory.stock'),
      unitPrice: t('inventory.price'),
      amount: t('sales.amount'),
      subtotal: t('common.total'),
      total: t('sales.amount'),
      paid: t('accounting.income'),
    }),
    [t]
  )

  return useCallback(
    async (invoice: Invoice, customerName: string, target: PrintTarget): Promise<boolean> => {
      const desktop = bridge()
      if (!desktop) return false

      const printable = toPrintable(invoice, customerName)

      if (target.mode === 'receipt') {
        return desktop.print.escPos({
          data: encodeReceipt(printable, labels()),
          ...(target.deviceName ? { deviceName: target.deviceName } : {}),
        })
      }

      const direction = directionOf(i18n.language as SupportedLanguage)
      return desktop.print.html({
        html: renderInvoiceHtml(printable, labels(), direction),
        landscape: false,
        silent: target.silent ?? false,
        ...(target.deviceName ? { deviceName: target.deviceName } : {}),
      })
    },
    [i18n.language, labels, toPrintable]
  )
}
