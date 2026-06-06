// packages/ui/src/lib/invoices-mappers.ts
import type { RawInvoice, Invoice } from "./invoices-types"
import { fmtDate } from "./invoices-format"

export const mapInvoices = (rawInvoices: RawInvoice[] | undefined): Invoice[] => {
  if (!rawInvoices) return []
  
  return rawInvoices.map((inv) => ({
    id: inv.id ?? inv._id ?? inv.invoiceId ?? inv.invoice_id ?? "",
    invoiceNumber: inv.invoiceNumber ?? inv.invoice_number ?? "???",
    date: inv.date ? fmtDate(inv.date) : "",
    status: inv.status ?? "",
    total: inv.total ?? 0,
    currency: inv.currency ?? "AFN",
  }))
}