'use client'

// ============================================
// packages/ui/src/components/ui/dashboard/open-repair-tickets-card.tsx
//
// V69.5 Industry Dashboard Part: Open Repair Tickets (repairs archetype)
// Reads from `useOpenRepairTickets` (local-engine or server).
// Shows active repair tickets by technician and status.
// ============================================

import { Wrench, ArrowLeft } from 'lucide-react'
import { useOpenRepairTickets, type OpenRepairTicketItem } from '@hisabche/api'
import { DataTable, type TableColumn } from '../data-table'
import { Button } from '../button'

interface OpenRepairTicketsCardProps {
  t: (key: string, fallback?: string) => string
  locale: string
  enabled: boolean
  onOpen: () => void
}

export function OpenRepairTicketsCard({ t, enabled, onOpen }: OpenRepairTicketsCardProps) {
  const query = useOpenRepairTickets({ enabled })
  const data = query.data

  if (!enabled || data?.hidden) return null

  const items = data?.items ?? []
  const hasItems = items.length > 0

  const columns: TableColumn<OpenRepairTicketItem>[] = [
    {
      id: 'ticket',
      labelKey: 'dashboard.openRepairTickets.ticket',
      labelFallback: 'شماره قبض',
      locked: true,
      sortValue: (row) => row.number,
      render: (row) => `#${row.number}`,
    },
    {
      id: 'device',
      labelKey: 'dashboard.openRepairTickets.device',
      labelFallback: 'دستگاه',
      render: (row) => row.deviceLabel,
    },
    {
      id: 'problem',
      labelKey: 'dashboard.openRepairTickets.problem',
      labelFallback: 'ایراد',
      showFrom: 'lg',
      render: (row) => row.problem,
    },
    {
      id: 'technician',
      labelKey: 'dashboard.openRepairTickets.technician',
      labelFallback: 'تکنسین',
      showFrom: 'md',
      render: (row) => row.technicianName ?? '—',
    },
    {
      id: 'status',
      labelKey: 'dashboard.openRepairTickets.status',
      labelFallback: 'وضعیت',
      render: (row) => (
        <span className="rounded-full bg-[hsl(var(--surface-muted))] px-2 py-0.5 text-[11px] font-medium">
          {t(`dashboard.openRepairTickets.statuses.${row.status}`, row.status)}
        </span>
      ),
    },
  ]

  return (
    <section
      data-dashboard-part="openRepairTickets"
      className="mt-4 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4"
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
          <Wrench className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          {t('dashboard.openRepairTickets.title', 'قبض‌های تعمیر باز')}
        </h2>
        <Button type="button" variant="ghost" size="sm" onClick={onOpen} className="gap-1 text-xs">
          <span>{t('dashboard.viewAll', 'مشاهده همه')}</span>
          <ArrowLeft className="size-3" aria-hidden="true" />
        </Button>
      </header>

      {query.isError || data?.unavailable ? (
        <div className="rounded-xl border border-[hsl(var(--color-warning)/0.4)] bg-[hsl(var(--color-warning)/0.08)] p-3 text-xs text-[hsl(var(--fg-secondary))]">
          {t('dashboard.partUnavailable', 'این عدد روی این دستگاه خوانده نشد.')}
        </div>
      ) : query.isLoading ? (
        <p className="text-xs text-[hsl(var(--fg-secondary))]">
          {t('common.loading', 'در حال بارگذاری...')}
        </p>
      ) : !hasItems ? (
        <div className="rounded-xl bg-[hsl(var(--surface-muted))] p-3 text-xs text-[hsl(var(--fg-secondary))]">
          {data?.totalTickets === 0
            ? t('dashboard.openRepairTickets.noTickets', 'هنوز هیچ قبض تعمیری ثبت نشده است.')
            : t('dashboard.openRepairTickets.empty', 'قبض تعمیر بازی در جریان نیست.')}
        </div>
      ) : (
        <DataTable
          tableId="dashboard-open-repair-tickets"
          t={t}
          rows={items.slice(0, 5)}
          columns={columns}
          rowKey={(row) => row.id}
          paginate={false}
        />
      )}
    </section>
  )
}
