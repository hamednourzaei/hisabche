// packages/ui/src/components/ui/dashboard/business-health-panel.tsx
'use client'

import { memo, useMemo, useId } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '../../../lib/utils'
import {
  TrendingUp,
  TrendingDown,
  Receipt,
  AlertTriangle,
  Package,
  Users,
  ArrowRight,
  CheckCircle,
  Clock,
  FileText,
  ShoppingCart,
} from 'lucide-react'
import { useCurrency } from '../../../hooks/dashboard/use-currency'

// ─── Types ────────────────────────────────────────────────────────────────

interface BusinessHealthData {
  todaySales: number
  todayInvoices: number
  monthlyRevenue: number
  monthlyGrowth: number
  pendingPayments: number
  pendingPaymentsCount: number
  activeCustomers: number
  customerGrowth: number
  lowStockAlerts: number
  lowStockItems: Array<{ name: string; quantity: number }>
}

interface BusinessHealthPanelProps {
  data: BusinessHealthData
  isLoading: boolean
  onAction: (action: 'invoice' | 'payments' | 'warehouse' | 'customers' | 'buy') => void
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

const BusinessHealthSkeleton = memo(function BusinessHealthSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="h-28 sm:h-32 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="h-20 sm:h-24 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
        <div className="h-20 sm:h-24 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="h-16 sm:h-20 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
        <div className="h-16 sm:h-20 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
      </div>
    </div>
  )
})
BusinessHealthSkeleton.displayName = 'BusinessHealthSkeleton'

// ─── Status Badge ──────────────────────────────────────────────────────────

const StatusBadge = memo(function StatusBadge({
  status,
}: {
  status: 'excellent' | 'good' | 'neutral' | 'attention'
}) {
  const t = useTranslations()

  const statusMap = useMemo(
    () => ({
      excellent: {
        icon: CheckCircle,
        label: t('status.excellent'),
        className:
          'bg-[hsl(var(--status-positive)/0.1)] text-[hsl(var(--status-positive))] border-[hsl(var(--status-positive)/0.2)]',
      },
      good: {
        icon: TrendingUp,
        label: t('status.good'),
        className:
          'bg-[hsl(var(--status-info)/0.1)] text-[hsl(var(--status-info))] border-[hsl(var(--status-info)/0.2)]',
      },
      neutral: {
        icon: Clock,
        label: t('status.neutral'),
        className:
          'bg-[hsl(var(--status-warning)/0.1)] text-[hsl(var(--status-warning))] border-[hsl(var(--status-warning)/0.2)]',
      },
      attention: {
        icon: AlertTriangle,
        label: t('status.attention'),
        className:
          'bg-[hsl(var(--status-negative)/0.1)] text-[hsl(var(--status-negative))] border-[hsl(var(--status-negative)/0.2)]',
      },
    }),
    [t],
  )

  const { icon: Icon, label, className } = statusMap[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 sm:px-3 py-0.5 sm:py-1 text-[9px] sm:text-xs font-medium border',
        className,
      )}
    >
      <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </span>
  )
})
StatusBadge.displayName = 'StatusBadge'

// ─── BusinessHealthHero ────────────────────────────────────────────────────

const BusinessHealthHero = memo(function BusinessHealthHero({
  todaySales,
  todayInvoices,
  monthlyGrowth,
  isLoading,
  onAction,
  formatCurrency,
}: {
  todaySales: number
  todayInvoices: number
  monthlyGrowth: number
  isLoading: boolean
  onAction: () => void
  formatCurrency: (v: number) => string
}) {
  const t = useTranslations()
  const descriptionId = useId()

  const { status, statusText, interpretation } = useMemo(() => {
    if (monthlyGrowth >= 15) {
      return {
        status: 'excellent' as const,
        statusText: t('health.excellent'),
        interpretation: t('health.excellentDetail'),
      }
    } else if (monthlyGrowth >= 5) {
      return {
        status: 'good' as const,
        statusText: t('health.good'),
        interpretation: t('health.goodDetail'),
      }
    } else if (monthlyGrowth >= -5) {
      return {
        status: 'neutral' as const,
        statusText: t('health.neutral'),
        interpretation: t('health.neutralDetail'),
      }
    } else {
      return {
        status: 'attention' as const,
        statusText: t('health.attention'),
        interpretation: t('health.attentionDetail'),
      }
    }
  }, [monthlyGrowth, t])

  if (isLoading) {
    return <div className="h-28 sm:h-32 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
  }

  return (
    <button
      onClick={onAction}
      className={cn(
        'relative w-full rounded-2xl p-4 sm:p-6 text-start transition-all duration-200',
        'border-2 border-[hsl(var(--border-default))]',
        'bg-gradient-to-br from-[hsl(var(--surface-elevated))] to-[hsl(var(--surface-muted))]',
        'motion-safe:hover:scale-[1.01] hover:shadow-lg',
        'focus-visible:ring-4 focus-visible:ring-[hsl(var(--color-primary)/0.3)] focus-visible:outline-none',
      )}
      aria-describedby={descriptionId}
    >
      <div id={descriptionId} className="sr-only">
        {statusText}. {interpretation}.{' '}
        {t('health.salesSummary', {
          sales: formatCurrency(todaySales),
          invoices: todayInvoices,
        })}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-0">
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <h2 className="text-sm sm:text-lg font-semibold text-[hsl(var(--fg-primary))]">
              {t('health.title')}
            </h2>
            <StatusBadge status={status} />
          </div>
          <p className="text-base sm:text-xl font-bold text-[hsl(var(--fg-primary))]">
            {statusText}
          </p>
          <p className="text-xs sm:text-sm text-[hsl(var(--fg-tertiary))] line-clamp-2 sm:line-clamp-none">
            {interpretation}
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 pt-1 sm:pt-2">
            <div>
              <p className="text-[9px] sm:text-xs text-[hsl(var(--fg-tertiary))]">
                {t('health.todaySales')}
              </p>
              <p className="text-base sm:text-xl font-bold text-[hsl(var(--fg-primary))]">
                {formatCurrency(todaySales)}
              </p>
            </div>
            <div className="h-6 sm:h-8 w-px bg-[hsl(var(--border-default))]" />
            <div>
              <p className="text-[9px] sm:text-xs text-[hsl(var(--fg-tertiary))]">
                {t('health.todayInvoices')}
              </p>
              <p className="text-base sm:text-lg font-bold text-[hsl(var(--fg-primary))]">
                {todayInvoices}
              </p>
            </div>
            <div className="h-6 sm:h-8 w-px bg-[hsl(var(--border-default))]" />
            <div>
              <p className="text-[9px] sm:text-xs text-[hsl(var(--fg-tertiary))]">
                {t('health.growth')}
              </p>
              <p
                className={cn(
                  'text-base sm:text-lg font-bold',
                  monthlyGrowth >= 0
                    ? 'text-[hsl(var(--status-positive))]'
                    : 'text-[hsl(var(--status-negative))]',
                )}
              >
                {monthlyGrowth >= 0 ? '+' : ''}
                {monthlyGrowth.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 text-[hsl(var(--fg-tertiary))] rtl:rotate-180 shrink-0 self-end sm:self-center" />
      </div>
    </button>
  )
})
BusinessHealthHero.displayName = 'BusinessHealthHero'

// ─── PerformanceSnapshot ──────────────────────────────────────────────────

const PerformanceSnapshot = memo(function PerformanceSnapshot({
  monthlyRevenue,
  monthlyGrowth,
  activeCustomers,
  customerGrowth,
  isLoading,
  formatCurrency,
}: {
  monthlyRevenue: number
  monthlyGrowth: number
  activeCustomers: number
  customerGrowth: number
  isLoading: boolean
  formatCurrency: (v: number) => string
}) {
  const t = useTranslations()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="h-20 sm:h-24 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
        <div className="h-20 sm:h-24 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3 sm:p-4">
        <p className="text-[9px] sm:text-xs text-[hsl(var(--fg-tertiary))]">
          {t('performance.monthlyRevenue')}
        </p>
        <p className="text-base sm:text-xl font-bold text-[hsl(var(--fg-primary))]">
          {formatCurrency(monthlyRevenue)}
        </p>
        <div className="flex items-center gap-0.5 sm:gap-1 mt-0.5 sm:mt-1">
          <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-[hsl(var(--status-positive))]" />
          <span className="text-[9px] sm:text-xs text-[hsl(var(--status-positive))]">
            +{monthlyGrowth.toFixed(1)}% {t('performance.growthLabel')}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3 sm:p-4">
        <p className="text-[9px] sm:text-xs text-[hsl(var(--fg-tertiary))]">
          {t('performance.activeCustomers')}
        </p>
        <p className="text-base sm:text-xl font-bold text-[hsl(var(--fg-primary))]">
          {activeCustomers}
        </p>
        <div className="flex items-center gap-0.5 sm:gap-1 mt-0.5 sm:mt-1">
          <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-[hsl(var(--status-info))]" />
          <span className="text-[9px] sm:text-xs text-[hsl(var(--status-info))]">
            +{customerGrowth.toFixed(1)}% {t('performance.thisMonth')}
          </span>
        </div>
      </div>
    </div>
  )
})
PerformanceSnapshot.displayName = 'PerformanceSnapshot'

// ─── AttentionPanel ───────────────────────────────────────────────────────

const AttentionPanel = memo(function AttentionPanel({
  pendingPayments,
  pendingPaymentsCount,
  lowStockAlerts,
  lowStockItems,
  isLoading,
  onAction,
  formatCurrency,
}: {
  pendingPayments: number
  pendingPaymentsCount: number
  lowStockAlerts: number
  lowStockItems: Array<{ name: string; quantity: number }>
  isLoading: boolean
  onAction: (action: 'payments' | 'warehouse') => void
  formatCurrency: (v: number) => string
}) {
  const t = useTranslations()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="h-16 sm:h-20 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
        <div className="h-16 sm:h-20 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
      </div>
    )
  }

  const hasAlerts = pendingPaymentsCount > 0 || lowStockAlerts > 0

  if (!hasAlerts) {
    return (
      <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3 sm:p-4 text-center">
        <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-[hsl(var(--status-positive))] mx-auto mb-1.5 sm:mb-2" />
        <p className="text-xs sm:text-sm text-[hsl(var(--fg-secondary))]">
          {t('attention.allGood')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5 sm:space-y-2">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <AlertTriangle
          className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[hsl(var(--status-negative))]"
          aria-hidden="true"
        />
        <h3 className="text-xs sm:text-sm font-medium text-[hsl(var(--fg-primary))]">
          {t('attention.needAttention')}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {pendingPaymentsCount > 0 && (
          <button
            onClick={() => onAction('payments')}
            className={cn(
              'relative rounded-2xl p-2.5 sm:p-3 text-start transition-all duration-200',
              'border border-[hsl(var(--status-negative)/0.3)] bg-[hsl(var(--status-negative)/0.05)]',
              'hover:border-[hsl(var(--status-negative)/0.6)] hover:shadow-md',
              'focus-visible:ring-4 focus-visible:ring-[hsl(var(--status-negative)/0.3)] focus-visible:outline-none',
            )}
            aria-label={t('attention.paymentsAria', {
              count: pendingPaymentsCount,
              amount: formatCurrency(pendingPayments),
            })}
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Receipt
                className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[hsl(var(--status-negative))]"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-[hsl(var(--status-negative))] truncate">
                  {t('attention.pendingPayments')}
                </p>
                <p className="text-[9px] sm:text-xs text-[hsl(var(--fg-tertiary))] line-clamp-1">
                  {t('attention.paymentsDetail', {
                    count: pendingPaymentsCount,
                    amount: formatCurrency(pendingPayments),
                  })}
                </p>
              </div>
            </div>
          </button>
        )}

        {lowStockAlerts > 0 && (
          <button
            onClick={() => onAction('warehouse')}
            className={cn(
              'relative rounded-2xl p-2.5 sm:p-3 text-start transition-all duration-200',
              'border border-[hsl(var(--status-warning)/0.3)] bg-[hsl(var(--status-warning)/0.05)]',
              'hover:border-[hsl(var(--status-warning)/0.6)] hover:shadow-md',
              'focus-visible:ring-4 focus-visible:ring-[hsl(var(--status-warning)/0.3)] focus-visible:outline-none',
            )}
            aria-label={t('attention.stockAria', { count: lowStockAlerts })}
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Package
                className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[hsl(var(--status-warning))]"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-[hsl(var(--status-warning))] truncate">
                  {t('attention.lowStock')}
                </p>
                <p className="text-[9px] sm:text-xs text-[hsl(var(--fg-tertiary))] line-clamp-1">
                  {lowStockItems
                    .slice(0, 2)
                    .map((item) => item.name)
                    .join('، ')}
                  {lowStockItems.length > 2 &&
                    ` +${lowStockItems.length - 2} ${t('common.moreItems')}`}
                </p>
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  )
})
AttentionPanel.displayName = 'AttentionPanel'

// ─── QuickActions ─────────────────────────────────────────────────────────

const QuickActions = memo(function QuickActions({
  onAction,
}: {
  onAction: (action: 'invoice' | 'payments' | 'warehouse' | 'customers' | 'buy') => void
}) {
  const t = useTranslations()

  const actions = useMemo(
    () => [
      {
        id: 'invoice' as const,
        label: t('actions.newInvoice'),
        icon: FileText,
        description: t('actions.newInvoiceDesc'),
        color: 'text-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.1)]',
      },
      {
        id: 'payments' as const,
        label: t('actions.viewPayments'),
        icon: Receipt,
        description: t('actions.viewPaymentsDesc'),
        color: 'text-[hsl(var(--status-negative))] bg-[hsl(var(--status-negative)/0.1)]',
      },
      {
        id: 'warehouse' as const,
        label: t('actions.manageStock'),
        icon: Package,
        description: t('actions.manageStockDesc'),
        color: 'text-[hsl(var(--status-warning))] bg-[hsl(var(--status-warning)/0.1)]',
      },
      {
        id: 'buy' as const,
        label: t('actions.buyStock'),
        icon: ShoppingCart,
        description: t('actions.buyStockDesc'),
        color: 'text-[hsl(var(--status-info))] bg-[hsl(var(--status-info)/0.1)]',
      },
    ],
    [t],
  )

  return (
    <div className="space-y-1.5 sm:space-y-2">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <ArrowRight
          className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[hsl(var(--fg-tertiary))] rtl:rotate-180"
          aria-hidden="true"
        />
        <h3 className="text-xs sm:text-sm font-medium text-[hsl(var(--fg-secondary))]">
          {t('actions.quickActions')}
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {actions.map(({ id, label, icon: Icon, description, color }) => (
          <button
            key={id}
            onClick={() => onAction(id)}
            className={cn(
              'flex items-center gap-2.5 sm:gap-3 rounded-2xl p-3 sm:p-4 text-start transition-all duration-200',
              'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
              'motion-safe:hover:border-[hsl(var(--color-primary)/0.3)] motion-safe:hover:shadow-md motion-safe:hover:scale-[1.01]',
              'focus-visible:ring-4 focus-visible:ring-[hsl(var(--color-primary)/0.3)] focus-visible:outline-none',
            )}
          >
            <div className={cn('rounded-lg p-1.5 sm:p-2 shrink-0', color)}>
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-[hsl(var(--fg-primary))] truncate">
                {label}
              </p>
              <p className="text-[9px] sm:text-xs text-[hsl(var(--fg-tertiary))] line-clamp-1">
                {description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
})
QuickActions.displayName = 'QuickActions'

// ─── Main Component ──────────────────────────────────────────────────────

export const BusinessHealthPanel = memo(function BusinessHealthPanel({
  data,
  isLoading,
  onAction,
}: BusinessHealthPanelProps) {
  const t = useTranslations()
  const { format } = useCurrency()

  if (isLoading) {
    return <BusinessHealthSkeleton />
  }

  return (
    <section className="space-y-3 sm:space-y-4" aria-label={t('panel.ariaLabel')}>
      <BusinessHealthHero
        todaySales={data.todaySales}
        todayInvoices={data.todayInvoices}
        monthlyGrowth={data.monthlyGrowth}
        isLoading={isLoading}
        onAction={() => onAction('invoice')}
        formatCurrency={format}
      />

      <PerformanceSnapshot
        monthlyRevenue={data.monthlyRevenue}
        monthlyGrowth={data.monthlyGrowth}
        activeCustomers={data.activeCustomers}
        customerGrowth={data.customerGrowth}
        isLoading={isLoading}
        formatCurrency={format}
      />

      <AttentionPanel
        pendingPayments={data.pendingPayments}
        pendingPaymentsCount={data.pendingPaymentsCount}
        lowStockAlerts={data.lowStockAlerts}
        lowStockItems={data.lowStockItems}
        isLoading={isLoading}
        onAction={onAction}
        formatCurrency={format}
      />

      <QuickActions onAction={onAction} />
    </section>
  )
})

BusinessHealthPanel.displayName = 'BusinessHealthPanel'
