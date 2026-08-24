// ============================================
// packages/sync/src/memory-adapter.ts
//
// The reference StorageAdapter.
//
// It exists for two reasons, in this order:
//
//   1. It is the executable specification of what an adapter must do. The
//      IndexedDB and SQLite adapters are read against this one, and the
//      crash-recovery tests run against it because a fake that can be killed
//      at an arbitrary instruction is the only way to test a crash.
//
//   2. It is a usable fallback where nothing durable exists (SSR, a private
//      window with storage disabled). It is NOT durable, and says so.
// ============================================

import type { SyncChange, SyncEntity } from '@hisabche/validation'

import type { LocalEntity, OutboxRecord, StorageAdapter } from './types'

function key(workspaceId: string, type: SyncEntity, id: string): string {
  return `${workspaceId}:${type}:${id}`
}

export class MemoryStorageAdapter implements StorageAdapter {
  private entities = new Map<string, LocalEntity>()
  private outbox = new Map<string, OutboxRecord>()
  private cursors = new Map<string, number>()

  /**
   * Set by a test to abort partway through `applyPullAtomically`.
   *
   * Simulating a crash needs a way to stop mid-transaction; a real adapter has
   * no such hook because the database provides the same guarantee for real.
   */
  crashDuringApply: ((change: SyncChange, index: number) => boolean) | null = null

  async getEntity(workspaceId: string, type: SyncEntity, id: string): Promise<LocalEntity | null> {
    return this.entities.get(key(workspaceId, type, id)) ?? null
  }

  async listEntities(workspaceId: string, type: SyncEntity): Promise<LocalEntity[]> {
    return [...this.entities.values()].filter(
      (e) => e.workspaceId === workspaceId && e.entityType === type,
    )
  }

  async putEntity(entity: LocalEntity): Promise<void> {
    this.entities.set(key(entity.workspaceId, entity.entityType, entity.id), { ...entity })
  }

  async deleteEntity(workspaceId: string, type: SyncEntity, id: string): Promise<void> {
    this.entities.delete(key(workspaceId, type, id))
  }

  async enqueue(entity: LocalEntity, record: OutboxRecord): Promise<void> {
    // Atomic here because the map writes cannot interleave. A real adapter
    // must use an actual transaction spanning both stores.
    this.entities.set(key(entity.workspaceId, entity.entityType, entity.id), { ...entity })
    this.outbox.set(record.mutationId, { ...record })
  }

  async claimSendable(workspaceId: string, limit: number, now: number): Promise<OutboxRecord[]> {
    return (
      [...this.outbox.values()]
        .filter((r) => r.workspaceId === workspaceId)
        .filter(
          (r) => r.status === 'pending' || (r.status === 'retry' && (r.nextRetryAt ?? 0) <= now),
        )
        // Oldest first: mutations often depend on earlier ones (a customer, then
        // an invoice referencing it), and the client created them in order.
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, limit)
        .map((r) => ({ ...r }))
    )
  }

  async updateOutbox(mutationId: string, patch: Partial<OutboxRecord>): Promise<void> {
    const existing = this.outbox.get(mutationId)
    if (!existing) return
    this.outbox.set(mutationId, { ...existing, ...patch })
  }

  async removeOutbox(mutationId: string): Promise<void> {
    this.outbox.delete(mutationId)
  }

  async listOutbox(workspaceId: string): Promise<OutboxRecord[]> {
    return [...this.outbox.values()]
      .filter((r) => r.workspaceId === workspaceId)
      .map((r) => ({ ...r }))
  }

  async recoverInFlight(workspaceId: string): Promise<number> {
    let recovered = 0

    for (const [id, record] of this.outbox) {
      if (record.workspaceId !== workspaceId) continue

      // `in_flight` — the process died mid-push. Back to pending, NOT to
      // failed: we do not know whether the server received it, the stable
      // mutation_id makes resending harmless, and dropping it would silently
      // lose a financial mutation.
      if (record.status === 'in_flight') {
        this.outbox.set(id, { ...record, status: 'pending' })
        recovered += 1
        continue
      }

      // `retry` with a backoff deadline still in the future. A fresh process
      // start is new information — the user just reopened the app, and very
      // often the network came back with it. Waiting out a five-minute backoff
      // computed before the restart would strand their work for no reason.
      if (record.status === 'retry' && (record.nextRetryAt ?? 0) > Date.now()) {
        const { nextRetryAt: _cleared, ...rest } = record
        this.outbox.set(id, { ...rest, status: 'pending' })
        recovered += 1
      }
    }

    return recovered
  }

  async getCursor(workspaceId: string): Promise<number> {
    return this.cursors.get(workspaceId) ?? 0
  }

  async applyPullAtomically(
    workspaceId: string,
    changes: SyncChange[],
    nextCursor: number,
  ): Promise<void> {
    // Staged, then committed in one go. If anything throws before the commit,
    // neither the entities nor the cursor move — which is the property the
    // whole pull path rests on.
    const staged = new Map<string, LocalEntity | null>()

    for (const [index, change] of changes.entries()) {
      if (this.crashDuringApply?.(change, index)) {
        throw new Error('simulated crash during apply')
      }

      const entityKey = key(workspaceId, change.entityType, change.entityId)

      if (change.operation === 'delete' || change.data === null) {
        staged.set(entityKey, null)
        continue
      }

      const local = this.entities.get(entityKey)

      // A local edit that has not been acknowledged is newer than anything the
      // server can be telling us here, so it wins until it is pushed.
      if (local?.pending) continue

      staged.set(entityKey, {
        id: change.entityId,
        workspaceId,
        entityType: change.entityType,
        data: change.data,
        version: change.entityVersion,
        pending: false,
        updatedAt: Date.now(),
      })
    }

    for (const [entityKey, value] of staged) {
      if (value === null) this.entities.delete(entityKey)
      else this.entities.set(entityKey, value)
    }

    this.cursors.set(workspaceId, nextCursor)
  }

  async clearWorkspace(workspaceId: string): Promise<void> {
    for (const [k, entity] of [...this.entities]) {
      if (entity.workspaceId === workspaceId) this.entities.delete(k)
    }
    // The outbox deliberately survives: unpushed local mutations are not the
    // server's to invalidate, and a re-hydrate must not eat them.
    this.cursors.set(workspaceId, 0)
  }

  /** Test helper: drop everything, as a process restart would. */
  snapshot(): { entities: LocalEntity[]; outbox: OutboxRecord[]; cursors: [string, number][] } {
    return {
      entities: [...this.entities.values()],
      outbox: [...this.outbox.values()],
      cursors: [...this.cursors.entries()],
    }
  }

  /** Test helper: rebuild from a snapshot, as a restart from disk would. */
  restore(snapshot: ReturnType<MemoryStorageAdapter['snapshot']>): void {
    this.entities = new Map(
      snapshot.entities.map((e) => [key(e.workspaceId, e.entityType, e.id), e]),
    )
    this.outbox = new Map(snapshot.outbox.map((r) => [r.mutationId, r]))
    this.cursors = new Map(snapshot.cursors)
  }
}
