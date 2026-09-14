// ============================================
// Refresh-on-401: the real response interceptor, a stub adapter.
//
//   A  expired token  → 401 → refresh → retry → 200
//   B  five parallel 401s → ONE refresh, all five retried with the new token
//   C  refresh fails → onUnauthorized, no retry, no loop
//   D  refresh succeeds but the retry is 401 again → logout, no second refresh
//   +  a 401 from /auth/login is a wrong password, never a refresh
// ============================================

import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient, setOnUnauthorized, setRefreshSession } from '../lib/client'
import { registerTokenGetter } from '../lib/tokenProvider'

let calls: Array<{ url: string; auth: string | undefined }> = []

/** 401 for any request carrying `expired`, 200 for `fresh`. */
function server(validToken: string) {
  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const auth = (config.headers as Record<string, string> | undefined)?.Authorization
    calls.push({ url: String(config.url), auth })
    if (auth === `Bearer ${validToken}`) {
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config }
    }
    throw new AxiosError('unauthorized', '401', config, null, {
      status: 401,
      statusText: '',
      headers: {},
      config: { ...config, headers: new AxiosHeaders() },
      data: { error: 'Invalid or expired token' },
    })
  }
}

const logout = vi.fn()

beforeEach(() => {
  calls = []
  logout.mockReset()
  setOnUnauthorized(logout)
  registerTokenGetter(() => 'expired')
})

describe('refresh on 401', () => {
  it('A: 401 → refresh → retry → 200', async () => {
    const refresh = vi.fn(async () => 'fresh')
    setRefreshSession(refresh)
    server('fresh')

    await expect(apiClient.get('/billing/subscription')).resolves.toMatchObject({ status: 200 })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(calls.map((c) => c.auth)).toEqual(['Bearer expired', 'Bearer fresh'])
    expect(logout).not.toHaveBeenCalled()
  })

  it('B: five simultaneous 401s share ONE refresh', async () => {
    let resolveRefresh: (token: string) => void = () => {}
    const refresh = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveRefresh = resolve
        }),
    )
    setRefreshSession(refresh)
    server('fresh')

    const requests = Array.from({ length: 5 }, (_, i) => apiClient.get(`/r${i}`))
    // Let all five fail and queue on the same refresh.
    await new Promise((r) => setTimeout(r, 20))
    resolveRefresh('fresh')

    const results = await Promise.all(requests)
    expect(results.every((r) => r.status === 200)).toBe(true)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(calls.filter((c) => c.auth === 'Bearer fresh')).toHaveLength(5)
  })

  it('C: refresh fails → logout, the request rejects, nothing loops', async () => {
    const refresh = vi.fn(async () => null)
    setRefreshSession(refresh)
    server('never')

    await expect(apiClient.get('/invoices')).rejects.toMatchObject({ status: 401 })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(logout).toHaveBeenCalledTimes(1)
    expect(calls).toHaveLength(1)
  })

  it('D: retried request 401s again → no second refresh, logout', async () => {
    const refresh = vi.fn(async () => 'still-bad')
    setRefreshSession(refresh)
    server('never')

    await expect(apiClient.get('/invoices')).rejects.toMatchObject({ status: 401 })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(calls).toHaveLength(2)
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('a 401 from /auth/login is not refreshed', async () => {
    const refresh = vi.fn(async () => 'fresh')
    setRefreshSession(refresh)
    server('fresh')

    await expect(apiClient.post('/auth/login', {})).rejects.toMatchObject({ status: 401 })
    expect(refresh).not.toHaveBeenCalled()
  })
})
