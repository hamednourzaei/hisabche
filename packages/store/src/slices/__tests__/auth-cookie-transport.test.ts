import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Capture the refresh function the auth store registers with the API client.
let registeredRefresh: (() => Promise<string | null>) | null = null
vi.mock('@hisabche/api', () => ({
  setOnUnauthorized: () => {},
  setRefreshSession: (fn: () => Promise<string | null>) => {
    registeredRefresh = fn
  },
  registerTokenGetter: () => {},
  markTokenReady: () => {},
}))

type Call = { url: string; init: RequestInit }
let calls: Call[] = []

function mockFetch(body: unknown, ok = true) {
  calls = []
  globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return { ok, json: async () => body } as Response
  }) as typeof fetch
}

const headersOf = (c: Call) => (c.init.headers ?? {}) as Record<string, string>

describe('auth store — refresh token transport on a web (http/https) page', () => {
  let useAuthStore: typeof import('../auth.slice').useAuthStore

  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    ;({ useAuthStore } = await import('../auth.slice'))
  })
  afterEach(() => vi.restoreAllMocks())

  it('login asks for the cookie, sends credentials, and keeps no refresh token in JS', async () => {
    mockFetch({ user: { id: 'u1', email: 'a@b.co' }, token: 'access-1' })
    await useAuthStore.getState().login({ email: 'a@b.co', password: 'Password123!' })

    const login = calls.find((c) => c.url.endsWith('/auth/login'))!
    expect(login.init.credentials).toBe('include')
    expect(headersOf(login)['X-Auth-Transport']).toBe('cookie')
    expect(useAuthStore.getState().token).toBe('access-1')
    expect(useAuthStore.getState().refreshToken).toBeNull()
    expect(localStorage.getItem('hisabche-auth') ?? '').not.toContain('refresh')
  })

  it('refresh works from the cookie alone (no token in JS) and stores none back', async () => {
    useAuthStore.setState({ token: 'access-1', refreshToken: null, isDemo: false })
    mockFetch({ token: 'access-2', expiresAt: 1 })

    await expect(registeredRefresh!()).resolves.toBe('access-2')
    const refresh = calls.find((c) => c.url.endsWith('/auth/refresh'))!
    expect(refresh.init.credentials).toBe('include')
    expect(refresh.init.body).toBe('{}')
    expect(useAuthStore.getState().token).toBe('access-2')
    expect(useAuthStore.getState().refreshToken).toBeNull()
  })

  it('a session saved before the cookie sends its token once, then drops it', async () => {
    useAuthStore.setState({ token: 'access-1', refreshToken: 'old-refresh-token', isDemo: false })
    mockFetch({ token: 'access-2' })

    await registeredRefresh!()
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ refreshToken: 'old-refresh-token' })
    expect(useAuthStore.getState().refreshToken).toBeNull()
  })

  it('signed out: nothing to refresh, no request', async () => {
    useAuthStore.setState({ token: null, refreshToken: null, isDemo: false })
    mockFetch({})
    await expect(registeredRefresh!()).resolves.toBeNull()
    expect(calls).toHaveLength(0)
  })

  it('logout during the refresh is not undone', async () => {
    useAuthStore.setState({ token: 'access-1', refreshToken: null, isDemo: false })
    globalThis.fetch = vi.fn(async () => {
      useAuthStore.setState({ token: null })
      return { ok: true, json: async () => ({ token: 'access-2' }) } as Response
    }) as typeof fetch
    await expect(registeredRefresh!()).resolves.toBeNull()
    expect(useAuthStore.getState().token).toBeNull()
  })
})
