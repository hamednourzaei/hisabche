// ============================================
// backend/src/services/developer/developer.domain.ts
//
// The rules of the developer platform, as pure functions.
//
// ---------------------------------------------------------------------------
// AN API KEY IS ITS CREATOR, NARROWED
//
// A key authenticates as the person who created it (Odoo's model: a key never
// exceeds its user), pinned to ONE workspace, and then narrowed twice:
//
//   1. Routes. A key may call only the routes its scopes name in
//      API_ROUTE_SCOPES. Everything else is 403 — fail closed. This matters:
//      most routes check membership only, not a capability, so narrowing
//      capabilities alone would have left a read-only key able to write.
//   2. Capabilities. The request's capability set is the intersection of the
//      creator's and the scopes'. A route that also checks a capability sees
//      the narrower set.
//
// If the creator loses access to the workspace, the key stops working with
// them — membership is resolved on every request exactly as for a session.
// ============================================

import { createHash, randomBytes } from 'node:crypto'
import { isIP } from 'node:net'
import {
  API_KEY_DISPLAY_LENGTH,
  API_KEY_PATTERN,
  API_KEY_PREFIX,
  WEBHOOK_EVENTS,
  PUBLISHABLE_KEY_PATTERN,
  PUBLISHABLE_KEY_PREFIX,
  WEBHOOK_EVENT_RESOURCE,
  type ApiKeyScope,
  type WebhookEnvelope,
  type WebhookEventType,
} from '@hisabche/validation'

import type { Capability } from '../authorization'
import { capabilityFor, resolveGrant, type GrantDecision } from '../plugins/plugin.domain'

// ─── Keys ────────────────────────────────────────────────────────────────────

/** A new key: 32 random bytes, base64url — 256 bits nobody can guess. */
export function generateApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`
}

/** What is stored and looked up. The key itself never is. */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex')
}

/** The part of a key a list may show, so a person can tell keys apart. */
export function displayPrefix(key: string): string {
  return key.slice(0, API_KEY_DISPLAY_LENGTH)
}

export function looksLikeApiKey(token: string): boolean {
  return API_KEY_PATTERN.test(token)
}

/**
 * What the creator may actually put on a key: the intersection of what they
 * asked for and what they hold. A seller cannot mint a key that writes products.
 */
export function grantForKey(
  requested: ApiKeyScope[],
  creatorHolds: (capability: Capability) => boolean,
): GrantDecision {
  return resolveGrant(requested, creatorHolds)
}

/** The creator's capabilities, cut down to what the scopes allow. */
export function narrowCapabilities(
  creator: ReadonlySet<string>,
  scopes: readonly ApiKeyScope[],
): Set<string> {
  const allowed = new Set<string>(scopes.map((scope) => capabilityFor(scope)))
  // A write scope implies the matching read: creating a customer and then
  // reading it back is one integration, not two keys.
  if (allowed.has('customer.write')) allowed.add('customer.read')
  if (allowed.has('product.write')) allowed.add('product.read')
  if (allowed.has('invoice.create')) allowed.add('invoice.read')
  return new Set([...creator].filter((capability) => allowed.has(capability)))
}

// ─── Routes a key may call ───────────────────────────────────────────────────

/**
 * `METHOD route-pattern` → the scope that opens it. Route patterns are Fastify's
 * (`request.routeOptions.url`), so `/api/invoices/:id` is one entry, not a
 * family of URLs a string match could be tricked around.
 *
 * ⚠️ Deliberately absent: anything that deletes, posts to the ledger, records or
 * cancels money, or manages members. Those stay with people.
 */
export const API_ROUTE_SCOPES: Readonly<Record<string, ApiKeyScope>> = {
  'GET /api/invoices': 'read:invoices',
  'GET /api/invoices/:id': 'read:invoices',
  'GET /api/invoices/:id/related': 'read:invoices',
  'POST /api/invoices': 'write:invoices',

  'GET /api/customers': 'read:customers',
  'GET /api/customers/:id': 'read:customers',
  'GET /api/customers/:id/balance': 'read:customers',
  'POST /api/customers': 'write:customers',
  'PATCH /api/customers/:id': 'write:customers',

  'GET /api/products': 'read:products',
  'GET /api/products/:id': 'read:products',
  'GET /api/products/by-barcode/:code': 'read:products',
  'GET /api/products/low-stock': 'read:products',
  'GET /api/products/:id/stock-history': 'read:products',
  'POST /api/products': 'write:products',
  'PATCH /api/products/:id': 'write:products',

  'GET /api/accounting/customer-debt': 'read:reports',

  // Only the bare prefix: Fastify registers '/api/payments/' as a separate
  // route, and that one stays closed.
  'GET /api/payments': 'read:payments',
  'GET /api/payments/:id': 'read:payments',

  // Quantities and sell prices per warehouse — no cost (inventory.cost.read).
  'GET /api/warehouses': 'read:inventory',
  'GET /api/warehouses/:id/stock': 'read:inventory',

  // Orders: placed and moved along the lifecycle — never «paid» (it follows
  // the invoice) and never deleted.
  'GET /api/orders': 'read:orders',
  'GET /api/orders/:id': 'read:orders',
  'POST /api/orders': 'write:orders',
  'POST /api/orders/:id/confirm': 'write:orders',
  'POST /api/orders/:id/cancel': 'write:orders',
  'POST /api/orders/:id/fulfill': 'write:orders',
  'POST /api/orders/:id/invoice': 'write:orders',
}

/** Which scopes a write scope also satisfies for reading. */
const IMPLIED: Partial<Record<ApiKeyScope, ApiKeyScope>> = {
  'read:customers': 'write:customers',
  'read:products': 'write:products',
  'read:invoices': 'write:invoices',
  'read:orders': 'write:orders',
}

export type RouteDecision =
  | { allowed: true; scope: ApiKeyScope }
  | { allowed: false; reason: 'ROUTE_NOT_OPEN_TO_KEYS' | 'SCOPE_MISSING'; scope?: ApiKeyScope }

export function decideRoute(
  method: string,
  routeUrl: string | undefined,
  scopes: readonly ApiKeyScope[],
): RouteDecision {
  const needed = routeUrl ? API_ROUTE_SCOPES[`${method.toUpperCase()} ${routeUrl}`] : undefined
  if (!needed) return { allowed: false, reason: 'ROUTE_NOT_OPEN_TO_KEYS' }
  const implied = IMPLIED[needed]
  if (scopes.includes(needed) || (implied !== undefined && scopes.includes(implied))) {
    return { allowed: true, scope: needed }
  }
  return { allowed: false, reason: 'SCOPE_MISSING', scope: needed }
}

// ─── Events ──────────────────────────────────────────────────────────────────

/**
 * The public event a business event becomes, or null for one that is not part
 * of the catalogue. A payment is published twice on purpose: once as itself
 * (`payment.recorded`, read with `read:payments`) and once per invoice it
 * settles (`invoice.payment_recorded`) — the payments service logs both.
 *
 * ⚠️ `inventory.*` is NOT here: those come from the database trigger on the
 * stock projection (docs/developer-platform-02-migration.sql), because no
 * service sees every stock writer.
 */
export function publicEventFor(entityType: string, action: string): WebhookEventType | null {
  const map: Record<string, WebhookEventType> = {
    'invoice.created': 'invoice.created',
    'invoice.updated': 'invoice.updated',
    'invoice.cancelled': 'invoice.cancelled',
    'invoice.deleted': 'invoice.deleted',
    'invoice.posted_to_ledger': 'invoice.posted',
    'invoice.payment_recorded': 'invoice.payment_recorded',
    'customer.created': 'customer.created',
    'product.created': 'product.created',
    'payment.payment_recorded': 'payment.recorded',
    'payment.cancelled': 'payment.cancelled',
  }
  const type = map[`${entityType}.${action}`]
  return type && (WEBHOOK_EVENTS as readonly string[]).includes(type) ? type : null
}

export function buildEnvelope(input: {
  id: string
  type: WebhookEventType
  workspaceId: string
  entityId: string
  createdAt: Date
}): WebhookEnvelope {
  return {
    id: input.id,
    type: input.type,
    createdAt: input.createdAt.toISOString(),
    workspaceId: input.workspaceId,
    data: { resource: WEBHOOK_EVENT_RESOURCE[input.type].resource, id: input.entityId },
    apiVersion: 1,
  }
}

/** 1 min, 2, 4 … capped at 6 hours: eight attempts span about a day. */
export function webhookRetryDelaySeconds(attempts: number): number {
  return Math.min(60 * 2 ** Math.max(0, attempts - 1), 6 * 3600)
}

/** 2xx is delivered. Anything else, including a redirect, is a failed attempt. */
export function isDelivered(status: number): boolean {
  return status >= 200 && status < 300
}

// ─── Where a webhook may point ───────────────────────────────────────────────

/**
 * ⚠️ SSRF. A webhook URL is a request our server makes on a customer's behalf.
 * Pointed at `http://169.254.169.254/` or `https://localhost:5432/` it would
 * read our own infrastructure. Every address a host resolves to is checked, at
 * creation AND at delivery — DNS can change between the two.
 */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) {
    const [a, b] = address.split('.').map(Number) as [number, number, number, number]
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local, cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast, reserved, broadcast
    )
  }
  if (version === 6) {
    const lower = address.toLowerCase()
    if (lower === '::' || lower === '::1') return true
    if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7))
    return (
      lower.startsWith('fc') ||
      lower.startsWith('fd') || // unique local
      lower.startsWith('fe8') ||
      lower.startsWith('fe9') ||
      lower.startsWith('fea') ||
      lower.startsWith('feb') || // link-local
      lower.startsWith('ff') // multicast
    )
  }
  return true // not an address at all — refuse rather than guess
}

export type UrlCheck =
  { ok: true; host: string } | { ok: false; reason: 'NOT_HTTPS' | 'INVALID' | 'PRIVATE_HOST' }

/** The static half of the check (the DNS half runs where resolution can). */
export function checkWebhookUrl(raw: string): UrlCheck {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: 'INVALID' }
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'NOT_HTTPS' }
  if (url.username || url.password) return { ok: false, reason: 'INVALID' }
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    return { ok: false, reason: 'PRIVATE_HOST' }
  }
  if (isIP(host) && isPrivateAddress(host)) return { ok: false, reason: 'PRIVATE_HOST' }
  return { ok: true, host }
}

// ─── Rate limit ──────────────────────────────────────────────────────────────

/** Requests per minute for ONE key, shared by every instance (Redis store). */
export const API_KEY_RATE_LIMIT_PER_MINUTE = 120

/**
 * The rate-limit bucket for a request, decided before authentication runs.
 *
 * A request carrying an API key is counted against THAT KEY, not the IP: an
 * integration behind a shared office IP would otherwise spend the budget of
 * every person in the office, and a key spread over many IPs would get a new
 * budget per IP. The bucket is a hash — never the key itself (Redis keyspace).
 * A made-up key still gets a bucket; that is what limits guessing.
 */
export function rateLimitBucket(authorization: string | undefined, fallback: string): string {
  const token = authorization?.replace(/^Bearer\s+/i, '') ?? ''
  if (looksLikeApiKey(token)) return `apikey:${hashApiKey(token).slice(0, 32)}`
  return fallback
}

export function isApiKeyBucket(bucket: string): boolean {
  return bucket.startsWith('apikey:')
}

// ─── Publishable keys (storefront) ───────────────────────────────────────────

/** A new publishable key. Public by design; still unguessable, so it cannot be enumerated. */
export function generatePublishableKey(): string {
  return `${PUBLISHABLE_KEY_PREFIX}${randomBytes(32).toString('base64url')}`
}

export function looksLikePublishableKey(token: string): boolean {
  return PUBLISHABLE_KEY_PATTERN.test(token)
}

/**
 * May a browser on `origin` use this key?
 *
 * ⚠️ HONEST LIMIT: an Origin header proves nothing about a server-side
 * caller, who can send any Origin or none. A publishable key is public; the
 * origin list stops OTHER WEBSITES from embedding the shop in a browser, not a
 * script from calling it. That is why the key can do so little: read what the
 * shop already publishes, and place an order a person must confirm.
 *
 * No Origin header (a server, curl) → allowed. An Origin not on the list →
 * refused.
 */
export function originAllowed(allowed: readonly string[], origin: string | undefined): boolean {
  if (!origin) return true
  return allowed.includes(origin)
}
