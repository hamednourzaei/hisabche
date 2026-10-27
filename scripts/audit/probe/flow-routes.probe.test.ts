// scripts/audit/probe/flow-routes.probe.test.ts
// Gate 3 probe: the five critical flows' HTTP entry points must be registered
// and must refuse an unauthenticated caller. A 404 would mean the route does not
// exist; a 401 proves the route is mounted and the auth guard runs first.
//
// This probe deliberately asserts ONLY route registration + guard order. It does
// not touch money, stock or a database, and must not be read as evidence that a
// flow works end to end.

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let app: FastifyInstance

beforeAll(async () => {
  const { buildServer } = await import('../../../backend/src/index')
  app = await buildServer()
  await app.ready()
}, 120_000)

afterAll(async () => {
  await app?.close()
})

const CASES: Array<{ name: string; method: 'GET' | 'POST'; url: string; payload?: unknown }> = [
  {
    name: 'invoice return create',
    method: 'POST',
    url: '/api/invoices/00000000-0000-0000-0000-000000000001/returns',
    payload: { lines: [] },
  },
  {
    name: 'bank reconcile',
    method: 'POST',
    url: '/api/finance/bank/reconcile',
    payload: {
      statementLineId: '00000000-0000-0000-0000-000000000001',
      bookEntryId: '00000000-0000-0000-0000-000000000002',
    },
  },
  {
    name: 'till close',
    method: 'POST',
    url: '/api/pos/sessions/00000000-0000-0000-0000-000000000001/close',
    payload: { countedCashMinor: 0 },
  },
  {
    name: 'sync conflict resolve',
    method: 'POST',
    url: '/api/conflicts/00000000-0000-0000-0000-000000000001/resolve',
    payload: { choice: 'keep_server', reason: 'probe' },
  },
  {
    name: 'tax return',
    method: 'GET',
    url: '/api/tax/return?from=2026-01-01&to=2026-01-31',
  },
]

describe('critical flow routes: registered and guarded', () => {
  for (const c of CASES) {
    it(`${c.name} answers 401, not 404`, async () => {
      const res = await app.inject({ method: c.method, url: c.url, payload: c.payload })
      expect(res.statusCode, `${c.method} ${c.url} -> ${res.statusCode}`).toBe(401)
    })
  }
})
