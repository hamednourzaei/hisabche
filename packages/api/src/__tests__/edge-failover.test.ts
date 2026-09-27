// ============================================
// If the Cloudflare edge fails, requests go straight to Render (27 Sep 2026),
// and Render's own load balancer carries on. What must hold:
//   - only an EDGE failure switches (our own JSON 429 / 500 never does);
//   - only what is safe to send twice is resent;
//   - once switched, later requests use the direct address until the cooldown;
//   - with no fallback configured, nothing changes.
// ============================================

import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '../lib/client'
import {
  COOLDOWN_MS,
  activeBaseUrl,
  canReplay,
  configureEdgeFailover,
  isEdgeFailure,
  isFailedOver,
} from '../lib/edge-failover'
import { markTokenReady, registerTokenGetter } from '../lib/tokenProvider'

const EDGE = 'https://api.example.test/api'
const DIRECT = 'https://example-api.onrender.test/api'

/** Each call: which base it went to, and what it answered. */
const calls: string[] = []
let answer: (base: string) => { status: number; contentType?: string; noResponse?: boolean }

beforeEach(() => {
  registerTokenGetter(() => null)
  markTokenReady()
  calls.length = 0
  apiClient.defaults.baseURL = EDGE
  configureEdgeFailover({ primary: EDGE, fallback: DIRECT })
  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const base = String(config.baseURL)
    calls.push(`${String(config.method).toUpperCase()} ${base}`)
    const a = answer(base)
    if (a.noResponse) throw new AxiosError('Network Error', 'ERR_NETWORK', config, {}, undefined)
    if (a.status < 400) {
      return { status: a.status, statusText: 'OK', headers: {}, config, data: { ok: true } }
    }
    throw new AxiosError('failed', String(a.status), config, null, {
      status: a.status,
      statusText: '',
      headers: { 'content-type': a.contentType ?? 'text/html' },
      config: { ...config, headers: new AxiosHeaders() },
      data: a.contentType?.includes('json') ? { error: 'x', code: 'RATE_LIMITED' } : '<html>',
    })
  }
})

afterEach(() => {
  vi.useRealTimers()
  configureEdgeFailover(null)
})

describe('edge failover — through the real client', () => {
  it('a Cloudflare 522 on a read: resent once to Render, and it succeeds', async () => {
    answer = (base) => ({ status: base === EDGE ? 522 : 200 })
    await expect(apiClient.get('/invoices/1')).resolves.toMatchObject({ data: { ok: true } })
    expect(calls).toEqual([`GET ${EDGE}`, `GET ${DIRECT}`])
  })

  it('no response at all from the edge: same', async () => {
    answer = (base) => (base === EDGE ? { status: 0, noResponse: true } : { status: 200 })
    await expect(apiClient.get('/invoices/1')).resolves.toBeTruthy()
    expect(calls[1]).toBe(`GET ${DIRECT}`)
  })

  it('once switched, the NEXT request goes straight to Render', async () => {
    answer = (base) => ({ status: base === EDGE ? 521 : 200 })
    await apiClient.get('/invoices/1')
    calls.length = 0
    await apiClient.get('/customers/1')
    expect(calls).toEqual([`GET ${DIRECT}`])
  })

  it('⚠️ a write without an Idempotency-Key is NOT resent (a 524 means it arrived)', async () => {
    answer = (base) => ({ status: base === EDGE ? 524 : 200 })
    await expect(apiClient.post('/payments', { amount: 1 })).rejects.toBeTruthy()
    expect(calls).toEqual([`POST ${EDGE}`])
    // …but the next request already avoids the edge.
    expect(isFailedOver()).toBe(true)
  })

  it('a write WITH an Idempotency-Key is resent — the server returns the first result', async () => {
    answer = (base) => ({ status: base === EDGE ? 530 : 200 })
    await apiClient.post('/invoices', {}, { headers: { 'Idempotency-Key': 'k-1' } })
    expect(calls).toEqual([`POST ${EDGE}`, `POST ${DIRECT}`])
  })

  it('⚠️ OUR JSON 429 (the rate limiter) is respected, never routed around', async () => {
    answer = () => ({ status: 429, contentType: 'application/json; charset=utf-8' })
    await expect(apiClient.get('/invoices/1')).rejects.toMatchObject({ status: 429 })
    expect(calls).toEqual([`GET ${EDGE}`])
    expect(isFailedOver()).toBe(false)
  })

  it('a JSON 500 from the backend is not an edge failure', async () => {
    answer = () => ({ status: 500, contentType: 'application/json' })
    await expect(apiClient.get('/invoices/1')).rejects.toBeTruthy()
    expect(calls).toHaveLength(1)
  })

  it('Render itself failing too: one retry, then the error — no loop', async () => {
    answer = () => ({ status: 522 })
    await expect(apiClient.get('/invoices/1')).rejects.toBeTruthy()
    expect(calls).toEqual([`GET ${EDGE}`, `GET ${DIRECT}`])
  })

  it('no fallback configured → nothing changes', async () => {
    configureEdgeFailover(null)
    answer = () => ({ status: 522 })
    await expect(apiClient.get('/invoices/1')).rejects.toBeTruthy()
    expect(calls).toEqual([`GET ${EDGE}`])
  })
})

describe('edge failover — rules', () => {
  it('switches only the configured primary, never another base a host set', () => {
    expect(activeBaseUrl('http://localhost:3001/api')).toBe('http://localhost:3001/api')
  })

  it('cooldown window', async () => {
    answer = (base) => ({ status: base === EDGE ? 522 : 200 })
    await apiClient.get('/x/1')
    const t = Date.now()
    expect(activeBaseUrl(EDGE, t + 1000)).toBe(DIRECT)
    expect(activeBaseUrl(EDGE, t + COOLDOWN_MS + 1000)).toBe(EDGE)
  })

  it('timeouts are not edge failures (a slow origin is slow by any route)', () => {
    expect(isEdgeFailure({ hasResponse: false, code: 'ECONNABORTED' })).toBe(false)
    expect(isEdgeFailure({ hasResponse: false, code: 'ERR_NETWORK' })).toBe(true)
  })

  it('replay safety', () => {
    expect(canReplay('get', {})).toBe(true)
    expect(canReplay('post', {})).toBe(false)
    expect(canReplay('patch', { 'idempotency-key': 'k' })).toBe(true)
    expect(canReplay('delete', { 'Idempotency-Key': '' })).toBe(false)
  })
})
