'use client'

// ============================================
// packages/ui/src/components/ui/dashboard/today-sessions-card.tsx
//
// V69.5 Industry Dashboard Part: Today's Sessions & Deposits Held (salon/barber archetype)
// Reads from `useTodaySessions` (local-engine or server).
// Shows scheduled/checked-in sessions by practitioner and held deposits.
// ============================================

import { Calendar, ArrowLeft } from 'lucide-react'
import { formatNumber } from '@hisabche/formatting'
import { useTodaySessions, type TodaySessionItem } from '@hisabche/api'
import { DataTable, type TableColumn } from '../data-table'
import { Button } from '../button'

interface TodaySessionsCardProps {
  t: (key: string, fallback?: string) => string
  locale: string
  enabled: boolean
  onOpen: () => void
}

export function TodaySessionsCard({ t, locale, enabled, onOpen }: TodaySessionsCardProps) {
  const query = useTodaySessions({ enabled })
  const data = query.data

  if (!enabled || data?.hidden) return null

  const sessions = data?.sessions ?? []
  const hasSessions = sessions.length > 0
  const depositsHeld = data?.depositsHeld ?? []

  const columns: TableColumn<TodaySessionItem>[] = [
    {
      id: 'customer',
      labelKey: 'dashboard.todaySessions.customer',
      labelFallback: 'مشتری',
      locked: true,
      sortValue: (row) => row.customerName,
      render: (row) => row.customerName,
    },
    {
      id: 'service',
      labelKey: 'dashboard.todaySessions.service',
      labelFallback: 'خدمت',
      render: (row) => row.serviceName,
    },
    {
      id: 'specialist',
      labelKey: 'dashboard.todaySessions.specialist',
      labelFallback: 'متخصص',
      showFrom: 'md',
      render: (row) => row.practitionerName ?? '—',
    },
    {
      id: 'time',
      labelKey: 'dashboard.todaySessions.time',
      labelFallback: 'ساعت',
      showFrom: 'sm',
      render: (row) => row.time,
    },
    {
      id: 'status',
      labelKey: 'dashboard.todaySessions.status',
      labelFallback: 'وضعیت',
      render: (row) => (
        <span className="rounded-full bg-[hsl(var(--surface-muted))] px-2 py-0.5 text-[11px] font-medium">
          {t(`dashboard.todaySessions.statuses.${row.status}`, row.status)}
        </span>
      ),
    },
  ]

  return (
    <section
      data-dashboard-part="todaySessions"
      className="mt-4 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4"
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
          <Calendar className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          {t('dashboard.todaySessions.title', 'نوبت‌های امروز')}
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
      ) : !hasSessions ? (
        <div className="rounded-xl bg-[hsl(var(--surface-muted))] p-3 text-xs text-[hsl(var(--fg-secondary))]">
          {t('dashboard.todaySessions.empty', 'امروز هیچ نوبتی ثبت نشده است.')}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-xl bg-[hsl(var(--surface-muted))] p-2.5">
              <span className="text-[hsl(var(--fg-secondary))]">
                {t('dashboard.todaySessions.total', 'کل نوبت‌ها')}
              </span>
              <p className="mt-1 font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
                {data ? formatNumber(data.totalSessions, locale, 0) : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-[hsl(var(--surface-muted))] p-2.5">
              <span className="text-[hsl(var(--fg-secondary))]">
                {t('dashboard.todaySessions.depositsHeld', 'ودیعه‌های نزد ما')}
              </span>
              <p className="mt-1 font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
                {depositsHeld.length === 0
                  ? '—'
                  : depositsHeld
                      .map(
                        (held) => `${formatNumber(held.amountMinor, locale, 0)} ${held.currency}`,
                      )
                      .join(' · ')}
              </p>
            </div>
          </div>

          <DataTable
            tableId="dashboard-today-sessions"
            t={t}
            rows={sessions.slice(0, 5)}
            columns={columns}
            rowKey={(row) => row.id}
            paginate={false}
          />
        </div>
      )}
    </section>
  )
}
