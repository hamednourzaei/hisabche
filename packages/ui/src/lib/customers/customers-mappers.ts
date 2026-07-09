// packages/ui/src/lib/customers/customers-mappers.ts
import type { Customer, InvoiceForDebt, OpenInvoice, CustomerWithDebt } from "./customers-types"
import { remaining, fmtDate } from "./customers-format"

export const mapCustomerWithDebt = (
  customers: Customer[] | undefined,
  invoices: InvoiceForDebt[] | undefined
): CustomerWithDebt[] => {
  if (!customers || !invoices) return []

  return customers.map((c) => {
    const openInvs = invoices.filter(
      (inv) =>
        inv.customerId === c.id &&
        (inv.status === "pending" || inv.status === "partial")
    )
    const totalDebt = openInvs.reduce(
      (s, inv) => s + remaining(inv.total, inv.paidAmount),
      0
    )
    return {
      ...c,
      totalDebt,
      openCount: openInvs.length,
    }
  }).sort((a, b) => (b.totalDebt ?? 0) - (a.totalDebt ?? 0))
}

export const mapOpenInvoices = (
  invoices: InvoiceForDebt[] | undefined,
  customerId: string
): OpenInvoice[] => {
  if (!invoices) return []

  return invoices
    .filter(
      (inv) =>
        inv.customerId === customerId &&
        (inv.status === "pending" || inv.status === "partial")
    )
    .map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber ?? "",
      total: inv.total,
      paidAmount: inv.paidAmount,
      remaining: remaining(inv.total, inv.paidAmount),
      date: fmtDate(inv.date),
      status: inv.status,
    }))
}

export const mapCustomerDetail = (
  customers: Customer[] | undefined,
  customerId: string,
  t: (key: string) => string
): { id: string; name: string; phone?: string } | null => {
  if (!customers) return null
  const found = customers.find((c) => c.id === customerId)
  if (!found) return null
  return {
    id: found.id,
    name: found.fullName || found.name || t("common.noName"),
    phone: found.phone || "",
  }
}