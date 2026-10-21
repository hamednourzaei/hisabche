// ============================================
// Signing out with unsent changes.
//
// A change that exists nowhere but this device must not disappear with the
// session — and the person must not be trapped either: the dialog offers
// both ways out, and the way out keeps the data.
// ============================================

import type { Session } from '@hisabche/auth-core'

const post = jest.fn(async (..._args: unknown[]) => ({ data: {} }))
jest.mock('@/shared/lib/api', () => ({ apiClient: { post: (...a: unknown[]) => post(...a) } }))

const clear = jest.fn(async (..._args: unknown[]) => {})
jest.mock('@/shared/lib/storage', () => ({
  sessionStore: { clear: (...a: unknown[]) => clear(...a) },
}))

let queue: Array<{ userId: string | null }> = []
const dbCalls: string[] = []
jest.mock('@/shared/lib/bridge', () => ({
  bridge: () => ({
    db: {
      queue: async () => {
        dbCalls.push('queue')
        return queue
      },
    },
  }),
}))

jest.mock('@hisabche/api', () => ({
  markTokenReady: jest.fn(),
  readStorage: jest.fn(() => null),
  registerTokenGetter: jest.fn(),
  setOnUnauthorized: jest.fn(),
  setRefreshSession: jest.fn(),
  STORAGE_KEYS: { token: 'token', user: 'user', refreshToken: 'refreshToken' },
}))

jest.mock('@hisabche/store', () => ({
  // The shell's store mirrors the signed-in user into the shared one, so the
  // shared store needs its setter here too.
  useAuthStore: { getState: () => ({ user: null }), setState: jest.fn() },
  useWorkspaceStore: { getState: () => ({ workspaceId: 'ws-a' }) },
}))

import { useAuthStore } from '../auth.store'

const session: Session = {
  user: {
    id: 'user-a',
    fullName: 'A',
    email: 'a@b.c',
    role: 'owner',
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  token: 'tok',
}

beforeEach(() => {
  queue = []
  dbCalls.length = 0
  post.mockClear()
  clear.mockClear()
  useAuthStore.setState({
    session,
    isAuthenticated: true,
    isSessionValid: true,
    pendingLogoutCount: 0,
  })
})

describe('signing out', () => {
  it('⚠️ with unsent changes it is refused, and their number is shown', async () => {
    queue = [{ userId: 'user-a' }, { userId: 'user-a' }]

    const done = await useAuthStore.getState().logout()

    expect(done).toBe(false)
    expect(useAuthStore.getState().pendingLogoutCount).toBe(2)
    // The session is still there: the person has not been signed out yet.
    expect(useAuthStore.getState().session).not.toBeNull()
    expect(post).not.toHaveBeenCalled()
  })

  it('another account’s changes are not this person’s to block the sign-out', async () => {
    queue = [{ userId: 'user-b' }]

    const done = await useAuthStore.getState().logout()

    expect(done).toBe(true)
    expect(useAuthStore.getState().session).toBeNull()
  })

  it('with nothing unsent, the sign-out happens', async () => {
    queue = []

    const done = await useAuthStore.getState().logout()

    expect(done).toBe(true)
    expect(useAuthStore.getState().session).toBeNull()
    expect(clear).toHaveBeenCalled()
  })

  it('⚠️ the person chooses: the sign-out happens and the device keeps everything', async () => {
    queue = [{ userId: 'user-a' }]

    const done = await useAuthStore.getState().logout({ force: true })

    expect(done).toBe(true)
    expect(useAuthStore.getState().session).toBeNull()
    expect(useAuthStore.getState().pendingLogoutCount).toBe(0)
    // The session is cleared. The DEVICE data is not: nothing was removed
    // from the cache, and the queue was not even read — the choice was made.
    expect(dbCalls).toEqual([])
  })

  it('the dialog can be closed without signing out', async () => {
    queue = [{ userId: 'user-a' }]
    await useAuthStore.getState().logout()
    expect(useAuthStore.getState().pendingLogoutCount).toBe(1)

    useAuthStore.getState().dismissPendingLogout()

    expect(useAuthStore.getState().pendingLogoutCount).toBe(0)
    expect(useAuthStore.getState().session).not.toBeNull()
  })
})
