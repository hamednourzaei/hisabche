// packages/ui/src/lib/dashboard-mappers.ts
import { num, fmtDate } from "./dashboard-format"
import type { RawInvoice } from "./dashboard-types"

export const mapRecentInvoices = (
  invoices: RawInvoice[] | undefined,
  translate: (key: string) => string  // فقط key می‌گیرد، بدون fallback
) => {
  if (!invoices || !Array.isArray(invoices)) return []
  
  return invoices.slice(0, 5).map((inv) => ({
    id: inv.id ?? "",
    customer: inv.customer_name ?? inv.customerName ?? translate("common.noName"),
    total: num(inv.total),
    date: fmtDate(inv.date ?? inv.created_at ?? ""),
  }))
}