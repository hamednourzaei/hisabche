import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { applyOptimisticPatch, patchById, rollbackOptimisticPatch } from '../lib/optimistic'

const client = () => new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })

describe('patchById', () => {
  it('patches a row inside a list, a container and infinite pages', () => {
    expect(
      patchById(
        [
          { id: 'a', s: 1 },
          { id: 'b', s: 1 },
        ],
        'b',
        { s: 2 },
      ),
    ).toEqual([
      { id: 'a', s: 1 },
      { id: 'b', s: 2 },
    ])
    expect(patchById({ items: [{ id: 'a', s: 1 }], total: 1 }, 'a', { s: 9 })).toEqual({
      items: [{ id: 'a', s: 9 }],
      total: 1,
    })
    expect(patchById({ pages: [{ rows: [{ id: 'x', s: 0 }] }] }, 'x', { s: 5 })).toEqual({
      pages: [{ rows: [{ id: 'x', s: 5 }] }],
    })
  })

  it('returns the SAME reference when nothing matched (no needless re-render)', () => {
    const data = { items: [{ id: 'a' }] }
    expect(patchById(data, 'zzz', { s: 1 })).toBe(data)
  })
})

describe('apply + rollback', () => {
  it('shows the change in every cached copy, and a refusal restores all of them', async () => {
    const qc = client()
    qc.setQueryData(['crm', 'tasks'], [{ id: 't1', status: 'open' }])
    qc.setQueryData(['crm', 'task', 't1'], { id: 't1', status: 'open' })
    qc.setQueryData(['billing'], [{ id: 't1', status: 'open' }]) // other root: untouched

    const snapshot = await applyOptimisticPatch(qc, ['crm'], 't1', { status: 'done' })
    expect(qc.getQueryData(['crm', 'tasks'])).toEqual([{ id: 't1', status: 'done' }])
    expect(qc.getQueryData(['crm', 'task', 't1'])).toEqual({ id: 't1', status: 'done' })
    expect(qc.getQueryData(['billing'])).toEqual([{ id: 't1', status: 'open' }])

    rollbackOptimisticPatch(qc, snapshot)
    expect(qc.getQueryData(['crm', 'tasks'])).toEqual([{ id: 't1', status: 'open' }])
    expect(qc.getQueryData(['crm', 'task', 't1'])).toEqual({ id: 't1', status: 'open' })
  })
})

describe('⚠️ never on money', () => {
  it('no financial hook applies an optimistic patch', async () => {
    const { readFileSync, readdirSync } = await import('node:fs')
    const { join } = await import('node:path')
    const dir = join(__dirname, '..', 'hooks')
    const financial =
      /^(payments|till|accounting|bank|budgets|invoices|currency-rates|pos|transactions|inventory)/
    const offenders = readdirSync(dir)
      .filter((file) => financial.test(file))
      .filter((file) => readFileSync(join(dir, file), 'utf8').includes('applyOptimisticPatch'))
    expect(offenders).toEqual([])
  })
})
