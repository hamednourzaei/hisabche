'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useCustomers, useInvoices } from '@hisabche/api'
import { CustomerDetailView } from '../customer-detail-view'
import { exportToCSV } from '../../../../lib/export'
import { useIntlLocale } from '../../../../hooks/use-intl-locale'
import {
  buildCustomerExportRows,
  CUSTOMER_EXPORT_COLUMNS,
  type ExportableInvoiceItem,
} from '../../../../lib/customers/customer-export'

const makeFmt =
  (locale: string) =>
  (v: number): string =>
    v.toLocaleString(locale)

const rem = (inv: { total: number; paidAmount: number }): number =>
  Math.max(0, inv.total - inv.paidAmount)

const makeFmtDate =
  (locale: string) =>
  (d: string): string => {
    try {
      return new Date(d).toLocaleDateString(locale)
    } catch {
      return d
    }
  }

interface ApiInvoiceRecord {
  id: string
  invoiceNumber?: string
  total: number
  paidAmount: number
  date: string
  status: string
  customerId: string
  /** Legacy rows predate the split and are read as sales. */
  type?: string
  currency?: string
  items?: readonly ExportableInvoiceItem[]
}

interface CustomerRecord {
  id: string
  fullName?: string
  name?: string
  phone?: string
}

export function CustomerDetailContainer({
  customerId,
  onBack,
}: {
  customerId: string
  onBack: () => void
}) {
  const t = useTranslations()
  const locale = useIntlLocale()
  const fmt = useMemo(() => makeFmt(locale), [locale])
  const fmtDate = useMemo(() => makeFmtDate(locale), [locale])
  const [payOpen, setPayOpen] = useState(false)

  const { data: customersData } = useCustomers({
    page: 1,
    limit: 50,
    sortDirection: 'desc',
  })

  const { data: invoicesData, refetch } = useInvoices({
    page: 1,
    limit: 200,
    sortDirection: 'desc',
  })

  const customer = useMemo(() => {
    const list = (customersData?.customers ?? []) as unknown as CustomerRecord[]
    const found = list.find((c) => c.id === customerId)
    if (!found) return null
    return {
      id: found.id,
      name: found.fullName || found.name || t('common.noName'),
      phone: found.phone || '',
    }
  }, [customersData, customerId, t])

  const openInvoices = useMemo(() => {
    const list = (invoicesData?.invoices ?? []) as unknown as ApiInvoiceRecord[]
    return list
      .filter(
        (inv) =>
          inv.customerId === customerId && (inv.status === 'pending' || inv.status === 'partial'),
      )
      .map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber ?? '',
        total: inv.total,
        paidAmount: inv.paidAmount,
        remaining: rem(inv),
        date: fmtDate(inv.date),
        status: inv.status,
      }))
  }, [invoicesData, customerId, fmtDate])

  const totalDebt = useMemo(
    () => openInvoices.reduce((s, inv) => s + inv.remaining, 0),
    [openInvoices],
  )

  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const v = t(key)
      return v && v !== key ? v : (fallback ?? key)
    },
    [t],
  )

  const handleOpenPayment = useCallback(() => setPayOpen(true), [])
  const handleClosePayment = useCallback(() => setPayOpen(false), [])

  // صورتحساب کامل — نه فقط فاکتورهای باز. خروجی باید تاریخچه‌ی کامل معامله با
  // این طرف را نشان دهد، و خرید و فروش هر کدام با نوع خودشان می‌مانند.
  const statementInvoices = useMemo(() => {
    const list = (invoicesData?.invoices ?? []) as unknown as ApiInvoiceRecord[]
    return list.filter((inv) => inv.customerId === customerId)
  }, [invoicesData, customerId])

  const handleExport = useCallback(() => {
    if (!customer || statementInvoices.length === 0) return

    const rows = buildCustomerExportRows(statementInvoices, {
      party: customer.name,
      unitLabel: (unit, label) => (unit === 'custom' ? (label ?? '') : safeT(`unit.${unit}`, unit)),
    })

    const columns = CUSTOMER_EXPORT_COLUMNS.map((key) => ({
      key,
      label: safeT(`customers.export.${key}`, key),
    }))

    exportToCSV(
      rows,
      columns,
      `statement-${customer.name}-${new Date().toISOString().slice(0, 10)}`,
    )
  }, [customer, statementInvoices, safeT])

  return (
    <CustomerDetailView
      t={safeT}
      fmt={fmt}
      customer={customer}
      openInvoices={openInvoices}
      totalDebt={totalDebt}
      payOpen={payOpen}
      onBack={onBack}
      onOpenPayment={handleOpenPayment}
      onClosePayment={handleClosePayment}
      onPaymentSuccess={refetch}
      onExport={handleExport}
      canExport={statementInvoices.length > 0}
    />
  )
}
