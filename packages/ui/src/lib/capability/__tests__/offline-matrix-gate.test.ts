// The gate the screens use is the registry + the offline endpoint matrix. A
// screen never writes `if (offline)`; it asks `checkActionAvailability`.
import { describe, expect, it } from 'vitest'
import { checkActionAvailability, offlineKindOf } from '../use-action-availability'

const offline = { state: 'OFFLINE_ACTIVE', plan: 'OFFLINE', edition: 'local' } as const
const online = { state: 'ONLINE_ACTIVE', plan: 'ONLINE_500', edition: 'cloud' } as const

describe('availability follows the offline endpoint matrix', () => {
  it('available: a feature the engine runs works offline', () => {
    const result = checkActionAvailability('invoice.create', { inputOverride: offline })
    expect(result.available).toBe(true)
    expect(result.offline).toBe('available')
  })

  it('online_required: shown, refused with the offline reason', () => {
    const result = checkActionAvailability('invoice.print', { inputOverride: offline })
    expect(result.available).toBe(false)
    expect(result.requiresOnline).toBe(true)
    expect(result.offline).toBe('online_required')
    expect(result.reason).toBe('offline_edition')
  })

  it('not_supported: its own reason, so the notice can say so', () => {
    const result = checkActionAvailability('auth.cloud_session', { inputOverride: offline })
    expect(result.available).toBe(false)
    expect(result.reason).toBe('not_supported')
    expect(result.offline).toBe('not_supported')
  })

  it('the cloud edition is never limited by the matrix', () => {
    for (const feature of ['till.session', 'hr.payroll', 'invoice.installment'] as const) {
      expect(checkActionAvailability(feature, { inputOverride: online }).available).toBe(true)
    }
  })

  it('reads the kind of an offline refusal from the engine answer', () => {
    const refusal = (availability: string) => ({
      response: { status: 501, data: { code: 'OFFLINE_NOT_AVAILABLE', details: { availability } } },
    })
    expect(offlineKindOf(refusal('not_supported'))).toBe('not_supported')
    expect(offlineKindOf(refusal('online_required'))).toBe('online_required')
    expect(offlineKindOf(new Error('x'))).toBe('online_required')
  })
})
