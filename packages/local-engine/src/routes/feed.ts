// ============================================
// packages/local-engine/src/routes/feed.ts
//
// The recent-activity feed and the notification bell, offline.
//
// ⚠️ WHY THIS EXISTS. Online, `/v1/activities` and `/v1/notifications` read
// tables the SERVER fills when an invoice, a payment or a customer is saved.
// An invoice made offline never reaches that server until it syncs, and the
// device answered «not available offline»: the dashboard said «فعالیتی ثبت
// نشده است» and the bell stayed dark right after a sale was made.
//
// The device has the facts — the rows it just wrote — so the feed is DERIVED
// from them, in the server's own shape. Nothing is invented: every entry is one
// row of `invoice`, `payment` or `customer`. When the device syncs, the
// server's own feed takes over.
//
// Read state is the only thing stored (two `meta` keys per feed): the ids the
// person marked, and the moment they marked «all».
// ============================================

import type { LocalDb } from '../db'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

type EntityType = 'invoice' | 'payment' | 'customer'

interface InvoiceFeedRow {
  id: string
  invoice_number: string
  type: string
  customer_name: string | null
  total: number
  currency: string
  status: string
  created_at: string
}

interface PaymentFeedRow {
  id: string
  payment_number: string | null
  direction: string
  amount: number
  currency: string
  created_at: string
}

interface CustomerFeedRow {
  id: string
  full_name: string
  created_at: string
}

/** One thing that happened on this device. */
interface FeedEvent {
  id: string
  entityType: EntityType
  entityId: string
  action: 'created'
  title: string
  titleKey: string
  bodyKey?: string | undefined
  params?: Record<string, string | number> | undefined
  description: string | undefined
  createdAt: string
  label: string
  subtitle: string | undefined
  amount: number | undefined
  currency: string | undefined
  status: string | undefined
  transactionType: 'sale' | 'purchase' | undefined
  route: string
  /** Where the bell sends the person. */
  invoiceNumber: string | undefined
}

const EVENTS_PER_KIND = 100

const ROUTE: Record<EntityType, (id: string) => string> = {
  invoice: (id) => `/invoices/${id}`,
  // A payment has no page of its own; it is read in the books.
  payment: () => '/accounting',
  customer: (id) => `/customers/${id}`,
}

/** Everything the device knows happened, newest first. */
function eventsOf(db: LocalDb, workspaceId: string): FeedEvent[] {
  const events: FeedEvent[] = []

  const invoices = db.all<InvoiceFeedRow>(
    `SELECT id, invoice_number, type, customer_name, total, currency, status, created_at
     FROM invoice
     WHERE workspace_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT ?`,
    [workspaceId, EVENTS_PER_KIND],
  )
  for (const row of invoices) {
    const purchase = row.type === 'purchase'
    events.push({
      id: `local-invoice-${row.id}`,
      entityType: 'invoice',
      entityId: row.id,
      action: 'created',
      title: purchase ? 'Purchase invoice registered' : 'Sales invoice registered',
      titleKey: purchase
        ? 'notifications.purchaseInvoiceCreated'
        : 'notifications.saleInvoiceCreated',
      bodyKey: 'notifications.invoiceRegisteredBody',
      params: { number: row.invoice_number },
      description: row.customer_name ? row.customer_name : undefined,
      createdAt: row.created_at,
      label: `#${row.invoice_number}`,
      subtitle: row.customer_name ?? undefined,
      amount: row.total,
      currency: row.currency,
      status: row.status,
      transactionType: purchase ? 'purchase' : 'sale',
      route: ROUTE.invoice(row.id),
      invoiceNumber: row.invoice_number,
    })
  }

  const payments = db.all<PaymentFeedRow>(
    `SELECT id, payment_number, direction, amount, currency, created_at
     FROM payment
     WHERE workspace_id = ? AND deleted_at IS NULL AND status <> 'cancelled'
     ORDER BY created_at DESC LIMIT ?`,
    [workspaceId, EVENTS_PER_KIND],
  )
  for (const row of payments) {
    const paidOut = row.direction === 'out'
    events.push({
      id: `local-payment-${row.id}`,
      entityType: 'payment',
      entityId: row.id,
      action: 'created',
      title: paidOut ? 'Payment sent' : 'Payment received',
      titleKey: paidOut ? 'notifications.paymentSent' : 'notifications.paymentReceived',
      bodyKey: row.payment_number ? 'notifications.paymentRecorded' : undefined,
      params: row.payment_number ? { ref: row.payment_number } : undefined,
      description: row.payment_number ?? undefined,
      createdAt: row.created_at,
      label: row.payment_number ?? 'Payment',
      subtitle: undefined,
      amount: row.amount,
      currency: row.currency,
      status: undefined,
      transactionType: undefined,
      route: ROUTE.payment(row.id),
      invoiceNumber: undefined,
    })
  }

  const customers = db.all<CustomerFeedRow>(
    `SELECT id, full_name, created_at
     FROM customer
     WHERE workspace_id = ? AND deleted_at IS NULL AND created_at <> ''
     ORDER BY created_at DESC LIMIT ?`,
    [workspaceId, EVENTS_PER_KIND],
  )
  for (const row of customers) {
    events.push({
      id: `local-customer-${row.id}`,
      entityType: 'customer',
      entityId: row.id,
      action: 'created',
      title: 'New customer added',
      titleKey: 'notifications.newCustomerAdded',
      bodyKey: 'notifications.customerCreated',
      params: { name: row.full_name },
      description: row.full_name,
      createdAt: row.created_at,
      label: row.full_name,
      subtitle: undefined,
      amount: undefined,
      currency: undefined,
      status: undefined,
      transactionType: undefined,
      route: ROUTE.customer(row.id),
      invoiceNumber: undefined,
    })
  }

  return events.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/* ─── Read state ─────────────────────────────────────────────────────────── */

interface ReadState {
  ids: Set<string>
  /** Everything created at or before this moment was marked read together. */
  allAt: string | null
}

function readStateOf(db: LocalDb, feed: string): ReadState {
  const row = db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', [`${feed}_read`])
  if (!row) return { ids: new Set(), allAt: null }
  try {
    const parsed = JSON.parse(row.value) as { ids?: unknown; allAt?: unknown }
    return {
      ids: new Set(Array.isArray(parsed.ids) ? parsed.ids.map(String) : []),
      allAt: typeof parsed.allAt === 'string' ? parsed.allAt : null,
    }
  } catch {
    // A damaged value is «nothing marked», not a crash of the bell.
    return { ids: new Set(), allAt: null }
  }
}

function saveReadState(db: LocalDb, feed: string, state: ReadState): void {
  // Only the newest few hundred are kept: an id older than `allAt` is covered by it.
  const ids = [...state.ids].slice(-500)
  db.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [
    `${feed}_read`,
    JSON.stringify({ ids, allAt: state.allAt }),
  ])
}

function isRead(state: ReadState, event: FeedEvent): boolean {
  return state.ids.has(event.id) || (state.allAt !== null && event.createdAt <= state.allAt)
}

function idsOf(body: unknown): string[] {
  const ids = (body as { ids?: unknown } | null)?.ids
  return Array.isArray(ids) ? ids.map(String) : []
}

function newestAt(events: readonly FeedEvent[]): string {
  return events[0]?.createdAt ?? new Date().toISOString()
}

/* ─── Routes ─────────────────────────────────────────────────────────────── */

export function registerFeedRoutes(router: Router): void {
  const actorName = (c: RouteHandlerContext): string => {
    const user = c.db.get<{ full_name: string }>('SELECT full_name FROM local_user LIMIT 1')
    return user?.full_name?.trim() || ''
  }

  // ─── activities ───────────────────────────────────────────
  router.get('/v1/activities', (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const state = readStateOf(db, 'activity')
    const actor = actorName(c)
    const search = query.search?.trim().toLowerCase()
    const entityType = query.entityType?.trim()
    const unreadOnly = query.unread === 'true'
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200)

    const events = eventsOf(db, ctx.workspaceId).filter((event) => {
      if (entityType && event.entityType !== entityType) return false
      if (unreadOnly && isRead(state, event)) return false
      if (!search) return true
      return [event.title, event.label, event.subtitle, event.description]
        .filter((part): part is string => Boolean(part))
        .some((part) => part.toLowerCase().includes(search))
    })

    const data = events.slice(0, limit).map((event) => {
      const read = isRead(state, event)
      return {
        entityType: event.entityType,
        entityId: event.entityId,
        entitySummary: {
          label: event.label,
          ...(event.subtitle ? { subtitle: event.subtitle } : {}),
          ...(event.amount !== undefined ? { amount: event.amount } : {}),
          ...(event.currency ? { currency: event.currency } : {}),
          ...(event.status ? { status: event.status } : {}),
          ...(event.transactionType ? { transactionType: event.transactionType } : {}),
          activityCount: 1,
          lastActivity: event.createdAt,
          route: event.route,
        },
        activities: [
          {
            id: event.id,
            action: event.action,
            title: event.title,
            ...(event.description ? { description: event.description } : {}),
            actor,
            actorRole: null,
            timestamp: event.createdAt,
            isRead: read,
            importance: 1,
            metadata: {
              title_key: event.titleKey,
              ...(event.bodyKey ? { body_key: event.bodyKey } : {}),
              ...(event.params ? { params: event.params } : {}),
            },
          },
        ],
        unreadCount: read ? 0 : 1,
        latestAt: event.createdAt,
        hasUnread: !read,
        priority: 'low',
      }
    })

    return { data, nextCursor: null, hasMore: events.length > limit, total: events.length }
  })

  router.get('/v1/activities/unread-count', (c: RouteHandlerContext) => {
    const state = readStateOf(c.db, 'activity')
    return {
      count: eventsOf(c.db, c.ctx.workspaceId).filter((event) => !isRead(state, event)).length,
    }
  })

  router.get('/v1/activities/counts', (c: RouteHandlerContext) => {
    const state = readStateOf(c.db, 'activity')
    const events = eventsOf(c.db, c.ctx.workspaceId)
    const count = (type: EntityType) => events.filter((e) => e.entityType === type).length
    const unread = (type: EntityType) =>
      events.filter((e) => e.entityType === type && !isRead(state, e)).length
    return {
      all: events.length,
      unread: events.filter((e) => !isRead(state, e)).length,
      invoices: count('invoice'),
      payments: count('payment'),
      customers: count('customer'),
      unreadBy: {
        invoices: unread('invoice'),
        payments: unread('payment'),
        customers: unread('customer'),
      },
    }
  })

  router.patch('/v1/activities/mark-read', (c: RouteHandlerContext) => {
    const state = readStateOf(c.db, 'activity')
    for (const id of idsOf(c.body)) state.ids.add(id)
    saveReadState(c.db, 'activity', state)
    return { success: true }
  })

  router.patch('/v1/activities/mark-all-read', (c: RouteHandlerContext) => {
    const events = eventsOf(c.db, c.ctx.workspaceId)
    const state = readStateOf(c.db, 'activity')
    const marked = events.filter((event) => !isRead(state, event)).length
    state.allAt = newestAt(events)
    saveReadState(c.db, 'activity', state)
    return { success: true, marked }
  })

  // ─── notifications (the bell) ─────────────────────────────
  router.get('/v1/notifications', (c: RouteHandlerContext) => {
    const state = readStateOf(c.db, 'notification')
    const events = eventsOf(c.db, c.ctx.workspaceId).filter((e) => e.entityType !== 'customer')
    const data = events.slice(0, 50).map((event) => ({
      id: event.id,
      title: event.title,
      body: event.description ?? null,
      type: 'success' as const,
      action_url: event.route,
      entity_type: event.entityType,
      entity_id: event.entityId,
      is_read: isRead(state, event),
      created_at: event.createdAt,
      metadata: {
        title_key: event.titleKey,
        ...(event.bodyKey ? { body_key: event.bodyKey } : {}),
        ...(event.params ? { params: event.params } : {}),
        ...(event.invoiceNumber ? { invoice_number: event.invoiceNumber } : {}),
        ...(event.subtitle ? { customer_name: event.subtitle } : {}),
        ...(event.amount !== undefined ? { total: event.amount } : {}),
        ...(event.currency ? { currency: event.currency } : {}),
        ...(event.status ? { status: event.status } : {}),
      },
    }))
    return { data, total: events.length }
  })

  router.get('/v1/notifications/unread-count', (c: RouteHandlerContext) => {
    const state = readStateOf(c.db, 'notification')
    const events = eventsOf(c.db, c.ctx.workspaceId).filter((e) => e.entityType !== 'customer')
    return { count: events.filter((event) => !isRead(state, event)).length }
  })

  router.patch('/v1/notifications/mark-read', (c: RouteHandlerContext) => {
    const state = readStateOf(c.db, 'notification')
    for (const id of idsOf(c.body)) state.ids.add(id)
    saveReadState(c.db, 'notification', state)
    return { success: true }
  })

  router.patch('/v1/notifications/mark-all-read', (c: RouteHandlerContext) => {
    const events = eventsOf(c.db, c.ctx.workspaceId).filter((e) => e.entityType !== 'customer')
    const state = readStateOf(c.db, 'notification')
    state.allAt = newestAt(events)
    saveReadState(c.db, 'notification', state)
    return { success: true }
  })
}
