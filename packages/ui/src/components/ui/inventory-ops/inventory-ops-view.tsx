'use client'

// ============================================
// packages/ui/src/components/ui/inventory-ops/inventory-ops-view.tsx
//
// «عملیات» — five reads that used to be stacked on one screen.
//
// Each is its own component now, owning its own read, so it can be shown
// alone: this page shows ONE at a time behind the shared switch, and the hub a
// section shares its data with mounts the same component (reorder and dead
// stock are in «انبار»; stale opportunities are in «مشتریان»).
//
// ⚠️ «—», NEVER 0. A figure that is not known (no cost yet, a shift still
// open, a product that never moved) is shown as a dash or said in words. A
// zero would read as a fact.
// ============================================

import { useState } from 'react'
import {
  useCashForecast,
  useDeadStock,
  useReorderSuggestions,
  useShiftHistory,
  useStaleOpportunities,
} from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { SearchableTable } from '../data-table'
import { EmptyState } from '../empty-state'
import { KpiCard } from '../kpi-card'
import { SegmentedControl } from '../segmented-control'

export interface InventoryOpsViewProps {
  t?: ((key: string, fallback?: string) => string) | undefined
  fmtMoney: (value: number) => string
  fmtDate: (value: string) => string
}

type OpsSectionProps = InventoryOpsViewProps

/** The parts of this page, in the order the switch offers them. */
export const OPS_SECTIONS = ['reorder', 'deadStock', 'cash', 'shifts', 'stale'] as const
export type OpsSection = (typeof OPS_SECTIONS)[number]

/** «—», never 0. See the header. */
function orDash(value: number | null | undefined, format: (value: number) => string): string {
  return value === null || value === undefined ? '—' : format(value)
}

const num = (value: number) => value.toLocaleString('fa-AF')
const translator =
  (t: OpsSectionProps['t']) =>
  (key: string, fallback: string): string =>
    t ? t(key, fallback) : fallback

function Waiting({ text }: { text: string }) {
  return <p className="p-4 text-sm text-[hsl(var(--fg-tertiary))]">{text}</p>
}

/** A read that failed is said to have failed — it is never «nothing to show». */
function Failed({ text }: { text: string }) {
  return (
    <p role="alert" className="p-4 text-sm text-[hsl(var(--color-destructive))]">
      {text}
    </p>
  )
}

// ─── L3 · reorder suggestions ────────────────────────────────────────────

export function OpsReorderSection({ t }: OpsSectionProps) {
  const tr = translator(t)
  const reorder = useReorderSuggestions()
  if (reorder.isLoading) return <Waiting text={tr('common.loading', 'در حال بارگذاری…')} />
  if (reorder.isError) return <Failed text={tr('ops.loadFailed', 'این بخش خوانده نشد.')} />
  return (
    <SearchableTable
      tableId="ops-reorder"
      rows={reorder.data ?? []}
      rowKey={(item) => item.productId}
      words={(item) => [item.productName]}
      empty={
        <EmptyState
          title={tr('ops.reorderEmpty', 'هیچ کالایی به نقطه‌ی سفارش نرسیده')}
          description={tr('ops.reorderEmptyHint', 'موجودی همه‌ی کالاها بالای حد تعیین‌شده است.')}
        />
      }
      columns={[
        {
          id: 'product',
          labelKey: 'ops.product',
          labelFallback: 'کالا',
          locked: true,
          sortValue: (item) => item.productName,
          render: (item) => <span className="font-medium">{item.productName}</span>,
        },
        {
          id: 'onHand',
          labelKey: 'ops.onHand',
          labelFallback: 'موجودی',
          align: 'end',
          sortValue: (item) => item.onHand,
          render: (item) => <span className="tabular-nums">{num(item.onHand)}</span>,
        },
        {
          id: 'reorderLevel',
          labelKey: 'ops.reorderLevel',
          labelFallback: 'نقطه‌ی سفارش',
          align: 'end',
          showFrom: 'md',
          sortValue: (item) => item.reorderLevel,
          render: (item) => <span className="tabular-nums">{num(item.reorderLevel)}</span>,
        },
        {
          id: 'suggested',
          labelKey: 'ops.suggested',
          labelFallback: 'پیشنهاد',
          align: 'end',
          sortValue: (item) => item.suggestedQuantity,
          render: (item) => (
            <span className="font-semibold tabular-nums">{num(item.suggestedQuantity)}</span>
          ),
        },
        {
          id: 'daysOfCover',
          labelKey: 'ops.daysOfCover',
          labelFallback: 'کفایت (روز)',
          align: 'end',
          showFrom: 'md',
          sortValue: (item) => item.daysOfCover ?? null,
          render: (item) => <span className="tabular-nums">{orDash(item.daysOfCover, num)}</span>,
        },
      ]}
    />
  )
}

// ─── L4 · dead stock ─────────────────────────────────────────────────────

export function OpsDeadStockSection({ t, fmtMoney, fmtDate }: OpsSectionProps) {
  const tr = translator(t)
  const deadStock = useDeadStock()
  if (deadStock.isLoading) return <Waiting text={tr('common.loading', 'در حال بارگذاری…')} />
  if (deadStock.isError) return <Failed text={tr('ops.loadFailed', 'این بخش خوانده نشد.')} />
  return (
    <SearchableTable
      tableId="ops-dead-stock"
      rows={deadStock.data ?? []}
      rowKey={(item) => item.productId}
      words={(item) => [item.productName]}
      empty={
        <EmptyState
          title={tr('ops.deadStockEmpty', 'کالای راکدی نیست')}
          description={tr('ops.deadStockEmptyHint', 'همه‌ی کالاها اخیراً حرکت داشته‌اند.')}
        />
      }
      columns={[
        {
          id: 'product',
          labelKey: 'ops.product',
          labelFallback: 'کالا',
          locked: true,
          sortValue: (item) => item.productName,
          render: (item) => <span className="font-medium">{item.productName}</span>,
        },
        {
          id: 'onHand',
          labelKey: 'ops.onHand',
          labelFallback: 'موجودی',
          align: 'end',
          sortValue: (item) => item.onHand,
          render: (item) => <span className="tabular-nums">{num(item.onHand)}</span>,
        },
        {
          id: 'stockValue',
          labelKey: 'ops.stockValue',
          labelFallback: 'ارزش (به قیمت تمام‌شده)',
          align: 'end',
          sortValue: (item) => item.stockValue,
          render: (item) => <span className="tabular-nums">{fmtMoney(item.stockValue)}</span>,
        },
        {
          id: 'lastMovement',
          labelKey: 'ops.lastMovement',
          labelFallback: 'آخرین حرکت',
          showFrom: 'md',
          sortValue: (item) => item.lastMovementAt ?? null,
          // A product that has NEVER moved is not the same as one whose date is
          // unknown, and both differ from «today».
          render: (item) =>
            item.lastMovementAt
              ? fmtDate(item.lastMovementAt)
              : tr('ops.neverMoved', 'هرگز حرکت نکرده'),
        },
      ]}
    />
  )
}

// ─── N3 · cash forecast ──────────────────────────────────────────────────

export function OpsCashForecastSection({ t, fmtMoney, fmtDate }: OpsSectionProps) {
  const tr = translator(t)
  const forecast = useCashForecast()
  if (!forecast.data) {
    return (
      <Waiting
        text={
          forecast.isLoading
            ? tr('common.loading', 'در حال بارگذاری…')
            : tr('ops.noForecast', 'داده‌ای برای پیش‌بینی نیست')
        }
      />
    )
  }
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <KpiCard
        label={tr('ops.openingBalance', 'موجودی فعلی')}
        value={fmtMoney(forecast.data.openingBalance)}
      />
      <KpiCard
        label={tr('ops.daysProjected', 'روزهای پیش‌بینی')}
        value={num(forecast.data.days.length)}
      />
      {/* ⚠️ null means «no shortfall in the projected window», which is good news
          and must not read like missing data — so the red is on the DATE, never
          on «کسری ندارد». */}
      <KpiCard
        label={tr('ops.firstShortfall', 'اولین کسری')}
        value={
          forecast.data.firstShortfallDate ? (
            <span className="text-[hsl(var(--color-destructive))]">
              {fmtDate(forecast.data.firstShortfallDate)}
            </span>
          ) : (
            tr('ops.noShortfall', 'کسری ندارد')
          )
        }
      />
    </div>
  )
}

// ─── M3 · shift history ──────────────────────────────────────────────────

export function OpsShiftHistorySection({ t, fmtMoney, fmtDate }: OpsSectionProps) {
  const tr = translator(t)
  const shifts = useShiftHistory()
  if (shifts.isLoading) return <Waiting text={tr('common.loading', 'در حال بارگذاری…')} />
  if (shifts.isError) return <Failed text={tr('ops.loadFailed', 'این بخش خوانده نشد.')} />
  const minor = (value: number) => fmtMoney(value / 100)
  return (
    <SearchableTable
      tableId="ops-shifts"
      rows={shifts.data ?? []}
      rowKey={(shift) => shift.id}
      words={(shift) => [fmtDate(shift.openedAt), shift.varianceReason ?? '']}
      empty={<EmptyState title={tr('ops.shiftsEmpty', 'هنوز شیفتی بسته نشده')} />}
      columns={[
        {
          id: 'opened',
          labelKey: 'ops.opened',
          labelFallback: 'باز شد',
          locked: true,
          sortValue: (shift) => shift.openedAt,
          render: (shift) => fmtDate(shift.openedAt),
        },
        {
          id: 'closed',
          labelKey: 'ops.closed',
          labelFallback: 'بسته شد',
          sortValue: (shift) => shift.closedAt ?? null,
          render: (shift) =>
            shift.closedAt ? fmtDate(shift.closedAt) : tr('ops.stillOpen', 'باز است'),
        },
        {
          id: 'expected',
          labelKey: 'ops.expected',
          labelFallback: 'نقد مورد انتظار',
          align: 'end',
          showFrom: 'md',
          sortValue: (shift) => shift.expectedCashMinor ?? null,
          render: (shift) => (
            <span className="tabular-nums">{orDash(shift.expectedCashMinor, minor)}</span>
          ),
        },
        {
          id: 'counted',
          labelKey: 'ops.counted',
          labelFallback: 'شمرده‌شده',
          align: 'end',
          showFrom: 'md',
          sortValue: (shift) => shift.countedCashMinor ?? null,
          render: (shift) => (
            <span className="tabular-nums">{orDash(shift.countedCashMinor, minor)}</span>
          ),
        },
        {
          id: 'variance',
          labelKey: 'ops.variance',
          labelFallback: 'اختلاف',
          align: 'end',
          sortValue: (shift) => shift.varianceMinor ?? null,
          render: (shift) => (
            <span
              className={cn(
                'tabular-nums',
                // A variance of any sign is worth noticing; only exactly zero
                // is neutral.
                shift.varianceMinor
                  ? 'font-semibold text-[hsl(var(--color-destructive))]'
                  : undefined,
              )}
            >
              {orDash(shift.varianceMinor, minor)}
              {shift.varianceReason ? (
                <span className="ms-1 text-[10px] text-[hsl(var(--fg-tertiary))]">
                  ({shift.varianceReason})
                </span>
              ) : null}
            </span>
          ),
        },
      ]}
    />
  )
}

// ─── N4 · stale opportunities ────────────────────────────────────────────

export function OpsStaleOpportunitiesSection({ t, fmtMoney }: OpsSectionProps) {
  const tr = translator(t)
  const stale = useStaleOpportunities()
  if (stale.isLoading) return <Waiting text={tr('common.loading', 'در حال بارگذاری…')} />
  if (stale.isError) return <Failed text={tr('ops.loadFailed', 'این بخش خوانده نشد.')} />
  return (
    <SearchableTable
      tableId="ops-stale-opportunities"
      rows={stale.data ?? []}
      rowKey={(item) => item.id}
      words={(item) => [item.title, item.customerName ?? '', item.stage ?? '']}
      empty={<EmptyState title={tr('ops.staleEmpty', 'فرصت راکدی نیست')} />}
      columns={[
        {
          id: 'title',
          labelKey: 'ops.opportunity',
          labelFallback: 'فرصت',
          locked: true,
          sortValue: (item) => item.title,
          render: (item) => <span className="font-medium">{item.title}</span>,
        },
        {
          id: 'customer',
          labelKey: 'ops.customer',
          labelFallback: 'مشتری',
          sortValue: (item) => item.customerName ?? '',
          render: (item) => item.customerName ?? '—',
        },
        {
          id: 'stage',
          labelKey: 'ops.stage',
          labelFallback: 'مرحله',
          showFrom: 'md',
          sortValue: (item) => item.stage ?? '',
          render: (item) => item.stage ?? '—',
        },
        {
          id: 'value',
          labelKey: 'ops.value',
          labelFallback: 'ارزش',
          align: 'end',
          sortValue: (item) => item.valueMinor ?? null,
          render: (item) => (
            <span className="tabular-nums">
              {orDash(item.valueMinor, (value) => fmtMoney(value / 100))}
            </span>
          ),
        },
        {
          id: 'daysStale',
          labelKey: 'ops.daysStale',
          labelFallback: 'روز بی‌حرکت',
          align: 'end',
          sortValue: (item) => item.daysStale ?? null,
          render: (item) => <span className="tabular-nums">{orDash(item.daysStale, num)}</span>,
        },
      ]}
    />
  )
}

// ─── the page: one part at a time ────────────────────────────────────────

export function InventoryOpsView(props: InventoryOpsViewProps) {
  const tr = translator(props.t)
  const [section, setSection] = useState<OpsSection>('reorder')

  const label: Record<OpsSection, string> = {
    reorder: tr('ops.reorder', 'پیشنهاد سفارش'),
    deadStock: tr('ops.deadStock', 'کالای راکد'),
    cash: tr('ops.cashForecast', 'پیش‌بینی نقدینگی'),
    shifts: tr('ops.shiftHistory', 'تاریخچه‌ی شیفت‌ها'),
    stale: tr('ops.staleOpportunities', 'فرصت‌های راکد'),
  }

  return (
    <div className="space-y-4">
      <SegmentedControl
        label={tr('ops.sectionsLabel', 'بخش')}
        options={OPS_SECTIONS.map((value) => ({ value, label: label[value] }))}
        value={section}
        onChange={setSection}
        className="max-w-full flex-wrap"
      />
      {section === 'reorder' ? <OpsReorderSection {...props} /> : null}
      {section === 'deadStock' ? <OpsDeadStockSection {...props} /> : null}
      {section === 'cash' ? <OpsCashForecastSection {...props} /> : null}
      {section === 'shifts' ? <OpsShiftHistorySection {...props} /> : null}
      {section === 'stale' ? <OpsStaleOpportunitiesSection {...props} /> : null}
    </div>
  )
}

export default InventoryOpsView
