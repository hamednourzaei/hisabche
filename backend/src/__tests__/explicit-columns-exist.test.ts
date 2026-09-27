// Explicit column lists that replaced `select('*')` (27 Sep 2026). A column
// that is not in the schema turns the whole query into a PostgREST 400 — the
// exact failure the `deleted_at` reads produced in production. Every name here
// must be declared by a migration.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { declaredColumns } from './helpers/declared-columns'

vi.mock('../db', () => ({ supabase: {} }))
vi.mock('../utils/pagination', () => ({
  memoryCache: { get: vi.fn(), set: vi.fn(), invalidate: vi.fn() },
}))

const { ACTIVITY_COLUMNS } = await import('../services/activity.service')

const split = (list: string) =>
  list
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)

function constantIn(file: string, name: string): string {
  const src = readFileSync(join(__dirname, '..', file), 'utf8')
  const m =
    new RegExp(`const ${name} =\\s*\`([^\`]*)\``).exec(src) ??
    new RegExp(`const ${name} =\\s*'([^']*)'`).exec(src)
  if (!m) throw new Error(`${name} not found in ${file}`)
  return m[1]!
}

const CASES: Array<[string, string, string[]]> = [
  ['activities', 'ACTIVITY_COLUMNS', split(ACTIVITY_COLUMNS)],
  [
    'sync_conflicts',
    'LIST_COLUMNS',
    split(constantIn('services/conflict/conflict.service.ts', 'LIST_COLUMNS')),
  ],
  [
    'ai_provider_settings',
    'STATUS_COLUMNS',
    split(constantIn('services/ai/ai-settings.service.ts', 'STATUS_COLUMNS')),
  ],
]

describe('explicit column lists exist in the schema', () => {
  for (const [table, name, columns] of CASES) {
    it(`${table}.${name}`, () => {
      const declared = declaredColumns(table)
      expect(declared.size, `${table} has no CREATE TABLE in docs/`).toBeGreaterThan(0)
      expect(columns.filter((c) => !declared.has(c))).toEqual([])
    })
  }

  it('the lists stay lean: no full-row snapshot in a list', () => {
    expect(split(ACTIVITY_COLUMNS)).not.toContain('entity_snapshot')
    const conflictList = split(constantIn('services/conflict/conflict.service.ts', 'LIST_COLUMNS'))
    expect(conflictList).not.toContain('server_row')
    expect(conflictList).not.toContain('client_payload')
    expect(split(constantIn('services/ai/ai-settings.service.ts', 'STATUS_COLUMNS'))).not.toContain(
      'api_key',
    )
  })
})
