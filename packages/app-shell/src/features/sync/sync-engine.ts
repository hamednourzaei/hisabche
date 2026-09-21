// ============================================
// Sync engine.
//
// Two directions, deliberately separate:
//   pull  server → SQLite: products/customers by the change-log cursor
//         (full snapshot on first run), invoices as a recency window
//   push  SQLite sync_queue → server, one idempotency key per queued row
//
// The queue shape mirrors the mobile outbox (clientId / entity / operation /
// payload / attempts / status) so the two can be unified later without a
// data migration.
// ============================================

import type { QueryClient } from '@tanstack/react-query'
import { invoiceKeys, customerKeys, productKeys, dashboardKeys, type ApiError } from '@hisabche/api'

import { useWorkspaceStore } from '@hisabche/store'

import { apiClient } from '@/shared/lib/api'
import { bridge } from '@/shared/lib/bridge'
import {
  routeFor,
  stripFinancialFields,
  type LocalTable,
  type QueueEntry,
} from '@hisabche/app-bridge'

const MAX_ATTEMPTS = 5

interface PullSpec {
  table: LocalTable
  endpoint: string
  /** Response key holding the array. */
  collection: string
  toRow: (record: Record<string, unknown>) => Record<string, unknown>
}

const num = (value: unknown): number =>
  typeof value === 'number' ? value : Number(value ?? 0) || 0
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null)
const nowIso = (): string => new Date().toISOString()

const PULL_SPECS: readonly PullSpec[] = [
  {
    table: 'product',
    endpoint: '/products',
    collection: 'products',
    toRow: (r) => ({
      id: r.id,
      name: r.name,
      barcode: str(r.barcode),
      sku: str(r.sku),
      category: str(r.category),
      quantity: num(r.quantity),
      unit: str(r.unit),
      min_stock_level: num(r.minStockLevel),
      buy_price: num(r.buyPrice),
      sell_price: num(r.sellPrice),
      is_active: r.isActive === false ? 0 : 1,
      updated_at: str(r.updatedAt) ?? nowIso(),
      dirty: 0,
    }),
  },
  {
    table: 'customer',
    endpoint: '/customers',
    collection: 'customers',
    toRow: (r) => ({
      id: r.id,
      full_name: r.fullName,
      phone: str(r.phone),
      email: str(r.email),
      address: typeof r.address === 'string' ? r.address : JSON.stringify(r.address ?? null),
      opening_balance: num(r.openingBalance),
      type: str(r.type),
      is_active: r.isActive === false ? 0 : 1,
      updated_at: str(r.updatedAt) ?? nowIso(),
      dirty: 0,
    }),
  },
  {
    table: 'invoice',
    endpoint: '/invoices',
    collection: 'invoices',
    toRow: (r) => ({
      id: r.id,
      invoice_number: str(r.invoiceNumber),
      type: str(r.type) ?? 'sale',
      customer_id: str(r.customerId),
      customer_name: str(r.customerName),
      date: str(r.date) ?? nowIso(),
      subtotal: num(r.subtotal),
      discount_total: num(r.discountTotal),
      tax_total: num(r.taxTotal),
      total: num(r.total),
      paid_amount: num(r.paidAmount),
      payment_method: str(r.paymentMethod),
      currency: str(r.currency) ?? 'AFN',
      status: str(r.status) ?? 'pending',
      notes: str(r.notes),
      updated_at: str(r.updatedAt) ?? nowIso(),
      dirty: 0,
    }),
  },
]

// ============================================
// Pull
//
// ⚠️ WHAT THIS REPLACED. Every sync fetched `page: 1, limit: 200` of each list.
// The list endpoints cap `limit` at 100 and ignore `page`, so the offline copy
// held the newest 100 products and customers and silently never the rest —
// and downloaded those same 100 again on every sync.
//
// Products and customers now follow the server's change log
// (`GET /api/sync/pull`, cursor = sync_version): only what changed since the
// last pull travels. The first pull — or one the server says is too old
// (`mustRehydrate`) — takes a COMPLETE snapshot by walking the list cursor to
// the end, then starts the log from the head read BEFORE the snapshot, so a
// change made during it is pulled again rather than missed.
//
// Invoices stay a recency window (newest 100): they are financial documents
// read through their own endpoint (items, customer name), not raw log rows.
// ============================================

const DELTA_TABLES = { product: 'product', customer: 'customer' } as const
type DeltaEntity = keyof typeof DELTA_TABLES

const SNAPSHOT_PAGE = 100
const SNAPSHOT_MAX_PAGES = 500
const DELTA_PAGE = 500
const DELTA_MAX_PAGES = 200

/** Rows from the change log are raw table rows (snake_case). */
const FROM_LOG: Record<DeltaEntity, (r: Record<string, unknown>) => Record<string, unknown>> = {
  product: (r) => ({
    id: r.id,
    name: str(r.name) ?? '',
    barcode: str(r.barcode),
    sku: str(r.sku),
    category: str(r.category),
    quantity: num(r.quantity),
    unit: str(r.unit),
    min_stock_level: num(r.min_stock_level),
    buy_price: num(r.buy_price),
    sell_price: num(r.sell_price),
    is_active: r.is_active === false || r.deleted_at ? 0 : 1,
    updated_at: str(r.updated_at) ?? nowIso(),
    dirty: 0,
  }),
  customer: (r) => ({
    id: r.id,
    full_name: str(r.full_name) ?? '',
    phone: str(r.phone),
    email: str(r.email),
    address: typeof r.address === 'string' ? r.address : JSON.stringify(r.address ?? null),
    opening_balance: num(r.opening_balance),
    type: str(r.type),
    is_active: r.is_active === false || r.deleted_at ? 0 : 1,
    updated_at: str(r.updated_at) ?? nowIso(),
    dirty: 0,
  }),
}

const cursorKey = (workspaceId: string) => `hisabche.desktop.syncCursor:${workspaceId}`

export function readCursor(workspaceId: string): number | null {
  try {
    const raw = localStorage.getItem(cursorKey(workspaceId))
    const value = raw === null ? NaN : Number(raw)
    return Number.isInteger(value) && value >= 0 ? value : null
  } catch {
    return null
  }
}

function writeCursor(workspaceId: string, cursor: number): void {
  try {
    localStorage.setItem(cursorKey(workspaceId), String(cursor))
  } catch {
    // A lost cursor costs one snapshot on the next pull, nothing more.
  }
}

export interface PullPage {
  changes: Array<{
    entityType: string
    entityId: string
    operation: 'create' | 'update' | 'delete'
    data: Record<string, unknown> | null
  }>
  nextCursor: number
  hasMore: boolean
  mustRehydrate: boolean
}

/** Every row of a list endpoint, walking its cursor to the end. */
async function snapshotAll(spec: PullSpec): Promise<number> {
  const desktop = bridge()
  if (!desktop) return 0

  let cursor: string | null = null
  let written = 0
  for (let page = 0; page < SNAPSHOT_MAX_PAGES; page++) {
    const response: { data: Record<string, unknown> } = await apiClient.get(spec.endpoint, {
      // Sorted by id, so the id cursor the endpoint hands back IS the sort key.
      params: {
        limit: SNAPSHOT_PAGE,
        sortBy: 'id',
        sortDirection: 'asc',
        ...(cursor ? { cursor } : {}),
      },
    })
    const collection = response.data[spec.collection]
    if (!Array.isArray(collection) || collection.length === 0) break
    written += await desktop.db.upsertMany(
      spec.table,
      (collection as Array<Record<string, unknown>>).map(spec.toRow),
    )
    const next = response.data.nextCursor
    if (response.data.hasMore !== true || typeof next !== 'string') break
    cursor = next
  }
  return written
}

/** The newest invoices, as a recency window (see above). */
async function pullRecentInvoices(): Promise<number> {
  const desktop = bridge()
  const spec = PULL_SPECS.find((candidate) => candidate.table === 'invoice')
  if (!desktop || !spec) return 0
  const response = await apiClient.get<Record<string, unknown>>(spec.endpoint, {
    params: { limit: SNAPSHOT_PAGE, sortDirection: 'desc' },
  })
  const collection = response.data[spec.collection]
  if (!Array.isArray(collection)) return 0
  return desktop.db.upsertMany(
    spec.table,
    (collection as Array<Record<string, unknown>>).map(spec.toRow),
  )
}

async function rehydrate(workspaceId: string | null): Promise<number> {
  // The head is read FIRST: whatever changes while the snapshot runs lies
  // after it and is pulled again next time instead of being skipped.
  let head: number | null = null
  try {
    const { data } = await apiClient.get<{ cursor: number }>('/sync/cursor')
    head = Number.isInteger(data.cursor) ? data.cursor : null
  } catch {
    head = null // no change log on this server: snapshot every time
  }

  let written = 0
  for (const table of Object.values(DELTA_TABLES)) {
    const spec = PULL_SPECS.find((candidate) => candidate.table === table)
    if (spec) written += await snapshotAll(spec)
  }
  if (workspaceId && head !== null) writeCursor(workspaceId, head)
  return written
}

/** Apply one page of the change log to SQLite. */
export async function applyChanges(page: PullPage): Promise<number> {
  const desktop = bridge()
  if (!desktop) return 0

  let written = 0
  for (const entity of Object.keys(DELTA_TABLES) as DeltaEntity[]) {
    const table = DELTA_TABLES[entity]
    const mine = page.changes.filter((change) => change.entityType === entity)

    const upserts = mine
      .filter((change) => change.operation !== 'delete' && change.data)
      .map((change) => FROM_LOG[entity](change.data as Record<string, unknown>))

    // A delete (or a row gone since) retires the local row rather than
    // erasing it: offline screens filter on is_active, and a queued local
    // change may still reference it.
    const retiredIds = mine
      .filter((change) => change.operation === 'delete' || !change.data)
      .map((change) => change.entityId)
    for (const id of retiredIds) {
      const [local] = await desktop.db.query<Record<string, unknown>>({
        table,
        where: { id },
        limit: 1,
      })
      if (local) upserts.push({ ...local, is_active: 0, updated_at: nowIso(), dirty: 0 })
    }

    if (upserts.length > 0) written += await desktop.db.upsertMany(table, upserts)
  }
  return written
}

async function pullDelta(workspaceId: string, from: number): Promise<number> {
  let cursor = from
  let written = 0
  for (let round = 0; round < DELTA_MAX_PAGES; round++) {
    const { data } = await apiClient.get<PullPage>('/sync/pull', {
      params: { cursor, limit: DELTA_PAGE },
    })
    if (data.mustRehydrate) return written + (await rehydrate(workspaceId))

    written += await applyChanges(data)
    // Advanced only AFTER the page is committed locally: a crash replays it.
    cursor = data.nextCursor
    writeCursor(workspaceId, cursor)
    if (!data.hasMore) break
  }
  return written
}

export async function pullAll(): Promise<number> {
  const workspaceId = useWorkspaceStore.getState().workspaceId ?? null
  const stored = workspaceId ? readCursor(workspaceId) : null

  let written = 0
  try {
    written +=
      workspaceId && stored !== null
        ? await pullDelta(workspaceId, stored)
        : await rehydrate(workspaceId)
  } catch {
    // The change log is unavailable (older server, or a failed page): a full
    // snapshot is slower but never wrong.
    written += await rehydrate(null).catch(() => 0)
  }
  written += await pullRecentInvoices().catch(() => 0)
  return written
}

// ============================================
// Push
// ============================================

const ENDPOINT_BY_ENTITY: Partial<Record<LocalTable, string>> = {
  invoice: '/invoices',
  customer: '/customers',
  product: '/products',
  transaction: '/transactions',
}

function isPermanent(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429
}

async function pushEntry(entry: QueueEntry): Promise<void> {
  // ⚠️ WHICH ROAD IS DECIDED IN THE CONTRACT, NOT HERE.
  //
  // `POST /api/sync/push` writes the row with optimistic concurrency and no
  // domain logic. That is exactly right for a customer's phone number and
  // exactly wrong for an invoice: a total written straight to the table is an
  // invoice that moved no stock and booked no revenue. `routeFor` draws the
  // line by financial effect and defaults to the domain when unsure.
  const route = routeFor({
    entity: entry.entity,
    operation: entry.operation,
    payload: entry.payload,
  })

  if (route === 'versioned') {
    await pushVersioned(entry)
    return
  }

  const endpoint = ENDPOINT_BY_ENTITY[entry.entity]
  if (!endpoint) throw new Error(`NO_ENDPOINT:${entry.entity}`)

  const headers = { 'Idempotency-Key': entry.clientId }

  if (entry.operation === 'create') {
    await apiClient.post(endpoint, entry.payload, { headers })
    return
  }
  if (entry.operation === 'update') {
    await apiClient.patch(`${endpoint}/${String(entry.payload.id)}`, entry.payload, { headers })
    return
  }
  try {
    await apiClient.delete(`${endpoint}/${String(entry.payload.id)}`, { headers })
  } catch (error) {
    // A replayed delete whose first attempt already landed finds nothing to
    // delete. The goal — the row is gone — is met; it is not a failure.
    if ((error as Partial<ApiError>).status === 404) return
    throw error
  }
}

/**
 * A descriptive edit, with the version the device believed.
 *
 * ⚠️ THIS IS THE ONLY PATH THAT CAN REFUSE. Without `expectedVersion` the
 * server has nothing to compare and two devices editing one customer resolve
 * as last-write-wins, silently — the losing edit leaving no trace anywhere.
 * With it, the server files a conflict and answers 409, and `/conflicts`
 * finally has something to show.
 */
async function pushVersioned(entry: QueueEntry): Promise<void> {
  const local = entry.payload as { id?: unknown; version?: unknown }
  const entityId = String(local.id ?? '')
  if (!entityId) throw new Error(`NO_ENTITY_ID:${entry.entity}`)

  const version = Number(local.version ?? 0)

  const mutation: Record<string, unknown> = {
    // Stable across every retry — the same clientId the domain road sends as
    // its Idempotency-Key, so one logical write has one identity either way.
    mutationId: entry.clientId,
    entityType: entry.entity,
    entityId,
    operation: entry.operation,
    // ⚠️ Stripped again here. `routeFor` already refused a payload carrying
    // money; this is what makes it impossible rather than merely intended.
    payload: stripFinancialFields(entry.payload),
    ...(version > 0 ? { expectedVersion: version } : {}),
  }

  await apiClient.post('/sync/push', { mutations: [mutation] })
}

let running = false

/** Drain the queue then refresh server state. Safe to call concurrently. */
export async function runSync(queryClient: QueryClient): Promise<void> {
  const desktop = bridge()
  if (!desktop || running) return

  running = true
  try {
    const queue = await desktop.db.queue()

    for (const entry of queue) {
      if (entry.attempts >= MAX_ATTEMPTS) continue

      try {
        await pushEntry(entry)
        await desktop.db.resolveQueue(entry.clientId, 'done')
      } catch (error) {
        const apiError = error as Partial<ApiError>
        await desktop.db.resolveQueue(entry.clientId, 'failed', apiError.message ?? 'SYNC_FAILED')
        // A permanent rejection stops here; the sync page offers a manual retry.
        if (apiError.status && isPermanent(apiError.status)) continue
      }
    }

    await pullAll()
    await invalidateAll(queryClient)
  } finally {
    running = false
  }
}

async function invalidateAll(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: invoiceKeys.all }),
    queryClient.invalidateQueries({ queryKey: customerKeys.all }),
    queryClient.invalidateQueries({ queryKey: productKeys.all }),
    queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
  ])
}
