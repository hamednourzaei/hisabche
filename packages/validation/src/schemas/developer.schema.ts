// ============================================
// packages/validation/src/schemas/developer.schema.ts
//
// The contract an outside system integrates against: API-key scopes, the
// public event catalogue, and how a webhook delivery is signed.
//
// ---------------------------------------------------------------------------
// WHY IT LIVES HERE
//
// The backend enforces it, the developer screen renders it, and an integrator
// verifies against it — three consumers of one contract. The signature helpers
// use WebCrypto only (`globalThis.crypto.subtle`), so the same file runs in
// Node 18+, browsers, Electron and edge runtimes without a Node import.
//
// ---------------------------------------------------------------------------
// THE PATTERN, AND WHY THIS ONE
//
// Xero, QuickBooks and ERPNext sign the raw body with HMAC-SHA256. That proves
// who sent a delivery but not WHEN: a captured delivery can be replayed forever.
// The stronger, widely copied shape signs `timestamp + "." + body` and puts the
// timestamp in the header, so a receiver can refuse anything older than a few
// minutes. Payloads are THIN — an event says what changed and where, and the
// receiver reads the record through the API with its own scoped key. Nothing
// travels in a webhook that the receiving key could not read anyway, and the
// books stay the one source of truth.
// ============================================

import { z } from 'zod'

// ─── Scopes ──────────────────────────────────────────────────────────────────

/**
 * What an API key (or an installed app) may be granted. A closed set: adding
 * one is a code change, reviewed like any permission change.
 *
 * ⚠️ Nothing here posts to the ledger, cancels a payment or manages members —
 * see FORBIDDEN_TO_PLUGINS in backend/src/services/plugins/plugin.domain.ts.
 */
export const INTEGRATION_SCOPES = [
  'read:invoices',
  'read:customers',
  'read:products',
  'read:reports',
  'read:payments',
  'read:inventory',
  'read:orders',
  'write:customers',
  'write:products',
  'write:invoices',
  'write:orders',
  'subscribe:events',
  'ui:widget',
  'ui:page',
] as const
export type IntegrationScope = (typeof INTEGRATION_SCOPES)[number]

/** The scopes an API key can carry. The two `ui:` scopes belong to installed apps. */
export const API_KEY_SCOPES = INTEGRATION_SCOPES.filter(
  (scope): scope is Exclude<IntegrationScope, 'ui:widget' | 'ui:page'> => !scope.startsWith('ui:'),
)
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]

// ─── Keys ────────────────────────────────────────────────────────────────────

/** Every key starts with this — so a leaked key is recognisable in a scan. */
export const API_KEY_PREFIX = 'hk_live_'
/** Characters of the key shown in lists («hk_live_ab12cd…»); the rest is never stored. */
export const API_KEY_DISPLAY_LENGTH = 16
export const API_KEY_PATTERN = /^hk_live_[A-Za-z0-9_-]{43}$/

export const apiKeyCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z
    .array(z.enum(API_KEY_SCOPES as unknown as [ApiKeyScope, ...ApiKeyScope[]]))
    .min(1)
    .max(API_KEY_SCOPES.length)
    .transform((scopes) => [...new Set(scopes)]),
  /** Days until it stops working. Omitted = until revoked. */
  expiresInDays: z.number().int().min(1).max(3650).optional(),
})
export type ApiKeyCreateInput = z.infer<typeof apiKeyCreateSchema>

// ─── Events ──────────────────────────────────────────────────────────────────

/**
 * Every event a webhook can subscribe to. Each is emitted from the domain
 * service that owns the change (via logBusinessEvent), never from a route —
 * an event exists only when the thing it names really happened.
 *
 * ⚠️ Only events whose resource an API key can READ. A payload is thin (type +
 * id); an event naming something the receiver cannot fetch is a notification
 * it cannot act on. Purchase orders and sales orders join when their read scopes and lifecycles do.
 */
export const WEBHOOK_EVENTS = [
  'invoice.created',
  'invoice.updated',
  'invoice.cancelled',
  'invoice.deleted',
  'invoice.posted',
  'invoice.payment_recorded',
  'customer.created',
  'product.created',
  'payment.recorded',
  'payment.cancelled',
  // From a database trigger on the stock projection, on the CROSSING of
  // min_stock_level only (docs/developer-platform-02-migration.sql).
  'inventory.low_stock',
  'inventory.restocked',
  // From the order lifecycle functions — one per transition, in the same
  // transaction (docs/developer-platform-03-commerce-migration.sql).
  'order.created',
  'order.confirmed',
  'order.cancelled',
  'order.invoiced',
  'order.paid',
  'order.payment_reversed',
  'order.fulfilled',
] as const
export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number]

/** The resource an event names, and the API scope needed to read it. */
export const WEBHOOK_EVENT_RESOURCE: Record<
  WebhookEventType,
  { resource: string; scope: ApiKeyScope }
> = {
  'invoice.created': { resource: 'invoice', scope: 'read:invoices' },
  'invoice.updated': { resource: 'invoice', scope: 'read:invoices' },
  'invoice.cancelled': { resource: 'invoice', scope: 'read:invoices' },
  'invoice.deleted': { resource: 'invoice', scope: 'read:invoices' },
  'invoice.posted': { resource: 'invoice', scope: 'read:invoices' },
  'invoice.payment_recorded': { resource: 'invoice', scope: 'read:invoices' },
  'customer.created': { resource: 'customer', scope: 'read:customers' },
  'product.created': { resource: 'product', scope: 'read:products' },
  'payment.recorded': { resource: 'payment', scope: 'read:payments' },
  'payment.cancelled': { resource: 'payment', scope: 'read:payments' },
  'inventory.low_stock': { resource: 'product', scope: 'read:products' },
  'inventory.restocked': { resource: 'product', scope: 'read:products' },
  'order.created': { resource: 'sales_order', scope: 'read:orders' },
  'order.confirmed': { resource: 'sales_order', scope: 'read:orders' },
  'order.cancelled': { resource: 'sales_order', scope: 'read:orders' },
  'order.invoiced': { resource: 'sales_order', scope: 'read:orders' },
  'order.paid': { resource: 'sales_order', scope: 'read:orders' },
  'order.payment_reversed': { resource: 'sales_order', scope: 'read:orders' },
  'order.fulfilled': { resource: 'sales_order', scope: 'read:orders' },
}

/** A test delivery sent from the developer screen. Not subscribable. */
export const WEBHOOK_PING_EVENT = 'webhook.ping' as const

/** What every delivery's body looks like. */
export interface WebhookEnvelope {
  /** Unique per event; the same across retries — deduplicate on it. */
  id: string
  type: WebhookEventType | typeof WEBHOOK_PING_EVENT
  /** ISO time the change happened. */
  createdAt: string
  workspaceId: string
  data: {
    resource: string
    id: string
  }
  /** Version of this envelope. Bumped only on a breaking change. */
  apiVersion: 1
}

export const webhookEndpointCreateSchema = z.object({
  url: z
    .string()
    .trim()
    .url()
    .max(2000)
    .refine((u) => u.startsWith('https://'), { message: 'webhook.urlMustBeHttps' }),
  description: z.string().trim().max(200).optional(),
  events: z
    .array(z.enum(WEBHOOK_EVENTS as unknown as [WebhookEventType, ...WebhookEventType[]]))
    .min(1)
    .transform((events) => [...new Set(events)]),
})
export type WebhookEndpointCreateInput = z.infer<typeof webhookEndpointCreateSchema>

export const webhookEndpointUpdateSchema = z.object({
  description: z.string().trim().max(200).nullable().optional(),
  events: webhookEndpointCreateSchema.shape.events.optional(),
  isActive: z.boolean().optional(),
})
export type WebhookEndpointUpdateInput = z.infer<typeof webhookEndpointUpdateSchema>

// ─── Signatures ──────────────────────────────────────────────────────────────

export const WEBHOOK_SIGNATURE_HEADER = 'Hisabche-Signature'
/**
 * Present (value `true`) when the delivery is a replay a person asked for. The
 * event id is the original one; a receiver that deduplicates on the id should
 * let a replay through.
 */
export const WEBHOOK_REPLAY_HEADER = 'Hisabche-Replay'
/** A delivery older than this is refused by `verifyWebhookSignature`. */
export const WEBHOOK_TOLERANCE_SECONDS = 300

const encoder = new TextEncoder()

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">` */
export async function signWebhookPayload(
  secret: string,
  body: string,
  timestampSeconds: number,
): Promise<string> {
  return `t=${timestampSeconds},v1=${await hmacHex(secret, `${timestampSeconds}.${body}`)}`
}

/** Length-independent comparison: a mismatch never returns early. */
function sameText(a: string, b: string): boolean {
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return diff === 0
}

export type WebhookVerification =
  | { valid: true; timestamp: number }
  | { valid: false; reason: 'malformed' | 'expired' | 'mismatch' }

/**
 * What a receiver runs on every delivery, with the RAW body (before JSON
 * parsing — re-serialising changes the bytes and breaks the HMAC).
 */
export async function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  header: string | null | undefined,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  toleranceSeconds: number = WEBHOOK_TOLERANCE_SECONDS,
): Promise<WebhookVerification> {
  const parts = Object.fromEntries(
    (header ?? '').split(',').map((part) => {
      const [k, ...v] = part.trim().split('=')
      return [k, v.join('=')]
    }),
  ) as Record<string, string | undefined>
  const timestamp = Number(parts.t)
  const given = parts.v1
  if (!Number.isInteger(timestamp) || !given || !/^[0-9a-f]{64}$/.test(given)) {
    return { valid: false, reason: 'malformed' }
  }
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds)
    return { valid: false, reason: 'expired' }
  const expected = await hmacHex(secret, `${timestamp}.${rawBody}`)
  return sameText(expected, given)
    ? { valid: true, timestamp }
    : { valid: false, reason: 'mismatch' }
}

// ─── Storefront: publishable keys and orders ─────────────────────────────────
//
// THE SECURITY CONTRACT (docs/developer-platform-03-commerce-migration.sql):
// a publishable key is PUBLIC — it sits in a website's HTML. It reads the
// catalogue and availability and creates a PENDING order. The body of an order
// carries product ids, quantities and contact details; every schema below is
// `.strict()`, so a request that also sends a price, a total or a status is
// REFUSED (400), never silently trimmed.

export const PUBLISHABLE_KEY_PREFIX = 'hk_pub_'
export const PUBLISHABLE_KEY_PATTERN = /^hk_pub_[A-Za-z0-9_-]{43}$/
export const PUBLISHABLE_KEY_HEADER = 'Hisabche-Publishable-Key'

/** An origin as a browser sends it: scheme + host (+ port), nothing else. */
export const originSchema = z
  .string()
  .trim()
  .max(200)
  .refine(
    (value) => {
      try {
        const url = new URL(value)
        const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
        return (
          (url.protocol === 'https:' || (url.protocol === 'http:' && local)) && url.origin === value
        )
      } catch {
        return false
      }
    },
    { message: 'storefront.originInvalid' },
  )

export const publishableKeyCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    /** Sites allowed to call from a browser. At least one: a key for «anywhere» is not offered. */
    allowedOrigins: z
      .array(originSchema)
      .min(1)
      .max(20)
      .transform((origins) => [...new Set(origins)]),
  })
  .strict()
export type PublishableKeyCreateInput = z.infer<typeof publishableKeyCreateSchema>

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'invoiced',
  'paid',
  'fulfilled',
  'cancelled',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const storefrontSettingsSchema = z
  .object({
    orderConfirmation: z.enum(['manual', 'automatic']),
    stockDisplay: z.enum(['availability', 'quantity']),
    pendingExpiryHours: z.number().int().min(1).max(720),
    maxItemsPerOrder: z.number().int().min(1).max(200),
    maxPendingPerContact: z.number().int().min(1).max(100),
  })
  .strict()
export type StorefrontSettings = z.infer<typeof storefrontSettingsSchema>

/** What the platform uses when a workspace has saved nothing (G4). */
export const STOREFRONT_DEFAULTS: StorefrontSettings = {
  orderConfirmation: 'manual',
  stockDisplay: 'availability',
  pendingExpiryHours: 48,
  maxItemsPerOrder: 50,
  maxPendingPerContact: 5,
}

export const orderCreateSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            productId: z.string().uuid(),
            quantity: z.number().positive().max(100_000),
          })
          .strict(),
      )
      .min(1)
      .max(200),
    customer: z
      .object({
        name: z.string().trim().min(1).max(120),
        phone: z
          .string()
          .trim()
          .regex(/^[+0-9۰-۹٠-٩][0-9۰-۹٠-٩ ()-]{4,31}$/, { message: 'storefront.phoneInvalid' }),
        email: z.string().trim().email().max(200).optional(),
        note: z.string().trim().max(500).optional(),
      })
      .strict(),
  })
  .strict()
export type OrderCreateInput = z.infer<typeof orderCreateSchema>

/**
 * Every refusal the order lifecycle can answer with. The backend maps each to
 * an HTTP status (orders.domain.ts — typed against this list, so the two
 * cannot drift) and every screen has a sentence for each (all three locales).
 */
export const ORDER_ERROR_CODES = [
  'ORDER_NOT_FOUND',
  'ORDER_TRANSITION_INVALID',
  'ORDER_INVOICE_REQUIRED',
  'ORDER_INSUFFICIENT_STOCK',
  'ORDER_CUSTOMER_AMBIGUOUS',
  'ORDER_CUSTOMER_REQUIRED',
  'ORDER_PRODUCT_NOT_FOUND',
  'ORDER_PRODUCT_NOT_PRICED',
  'ORDER_QUANTITY_INVALID',
  'ORDER_ITEMS_REQUIRED',
  'ORDER_TOO_MANY_ITEMS',
  'ORDER_CUSTOMER_NAME_REQUIRED',
  'ORDER_CUSTOMER_PHONE_REQUIRED',
  'ORDER_SOURCE_INVALID',
  'ORDER_TOO_MANY_PENDING',
] as const
export type OrderErrorCode = (typeof ORDER_ERROR_CODES)[number]
