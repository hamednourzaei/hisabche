// packages/ui/src/lib/dashboard/dashboard-mappers.ts
import { num, fmtDate } from './dashboard-format'
import type { RawInvoice } from './dashboard-types'
import { partyLabel } from '../anonymous-party'

export const mapRecentInvoices = (
  invoices: RawInvoice[] | undefined,
  translate: (key: string) => string,
) => {
  if (!invoices || !Array.isArray(invoices)) return []

  return invoices.slice(0, 5).map((inv) => ({
    id: inv.id ?? '',
    // `common.noName` said «بدون نام», which reads as «this record lost its
    // name». It has none, because nobody was recorded. See anonymous-party.ts.
    customer: partyLabel(
      (inv.customer_id ?? inv.customerId) as string | null | undefined,
      (inv.customer_name ?? inv.customerName) as string | null | undefined,
      translate,
    ),
    total: num(inv.total),
    date: fmtDate(inv.date ?? inv.created_at ?? ''),
  }))
}

export const mapLowStockItems = (
  products:
    | Array<{
        id?: string
        name: string
        quantity: number
        reorderPoint?: number
      }>
    | undefined,
) => {
  if (!products || !Array.isArray(products)) return []

  return products
    .filter((p) => {
      const threshold = p.reorderPoint ?? 10
      return p.quantity <= threshold
    })
    .slice(0, 5)
    .map((p) => ({
      name: p.name,
      quantity: p.quantity,
    }))
}

// ✅ تابع جدید برای تبدیل داده‌های فروش به فرمت نمودار
export const mapSalesToChartData = (
  salesData: Array<{ date: string; total: number }> | undefined,
  locale: string = 'fa-AF',
) => {
  if (!salesData || !Array.isArray(salesData) || salesData.length === 0) {
    return []
  }

  return salesData.map((item) => {
    try {
      const date = new Date(item.date)
      const label = new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
      }).format(date)
      return {
        label,
        value: item.total,
        date: item.date,
      }
    } catch {
      return {
        label: item.date,
        value: item.total,
        date: item.date,
      }
    }
  })
}
