// ============================================
// packages/ui/src/__tests__/warehouse-map-canvas.test.tsx
//
// The floor itself: can a person select a shelf with a mouse AND with a
// keyboard, does a dimmed shelf actually look dimmed, and does a retired one
// say so in more than colour.
//
// ⚠️ WHAT THIS CANNOT PROVE, STATED PLAINLY: jsdom lays nothing out, so
// `clientWidth` is 0 and the zoom/pan arithmetic and the labels are not
// exercised here. Geometry is checked by the projection maths and by the
// browser pass recorded in the implementation note; this file is about the
// contract a person interacts with — a focusable rectangle that selects, a
// tooltip that carries numbers, and a colour that never stands alone.
// ============================================

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HeatBand, MapLocation } from '@hisabche/api'

import { fillOf, WarehouseMapCanvas } from '../components/ui/warehouse/map/warehouse-map-canvas'
import type { MapTranslator } from '../components/ui/warehouse/map/map-filtering'

// ⚠️ Registered by hand. testing-library only cleans up after itself when
// `globals` is on, and this package runs with `globals: false` — without this
// every `render()` in the file stacks on top of the last one and `getByRole`
// finds the same shelf four times.
afterEach(cleanup)

/**
 * A translator that shows WHAT WAS PASSED.
 *
 * ⚠️ Returning the bare key — as several older tests do — would prove that a
 * label exists, not that it carries the shelf's quantity. Here a missing value
 * shows up as `quantity=undefined` in the assertion below.
 */
const t: MapTranslator = (key, values) =>
  values
    ? `${key}(${Object.entries(values)
        .map(([name, value]) => `${name}=${value}`)
        .join(',')})`
    : key

const fmt = (value: number) => `مبلغ ${value}`

function location(input: {
  id: string
  code: string
  band: HeatBand
  quantity: number
  productCount: number
  value?: number | null
  isActive?: boolean
  neverSold?: boolean
  daysSinceSale?: number | null
}): MapLocation {
  return {
    id: input.id,
    code: input.code,
    name: null,
    kind: 'shelf',
    parentId: null,
    depth: 0,
    path: input.code,
    x: 0,
    y: 0,
    width: 4,
    height: 2,
    capacity: null,
    isActive: input.isActive ?? true,
    products: [],
    productCount: input.productCount,
    quantity: input.quantity,
    value: input.value ?? null,
    productsWithoutCost: 0,
    lastSoldAt: null,
    daysSinceSale: input.daysSinceSale ?? null,
    neverSold: input.neverSold ?? false,
    band: input.band,
    stagnantProductCount: 0,
    stagnantQuantity: 0,
    stagnantValue: null,
    quantityClass: 0,
    valueClass: null,
    capacityUsed: null,
  }
}

const MOVING = location({
  id: 's1',
  code: 'S01',
  band: 'moving',
  quantity: 10,
  productCount: 1,
  value: 50000,
  daysSinceSale: 5,
})
const DEAD = location({
  id: 's2',
  code: 'S02',
  band: 'stagnant',
  quantity: 12,
  productCount: 1,
  neverSold: true,
})
const RETIRED = location({
  id: 'a09',
  code: 'A09',
  band: 'empty',
  quantity: 0,
  productCount: 0,
  isActive: false,
})

const draw = (props: Partial<React.ComponentProps<typeof WarehouseMapCanvas>> = {}) => {
  const onSelect = vi.fn()
  const onFocusHandled = vi.fn()
  const view = render(
    <WarehouseMapCanvas
      t={t}
      fmt={fmt}
      locations={[MOVING, DEAD, RETIRED]}
      dimmed={new Set<string>()}
      selectedId={null}
      focusId={null}
      metric="band"
      costVisible
      demandWindowDays={30}
      onSelect={onSelect}
      onFocusHandled={onFocusHandled}
      {...props}
    />,
  )
  return { onSelect, onFocusHandled, view }
}

describe('the floor', () => {
  it('draws one focusable rectangle per location, named with its numbers', () => {
    draw()
    // Z01 and R01 are not in this fixture: three locations, three buttons.
    const buttons = screen.getAllByRole('button', { name: /warehouseMap\.aria\.location/ })
    // The zoom controls are buttons too — three of them.
    expect(screen.getByRole('group')).toBeTruthy()
    expect(buttons).toHaveLength(3)

    const dead = screen.getByRole('button', {
      name: /code=S02.*quantity=12.*status=warehouseMap\.band\.stagnant.*reason=warehouseMap\.reason\.neverSold/,
    })
    // «بدون فروش ثبتشده» — the reason, not just the colour.
    expect(dead.getAttribute('aria-label')).toContain('products=1')
    expect(dead.getAttribute('aria-pressed')).toBe('false')
  })

  it('selects on click and on Enter and on Space', () => {
    const { onSelect } = draw()
    const moving = screen.getByRole('button', { name: /code=S01/ })

    fireEvent.click(moving)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0]![0]).toMatchObject({ id: 's1' })

    fireEvent.keyDown(moving, { key: 'Enter' })
    fireEvent.keyDown(moving, { key: ' ' })
    expect(onSelect).toHaveBeenCalledTimes(3)
    // A key that means something else must not select.
    fireEvent.keyDown(moving, { key: 'Tab' })
    expect(onSelect).toHaveBeenCalledTimes(3)
  })

  it('marks the selected rectangle for a screen reader, not only for the eye', () => {
    draw({ selectedId: 's2' })
    expect(screen.getByRole('button', { name: /code=S02/ }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByRole('button', { name: /code=S01/ }).getAttribute('aria-pressed')).toBe(
      'false',
    )
  })

  it('draws what the search missed faint, and never removes it from the tree', () => {
    draw({ dimmed: new Set(['s1']) })
    expect(screen.getByRole('button', { name: /code=S01/ }).getAttribute('opacity')).toBe('0.2')
    expect(screen.getByRole('button', { name: /code=S02/ }).getAttribute('opacity')).toBe('1')
  })

  it('points a requested location out to the caller once it has taken it into view', () => {
    const { onFocusHandled } = draw({ focusId: 's2' })
    // The view clears its own `focusId` — otherwise every later render would
    // snap the floor back to the shelf that was searched for once.
    expect(onFocusHandled).toHaveBeenCalled()
  })

  it('offers zoom to a keyboard and to a phone without a pinch', () => {
    draw()
    expect(screen.getByLabelText('warehouseMap.zoomIn')).toBeTruthy()
    expect(screen.getByLabelText('warehouseMap.zoomOut')).toBeTruthy()
    expect(screen.getByLabelText('warehouseMap.zoomFit')).toBeTruthy()
  })

  it('draws nothing at all for a warehouse with no locations', () => {
    const { view } = draw({ locations: [] })
    expect(view.container.firstChild).toBeNull()
  })
})

describe('the colour of a rectangle', () => {
  it('uses the semantic tokens, and says what every band means', () => {
    expect(fillOf(MOVING, 'band')).toBe('hsl(var(--color-success) / 0.7)')
    expect(fillOf(DEAD, 'band')).toBe('hsl(var(--color-destructive) / 0.7)')
    expect(
      fillOf(location({ id: 'w', code: 'W1', band: 'slow', quantity: 1, productCount: 1 }), 'band'),
    ).toBe('hsl(var(--color-warning) / 0.7)')
    expect(fillOf(RETIRED, 'band')).toBe('hsl(var(--surface-muted))')
  })

  it('steps quantity and value by the class the server computed', () => {
    const full = { ...MOVING, quantityClass: 3, valueClass: 0 }
    expect(fillOf(full, 'quantity')).toBe('hsl(var(--color-info) / 0.85)')
    expect(fillOf(full, 'value')).toBe('hsl(var(--color-primary) / 0.08)')
  })

  it('falls back to the lightest step when the reader may not see value', () => {
    // `valueClass` is null without cost permission; the fill must not become
    // `undefined` and drop the rectangle out of the picture.
    expect(fillOf({ ...MOVING, valueClass: null }, 'value')).toBe(
      'hsl(var(--color-primary) / 0.08)',
    )
  })
})
