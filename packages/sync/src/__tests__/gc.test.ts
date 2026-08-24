// ============================================
// Local garbage collector.
//
// The whole suite exists to pin one property:
//
//   LOCAL DELETE  ≠  SERVER DELETE
//
// The GC frees space on a device. If it ever enqueued a mutation instead, a
// shopkeeper would lose accounting history because their phone was full. So
// every eviction path here asserts that the outbox stayed empty, not merely
// that the row went away.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'

import { collectGarbage, hydrateEntities, DEFAULT_RETENTION } from '../gc'
import { MemoryStorageAdapter } from '../memory-adapter'
import { mutateLocal } from '../mutations'
import type { HydrationSource } from '../gc'
import type { LocalEntity } from '../types'

type SyncEntityLike = LocalEntity['entityType']

const WS = 'workspace-1'
const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-06-01T00:00:00Z')

let storage: MemoryStorageAdapter

beforeEach(() => {
  storage = new MemoryStorageAdapter()
})

/** A synced replica: server-sourced, unmodified, has a real version. */
async function replica(id: string, ageDays: number, type: SyncEntityLike = 'invoice') {
  await storage.putEntity({
    id,
    workspaceId: WS,
    entityType: type,
    data: {
      id,
      total: 100,
      updated_at: new Date(NOW - ageDays * DAY).toISOString(),
    },
    version: 3,
    pending: false,
    updatedAt: NOW - ageDays * DAY,
  } as LocalEntity)
}

const gc = (overrides: Partial<Parameters<typeof collectGarbage>[0]> = {}) =>
  collectGarbage({ storage, workspaceId: WS, now: () => NOW, ...overrides })

/* ═══════════════════════════════════════════════════════════════════════════
   THE RULE
   ═══════════════════════════════════════════════════════════════════════════ */

describe('local eviction is not a server delete', () => {
  it('enqueues nothing when it evicts', async () => {
    await replica('old-1', 200)
    await replica('old-2', 300)
    await replica('old-3', 400)

    const report = await gc()

    expect(report.evicted).toBe(3)
    // The assertion that matters. A single queued mutation here would mean the
    // server had been told to destroy three invoices.
    expect(await storage.listOutbox(WS)).toHaveLength(0)
  })

  it('evicts by removing the local row, never by queueing a delete', async () => {
    await replica('gone', 500)
    await gc()

    expect(await storage.getEntity(WS, 'invoice', 'gone')).toBeNull()

    const outbox = await storage.listOutbox(WS)
    expect(outbox.filter((r) => r.operation === 'delete')).toHaveLength(0)
  })

  it('leaves the cursor alone, so eviction cannot cause a re-pull storm', async () => {
    await storage.applyPullAtomically(WS, [], 4242)
    await replica('old', 500)

    await gc()

    expect(await storage.getCursor(WS)).toBe(4242)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Guards
   ═══════════════════════════════════════════════════════════════════════════ */

describe('what the collector refuses to touch', () => {
  it('keeps a row that a queued mutation still refers to', async () => {
    const { entityId } = await mutateLocal({
      storage,
      workspaceId: WS,
      entityType: 'invoice',
      operation: 'create',
      payload: { total: 999 },
      now: () => NOW - 500 * DAY, // old enough to be eligible on age alone
    })

    const report = await gc()

    expect(await storage.getEntity(WS, 'invoice', entityId)).not.toBeNull()
    expect(report.protectedByOutbox).toBeGreaterThan(0)
    expect(report.evicted).toBe(0)
  })

  it('keeps a row whose local edit has not been acknowledged', async () => {
    await storage.putEntity({
      id: 'unsent',
      workspaceId: WS,
      entityType: 'invoice',
      data: { id: 'unsent', total: 1, updated_at: new Date(NOW - 900 * DAY).toISOString() },
      version: 2,
      // A local change the user made that has not reached the server.
      pending: true,
      updatedAt: NOW - 900 * DAY,
    })

    const report = await gc()

    expect(await storage.getEntity(WS, 'invoice', 'unsent')).not.toBeNull()
    expect(report.protectedByPending).toBe(1)
  })

  it('keeps a row that has never synced — there is no server copy to refetch', async () => {
    await storage.putEntity({
      id: 'local-only',
      workspaceId: WS,
      entityType: 'invoice',
      data: { id: 'local-only', updated_at: new Date(NOW - 999 * DAY).toISOString() },
      // version 0 means the server has never seen it. Evicting would destroy
      // the only copy in existence.
      version: 0,
      pending: false,
      updatedAt: NOW - 999 * DAY,
    })

    await gc()

    expect(await storage.getEntity(WS, 'invoice', 'local-only')).not.toBeNull()
  })

  it('keeps a row referenced by a FAILED mutation the user has not resolved', async () => {
    const { entityId, mutationId } = await mutateLocal({
      storage,
      workspaceId: WS,
      entityType: 'invoice',
      operation: 'update',
      payload: { total: 5 },
      now: () => NOW - 800 * DAY,
    })

    await storage.updateOutbox(mutationId, { status: 'failed' })

    await gc()

    // A failed mutation is a decision the user still has to make. Evicting the
    // row would leave them resolving it against nothing.
    expect(await storage.getEntity(WS, 'invoice', entityId)).not.toBeNull()
  })

  it('keeps a row referenced by a CONFLICTED mutation', async () => {
    const { entityId, mutationId } = await mutateLocal({
      storage,
      workspaceId: WS,
      entityType: 'invoice',
      operation: 'update',
      payload: { total: 5 },
      now: () => NOW - 800 * DAY,
    })

    await storage.updateOutbox(mutationId, { status: 'conflict' })
    await gc()

    expect(await storage.getEntity(WS, 'invoice', entityId)).not.toBeNull()
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Retention
   ═══════════════════════════════════════════════════════════════════════════ */

describe('retention policy', () => {
  it('keeps the recent working set so the app stays useful offline', async () => {
    await replica('yesterday', 1)
    await replica('last-month', 30)
    await replica('last-quarter', 89)
    await replica('ancient', 400)

    await gc()

    expect(await storage.getEntity(WS, 'invoice', 'yesterday')).not.toBeNull()
    expect(await storage.getEntity(WS, 'invoice', 'last-month')).not.toBeNull()
    expect(await storage.getEntity(WS, 'invoice', 'last-quarter')).not.toBeNull()
    expect(await storage.getEntity(WS, 'invoice', 'ancient')).toBeNull()
  })

  it('caps how many rows stay resident even inside the window', async () => {
    for (let i = 0; i < 12; i += 1) await replica(`inv-${i}`, i)

    await gc({ retention: { invoice: { keepDays: 3650, maxRows: 5 } } })

    const left = await storage.listEntities(WS, 'invoice')
    expect(left).toHaveLength(5)
    // The newest survive; the oldest are the ones that go.
    expect(left.map((e) => e.id).sort()).toEqual(['inv-0', 'inv-1', 'inv-2', 'inv-3', 'inv-4'])
  })

  it('barely evicts customers and products, which are small and always needed', async () => {
    await replica('cust', 1000, 'customer')
    await replica('prod', 1000, 'product')

    await gc()

    expect(await storage.getEntity(WS, 'customer', 'cust')).not.toBeNull()
    expect(await storage.getEntity(WS, 'product', 'prod')).not.toBeNull()
    expect(DEFAULT_RETENTION.customer.keepDays).toBeGreaterThan(365)
  })

  it('reports what it did, per type', async () => {
    await replica('a', 500)
    await replica('b', 500)
    await replica('t', 500, 'transaction')

    const report = await gc()

    expect(report.perType.invoice).toBe(2)
    expect(report.perType.transaction).toBe(1)
    expect(report.scanned).toBeGreaterThanOrEqual(3)
  })

  it('does not touch another workspace', async () => {
    await replica('mine', 500)
    await storage.putEntity({
      id: 'theirs',
      workspaceId: 'workspace-2',
      entityType: 'invoice',
      data: { id: 'theirs', updated_at: new Date(NOW - 500 * DAY).toISOString() },
      version: 1,
      pending: false,
      updatedAt: NOW - 500 * DAY,
    })

    await gc()

    expect(await storage.getEntity(WS, 'invoice', 'mine')).toBeNull()
    expect(await storage.getEntity('workspace-2', 'invoice', 'theirs')).not.toBeNull()
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Hydration — what makes eviction invisible
   ═══════════════════════════════════════════════════════════════════════════ */

describe('targeted hydration', () => {
  const source: HydrationSource = {
    async fetchEntities(_type, ids) {
      return ids.map((id) => ({ id, data: { id, total: 777 }, version: 9 }))
    },
  }

  it('fetches back a row that was evicted', async () => {
    await replica('archived', 500)
    await gc()
    expect(await storage.getEntity(WS, 'invoice', 'archived')).toBeNull()

    const rows = await hydrateEntities(storage, source, WS, 'invoice', ['archived'])

    expect(rows).toHaveLength(1)
    expect(rows[0]?.data).toMatchObject({ total: 777 })
    // And it is resident again, so a second read costs nothing.
    expect(await storage.getEntity(WS, 'invoice', 'archived')).not.toBeNull()
  })

  it('only fetches what is missing', async () => {
    await replica('resident', 1)

    let requested: string[] = []
    const counting: HydrationSource = {
      async fetchEntities(_type, ids) {
        requested = ids
        return ids.map((id) => ({ id, data: { id }, version: 1 }))
      },
    }

    await hydrateEntities(storage, counting, WS, 'invoice', ['resident', 'absent'])

    expect(requested).toEqual(['absent'])
  })

  it('makes no request at all when everything is resident', async () => {
    await replica('a', 1)
    await replica('b', 2)

    let called = false
    const never: HydrationSource = {
      async fetchEntities() {
        called = true
        return []
      },
    }

    await hydrateEntities(storage, never, WS, 'invoice', ['a', 'b'])
    expect(called).toBe(false)
  })

  it('stores hydrated rows as replicas, so they can be evicted again', async () => {
    await hydrateEntities(storage, source, WS, 'invoice', ['fetched'])

    const entity = await storage.getEntity(WS, 'invoice', 'fetched')
    // Not `pending`: it came from the server unmodified, so it is a replica
    // and not a local edit awaiting a push.
    expect(entity?.pending).toBe(false)
    expect(entity?.version).toBe(9)
  })

  it('a hydrate/evict cycle never enqueues anything', async () => {
    await hydrateEntities(storage, source, WS, 'invoice', ['x', 'y'])
    await gc({ retention: { invoice: { keepDays: 0, maxRows: 0 } } })

    expect(await storage.listOutbox(WS)).toHaveLength(0)
  })
})
