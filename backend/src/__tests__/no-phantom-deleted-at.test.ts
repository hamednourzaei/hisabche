// Every query that reads or writes `deleted_at` must be on a table that HAS it.
//
// Twice in one session (27 Sep 2026) a table without the column was filtered
// by it: desktop's sync mapper (silently undefined) and MDM duplicate detection
// on products/customers — 42703, a 400 on every run in production. Products
// and customers retire with `is_active = false`; only some tables carry
// `deleted_at`. This scans every `.from('table')` statement in backend/src and
// checks the column against the migrations.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import { declaredColumns } from './helpers/declared-columns'

const SRC = join(__dirname, '..')

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name === 'node_modules') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) sources(full, out)
    else if (name.endsWith('.ts')) out.push(full)
  }
  return out
}

/** `.from('table')` … up to the end of that statement (a blank line, `;` or the next `.from(`). */
function statementsUsingDeletedAt(): Array<{ file: string; table: string }> {
  const hits: Array<{ file: string; table: string }> = []
  for (const file of sources(SRC)) {
    const code = readFileSync(file, 'utf8').replace(/\/\/.*$/gm, '')
    for (const m of code.matchAll(/\.from\(\s*'([a-z_]+)'\s*\)([\s\S]*?)(?=\.from\(|\n\s*\n|;)/g)) {
      if (/\bdeleted_at\b/.test(m[2]!)) hits.push({ file: relative(SRC, file), table: m[1]! })
    }
  }
  return hits
}

describe('no phantom deleted_at', () => {
  const hits = statementsUsingDeletedAt()

  it('finds the queries it guards', () => {
    expect(hits.length).toBeGreaterThan(10)
  })

  it('every table filtered or updated by deleted_at declares the column', () => {
    const phantom = hits.filter(({ table }) => !declaredColumns(table).has('deleted_at'))
    expect(phantom.map((h) => `${h.file}: ${h.table}`)).toEqual([])
  })
})

describe('MDM retires each entity by a column its table has', () => {
  it('products/customers by is_active, suppliers by deleted_at — and all can record merged_into_id', async () => {
    const { vi } = await import('vitest')
    vi.doMock('../db', () => ({ supabase: {} }))
    const { ENTITY_CONFIG } = await import('../services/mdm/mdm.service')
    for (const [entity, config] of Object.entries(ENTITY_CONFIG)) {
      const columns = declaredColumns(config.table)
      expect(columns.has(config.retiredBy), `${entity}: ${config.table}.${config.retiredBy}`).toBe(
        true,
      )
      expect(columns.has('merged_into_id'), `${entity}: ${config.table}.merged_into_id`).toBe(true)
    }
  })
})
