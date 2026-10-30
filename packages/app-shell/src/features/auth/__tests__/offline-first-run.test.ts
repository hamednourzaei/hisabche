// ============================================
// The local first run — a fresh install, a restart, and a failure.
//
// ⚠️ WHAT IS BEING PROVED.
//
// Three facts a person can check on the device:
//
//   1. A FRESH INSTALL asks for the business and makes it. The name and the
//      books currency are the person's answers; the engine is told them.
//   2. A RESTART finds that business again and opens it — the second launch
//      does not ask anything.
//   3. A FAILURE SAYS SO. The engine's own refusal is shown; nothing is
//      swallowed and nothing is reported as success.
//
// The session is built in ONE place (`buildOfflineSession`), so the first run
// and the restart cannot disagree about who the owner is.
// ============================================

import { useAuthStore } from '../auth.store'
import { buildOfflineSession, localUserDisplayName } from '../offline-session'
import {
  createLocalWorkspace,
  lookupLocalWorkspace,
  offlineFailureMessage,
} from '../offline-first-run'

const get = jest.fn()
const post = jest.fn()

jest.mock('@/shared/lib/api', () => ({
  apiClient: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
}))

const WORKSPACE = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'دوکان مرکزی',
  ownerId: '22222222-2222-4222-8222-222222222222',
}

beforeEach(() => {
  get.mockReset()
  post.mockReset()
  useAuthStore.setState({ session: null, isAuthenticated: false, isHydrated: false, error: null })
})

describe('a fresh install', () => {
  it('the device has no business yet, so the person is asked for one', async () => {
    get.mockResolvedValue({ data: [] })

    const lookup = await lookupLocalWorkspace()

    expect(lookup).toEqual({ kind: 'empty' })
    expect(get).toHaveBeenCalledWith('/workspaces')
  })

  it('the business is created with the name and the currency the person chose', async () => {
    post.mockResolvedValue({ data: WORKSPACE })

    const created = await createLocalWorkspace({
      name: '  دوکان مرکزی  ',
      baseCurrency: 'USD',
      timeZone: 'Asia/Kabul',
    })

    expect(created).toEqual(WORKSPACE)
    expect(post).toHaveBeenCalledWith('/workspaces', {
      name: 'دوکان مرکزی',
      baseCurrency: 'USD',
      timeZone: 'Asia/Kabul',
    })
  })

  it('the owner is signed in afterwards, under the localized name', () => {
    useAuthStore.getState().startOfflineSession(WORKSPACE)

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.session?.user.id).toBe(WORKSPACE.ownerId)
    expect(state.session?.user.email).toBe('local@hisabche.local')
    // Not a Persian string written into the code: the catalog decides.
    expect(state.session?.user.fullName).toBe(localUserDisplayName())
  })

  it('the owner is signed in with their real name and email when provided', () => {
    const customWorkspace = {
      ...WORKSPACE,
      ownerName: 'حاجی حمید',
      ownerEmail: 'haji@lolokhan.af',
    }
    useAuthStore.getState().startOfflineSession(customWorkspace)

    const state = useAuthStore.getState()
    expect(state.session?.user.fullName).toBe('حاجی حمید')
    expect(state.session?.user.email).toBe('haji@lolokhan.af')
    expect(state.session?.user.businessName).toBe(WORKSPACE.name)
  })
})

describe('a restart', () => {
  it('the business is found again and nothing is asked', async () => {
    get.mockResolvedValue({ data: [WORKSPACE] })

    const lookup = await lookupLocalWorkspace()

    expect(lookup).toEqual({ kind: 'existing', workspace: WORKSPACE })
    expect(post).not.toHaveBeenCalled()
  })

  it('the same session is built as on the first run', () => {
    const first = buildOfflineSession(WORKSPACE)
    const second = buildOfflineSession(WORKSPACE)

    expect(second.user.id).toBe(first.user.id)
    expect(second.user.email).toBe(first.user.email)
    expect(second.user.fullName).toBe(first.user.fullName)
    expect(second.token).toBe(first.token)
  })
})

describe('a failure', () => {
  it("the engine's own refusal is shown, not swallowed", async () => {
    post.mockRejectedValue({
      message: 'BASE_CURRENCY_REQUIRED',
      code: 'VALIDATION_ERROR',
      status: 400,
    })

    await expect(
      createLocalWorkspace({ name: 'دوکان', baseCurrency: 'USD', timeZone: 'Asia/Kabul' }),
    ).rejects.toBeTruthy()

    const shown = offlineFailureMessage(
      { message: 'BASE_CURRENCY_REQUIRED', code: 'VALIDATION_ERROR', status: 400 },
      'ساخت کسب‌وکار محلی ناموفق بود',
    )
    expect(shown).toBe('BASE_CURRENCY_REQUIRED')
    expect(shown.length).toBeGreaterThan(0)
  })

  it('a failed read is not «no business yet» — it throws', async () => {
    get.mockRejectedValue({ message: 'DEVICE_DATABASE_UNAVAILABLE', status: 500 })

    await expect(lookupLocalWorkspace()).rejects.toBeTruthy()
  })
})
