// packages/ui/src/lib/invoices-mappers.ts
import type { RawInvoice, Invoice } from "./invoices-types"
import { fmtDate } from "./invoices-format"

export const mapInvoices = (rawInvoices: RawInvoice[] | undefined): Invoice[] => {
  if (!rawInvoices) return []
  
  return rawInvoices.map((inv) => {
    const publicToken = inv.publicToken ?? inv.public_token;
    return {
      id: inv.id ?? inv._id ?? inv.invoiceId ?? inv.invoice_id ?? "",
      invoiceNumber: inv.invoiceNumber ?? inv.invoice_number ?? "???",
      date: inv.date ? fmtDate(inv.date) : "",
      createdAt: inv.created_at ? fmtDate(inv.created_at) : (inv.date ? fmtDate(inv.date) : ""),
      status: inv.status ?? "",
      total: inv.total ?? 0,
      currency: inv.currency ?? "AFN",
      type: inv.type ?? "sale",
      customerName: inv.customerName ?? inv.customer?.full_name ?? "",
      // TODO: no `company` column on customers yet — always blank until that schema field exists
      company: inv.customer?.company ?? "",
      paymentDate: (inv.status === "completed" && inv.updated_at) ? fmtDate(inv.updated_at) : "",
      itemsSent: inv.itemsSent ?? 0,
      ...(publicToken !== undefined && { publicToken }),
    };
  })
}