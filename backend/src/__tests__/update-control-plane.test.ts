import { describe, expect, it } from 'vitest'
import { evaluateRolloutHealth, isDeviceInCohort } from '../../../packages/updater-core/src'

describe('Update Control Plane — Staged Rollout Simulation, Entitlements & Halt', () => {
  it('simulates staged rollout across 500 devices: exposure never exceeds ring percentage and auto-halts on spike', () => {
    const releaseId = 'rel-1.10.0-canary'
    const devices = Array.from({ length: 500 }, (_, i) => `dev-${i}`)
    const inCanary10 = devices.filter((d) =>
      isDeviceInCohort({ deviceId: d, releaseId, rolloutPercent: 10 }),
    )
    // Deterministic & bounded around ~10%
    expect(inCanary10.length).toBeGreaterThan(25)
    expect(inCanary10.length).toBeLessThan(85)

    // Monotonic expansion to 50%: every 10% device stays included
    const inExpanded50 = new Set(
      devices.filter((d) => isDeviceInCohort({ deviceId: d, releaseId, rolloutPercent: 50 })),
    )
    for (const d of inCanary10) {
      expect(inExpanded50.has(d)).toBe(true)
    }

    // Small sample (20) with 2 failures does NOT false-halt (< minSampleSize 50)
    const smallSample = evaluateRolloutHealth({
      sampleSize: 20,
      activationSuccessCount: 18,
      startupFailureCount: 2,
      rollbackCount: 0,
      signatureFailureCount: 0,
    })
    expect(smallSample.action).toBe('INSUFFICIENT_SAMPLE')

    // At sampleSize=60 with 5 startup failures (8.33% > 5%), auto-halt triggers
    const halt = evaluateRolloutHealth({
      sampleSize: 60,
      activationSuccessCount: 55,
      startupFailureCount: 5,
      rollbackCount: 0,
      signatureFailureCount: 0,
    })
    expect(halt.action).toBe('HALT_AND_ROLLBACK')
  })
})
