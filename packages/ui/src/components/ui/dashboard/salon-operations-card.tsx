'use client'

import { useMemo } from 'react'
import { useCommissionReport, useServiceDeliverySessions } from '@hisabche/api'
import { formatMoney, formatNumber, type KnownCurrency } from '@hisabche/formatting'
import { useCurrencyStore } from '@hisabche/store'
import { summarizeSalonOperations } from '@hisabche/validation'

export function SalonOperationsCard({
  t,
  locale,
  from,
  to,
  enabled,
}: {
  t: (key: string, fallback?: string) => string
  locale: string
  from: string
  to: string
  enabled: boolean
}) {
  const currency = useCurrencyStore((s) => s.primaryCurrency)
  const sessionsQuery = useServiceDeliverySessions()
  const commissionQuery = useCommissionReport(from, to, { enabled })

  const summary = useMemo(() => {
    const sessions = (sessionsQuery.data ?? []).filter(
      (s) => s.sessionDate >= from && s.sessionDate <= to,
    )
    if (sessions.length === 0) return null
    const commMap = new Map<string, number>()
    let commissionTotalMinor: number | null = commissionQuery.data?.lines?.length ? 0 : null
    for (const line of commissionQuery.data?.lines ?? []) {
      if (line.commissionMinor === null) {
        commissionTotalMinor = null
      } else {
        commMap.set(line.practitionerId, line.commissionMinor)
        if (commissionTotalMinor !== null) commissionTotalMinor += line.commissionMinor
      }
    }
    const summaryResult = summarizeSalonOperations({
      sessions: sessions.map((s) => ({
        status: s.status as
          'scheduled' | 'checked_in' | 'in_progress' | 'delivered' | 'cancelled' | 'no_show',
        durationMinutes: s.durationMinutes ?? 0,
        revenueMinor: null,
        materialCostMinor: null,
        commissionMinor: s.practitionerId ? (commMap.get(s.practitionerId) ?? null) : null,
      })),
    })
    return { ...summaryResult, commissionTotalMinor }
  }, [sessionsQuery.data, commissionQuery.data?.lines, from, to])

  if (!enabled || !summary) return null

  return (
    <section className="mt-4 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {t('dashboard.salon.title', 'خلاصه عملیات سالن')}
        </h3>
        <span className="text-xs text-[hsl(var(--fg-secondary))]">
          {t('dashboard.salon.totalBooked', 'کل نوبت‌ها')}:{' '}
          {formatNumber(summary.totalSessions, locale, 0)}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-4 text-xs">
        <div className="rounded-xl bg-[hsl(var(--surface-muted))] p-3">
          <div className="text-[hsl(var(--fg-secondary))]">
            {t('dashboard.salon.delivered', 'انجام‌شده')}
          </div>
          <div className="mt-1 text-base font-semibold tabular-nums">
            {formatNumber(summary.deliveredCount, locale, 0)}
          </div>
        </div>
        <div className="rounded-xl bg-[hsl(var(--surface-muted))] p-3">
          <div className="text-[hsl(var(--fg-secondary))]">
            {t('dashboard.salon.noShowCancelled', 'عدم حضور / لغو')}
          </div>
          <div className="mt-1 text-base font-semibold tabular-nums">
            {formatNumber(summary.noShowCount + summary.cancelledCount, locale, 0)}
          </div>
        </div>
        <div className="rounded-xl bg-[hsl(var(--surface-muted))] p-3">
          <div className="text-[hsl(var(--fg-secondary))]">
            {t('dashboard.salon.commission', 'جمع کمیسیون')}
          </div>
          <div className="mt-1 text-base font-semibold tabular-nums">
            {summary.commissionTotalMinor === null
              ? t('accounting.profit.unknown', 'قابل محاسبه نیست')
              : formatMoney(summary.commissionTotalMinor, currency as KnownCurrency, locale)}
          </div>
        </div>
        <div className="rounded-xl bg-[hsl(var(--surface-muted))] p-3">
          <div className="text-[hsl(var(--fg-secondary))]">
            {t('dashboard.salon.profit', 'سود خدمات')}
          </div>
          <div className="mt-1 text-base font-semibold tabular-nums">
            {summary.serviceProfitMinor === null
              ? t('accounting.profit.unknown', 'قابل محاسبه نیست')
              : formatMoney(summary.serviceProfitMinor, currency as KnownCurrency, locale)}
          </div>
        </div>
      </div>
    </section>
  )
}
