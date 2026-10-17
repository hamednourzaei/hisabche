'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/map/warehouse-map-panels.tsx
//
// The parts around the floor: the header, the legend, the filter bar, and the
// answer to «کدام قسمت انبار سرمایه‌ام را قفل کرده؟».
//
// ⚠️ EVERY COLOUR HERE HAS A WORD NEXT TO IT. The legend is not decoration: it
// is where «راکد» is DEFINED (no sale from this warehouse in 90 days, or never)
// and where the reader learns that quantity and value are relative to the
// fullest location of this warehouse rather than to a number invented here.
// ============================================

import { Search, Warehouse as WarehouseIcon } from 'lucide-react'
import type { MapMetric, WarehouseMap } from '@hisabche/api'

import { SelectField } from '../../select-field'
import { SegmentedControl } from '../../segmented-control'
import { cn } from '../../../../lib/utils'
import type { BandFilter, DeadCapitalRow, MapFilters, MapKpi, MapTranslator } from './map-filtering'

const card =
  'rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3'
const cardLabel = 'text-xs text-[hsl(var(--fg-tertiary))]'
const cardValue = 'mt-0.5 text-lg font-semibold tabular-nums text-[hsl(var(--fg-primary))]'

function Stat({ label, value, note }: { label: string; value: string; note?: string | undefined }) {
  return (
    <div className={card}>
      <p className={cardLabel}>{label}</p>
      <p className={cardValue}>{value}</p>
      {note ? <p className="mt-0.5 text-xs text-[hsl(var(--fg-tertiary))]">{note}</p> : null}
    </div>
  )
}

export interface MapKpiHeaderProps {
  t: MapTranslator
  fmt: (value: number) => string
  kpi: MapKpi
  costVisible: boolean
  /** True when a filter is narrowing the rows — the header says so. */
  filtered: boolean
  days: number
  unplaced: WarehouseMap['unplaced']
  drift: WarehouseMap['drift']
}

/**
 * The header.
 *
 * ⚠️ IT MOVES WITH THE FILTERS. A header that kept showing the whole warehouse
 * while the floor showed one aisle would be read as the answer about that
 * aisle — so the same rows feed both, and the note says when they are narrowed.
 */
export function MapKpiHeader({
  t,
  fmt,
  kpi,
  costVisible,
  filtered,
  days,
  unplaced,
  drift,
}: MapKpiHeaderProps) {
  return (
    <section aria-label={t('warehouseMap.kpi.aria')} className="space-y-2">
      {filtered ? (
        <p className="text-xs text-[hsl(var(--color-warning))]">{t('warehouseMap.kpi.filtered')}</p>
      ) : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          label={t('warehouseMap.kpi.locations')}
          value={String(kpi.locationCount)}
          note={t('warehouseMap.kpi.activeNote', {
            active: kpi.activeLocationCount,
            retired: kpi.locationCount - kpi.activeLocationCount,
          })}
        />
        <Stat
          label={t('warehouseMap.kpi.products')}
          value={String(kpi.productCount)}
          note={t('warehouseMap.kpi.emptyNote', { count: kpi.emptyLocationCount })}
        />
        <Stat label={t('warehouseMap.kpi.quantity')} value={String(kpi.quantity)} />
        <Stat
          label={t('warehouseMap.kpi.value')}
          value={costVisible ? fmt(kpi.value ?? 0) : '—'}
          note={
            costVisible
              ? t('warehouseMap.kpi.lowerBound', { count: kpi.productsWithoutCost })
              : t('warehouseMap.costHidden')
          }
        />
        <Stat
          // Without cost access the card answers the same question in the unit
          // the reader CAN see — and says so, rather than showing a dash where
          // a person expects the number that matters most.
          label={costVisible ? t('warehouseMap.kpi.stagnant') : t('warehouseMap.kpi.stagnantUnits')}
          value={costVisible ? fmt(kpi.stagnantValue ?? 0) : String(kpi.stagnantQuantity)}
          note={t('warehouseMap.kpi.stagnantNote', {
            locations: kpi.stagnantLocationCount,
            quantity: kpi.stagnantQuantity,
            days,
          })}
        />
      </div>

      {/* ⚠️ THE REMAINDER, SAID OUT LOUD. Stock that no location records, and
          placements that claim more than the warehouse holds, are real answers
          about the DATA — folding them into a shelf would make the map agree
          with itself and disagree with the warehouse. */}
      {unplaced.quantity > 0 ? (
        <p className="text-xs text-[hsl(var(--fg-secondary))]">
          {t('warehouseMap.unplaced', {
            products: unplaced.productCount,
            quantity: unplaced.quantity,
          })}
          {costVisible && unplaced.value !== null
            ? ` — ${t('warehouseMap.kpi.value')}: ${fmt(unplaced.value)}`
            : ''}
        </p>
      ) : null}
      {drift.productCount > 0 ? (
        <p className="text-xs text-[hsl(var(--color-warning))]">
          {t('warehouseMap.drift', { products: drift.productCount, quantity: drift.quantity })}
        </p>
      ) : null}
    </section>
  )
}

export interface MapLegendProps {
  t: MapTranslator
  metric: MapMetric
  demandWindowDays: number
  days: number
}

/** The legend of the metric on screen, with the definition of every band. */
export function MapLegend({ t, metric, demandWindowDays, days }: MapLegendProps) {
  const swatch = (style: string, dashed = false) => (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block size-3.5 shrink-0 rounded-sm border',
        dashed
          ? 'border-dashed border-[hsl(var(--color-warning))]'
          : 'border-[hsl(var(--border-default))]',
      )}
      style={{ background: style }}
    />
  )

  if (metric === 'band') {
    const bands = [
      { key: 'moving', style: 'hsl(var(--color-success) / 0.7)' },
      { key: 'slow', style: 'hsl(var(--color-warning) / 0.7)' },
      { key: 'stagnant', style: 'hsl(var(--color-destructive) / 0.7)' },
      { key: 'empty', style: 'hsl(var(--surface-muted))' },
    ]
    return (
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[hsl(var(--fg-secondary))]">
        {bands.map((band) => (
          <li key={band.key} className="flex items-center gap-1.5">
            {swatch(band.style)}
            <span>
              {t(`warehouseMap.band.${band.key}`)}
              <span className="text-[hsl(var(--fg-tertiary))]">
                {' — '}
                {t(`warehouseMap.legend.${band.key}`, { window: demandWindowDays, days })}
              </span>
            </span>
          </li>
        ))}
      </ul>
    )
  }

  const token = metric === 'quantity' ? '--color-info' : '--color-primary'
  const steps = [0.08, 0.3, 0.55, 0.85]
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[hsl(var(--fg-secondary))]">
      <span>
        {t(metric === 'quantity' ? 'warehouseMap.legend.less' : 'warehouseMap.legend.lessValue')}
      </span>
      {steps.map((opacity) => (
        <span key={opacity}>{swatch(`hsl(var(${token}) / ${opacity})`)}</span>
      ))}
      <span>
        {t(metric === 'quantity' ? 'warehouseMap.legend.more' : 'warehouseMap.legend.moreValue')}
      </span>
      <span className="text-[hsl(var(--fg-tertiary))]">
        {t(
          metric === 'quantity'
            ? 'warehouseMap.legend.relative'
            : 'warehouseMap.legend.relativeValue',
        )}
      </span>
      <span className="flex items-center gap-1.5">
        {swatch('hsl(var(--surface-muted))', true)}
        {t('warehouseMap.legend.retired')}
      </span>
    </div>
  )
}

export interface DeadCapitalPanelProps {
  t: MapTranslator
  fmt: (value: number) => string
  rows: DeadCapitalRow[]
  costVisible: boolean
  days: number
  onShow: (locationId: string) => void
}

/** «سرمایه راکد» — and a way to go and look at it. */
export function DeadCapitalPanel({
  t,
  fmt,
  rows,
  costVisible,
  days,
  onShow,
}: DeadCapitalPanelProps) {
  const total = rows.reduce((sum, row) => sum + (row.value ?? 0), 0)
  const units = rows.reduce((sum, row) => sum + row.quantity, 0)

  return (
    <section className={cn(card, 'space-y-2')} aria-label={t('warehouseMap.dead.aria')}>
      <div>
        <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {t('warehouseMap.dead.title')}
        </h3>
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
          {t('warehouseMap.dead.definition', { days })}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('warehouseMap.dead.none')}</p>
      ) : (
        <>
          <p className="text-sm text-[hsl(var(--fg-secondary))]">
            {costVisible
              ? t('warehouseMap.dead.total', { value: fmt(total), locations: rows.length })
              : t('warehouseMap.dead.totalUnits', { quantity: units, locations: rows.length })}
          </p>
          <ul className="divide-y divide-[hsl(var(--border-default))]">
            {rows.map((row) => (
              <li
                key={row.location.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[hsl(var(--fg-primary))]">
                    <span className="tabular-nums">{row.location.code}</span>
                    {row.location.name ? (
                      <span className="text-[hsl(var(--fg-secondary))]">
                        {' — '}
                        {row.location.name}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {t('warehouseMap.dead.row', {
                      products: row.productCount,
                      quantity: row.quantity,
                    })}
                    {row.quietDays === null
                      ? ` · ${t('warehouseMap.dead.neverSold')}`
                      : ` · ${t('warehouseMap.dead.days', { days: row.quietDays })}`}
                    {row.neverSoldCount > 0 && row.quietDays !== null
                      ? ` · ${t('warehouseMap.dead.someNeverSold', { count: row.neverSoldCount })}`
                      : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {row.value === null ? null : (
                    <span className="text-sm font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
                      {fmt(row.value)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onShow(row.location.id)}
                    className="rounded-full border border-[hsl(var(--border-default))] px-3 py-1 text-xs text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
                  >
                    {t('warehouseMap.dead.show')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export interface MapFiltersBarProps {
  t: MapTranslator
  warehouses: Array<{ id: string; name: string }>
  warehouseId: string | null
  onPickWarehouse: (id: string) => void
  days: number
  onPickDays: (days: number) => void
  filters: MapFilters
  onFilters: (next: MapFilters) => void
  zones: Array<{ id: string; label: string }>
  categories: string[]
  products: Array<{ id: string; name: string }>
  query: string
  onQuery: (value: string) => void
  hideUnmatched: boolean
  onHideUnmatched: (next: boolean) => void
  metric: MapMetric
  metrics: MapMetric[]
  onMetric: (metric: MapMetric) => void
  canConfigure: boolean
  onAddLocation: () => void
}

const fieldLabel = 'space-y-1 text-xs text-[hsl(var(--fg-secondary))]'

/** Every control that narrows the floor, in one place. */
export function MapFiltersBar({
  t,
  warehouses,
  warehouseId,
  onPickWarehouse,
  days,
  onPickDays,
  filters,
  onFilters,
  zones,
  categories,
  products,
  query,
  onQuery,
  hideUnmatched,
  onHideUnmatched,
  metric,
  metrics,
  onMetric,
  canConfigure,
  onAddLocation,
}: MapFiltersBarProps) {
  const ALL = ''
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className={fieldLabel}>
          <span>{t('warehouseMap.filter.warehouse')}</span>
          <SelectField
            aria-label={t('warehouseMap.filter.warehouse')}
            value={warehouseId ?? ''}
            onChange={onPickWarehouse}
            placeholder={t('warehouseMap.filter.warehousePlaceholder')}
            options={warehouses.map((warehouse) => ({
              value: warehouse.id,
              label: warehouse.name,
            }))}
          />
        </div>
        <div className={fieldLabel}>
          <span>{t('warehouseMap.filter.days')}</span>
          <SelectField
            aria-label={t('warehouseMap.filter.days')}
            value={String(days)}
            onChange={(value) => onPickDays(Number(value))}
            options={[30, 60, 90, 180, 365].map((value) => ({
              value: String(value),
              label: t('warehouseMap.filter.daysOption', { days: value }),
            }))}
          />
        </div>
        <div className={fieldLabel}>
          <span>{t('warehouseMap.filter.band')}</span>
          <SelectField
            aria-label={t('warehouseMap.filter.band')}
            value={filters.band}
            onChange={(value) => onFilters({ ...filters, band: value as BandFilter })}
            options={[
              { value: 'all', label: t('warehouseMap.filter.all') },
              { value: 'moving', label: t('warehouseMap.band.moving') },
              { value: 'slow', label: t('warehouseMap.band.slow') },
              { value: 'stagnant', label: t('warehouseMap.band.stagnant') },
              { value: 'empty', label: t('warehouseMap.band.empty') },
            ]}
          />
        </div>
        <div className={fieldLabel}>
          <span>{t('warehouseMap.filter.zone')}</span>
          <SelectField
            aria-label={t('warehouseMap.filter.zone')}
            value={filters.zoneId ?? ALL}
            onChange={(value) => onFilters({ ...filters, zoneId: value === ALL ? null : value })}
            options={[
              { value: ALL, label: t('warehouseMap.filter.all') },
              ...zones.map((zone) => ({ value: zone.id, label: zone.label })),
            ]}
          />
        </div>
        <div className={fieldLabel}>
          <span>{t('warehouseMap.filter.category')}</span>
          <SelectField
            aria-label={t('warehouseMap.filter.category')}
            value={filters.category ?? ALL}
            onChange={(value) => onFilters({ ...filters, category: value === ALL ? null : value })}
            options={[
              { value: ALL, label: t('warehouseMap.filter.all') },
              ...categories.map((category) => ({ value: category, label: category })),
            ]}
          />
        </div>
        <div className={fieldLabel}>
          <span>{t('warehouseMap.filter.product')}</span>
          <SelectField
            aria-label={t('warehouseMap.filter.product')}
            value={filters.productId ?? ALL}
            onChange={(value) => onFilters({ ...filters, productId: value === ALL ? null : value })}
            options={[
              { value: ALL, label: t('warehouseMap.filter.all') },
              ...products.map((product) => ({ value: product.id, label: product.name })),
            ]}
          />
        </div>
        <div className={cn(fieldLabel, 'col-span-2')}>
          <span>{t('warehouseMap.filter.search')}</span>
          <div className="relative">
            <Search
              className="pointer-events-none absolute inset-y-0 start-2 my-auto size-4 text-[hsl(var(--fg-tertiary))]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder={t('warehouseMap.filter.searchPlaceholder')}
              aria-label={t('warehouseMap.filter.search')}
              className="min-h-10 w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] ps-8 pe-3 text-sm text-[hsl(var(--fg-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
            />
          </div>
          <label className="flex items-center gap-1.5 pt-1">
            <input
              type="checkbox"
              checked={hideUnmatched}
              onChange={(event) => onHideUnmatched(event.target.checked)}
              className="size-3.5"
            />
            {t('warehouseMap.filter.hideUnmatched')}
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          label={t('warehouseMap.metric.label')}
          options={metrics.map((value) => ({
            value,
            label: t(`warehouseMap.metric.${value}`),
          }))}
          value={metric}
          onChange={onMetric}
        />
        {canConfigure ? (
          <button
            type="button"
            onClick={onAddLocation}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[hsl(var(--border-default))] px-3 text-sm text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
          >
            <WarehouseIcon className="size-4" aria-hidden="true" />
            {t('warehouseMap.addLocation')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
