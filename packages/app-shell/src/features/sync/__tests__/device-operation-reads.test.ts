// ============================================
// Guard: «the device is ready» (V68.1)
//
// 1. DEVICE_OPERATION_READS['invoice.create'] names every table the local
//    invoice route reads (extracted from the route's own source).
// 2. Every read is classified exactly once: delivered by the pull, written by
//    the device, or an admitted gap (NOT_PULLED_YET). A new table with no
//    class turns this red — nobody can add a read and forget the question
//    «does the device have it?».
// 3. PULLED_TABLES is the pull's own list (DELTA_ENTITIES in sync-engine.ts).
//    The first version of this contract required 21 tables of which the pull
//    delivers 6; readiness could never be true and the whole device-first
//    path was dead code under a green suite. This is the test that sees it.
// 4. Readiness is per workspace, survives a reload through the bridge, and
//    is gone when the workspace's rows are purged.
// ============================================

import fs from 'node:fs'
import path from 'node:path'

import { localTableSchema, type LocalTable } from '@hisabche/app-bridge'

import {
  DEVICE_OPERATION_READS,
  DEVICE_WRITTEN_TABLES,
  NOT_PULLED_YET,
  PULLED_TABLES,
  deviceReadyFor,
  getTablePulledAt,
  hasPulledEverything,
  hasSyncedTable,
  loadSyncedTables,
  markTableSynced,
  resetSyncedTables,
} from '../device-sync-state'

/** The device's `meta` rows, as the host keeps them. */
const deviceMeta = new Map<string, string>()

jest.mock('@/shared/lib/bridge', () => ({
  bridge: () => ({
    db: {
      markSynced: async (workspaceId: string, table: string, pulledAt: string) => {
        deviceMeta.set(`synced:${workspaceId}:${table}`, pulledAt)
      },
      syncedTables: async (workspaceId: string) => {
        const prefix = `synced:${workspaceId}:`
        const out: Record<string, string> = {}
        for (const [key, value] of deviceMeta) {
          if (key.startsWith(prefix)) out[key.slice(prefix.length)] = value
        }
        return out
      },
    },
  }),
}))

jest.mock('@hisabche/store', () => ({
  useWorkspaceStore: { getState: () => ({ workspaceId: null }) },
}))

const REPO = path.resolve(__dirname, '../../../../../..')

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function pulledReads(operation: keyof typeof DEVICE_OPERATION_READS): LocalTable[] {
  const pulled = new Set<string>(PULLED_TABLES)
  return DEVICE_OPERATION_READS[operation].filter((table) => pulled.has(table))
}

describe('V68.1 — «the device is ready»', () => {
  beforeEach(() => {
    resetSyncedTables()
    deviceMeta.clear()
  })

  test('invoice.create names every table the local invoice route reads', () => {
    const route = withoutComments(
      fs.readFileSync(path.join(REPO, 'packages/local-engine/src/routes/invoices.ts'), 'utf8'),
    )
    const read = new Set(
      [...route.matchAll(/\b(?:FROM|JOIN)\s+([a-z0-9_]+)/gi)].map((m) =>
        String(m[1]).toLowerCase(),
      ),
    )
    const known = new Set<string>(localTableSchema.options)
    const tables = [...read].filter((table) => known.has(table))
    // The extraction itself must be working, or the loop below proves nothing.
    expect(tables.length).toBeGreaterThanOrEqual(10)

    const declared = new Set<string>(DEVICE_OPERATION_READS['invoice.create'])
    expect(tables.filter((table) => !declared.has(table))).toEqual([])
  })

  test('every read is classified exactly once', () => {
    const classes = [PULLED_TABLES, DEVICE_WRITTEN_TABLES, NOT_PULLED_YET]
    for (const reads of Object.values(DEVICE_OPERATION_READS)) {
      for (const table of reads) {
        const memberships = classes.filter((list) => list.includes(table)).length
        expect({ table, memberships }).toEqual({ table, memberships: 1 })
      }
    }
  })

  test('PULLED_TABLES is exactly what the pull delivers', () => {
    const engine = withoutComments(
      fs.readFileSync(path.join(__dirname, '../sync-engine.ts'), 'utf8'),
    )
    const listOf = (name: string): string[] => {
      const match = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\] as const`).exec(engine)
      if (!match) throw new Error(`${name} not found in sync-engine.ts`)
      return [...String(match[1]).matchAll(/'([a-z_]+)'/g)].map((m) => String(m[1]))
    }
    const delivered = [...listOf('ESSENTIAL_ENTITIES'), ...listOf('BACKGROUND_ENTITIES')]
    expect([...PULLED_TABLES].sort()).toEqual(delivered.sort())
  })

  test('the admitted gap is a closed list — it may shrink, never grow unseen', () => {
    // Removing a name = the server now delivers that table (add it to
    // DELTA_ENTITIES and PULLED_TABLES). Adding one = a local route started
    // reading server-owned rows the device never receives: say why, here.
    // `package_credit_ledger` left this list in V70.2 — the pull carries it now.
    expect([...NOT_PULLED_YET].sort()).toEqual(
      ['account', 'cost_layer', 'inventory_settings', 'stock_batches', 'stock_serials'].sort(),
    )
  })

  test('ready only when every pulled read is on the device', () => {
    const ws = 'ws-1'
    const needed = pulledReads('invoice.create')
    // Not vacuous: the invoice route does wait for pulled tables.
    expect(needed.length).toBeGreaterThanOrEqual(4)
    expect(deviceReadyFor(ws, 'invoice.create')).toBe(false)

    for (const table of needed.slice(0, -1)) markTableSynced(table, ws)
    expect(deviceReadyFor(ws, 'invoice.create')).toBe(false)

    markTableSynced(String(needed[needed.length - 1]), ws)
    expect(deviceReadyFor(ws, 'invoice.create')).toBe(true)
  })

  test('a real pull makes the device ready (the list the engine stamps is enough)', () => {
    const ws = 'ws-1'
    for (const table of PULLED_TABLES) markTableSynced(table, ws)
    expect(hasPulledEverything(ws)).toBe(true)
    expect(deviceReadyFor(ws, 'invoice.create')).toBe(true)
  })

  test('payments and returns are not run by the device', () => {
    const ws = 'ws-1'
    for (const table of localTableSchema.options) markTableSynced(table, ws)
    expect(deviceReadyFor(ws, 'payment.record')).toBe(false)
    expect(deviceReadyFor(ws, 'invoice.return')).toBe(false)
  })

  test('one workspace never makes another ready', () => {
    for (const table of PULLED_TABLES) markTableSynced(table, 'ws-1')
    expect(deviceReadyFor('ws-1', 'invoice.create')).toBe(true)
    expect(deviceReadyFor('ws-2', 'invoice.create')).toBe(false)
    expect(hasSyncedTable('product', 'ws-2')).toBe(false)
  })

  test('no workspace, no answer', () => {
    markTableSynced('product', null)
    expect(hasSyncedTable('product', null)).toBe(false)
    expect(deviceMeta.size).toBe(0)
  })

  test('a reload keeps readiness: the stamps come back from the device', async () => {
    const ws = 'ws-1'
    for (const table of PULLED_TABLES) markTableSynced(table, ws, '2026-11-16T10:00:00.000Z')
    await flush()
    expect(deviceMeta.size).toBe(PULLED_TABLES.length)

    // The reload: memory is gone, the device's SQLite is not.
    resetSyncedTables()
    expect(deviceReadyFor(ws, 'invoice.create')).toBe(false)

    await loadSyncedTables(ws)
    expect(deviceReadyFor(ws, 'invoice.create')).toBe(true)
    expect(getTablePulledAt('product', ws)).toBe('2026-11-16T10:00:00.000Z')
  })

  test('a purge takes readiness with it', async () => {
    const ws = 'ws-1'
    for (const table of PULLED_TABLES) markTableSynced(table, ws)
    await flush()

    // What the host does when the cache is pointed at another workspace.
    deviceMeta.clear()
    resetSyncedTables()
    await loadSyncedTables(ws)

    expect(deviceReadyFor(ws, 'invoice.create')).toBe(false)
  })
})
