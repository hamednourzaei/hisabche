// Real sockets, real supabase-js, a local HTTP server standing in for Supabase.
import http from 'node:http'
import type { AddressInfo } from 'node:net'

import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getMetrics, runWithMetrics } from '../utils/request-metrics'
import {
  classify,
  installConnectionCounter,
  instrumentFetch,
  slowestCalls,
  waitingMs,
} from '../utils/supabase-fetch-metrics'

let server: http.Server
let base = ''

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const delay = req.url?.includes('slow') ? 120 : 30
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'application/json', connection: 'keep-alive' })
      res.end(req.url?.includes('/rpc/') ? '1' : '[]')
    }, delay)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  installConnectionCounter()
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
})

const client = () =>
  createClient(base, 'service-key', {
    auth: { persistSession: false },
    global: { fetch: instrumentFetch((input: any, init?: any) => fetch(input, init)) },
  })

describe('classify', () => {
  it('names the table, the function, or the auth path — nothing else', () => {
    expect(classify('https://x.supabase.co/rest/v1/invoices?select=id&workspace_id=eq.1')).toEqual({
      kind: 'rest',
      target: 'invoices',
    })
    expect(classify('https://x.supabase.co/rest/v1/rpc/payments_record')).toEqual({
      kind: 'rpc',
      target: 'payments_record',
    })
    expect(classify('https://x.supabase.co/auth/v1/user')).toEqual({ kind: 'auth', target: 'user' })
  })
})

describe('per-request database metrics over real HTTP', () => {
  it('counts every PostgREST call and its time (was always 0)', async () => {
    await runWithMetrics(async () => {
      const db = client()
      await db.from('products').select('id').eq('id', 1)
      await db.from('invoices').select('id')
      await db.rpc('slow_fn')
      const m = getMetrics()!
      expect(m.db.restCalls).toBe(2)
      expect(m.db.rpcCalls).toBe(1)
      expect(m.queryCount).toBe(3)
      expect(m.db.rpcMs).toBeGreaterThanOrEqual(100)
      expect(m.dbTimeMs).toBeGreaterThanOrEqual(150)
      expect(slowestCalls(1)[0]).toMatch(/^rpc:slow_fn \d+ms$/)
    })
  })

  it('parallel calls are counted once in waitingMs', async () => {
    await runWithMetrics(async () => {
      const db = client()
      await Promise.all([
        db.from('a_slow').select('id'),
        db.from('b_slow').select('id'),
        db.from('c_slow').select('id'),
      ])
      const m = getMetrics()!
      const summed = m.db.restMs
      const waited = waitingMs()
      expect(summed).toBeGreaterThanOrEqual(330)
      expect(waited).toBeLessThan(summed)
      expect(waited).toBeGreaterThanOrEqual(110)
    })
  })

  it('sequential calls on a warm client REUSE the connection (newConnections stays low)', async () => {
    const db = client()
    await db.from('warmup').select('id')
    await runWithMetrics(async () => {
      for (let i = 0; i < 5; i++) await db.from('products').select('id')
      const m = getMetrics()!
      expect(m.db.restCalls).toBe(5)
      expect(m.db.newConnections).toBeLessThanOrEqual(1)
    })
  })

  it('a first call to a NEW origin is seen as a new connection (the counter is live)', async () => {
    const other = http.createServer((_req, res) => res.end('[]'))
    await new Promise<void>((resolve) => other.listen(0, '127.0.0.1', resolve))
    const url = `http://127.0.0.1:${(other.address() as AddressInfo).port}`
    const db = createClient(url, 'k', {
      auth: { persistSession: false },
      global: { fetch: instrumentFetch((input: any, init?: any) => fetch(input, init)) },
    })
    await runWithMetrics(async () => {
      await db.from('x').select('id')
      expect(getMetrics()!.db.newConnections).toBeGreaterThanOrEqual(1)
    })
    other.closeAllConnections()
    await new Promise((resolve) => other.close(resolve))
  })
})
