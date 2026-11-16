'use client'

// ============================================
// packages/ui/src/components/ui/dashboard/low-stock-variants-card.tsx
//
// V69.5 Industry Dashboard Part: Low Stock Variants (clothing/retail archetype)
// Reads from `useLowStockVariants` (local-engine or server).
// Shows variants whose inventory level is below minimum threshold.
// ============================================

import { Shirt, ArrowLeft } from 'lucide-react'
import { formatNumber } from '@hisabche/formatting'
import { useLowStockVariants, type LowStockVariantItem } from '@hisabche/api'
import { DataTable, type TableColumn } from '../data-table'
import { Button } from '../button'

interface LowStockVariantsCardProps {
  t: (key: string, fallback?: string) => string
  locale: string
  enabled: boolean
  onOpen: () => void
}

export function LowStockVariantsCard({ t, locale, enabled, onOpen }: LowStockVariantsCardProps) {
  const query = useLowStockVariants({ enabled })
  const data = query.data

  if (!enabled || data?.hidden) return null

  const items = data?.items ?? []
  const hasItems = items.length > 0

  const columns: TableColumn<LowStockVariantItem>[] = [
    {
      id: 'product',
      labelKey: 'dashboard.lowStockVariants.product',
      labelFallback: 'کالا',
      locked: true,
      sortValue: (row) => row.productName,
      render: (row) => row.productName,
    },
    {
      id: 'variant',
      labelKey: 'dashboard.lowStockVariants.variant',
      labelFallback: 'واریانت',
      render: (row) =>
        row.attributes.map((attribute) => `${attribute.name}: ${attribute.value}`).join(' | ') ||
        row.sku,
    },
    {
      id: 'stock',
      labelKey: 'dashboard.lowStockVariants.stock',
      labelFallback: 'موجودی',
      align: 'end',
      sortValue: (row) => row.currentStock,
      render: (row) => (
        <span className="font-semibold tabular-nums text-[hsl(var(--color-destructive))]">
          {formatNumber(row.currentStock, locale, 0)}
        </span>
      ),
    },
    {
      id: 'min',
      labelKey: 'dashboard.lowStockVariants.min',
      labelFallback: 'حداقل',
      showFrom: 'sm',
      align: 'end',
      render: (row) => (
        <span className="tabular-nums">{formatNumber(row.minStock, locale, 0)}</span>
      ),
    },
  ]

  return (
    <section
      data-dashboard-part="lowStockVariants"
      className="mt-4 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4"
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
          <Shirt className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          {t('dashboard.lowStockVariants.title', 'واریانت‌های با موجودی کم')}
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
          {data?.variantsCount === 0
            ? t('dashboard.lowStockVariants.noVariants', 'هنوز واریانت کالایی ثبت نشده است.')
            : t('dashboard.lowStockVariants.empty', 'تمام واریانت‌ها موجودی کافی دارند.')}
        </div>
      ) : (
        <DataTable
          tableId="dashboard-low-stock-variants"
          t={t}
          rows={items.slice(0, 5)}
          columns={columns}
          rowKey={(row) => row.variantId}
          paginate={false}
        />
      )}
    </section>
  )
}
