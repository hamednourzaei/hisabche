// packages/ui/src/components/ui/customers/datagrid/columns/timeline-columns.tsx
import React from "react"
import { Phone, Mail, MessageSquare, Calendar, FileText, Receipt, DollarSign } from "lucide-react"
import type { ColumnDef } from "../datagrid"

export interface TimelineRow {
  id: string
  type: 'invoice_created' | 'payment_received' | 'call' | 'email' | 'sms' | 'meeting' | 'note' | 'opportunity_created'
  date: string
  title: string
  description?: string
  amount?: number
  user?: string
}

const iconMap: Record<string, any> = {
  invoice_created: Receipt,
  payment_received: DollarSign,
  call: Phone,
  email: Mail,
  sms: MessageSquare,
  meeting: Calendar,
  note: FileText,
  opportunity_created: DollarSign,
}

export function getTimelineColumns(t: (key: string, fallback?: string) => string): ColumnDef<TimelineRow>[] {
  return [
    {
      id: 'type',
      header: "",
      accessor: (row) => row.type,
      width: 50,
      render: (value: string) => {
        const Icon = iconMap[value] || FileText
        return React.createElement('div', {
          className: "flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--surface-muted))]"
        }, React.createElement(Icon, { className: "size-4 text-[hsl(var(--fg-secondary))]" }))
      },
    },
    {
      id: 'title',
      header: t("common.event", "رویداد"),
      accessor: (row) => row.title,
    },
    {
      id: 'description',
      header: t("common.description", "توضیحات"),
      accessor: (row) => row.description || '-',
    },
    {
      id: 'amount',
      header: t("common.amount", "مبلغ"),
      accessor: (row) => row.amount,
      type: 'currency',
      align: 'right',
      width: 120,
    },
    {
      id: 'date',
      header: t("common.date", "تاریخ"),
      accessor: (row) => row.date,
      type: 'date',
      width: 120,
    },
  ]
}