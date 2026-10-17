'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/map/warehouse-map-canvas.tsx
//
// The floor: one rectangle per location, drawn from the numbers in the
// database. Top-down, 2D, no perspective and no decoration — a person is meant
// to recognise their own building in it.
//
// ---------------------------------------------------------------------------
// WHY SVG AND NOT A DRAWING LIBRARY
//
// A warehouse of this size is 30–600 rectangles. SVG draws that without a WebGL
// context, keeps every rectangle a real focusable element (so a keyboard and a
// screen reader work), and prints as vectors. A canvas or Three.js floor would
// need hit-testing written by hand and would put the map out of reach of the
// accessibility tree — for a picture that is mostly empty space.
//
// ---------------------------------------------------------------------------
// ⚠️ THE MAP IS NOT MIRRORED FOR RTL
//
// The chrome around it (toolbar, legend, drawer) is RTL like the rest of the
// product and uses logical properties. The PLAN is a picture of a real
// building: mirroring it would put the door on the wrong side. `x` counts from
// the same corner in every language.
//
// ---------------------------------------------------------------------------
// ⚠️ NOTHING HERE COMPUTES STOCK
//
// Colour comes from `quantityClass` / `valueClass` / `band`, which the server
// computed (backend/src/services/inventory/warehouse-map.domain.ts). This file
// decides pixels and nothing else.
// ============================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MapLocation, MapMetric } from '@hisabche/api'

import { cn } from '../../../../lib/utils'
import { bandReason, type MapTranslator } from './map-filtering'

export interface WarehouseMapCanvasProps {
  t: MapTranslator
  fmt: (value: number) => string
  /** The rows to draw — already filtered, and in hide mode already searched. */
  locations: MapLocation[]
  /** Ids the search did not point at: drawn, but faint. */
  dimmed: ReadonlySet<string>
  selectedId: string | null
  /** A location to bring into view (a search hit, or the dead-capital panel). */
  focusId: string | null
  metric: MapMetric
  costVisible: boolean
  demandWindowDays: number
  onSelect: (location: MapLocation) => void
  onFocusHandled: () => void
}

/** Padding around the drawing, in grid cells. */
const PAD = 1
/** How far out and in a person may zoom. A view control, not a business rule. */
const MIN_ZOOM = 0.4
const MAX_ZOOM = 12
/** Label height in device pixels — text that stays readable at any zoom. */
const LABEL_PX = 11

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const INTENSITY = [0.08, 0.3, 0.55, 0.85]

/**
 * The colour of one rectangle.
 *
 * `band` is the default because it is the question people actually ask («کدام
 * قسمت انبار خوابیده؟»). Quantity and value are RELATIVE to the fullest
 * location of this warehouse, and the legend says so in words: an absolute
 * threshold invented here would colour a greengrocer's floor by a machine-parts
 * dealer's scale.
 */
export function fillOf(location: MapLocation, metric: MapMetric): string {
  if (metric === 'band') {
    if (location.band === 'empty') return 'hsl(var(--surface-muted))'
    if (location.band === 'moving') return 'hsl(var(--color-success) / 0.7)'
    if (location.band === 'slow') return 'hsl(var(--color-warning) / 0.7)'
    return 'hsl(var(--color-destructive) / 0.7)'
  }
  const step = metric === 'quantity' ? location.quantityClass : (location.valueClass ?? 0)
  const token = metric === 'quantity' ? '--color-info' : '--color-primary'
  return `hsl(var(${token}) / ${INTENSITY[step] ?? INTENSITY[0]})`
}

export function WarehouseMapCanvas({
  t,
  fmt,
  locations,
  dimmed,
  selectedId,
  focusId,
  metric,
  costVisible,
  demandWindowDays,
  onSelect,
  onFocusHandled,
}: WarehouseMapCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  /** Where the drawing sits inside its viewBox: translation in grid cells, then scale. */
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const [hover, setHover] = useState<{ id: string; left: number; top: number } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number } | null>(null)
  const drag = useRef<{ id: number; startX: number; startY: number; captured: boolean } | null>(
    null,
  )

  /**
   * The drawing's own box, in grid cells.
   *
   * ⚠️ `null` is a real answer: a warehouse with no locations has nothing to
   * draw, and dividing by a zero-sized box would throw here instead of letting
   * the caller show its «no locations yet» screen.
   */
  const base = useMemo(() => {
    if (locations.length === 0) return null
    const minX = Math.min(...locations.map((row) => row.x))
    const minY = Math.min(...locations.map((row) => row.y))
    const maxX = Math.max(...locations.map((row) => row.x + Math.max(row.width, 0)))
    const maxY = Math.max(...locations.map((row) => row.y + Math.max(row.height, 0)))
    return {
      x: minX - PAD,
      y: minY - PAD,
      width: Math.max(maxX - minX, 1) + PAD * 2,
      height: Math.max(maxY - minY, 1) + PAD * 2,
    }
  }, [locations])

  // How big the box is on screen: a rectangle has to be able to ask «is there
  // room for my label», and a pointer position has to become a grid cell.
  useEffect(() => {
    const element = svgRef.current
    if (!element) return
    const measure = () => setBox({ width: element.clientWidth, height: element.clientHeight })
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  /** Device pixels per grid cell, and the letterbox offsets of the viewBox. */
  const projection = useMemo(() => {
    if (!base || box.width === 0 || box.height === 0) return null
    const scale = Math.min(box.width / base.width, box.height / base.height)
    return {
      scale,
      offsetX: (box.width - base.width * scale) / 2,
      offsetY: (box.height - base.height * scale) / 2,
    }
  }, [base, box])

  /** A pointer position (client px) as a point inside the viewBox. */
  const toUser = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const element = svgRef.current
      if (!element || !projection) return null
      const rect = element.getBoundingClientRect()
      return {
        x: (clientX - rect.left - projection.offsetX) / projection.scale,
        y: (clientY - rect.top - projection.offsetY) / projection.scale,
      }
    },
    [projection],
  )

  /**
   * Zoom, keeping one point of the drawing under the pointer.
   *
   * The point is read BEFORE the scale changes and the translation is solved
   * from it: `g' = p − k'·c`, where `c` is that point in the drawing's own
   * coordinates. Solved the other way round, the map runs away from the cursor.
   */
  const zoomAt = useCallback(
    (factor: number, at?: { x: number; y: number }) => {
      setView((current) => {
        const k = clamp(current.k * factor, MIN_ZOOM, MAX_ZOOM)
        if (k === current.k || !base) return current
        const anchor = at ?? { x: base.width / 2, y: base.height / 2 }
        const c = { x: (anchor.x - current.x) / current.k, y: (anchor.y - current.y) / current.k }
        return { k, x: anchor.x - k * c.x, y: anchor.y - k * c.y }
      })
    },
    [base],
  )

  // Wheel zoom, registered by hand: React's own `onWheel` is passive, so a
  // handler there cannot stop the page from scrolling while a person zooms.
  useEffect(() => {
    const element = svgRef.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      const at = toUser(event.clientX, event.clientY)
      if (!at) return
      event.preventDefault()
      zoomAt(event.deltaY < 0 ? 1.15 : 1 / 1.15, at)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [toUser, zoomAt])

  // A location asked for from outside (a search hit, the dead-capital panel):
  // bring it into the middle of the picture, big enough to be seen.
  useEffect(() => {
    if (!focusId || !base) return
    const target = locations.find((row) => row.id === focusId)
    if (!target) return
    const x = target.x - base.x
    const y = target.y - base.y
    const width = Math.max(target.width, 1)
    const height = Math.max(target.height, 1)
    const k = clamp(Math.min(base.width / (width * 3), base.height / (height * 3)), 1.6, MAX_ZOOM)
    setView({
      k,
      x: base.width / 2 - k * (x + width / 2),
      y: base.height / 2 - k * (y + height / 2),
    })
    onFocusHandled()
  }, [focusId, base, locations, onFocusHandled])

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    drag.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      captured: false,
    }
  }

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (!projection) return

    const all = [...pointers.current.values()]
    if (all.length >= 2) {
      // Pinch: the distance between two fingers IS the scale.
      const [a, b] = all
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y)
      const at = toUser((a!.x + b!.x) / 2, (a!.y + b!.y) / 2)
      if (pinch.current && at && pinch.current.distance > 0) {
        zoomAt(distance / pinch.current.distance, at)
      }
      pinch.current = { distance }
      return
    }

    if (pinch.current) {
      pinch.current = null
      return
    }

    if (event.pointerType !== 'mouse' || event.buttons === 0) return

    // ⚠️ CAPTURE ONLY ONCE A DRAG IS REAL. Capturing the pointer on
    // `pointerdown` moves the following `click` to the <svg> — and a person who
    // taps a shelf would select nothing at all.
    const current = drag.current
    if (current && current.id === event.pointerId && !current.captured) {
      const travelled = Math.hypot(event.clientX - current.startX, event.clientY - current.startY)
      if (travelled <= 3) return
      current.captured = true
      svgRef.current?.setPointerCapture?.(event.pointerId)
    }

    setView((state) => ({
      ...state,
      x: state.x + (event.clientX - previous.x) / projection.scale,
      y: state.y + (event.clientY - previous.y) / projection.scale,
    }))
  }

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }

  if (!base) return null

  const hovered = hover ? locations.find((row) => row.id === hover.id) : undefined
  const zoom = (projection?.scale ?? 0) * view.k

  return (
    <div className="relative">
      {/* Buttons, not gestures only: a keyboard and a phone without pinch both
          have to be able to do this. */}
      <div className="absolute end-2 top-2 z-10 flex flex-col gap-1">
        {[
          { key: 'warehouseMap.zoomIn', sign: '+', factor: 1.3 },
          { key: 'warehouseMap.zoomOut', sign: '−', factor: 1 / 1.3 },
        ].map((button) => (
          <button
            key={button.key}
            type="button"
            aria-label={t(button.key)}
            title={t(button.key)}
            onClick={() => zoomAt(button.factor)}
            className="size-8 rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] text-sm text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
          >
            <span aria-hidden="true">{button.sign}</span>
          </button>
        ))}
        <button
          type="button"
          aria-label={t('warehouseMap.zoomFit')}
          title={t('warehouseMap.zoomFit')}
          onClick={() => setView({ x: 0, y: 0, k: 1 })}
          className="size-8 rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] text-[10px] text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
        >
          <span aria-hidden="true">⤢</span>
          <span className="sr-only">{t('warehouseMap.zoomFit')}</span>
        </button>
      </div>

      <svg
        ref={svgRef}
        role="group"
        aria-label={t('warehouseMap.canvasLabel')}
        viewBox={`0 0 ${base.width} ${base.height}`}
        preserveAspectRatio="xMidYMid meet"
        // ⚠️ `pan-y`, not `none`: a finger travelling down the page must keep
        // scrolling the page, even when it starts on the map. Horizontal drags
        // pan the floor, and a pinch still reaches this file.
        className="h-[52vh] min-h-[320px] w-full touch-pan-y rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] sm:h-[62vh]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {locations.map((location) => {
            const x = location.x - base.x
            const y = location.y - base.y
            const width = Math.max(location.width, 0)
            const height = Math.max(location.height, 0)
            const isSelected = location.id === selectedId
            const isFocused = location.id === focusId
            const isHovered = hover?.id === location.id
            const reason = bandReason(location, demandWindowDays)
            const bandText = t(`warehouseMap.band.${location.band}`)
            const reasonText = t(`warehouseMap.reason.${reason.key}`, reason.values)
            const label = t('warehouseMap.aria.location', {
              code: location.code,
              name: location.name ?? '',
              products: location.productCount,
              quantity: location.quantity,
              status: bandText,
              reason: reasonText,
            })

            // A label is drawn only when it fits the rectangle at the scale on
            // screen; otherwise it is a smear of overlapping codes.
            const fontSize = zoom > 0 ? LABEL_PX / zoom : 0
            const fits =
              zoom > 0 &&
              height * zoom >= LABEL_PX * 1.8 &&
              width * zoom >= location.code.length * LABEL_PX * 0.62 + 6

            return (
              <g
                key={location.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={label}
                className="group cursor-pointer focus-visible:outline-none"
                transform={`translate(${x} ${y})`}
                opacity={dimmed.has(location.id) ? 0.2 : 1}
                onClick={() => onSelect(location)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(location)
                  }
                }}
                onPointerEnter={(event) => {
                  const width = typeof window === 'undefined' ? 0 : window.innerWidth
                  setHover({
                    id: location.id,
                    left: clamp(event.clientX + 12, 8, Math.max(width - 232, 8)),
                    top: event.clientY + 12,
                  })
                }}
                onPointerLeave={() => setHover(null)}
              >
                <title>{`${location.code} — ${bandText}: ${reasonText}`}</title>
                <rect
                  width={width}
                  height={height}
                  rx={0.1}
                  vectorEffect="non-scaling-stroke"
                  style={{
                    fill: fillOf(location, metric),
                    stroke: location.isActive
                      ? 'hsl(var(--border-strong))'
                      : 'hsl(var(--color-warning))',
                    strokeDasharray: location.isActive ? undefined : '4 3',
                  }}
                  strokeWidth={isSelected || isFocused || isHovered ? 3 : 1}
                  className={cn(
                    'transition-opacity motion-reduce:transition-none',
                    'group-focus-visible:[stroke-width:3]',
                    'group-focus-visible:stroke-[hsl(var(--color-primary))]',
                    isSelected && 'stroke-[hsl(var(--color-primary))]',
                  )}
                />
                {fits ? (
                  <text
                    x={width / 2}
                    y={height / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={fontSize}
                    className="pointer-events-none fill-[hsl(var(--fg-primary))] font-medium"
                  >
                    {location.code}
                  </text>
                ) : null}
              </g>
            )
          })}
        </g>
      </svg>

      {/* Hover: the same facts the drawer shows, on a desktop with a pointer. A
          touch screen never fires this — which is why nothing lives ONLY here. */}
      {hovered && hover ? (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-40 w-56 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-2.5 text-xs shadow-lg"
          style={{ left: hover.left, top: hover.top }}
        >
          <p className="font-semibold text-[hsl(var(--fg-primary))]">
            {hovered.code}
            {hovered.name ? <span className="font-normal"> — {hovered.name}</span> : null}
          </p>
          <p className="mt-0.5 text-[hsl(var(--fg-tertiary))]">{hovered.path}</p>
          <dl className="mt-1.5 space-y-0.5 text-[hsl(var(--fg-secondary))]">
            <div className="flex justify-between gap-2">
              <dt>{t('warehouseMap.kpi.products')}</dt>
              <dd className="tabular-nums">{hovered.productCount}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>{t('warehouseMap.kpi.quantity')}</dt>
              <dd className="tabular-nums">{hovered.quantity}</dd>
            </div>
            {hovered.value === null ? null : (
              <div className="flex justify-between gap-2">
                <dt>{t('warehouseMap.kpi.value')}</dt>
                <dd className="tabular-nums">{fmt(hovered.value)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt>{t('warehouseMap.kpi.status')}</dt>
              <dd className="text-end">
                {t(`warehouseMap.band.${hovered.band}`)}
                <span className="block text-[hsl(var(--fg-tertiary))]">
                  {t(
                    `warehouseMap.reason.${bandReason(hovered, demandWindowDays).key}`,
                    bandReason(hovered, demandWindowDays).values,
                  )}
                </span>
              </dd>
            </div>
          </dl>
          {costVisible ? null : (
            <p className="mt-1 text-[hsl(var(--fg-tertiary))]">{t('warehouseMap.costHidden')}</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
