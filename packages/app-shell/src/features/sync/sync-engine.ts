// ============================================
// Sync engine (desktop).
//
// Two directions, deliberately separate:
//   pull  server → SQLite: products, customers and invoices by the change-log
//         cursor; a full rebuild through /sync/snapshot on first run or when
//         the server says the cursor fell off the log (`mustRehydrate`)
//   push  SQLite sync_queue → server, one idempotency key per queued row;
//         money goes through the domain routes, never the row writer
//
// Pages travel as Hisabche Sync Binary when the server speaks it (`Accept`)
// and as JSON when it does not — an older server answers JSON and this reads
// it the same way. A WebSocket (`startSyncStream`) wakes the engine when the
// workspace moves; it carries no data, so losing it only delays a sync.
//
// The queue shape mirrors the mobile outbox (clientId / entity / operation /
// payload / attempts / status) so the two can be unified later without a
// data migration.
// ============================================

import type { QueryClient } from '@tanstack/react-query'
import {
  invoiceKeys,
  customerKeys,
  productKeys,
  dashboardKeys,
  getToken,
  type ApiError,
} from '@hisabche/api'
import { decodePullPage, decodeSnapshotPage, HSB_CONTENT_TYPE } from '@hisabche/sync/wire'
import { connectSyncStream, streamUrl, type StreamHandle } from '@hisabche/sync/stream'

import { useWorkspaceStore } from '@hisabche/store'

import { API_BASE_URL, apiClient } from '@/shared/lib/api'
import { bridge } from '@/shared/lib/bridge'
import {
  createPushGate,
  routeFor,
  stripFinancialFields,
  type LocalTable,
  type QueueEntry,
} from '@hisabche/app-bridge'

const MAX_ATTEMPTS = 5

const num = (value: unknown): number =>
  typeof value === 'number' ? value : Number(value ?? 0) || 0
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null)
const nowIso = (): string => new Date().toISOString()

// ============================================
// Pull
//
// ⚠️ WHAT THIS REPLACED, TWICE.
//
// 1. Every sync fetched `page: 1, limit: 200` of each list. The list endpoints
//    cap `limit` at 100 and ignore `page`, so the offline copy held the newest
//    100 products and customers and never the rest.
// 2. The rebuild then walked the REST list endpoints — which do not return
//    `version`. Every row landed at the local default, so the first offline
//    edit of anything the server had ever changed was refused as a version
//    conflict. Invoices were a newest-100 window, re-downloaded on each sync.
//
// Now: a rebuild walks `/sync/snapshot` (the lean pull columns, `version`
// included, keyset by id, every invoice), starting from the head read BEFORE
// the walk so a change made during it is pulled again rather than missed; after
// that only the change log travels. Customers are rebuilt first so an invoice
// can take its customer's name from the device.
// ============================================

/** Rebuild order matters: invoices read their customer's name from the device. */
const DELTA_ENTITIES = ['customer', 'product', 'invoice'] as const
type DeltaEntity = (typeof DELTA_ENTITIES)[number]

/** Entities retired with is_active = 0 rather than removed (a queued change may reference them). */
const RETIRED_NOT_REMOVED: ReadonlySet<DeltaEntity> = new Set(['customer', 'product'])

const SNAPSHOT_PAGE = 500
const SNAPSHOT_MAX_PAGES = 1000
const DELTA_PAGE = 500
const DELTA_MAX_PAGES = 200

/**
 * Server rows (snake_case, the lean pull columns) → local SQLite rows.
 *
 * ⚠️ `version` IS CARRIED. It is the optimistic-concurrency token an offline
 * edit sends back as `expectedVersion`; a row stored without it is an edit the
 * server will refuse.
 */
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
    // `deleted_at` was read here too; no such column exists (a delete is a
    // `delete` change), so it was always undefined. Guard: sync-pull-columns.test.ts.
    is_active: r.is_active === false ? 0 : 1,
    updated_at: str(r.updated_at) ?? nowIso(),
    version: num(r.version) || 1,
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
    is_active: r.is_active === false ? 0 : 1,
    updated_at: str(r.updated_at) ?? nowIso(),
    version: num(r.version) || 1,
    dirty: 0,
  }),
  invoice: (r) => ({
    id: r.id,
    invoice_number: str(r.invoice_number),
    type: str(r.type) ?? 'sale',
    customer_id: str(r.customer_id),
    date: str(r.date) ?? nowIso(),
    subtotal: num(r.subtotal),
    discount_total: num(r.discount_total),
    tax_total: num(r.tax_total),
    total: num(r.total),
    paid_amount: num(r.paid_amount),
    payment_method: str(r.payment_method),
    currency: str(r.currency) ?? 'AFN',
    status: str(r.status) ?? 'pending',
    notes: str(r.notes),
    updated_at: str(r.updated_at) ?? nowIso(),
    version: num(r.version) || 1,
    dirty: 0,
  }),
}

/** Accept header: binary preferred, JSON understood. */
const HSB_ACCEPT = `${HSB_CONTENT_TYPE}, application/json;q=0.5`

/** GET a sync endpoint as bytes and return its body, binary or JSON. */
async function getSyncBody<T>(
  path: string,
  params: Record<string, unknown>,
  decodeBinary: (bytes: Uint8Array) => T,
): Promise<T> {
  const response = await apiClient.get<ArrayBuffer>(path, {
    params,
    headers: { Accept: HSB_ACCEPT },
    responseType: 'arraybuffer',
  })
  const bytes = new Uint8Array(response.data)
  const type = String((response.headers as Record<string, unknown>)['content-type'] ?? '')
  if (type.includes(HSB_CONTENT_TYPE)) return decodeBinary(bytes)
  return JSON.parse(new TextDecoder().decode(bytes)) as T
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

interface SnapshotPage {
  rows: Array<Record<string, unknown>>
  nextAfter: string | null
  hasMore: boolean
}

/** Invoices carry no customer name: keep the device's, or read the local customer's. */
async function attachCustomerNames(rows: Array<Record<string, unknown>>): Promise<void> {
  const desktop = bridge()
  if (!desktop) return
  for (const row of rows) {
    const [local] = await desktop.db.query<Record<string, unknown>>({
      table: 'invoice',
      where: { id: String(row.id) },
      limit: 1,
    })
    let name = str(local?.customer_name)
    if (!name && typeof row.customer_id === 'string') {
      const [customer] = await desktop.db.query<Record<string, unknown>>({
        table: 'customer',
        where: { id: row.customer_id },
        limit: 1,
      })
      name = str(customer?.full_name)
    }
    if (name) row.customer_name = name
  }
}

/**
 * Make the device's lines of each invoice exactly the server's (the server
 * sends them as `items` on every invoice row). Lines the server no longer has
 * are removed — except one with an unsent local edit (`dirty`), which
 * removeMany keeps. A row without an `items` array (an older server) leaves
 * the device's lines untouched rather than reading as «no lines».
 */
async function storeInvoiceItems(invoices: Array<Record<string, unknown>>): Promise<number> {
  const desktop = bridge()
  if (!desktop) return 0
  let written = 0
  for (const invoice of invoices) {
    if (!Array.isArray(invoice.items)) continue
    const invoiceId = String(invoice.id)
    const updatedAt = str(invoice.updated_at) ?? nowIso()
    const items = (invoice.items as Array<Record<string, unknown>>).map((item) => ({
      id: item.id,
      invoice_id: invoiceId,
      product_id: str(item.product_id),
      product_name: str(item.product_name) ?? '',
      quantity: num(item.quantity),
      unit_price: num(item.unit_price),
      discount: num(item.discount),
      total_price: num(item.total_price),
      updated_at: updatedAt,
      dirty: 0,
    }))
    const keep = new Set(items.map((item) => String(item.id)))
    const local = await desktop.db.query<Record<string, unknown>>({
      table: 'invoice_item',
      where: { invoice_id: invoiceId },
      limit: 1000,
    })
    const stale = local.map((row) => String(row.id)).filter((id) => !keep.has(id))
    if (stale.length > 0) await desktop.db.removeMany('invoice_item', stale)
    if (items.length > 0) written += await desktop.db.upsertMany('invoice_item', items)
  }
  return written
}

/** The lines of invoices the server deleted (their header is gone too). */
async function removeInvoiceItems(invoiceIds: string[]): Promise<void> {
  const desktop = bridge()
  if (!desktop) return
  for (const invoiceId of invoiceIds) {
    const local = await desktop.db.query<Record<string, unknown>>({
      table: 'invoice_item',
      where: { invoice_id: invoiceId },
      limit: 1000,
    })
    if (local.length > 0)
      await desktop.db.removeMany(
        'invoice_item',
        local.map((row) => String(row.id)),
      )
  }
}

/** Every row of one entity, walking /sync/snapshot to the end. */
async function snapshotEntity(entity: DeltaEntity): Promise<number> {
  const desktop = bridge()
  if (!desktop) return 0
  let after: string | null = null
  let written = 0
  for (let page = 0; page < SNAPSHOT_MAX_PAGES; page++) {
    const body: SnapshotPage = await getSyncBody<SnapshotPage>(
      '/sync/snapshot',
      { entity, limit: SNAPSHOT_PAGE, ...(after ? { after } : {}) },
      decodeSnapshotPage,
    )
    const rows = body.rows.map(FROM_LOG[entity])
    if (entity === 'invoice') await attachCustomerNames(rows)
    if (rows.length > 0) written += await desktop.db.upsertMany(entity, rows)
    if (entity === 'invoice') written += await storeInvoiceItems(body.rows)
    if (!body.hasMore || !body.nextAfter) break
    after = body.nextAfter
  }
  return written
}

async function rehydrate(workspaceId: string | null): Promise<number> {
  // The head is read FIRST: whatever changes while the snapshot runs lies
  // after it and is pulled again next time instead of being skipped.
  let head: number | null = null
  try {
    const { data } = await apiClient.get<{ cursor: number }>('/sync/cursor')
    head = Number.isInteger(data.cursor) ? data.cursor : null
  } catch {
    head = null
  }

  let written = 0
  for (const entity of DELTA_ENTITIES) written += await snapshotEntity(entity)
  // Only a complete rebuild may start the log: a head recorded after a
  // partial one would skip whatever the failed page held.
  if (workspaceId && head !== null) writeCursor(workspaceId, head)
  return written
}

/** Apply one page of the change log to SQLite. */
export async function applyChanges(page: PullPage): Promise<number> {
  const desktop = bridge()
  if (!desktop) return 0

  let written = 0
  for (const entity of DELTA_ENTITIES) {
    const mine = page.changes.filter((change) => change.entityType === entity)
    if (mine.length === 0) continue

    const upserts = mine
      .filter((change) => change.operation !== 'delete' && change.data)
      .map((change) => FROM_LOG[entity](change.data as Record<string, unknown>))
    if (entity === 'invoice') await attachCustomerNames(upserts)

    // ⚠️ `data: null` on a non-delete means ONLY «the row is gone since» — the
    // server fails the whole pull on a read error instead of sending null
    // (P0, 27 Sep 2026). Before that fix a transient database error landed
    // here and retired live products.
    const goneIds = mine
      .filter((change) => change.operation === 'delete' || !change.data)
      .map((change) => change.entityId)

    if (RETIRED_NOT_REMOVED.has(entity)) {
      // Retired rather than erased: offline screens filter on is_active, and a
      // queued local change may still reference the row.
      for (const id of goneIds) {
        const [local] = await desktop.db.query<Record<string, unknown>>({
          table: entity,
          where: { id },
          limit: 1,
        })
        if (local) upserts.push({ ...local, is_active: 0, updated_at: nowIso(), dirty: 0 })
      }
    } else if (goneIds.length > 0) {
      // Invoices have no soft-delete column: a server-deleted invoice is
      // removed — unless this device still holds an unsent edit to it.
      await desktop.db.removeMany(entity, goneIds)
      written += goneIds.length
      if (entity === 'invoice') await removeInvoiceItems(goneIds)
    }

    if (upserts.length > 0) written += await desktop.db.upsertMany(entity, upserts)
    if (entity === 'invoice') {
      written += await storeInvoiceItems(
        mine
          .filter((change) => change.operation !== 'delete' && change.data)
          .map((change) => change.data as Record<string, unknown>),
      )
    }
  }
  return written
}

async function pullDelta(workspaceId: string, from: number): Promise<number> {
  let cursor = from
  let written = 0
  for (let round = 0; round < DELTA_MAX_PAGES; round++) {
    const data = await getSyncBody<PullPage>(
      '/sync/pull',
      { cursor, limit: DELTA_PAGE },
      decodePullPage,
    )
    if (data.mustRehydrate) return written + (await rehydrate(workspaceId))

    written += await applyChanges(data)
    // Advanced only AFTER the page is committed locally: a crash replays it.
    cursor = data.nextCursor
    writeCursor(workspaceId, cursor)
    if (!data.hasMore) break
  }
  return written
}

/**
 * Bring the device up to the server.
 *
 * A failure is thrown, not swallowed into a fallback: the cursor stays where
 * the last committed page put it, and the next sync (interval, reconnect,
 * stream wake) retries from there. The old fallback re-downloaded everything
 * on any error, which on a bad connection is the most expensive thing to do.
 */
export async function pullAll(): Promise<number> {
  const workspaceId = useWorkspaceStore.getState().workspaceId ?? null
  const stored = workspaceId ? readCursor(workspaceId) : null
  if (workspaceId && stored !== null) return pullDelta(workspaceId, stored)
  return rehydrate(workspaceId)
}

// ============================================
// Wake-up stream
// ============================================

/**
 * Keep a wake-up connection open for the active workspace. Every CURSOR the
 * server sends past this device's cursor runs a sync. Returns a stop handle.
 */
export function startSyncStream(workspaceId: string, onWake: () => void): StreamHandle {
  return connectSyncStream({
    url: streamUrl(API_BASE_URL, workspaceId),
    getToken: () => getToken(),
    getCursor: () => readCursor(workspaceId) ?? 0,
    onWake: (_reason, cursor) => {
      if (cursor > (readCursor(workspaceId) ?? 0)) onWake()
    },
  })
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
let again = false

/**
 * Drain the queue then refresh server state. Safe to call concurrently: a
 * call that arrives while a sync runs is not dropped — it schedules exactly
 * one more run afterwards, so a stream wake during a long pull still lands.
 */
export async function runSync(queryClient: QueryClient): Promise<void> {
  const desktop = bridge()
  if (!desktop) return
  if (running) {
    again = true
    return
  }

  running = true
  try {
    const queue = await desktop.db.queue()
    // An entry never goes before the create it refers to (push-order.ts): a
    // failed customer create keeps its invoice WAITING, not failed.
    const gate = createPushGate(queue)

    for (const entry of queue) {
      if (entry.attempts >= MAX_ATTEMPTS) continue
      if (gate.blockedBy(entry)) continue

      try {
        await pushEntry(entry)
        await desktop.db.resolveQueue(entry.clientId, 'done')
        gate.markSent(entry)
      } catch (error) {
        const apiError = error as Partial<ApiError>
        await desktop.db.resolveQueue(entry.clientId, 'failed', apiError.message ?? 'SYNC_FAILED')
        // A permanent rejection stops here; the sync page offers a manual retry.
        if (apiError.status && isPermanent(apiError.status)) continue
      }
    }

    try {
      await pullAll()
    } catch {
      // The cursor stayed at the last committed page; the next run (interval,
      // reconnect, stream wake) resumes from there. Nothing to undo here.
    }
    await invalidateAll(queryClient)
  } finally {
    running = false
  }
  if (again) {
    again = false
    await runSync(queryClient)
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
