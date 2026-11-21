// TrendChart rendered: the shared recharts wrapper exposes an accessible
// image role, injects the series colors as CSS variables, and keeps null
// samples as gaps (connectNulls=false is the contract, asserted at the source
// level because jsdom gives ResponsiveContainer a zero size).
import { cleanup, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { TrendChartInternal } from '../components/ui/trend-chart-internal'

// jsdom has no ResizeObserver; recharts' ResponsiveContainer needs one.
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const data = [
  { bucket: '2026-11-21T10:00:00Z', operations: 10, errors: 1 },
  { bucket: '2026-11-21T10:01:00Z', operations: null, errors: null },
  { bucket: '2026-11-21T10:02:00Z', operations: 12, errors: 0 },
]

describe('TrendChart', () => {
  it('renders an accessible chart container with the series colors', () => {
    render(
      <TrendChartInternal
        data={data}
        xKey="bucket"
        height={200}
        ariaLabel="روند عملیات"
        series={[
          { key: 'operations', label: 'عملیات', color: 'hsl(var(--color-primary))', kind: 'area' },
          { key: 'errors', label: 'خطا', color: 'hsl(var(--color-destructive))', kind: 'line' },
        ]}
      />,
    )
    const image = screen.getByRole('img', { name: 'روند عملیات' })
    expect(image).toBeTruthy()
    expect(image.getAttribute('dir')).toBe('ltr')
    // ChartStyle injects one CSS variable per series inside the container.
    const style = image.querySelector('style')
    expect(style?.textContent).toContain('--color-operations')
    expect(style?.textContent).toContain('--color-errors')
  })

  it('keeps gaps as gaps — connectNulls is false for every series', () => {
    const source = readFileSync(
      join(__dirname, '../components/ui/trend-chart-internal.tsx'),
      'utf-8',
    )
    const occurrences = source.match(/connectNulls=\{false\}/g) ?? []
    expect(occurrences.length).toBe(2) // Area + Line
    expect(source).not.toContain('connectNulls={true}')
  })
})
