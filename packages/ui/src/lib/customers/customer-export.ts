// ============================================
// Customer statement export.
//
// One row per invoice line, not per invoice: a line is where unit, quantity,
// weight and the nested detail breakdown live, and flattening them away would
// lose exactly the information a gold trader opens the export for.
//
// Purchases are NOT folded into sales. Every row carries its own `type`, so a
// statement that mixes both stays readable and the totals can be re-derived.
// ============================================

export interface ExportableInvoiceDetail {
  title: string
  quantity: number
  amount: number
}

export interface ExportableInvoiceItem {
  productName?: string | undefined
  quantity?: number | undefined
  unit?: string | undefined
  unitLabel?: string | undefined
  unitPrice?: number | undefined
  totalPrice?: number | undefined
  weightGrams?: number | undefined
  details?: readonly ExportableInvoiceDetail[] | undefined
}

export interface ExportableInvoice {
  invoiceNumber?: string | undefined
  date?: string | undefined
  type?: string | undefined
  total?: number | undefined
  paidAmount?: number | undefined
  status?: string | undefined
  currency?: string | undefined
  items?: readonly ExportableInvoiceItem[] | undefined
}

/** Column order is the export's contract — keep it stable for downstream sheets. */
export const CUSTOMER_EXPORT_COLUMNS = [
  'invoiceNumber',
  'date',
  'type',
  'party',
  'status',
  'productName',
  'quantity',
  'unit',
  'weightGrams',
  'unitPrice',
  'lineTotal',
  'details',
  'invoiceTotal',
  'paidAmount',
  'remaining',
] as const

export type CustomerExportColumn = (typeof CUSTOMER_EXPORT_COLUMNS)[number]

export type CustomerExportRow = Record<CustomerExportColumn, string | number>

export interface BuildCustomerExportOptions {
  /** The counterparty — the customer whose statement this is. */
  party: string
  /** Resolves `unit` to a display label; `custom` units carry their own. */
  unitLabel: (unit: string, unitLabel?: string | undefined) => string
}

function formatDetails(details: readonly ExportableInvoiceDetail[]): string {
  // Encoded into one cell rather than spread across extra columns: the number
  // of details varies per line, and a ragged header would break spreadsheets.
  return details.map((d) => `${d.title}: ${d.quantity} × ${d.amount}`).join(' | ')
}

/**
 * Flatten invoices into export rows.
 *
 * An invoice with no line items still yields one row — it exists in the ledger
 * and dropping it would make the statement's totals fail to reconcile.
 */
export function buildCustomerExportRows(
  invoices: readonly ExportableInvoice[],
  { party, unitLabel }: BuildCustomerExportOptions,
): CustomerExportRow[] {
  return invoices.flatMap((invoice) => {
    // Legacy invoices predate the sale/purchase split and are sales — the same
    // convention the backend queries use.
    const type = invoice.type ?? 'sale'
    const total = invoice.total ?? 0
    const paid = invoice.paidAmount ?? 0

    const base = {
      invoiceNumber: invoice.invoiceNumber ?? '',
      date: invoice.date ?? '',
      type,
      party,
      status: invoice.status ?? '',
      invoiceTotal: total,
      paidAmount: paid,
      remaining: Math.max(0, total - paid),
    }

    const items = invoice.items ?? []

    if (items.length === 0) {
      return [
        {
          ...base,
          productName: '',
          quantity: '',
          unit: '',
          weightGrams: '',
          unitPrice: '',
          lineTotal: '',
          details: '',
        } satisfies CustomerExportRow,
      ]
    }

    return items.map((item) => {
      const details = item.details ?? []

      return {
        ...base,
        productName: item.productName ?? '',
        quantity: item.quantity ?? '',
        unit: unitLabel(item.unit ?? 'piece', item.unitLabel),
        // 0 g is not the same as "no weight recorded" — only emit a value when
        // the line actually carries one.
        weightGrams: item.weightGrams ?? '',
        unitPrice: item.unitPrice ?? '',
        lineTotal: item.totalPrice ?? '',
        details: formatDetails(details),
      } satisfies CustomerExportRow
    })
  })
}
