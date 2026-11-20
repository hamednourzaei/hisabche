// The last five sync entities are wired end to end, not just named in a
// migration. This guard reads the actual sources so a future rename cannot
// leave the server emitting an entity the device has no mapper for.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../db', () => ({ supabase: {} }))

const { syncEntitySchema } = await import('@hisabche/validation')
const { PULL_COLUMNS, ENTITIES_WITH_VERSION } = await import('../services/sync.service')
const { declaredColumns } = await import('./helpers/declared-columns')

const ROOT = join(__dirname, '..', '..', '..')
const read = (relative: string) => readFileSync(join(ROOT, relative), 'utf8')

const ADDED = [
  ['cost_layer', 'cost_layers'],
  ['stock_batches', 'stock_batches'],
  ['stock_serials', 'stock_serials'],
  ['inventory_settings', 'inventory_settings'],
  ['account', 'accounts'],
] as const

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('sync entity coverage — the final five', () => {
  it.each(ADDED)('%s is a protocol entity with a lean, versioned pull', (entity) => {
    expect(syncEntitySchema.options).toContain(entity)
    const columns = PULL_COLUMNS[entity]
    expect(columns).not.toBeNull()
    expect(columns).toEqual(expect.arrayContaining(['id', 'workspace_id', 'version']))
    expect(ENTITIES_WITH_VERSION.has(entity as never)).toBe(true)
  })

  it.each(ADDED)('%s pull columns all exist in the migrations', (entity, table) => {
    const declared = declaredColumns(table)
    expect(declared.size).toBeGreaterThan(0)
    expect(PULL_COLUMNS[entity]!.filter((column) => !declared.has(column))).toEqual([])
  })

  it('every new entity has a device mapper, so an emitted row is not dropped', () => {
    const engine = withoutComments(read('packages/app-shell/src/features/sync/sync-engine.ts'))
    for (const [entity] of ADDED) {
      expect(engine).toMatch(new RegExp(`\\n  ${entity}: \\(r\\) => \\(\\{`))
    }
  })

  it('the new entities are pulled, not left in the admitted gap', () => {
    const state = withoutComments(read('packages/app-shell/src/features/sync/device-sync-state.ts'))
    const list = (name: string): string[] => {
      const match = new RegExp(`export const ${name}:[^=]*= \\[([\\s\\S]*?)\\]`).exec(state)
      if (!match) throw new Error(`${name} not found`)
      return [...match[1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!)
    }
    for (const [entity] of ADDED) expect(list('PULLED_TABLES')).toContain(entity)
    expect(list('NOT_PULLED_YET')).toEqual([])
  })

  it('the server refuses a device write for all five', () => {
    const service = withoutComments(read('backend/src/services/sync.service.ts'))
    for (const [entity] of ADDED) {
      expect(service).toContain(`['${entity}', `)
    }
  })

  it('the migration gives accounts and inventory_settings a routable identity', () => {
    const migration = read('docs/sync-account-tenancy-coverage-migration.sql')
    expect(migration).toContain('ALTER TABLE accounts ADD COLUMN IF NOT EXISTS version')
    expect(migration).toContain("sync_record_change('account')")
    expect(migration).toContain('inventory_settings_id_key')
    expect(migration).toContain("sync_record_change('inventory_settings')")

    const verify = read('docs/VERIFY-sync-account-tenancy-coverage.sql')
    expect(verify).toContain('PENDING HUMAN CONFIRMATION')
    expect(verify).toContain('accounts_change_log_trg')
  })
})
