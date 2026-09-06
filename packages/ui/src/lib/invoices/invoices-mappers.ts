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
      // H2 — carried so the name in the table can be a link to the party.
      //
      // The column was already selected by the API and dropped here, which is
      // why the customer name was plain text: the row simply had no id to
      // navigate to. Left `undefined` rather than `''` for a walk-in sale with
      // no customer, so the view can tell «no party» from «party unknown» and
      // render text instead of a link that goes nowhere.
      customerId: inv.customerId ?? inv.customer_id ?? inv.customer?.id ?? undefined,
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
