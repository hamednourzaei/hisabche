// ============================================
// `responseBody` — the route's payload from what `apiClient` returns (the
// axios response, passed through by the interceptor).
//
// The V61 hooks unwrapped ONE layer: the expense-claims list was always empty
// (`asList({ data: rows })` → []) and the cheque register crashed on `.map`.
// ============================================
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { responseBody } from '../lib/response-body'

describe('responseBody', () => {
  it('reads `{ data: rows }` inside the axios response', () => {
    const response = { status: 200, data: { data: [{ id: 'a' }] } }
    expect(responseBody<unknown[]>(response)).toEqual([{ id: 'a' }])
  })

  it('reads a bare array body', () => {
    const response = { status: 200, data: [{ id: 'a' }] }
    expect(responseBody<unknown[]>(response)).toEqual([{ id: 'a' }])
  })

  it('reads a bare object body that has no `data` field', () => {
    const response = { status: 200, data: { snapshots: [] } }
    expect(responseBody<{ snapshots: unknown[] }>(response)).toEqual({ snapshots: [] })
  })

  it('reads a single created row inside `{ data: row }`', () => {
    const response = { status: 201, data: { data: { id: 'x', status: 'open' } } }
    expect(responseBody<{ id: string }>(response)).toEqual({ id: 'x', status: 'open' })
  })
})

describe('the V61 hooks read through it, not through a one-layer unwrap', () => {
  const HOOKS = join(__dirname, '..', 'hooks')
  for (const file of [
    'expense-claims.ts',
    'purchasing-rfq.ts',
    'org-chart.ts',
    'erp-registers.ts',
  ]) {
    it(`${file} has no one-layer unwrap`, () => {
      const source = readFileSync(join(HOOKS, file), 'utf8')
      expect(source).toContain('responseBody')
      expect(source).not.toContain('const unwrap')
    })
  }

  it('the cheque hooks read through it', () => {
    const source = readFileSync(join(HOOKS, 'payments.ts'), 'utf8')
    const cheques = source.slice(source.indexOf('export function useCheques'))
    expect(cheques.slice(0, 2000)).toContain('responseBody')
  })
})
