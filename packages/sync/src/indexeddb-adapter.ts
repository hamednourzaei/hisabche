// ============================================
// packages/sync/src/indexeddb-adapter.ts
//
// The web StorageAdapter. Durable, transactional, no dependencies.
//
// WHY RAW IndexedDB AND NOT A LIBRARY
//
// The adapter needs exactly one thing a wrapper tends to hide: a transaction
// that spans two object stores and commits atomically. `applyPullAtomically`
// must land the entity writes and the cursor together, and `enqueue` must land
// the entity and its outbox record together — a partial commit in either place
// silently loses financial data. Raw IDB gives that guarantee directly, in
// about 300 lines, against a browser API that has not changed in a decade. A
// wrapper would add a dependency, a bundle, and a layer between us and the
// only semantics that matter here.
//
// THE TRANSACTION RULE
//
// An IndexedDB transaction auto-commits as soon as its microtask queue drains
// without a pending request. So every store operation inside a transaction is
// issued synchronously from the same tick; `await`ing an unrelated promise
// mid-transaction would close it early and split what must be atomic.
// ============================================

import type { SyncChange, SyncEntity } from '@hisabche/validation'

import type { LocalEntity, OutboxRecord, StorageAdapter } from './types'

const DB_NAME = 'hisabche-local'
const DB_VERSION = 1

const STORE_ENTITIES = 'entities'
const STORE_OUTBOX = 'outbox'
const STORE_META = 'meta'

/** `workspace:type:id`, so a range scan can select a workspace's entities. */
function entityKey(workspaceId: string, type: SyncEntity, id: string): string {
  return `${workspaceId}:${type}:${id}`
}

function cursorKey(workspaceId: string): string {
  return `cursor:${workspaceId}`
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

/** Resolves when the transaction COMMITS, not when the last request returns. */
function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

export class IndexedDbStorageAdapter implements StorageAdapter {
  private db: IDBDatabase | null = null
  private opening: Promise<IDBDatabase> | null = null

  constructor(private readonly dbName: string = DB_NAME) {}

  /* ── schema ───────────────────────────────────────────────────────────── */

  private open(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db)
    if (this.opening) return this.opening

    this.opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result

        if (!db.objectStoreNames.contains(STORE_ENTITIES)) {
          const store = db.createObjectStore(STORE_ENTITIES, { keyPath: 'key' })
          // The index the list queries use. Without it, listing a workspace's
          // invoices is a full scan of every entity the user has ever synced.
          store.createIndex('by_workspace_type', ['workspaceId', 'entityType'], {
            unique: false,
          })
        }

        if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
          const store = db.createObjectStore(STORE_OUTBOX, { keyPath: 'mutationId' })
          store.createIndex('by_workspace', 'workspaceId', { unique: false })
          // Claiming sendable records filters on status and orders by age.
          store.createIndex('by_workspace_status', ['workspaceId', 'status'], {
            unique: false,
          })
        }

        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' })
        }
      }

      request.onsuccess = () => {
        const db = request.result

        // Another tab upgraded the schema. Close so it is not blocked; the
        // next call reopens against the new version.
        db.onversionchange = () => {
          db.close()
          this.db = null
          this.opening = null
        }

        this.db = db
        resolve(db)
      }

      request.onerror = () => reject(request.error ?? new Error('failed to open IndexedDB'))
      request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'))
    })

    return this.opening
  }

  private async tx(stores: string[], mode: IDBTransactionMode): Promise<IDBTransaction> {
    const db = await this.open()
    return db.transaction(stores, mode)
  }

  /* ── entities ─────────────────────────────────────────────────────────── */

  async getEntity(workspaceId: string, type: SyncEntity, id: string): Promise<LocalEntity | null> {
    const tx = await this.tx([STORE_ENTITIES], 'readonly')
    const row = await promisify<StoredEntity | undefined>(
      tx.objectStore(STORE_ENTITIES).get(entityKey(workspaceId, type, id)),
    )
    return row ? toEntity(row) : null
  }

  async listEntities(workspaceId: string, type: SyncEntity): Promise<LocalEntity[]> {
    const tx = await this.tx([STORE_ENTITIES], 'readonly')
    const index = tx.objectStore(STORE_ENTITIES).index('by_workspace_type')
    const rows = await promisify<StoredEntity[]>(
      index.getAll(IDBKeyRange.only([workspaceId, type])),
    )
    return rows.map(toEntity)
  }

  async putEntity(entity: LocalEntity): Promise<void> {
    const tx = await this.tx([STORE_ENTITIES], 'readwrite')
    tx.objectStore(STORE_ENTITIES).put(toStored(entity))
    await committed(tx)
  }

  async deleteEntity(workspaceId: string, type: SyncEntity, id: string): Promise<void> {
    const tx = await this.tx([STORE_ENTITIES], 'readwrite')
    tx.objectStore(STORE_ENTITIES).delete(entityKey(workspaceId, type, id))
    await committed(tx)
  }

  /* ── outbox ───────────────────────────────────────────────────────────── */

  /**
   * The local edit and its outbox record, in ONE transaction.
   *
   * Both writes are issued before any await, so the transaction cannot
   * auto-commit between them. Either the user's change and the instruction to
   * sync it both survive a crash, or neither does.
   */
  async enqueue(entity: LocalEntity, record: OutboxRecord): Promise<void> {
    const tx = await this.tx([STORE_ENTITIES, STORE_OUTBOX], 'readwrite')
    tx.objectStore(STORE_ENTITIES).put(toStored(entity))
    tx.objectStore(STORE_OUTBOX).put(record)
    await committed(tx)
  }

  async claimSendable(workspaceId: string, limit: number, now: number): Promise<OutboxRecord[]> {
    const tx = await this.tx([STORE_OUTBOX], 'readonly')
    const index = tx.objectStore(STORE_OUTBOX).index('by_workspace')
    const all = await promisify<OutboxRecord[]>(index.getAll(IDBKeyRange.only(workspaceId)))

    return (
      all
        .filter(
          (r) => r.status === 'pending' || (r.status === 'retry' && (r.nextRetryAt ?? 0) <= now),
        )
        // Oldest first: a batch often contains a customer and the invoice that
        // references it, and the client created them in that order.
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, limit)
    )
  }

  async updateOutbox(mutationId: string, patch: Partial<OutboxRecord>): Promise<void> {
    const tx = await this.tx([STORE_OUTBOX], 'readwrite')
    const store = tx.objectStore(STORE_OUTBOX)
    const existing = await promisify<OutboxRecord | undefined>(store.get(mutationId))
    if (!existing) return
    store.put({ ...existing, ...patch })
    await committed(tx)
  }

  async removeOutbox(mutationId: string): Promise<void> {
    const tx = await this.tx([STORE_OUTBOX], 'readwrite')
    tx.objectStore(STORE_OUTBOX).delete(mutationId)
    await committed(tx)
  }

  async listOutbox(workspaceId: string): Promise<OutboxRecord[]> {
    const tx = await this.tx([STORE_OUTBOX], 'readonly')
    const index = tx.objectStore(STORE_OUTBOX).index('by_workspace')
    return promisify<OutboxRecord[]>(index.getAll(IDBKeyRange.only(workspaceId)))
  }

  /**
   * Return stranded records to `pending`.
   *
   * `in_flight` means the tab died between sending and hearing back — the
   * mutation's fate is unknown, and the stable mutation_id makes resending
   * safe while dropping it would lose a financial change silently.
   *
   * A `retry` whose backoff has not elapsed is also released: a fresh page
   * load is new information, usually including a network that came back, and
   * making the user wait out a stale five-minute backoff strands their work.
   */
  async recoverInFlight(workspaceId: string): Promise<number> {
    const pending = await this.listOutbox(workspaceId)
    const now = Date.now()

    const stranded = pending.filter(
      (r) => r.status === 'in_flight' || (r.status === 'retry' && (r.nextRetryAt ?? 0) > now),
    )
    if (stranded.length === 0) return 0

    const tx = await this.tx([STORE_OUTBOX], 'readwrite')
    const store = tx.objectStore(STORE_OUTBOX)

    for (const record of stranded) {
      const { nextRetryAt: _cleared, ...rest } = record
      store.put({ ...rest, status: 'pending' as const })
    }

    await committed(tx)
    return stranded.length
  }

  /* ── cursor ───────────────────────────────────────────────────────────── */

  async getCursor(workspaceId: string): Promise<number> {
    const tx = await this.tx([STORE_META], 'readonly')
    const row = await promisify<{ key: string; value: number } | undefined>(
      tx.objectStore(STORE_META).get(cursorKey(workspaceId)),
    )
    return row?.value ?? 0
  }

  /**
   * Apply a delta page and advance the cursor atomically.
   *
   * The most important method in the file. Everything is read first, outside
   * the write transaction, so the writes themselves are issued back-to-back
   * with no intervening await — otherwise IndexedDB would commit the entity
   * writes and then the cursor separately, and a crash between them would
   * leave a cursor claiming changes that were never applied.
   */
  async applyPullAtomically(
    workspaceId: string,
    changes: SyncChange[],
    nextCursor: number,
  ): Promise<void> {
    // Phase 1 — read. Which local rows have unacknowledged edits?
    const read = await this.tx([STORE_ENTITIES], 'readonly')
    const entityStore = read.objectStore(STORE_ENTITIES)

    const existing = new Map<string, StoredEntity | undefined>()
    await Promise.all(
      changes.map(async (change) => {
        const key = entityKey(workspaceId, change.entityType, change.entityId)
        existing.set(key, await promisify<StoredEntity | undefined>(entityStore.get(key)))
      }),
    )

    // Phase 2 — decide, with no I/O involved.
    const writes: Array<{ key: string; value: StoredEntity | null }> = []

    for (const change of changes) {
      const key = entityKey(workspaceId, change.entityType, change.entityId)

      if (change.operation === 'delete' || change.data === null) {
        writes.push({ key, value: null })
        continue
      }

      // An unpushed local edit is newer than anything this pull can carry, so
      // it stands until the server acknowledges it.
      if (existing.get(key)?.pending) continue

      writes.push({
        key,
        value: {
          key,
          id: change.entityId,
          workspaceId,
          entityType: change.entityType,
          data: change.data,
          version: change.entityVersion,
          pending: false,
          updatedAt: Date.now(),
        },
      })
    }

    // Phase 3 — one transaction, no awaits inside it.
    const tx = await this.tx([STORE_ENTITIES, STORE_META], 'readwrite')
    const entities = tx.objectStore(STORE_ENTITIES)

    for (const write of writes) {
      if (write.value === null) entities.delete(write.key)
      else entities.put(write.value)
    }

    tx.objectStore(STORE_META).put({ key: cursorKey(workspaceId), value: nextCursor })

    await committed(tx)
  }

  async clearWorkspace(workspaceId: string): Promise<void> {
    const rows = await this.allEntities()
    const doomed = rows.filter((r) => r.workspaceId === workspaceId)

    const tx = await this.tx([STORE_ENTITIES, STORE_META], 'readwrite')
    const entities = tx.objectStore(STORE_ENTITIES)
    for (const row of doomed) entities.delete(row.key)

    // The outbox is deliberately untouched: unpushed local mutations are not
    // the server's to invalidate, and a re-hydrate must not eat them.
    tx.objectStore(STORE_META).put({ key: cursorKey(workspaceId), value: 0 })

    await committed(tx)
  }

  private async allEntities(): Promise<StoredEntity[]> {
    const tx = await this.tx([STORE_ENTITIES], 'readonly')
    return promisify<StoredEntity[]>(tx.objectStore(STORE_ENTITIES).getAll())
  }
}

/* ── row shape ─────────────────────────────────────────────────────────── */

interface StoredEntity {
  key: string
  id: string
  workspaceId: string
  entityType: SyncEntity
  data: Record<string, unknown>
  version: number
  pending: boolean
  updatedAt: number
}

function toStored(entity: LocalEntity): StoredEntity {
  return {
    key: entityKey(entity.workspaceId, entity.entityType, entity.id),
    ...entity,
  }
}

function toEntity(row: StoredEntity): LocalEntity {
  const { key: _key, ...entity } = row
  return entity
}

/** True when this environment can actually persist. */
export function indexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined'
  } catch {
    return false
  }
}
