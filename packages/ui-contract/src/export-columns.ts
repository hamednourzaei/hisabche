// ============================================
// Export column contracts.
//
// An export is the one artefact that leaves the product and gets filed and
// reconciled. Two platforms exporting "the same" invoice list with different
// columns — or the same column under a different heading — produces two
// spreadsheets that cannot be compared, which is worse than no export.
//
// So the columns live here as data: which field, in what order, under which
// translation key. Each renderer resolves the labels with its own `t` and hands
// the result to `toCSV` from `@hisabche/formatting`.
// ============================================

export interface ExportColumn {
  /** Field on the exported row. */
  key: string
  labelKey: string
  /** Shown when a catalog is missing the key, so an export never emits a raw key. */
  fallback: string
}

/**
 * Invoice list export.
 *
 * `typeLabel` is first and is a *localised* field, not the raw `type`: a
 * purchase must never leave the product labelled "sale". `party` is deliberately
 * neutral («طرف حساب») because the export mixes both directions — the same
 * reasoning the invoices table applies to its party column.
 */
export const INVOICE_EXPORT_COLUMNS: readonly ExportColumn[] = [
  { key: 'typeLabel', labelKey: 'invoices.type', fallback: 'نوع' },
  { key: 'invoiceNumber', labelKey: 'invoices.invoiceNumber', fallback: 'شماره فاکتور' },
  { key: 'date', labelKey: 'invoices.date', fallback: 'تاریخ' },
  { key: 'customerName', labelKey: 'invoices.party', fallback: 'طرف حساب' },
  { key: 'company', labelKey: 'invoices.company', fallback: 'شرکت' },
  { key: 'total', labelKey: 'invoices.total', fallback: 'مبلغ' },
  { key: 'currency', labelKey: 'invoices.currency', fallback: 'ارز' },
  { key: 'status', labelKey: 'invoices.status', fallback: 'وضعیت' },
  { key: 'paymentDate', labelKey: 'invoices.paymentDate', fallback: 'تاریخ تسویه' },
]

/** Translation key for a transaction type's exported label. */
export function invoiceTypeLabelKey(type: string | null | undefined): string {
  return `invoices.type.${type || 'sale'}`
}

/** Resolve a contract into the `{ key, label }` pairs `toCSV` consumes. */
export function resolveExportColumns<T>(
  columns: readonly ExportColumn[],
  t: (key: string, fallback?: string) => string,
): { key: keyof T; label: string }[] {
  return columns.map((column) => ({
    key: column.key as keyof T,
    label: t(column.labelKey, column.fallback),
  }))
}
