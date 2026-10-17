'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/map/warehouse-map-view.tsx
//
// «کالاهایم کجای انبار هستند؟» — the screen.
//
// ---------------------------------------------------------------------------
// WHAT THIS SCREEN IS FOR
//
// Three questions, in the order a shopkeeper asks them:
//
//   1. Where is it?            the floor, searchable by product or by code
//   2. Which part is alive?    the metric switch, band by default
//   3. What is my money doing? «سرمایه راکد» — the part of the floor that has
//                              not sold, and a way to go and look at it
//
// ---------------------------------------------------------------------------
// ⚠️ A VIEW, NOT A SECOND INVENTORY
//
// Every quantity, value and band arrives from the server
// (`GET /api/warehouses/:id/map`). This file filters what it was given, adds up
// the rows it was given, and draws them. It cannot create a unit of stock, and
// the only write it offers is «this is on that shelf» — which the server caps
// at what the warehouse actually holds.
//
// ---------------------------------------------------------------------------
// ⚠️ AND EVERY FILTER NARROWS THE HEADER TOO
//
// A header that still described the whole warehouse while the floor showed one
// aisle would be read as the answer about that aisle. The KPI cards are
// computed from the rows on the floor, and the note above them says so whenever
// a filter or a search is narrowing them.
// ============================================

import { useCallback, useMemo, useState } from 'react'
import type { MapLocation, MapMetric, WarehouseMap } from '@hisabche/api'

import { warehouseSkeleton } from '../warehouse-skeleton'
import { WarehouseLocationDrawer } from './warehouse-location-drawer'
import { LocationDialog, type LocationFormValues } from './location-dialog'
import { WarehouseMapCanvas } from './warehouse-map-canvas'
import { MapFiltersBar, MapKpiHeader, MapLegend, DeadCapitalPanel } from './warehouse-map-panels'
import {
  availableMetrics,
  deadCapital,
  filtersActive,
  NO_FILTERS,
  selectLocations,
  summarizeLocations,
  type MapFilters,
  type MapTranslator,
} from './map-filtering'

export interface WarehouseMapProductOption {
  id: string
  name: string
  /** Quantity in THIS warehouse — what a placement may not exceed. */
  quantity: number
  category: string | null
}

export interface WarehouseMapViewProps {
  t: MapTranslator
  fmt: (value: number) => string
  formatDate: (value: string) => string
  /** Every warehouse this member may use, for the selector. */
  warehouses: Array<{ id: string; name: string }>
  warehouseId: string | null
  onPickWarehouse: (id: string) => void
  /** `null` until the first answer arrives. */
  map: WarehouseMap | null
  isLoading: boolean
  /** The read FAILED. Never rendered as «you have no data». */
  errorMessage: string | null
  onRetry: () => void
  /** The tables are not on this database yet — a state, not an empty map. */
  schemaRequired: boolean
  days: number
  onPickDays: (days: number) => void
  warehouseProducts: WarehouseMapProductOption[]
  canConfigure: boolean
  canPlace: boolean
  isPlacing: boolean
  placeError: string | null
  placedResult: { quantity: number; available: number } | null
  onPlace: (input: { locationId: string; productId: string; quantity: number }) => void
  layoutPending: boolean
  layoutError: string | null
  onCreateLocation: (values: LocationFormValues) => Promise<unknown>
  onUpdateLocation: (values: LocationFormValues & { id: string }) => Promise<unknown>
  onNavigate: ((route: string) => void) | undefined
}

const card =
  'rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4'

/**
 * ⚠️ ONE shared empty list, not `map?.locations ?? []`: a fresh array literal
 * on every render would make every `useMemo` that depends on it recompute for
 * no reason (and react-hooks says so out loud).
 */
const NO_LOCATIONS: MapLocation[] = []

export function WarehouseMapView({
  t,
  fmt,
  formatDate,
  warehouses,
  warehouseId,
  onPickWarehouse,
  map,
  isLoading,
  errorMessage,
  onRetry,
  schemaRequired,
  days,
  onPickDays,
  warehouseProducts,
  canConfigure,
  canPlace,
  isPlacing,
  placeError,
  placedResult,
  onPlace,
  layoutPending,
  layoutError,
  onCreateLocation,
  onUpdateLocation,
  onNavigate,
}: WarehouseMapViewProps) {
  const [metric, setMetric] = useState<MapMetric>('band')
  const [filters, setFilters] = useState<MapFilters>(NO_FILTERS)
  const [query, setQuery] = useState('')
  const [hideUnmatched, setHideUnmatched] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{ open: boolean; editingId: string | null }>({
    open: false,
    editingId: null,
  })

  const locations = map?.locations ?? NO_LOCATIONS
  const costVisible = map?.costVisible === true

  const categoryOf = useMemo(() => {
    const byProduct = new Map(warehouseProducts.map((product) => [product.id, product.category]))
    return (productId: string) => byProduct.get(productId) ?? null
  }, [warehouseProducts])

  const categories = useMemo(
    () =>
      [
        ...new Set(
          warehouseProducts.map((product) => product.category).filter((c): c is string => !!c),
        ),
      ].sort(),
    [warehouseProducts],
  )

  // The anchors a person can narrow the floor to: anything that HAS something
  // under it, plus every zone and aisle — an empty rack is still a place.
  const zones = useMemo(() => {
    const parents = new Set(locations.map((row) => row.parentId).filter((id): id is string => !!id))
    return locations
      .filter((row) => parents.has(row.id) || row.kind === 'zone' || row.kind === 'aisle')
      .map((row) => ({ id: row.id, label: `${row.path}${row.name ? ` — ${row.name}` : ''}` }))
  }, [locations])

  const selection = useMemo(
    () => selectLocations(locations, filters, query, hideUnmatched, categoryOf),
    [locations, filters, query, hideUnmatched, categoryOf],
  )

  const kpi = useMemo(
    () => summarizeLocations(selection.visible, costVisible),
    [selection.visible, costVisible],
  )

  const dead = useMemo(() => deadCapital(selection.visible, 5), [selection.visible])

  const showOnMap = useCallback((locationId: string) => {
    setFocusedId(locationId)
    setSelectedId(locationId)
  }, [])

  const onFocusHandled = useCallback(() => setFocusedId(null), [])

  const selected = locations.find((row) => row.id === selectedId) ?? null
  const narrowed = filtersActive(filters) || (hideUnmatched && query.trim() !== '')
  // ⚠️ The DEFINITION of «راکد» on screen is the server's window, not the one
  // that was asked for: the server clamps what it was given, and a legend that
  // printed the requested number could disagree with the colours it explains.
  const windowDays = map?.days ?? days

  const submitLayout = async (values: LocationFormValues) => {
    try {
      if (dialog.editingId) {
        await onUpdateLocation({ ...values, id: dialog.editingId })
      } else {
        await onCreateLocation(values)
      }
      setDialog({ open: false, editingId: null })
    } catch {
      // The message is on screen already — `layoutError`, from the server.
    }
  }

  if (warehouses.length === 0 && !isLoading) {
    return (
      <div className={card}>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('warehouseMap.noWarehouse')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
          {t('warehouseMap.title')}
        </h2>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          {t('warehouseMap.subtitle')}
          {map?.warehouse?.branchName
            ? ` · ${t('warehouseMap.branch', { branch: map.warehouse.branchName })}`
            : ''}
        </p>
      </header>

      <MapFiltersBar
        t={t}
        warehouses={warehouses}
        warehouseId={warehouseId}
        onPickWarehouse={onPickWarehouse}
        days={days}
        onPickDays={onPickDays}
        filters={filters}
        onFilters={setFilters}
        zones={zones}
        categories={categories}
        products={warehouseProducts.map((product) => ({ id: product.id, name: product.name }))}
        query={query}
        onQuery={setQuery}
        hideUnmatched={hideUnmatched}
        onHideUnmatched={setHideUnmatched}
        metric={metric}
        metrics={availableMetrics(costVisible)}
        onMetric={setMetric}
        canConfigure={canConfigure}
        onAddLocation={() => setDialog({ open: true, editingId: null })}
      />

      {schemaRequired ? (
        <p className={`${card} text-sm text-[hsl(var(--color-warning))]`}>
          {t('warehouseMap.schemaRequired')}
        </p>
      ) : errorMessage ? (
        <div className={`${card} space-y-2`}>
          <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full border border-[hsl(var(--border-default))] px-3 py-1 text-sm text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]"
          >
            {t('warehouseMap.retry')}
          </button>
        </div>
      ) : isLoading || !map ? (
        <div className="space-y-2">{warehouseSkeleton()}</div>
      ) : locations.length === 0 ? (
        <div className={`${card} space-y-2`}>
          <p className="text-sm text-[hsl(var(--fg-primary))]">{t('warehouseMap.noLocations')}</p>
          <p className="text-sm text-[hsl(var(--fg-secondary))]">
            {t('warehouseMap.noLocationsHint')}
          </p>
          {map.unplaced.quantity > 0 ? (
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">
              {t('warehouseMap.unplaced', {
                products: map.unplaced.productCount,
                quantity: map.unplaced.quantity,
              })}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <MapKpiHeader
            t={t}
            fmt={fmt}
            kpi={kpi}
            costVisible={costVisible}
            filtered={narrowed}
            days={windowDays}
            unplaced={map.unplaced}
            drift={map.drift}
          />

          {costVisible && kpi.productsWithoutCost > 0 ? (
            <p className="text-xs text-[hsl(var(--color-warning))]">
              {t('warehouseMap.withoutCost', { count: kpi.productsWithoutCost })}
            </p>
          ) : null}

          <MapLegend
            t={t}
            metric={metric}
            demandWindowDays={map.demandWindowDays}
            days={windowDays}
          />

          {query.trim() !== '' ? (
            <div className="space-y-1">
              <p className="text-xs text-[hsl(var(--fg-secondary))]">
                {selection.matched.size === 0
                  ? t('warehouseMap.search.none', { query })
                  : t('warehouseMap.search.count', {
                      count: selection.matched.size,
                      query,
                    })}
              </p>
              {selection.matched.size > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {locations
                    .filter((row) => selection.matched.has(row.id))
                    .slice(0, 8)
                    .map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => showOnMap(row.id)}
                          className="rounded-full border border-[hsl(var(--border-default))] px-2.5 py-0.5 text-xs text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
                        >
                          {row.code}
                        </button>
                      </li>
                    ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {selection.visible.length === 0 ? (
            <div className={card}>
              <p className="text-sm text-[hsl(var(--fg-secondary))]">
                {t('warehouseMap.noMatches')}
              </p>
            </div>
          ) : (
            <WarehouseMapCanvas
              t={t}
              fmt={fmt}
              locations={selection.visible}
              dimmed={
                selection.dimming
                  ? new Set(
                      locations.map((row) => row.id).filter((id) => !selection.matched.has(id)),
                    )
                  : EMPTY_DIM
              }
              selectedId={selectedId}
              focusId={focusedId}
              metric={metric}
              costVisible={costVisible}
              demandWindowDays={map.demandWindowDays}
              onSelect={(location) => {
                setSelectedId(location.id)
                setFocusedId(null)
              }}
              onFocusHandled={onFocusHandled}
            />
          )}

          {kpi.productCount === 0 ? (
            <p className="text-sm text-[hsl(var(--fg-secondary))]">
              {canPlace ? t('warehouseMap.nothingRecorded') : t('warehouseMap.nothingRecordedRead')}
            </p>
          ) : null}

          <DeadCapitalPanel
            t={t}
            fmt={fmt}
            rows={dead}
            costVisible={costVisible}
            days={windowDays}
            onShow={showOnMap}
          />
        </>
      )}

      <WarehouseLocationDrawer
        t={t}
        fmt={fmt}
        formatDate={formatDate}
        location={selected}
        costVisible={costVisible}
        demandWindowDays={map?.demandWindowDays ?? 30}
        warehouseProducts={warehouseProducts}
        canPlace={canPlace}
        canConfigure={canConfigure}
        isPlacing={isPlacing}
        placeError={placeError}
        placedResult={placedResult}
        onPlace={(input) => {
          if (selected) onPlace({ ...input, locationId: selected.id })
        }}
        onEdit={() => setDialog({ open: true, editingId: selected?.id ?? null })}
        onClose={() => setSelectedId(null)}
        onNavigate={onNavigate}
      />

      {canConfigure ? (
        <LocationDialog
          t={t}
          open={dialog.open}
          editing={locations.find((row) => row.id === dialog.editingId) ?? null}
          locations={locations}
          isPending={layoutPending}
          error={layoutError}
          onSubmit={submitLayout}
          onClose={() => setDialog({ open: false, editingId: null })}
        />
      ) : null}
    </div>
  )
}

/** One shared empty set: the dim mode is off, so nothing is dimmed. */
const EMPTY_DIM: ReadonlySet<string> = new Set<string>()
