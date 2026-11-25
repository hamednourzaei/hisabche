import { describe, expect, it } from 'vitest'
import { useDeviceStore } from '../device.slice'

describe('G91 — Shared Device PIN Lock', () => {
  it('stores hashed PIN (never plaintext), locks, rejects wrong PIN, and unlocks with right PIN', () => {
    const store = useDeviceStore.getState()
    store.clearPin()
    store.configurePin('4829')

    const afterSet = useDeviceStore.getState()
    expect(afterSet.pinHash).not.toBe('4829')
    expect(afterSet.pinHash).toMatch(/^pin:[0-9a-f]+$/)

    afterSet.lockDevice()
    expect(useDeviceStore.getState().pinLocked).toBe(true)

    expect(useDeviceStore.getState().unlockWithPin('0000')).toBe(false)
    expect(useDeviceStore.getState().pinLocked).toBe(true)

    expect(useDeviceStore.getState().unlockWithPin('4829')).toBe(true)
    expect(useDeviceStore.getState().pinLocked).toBe(false)
  })
})
