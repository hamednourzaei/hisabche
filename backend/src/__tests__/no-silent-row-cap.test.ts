// PostgREST cuts EVERY response at max-rows (1000 here) and says nothing.
// A `.limit(5000)` therefore returns 1000 rows, and a tax return, a till
// close, an import's duplicate check or a statement summed over it is quietly
// wrong. Found in ~30 places on 27 Sep 2026 (tax return, migration rollback,
// POS session totals, reorder demand, audit export, CSV export…).
//
// A read that needs more than 1000 rows pages (fetchAllPages / selectAllPages).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { PAGE_SIZE, selectAllPages } from '../utils/fetch-all-pages'

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (name === '__tests__' || name === 'node_modules') continue
    if (statSync(full).isDirectory()) walk(full, out)
    else if (name.endsWith('.ts')) out.push(full)
  }
  return out
}

describe('no silent row cap', () => {
  it('no .limit() above PostgREST max-rows anywhere in the backend', () => {
    const offenders: string[] = []
    for (const file of walk(join(__dirname, '..'))) {
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return
        const m = /\.limit\(\s*([\d_]+)\s*\)/.exec(line)
        if (m && Number(m[1]!.replace(/_/g, '')) > PAGE_SIZE) {
          offenders.push(`${file.split(/[\\/]src[\\/]/)[1]}:${i + 1}  ${line.trim()}`)
        }
      })
    }
    expect(offenders).toEqual([])
  })
})

describe('selectAllPages', () => {
  const rowsOf = (n: number) => Array.from({ length: n }, (_, i) => ({ i }))

  it('reads every page until a short one', async () => {
    const all = rowsOf(2 * PAGE_SIZE + 7)
    const asked: Array<[number, number]> = []
    const { data, error } = await selectAllPages(async (lo, hi) => {
      asked.push([lo, hi])
      return { data: all.slice(lo, hi + 1), error: null }
    })
    expect(error).toBeNull()
    expect(data).toHaveLength(all.length)
    expect(asked).toEqual([
      [0, PAGE_SIZE - 1],
      [PAGE_SIZE, 2 * PAGE_SIZE - 1],
      [2 * PAGE_SIZE, 3 * PAGE_SIZE - 1],
    ])
  })

  it('exactly one full page → one more (empty) request, not a lost tail', async () => {
    const all = rowsOf(PAGE_SIZE)
    let calls = 0
    const { data } = await selectAllPages(async (lo, hi) => {
      calls++
      return { data: all.slice(lo, hi + 1), error: null }
    })
    expect(data).toHaveLength(PAGE_SIZE)
    expect(calls).toBe(2)
  })

  it('⚠️ an error on a LATER page returns the error and NO rows — never a partial set', async () => {
    const { data, error } = await selectAllPages(async (lo) =>
      lo === 0
        ? { data: rowsOf(PAGE_SIZE), error: null }
        : { data: null, error: { message: 'timeout', code: '57014' } },
    )
    expect(data).toBeNull()
    expect(error).toMatchObject({ code: '57014' })
  })
})
