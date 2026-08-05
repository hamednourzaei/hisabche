// ============================================
// Sync engine.
//
// Two directions, deliberately separate:
//   pull  server → SQLite, incremental by `updated_at` cursor, server wins
//   push  SQLite sync_queue → server, one idempotency key per queued row
//
// The queue shape mirrors the mobile outbox (clientId / entity / operation /
// payload / attempts / status) so the two can be unified later without a
// data migration.
// ============================================

import type { QueryClient } from '@tanstack/react-query'
import { invoiceKeys, customerKeys, productKeys, dashboardKeys, type ApiError } from '@hisabche/api'

import { apiClient } from '@/shared/lib/api'
import { bridge } from '@/shared/lib/bridge'
import type { LocalTable, QueueEntry } from '../../../electron/shared/ipc-contract'

const MAX_ATTEMPTS = 5
const PULL_PAGE_SIZE = 200

interface PullSpec {
  table: LocalTable
  endpoint: string
  /** Response key holding the array. */
  collection: string
  toRow: (record: Record<string, unknown>) => Record<string, unknown>
}

const num = (value: unknown): number => (typeof value === 'number' ? value : Number(value ?? 0) || 0)
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

/** Fetch one page and mirror it into SQLite. Returns rows written. */
async function pullOne(spec: PullSpec): Promise<number> {
  const desktop = bridge()
  if (!desktop) return 0

  const response = await apiClient.get<Record<string, unknown>>(spec.endpoint, {
    params: { page: 1, limit: PULL_PAGE_SIZE, sortDirection: 'desc' },
  })

  const collection = response.data[spec.collection]
  if (!Array.isArray(collection)) return 0

  const rows = (collection as Array<Record<string, unknown>>).map(spec.toRow)
  return desktop.db.upsertMany(spec.table, rows)
}

export async function pullAll(): Promise<number> {
  const counts = await Promise.all(
    PULL_SPECS.map((spec) => pullOne(spec).catch(() => 0))
  )
  return counts.reduce((sum, count) => sum + count, 0)
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
  await apiClient.delete(`${endpoint}/${String(entry.payload.id)}`, { headers })
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
        await desktop.db.resolveQueue(
          entry.clientId,
          'failed',
          apiError.message ?? 'SYNC_FAILED'
        )
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
