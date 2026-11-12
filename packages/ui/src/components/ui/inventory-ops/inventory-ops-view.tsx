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

import { useNumberFormat } from '../../../hooks/use-number-format'
import { useState } from 'react'
import {
  apiErrorMessage,
  useCashForecast,
  useCreateDraftPurchaseOrdersFromSuggestions,
  useDeadStock,
  useMyCapabilities,
  usePurchaseOrders,
  useQualityEvents,
  useRecordQualityEvent,
  useReorderSuggestions,
  useShiftHistory,
  useStaleOpportunities,
  useSupplierScorecard,
  useThreeWayMatch,
} from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { SearchableTable } from '../data-table'
import { EmptyState } from '../empty-state'
import { KpiCard } from '../kpi-card'
import { SegmentedControl } from '../segmented-control'
import { SelectField } from '../select-field'

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
  const num = useNumberFormat()
  const tr = translator(t)
  const reorder = useReorderSuggestions()
  const createDraftPos = useCreateDraftPurchaseOrdersFromSuggestions()
  const scorecard = useSupplierScorecard()
  const purchaseOrders = usePurchaseOrders()

  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [packSizeInput, setPackSizeInput] = useState('1')
  const [unitPriceInput, setUnitPriceInput] = useState('')
  const [selectedPoId, setSelectedPoId] = useState('')
  const [draftFeedback, setDraftFeedback] = useState<string | null>(null)

  const threeWayMatch = useThreeWayMatch(selectedPoId || null)

  if (reorder.isLoading) return <Waiting text={tr('common.loading', 'در حال بارگذاری…')} />
  if (reorder.isError) return <Failed text={tr('ops.loadFailed', 'این بخش خوانده نشد.')} />

  const supplierOptions = (scorecard.data ?? []).map((s) => ({
    value: s.supplierId,
    label: s.name,
  }))
  const poOptions = (purchaseOrders.data ?? []).map((po) => ({
    value: po.id,
    label: `${po.supplier?.name ?? po.id.slice(0, 8)} (${po.status})`,
  }))

  const handleDraftAll = async () => {
    setDraftFeedback(null)
    const rows = reorder.data ?? []
    const packSize = Math.max(1, Number(packSizeInput) || 1)
    const unitPrice = Number(unitPriceInput)
    if (!selectedSupplierId || !(unitPrice > 0) || rows.length === 0) {
      setDraftFeedback(
        tr('ops.draftPoValidation', 'لطفاً تأمین‌کننده و قیمت واحد معتبر را مشخص کنید.'),
      )
      return
    }
    try {
      await createDraftPos.mutateAsync({
        suggestions: rows.map((r) => ({
          productId: r.productId,
          productName: r.productName,
          supplierId: selectedSupplierId,
          onHand: r.onHand,
          reorderLevel: r.reorderLevel,
          openPoQuantity: 0,
          purchasePackSize: packSize,
          unitPrice,
        })),
      })
      setDraftFeedback(tr('ops.draftPoCreated', 'پیش‌نویس سفارش خرید برای تأیید ثبت شد.'))
    } catch (err) {
      setDraftFeedback(apiErrorMessage(err, tr('ops.loadFailed', 'این بخش خوانده نشد.')))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3">
        <div className="min-w-44 flex-1">
          <label className="mb-1 block text-xs text-[hsl(var(--fg-secondary))]">
            {tr('ops.supplierForDraft', 'تأمین‌کننده')}
          </label>
          <SelectField
            value={selectedSupplierId}
            onChange={setSelectedSupplierId}
            options={supplierOptions}
            placeholder={tr('ops.selectSupplier', 'انتخاب تأمین‌کننده')}
            searchable
          />
        </div>
        <div className="w-28">
          <label className="mb-1 block text-xs text-[hsl(var(--fg-secondary))]">
            {tr('ops.packSize', 'ضریب بسته')}
          </label>
          <input
            type="number"
            min={1}
            value={packSizeInput}
            onChange={(e) => setPackSizeInput(e.target.value)}
            className="h-9 w-full rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-2 text-sm tabular-nums"
          />
        </div>
        <div className="w-36">
          <label className="mb-1 block text-xs text-[hsl(var(--fg-secondary))]">
            {tr('ops.unitPriceForDraft', 'قیمت واحد پیشنهادی')}
          </label>
          <input
            type="number"
            min={0}
            value={unitPriceInput}
            onChange={(e) => setUnitPriceInput(e.target.value)}
            className="h-9 w-full rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-2 text-sm tabular-nums"
          />
        </div>
        <button
          type="button"
          onClick={handleDraftAll}
          disabled={createDraftPos.isPending || (reorder.data?.length ?? 0) === 0}
          className="h-9 rounded-md bg-[hsl(var(--color-primary))] px-3 text-xs font-medium text-[hsl(var(--color-primary-fg))] disabled:opacity-50"
        >
          {tr('ops.createDraftPo', 'ایجاد پیش‌نویس سفارش خرید')}
        </button>
        {draftFeedback ? (
          <p className="w-full text-xs text-[hsl(var(--fg-secondary))]">{draftFeedback}</p>
        ) : null}
      </div>

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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-[hsl(var(--border-default))] p-3">
          <h4 className="mb-2 text-sm font-medium">
            {tr('ops.threeWayMatchTitle', 'تطبیق سه‌جانبه (سفارش / رسید / فاکتور)')}
          </h4>
          <SelectField
            value={selectedPoId}
            onChange={setSelectedPoId}
            options={poOptions}
            placeholder={tr('ops.selectPoForMatch', 'انتخاب سفارش خرید')}
            searchable
          />
          {selectedPoId && threeWayMatch.isError ? (
            <p role="alert" className="mt-2 text-xs text-[hsl(var(--color-destructive))]">
              {apiErrorMessage(threeWayMatch.error, tr('ops.loadFailed', 'این بخش خوانده نشد.'))}
            </p>
          ) : selectedPoId && threeWayMatch.data ? (
            <div className="mt-2 space-y-2 text-xs">
              <p className="font-medium">
                {threeWayMatch.data.matched
                  ? tr('ops.threeWayMatched', 'تطبیق کامل — آماده تأیید پرداخت')
                  : tr('ops.threeWayBlocked', 'مغایرت یافت شد — پرداخت متوقف است')}
              </p>
              {threeWayMatch.data.mismatches.map((m, idx) => (
                <p key={`${m.code}-${idx}`} className="text-[hsl(var(--color-destructive))]">
                  {m.code}: {m.detail}
                </p>
              ))}
              <ReceiptQualitySection poId={selectedPoId} t={t} />
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-[hsl(var(--border-default))] p-3">
          <h4 className="mb-2 text-sm font-medium">
            {tr('ops.supplierScorecardTitle', 'کارنامه تأمین‌کنندگان')}
          </h4>
          {(scorecard.data ?? []).length === 0 ? (
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">
              {tr('ops.supplierScorecardEmpty', 'داده‌ای برای ارزیابی تأمین‌کنندگان موجود نیست.')}
            </p>
          ) : (
            <ul className="space-y-1 text-xs">
              {(scorecard.data ?? []).slice(0, 6).map((row) => (
                <li key={row.supplierId} className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{row.name}</span>
                  <span className="tabular-nums text-[hsl(var(--fg-secondary))]">
                    {row.band} ({row.evidence.purchases})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function ReceiptQualitySection({ poId, t }: { poId: string; t: OpsSectionProps['t'] }) {
  const tr = translator(t)
  const capabilities = useMyCapabilities()
  const canInspect = capabilities.can('inventory.configure') === true
  const events = useQualityEvents({ sourceType: 'receipt', sourceId: poId })
  const recordQuality = useRecordQualityEvent()
  const [notes, setNotes] = useState('')

  return (
    <div className="border-t border-[hsl(var(--border-default))] pt-2 space-y-1.5">
      <div className="font-medium text-[hsl(var(--fg-primary))]">
        {tr('ops.receiptQualityTitle', 'بازرسی کیفیت رسید')}
      </div>
      {events.isError ? (
        <p role="alert" className="text-[hsl(var(--color-destructive))]">
          {apiErrorMessage(events.error, tr('ops.loadFailed', 'این بخش خوانده نشد.'))}
        </p>
      ) : (events.data ?? []).length === 0 ? (
        <p className="text-[hsl(var(--fg-tertiary))]">
          {tr('ops.receiptQualityEmpty', 'رویداد بازرسی برای این رسید ثبت نشده است.')}
        </p>
      ) : (
        <ul className="space-y-0.5 text-[11px] text-[hsl(var(--fg-secondary))]">
          {(events.data ?? []).slice(0, 3).map((ev) => (
            <li key={ev.id}>
              {ev.event_kind}
              {ev.notes ? ` — ${ev.notes}` : ''}
            </li>
          ))}
        </ul>
      )}
      {canInspect ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={tr('ops.receiptQualityNotes', 'یادداشت بازرسی')}
            className="h-7 rounded border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-2 text-xs"
          />
          <button
            type="button"
            disabled={recordQuality.isPending}
            onClick={() =>
              recordQuality.mutate({
                sourceType: 'receipt',
                sourceId: poId,
                eventKind: 'pass',
                ...(notes.trim() ? { notes: notes.trim() } : {}),
              })
            }
            className="h-7 rounded border border-[hsl(var(--border-default))] px-2 text-xs"
          >
            {tr('ops.receiptQualityPass', 'تایید کیفیت')}
          </button>
          <button
            type="button"
            disabled={recordQuality.isPending}
            onClick={() =>
              recordQuality.mutate({
                sourceType: 'receipt',
                sourceId: poId,
                eventKind: 'fail',
                ...(notes.trim() ? { notes: notes.trim() } : {}),
              })
            }
            className="h-7 rounded border border-[hsl(var(--color-destructive))] px-2 text-xs text-[hsl(var(--color-destructive))]"
          >
            {tr('ops.receiptQualityFail', 'رد و قرنطینه')}
          </button>
        </div>
      ) : null}
    </div>
  )
}

// ─── L4 · dead stock ─────────────────────────────────────────────────────

export function OpsDeadStockSection({ t, fmtDate }: OpsSectionProps) {
  const num = useNumberFormat()
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
          id: 'lastSale',
          labelKey: 'ops.lastSale',
          labelFallback: 'آخرین فروش',
          sortValue: (item) => item.lastSoldAt ?? null,
          // NEVER SOLD is its own answer — not «∞ days», and not «today».
          render: (item) =>
            item.neverSold || !item.lastSoldAt
              ? tr('ops.neverSold', 'هرگز فروش نرفته')
              : fmtDate(item.lastSoldAt),
        },
      ]}
    />
  )
}

// ─── N3 · cash forecast ──────────────────────────────────────────────────

export function OpsCashForecastSection({ t, fmtMoney, fmtDate }: OpsSectionProps) {
  const num = useNumberFormat()
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
  const num = useNumberFormat()
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
