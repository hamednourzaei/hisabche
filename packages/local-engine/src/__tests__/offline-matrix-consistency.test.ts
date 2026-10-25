// The endpoint matrix (@hisabche/validation) and the engine say the same thing:
// a row is `available` exactly when the engine answers it, and everything else
// is refused with 501 — never a 404 from a route that happens to match, never a
// 200 from a stub nobody listed.
import { describe, expect, it } from 'vitest'
import { OFFLINE_ENDPOINT_MATRIX, endpointAvailability } from '@hisabche/validation'
import { createLocalEngine } from '../index'
import { createTestDb } from './test-db'

const SOME_ID = '9b2f4c1e-0000-4000-8000-000000000001'

describe('the engine and the offline endpoint matrix agree', () => {
  const engine = createLocalEngine(createTestDb())
  const rows = Object.entries(OFFLINE_ENDPOINT_MATRIX)

  it('answers every `available` row and refuses every other with 501', async () => {
    const wrong: string[] = []
    for (const [key, [, status]] of rows) {
      const space = key.indexOf(' ')
      const method = key.slice(0, space) as 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
      const path = key
        .slice(space + 1)
        .split(':x')
        .join(SOME_ID)
      const res = await engine.request({
        method,
        path,
        ...(method === 'GET' || method === 'DELETE' ? {} : { body: {} }),
      })
      const refused = res.status === 501
      if (status === 'available' && refused)
        wrong.push(`${key} is available but the engine refuses it`)
      if (status !== 'available' && !refused) {
        wrong.push(`${key} is ${status} but the engine answered ${res.status}`)
      }
    }
    expect(wrong).toEqual([])
  })

  it('tells the screen WHICH feature and status refused it', async () => {
    const res = await engine.request({ method: 'GET', path: `/invoices/${SOME_ID}/pdf` })
    expect(res.status).toBe(501)
    expect(res.data).toMatchObject({
      code: 'OFFLINE_NOT_AVAILABLE',
      feature: 'invoice.print',
      details: { availability: 'online_required' },
    })
    expect(endpointAvailability('GET', `/invoices/${SOME_ID}/pdf`)?.status).toBe('online_required')

    const unsupported = await engine.request({ method: 'POST', path: '/auth/login', body: {} })
    expect(unsupported.status).toBe(501)
    expect(unsupported.data).toMatchObject({ details: { availability: 'not_supported' } })
  })
})
