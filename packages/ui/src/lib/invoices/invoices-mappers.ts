// packages/ui/src/lib/invoices-mappers.ts
import type { RawInvoice, Invoice } from './invoices-types'
import { settlementDate } from '@hisabche/validation'
import { fmtDate } from './invoices-format'

export const mapInvoices = (rawInvoices: RawInvoice[] | undefined): Invoice[] => {
  if (!rawInvoices) return []

  return rawInvoices.map((inv) => {
    const publicToken = inv.publicToken ?? inv.public_token
    return {
      id: inv.id ?? inv._id ?? inv.invoiceId ?? inv.invoice_id ?? '',
      invoiceNumber: inv.invoiceNumber ?? inv.invoice_number ?? '???',
      date: inv.date ? fmtDate(inv.date) : '',
      createdAt: inv.created_at ? fmtDate(inv.created_at) : inv.date ? fmtDate(inv.date) : '',
      isoDate: inv.date ?? inv.created_at ?? '',
      status: inv.status ?? '',
      total: inv.total ?? 0,
      currency: inv.currency ?? 'AFN',
      type: inv.type ?? 'sale',
      customerName: inv.customerName ?? inv.customer?.full_name ?? '',
      // TODO: no `company` column on customers yet — always blank until that schema field exists
      company: inv.customer?.company ?? '',
      // Which invoices count as settled is a domain rule, not a view detail —
      // the mobile card reads it from the same helper.
      paymentDate: (() => {
        const settled = settlementDate({ status: inv.status, updatedAt: inv.updated_at })
        return settled ? fmtDate(settled) : ''
      })(),
      itemsSent: inv.itemsSent ?? 0,
      ...(publicToken !== undefined && { publicToken }),
    }
  })
}
