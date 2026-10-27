// packages/ui/src/components/ui/dashboard/containers/dashboard-container.tsx
'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'

import { DashboardView } from '../dashboard-view'
import { WorkQueueContainer } from '../../work-queue/containers/work-queue-container'
import { DateRangePicker, type DateRange, type PresetKey } from '../date-range-picker'
import { isNavLocked } from '@hisabche/ui-contract'
import { apiErrorMessage, useDeleteCustomUnit, useMyCapabilities } from '@hisabche/api'
import { X } from 'lucide-react'
import { usePageLook } from '../../../../lib/page-look'
import { useBusinessProfile } from '../../../../hooks/use-business-profile'
// import { NAV_ITEMS } from '../../../../lib/menu/nav-items'
import { RegisterCustomizer } from '../../register-customizer'
import { useDashboardData } from '../../../../hooks/dashboard/use-dashboard-data'
import { fmt } from '../../../../lib/dashboard/dashboard-format'
import { useDisplayBasis } from '../../../../hooks/dashboard/use-display-basis'
import { DisplayBasisPicker } from '../display-basis-picker'
import { ExchangeRateDialog, useLatestCustomUnits } from '../exchange-rate-dialog'
import { AiAssistantLauncher } from '../../ai/ai-assistant-launcher'
import { localizePath } from '@hisabche/ui-contract'
import { useLocalePush, useRouteLang } from '../../../../hooks/use-locale-push'
import { formatNumber, toIsoDay } from '@hisabche/formatting'
import { useIntlLocale } from '../../../../hooks/use-intl-locale'
import { ManufacturingDashboardCard } from '../../manufacturing/manufacturing-dashboard-card'
import { nameOfCurrency } from '../../../../lib/currency-name'

// ─── Types ─────────────────────────────────────────────────────────────────

type Translate = (key: string) => string

// ─── Main Container ──────────────────────────────────────────────────────

/** What a person may switch off on their own dashboard. Stable ids, never positions. */
export const DASHBOARD_PARTS = [
  'workQueue',
  'kpis',
  'chart',
  'insights',
  'activities',
  'manufacturing',
] as const

/** Never hidden from the menu: the way home, and the way to undo anything. */
export const MENU_ALWAYS: readonly string[] = ['/dashboard', '/settings']

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
  const push = useLocalePush()
  const intlLocale = useIntlLocale()
  const routeLang = useRouteLang()

  // ─── State ──────────────────────────────────────────────────────────────

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date()
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 6)
    return { from: weekAgo, to: today }
  })

  // ─── What this person shows on their dashboard ────────────────────────────
  // Their own choice (lib/page-look), never a permission. A part that is off
  // is not mounted below and not fetched by `useDashboardData`.
  const look = usePageLook('dashboard')
  // A saved look is the person's own arrangement and must win. Only without
  // one does the selected industry decide which section comes first.
  const { profile } = useBusinessProfile()
  const sectionOrder = look.customized ? DASHBOARD_PARTS : profile.dashboard
  // const menuLook = usePageLook('menu')
  const access = useMyCapabilities().data
  const hiddenByRole = access?.hiddenModules ?? []
  const may = (capability: string) =>
    access === undefined || access.capabilities.includes(capability)
  const mayInsights = may('invoice.read') && may('customer.read') && may('product.read')

  // ─── Data ──────────────────────────────────────────────────────────────

  const {
    kpis,
    insights,
    salesChartData,
    rangeSalesTotal,
    previousRangeSalesTotal,
    pendingInvoiceCount,
    rangeLoading,
    recentActivities,
    kpiLoading,
    insightsLoading,
    chartLoading,
    activitiesLoading,
  } = useDashboardData(dateRange, {
    kpis: look.active('kpis'),
    // Permission first, then the person's own choice. While the capabilities
    // are not known yet the read is tried (the server decides); once they are,
    // a part the role does not include is never asked for.
    chart: look.active('chart') && may('invoice.read'),
    insights: look.active('insights') && mayInsights,
    activities: look.active('activities'),
  })

  // ⚠️ ONLY THE DEVICE KNOWS THIS (D10): the cloud route has no outbox to
  // count. `null` while unknown — the line is then not drawn, because «0 sales
  // waiting» and «we could not read» are different sentences.
  const pendingInvoicesLabel =
    pendingInvoiceCount !== null && pendingInvoiceCount > 0
      ? (tOriginal as unknown as (key: string, values?: Record<string, number>) => string)(
          'dashboard.pendingInvoices',
          { count: pendingInvoiceCount },
        )
      : null

  // ─── Callbacks ──────────────────────────────────────────────────────────

  const handleDateRangeChange = useCallback((range: DateRange, _preset: PresetKey) => {
    setDateRange(range)
  }, [])

  const handleAction = useCallback(
    (action: string) => {
      push(action)
    },
    [push],
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
  const latestUnits = useLatestCustomUnits().units
  const removeUnit = useDeleteCustomUnit()
  const [unitError, setUnitError] = useState<string | null>(null)
  const handleRemoveUnit = (name: string) => {
    if (
      !window.confirm(
        t('display.removeUnitConfirm', 'این واحد حذف شود؟ فاکتورها و دفترها تغییر نمی‌کنند.'),
      )
    )
      return
    setUnitError(null)
    removeUnit.mutate(name, {
      onError: (cause) =>
        setUnitError(apiErrorMessage(cause, t('display.removeUnitFailed', 'حذف واحد انجام نشد'))),
    })
  }
  const [rateOpen, setRateOpen] = useState<'new' | 'edit' | null>(null)

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
      {look.shows('workQueue') ? (
        <WorkQueueContainer capabilities={[]} onNavigate={(route) => push(route)} />
      ) : null}

      {/* ─── T10 — «بر چه مبنایی ببینم» ────────────────────────────────
          A jeweller reads the day's takings in grams; a shop with dollar
          suppliers reads them in dollars. The picker only offers currencies
          the workspace has an actual rate for, so it cannot select a basis
          that would then render «نرخ ثبت نشده» on every card. */}
      <div className="flex flex-col items-end gap-2">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* T13 — renders nothing until a provider is configured. */}
          {/* The prefix comes from the route: `useLocale()` is the UI
              language, which desktop has too — `/fa/assistant` is a route
              only web serves, so the link dropped desktop on the dashboard. */}
          {/* The wrench: what this person shows on the dashboard and in their
              menu. Only parts their role includes are offered. */}
          <RegisterCustomizer
            groups={[
              {
                title: t('pageLook.dashboardParts', 'بخش‌های داشبورد'),
                look,
                items: DASHBOARD_PARTS.map((id) => ({
                  id,
                  label: t(`pageLook.dashboard.${id}`, id),
                })),
              },
            ]}
          />
          <AiAssistantLauncher t={t} fullPageHref={localizePath('/assistant', routeLang)} />
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
            aria-haspopup="dialog"
            onClick={() => setRateOpen('new')}
            className="h-9 shrink-0 rounded-full border border-[hsl(var(--border-default))] px-3 text-xs text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"
          >
            {t('display.exchangeButton', 'تبادل نرخ داشبورد')}
          </button>
          {/* «اصلاح قیمت» — only while reading in another currency: the rate
              behind every number on screen, opened on that currency. */}
          {display.basis !== display.base ? (
            <button
              type="button"
              data-edit-rate=""
              aria-haspopup="dialog"
              onClick={() => setRateOpen('edit')}
              className="h-9 shrink-0 rounded-full border border-[hsl(var(--border-default))] px-3 text-xs text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"
            >
              {t('display.editRate', 'اصلاح قیمت')}
            </button>
          ) : null}
        </div>

        {/* A dialog over the page, at every width (owner, 18 Oct 2026): the
            inline strip pushed the dashboard down and broke into rows. */}
        <ExchangeRateDialog
          t={t}
          open={rateOpen !== null}
          title={
            rateOpen === 'edit'
              ? t('display.editRate', 'اصلاح قیمت')
              : t('display.rateDialogTitle', 'ثبت نرخ تبدیل ارز')
          }
          base={display.base}
          initialCurrency={rateOpen === 'edit' ? display.basis : undefined}
          onClose={() => setRateOpen(null)}
        />
        {latestUnits.length > 0 ? (
          // The units the business named itself, at their latest worth
          // (live audit #82): «۱ ماشین = ۵۰۰٬۰۰۰ افغانی».
          <ul className="flex w-full flex-wrap gap-1.5 text-[11px] text-[hsl(var(--fg-secondary))]">
            {latestUnits.map((unit) => (
              <li
                key={unit.name}
                className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--surface-muted))] ps-2.5 pe-1 py-1 tabular-nums"
              >
                <span>
                  {formatNumber(1, intlLocale)} {unit.name} ={' '}
                  {formatNumber(unit.perUnit, intlLocale, 2)}{' '}
                  {nameOfCurrency(t, display.base, display.base)}
                </span>
                <button
                  type="button"
                  aria-label={t('display.removeUnit', 'حذف این واحد')}
                  title={t('display.removeUnit', 'حذف این واحد')}
                  disabled={removeUnit.isPending}
                  onClick={() => handleRemoveUnit(unit.name)}
                  className="inline-flex size-5 items-center justify-center rounded-full text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-elevated))] hover:text-[hsl(var(--color-destructive))] disabled:opacity-50"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {unitError ? (
          <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
            {unitError}
          </p>
        ) : null}
      </div>

      {/* dashboard-fx-01: an invoice in another currency with no rate cannot be
          put in the books currency. It is left out of every figure — said
          here, where the figures are read, never added at 1 (§7.5). */}
      {(kpis?.unconvertedInvoices ?? 0) > 0 ? (
        <p
          role="note"
          data-unconverted-invoices
          className="mb-3 rounded-xl border border-[hsl(var(--color-warning)/0.4)] bg-[hsl(var(--color-warning)/0.08)] px-3 py-2 text-xs text-[hsl(var(--fg-secondary))]"
        >
          {t(
            'dashboard.unconvertedInvoices',
            '{count} فاکتور به ارز دیگر نرخ تبدیل ندارد و در این عددها نیامده است.',
          ).replace('{count}', formatNumber(kpis?.unconvertedInvoices ?? 0, intlLocale))}
        </p>
      ) : null}

      <DashboardView
        t={t}
        fmt={fmtInBasis}
        totalSales={kpis?.totalSales ?? 0}
        todaySales={kpis?.todaySales ?? 0}
        rangeSalesTotal={rangeSalesTotal}
        previousRangeSalesTotal={previousRangeSalesTotal}
        rangeLoading={rangeLoading}
        customerDebt={kpis?.customerDebt ?? 0}
        warehouseValue={kpis?.warehouseValue ?? 0}
        monthlyGrowth={kpis?.monthlyGrowth ?? null}
        kpiLoading={kpiLoading}
        insights={Array.isArray(insights) ? insights : []}
        insightsLoading={insightsLoading}
        salesChartData={salesChartData}
        chartLoading={chartLoading}
        pendingInvoicesLabel={pendingInvoicesLabel}
        dateRange={dateRange}
        activitiesLoading={activitiesLoading}
        recentActivities={recentActivities}
        onNavigate={(route) => push(route)}
        onInsightAction={handleAction}
        onDateRangeChange={handleDateRangeChange}
        show={{
          kpis: look.shows('kpis'),
          chart: look.shows('chart') && may('invoice.read'),
          insights: look.shows('insights') && mayInsights,
          activities: look.shows('activities'),
        }}
        order={sectionOrder}
        hiddenFigures={kpis?.hidden ?? []}
      />

      {look.shows('manufacturing') ? (
        <ManufacturingDashboardCard
          t={t}
          locale={intlLocale}
          from={toIsoDay(dateRange.from)}
          to={toIsoDay(dateRange.to)}
          onOpen={() => push('/manufacturing')}
        />
      ) : null}
    </>
  )
}
