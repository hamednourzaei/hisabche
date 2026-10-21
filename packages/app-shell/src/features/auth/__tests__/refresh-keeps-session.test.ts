// ============================================
// A refresh that the server did not REFUSE keeps the session.
//
// Closing the app or restarting the phone signed the person out: the first
// request renewed an expired access token while the server was still waking
// (502/503), and every failure but NETWORK_ERROR was read as «signed out».
// Only a refusal of the refresh token (400/401/403) ends the session.
// ============================================

import type { Session } from '@hisabche/auth-core'

const post = jest.fn()
jest.mock('@/shared/lib/api', () => ({ apiClient: { post: (...a: unknown[]) => post(...a) } }))

jest.mock('@/shared/lib/storage', () => ({
  sessionStore: { clear: jest.fn(async () => {}), write: jest.fn(async () => {}) },
}))

jest.mock('@/shared/lib/bridge', () => ({ bridge: () => null }))

let refresh: (() => Promise<string | null>) | null = null
jest.mock('@hisabche/api', () => ({
  markTokenReady: jest.fn(),
  readStorage: jest.fn(() => null),
  registerTokenGetter: jest.fn(),
  setOnUnauthorized: jest.fn(),
  setRefreshSession: (fn: () => Promise<string | null>) => {
    refresh = fn
  },
  STORAGE_KEYS: { token: 'token', user: 'user', refreshToken: 'refreshToken' },
}))

jest.mock('@hisabche/store', () => ({
  useAuthStore: { getState: () => ({ user: null }), setState: jest.fn() },
  useWorkspaceStore: { getState: () => ({ workspaceId: 'ws-a' }) },
}))

import { useAuthStore } from '../auth.store'

const session = {
  token: 'old',
  refreshToken: 'r1',
  user: { id: 'u1', email: 'a@b.c' },
} as unknown as Session

beforeEach(() => {
  post.mockReset()
  useAuthStore.setState({ session, isAuthenticated: true })
})

describe('the refresh registered by the shell', () => {
  it.each([500, 502, 503, 429])('keeps the session when the server answers %i', async (status) => {
    post.mockRejectedValueOnce({ status, code: 'UNKNOWN_ERROR', message: 'x' })
    await expect(refresh!()).rejects.toMatchObject({ status })
    expect(useAuthStore.getState().session).toBe(session)
  })

  it('keeps the session when the network is down', async () => {
    post.mockRejectedValueOnce({ status: 500, code: 'NETWORK_ERROR', message: 'x' })
    await expect(refresh!()).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  })

  it.each([400, 401, 403])(
    'ends it only when the refresh token is refused (%i)',
    async (status) => {
      post.mockRejectedValueOnce({ status, code: 'UNAUTHORIZED', message: 'x' })
      await expect(refresh!()).resolves.toBeNull()
    },
  )

  it('stores the renewed pair on success', async () => {
    post.mockResolvedValueOnce({ data: { token: 'new', refreshToken: 'r2' } })
    await expect(refresh!()).resolves.toBe('new')
    expect(useAuthStore.getState().session?.refreshToken).toBe('r2')
  })
})
