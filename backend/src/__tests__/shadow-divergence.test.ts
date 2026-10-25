import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CoreDivergenceService,
  type CoreDivergenceRecord,
} from '../services/core-divergence.service'
import type { TenancyContext } from '../services/tenancy.service'

describe('Core Divergence & Shadow Mode Diagnostic Harness', () => {
  const mockContext: TenancyContext = {
    workspaceId: '11111111-1111-1111-1111-111111111111',
    userId: '22222222-2222-2222-2222-222222222222',
    role: 'owner',
  }

  let recorded: CoreDivergenceRecord[] = []

  beforeEach(() => {
    recorded = []
    vi.spyOn(CoreDivergenceService, 'recordDivergence').mockImplementation(async (rec) => {
      recorded.push(rec)
    })
    CoreDivergenceService.setShadowMode(false)
    CoreDivergenceService.setKillSwitch('invoice-math', false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('executes core logic directly when authority is LOCAL_CORE', async () => {
    const legacyFn = vi.fn().mockReturnValue({ totalMinor: 5000 })
    const coreFn = vi.fn().mockReturnValue({ totalMinor: 5000 })

    const res = await CoreDivergenceService.executeWithShadow(
      mockContext,
      'invoice-math',
      'POST /api/invoices',
      { lines: [1, 2] },
      legacyFn,
      coreFn,
    )

    expect(res).toEqual({ totalMinor: 5000 })
    expect(coreFn).toHaveBeenCalledTimes(1)
    expect(legacyFn).not.toHaveBeenCalled()
    expect(recorded.length).toBe(0)
  })

  it('reverts immediately to SERVER_LEGACY when kill switch is activated', async () => {
    CoreDivergenceService.setKillSwitch('invoice-math', true)

    const legacyFn = vi.fn().mockReturnValue({ totalMinor: 4999 })
    const coreFn = vi.fn().mockReturnValue({ totalMinor: 5000 })

    const res = await CoreDivergenceService.executeWithShadow(
      mockContext,
      'invoice-math',
      'POST /api/invoices',
      { lines: [1, 2] },
      legacyFn,
      coreFn,
    )

    expect(res).toEqual({ totalMinor: 4999 })
    expect(legacyFn).toHaveBeenCalledTimes(1)
    expect(coreFn).not.toHaveBeenCalled()
    expect(recorded.length).toBe(0)
  })

  it('detects divergence in shadow mode and records discrepancy without breaking user request', async () => {
    CoreDivergenceService.setShadowMode(true)

    // Intentionally divergent outputs
    const legacyFn = vi.fn().mockReturnValue({ totalMinor: 5000, roundingDiff: 0 })
    const divergentCoreFn = vi.fn().mockReturnValue({ totalMinor: 5001, roundingDiff: 1 })

    const input = { items: ['A', 'B'], discount: 10 }
    const res = await CoreDivergenceService.executeWithShadow(
      mockContext,
      'invoice-math',
      'POST /api/invoices',
      input,
      legacyFn,
      divergentCoreFn,
    )

    // Returns legacy result to caller in shadow mode
    expect(res).toEqual({ totalMinor: 5000, roundingDiff: 0 })
    expect(legacyFn).toHaveBeenCalledTimes(1)
    expect(divergentCoreFn).toHaveBeenCalledTimes(1)

    // Divergence was caught and recorded
    expect(recorded.length).toBe(1)
    const record = recorded[0]!
    expect(record.workspaceId).toBe(mockContext.workspaceId)
    expect(record.capability).toBe('invoice-math')
    expect(record.command).toBe('POST /api/invoices')
    expect(record.expectedOutput).toEqual({ totalMinor: 5000, roundingDiff: 0 })
    expect(record.actualOutput).toEqual({ totalMinor: 5001, roundingDiff: 1 })
    expect(record.diffSummary).toContain('DIVERGENCE')
  })

  it('records zero divergence when core and legacy produce identical results in shadow mode', async () => {
    CoreDivergenceService.setShadowMode(true)

    const legacyFn = vi.fn().mockReturnValue({ totalMinor: 7500, lines: 3 })
    const identicalCoreFn = vi.fn().mockReturnValue({ totalMinor: 7500, lines: 3 })

    const res = await CoreDivergenceService.executeWithShadow(
      mockContext,
      'invoice-math',
      'POST /api/invoices',
      { lines: 3 },
      legacyFn,
      identicalCoreFn,
    )

    expect(res).toEqual({ totalMinor: 7500, lines: 3 })
    expect(recorded.length).toBe(0)
  })
})
