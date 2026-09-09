// packages/ui/src/components/ui/dashboard/containers/dashboard-container.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'

import { DashboardView } from '../dashboard-view'
import { WorkQueueContainer } from '../../work-queue/containers/work-queue-container'
import { DateRangePicker, type DateRange, type PresetKey } from '../date-range-picker'
import { useDashboardData } from '../../../../hooks/dashboard/use-dashboard-data'
import { fmt } from '../../../../lib/dashboard/dashboard-format'
import { useDisplayBasis } from '../../../../hooks/dashboard/use-display-basis'
import { DisplayBasisPicker, ExchangeRateForm } from '../display-basis-picker'
import { AiAssistantLauncher } from '../../ai/ai-assistant-launcher'
import { CURRENCY_CODES } from '@hisabche/validation'
import { useSetExchangeRate } from '@hisabche/api'

// ─── Types ─────────────────────────────────────────────────────────────────

type Translate = (key: string) => string

// ─── Main Container ──────────────────────────────────────────────────────

export function DashboardContainer() {
  const tOriginal = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      try {
        const v = tOriginal(key as Parameters<typeof tOriginal>[0])
        return v && v !== key ? v : (fallback ?? key)
      } catch (err) {
        console.error('[DEBUG dashboard] t() threw for key:', key, err)
        return fallback ?? key
      }
    },
    [tOriginal],
  )
  const router = useRouter()
  const locale = useLocale()

  // ─── State ──────────────────────────────────────────────────────────────

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date()
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 6)
    return { from: weekAgo, to: today }
  })

  // ─── Data ──────────────────────────────────────────────────────────────

  const {
    kpis,
    insights,
    salesChartData,
    recentActivities,
    kpiLoading,
    insightsLoading,
    chartLoading,
    activitiesLoading,
  } = useDashboardData(dateRange)

  // ─── Callbacks ──────────────────────────────────────────────────────────

  const handleDateRangeChange = useCallback((range: DateRange, _preset: PresetKey) => {
    setDateRange(range)
  }, [])

  const handleAction = useCallback(
    (action: string) => {
      router.push(action)
    },
    [router],
  )

  // ─── Render ─────────────────────────────────────────────────────────────

  // ─── T10 — display basis ──────────────────────────────────────────────
  //
  // ⚠️ DISPLAY ONLY. The KPI numbers arriving from the API are in the
  // workspace's own currency and stay that way; this converts what is printed
  // and nothing else. Re-expressing posted balances by today's rate would make
  // last month's closed books report a different profit every morning. The
  // accounting operation that legitimately revalues is
  // `POST /currency/revalue`, which books the difference as a journal entry.
  const display = useDisplayBasis()
  const setRate = useSetExchangeRate()
  const [rateOpen, setRateOpen] = useState(false)

  /**
   * `fmt`, but in whatever the user chose to read in.
   *
   * ⚠️ A missing rate returns a WORD, not a number. `convert` yields null when
   * no rate exists for the pair — which is the real state for most currencies
   * here — and printing the unconverted amount instead would put «۱۵٬۰۰۰٬۰۰۰»
   * under a heading that says grams.
   */
  const fmtInBasis = useCallback(
    (value: number): string => {
      const converted = display.convert(value)
      if (!converted.available || converted.value === null) {
        return t('display.noRate', 'نرخ ثبت نشده')
      }
      return fmt(converted.value)
    },
    [display, t],
  )

  return (
    <>
      {/* §12 — what needs doing, above what happened.
          `capabilities` is empty deliberately: no endpoint reports the
          capabilities the SERVER granted this actor, and inventing a list
          client-side would be a guess standing in for authorization. The
          contract shows only items whose capability is `null` — conflicts,
          approvals and unsent changes — and keeps the rest hidden until a real
          source exists. Under-showing is the safe direction; the alternative
          offers a door that refuses to open. */}
      <WorkQueueContainer capabilities={[]} onNavigate={(route) => router.push(route)} />

      {/* ─── T10 — «بر چه مبنایی ببینم» ────────────────────────────────
          A jeweller reads the day's takings in grams; a shop with dollar
          suppliers reads them in dollars. The picker only offers currencies
          the workspace has an actual rate for, so it cannot select a basis
          that would then render «نرخ ثبت نشده» on every card. */}
      <div className="flex flex-col items-end gap-2">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* T13 — renders nothing until a provider is configured. */}
          {/* The locale prefix comes from the router, not from this package —
              `useLocale` is next-intl's, which desktop shims. */}
          <AiAssistantLauncher t={t} fullPageHref={`/${locale}/assistant`} />
          <DisplayBasisPicker
            t={t}
            base={display.base}
            basis={display.basis}
            available={display.availableBases}
            onChange={display.setBasis}
            disabled={display.isLoading}
          />
          {/* Without a way to enter a rate the picker has one option and the
              feature is unreachable — `PUT /currency/rates` had no caller. */}
          <button
            type="button"
            onClick={() => setRateOpen((open) => !open)}
            className="h-9 shrink-0 rounded-full border border-[hsl(var(--border-default))] px-3 text-xs text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"
          >
            {t('display.setRate', 'ثبت نرخ')}
          </button>
        </div>

        {rateOpen ? (
          <div className="w-full sm:max-w-lg">
            <ExchangeRateForm
              t={t}
              base={display.base}
              // The base is excluded: it is 1 against itself by definition, and
              // offering it invites someone to quote AFN against AFN.
              currencies={CURRENCY_CODES.filter((code) => code !== display.base)}
              isSaving={setRate.isPending}
              error={setRate.error ? String((setRate.error as Error).message) : null}
              onSave={(input) => setRate.mutate(input, { onSuccess: () => setRateOpen(false) })}
            />
          </div>
        ) : null}
      </div>

      <DashboardView
        t={t}
        fmt={fmtInBasis}
        totalSales={kpis?.totalSales ?? 0}
        todaySales={kpis?.todaySales ?? 0}
        customerDebt={kpis?.customerDebt ?? 0}
        warehouseValue={kpis?.warehouseValue ?? 0}
        monthlyGrowth={kpis?.monthlyGrowth ?? null}
        kpiLoading={kpiLoading}
        insights={Array.isArray(insights) ? insights : []}
        insightsLoading={insightsLoading}
        salesChartData={salesChartData}
        chartLoading={chartLoading}
        dateRange={dateRange}
        activitiesLoading={activitiesLoading}
        recentActivities={recentActivities}
        onNavigate={(route) => router.push(route)}
        onInsightAction={handleAction}
        onDateRangeChange={handleDateRangeChange}
      />
    </>
  )
}
