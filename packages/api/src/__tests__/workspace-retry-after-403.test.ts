// ============================================
// A request that left before the business was known is sent again once it is.
//
// With more than one workspace the server refuses a request without
// `x-workspace-id` (WORKSPACE_FORBIDDEN, 403). The first burst after a fresh
// sign-in goes out before the workspace list answers, so currency/base,
// billing/subscription, employees, workflows/instances, ai/quota and
// manufacturing/report stayed 403 until a reload. The real response
// interceptor, a stub adapter:
//
//   A  no workspace → 403 → workspace arrives → replayed with the header → 200
//   B  no workspace ever arrives → ONE replay, then the normal error (no loop)
//   C  a request that already carried a workspace is never replayed (stale id)
// ============================================

import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { __resetActiveWorkspaceForTests, setActiveWorkspaceId } from '../lib/active-workspace'
import { apiClient } from '../lib/client'
import { markTokenReady, registerTokenGetter } from '../lib/tokenProvider'

let sent: Array<string | undefined> = []

function server() {
  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const workspace = (config.headers as Record<string, string> | undefined)?.['x-workspace-id']
    sent.push(workspace)
    if (workspace === 'ws-1') {
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config }
    }
    throw new AxiosError('forbidden', '403', config, null, {
      status: 403,
      statusText: '',
      headers: {},
      config: { ...config, headers: new AxiosHeaders() },
      data: { error: 'Multiple workspaces available', code: 'WORKSPACE_FORBIDDEN' },
    })
  }
}

beforeEach(() => {
  vi.useRealTimers()
  sent = []
  __resetActiveWorkspaceForTests()
  registerTokenGetter(() => 'token')
  markTokenReady()
  server()
})

describe('workspace known late', () => {
  it('A: 403 without a workspace → workspace arrives → replayed with the header → 200', async () => {
    const pending = apiClient.get('/finance/currency/base')
    setTimeout(() => setActiveWorkspaceId('ws-1'), 20)

    await expect(pending).resolves.toMatchObject({ status: 200 })
    expect(sent).toEqual([undefined, 'ws-1'])
  })

  it('B: no workspace ever arrives → one replay, then the ordinary error', async () => {
    vi.useFakeTimers()
    const pending = apiClient.get('/employees')
    const settled = pending.then(
      () => 'resolved',
      (error: { status?: number; code?: string }) => error,
    )
    await vi.advanceTimersByTimeAsync(5_100)

    await expect(settled).resolves.toMatchObject({ status: 403, code: 'WORKSPACE_FORBIDDEN' })
    expect(sent).toEqual([undefined, undefined])
  })

  it('C: a request that carried a workspace is not replayed', async () => {
    setActiveWorkspaceId('ws-stale')

    await expect(apiClient.get('/employees')).rejects.toMatchObject({ status: 403 })
    expect(sent).toEqual(['ws-stale'])
  })
})
