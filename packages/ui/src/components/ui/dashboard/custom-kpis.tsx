'use client'

// ============================================
// The dashboard cards a person adds (owner request, 9 Nov 2026).
//
// The dashboard keeps its fixed cards; a «+» card beside them adds up to
// FOUR more, picked from figures other pages already show (the shared list
// in packages/validation/src/schemas/dashboard-kpis.ts — no new KPI is
// computed here). Each added card has «remove» and «replace». The choice is
// saved in the database for this person and workspace
// (user-dashboard-kpis-01), so it follows them to every device.
//
// Each figure is its own small component with its own hook, so no hook is
// ever called conditionally.
// ============================================

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  ArrowLeftRight,
  Boxes,
  FileText,
  HandCoins,
  PackagePlus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import {
  apiErrorMessage,
  useAdvances,
  useCustomers,
  useDashboardKpis,
  useInvoices,
  useProducts,
  useSaveDashboardKpis,
} from '@hisabche/api'
import {
  formatNumber,
  FRACTION_DIGITS,
  fractionDigits,
  type KnownCurrency,
} from '@hisabche/formatting'
import {
  DASHBOARD_KPI_CATEGORIES,
  DASHBOARD_KPIS,
  MAX_CUSTOM_DASHBOARD_KPIS,
  type DashboardKpiId,
} from '@hisabche/validation'

import { cn } from '../../../lib/utils'
import { Dialog, DialogContent, DialogTitle } from '../dialog'
import { KpiCard } from '../kpi-card'

const ICON: Record<DashboardKpiId, LucideIcon> = {
  'sales.total': TrendingUp,
  'sales.pending': FileText,
  'sales.paid': TrendingUp,
  'sales.count': FileText,
  'purchases.total': ShoppingCart,
  'purchases.pending': ShoppingCart,
  'purchases.count': ShoppingCart,
  'advances.preSaleRemaining': HandCoins,
  'advances.prePurchaseRemaining': PackagePlus,
  'customers.count': Users,
  'products.count': Boxes,
}

/** `sales.total` → `dashboard.customKpi.items.sales_total` (a dotted id is not a message key). */
const labelKey = (id: DashboardKpiId) => `dashboard.customKpi.items.${id.replace(/\./g, '_')}`

type Tr = (key: string) => string

interface FigureProps {
  locale: string
}

/** A figure for the card: text to show, and whether it is still loading. */
interface Figure {
  value: string
  loading: boolean
}

function money(amount: number, currencies: readonly string[], locale: string): string {
  const only = currencies.length === 1 ? currencies[0] : undefined
  return only ? `${formatNumber(amount, locale, 3)} ${only}` : formatNumber(amount, locale, 3)
}

function useInvoiceFigure(
  type: 'sale' | 'purchase',
  field: 'totalAmount' | 'pendingAmount' | 'paidAmount' | 'count',
  locale: string,
): Figure {
  // The list's figures are computed by the server only when asked for (QA-KPI-001:
  // without this the card stayed blank — the reply had no `summary`).
  const query = useInvoices({
    page: 1,
    limit: 1,
    sortDirection: 'desc',
    type,
    includeSummary: true,
  })
  const summary = query.data?.summary
  if (!summary) return { value: query.isError ? '—' : '', loading: query.isLoading }
  return {
    value:
      field === 'count'
        ? formatNumber(summary.count, locale, 0)
        : money(summary[field], summary.currencies, locale),
    loading: false,
  }
}

function useAdvanceFigure(kind: 'pre_sale' | 'pre_purchase', locale: string): Figure {
  const query = useAdvances(kind)
  if (!query.data) return { value: query.isError ? '—' : '', loading: query.isLoading }
  const currencies = [...new Set(query.data.map((row) => row.currency ?? '?'))]
  const only = currencies.length === 1 ? currencies[0] : undefined
  if (query.data.length === 0) return { value: formatNumber(0, locale, 0), loading: false }
  if (!only || !(only in FRACTION_DIGITS)) return { value: '—', loading: false }
  const scale = 10 ** fractionDigits(only as KnownCurrency)
  const minor = query.data.reduce((sum, row) => sum + row.remainingMinor, 0)
  return { value: `${formatNumber(minor / scale, locale, 3)} ${only}`, loading: false }
}

function countFigure(
  query: { data?: { total?: number } | undefined; isError: boolean; isLoading: boolean },
  locale: string,
): Figure {
  const total = query.data?.total
  if (typeof total !== 'number')
    return { value: query.isError ? '—' : '', loading: query.isLoading }
  return { value: formatNumber(total, locale, 0), loading: false }
}

function useSalesTotal({ locale }: FigureProps): Figure {
  return useInvoiceFigure('sale', 'totalAmount', locale)
}
function useSalesPending({ locale }: FigureProps): Figure {
  return useInvoiceFigure('sale', 'pendingAmount', locale)
}
function useSalesPaid({ locale }: FigureProps): Figure {
  return useInvoiceFigure('sale', 'paidAmount', locale)
}
function useSalesCount({ locale }: FigureProps): Figure {
  return useInvoiceFigure('sale', 'count', locale)
}
function usePurchasesTotal({ locale }: FigureProps): Figure {
  return useInvoiceFigure('purchase', 'totalAmount', locale)
}
function usePurchasesPending({ locale }: FigureProps): Figure {
  return useInvoiceFigure('purchase', 'pendingAmount', locale)
}
function usePurchasesCount({ locale }: FigureProps): Figure {
  return useInvoiceFigure('purchase', 'count', locale)
}
function usePreSaleRemaining({ locale }: FigureProps): Figure {
  return useAdvanceFigure('pre_sale', locale)
}
function usePrePurchaseRemaining({ locale }: FigureProps): Figure {
  return useAdvanceFigure('pre_purchase', locale)
}
function useCustomersCount({ locale }: FigureProps): Figure {
  return countFigure(useCustomers({ page: 1, limit: 1, sortDirection: 'desc' }), locale)
}
function useProductsCount({ locale }: FigureProps): Figure {
  return countFigure(useProducts({ page: 1, limit: 1 }), locale)
}

// One hook per figure. A card is keyed by its id, so a «replace» remounts it
// and the hook it calls never changes during a card's life.
const FIGURE: Record<DashboardKpiId, (props: FigureProps) => Figure> = {
  'sales.total': useSalesTotal,
  'sales.pending': useSalesPending,
  'sales.paid': useSalesPaid,
  'sales.count': useSalesCount,
  'purchases.total': usePurchasesTotal,
  'purchases.pending': usePurchasesPending,
  'purchases.count': usePurchasesCount,
  'advances.preSaleRemaining': usePreSaleRemaining,
  'advances.prePurchaseRemaining': usePrePurchaseRemaining,
  'customers.count': useCustomersCount,
  'products.count': useProductsCount,
}

/** Where each figure lives, so the card opens it. */
const HREF: Record<DashboardKpiId, string> = {
  'sales.total': '/invoices?type=sale',
  'sales.pending': '/invoices?type=sale',
  'sales.paid': '/invoices?type=sale',
  'sales.count': '/invoices?type=sale',
  'purchases.total': '/invoices?type=purchase',
  'purchases.pending': '/invoices?type=purchase',
  'purchases.count': '/invoices?type=purchase',
  'advances.preSaleRemaining': '/invoices?type=pre_sale',
  'advances.prePurchaseRemaining': '/invoices?type=pre_purchase',
  'customers.count': '/customers',
  'products.count': '/warehouse?tab=products',
}

function AddedKpiCard({
  id,
  locale,
  tr,
  onRemove,
  onReplace,
  onNavigate,
  busy,
}: {
  id: DashboardKpiId
  locale: string
  tr: Tr
  onRemove: () => void
  onReplace: () => void
  onNavigate: (href: string) => void
  busy: boolean
}) {
  // Each id maps to ONE fixed component; React sees the same hooks every render.
  const useFigure = FIGURE[id]
  const figure = useFigure({ locale })
  const iconButton =
    'inline-flex size-7 items-center justify-center rounded-md text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))] disabled:opacity-50'
  return (
    <div data-custom-kpi={id}>
      <KpiCard
        icon={ICON[id]}
        label={tr(labelKey(id))}
        labelAddon={
          <span className="ms-auto flex items-center gap-0.5">
            <button
              type="button"
              className={iconButton}
              aria-label={tr('dashboard.customKpi.replace')}
              title={tr('dashboard.customKpi.replace')}
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation()
                onReplace()
              }}
            >
              <ArrowLeftRight className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={iconButton}
              aria-label={tr('dashboard.customKpi.remove')}
              title={tr('dashboard.customKpi.remove')}
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation()
                onRemove()
              }}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        }
        value={figure.value}
        delta={null}
        isLoading={figure.loading}
        onOpen={() => onNavigate(HREF[id])}
        openLabel={tr(labelKey(id))}
      />
    </div>
  )
}

function KpiPicker({
  open,
  tr,
  taken,
  onPick,
  onClose,
}: {
  open: boolean
  tr: Tr
  taken: readonly DashboardKpiId[]
  onPick: (id: DashboardKpiId) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const groups = useMemo(
    () =>
      DASHBOARD_KPI_CATEGORIES.map((category) => ({
        category,
        items: DASHBOARD_KPIS.filter((kpi) => kpi.category === category).filter(
          (kpi) =>
            !needle ||
            tr(labelKey(kpi.id)).toLowerCase().includes(needle) ||
            tr(`dashboard.customKpi.categories.${category}`).toLowerCase().includes(needle),
        ),
      })).filter((group) => group.items.length > 0),
    [needle, tr],
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery('')
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogTitle>{tr('dashboard.customKpi.pickTitle')}</DialogTitle>
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[hsl(var(--fg-tertiary))]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tr('dashboard.customKpi.search')}
            aria-label={tr('dashboard.customKpi.search')}
            className="h-10 w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] ps-9 pe-3 text-sm focus:border-[hsl(var(--color-primary)/0.5)] focus:outline-none"
          />
        </div>
        <div className="max-h-[55dvh] space-y-4 overflow-y-auto overscroll-contain">
          {groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
              {tr('dashboard.customKpi.noMatch')}
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.category} className="space-y-1.5">
                <h3 className="text-xs font-semibold text-[hsl(var(--fg-tertiary))]">
                  {tr(`dashboard.customKpi.categories.${group.category}`)}
                </h3>
                <ul className="space-y-1">
                  {group.items.map((kpi) => {
                    const Icon = ICON[kpi.id]
                    const already = taken.includes(kpi.id)
                    return (
                      <li key={kpi.id}>
                        <button
                          type="button"
                          disabled={already}
                          data-pick-kpi={kpi.id}
                          onClick={() => {
                            setQuery('')
                            onPick(kpi.id)
                          }}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-start text-sm',
                            'border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted))]',
                            'disabled:cursor-not-allowed disabled:opacity-50',
                          )}
                        >
                          <Icon
                            className="size-4 shrink-0 text-[hsl(var(--color-primary))]"
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate">{tr(labelKey(kpi.id))}</span>
                          {already ? (
                            <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                              {tr('dashboard.customKpi.alreadyAdded')}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The added cards and the «+» card, as children of the dashboard's `KpiGrid`.
 */
export function CustomKpiCards({
  locale,
  onNavigate,
}: {
  locale: string
  onNavigate: (href: string) => void
}) {
  const t = useTranslations()
  const tr: Tr = (key) => t(key as Parameters<typeof t>[0])
  const choice = useDashboardKpis()
  const save = useSaveDashboardKpis()
  // `null` = closed; `-1` = adding; an index = replacing that card.
  const [picking, setPicking] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const kpis = choice.data?.kpis ?? []
  const write = (next: DashboardKpiId[]) => {
    setError(null)
    save.mutate(next, {
      onError: (err) => setError(apiErrorMessage(err, tr('dashboard.customKpi.saveFailed'))),
    })
  }

  if (choice.isLoading || choice.isError) return null

  return (
    <>
      {kpis.map((id, index) => (
        <AddedKpiCard
          key={id}
          id={id}
          locale={locale}
          tr={tr}
          busy={save.isPending}
          onNavigate={onNavigate}
          onRemove={() => write(kpis.filter((_, at) => at !== index))}
          onReplace={() => setPicking(index)}
        />
      ))}
      {kpis.length < MAX_CUSTOM_DASHBOARD_KPIS ? (
        <button
          type="button"
          data-add-kpi=""
          disabled={!choice.data?.configured || save.isPending}
          onClick={() => setPicking(-1)}
          title={choice.data?.configured ? undefined : tr('dashboard.customKpi.notConfigured')}
          className={cn(
            'flex min-h-[7rem] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed p-4 text-sm font-medium',
            'border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]',
            'transition-colors hover:border-[hsl(var(--color-primary)/0.5)] hover:text-[hsl(var(--color-primary))]',
            'disabled:cursor-not-allowed disabled:opacity-60',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]',
          )}
        >
          <Plus className="size-6" aria-hidden="true" />
          <span>
            {choice.data?.configured
              ? tr('dashboard.customKpi.add')
              : tr('dashboard.customKpi.notConfigured')}
          </span>
          <span className="text-xs text-[hsl(var(--fg-tertiary))]">
            {formatNumber(kpis.length, locale, 0)} /{' '}
            {formatNumber(MAX_CUSTOM_DASHBOARD_KPIS, locale, 0)}
          </span>
        </button>
      ) : null}
      {error ? (
        <p role="alert" className="col-span-full text-xs text-[hsl(var(--color-destructive))]">
          {error}
        </p>
      ) : null}
      <KpiPicker
        open={picking !== null}
        tr={tr}
        taken={kpis}
        onClose={() => setPicking(null)}
        onPick={(id) => {
          const next =
            picking === null || picking < 0
              ? [...kpis, id]
              : kpis.map((current, at) => (at === picking ? id : current))
          setPicking(null)
          write(next)
        }}
      />
    </>
  )
}
