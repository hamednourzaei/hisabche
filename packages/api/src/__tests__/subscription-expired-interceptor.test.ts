// ============================================
// A 402 SUBSCRIPTION_EXPIRED raises the lock notice; nothing else does.
//
// The backend refuses every write on an expired workspace with 402 and the code
// SUBSCRIPTION_EXPIRED. The response interceptor is the one place every hook's
// request passes, so it is where the notice is raised — the same way 401 raises
// onUnauthorized. Any other 402, and any other status, must NOT tell someone
// their subscription ended.
// ============================================

import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient, setOnSubscriptionExpired, SUBSCRIPTION_EXPIRED_CODE } from '../lib/client'
import { registerTokenGetter } from '../lib/tokenProvider'

function respondWith(status: number, data: unknown) {
  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    throw new AxiosError('failed', String(status), config, null, {
      status,
      statusText: '',
      headers: {},
      config: { ...config, headers: new AxiosHeaders() },
      data,
    })
  }
}

const expired = vi.fn()

beforeEach(() => {
  registerTokenGetter(() => null)
  expired.mockReset()
  setOnSubscriptionExpired(expired)
})

describe('subscription-expired interceptor', () => {
  it('uses the backend code verbatim', () => {
    expect(SUBSCRIPTION_EXPIRED_CODE).toBe('SUBSCRIPTION_EXPIRED')
  })

  it('402 SUBSCRIPTION_EXPIRED → callback, and the request still rejects', async () => {
    respondWith(402, { error: 'Subscription expired', code: 'SUBSCRIPTION_EXPIRED' })
    await expect(apiClient.post('/invoices', {})).rejects.toMatchObject({
      status: 402,
      code: 'SUBSCRIPTION_EXPIRED',
    })
    expect(expired).toHaveBeenCalledTimes(1)
  })

  it('a 402 with another code does not claim the subscription ended', async () => {
    respondWith(402, { error: 'Payment required', code: 'SOMETHING_ELSE' })
    await expect(apiClient.post('/invoices', {})).rejects.toBeTruthy()
    expect(expired).not.toHaveBeenCalled()
  })

  it('a lookup failure (500) does not raise the lock notice', async () => {
    respondWith(500, { error: 'Internal Server Error', code: 'SUBSCRIPTION_LOOKUP_FAILED' })
    await expect(apiClient.post('/invoices', {})).rejects.toBeTruthy()
    expect(expired).not.toHaveBeenCalled()
  })
})
