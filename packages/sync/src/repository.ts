// ============================================
// packages/sync/src/repository.ts
//
// The boundary between the UI and storage.
//
// A component asks a repository for invoices. It does not know — and must not
// be able to tell — whether the answer came from IndexedDB, SQLite, or a
// server round trip. That ignorance is the point: it is what lets the same
// screen run on web, desktop and mobile, and what lets reads stop being
// network calls without touching a single component.
//
// WHAT A REPOSITORY IS NOT
//
// It is not a place for business logic. It does not total an invoice, decide
// whether a discount is valid, or derive a party's role. Those live in
// `@hisabche/validation` and, authoritatively, on the server. A repository
// reads and writes rows; putting arithmetic here would create a second
// implementation of the money rules, which is the thing this architecture is
// most careful to avoid.
// ============================================

import type { SyncEntity } from '@hisabche/validation'

import { mutateLocal } from './mutations'
import type { LocalEntity, StorageAdapter } from './types'

/** Notified whenever this repository's entity type changes locally. */
export type RepositoryListener = () => void

export interface RepositoryContext {
  storage: StorageAdapter
  workspaceId: string
  /** Called after every local mutation so the engine can schedule a push. */
  onMutated?: () => void
}

/**
 * A row as the UI sees it: the server's fields, plus the two things the UI
 * needs that the server does not provide.
 */
export interface RepositoryRow<T = Record<string, unknown>> {
  id: string
  data: T
  /** Server version, 0 for a row that has never round-tripped. */
  version: number
  /** True while a local change for this row is unacknowledged. */
  pending: boolean
}

function toRow<T>(entity: LocalEntity): RepositoryRow<T> {
  return {
    id: entity.id,
    data: entity.data as T,
    version: entity.version,
    pending: entity.pending,
  }
}

/**
 * Change notification, per entity type.
 *
 * Deliberately coarse: "invoices changed", not "invoice X field Y changed". A
 * fine-grained signal would need the repository to diff rows, and the consumer
 * re-reads from the local database anyway — which is cheap, because it is
 * local. Coarse and correct beats clever and subtly stale.
 */
class ChangeBus {
  private listeners = new Map<SyncEntity, Set<RepositoryListener>>()

  subscribe(type: SyncEntity, listener: RepositoryListener): () => void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
    return () => set.delete(listener)
  }

  emit(type: SyncEntity): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      try {
        listener()
      } catch {
        // A bad consumer must not stop the others from being told.
      }
    }
  }

  /** Called by the sync engine after a pull lands. */
  emitAll(): void {
    for (const type of [...this.listeners.keys()]) this.emit(type)
  }
}

export const changeBus = new ChangeBus()

/**
 * The generic repository. Every entity gets one of these.
 *
 * Subclass only when an entity needs a query its neighbours do not — see
 * `InvoiceRepository` below. Most do not.
 */
export class Repository<T = Record<string, unknown>> {
  constructor(
    protected readonly ctx: RepositoryContext,
    protected readonly entityType: SyncEntity,
  ) {}

  /* ── reads: local only, no network ────────────────────────────────────── */

  async get(id: string): Promise<RepositoryRow<T> | null> {
    const entity = await this.ctx.storage.getEntity(this.ctx.workspaceId, this.entityType, id)
    return entity ? toRow<T>(entity) : null
  }

  async list(): Promise<RepositoryRow<T>[]> {
    const entities = await this.ctx.storage.listEntities(this.ctx.workspaceId, this.entityType)
    return entities.map(toRow<T>)
  }

  /**
   * Filter in memory.
   *
   * Fine at the scale a single workspace reaches on a client, and it keeps the
   * adapter interface small. If a workspace ever grows past what this can scan
   * comfortably, the fix is an index in the adapter, not a query language.
   */
  async where(predicate: (row: RepositoryRow<T>) => boolean): Promise<RepositoryRow<T>[]> {
    return (await this.list()).filter(predicate)
  }

  /** Re-run on every local change to this entity type. */
  subscribe(listener: RepositoryListener): () => void {
    return changeBus.subscribe(this.entityType, listener)
  }

  /* ── writes: local transaction + outbox, never a network call ─────────── */

  /**
   * The payload is an INTENT.
   *
   * Whatever the client puts in `total` here is what the UI draws until the
   * server answers. The server recalculates and its row replaces this one on
   * the next pull. Nothing downstream treats a client total as authority.
   */
  async create(payload: Partial<T> & Record<string, unknown>, id?: string): Promise<string> {
    const result = await mutateLocal({
      storage: this.ctx.storage,
      workspaceId: this.ctx.workspaceId,
      entityType: this.entityType,
      ...(id ? { entityId: id } : {}),
      operation: 'create',
      payload,
    })

    this.notify()
    return result.entityId
  }

  /**
   * Update, carrying the version the client believes the server holds.
   *
   * The version is read here rather than accepted from the caller so a
   * component cannot accidentally omit it — omitting it disables conflict
   * detection, and silently overwriting another user's newer financial state
   * is exactly what this whole layer exists to prevent.
   */
  async update(id: string, payload: Partial<T> & Record<string, unknown>): Promise<void> {
    const existing = await this.ctx.storage.getEntity(this.ctx.workspaceId, this.entityType, id)

    await mutateLocal({
      storage: this.ctx.storage,
      workspaceId: this.ctx.workspaceId,
      entityType: this.entityType,
      entityId: id,
      operation: 'update',
      payload,
      // A row that has never synced has no server version to conflict with.
      ...(existing && existing.version > 0 ? { expectedVersion: existing.version } : {}),
    })

    this.notify()
  }

  async remove(id: string): Promise<void> {
    await mutateLocal({
      storage: this.ctx.storage,
      workspaceId: this.ctx.workspaceId,
      entityType: this.entityType,
      entityId: id,
      operation: 'delete',
      payload: {},
    })

    this.notify()
  }

  protected notify(): void {
    changeBus.emit(this.entityType)
    this.ctx.onMutated?.()
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   Entity repositories
   ═══════════════════════════════════════════════════════════════════════════ */

export interface InvoiceRow {
  id: string
  invoice_number?: string
  type?: 'sale' | 'purchase'
  customer_id?: string | null
  date?: string
  total?: number
  status?: string
  finalized_at?: string | null
  locked_by_user_id?: string | null
  lock_expires_at?: string | null
  [key: string]: unknown
}

export class InvoiceRepository extends Repository<InvoiceRow> {
  constructor(ctx: RepositoryContext) {
    super(ctx, 'invoice')
  }

  /**
   * Newest first — the order every invoice list in the product uses.
   *
   * A row with no date sorts last rather than crashing the comparator: server
   * data is optional far more often than a type signature suggests.
   */
  async listRecent(limit = 50): Promise<RepositoryRow<InvoiceRow>[]> {
    const all = await this.list()
    return all
      .sort((a, b) => {
        const x = a.data.date ? Date.parse(a.data.date) : 0
        const y = b.data.date ? Date.parse(b.data.date) : 0
        return y - x
      })
      .slice(0, limit)
  }

  async listByCustomer(customerId: string): Promise<RepositoryRow<InvoiceRow>[]> {
    return this.where((row) => row.data.customer_id === customerId)
  }

  /**
   * Refuse locally what the server would refuse anyway.
   *
   * The server's trigger is the real guarantee; this exists so the user is
   * told immediately instead of watching a mutation sit in the outbox and come
   * back rejected minutes later.
   */
  override async update(id: string, payload: Partial<InvoiceRow>): Promise<void> {
    const existing = await this.get(id)

    if (existing?.data.finalized_at) {
      throw new Error(
        'This invoice is finalized. Issue a correction document rather than editing it.',
      )
    }

    return super.update(id, payload)
  }

  override async remove(id: string): Promise<void> {
    const existing = await this.get(id)

    if (existing?.data.finalized_at) {
      throw new Error('A finalized invoice cannot be deleted.')
    }

    return super.remove(id)
  }
}

export interface CustomerRow {
  id: string
  name?: string
  phone?: string | null
  email?: string | null
  [key: string]: unknown
}

export class CustomerRepository extends Repository<CustomerRow> {
  constructor(ctx: RepositoryContext) {
    super(ctx, 'customer')
  }

  /**
   * Local search across name and phone.
   *
   * Instant because it never leaves the device — the behaviour the customer
   * picker wanted all along, where every keystroke used to be a request.
   */
  async search(term: string): Promise<RepositoryRow<CustomerRow>[]> {
    const needle = term.trim().toLowerCase()
    if (!needle) return this.list()

    return this.where((row) => {
      const name = String(row.data.name ?? '').toLowerCase()
      const phone = String(row.data.phone ?? '')
      return name.includes(needle) || phone.includes(needle)
    })
  }
}

export interface ProductRow {
  id: string
  name?: string
  barcode?: string | null
  sku?: string | null
  quantity?: number
  sell_price?: number
  min_stock_level?: number
  [key: string]: unknown
}

export class ProductRepository extends Repository<ProductRow> {
  constructor(ctx: RepositoryContext) {
    super(ctx, 'product')
  }

  async search(term: string): Promise<RepositoryRow<ProductRow>[]> {
    const needle = term.trim().toLowerCase()
    if (!needle) return this.list()

    return this.where((row) => {
      const name = String(row.data.name ?? '').toLowerCase()
      const sku = String(row.data.sku ?? '').toLowerCase()
      const barcode = String(row.data.barcode ?? '')
      return name.includes(needle) || sku.includes(needle) || barcode.includes(needle)
    })
  }

  /**
   * A local READ MODEL, not an authority.
   *
   * Stock is decremented by the server when an invoice commits. This is the
   * last synced figure, useful for showing a picker "12 in stock" — it must
   * never be used to decide whether a sale is allowed.
   */
  async lowStock(): Promise<RepositoryRow<ProductRow>[]> {
    return this.where((row) => {
      const level = Number(row.data.min_stock_level ?? 0)
      return level > 0 && Number(row.data.quantity ?? 0) <= level
    })
  }
}

export interface TransactionRow {
  id: string
  invoice_id?: string | null
  customer_id?: string | null
  amount?: number
  type?: string
  date?: string
  [key: string]: unknown
}

export class PaymentRepository extends Repository<TransactionRow> {
  constructor(ctx: RepositoryContext) {
    super(ctx, 'transaction')
  }

  async listByInvoice(invoiceId: string): Promise<RepositoryRow<TransactionRow>[]> {
    return this.where((row) => row.data.invoice_id === invoiceId)
  }

  async listByCustomer(customerId: string): Promise<RepositoryRow<TransactionRow>[]> {
    return this.where((row) => row.data.customer_id === customerId)
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   The set a screen is handed
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Repositories {
  invoices: InvoiceRepository
  customers: CustomerRepository
  products: ProductRepository
  payments: PaymentRepository
}

export function createRepositories(ctx: RepositoryContext): Repositories {
  return {
    invoices: new InvoiceRepository(ctx),
    customers: new CustomerRepository(ctx),
    products: new ProductRepository(ctx),
    payments: new PaymentRepository(ctx),
  }
}
