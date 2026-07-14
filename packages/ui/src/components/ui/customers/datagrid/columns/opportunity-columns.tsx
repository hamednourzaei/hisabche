// packages/ui/src/components/ui/customers/datagrid/columns/opportunity-columns.ts
import type { ColumnDef } from "../datagrid"

export interface OpportunityRow {
  id: string
  title: string
  stage: string
  value: number
  probability: number
  expectedCloseDate?: string
}

export function getOpportunityColumns(t: (key: string, fallback?: string) => string): ColumnDef<OpportunityRow>[] {
  const stageLabels: Record<string, string> = {
    lead: t("crm.stageLead", "سرنخ"),
    qualified: t("crm.stageQualified", "واجد شرایط"),
    proposal: t("crm.stageProposal", "پیشنهاد"),
    negotiation: t("crm.stageNegotiation", "مذاکره"),
    won: t("crm.stageWon", "برنده"),
    lost: t("crm.stageLost", "از دست رفته"),
  }

  return [
    {
      id: 'title',
      header: t("crm.opportunity", "فرصت"),
      accessor: (row) => row.title,
    },
    {
      id: 'stage',
      header: t("crm.stage", "مرحله"),
      accessor: (row) => row.stage,
      type: 'badge',
      width: 120,
      render: (value: string) => (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]">
          {stageLabels[value] || value}
        </span>
      ),
    },
    {
      id: 'value',
      header: t("crm.value", "مبلغ"),
      accessor: (row) => row.value,
      type: 'currency',
      align: 'right',
      width: 130,
    },
    {
      id: 'probability',
      header: t("crm.probability", "احتمال"),
      accessor: (row) => row.probability,
      align: 'center',
      width: 80,
      render: (value: number) => (
        <span className="text-sm font-medium tabular-nums">{value}%</span>
      ),
    },
    {
      id: 'expectedCloseDate',
      header: t("crm.closeDate", "تاریخ بسته شدن"),
      accessor: (row) => row.expectedCloseDate,
      type: 'date',
      width: 130,
    },
  ]
}