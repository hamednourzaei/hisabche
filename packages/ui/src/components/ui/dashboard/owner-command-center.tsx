'use client'

// ============================================
// packages/ui/src/components/ui/dashboard/owner-command-center.tsx
//
// V60 Slice 12 — Owner Command Center alerts
// Renders decision alert cards directly from `resolveCommandCenterAlerts()` in
// `DashboardRegistry.ts`. Hides any alert whose capability is not `'available'`,
// whose permission is absent, or whose KPI figureGroup is masked server-side.
// Never renders `null` / `'insufficient_data'` as `0`.
// ============================================

import { useMemo } from 'react'
import type { CapabilityKey, CapabilityStatus } from '@hisabche/validation'
import { useCashForecast, useReorderSuggestions } from '@hisabche/api'
import {
  resolveCommandCenterAlerts,
  type CommandAlertId,
  type CommandCenterMetricValue,
} from './DashboardRegistry'

export interface OwnerCommandCenterProps {
  t: (key: string, fallback?: string) => string
  fmtNumber: (value: number) => string
  can: (permission: string) => boolean
  hiddenFigureGroups: readonly string[]
  blockedModules: readonly string[]
  statusOverrides?: Partial<Record<CapabilityKey, CapabilityStatus>>
  onNavigate: (href: string) => void
}

export function OwnerCommandCenterSection({
  t,
  fmtNumber,
  can,
  hiddenFigureGroups,
  blockedModules,
  statusOverrides,
  onNavigate,
}: OwnerCommandCenterProps) {
  const canForecast = can('report.financial.read') && !hiddenFigureGroups.includes('sales')
  const canInventory = can('inventory.read') && !hiddenFigureGroups.includes('stock')

  const cashForecast = useCashForecast(30, { enabled: canForecast })
  const reorder = useReorderSuggestions()

  const metrics = useMemo<Partial<Record<CommandAlertId, CommandCenterMetricValue>>>(() => {
    const map: Partial<Record<CommandAlertId, CommandCenterMetricValue>> = {}
    if (canForecast && cashForecast.data) {
      const nextWindow = cashForecast.data.windows?.[0]
      if (
        !nextWindow ||
        nextWindow.projectedCashMinor === null ||
        nextWindow.status === 'insufficient_data'
      ) {
        map.cash_forecast = { status: 'insufficient_data', primaryNumber: null }
      } else {
        map.cash_forecast = {
          status: 'ok',
          primaryNumber: Math.round(nextWindow.projectedCashMinor / 100),
        }
      }
    }
    if (canInventory && reorder.data) {
      map.stock_out_risk = {
        status: 'ok',
        primaryNumber: reorder.data.length,
      }
    }
    return map
  }, [canForecast, canInventory, cashForecast.data, reorder.data])

  const alerts = useMemo(
    () =>
      resolveCommandCenterAlerts({
        can,
        hiddenFigureGroups,
        blockedModules,
        ...(statusOverrides !== undefined ? { statusOverrides } : {}),
        metrics,
      }),
    [can, hiddenFigureGroups, blockedModules, statusOverrides, metrics],
  )

  if (alerts.length === 0) return null

  return (
    <section
      aria-label={t('dashboard.commandCenter.title', 'مرکز فرمان مدیر')}
      className="mt-4 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4"
    >
      <h3 className="mb-3 text-sm font-semibold text-[hsl(var(--fg-primary))]">
        {t('dashboard.commandCenter.title', 'هشدارهای تصمیم‌گیری')}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {alerts.map((alert) => {
          const metricText =
            alert.metric.status === 'insufficient_data'
              ? t('dashboard.commandCenter.insufficientData', 'داده کافی نیست')
              : alert.metric.status === 'unknown' || alert.metric.primaryNumber === null
                ? t('dashboard.commandCenter.unknown', 'نامشخص')
                : fmtNumber(alert.metric.primaryNumber)
          return (
            <button
              key={alert.id}
              type="button"
              onClick={() => onNavigate(alert.href)}
              className="flex flex-col items-start gap-1 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-3 text-start hover:bg-[hsl(var(--surface-muted))]"
            >
              <span className="text-xs text-[hsl(var(--fg-tertiary))]">{alert.reasonCode}</span>
              <span className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                {t(alert.labelKey, alert.id)}
              </span>
              <span className="text-base font-semibold tabular-nums text-[hsl(var(--color-primary))]">
                {metricText}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
