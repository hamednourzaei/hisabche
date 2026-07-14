// packages/ui/src/components/ui/customers/datagrid/columns/invoice-columns.ts
import type { ColumnDef } from "../datagrid"

export interface InvoiceRow {
  id: string
  invoiceNumber: string
  date: string
  total: number
  paidAmount: number
  remaining: number
  status: string
  currency?: string
}

export function getInvoiceColumns(t: (key: string, fallback?: string) => string): ColumnDef<InvoiceRow>[] {
  return [
    {
      id: 'invoiceNumber',
      header: t("invoices.number", "شماره"),
      accessor: (row) => `#${row.invoiceNumber}`,
      width: 140,
    },
    {
      id: 'date',
      header: t("invoices.date", "تاریخ"),
      accessor: (row) => row.date,
      type: 'date',
      width: 120,
    },
    {
      id: 'total',
      header: t("invoices.total", "مبلغ کل"),
      accessor: (row) => row.total,
      type: 'currency',
      align: 'right',
      width: 130,
    },
    {
      id: 'paidAmount',
      header: t("invoices.paid", "پرداخت شده"),
      accessor: (row) => row.paidAmount,
      type: 'currency',
      align: 'right',
      width: 130,
    },
    {
      id: 'remaining',
      header: t("invoices.remaining", "مانده"),
      accessor: (row) => row.remaining,
      type: 'currency',
      align: 'right',
      width: 130,
      render: (value: number) => (
        <span className={value > 0 ? "text-[hsl(var(--color-destructive))] font-bold tabular-nums" : "text-[hsl(var(--color-success))] tabular-nums"}>
          {new Intl.NumberFormat('fa-IR').format(value)} AFN
        </span>
      ),
    },
    {
      id: 'status',
      header: t("invoices.status", "وضعیت"),
      accessor: (row) => row.status,
      type: 'badge',
      width: 110,
    },
  ]
}