// ============================================
// Client sync engine — the failure matrix.
//
// Every test here is a scenario that happens in the field: a phone loses
// signal mid-push, a laptop is closed while a batch is in flight, a tab is
// killed halfway through applying a delta. The engine's job is that none of
// them loses a mutation or duplicates one.
//
// The transport is a controllable fake, because the interesting cases —
// "committed but the response was lost", "died between apply and cursor" —
// cannot be produced with a real HTTP client.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'

import { SyncEngine, backoffMs } from '../engine'
import { MemoryStorageAdapter } from '../memory-adapter'
import { mutateLocal, discardMutation } from '../mutations'
import type { PushOutcome, Transport } from '../types'

const WS = 'workspace-1'
const DEVICE = 'device-a'

/* ── A server that can be told to misbehave ─────────────────────────────── */

class FakeServer implements Transport {
  /** mutation_id → outcome, mimicking the server's idempotency ledger. */
  private ledger = new Map<string, PushOutcome>()
  private log: Array<{ syncVersion: number; entityId: string; data: Record<string, unknown> }> = []
  private sequence = 0

  pushCalls = 0
  receivedMutationIds: string[] = []

  /** Set to make the next push throw AFTER it has committed, like a lost response. */
  loseNextResponse = false
  /** Set to make the next push fail before committing anything. */
  failNextPush = false
  /** Forced outcome for a given mutation, for conflict scenarios. */
  forced = new Map<string, PushOutcome>()

  async push(
    _batchId: string,
    _deviceId: string,
    mutations: Array<{
      mutationId: string
      entityId: string
      payload: Record<string, unknown>
    }>,
  ): Promise<{ results: PushOutcome[]; currentCursor: number }> {
    this.pushCalls += 1

    if (this.failNextPush) {
      this.failNextPush = false
      throw new Error('network unreachable')
    }

    const results: PushOutcome[] = []

    for (const mutation of mutations) {
      this.receivedMutationIds.push(mutation.mutationId)

      const forced = this.forced.get(mutation.mutationId)
      if (forced) {
        results.push(forced)
        continue
      }

      // The idempotency ledger: a mutation_id already seen replays its result
      // instead of committing again.
      const seen = this.ledger.get(mutation.mutationId)
      if (seen) {
        results.push({ ...seen, duplicate: true })
        continue
      }

      this.sequence += 1
      this.log.push({
        syncVersion: this.sequence,
        entityId: mutation.entityId,
        data: { ...mutation.payload, id: mutation.entityId, version: 1 },
      })

      const outcome: PushOutcome = {
        mutationId: mutation.mutationId,
        status: 'applied',
        entityVersion: 1,
        duplicate: false,
        retryable: false,
      }

      this.ledger.set(mutation.mutationId, outcome)
      results.push(outcome)
    }

    if (this.loseNextResponse) {
      this.loseNextResponse = false
      // Committed above, then the wire died. The client never learns.
      throw new Error('connection reset after commit')
    }

    return { results, currentCursor: this.sequence }
  }

  async pull(cursor: number, limit: number) {
    const after = this.log.filter((e) => e.syncVersion > cursor)
    const page = after.slice(0, limit)

    return {
      changes: page.map((e) => ({
        syncVersion: e.syncVersion,
        entityType: 'invoice' as const,
        entityId: e.entityId,
        operation: 'create' as const,
        entityVersion: 1,
        data: e.data,
      })),
      nextCursor: page.length ? page[page.length - 1]!.syncVersion : cursor,
      hasMore: after.length > page.length,
      mustRehydrate: false,
    }
  }

  committedCount(entityId?: string): number {
    return entityId ? this.log.filter((e) => e.entityId === entityId).length : this.log.length
  }
}

function makeEngine(storage: MemoryStorageAdapter, server: FakeServer, online = true) {
  return new SyncEngine({
    workspaceId: WS,
    deviceId: DEVICE,
    storage,
    transport: server,
    debounceMs: 0,
    maxIntervalMs: 1_000_000, // no background ticks during a test
    isOnline: () => online,
  })
}

async function makeInvoice(storage: MemoryStorageAdapter, total: number) {
  return mutateLocal({
    storage,
    workspaceId: WS,
    entityType: 'invoice',
    operation: 'create',
    payload: { total, currency: 'IRR' },
  })
}

let storage: MemoryStorageAdapter
let server: FakeServer

beforeEach(() => {
  storage = new MemoryStorageAdapter()
  server = new FakeServer()
})

/* ═══════════════════════════════════════════════════════════════════════════
   Local-first writes
   ═══════════════════════════════════════════════════════════════════════════ */

describe('a mutation is durable before it is sent', () => {
  it('writes the entity and the outbox record together', async () => {
    const { mutationId, entityId } = await makeInvoice(storage, 500)

    const entity = await storage.getEntity(WS, 'invoice', entityId)
    const outbox = await storage.listOutbox(WS)

    expect(entity?.data).toMatchObject({ total: 500 })
    expect(entity?.pending).toBe(true)
    expect(outbox).toHaveLength(1)
    expect(outbox[0]?.mutationId).toBe(mutationId)
    expect(outbox[0]?.status).toBe('pending')
  })

  it('is readable immediately, with no network involved', async () => {
    const { entityId } = await makeInvoice(storage, 42)
    // Nothing has been pushed; the UI can already render this.
    expect(server.pushCalls).toBe(0)
    expect(await storage.getEntity(WS, 'invoice', entityId)).not.toBeNull()
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Idempotency
   ═══════════════════════════════════════════════════════════════════════════ */

describe('a retry never duplicates a financial effect', () => {
  it('does not create a second invoice when the response is lost', async () => {
    const { entityId } = await makeInvoice(storage, 1000)

    // The server commits, then the connection dies before the client hears.
    server.loseNextResponse = true
    const engine = makeEngine(storage, server)
    await engine.run('first')

    // The mutation is still queued — from the client's side it never landed.
    const outbox = await storage.listOutbox(WS)
    expect(outbox[0]?.status).toBe('retry')

    // Retry: same mutation_id, so the ledger replays instead of committing.
    await storage.updateOutbox(outbox[0]!.mutationId, { status: 'pending' })
    await engine.run('retry')

    expect(server.committedCount(entityId)).toBe(1)
    expect(await storage.listOutbox(WS)).toHaveLength(0)
  })

  it('reuses the same mutation id across every attempt', async () => {
    const { mutationId } = await makeInvoice(storage, 10)

    server.failNextPush = true
    const engine = makeEngine(storage, server)
    await engine.run('attempt-1')

    const record = (await storage.listOutbox(WS))[0]!
    await storage.updateOutbox(record.mutationId, { status: 'pending' })
    await engine.run('attempt-2')

    // Regenerating the id on retry is exactly how a lost response becomes a
    // second invoice, so it must be stable.
    expect(new Set(server.receivedMutationIds)).toEqual(new Set([mutationId]))
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Crash recovery
   ═══════════════════════════════════════════════════════════════════════════ */

describe('crash recovery', () => {
  it('keeps a mutation that was written but never pushed', async () => {
    await makeInvoice(storage, 300)

    // Process dies here. Restart from what was on disk.
    const disk = storage.snapshot()
    const revived = new MemoryStorageAdapter()
    revived.restore(disk)

    const engine = makeEngine(revived, server)
    await engine.start()

    expect(server.committedCount()).toBe(1)
    expect(await revived.listOutbox(WS)).toHaveLength(0)
  })

  it('recovers a mutation left in_flight by a crash mid-push', async () => {
    const { mutationId } = await makeInvoice(storage, 700)

    // Simulate dying between "marked in_flight" and "response handled".
    await storage.updateOutbox(mutationId, { status: 'in_flight', attemptCount: 1 })

    const disk = storage.snapshot()
    const revived = new MemoryStorageAdapter()
    revived.restore(disk)

    // Before recovery it is stranded: nothing would ever pick it up.
    expect(await revived.claimSendable(WS, 10, Date.now())).toHaveLength(0)

    const recovered = await revived.recoverInFlight(WS)
    expect(recovered).toBe(1)
    expect(await revived.claimSendable(WS, 10, Date.now())).toHaveLength(1)
  })

  it('does not lose the mutation when the crash happened after the server committed', async () => {
    const { entityId } = await makeInvoice(storage, 900)

    server.loseNextResponse = true
    const engine = makeEngine(storage, server)
    await engine.run('push')

    // Restart, recover, resend. The ledger makes the resend a no-op.
    const revived = new MemoryStorageAdapter()
    revived.restore(storage.snapshot())

    const engine2 = makeEngine(revived, server)
    await engine2.start()

    expect(server.committedCount(entityId)).toBe(1)
    expect(await revived.listOutbox(WS)).toHaveLength(0)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Cursor safety
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the cursor never runs ahead of the data', () => {
  it('does not advance when applying a delta throws partway', async () => {
    await makeInvoice(storage, 1)
    await makeInvoice(storage, 2)
    await makeInvoice(storage, 3)

    const pusher = makeEngine(storage, server)
    await pusher.run('seed')

    // A fresh client pulling that history, dying on the second change.
    const fresh = new MemoryStorageAdapter()
    fresh.crashDuringApply = (_change, index) => index === 1

    const engine = makeEngine(fresh, server)
    await engine.run('pull').catch(() => {})

    // Neither the entities nor the cursor moved.
    expect(await fresh.getCursor(WS)).toBe(0)
    expect(await fresh.listEntities(WS, 'invoice')).toHaveLength(0)
  })

  it('replays the same page successfully once the crash condition clears', async () => {
    await makeInvoice(storage, 1)
    await makeInvoice(storage, 2)
    await makeEngine(storage, server).run('seed')

    const fresh = new MemoryStorageAdapter()
    fresh.crashDuringApply = (_c, i) => i === 1

    const engine = makeEngine(fresh, server)
    await engine.run('crashing-pull').catch(() => {})

    fresh.crashDuringApply = null
    await engine.run('recovered-pull')

    expect(await fresh.listEntities(WS, 'invoice')).toHaveLength(2)
    expect(await fresh.getCursor(WS)).toBeGreaterThan(0)
  })

  it('walks a multi-page history without gaps or repeats', async () => {
    for (let i = 0; i < 7; i += 1) await makeInvoice(storage, i)
    await makeEngine(storage, server).run('seed')

    const fresh = new MemoryStorageAdapter()
    const engine = new SyncEngine({
      workspaceId: WS,
      deviceId: 'device-b',
      storage: fresh,
      transport: server,
      pullLimit: 2, // force pagination
      debounceMs: 0,
      maxIntervalMs: 1_000_000,
    })

    await engine.run('pull')

    expect(await fresh.listEntities(WS, 'invoice')).toHaveLength(7)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Offline
   ═══════════════════════════════════════════════════════════════════════════ */

describe('offline', () => {
  it('accepts mutations while offline and pushes them on reconnect', async () => {
    let online = false

    const engine = new SyncEngine({
      workspaceId: WS,
      deviceId: DEVICE,
      storage,
      transport: server,
      debounceMs: 0,
      maxIntervalMs: 1_000_000,
      isOnline: () => online,
    })

    await makeInvoice(storage, 11)
    await makeInvoice(storage, 22)

    await engine.run('while-offline')
    expect(server.pushCalls).toBe(0)
    expect(engine.getState().phase).toBe('offline')

    online = true
    engine.wake('reconnect')
    await new Promise((r) => setTimeout(r, 0))

    expect(server.committedCount()).toBe(2)
  })

  it('holds the queue through a long outage without dropping anything', async () => {
    for (let i = 0; i < 20; i += 1) await makeInvoice(storage, i)

    server.failNextPush = true
    const engine = makeEngine(storage, server)
    await engine.run('outage').catch(() => {})

    const queued = await storage.listOutbox(WS)
    expect(queued).toHaveLength(20)
    // Every one is scheduled for another attempt, none discarded.
    expect(queued.every((r) => r.status === 'retry')).toBe(true)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Conflicts
   ═══════════════════════════════════════════════════════════════════════════ */

describe('conflicts', () => {
  it('parks a stale write instead of retrying or discarding it', async () => {
    const { entityId } = await makeInvoice(storage, 100)
    await makeEngine(storage, server).run('create')

    const update = await mutateLocal({
      storage,
      workspaceId: WS,
      entityType: 'invoice',
      entityId,
      operation: 'update',
      payload: { total: 200 },
      expectedVersion: 1,
    })

    server.forced.set(update.mutationId, {
      mutationId: update.mutationId,
      status: 'rejected',
      duplicate: false,
      errorCode: 'version_conflict',
      errorMessage: 'stale',
      retryable: false,
      serverState: { id: entityId, total: 555, version: 9 },
    })

    const engine = makeEngine(storage, server)
    await engine.run('conflicting')

    const outbox = await storage.listOutbox(WS)
    expect(outbox[0]?.status).toBe('conflict')

    // The server's row is now local, so a human can compare the two.
    const entity = await storage.getEntity(WS, 'invoice', entityId)
    expect(entity?.data).toMatchObject({ total: 555 })
    expect(entity?.version).toBe(9)
  })

  it('lets the user discard a conflicted mutation explicitly', async () => {
    const { entityId } = await makeInvoice(storage, 100)
    await makeEngine(storage, server).run('create')

    const update = await mutateLocal({
      storage,
      workspaceId: WS,
      entityType: 'invoice',
      entityId,
      operation: 'update',
      payload: { total: 200 },
      expectedVersion: 1,
    })

    server.forced.set(update.mutationId, {
      mutationId: update.mutationId,
      status: 'rejected',
      duplicate: false,
      errorCode: 'version_conflict',
      retryable: false,
    })

    await makeEngine(storage, server).run('conflicting')
    await discardMutation(storage, WS, update.mutationId)

    expect(await storage.listOutbox(WS)).toHaveLength(0)
    expect((await storage.getEntity(WS, 'invoice', entityId))?.pending).toBe(false)
  })

  it('keeps a permanently rejected mutation visible rather than deleting it', async () => {
    const { mutationId } = await makeInvoice(storage, 100)

    server.forced.set(mutationId, {
      mutationId,
      status: 'rejected',
      duplicate: false,
      errorCode: 'validation_failed',
      errorMessage: 'total must be positive',
      retryable: false,
    })

    const engine = makeEngine(storage, server)
    await engine.run('rejected')

    const outbox = await storage.listOutbox(WS)
    // Silently dropping it would lose a mutation the user made.
    expect(outbox[0]?.status).toBe('failed')
    expect(engine.getState().failedCount).toBe(1)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Retry policy
   ═══════════════════════════════════════════════════════════════════════════ */

describe('retry policy', () => {
  it('backs off exponentially and stays within a ceiling', () => {
    const fixed = () => 0.5 // remove jitter for a deterministic assertion
    expect(backoffMs(1, fixed)).toBe(750)
    expect(backoffMs(2, fixed)).toBe(1500)
    expect(backoffMs(3, fixed)).toBe(3000)
    expect(backoffMs(50, fixed)).toBeLessThanOrEqual(5 * 60_000)
  })

  it('spreads retries with jitter so clients do not stampede', () => {
    const samples = new Set(Array.from({ length: 40 }, () => backoffMs(5)))
    // Identical values across clients would mean a synchronised herd.
    expect(samples.size).toBeGreaterThan(20)
  })

  it('does not send a record before its backoff has elapsed', async () => {
    const { mutationId } = await makeInvoice(storage, 5)
    await storage.updateOutbox(mutationId, {
      status: 'retry',
      nextRetryAt: Date.now() + 60_000,
    })

    expect(await storage.claimSendable(WS, 10, Date.now())).toHaveLength(0)
    expect(await storage.claimSendable(WS, 10, Date.now() + 61_000)).toHaveLength(1)
  })

  it('gives up after the attempt ceiling instead of retrying forever', async () => {
    const { mutationId } = await makeInvoice(storage, 5)
    await storage.updateOutbox(mutationId, { attemptCount: 100 })

    server.failNextPush = true
    const engine = makeEngine(storage, server)
    await engine.run('doomed').catch(() => {})

    expect((await storage.listOutbox(WS))[0]?.status).toBe('failed')
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Ordering and batching
   ═══════════════════════════════════════════════════════════════════════════ */

describe('ordering and batching', () => {
  it('sends oldest first, so dependencies are created before their references', async () => {
    const first = await mutateLocal({
      storage,
      workspaceId: WS,
      entityType: 'customer',
      operation: 'create',
      payload: { name: 'Ali' },
      now: () => 1000,
    })
    const second = await mutateLocal({
      storage,
      workspaceId: WS,
      entityType: 'invoice',
      operation: 'create',
      payload: { customer_id: first.entityId },
      now: () => 2000,
    })

    await makeEngine(storage, server).run('ordered')

    expect(server.receivedMutationIds).toEqual([first.mutationId, second.mutationId])
  })

  it('splits a large queue into bounded batches', async () => {
    for (let i = 0; i < 12; i += 1) await makeInvoice(storage, i)

    const engine = new SyncEngine({
      workspaceId: WS,
      deviceId: DEVICE,
      storage,
      transport: server,
      batchSize: 5,
      debounceMs: 0,
      maxIntervalMs: 1_000_000,
    })

    await engine.run('batched')

    // 5 + 5 + 2 — never one unbounded request.
    expect(server.pushCalls).toBe(3)
    expect(server.committedCount()).toBe(12)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Multi-device convergence
   ═══════════════════════════════════════════════════════════════════════════ */

describe('two devices converge', () => {
  it('device B sees what device A created, with no realtime involved', async () => {
    const deviceA = new MemoryStorageAdapter()
    const deviceB = new MemoryStorageAdapter()

    await mutateLocal({
      storage: deviceA,
      workspaceId: WS,
      entityType: 'invoice',
      operation: 'create',
      payload: { total: 12345, currency: 'IRR' },
    })

    await makeEngine(deviceA, server).run('A pushes')

    const engineB = new SyncEngine({
      workspaceId: WS,
      deviceId: 'device-b',
      storage: deviceB,
      transport: server,
      debounceMs: 0,
      maxIntervalMs: 1_000_000,
    })
    await engineB.run('B pulls')

    const onB = await deviceB.listEntities(WS, 'invoice')
    expect(onB).toHaveLength(1)
    expect(onB[0]?.data).toMatchObject({ total: 12345 })
  })

  it('a local unpushed edit is not clobbered by an older server row', async () => {
    const { entityId } = await makeInvoice(storage, 100)
    await makeEngine(storage, server).run('create')

    // A local edit that has not been pushed yet.
    await mutateLocal({
      storage,
      workspaceId: WS,
      entityType: 'invoice',
      entityId,
      operation: 'update',
      payload: { total: 999 },
      expectedVersion: 1,
    })

    // A pull arrives carrying the pre-edit row.
    await storage.applyPullAtomically(
      WS,
      [
        {
          syncVersion: 99,
          entityType: 'invoice',
          entityId,
          operation: 'update',
          entityVersion: 1,
          data: { id: entityId, total: 100, version: 1 },
        },
      ],
      99,
    )

    // The unpushed local value survives until it is acknowledged.
    expect((await storage.getEntity(WS, 'invoice', entityId))?.data).toMatchObject({ total: 999 })
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Observable state
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the engine reports what the user needs to see', () => {
  it('counts unacknowledged mutations', async () => {
    await makeInvoice(storage, 1)
    await makeInvoice(storage, 2)

    const engine = makeEngine(storage, server)
    const seen: number[] = []
    engine.subscribe((s) => seen.push(s.pendingCount))

    server.failNextPush = true
    await engine.run('fails').catch(() => {})

    expect(engine.getState().pendingCount).toBe(2)
    expect(seen.length).toBeGreaterThan(0)
  })

  it('a throwing subscriber cannot stop the engine', async () => {
    const engine = makeEngine(storage, server)
    engine.subscribe(() => {
      throw new Error('bad subscriber')
    })

    await makeInvoice(storage, 1)
    await expect(engine.run('resilient')).resolves.toBeUndefined()
    expect(server.committedCount()).toBe(1)
  })

  it('coalesces overlapping runs rather than racing them', async () => {
    await makeInvoice(storage, 1)
    const engine = makeEngine(storage, server)

    await Promise.all([engine.run('a'), engine.run('b'), engine.run('c')])
    await new Promise((r) => setTimeout(r, 0))

    expect(server.committedCount()).toBe(1)
  })
})
