// packages/ui/src/components/ui/customers/datagrid/columns/interaction-columns.ts
import { Phone, Mail, MessageSquare, Calendar, FileText } from "lucide-react"
import type { ColumnDef } from "../datagrid"

export interface InteractionRow {
  id: string
  type: string
  subject: string
  content?: string
  date: string
  user?: string
}

const iconMap: Record<string, any> = {
  call: Phone,
  email: Mail,
  sms: MessageSquare,
  meeting: Calendar,
  note: FileText,
}

export function getInteractionColumns(t: (key: string, fallback?: string) => string): ColumnDef<InteractionRow>[] {
  return [
    {
      id: 'type',
      header: t("crm.type", "نوع"),
      accessor: (row) => row.type,
      width: 60,
      render: (value: string) => {
        const Icon = iconMap[value] || FileText
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--surface-muted))]">
            <Icon className="size-4 text-[hsl(var(--fg-secondary))]" />
          </div>
        )
      },
    },
    {
      id: 'subject',
      header: t("crm.subject", "موضوع"),
      accessor: (row) => row.subject || row.type,
    },
    {
      id: 'content',
      header: t("crm.description", "توضیحات"),
      accessor: (row) => row.content || '-',
    },
    {
      id: 'date',
      header: t("crm.date", "تاریخ"),
      accessor: (row) => row.date,
      type: 'date',
      width: 120,
    },
  ]
}