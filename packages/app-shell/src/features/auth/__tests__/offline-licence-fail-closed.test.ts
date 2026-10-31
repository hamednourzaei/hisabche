// ============================================
// GAP-NEW-003: an unreadable secure store is not «no problem».
//
// The licence check used to turn a failed read into «nothing stored». For the
// high-water mark that means «the clock was never seen to move», so the
// clock-rollback guard switched itself off exactly when the store broke. A
// failed read must now be its own, visible answer.
// ============================================

let secureGet: (key: string) => Promise<string | null> = async () => null

jest.mock('@/shared/lib/bridge', () => ({
  bridge: () => ({ secure: { get: (key: string) => secureGet(key), set: async () => undefined } }),
}))

jest.mock('@/shared/lib/api', () => ({
  API_BASE_URL: 'https://api.test/api',
  OFFLINE_LICENSE_PUBLIC_KEY: '',
}))

import { checkStoredLicence } from '../offline-license'

describe('offline licence check fails closed', () => {
  it('answers STORE_ERROR when the secure store cannot be read', async () => {
    secureGet = async () => {
      throw new Error('keychain locked')
    }

    await expect(checkStoredLicence()).resolves.toEqual({ ok: false, reason: 'STORE_ERROR' })
  })

  it('still answers MISSING (not an error) when the store is fine and holds no licence', async () => {
    secureGet = async () => null

    await expect(checkStoredLicence()).resolves.toEqual({ ok: false, reason: 'MISSING' })
  })
})
