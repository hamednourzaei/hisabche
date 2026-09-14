import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { applyKeyset, decodeCursor, encodeCursor } from '../utils/keyset-cursor'

const ID = '0b6b1c52-1e0c-4c8e-9a51-6a3f1d9d2a11'

function recorder() {
  const calls: Array<[string, ...unknown[]]> = []
  const q: any = {
    gt: (...a: unknown[]) => (calls.push(['gt', ...a]), q),
    lt: (...a: unknown[]) => (calls.push(['lt', ...a]), q),
    or: (...a: unknown[]) => (calls.push(['or', ...a]), q),
  }
  return { q, calls }
}

describe('keyset cursor', () => {
  it('round-trips (sort value, id)', () => {
    const cursor = encodeCursor(
      { id: ID, created_at: '2026-09-14T10:00:00.123+00:00' },
      'created_at',
    )!
    expect(decodeCursor(cursor, 'created_at')).toEqual({
      value: '2026-09-14T10:00:00.123+00:00',
      id: ID,
    })
  })

  it('⚠️ continues AFTER the last row — sort value first, id breaks ties', () => {
    const { q, calls } = recorder()
    applyKeyset(q, 'created_at', 'desc', { value: '2026-09-14T10:00:00+00:00', id: ID })
    expect(calls).toEqual([
      [
        'or',
        `created_at.lt."2026-09-14T10:00:00+00:00",and(created_at.eq."2026-09-14T10:00:00+00:00",id.lt.${ID})`,
      ],
    ])
  })

  it('ascending uses gt', () => {
    const { q, calls } = recorder()
    applyKeyset(q, 'sell_price', 'asc', { value: 12.5, id: ID })
    expect(calls[0]![1]).toBe(`sell_price.gt.12.5,and(sell_price.eq.12.5,id.gt.${ID})`)
  })

  it('sorting by id keeps the plain id cursor (desktop snapshot)', () => {
    expect(encodeCursor({ id: ID }, 'id')).toBe(ID)
    const { q, calls } = recorder()
    applyKeyset(q, 'id', 'asc', decodeCursor(ID, 'id')!)
    expect(calls).toEqual([['gt', 'id', ID]])
  })

  it('refuses a tampered or legacy cursor instead of guessing', () => {
    expect(decodeCursor(ID, 'created_at')).toBeNull() // the old id-as-cursor
    expect(decodeCursor('not-base64-json', 'created_at')).toBeNull()
    expect(
      decodeCursor(Buffer.from('["x","not-a-uuid"]').toString('base64url'), 'created_at'),
    ).toBeNull()
  })

  it('refuses an unsafe column name', () => {
    const { q, calls } = recorder()
    applyKeyset(q, 'created_at);drop', 'desc', { value: 'x', id: ID })
    expect(calls).toEqual([])
  })

  it('a quote inside a value cannot break out of the literal', () => {
    const { q, calls } = recorder()
    applyKeyset(q, 'name', 'asc', { value: 'a",id.gt.0', id: ID })
    expect(String(calls[0]![1])).toContain('name.gt."a\\",id.gt.0"')
  })
})

describe('the three lists use it (no more id compared against created_at)', () => {
  for (const file of ['invoice.service.ts', 'product.service.ts', 'customer.service.ts']) {
    it(file, () => {
      const src = readFileSync(join(__dirname, '../services', file), 'utf8').replace(
        /\/\/.*$/gm,
        '',
      )
      expect(src).toContain('applyKeyset(query')
      expect(src).toContain('encodeCursor(last')
      expect(src).not.toMatch(
        /nextCursor = hasMore && items\.length > 0 \? items\[items\.length - 1\]\?\.id/,
      )
    })
  }
})
