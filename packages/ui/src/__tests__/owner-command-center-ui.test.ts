import { describe, it, expect } from 'vitest'
import {
  COMMAND_CENTER_ALERTS,
  resolveCommandCenterAlerts,
} from '../components/ui/dashboard/DashboardRegistry'

describe('V60 Slice 12 — Owner Command Center UI gating', () => {
  it('hides every alert whose capability status is not available', () => {
    // None of the 8 backing capabilities are 'available' in CAPABILITIES yet (partial/planned),
    // so with no overrides all 8 are hidden rather than shown prematurely.
    const defaultResolved = resolveCommandCenterAlerts({
      can: () => true,
      hiddenFigureGroups: [],
      blockedModules: [],
    })
    expect(defaultResolved).toEqual([])

    // When all capabilities are explicitly available, all 8 render with decision deep-links
    const allAvailable = Object.fromEntries(
      COMMAND_CENTER_ALERTS.map((a) => [a.capability, 'available' as const]),
    )
    const full = resolveCommandCenterAlerts({
      can: () => true,
      hiddenFigureGroups: [],
      blockedModules: [],
      statusOverrides: allAvailable,
    })
    expect(full).toHaveLength(COMMAND_CENTER_ALERTS.length)
  })

  it('hides money alerts in UI when role lacks permission or server masked the figureGroup', () => {
    const allAvailable = Object.fromEntries(
      COMMAND_CENTER_ALERTS.map((a) => [a.capability, 'available' as const]),
    )

    const restricted = resolveCommandCenterAlerts({
      can: (perm) => perm === 'inventory.read',
      hiddenFigureGroups: ['sales', 'customers'],
      blockedModules: [],
      statusOverrides: allAvailable,
    })

    const ids = restricted.map((a) => a.id)
    expect(ids).toEqual(['stock_out_risk', 'open_quality_failures'])
    expect(ids).not.toContain('cash_forecast')
    expect(ids).not.toContain('late_payers')
    expect(ids).not.toContain('projects_over_budget')
    expect(ids).not.toContain('contracts_due')
  })
})
