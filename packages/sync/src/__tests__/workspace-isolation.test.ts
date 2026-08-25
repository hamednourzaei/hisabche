// ============================================
// Local-store workspace isolation.
//
// One device, two businesses. A shopkeeper who does the books for their own
// shop and their brother's signs into both from the same laptop, so both
// workspaces' data lives in the same IndexedDB at the same time.
//
// Everything below is about that overlap. The server-side boundary is enforced
// in the backend and in RLS; this file pins the LOCAL one, which nothing else
// checks — a leak here needs no network at all, and shows the wrong shop's
// invoices in an offline list.
//
// The adapter is the memory one because the property is about key scoping, not
// about IndexedDB. `indexeddb-adapter.ts` derives its keys with the same
// `workspace:type:id` shape and its own transactional tests live elsewhere.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'

import { SyncEngine } from '../engine'
import { MemoryStorageAdapter } from '../memory-adapter'
import { mutateLocal } from '../mutations'
import type { PushOutcome, Transport } from '../types'

const WS_A = 'workspace-a'
const WS_B = 'workspace-b'

const DEVICE = 'shared-laptop'

/* ── A transport that records which workspace asked ─────────────────────── */

class RecordingTransport implements Transport {
  pushedMutationIds: string[] = []
  pullCursors: number[] = []
  private sequence = 0

  async push(
    _batchId: string,
    _deviceId: string,
    mutations: Array<{ mutationId: string; entityId: string; payload: Record<string, unknown> }>,
  ): Promise<{ results: PushOutcome[]; currentCursor: number }> {
    const results: PushOutcome[] = []

    for (const mutation of mutations) {
      this.pushedMutationIds.push(mutation.mutationId)
      this.sequence += 1
      results.push({
        mutationId: mutation.mutationId,
        status: 'applied',
        entityVersion: 1,
        duplicate: false,
        retryable: false,
      })
    }

    return { results, currentCursor: this.sequence }
  }

  async pull(cursor: number, _limit: number) {
    this.pullCursors.push(cursor)
    return { changes: [], nextCursor: cursor, hasMore: false, mustRehydrate: false }
  }
}

let storage: MemoryStorageAdapter

function engineFor(workspaceId: string, transport: Transport) {
  return new SyncEngine({
    workspaceId,
    deviceId: DEVICE,
    storage,
    transport,
    debounceMs: 0,
    maxIntervalMs: 1_000_000,
    isOnline: () => true,
  })
}

function makeInvoice(workspaceId: string, total: number) {
  return mutateLocal({
    storage,
    workspaceId,
    entityType: 'invoice',
    operation: 'create',
    payload: { total, currency: 'AFN' },
  })
}

beforeEach(() => {
  storage = new MemoryStorageAdapter()
})

/* ═══════════════════════════════════════════════════════════════════════════
   Entities
   ═══════════════════════════════════════════════════════════════════════════ */

describe('two workspaces share a device without sharing data', () => {
  it('lists only its own entities', async () => {
    await makeInvoice(WS_A, 100)
    await makeInvoice(WS_A, 200)
    await makeInvoice(WS_B, 999)

    const a = await storage.listEntities(WS_A, 'invoice')
    const b = await storage.listEntities(WS_B, 'invoice')

    expect(a.map((e) => e.data.total).sort()).toEqual([100, 200])
    expect(b.map((e) => e.data.total)).toEqual([999])
  })

  it('cannot read a foreign entity by its id', async () => {
    const { entityId } = await makeInvoice(WS_B, 999)

    // The id is real and the row is in the same database. Only the workspace
    // in the key stops it coming back.
    expect(await storage.getEntity(WS_A, 'invoice', entityId)).toBeNull()
    expect(await storage.getEntity(WS_B, 'invoice', entityId)).not.toBeNull()
  })

  it('cannot delete a foreign entity by its id', async () => {
    const { entityId } = await makeInvoice(WS_B, 999)

    await storage.deleteEntity(WS_A, 'invoice', entityId)

    expect(await storage.getEntity(WS_B, 'invoice', entityId)).not.toBeNull()
  })

  it('keeps identical ids in two workspaces apart', async () => {
    // Ids are client-generated, so a collision is not impossible — and a
    // restored backup or a shared fixture makes it likely.
    const shared = 'same-id-in-both'

    await storage.putEntity({
      id: shared,
      workspaceId: WS_A,
      entityType: 'invoice',
      data: { total: 1 },
      version: 1,
      pending: false,
      updatedAt: 1,
    })
    await storage.putEntity({
      id: shared,
      workspaceId: WS_B,
      entityType: 'invoice',
      data: { total: 2 },
      version: 1,
      pending: false,
      updatedAt: 1,
    })

    expect((await storage.getEntity(WS_A, 'invoice', shared))?.data.total).toBe(1)
    expect((await storage.getEntity(WS_B, 'invoice', shared))?.data.total).toBe(2)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Outbox
   ═══════════════════════════════════════════════════════════════════════════ */

describe('the outbox never crosses workspaces', () => {
  it('lists only its own pending mutations', async () => {
    await makeInvoice(WS_A, 100)
    await makeInvoice(WS_B, 999)

    expect(await storage.listOutbox(WS_A)).toHaveLength(1)
    expect(await storage.listOutbox(WS_B)).toHaveLength(1)
  })

  it('claims only its own work to send', async () => {
    await makeInvoice(WS_A, 100)
    await makeInvoice(WS_B, 999)

    const claimed = await storage.claimSendable(WS_A, 50, Date.now())

    expect(claimed).toHaveLength(1)
    expect(claimed.every((r) => r.workspaceId === WS_A)).toBe(true)
  })

  it("a workspace's sync never pushes another workspace's mutations", async () => {
    // The real failure this guards: B's invoice sent on A's connection would
    // arrive at the server stamped with A's authorized workspace and land in
    // the wrong book.
    const { mutationId: idA } = await makeInvoice(WS_A, 100)
    const { mutationId: idB } = await makeInvoice(WS_B, 999)

    const transport = new RecordingTransport()
    await engineFor(WS_A, transport).run('test')

    expect(transport.pushedMutationIds).toEqual([idA])
    expect(transport.pushedMutationIds).not.toContain(idB)

    // B's mutation is untouched and still queued for B's own sync.
    expect(await storage.listOutbox(WS_B)).toHaveLength(1)
  })

  it('recovering in-flight work touches only its own records', async () => {
    await makeInvoice(WS_A, 100)
    const { mutationId: idB } = await makeInvoice(WS_B, 999)

    await storage.updateOutbox(idB, { status: 'in_flight' })

    const recovered = await storage.recoverInFlight(WS_A)

    // A crash during A's sync must not reset B's in-flight record — that would
    // resend a mutation B's own engine still believes it owns.
    expect(recovered).toBe(0)
    expect((await storage.listOutbox(WS_B))[0]?.status).toBe('in_flight')
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Cursor
   ═══════════════════════════════════════════════════════════════════════════ */

describe('each workspace keeps its own cursor', () => {
  it('starts every workspace at zero independently', async () => {
    expect(await storage.getCursor(WS_A)).toBe(0)
    expect(await storage.getCursor(WS_B)).toBe(0)
  })

  it('advancing one does not advance the other', async () => {
    await storage.applyPullAtomically(WS_A, [], 42)

    expect(await storage.getCursor(WS_A)).toBe(42)
    // A shared cursor would make B skip every change below 42 — a permanent,
    // silent hole in the other shop's books.
    expect(await storage.getCursor(WS_B)).toBe(0)
  })

  it('pulls from its own cursor, not the other workspace-s', async () => {
    await storage.applyPullAtomically(WS_A, [], 42)

    const transport = new RecordingTransport()
    await engineFor(WS_B, transport).run('test')

    expect(transport.pullCursors).toEqual([0])
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   Applying a delta
   ═══════════════════════════════════════════════════════════════════════════ */

describe('a pulled change lands in the workspace that pulled it', () => {
  it('writes the entity under the pulling workspace', async () => {
    await storage.applyPullAtomically(
      WS_A,
      [
        {
          syncVersion: 1,
          entityType: 'invoice',
          entityId: 'pulled-1',
          operation: 'create',
          entityVersion: 1,
          data: { id: 'pulled-1', total: 500 },
        },
      ],
      1,
    )

    expect(await storage.getEntity(WS_A, 'invoice', 'pulled-1')).not.toBeNull()
    expect(await storage.getEntity(WS_B, 'invoice', 'pulled-1')).toBeNull()
  })

  it('does not overwrite a same-id entity in the other workspace', async () => {
    await storage.putEntity({
      id: 'shared-id',
      workspaceId: WS_B,
      entityType: 'invoice',
      data: { total: 999 },
      version: 7,
      pending: false,
      updatedAt: 1,
    })

    await storage.applyPullAtomically(
      WS_A,
      [
        {
          syncVersion: 1,
          entityType: 'invoice',
          entityId: 'shared-id',
          operation: 'update',
          entityVersion: 2,
          data: { id: 'shared-id', total: 1 },
        },
      ],
      1,
    )

    expect((await storage.getEntity(WS_B, 'invoice', 'shared-id'))?.data.total).toBe(999)
    expect((await storage.getEntity(WS_A, 'invoice', 'shared-id'))?.data.total).toBe(1)
  })
})
