import { describe, it, expect } from 'vitest'
import {
  forecastCash,
  averagePaymentDelay,
  MIN_FORECAST_HISTORY_SAMPLES,
} from '../services/intelligence/forecast.domain'
import { filterCommandAlertsByVisibility } from '../services/analytics/dashboard-visibility.domain'

describe('V60 Slice 12 — Owner Command Center forecast honesty & server visibility', () => {
  it('returns insufficient_data and projectedCashMinor: null when settled history is too small (never 0)', () => {
    const delay = averagePaymentDelay([
      { dueDate: '2026-01-01', settledAt: '2026-01-05' },
      { dueDate: '2026-01-02', settledAt: '2026-01-04' },
    ])
    expect(delay.sampleSize).toBeLessThan(MIN_FORECAST_HISTORY_SAMPLES)

    const forecast = forecastCash({
      asOf: new Date('2026-02-01'),
      openingCashMinor: 50_000,
      receivables: [{ invoiceId: 'inv-1', outstandingMinor: 25_000, dueDate: '2026-02-05' }],
      delay,
    })

    expect(forecast.status).toBe('insufficient_data')
    for (const w of forecast.windows) {
      expect(w.status).toBe('insufficient_data')
      expect(w.projectedCashMinor).toBeNull()
    }
  })

  it('returns insufficient_data when history basis is none even if opening cash is positive', () => {
    const delay = averagePaymentDelay([])
    const forecast = forecastCash({
      asOf: new Date('2026-02-01'),
      openingCashMinor: 10_000,
      receivables: [],
      delay,
    })
    expect(forecast.status).toBe('insufficient_data')
    expect(forecast.windows[0]?.projectedCashMinor).toBeNull()
  })

  it('hides money alerts from roles without matching capability on the server', () => {
    const alerts = [
      {
        id: 'cash_forecast',
        requiredPermission: 'report.financial.read' as const,
        figureGroup: 'sales' as const,
        amountMinor: 120_000,
      },
      {
        id: 'stock_out_risk',
        requiredPermission: 'inventory.read' as const,
        figureGroup: 'stock' as const,
        amountMinor: null,
      },
    ]

    // Storekeeper holds inventory.read but lacks report.financial.read & invoice.read
    const res = filterCommandAlertsByVisibility(alerts, (cap) => cap === 'inventory.read')
    expect(res.visible.map((a) => a.id)).toEqual(['stock_out_risk'])
    expect(res.hiddenAlertIds).toEqual(['cash_forecast'])
  })
})
