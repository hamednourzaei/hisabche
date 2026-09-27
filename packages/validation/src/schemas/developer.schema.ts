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
  'write:customers',
  'write:products',
  'write:invoices',
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
 * it cannot act on. Payments and purchase orders join when their read scopes do.
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
