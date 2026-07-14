// 
// packages/ui/src/components/ui/customers/datagrid/columns/payment-columns.ts
import type { ColumnDef } from "../datagrid"

export interface PaymentRow {
  id: string
  amount: number
  date: string
  method: string
  status: string
  reference?: string
}

export function getPaymentColumns(t: (key: string, fallback?: string) => string): ColumnDef<PaymentRow>[] {
  return [
    {
      id: 'amount',
      header: t("payments.amount", "مبلغ"),
      accessor: (row) => row.amount,
      type: 'currency',
      align: 'right',
      width: 130,
    },
    {
      id: 'date',
      header: t("payments.date", "تاریخ"),
      accessor: (row) => row.date,
      type: 'date',
      width: 120,
    },
    {
      id: 'method',
      header: t("payments.method", "روش"),
      accessor: (row) => row.method,
      width: 100,
    },
    {
      id: 'reference',
      header: t("payments.reference", "مرجع"),
      accessor: (row) => row.reference || '-',
      width: 140,
    },
    {
      id: 'status',
      header: t("payments.status", "وضعیت"),
      accessor: (row) => row.status,
      type: 'badge',
      width: 110,
    },
  ]
}