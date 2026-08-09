// ============================================
// Dashboard — sales metrics, trend chart, inventory status, quick actions.
// Data comes from the shared analytics hooks; no local business logic.
// ============================================

import React, { Suspense, lazy, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Boxes, Plus, RefreshCw, Users, Wallet } from 'lucide-react'
import { useAIInsights, useDashboardKPIs, useDashboardSales } from '@hisabche/api'

import { Button, Card, Skeleton } from '@/components/ui/primitives'
import { MetricTile } from '@/features/dashboard/metric-tile'
import { formatAmount, formatMoney } from '@/shared/lib/currency'
import { useCurrency } from '@/shared/stores/ui.store'

// recharts is ~830 kB. Keeping it out of this chunk means the KPI tiles —
// the reason the user opened the app — paint without waiting for chart code.
const SalesChart = lazy(() => import('@/features/dashboard/sales-chart'))

export default function DashboardPage() {
  const { t } = useTranslation('desktop')
  const navigate = useNavigate()
  const currency = useCurrency()

  const kpis = useDashboardKPIs()
  const sales = useDashboardSales()
  const insights = useAIInsights()

  const money = useCallback(
    (value: number | undefined) => formatMoney(value ?? 0, currency),
    [currency],
  )

  const refresh = useCallback(() => {
    void kpis.refetch()
    void sales.refetch()
  }, [kpis, sales])

  const data = kpis.data

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
      <div className="grid grid-cols-4 gap-4">
        <MetricTile
          label={t('sales.title')}
          value={money(data?.totalSales)}
          trend={data?.monthlyGrowth}
          loading={kpis.isLoading}
          icon={<Wallet size={15} />}
        />
        <MetricTile
          label={t('accounting.income')}
          value={money(data?.todaySales)}
          loading={kpis.isLoading}
          icon={<RefreshCw size={15} />}
        />
        <MetricTile
          label={t('customers.debt')}
          value={money(data?.customerDebt)}
          trend={data?.customerGrowth}
          loading={kpis.isLoading}
          onClick={() => navigate('/customers')}
          icon={<Users size={15} />}
        />
        <MetricTile
          label={t('inventory.stock')}
          value={money(data?.warehouseValue)}
          loading={kpis.isLoading}
          onClick={() => navigate('/inventory')}
          icon={<Boxes size={15} />}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <div className="mb-3 flex items-center">
            <h2 className="flex-1 text-sm font-bold">{t('sales.title')}</h2>
            <Button size="sm" variant="ghost" onClick={refresh}>
              <RefreshCw size={13} />
              {t('common.refresh')}
            </Button>
          </div>

          {sales.isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <div className="h-56">
              <Suspense fallback={<Skeleton className="h-56 w-full" />}>
                <SalesChart data={sales.data?.data ?? []} currency={currency} />
              </Suspense>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-bold">{t('common.new')}</h2>
          <div className="flex flex-col gap-2">
            <Button variant="primary" onClick={() => navigate('/sales/new')}>
              <Plus size={14} />
              {t('sales.newInvoice')}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/inventory')}>
              <Boxes size={14} />
              {t('nav.inventory')}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/customers')}>
              <Users size={14} />
              {t('nav.customers')}
            </Button>
          </div>

          {data?.lowStockAlerts ? (
            <p className="mt-4 rounded-[var(--radius-xs)] bg-[hsl(var(--color-warning)/0.12)] p-2 text-xs text-[hsl(var(--color-warning))]">
              {`${t('inventory.lowStock')}: ${formatAmount(data.lowStockAlerts)}`}
            </p>
          ) : null}
        </Card>
      </div>

      {insights.data && insights.data.length > 0 ? (
        <div className="grid grid-cols-3 gap-4">
          {insights.data.slice(0, 3).map((insight) => (
            <Card key={insight.title}>
              <h3 className="text-sm font-medium">{insight.title}</h3>
              <p className="mt-1 text-xs text-[hsl(var(--fg-secondary))]">{insight.description}</p>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  )
}
