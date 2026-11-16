'use client'

// ============================================
// packages/ui/src/components/ui/dashboard/package-credits-low-card.tsx
//
// V69.5 Industry Dashboard Part: Package Credits Low (education archetype)
// Reads from `usePackageCreditsLow` (local-engine or server).
// Shows student course packages nearing exhaustion of credit sessions.
// ============================================

import { GraduationCap, ArrowLeft } from 'lucide-react'
import { formatNumber } from '@hisabche/formatting'
import { usePackageCreditsLow, type PackageCreditLowItem } from '@hisabche/api'
import { DataTable, type TableColumn } from '../data-table'
import { Button } from '../button'

interface PackageCreditsLowCardProps {
  t: (key: string, fallback?: string) => string
  locale: string
  enabled: boolean
  onOpen: () => void
}

export function PackageCreditsLowCard({ t, locale, enabled, onOpen }: PackageCreditsLowCardProps) {
  const query = usePackageCreditsLow({ enabled })
  const data = query.data

  if (!enabled || data?.hidden) return null

  const items = data?.items ?? []
  const hasItems = items.length > 0

  const columns: TableColumn<PackageCreditLowItem>[] = [
    {
      id: 'customer',
      labelKey: 'dashboard.packageCreditsLow.customer',
      labelFallback: 'دانش‌آموز / دانشجو',
      locked: true,
      sortValue: (row) => row.customerName,
      render: (row) => row.customerName,
    },
    {
      id: 'package',
      labelKey: 'dashboard.packageCreditsLow.package',
      labelFallback: 'بسته / دوره',
      render: (row) => row.packageName,
    },
    {
      id: 'remaining',
      labelKey: 'dashboard.packageCreditsLow.remaining',
      labelFallback: 'مانده جلسات',
      align: 'end',
      sortValue: (row) => row.remainingCredits,
      render: (row) => (
        <span className="font-semibold tabular-nums text-[hsl(var(--color-destructive))]">
          {formatNumber(row.remainingCredits, locale, 0)}
        </span>
      ),
    },
    {
      id: 'total',
      labelKey: 'dashboard.packageCreditsLow.total',
      labelFallback: 'کل اعتبار',
      showFrom: 'sm',
      align: 'end',
      render: (row) => (
        <span className="tabular-nums">{formatNumber(row.totalCredits, locale, 0)}</span>
      ),
    },
  ]

  return (
    <section
      data-dashboard-part="packageCreditsLow"
      className="mt-4 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4"
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
          <GraduationCap className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          {t('dashboard.packageCreditsLow.title', 'بسته‌های در آستانه اتمام')}
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
          {data?.packagesCount === 0
            ? t('dashboard.packageCreditsLow.noPackages', 'هنوز هیچ بسته‌ای تخصیص نیافته است.')
            : t('dashboard.packageCreditsLow.empty', 'هیچ بسته‌ای در آستانه اتمام اعتبار نیست.')}
        </div>
      ) : (
        <DataTable
          tableId="dashboard-package-credits-low"
          t={t}
          rows={items.slice(0, 5)}
          columns={columns}
          rowKey={(row) => `${row.customerId}:${row.packageProductId}`}
          paginate={false}
        />
      )}
    </section>
  )
}
