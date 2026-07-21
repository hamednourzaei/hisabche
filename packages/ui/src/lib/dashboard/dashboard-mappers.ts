// packages/ui/src/lib/dashboard/dashboard-mappers.ts
import { num, fmtDate } from "./dashboard-format";
import type { RawInvoice } from "./dashboard-types";

export const mapRecentInvoices = (
  invoices: RawInvoice[] | undefined,
  translate: (key: string) => string
) => {
  if (!invoices || !Array.isArray(invoices)) return [];

  return invoices.slice(0, 5).map((inv) => ({
    id: inv.id ?? "",
    customer: inv.customer_name ?? inv.customerName ?? translate("common.noName"),
    total: num(inv.total),
    date: fmtDate(inv.date ?? inv.created_at ?? ""),
  }));
};

export const mapLowStockItems = (
  products: Array<{
    id?: string;
    name: string;
    quantity: number;
    reorderPoint?: number;
  }> | undefined
) => {
  if (!products || !Array.isArray(products)) return [];

  return products
    .filter((p) => {
      const threshold = p.reorderPoint ?? 10;
      return p.quantity <= threshold;
    })
    .slice(0, 5)
    .map((p) => ({
      name: p.name,
      quantity: p.quantity,
    }));
};