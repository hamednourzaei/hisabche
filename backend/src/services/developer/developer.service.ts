// ============================================
// backend/src/services/developer/developer.service.ts
//
// API keys and outbound webhooks for one workspace. Rules live in
// developer.domain.ts, database calls in developer.repository.ts; this file
// orders them and makes the one network call (the delivery itself).
//
// ---------------------------------------------------------------------------
// WHAT IS SHOWN ONCE
//
// A key's plain text and a webhook's signing secret are returned exactly once:
// in the response that created (or rotated) them. Afterwards only the key's
// hash and the secret in a table no client can read exist. «I lost it» is
// answered by revoking and creating a new one — the Stripe, GitHub and Odoo
// behaviour, and the only one that keeps a database dump from being a key ring.
// ============================================

import { randomBytes, randomUUID } from 'node:crypto'
import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import { request as httpsRequest } from 'node:https'
import type { LookupFunction } from 'node:net'
import {
  WEBHOOK_EVENTS,
  WEBHOOK_PING_EVENT,
  WEBHOOK_SIGNATURE_HEADER,
  signWebhookPayload,
  type ApiKeyCreateInput,
  type ApiKeyScope,
  type WebhookEndpointCreateInput,
  type WebhookEndpointUpdateInput,
} from '@hisabche/validation'

import { holds, type Capability } from '../authorization'
import type { TenancyContext } from '../tenancy.service'
import { WORKER_ID } from '../distributed-work'
import { memoryCache } from '../../utils/pagination'
import {
  buildEnvelope,
  checkWebhookUrl,
  displayPrefix,
  generateApiKey,
  grantForKey,
  hashApiKey,
  isDelivered,
  isPrivateAddress,
  looksLikeApiKey,
  publicEventFor,
  webhookRetryDelaySeconds,
} from './developer.domain'
import {
  NotConfiguredError,
  developerRepository,
  type ApiKeyRow,
  type DeliveryRow,
  type DeveloperRepository,
} from './developer.repository'

/** Refusals a route turns into a 4xx with this code. */
export class DeveloperError extends Error {
  constructor(
    readonly code:
      | 'NO_SCOPE_GRANTED'
      | 'WEBHOOK_URL_NOT_HTTPS'
      | 'WEBHOOK_URL_INVALID'
      | 'WEBHOOK_URL_PRIVATE'
      | 'NOT_FOUND',
    readonly statusCode: number,
    readonly detail?: Record<string, unknown>,
  ) {
    super(code)
    this.name = 'DeveloperError'
  }
}

/** What an authenticated key puts on the request. */
export interface ApiKeyPrincipal {
  id: string
  workspaceId: string
  createdBy: string
  scopes: ApiKeyScope[]
}

const KEY_CACHE_SECONDS = 60
const keyCacheKey = (hash: string) => `apikey:${hash}`

/** One claim per poll; each delivery is a request to somebody else's server. */
const DELIVERY_BATCH = 20
const DELIVERY_LEASE_SECONDS = 60
const DELIVERY_TIMEOUT_MS = 10_000
/** What is kept of a receiver's error body — enough to debug, not a log sink. */
const ERROR_TEXT_LIMIT = 300

// ─── The one outbound request ────────────────────────────────────────────────

/**
 * A DNS lookup that refuses private addresses AT CONNECT TIME. Checking the
 * name before the request and connecting afterwards leaves a gap a rebinding
 * DNS server walks through; checking the address the socket is about to use
 * does not.
 */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, '', 0)
    const list = addresses as LookupAddress[]
    const blocked = list.find((a) => isPrivateAddress(a.address))
    if (blocked || list.length === 0) {
      return callback(Object.assign(new Error('WEBHOOK_URL_PRIVATE'), { code: 'EPRIVATE' }), '', 0)
    }
    if (options.all) return callback(null, list)
    const first = list[0] as LookupAddress
    return callback(null, first.address, first.family)
  })
}

export interface PostResult {
  status: number | null
  error: string | null
}

export type WebhookPoster = (
  url: string,
  body: string,
  headers: Record<string, string>,
) => Promise<PostResult>

/** POST without following redirects: a redirect is a failed delivery, not a hop to wherever it points. */
export const postWebhook: WebhookPoster = (url, body, headers) =>
  new Promise((resolve) => {
    const req = httpsRequest(
      url,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body).toString() },
        lookup: guardedLookup,
        timeout: DELIVERY_TIMEOUT_MS,
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          if (text.length < ERROR_TEXT_LIMIT) text += chunk
        })
        res.on('end', () => {
          const status = res.statusCode ?? 0
          resolve({
            status,
            error: isDelivered(status)
              ? null
              : `HTTP ${status} ${text.slice(0, ERROR_TEXT_LIMIT)}`.trim(),
          })
        })
      },
    )
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', (err) =>
      resolve({ status: null, error: err.message.slice(0, ERROR_TEXT_LIMIT) }),
    )
    req.end(body)
  })

/** The static URL rule, as the error a route answers with. */
function assertWebhookUrl(url: string): void {
  const check = checkWebhookUrl(url)
  if (check.ok) return
  const code =
    check.reason === 'NOT_HTTPS'
      ? 'WEBHOOK_URL_NOT_HTTPS'
      : check.reason === 'PRIVATE_HOST'
        ? 'WEBHOOK_URL_PRIVATE'
        : 'WEBHOOK_URL_INVALID'
  throw new DeveloperError(code, 400)
}

function newSecret(): string {
  return `whsec_${randomBytes(32).toString('base64url')}`
}

// ─── The service ─────────────────────────────────────────────────────────────

export function createDeveloperService(
  repo: DeveloperRepository = developerRepository,
  post: WebhookPoster = postWebhook,
) {
  async function deliver(
    delivery: DeliveryRow,
    secrets: Map<string, string>,
    urls: Map<string, string>,
  ) {
    const secret = secrets.get(delivery.endpoint_id)
    const url = urls.get(delivery.endpoint_id)
    if (!secret || !url) {
      await repo.failDelivery(
        delivery.id,
        WORKER_ID,
        'endpoint has no secret or url',
        null,
        webhookRetryDelaySeconds(delivery.attempts),
      )
      return 'failed' as const
    }
    const body = JSON.stringify(delivery.payload)
    const signature = await signWebhookPayload(secret, body, Math.floor(Date.now() / 1000))
    const result = await post(url, body, {
      'Content-Type': 'application/json',
      'User-Agent': 'Hisabche-Webhooks/1',
      [WEBHOOK_SIGNATURE_HEADER]: signature,
      'Hisabche-Event-Id': delivery.event_id,
      'Hisabche-Event-Type': delivery.event_type,
    })
    if (result.status !== null && isDelivered(result.status)) {
      await repo.completeDelivery(delivery.id, WORKER_ID, result.status)
      return 'sent' as const
    }
    await repo.failDelivery(
      delivery.id,
      WORKER_ID,
      result.error ?? 'delivery failed',
      result.status,
      webhookRetryDelaySeconds(delivery.attempts),
    )
    return 'failed' as const
  }

  async function deliverClaimed(claimed: DeliveryRow[]) {
    const ids = [...new Set(claimed.map((d) => d.endpoint_id))]
    const [secrets, urls] = await Promise.all([repo.secretsFor(ids), repo.endpointUrls(ids)])
    const counts = { sent: 0, failed: 0 }
    for (const delivery of claimed) {
      counts[await deliver(delivery, secrets, urls)]++
    }
    return counts
  }

  return {
    // ─── keys ────────────────────────────────────────────────────────────────

    /** The key's plain text is in this return value and nowhere else, ever. */
    async createKey(ctx: TenancyContext, input: ApiKeyCreateInput) {
      const grant = grantForKey(input.scopes, (cap: Capability) => holds(ctx, cap))
      if (grant.granted.length === 0) {
        throw new DeveloperError('NO_SCOPE_GRANTED', 403, { refused: grant.refused })
      }
      const key = generateApiKey()
      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString()
        : null
      const row = await repo.insertKey({
        workspace_id: ctx.workspaceId,
        created_by: ctx.userId,
        name: input.name,
        prefix: displayPrefix(key),
        key_hash: hashApiKey(key),
        scopes: grant.granted as ApiKeyScope[],
        expires_at: expiresAt,
      })
      return { key: row, secret: key, refused: grant.refused }
    },

    listKeys(ctx: TenancyContext): Promise<ApiKeyRow[]> {
      return repo.listKeys(ctx.workspaceId)
    },

    async revokeKey(ctx: TenancyContext, id: string): Promise<void> {
      const revoked = await repo.revokeKey(ctx.workspaceId, id, ctx.userId)
      if (!revoked) throw new DeveloperError('NOT_FOUND', 404)
      // Every instance stops accepting it now, not when its cache expires.
      await memoryCache.invalidate(keyCacheKey(revoked.key_hash))
    },

    /**
     * The principal for a presented key, or null. Cached by HASH for a minute
     * in the shared cache, so revocation (which clears it) reaches every
     * instance at once.
     */
    async authenticateKey(raw: string): Promise<ApiKeyPrincipal | null> {
      if (!looksLikeApiKey(raw)) return null
      const hash = hashApiKey(raw)
      const cached = await memoryCache.getShared<{
        principal: ApiKeyPrincipal | null
        expiresAt: string | null
      }>(keyCacheKey(hash))
      if (cached) {
        if (cached.expiresAt && new Date(cached.expiresAt).getTime() <= Date.now()) return null
        return cached.principal
      }
      const row = await repo.findLiveKeyByHash(hash)
      const principal: ApiKeyPrincipal | null = row
        ? {
            id: row.id,
            workspaceId: row.workspace_id,
            createdBy: row.created_by,
            scopes: row.scopes as ApiKeyScope[],
          }
        : null
      await memoryCache.setShared(
        keyCacheKey(hash),
        { principal, expiresAt: row?.expires_at ?? null },
        KEY_CACHE_SECONDS,
      )
      if (row) {
        repo
          .touchKey(row.id)
          .catch((err) => console.error('[api-keys] last_used_at not recorded:', err))
      }
      return principal
    },

    // ─── endpoints ───────────────────────────────────────────────────────────

    /** The endpoint, and its signing secret — shown this once. */
    async createEndpoint(ctx: TenancyContext, input: WebhookEndpointCreateInput) {
      assertWebhookUrl(input.url)
      const secret = newSecret()
      const endpoint = await repo.insertEndpoint(
        {
          workspace_id: ctx.workspaceId,
          created_by: ctx.userId,
          url: input.url,
          description: input.description ?? null,
          events: input.events,
        },
        secret,
      )
      return { endpoint, secret }
    },

    listEndpoints(ctx: TenancyContext) {
      return repo.listEndpoints(ctx.workspaceId)
    },

    async updateEndpoint(ctx: TenancyContext, id: string, input: WebhookEndpointUpdateInput) {
      const updated = await repo.updateEndpoint(ctx.workspaceId, id, {
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.events !== undefined ? { events: input.events } : {}),
        // Turning an endpoint back on is a person saying «it is fixed»: the
        // failure count and the reason it was switched off start over.
        ...(input.isActive !== undefined
          ? input.isActive
            ? { is_active: true, disabled_reason: null, consecutive_failures: 0 }
            : { is_active: false, disabled_reason: 'DISABLED_BY_USER' }
          : {}),
      })
      if (!updated) throw new DeveloperError('NOT_FOUND', 404)
      return updated
    },

    async deleteEndpoint(ctx: TenancyContext, id: string): Promise<void> {
      if (!(await repo.deleteEndpoint(ctx.workspaceId, id)))
        throw new DeveloperError('NOT_FOUND', 404)
    },

    async rotateSecret(ctx: TenancyContext, id: string): Promise<{ secret: string }> {
      if (!(await repo.getEndpoint(ctx.workspaceId, id))) throw new DeveloperError('NOT_FOUND', 404)
      const secret = newSecret()
      await repo.setSecret(id, secret)
      return { secret }
    },

    /** A ping to one endpoint, delivered now; the result is the delivery row. */
    async sendTest(ctx: TenancyContext, id: string): Promise<DeliveryRow> {
      const endpoint = await repo.getEndpoint(ctx.workspaceId, id)
      if (!endpoint) throw new DeveloperError('NOT_FOUND', 404)
      const eventId = randomUUID()
      const row = await repo.insertDelivery({
        workspace_id: ctx.workspaceId,
        endpoint_id: id,
        event_id: eventId,
        event_type: WEBHOOK_PING_EVENT,
        payload: {
          id: eventId,
          type: WEBHOOK_PING_EVENT,
          createdAt: new Date().toISOString(),
          workspaceId: ctx.workspaceId,
          data: { resource: 'webhook_endpoint', id },
          apiVersion: 1,
        },
      })
      const claimed = await repo.claimDeliveries(WORKER_ID, 1, DELIVERY_LEASE_SECONDS, row.id)
      if (claimed.length > 0) await deliverClaimed(claimed)
      const [latest] = (await repo.listDeliveries(ctx.workspaceId, id, 20)).filter(
        (d) => d.id === row.id,
      )
      return latest ?? row
    },

    async listDeliveries(ctx: TenancyContext, endpointId: string) {
      if (!(await repo.getEndpoint(ctx.workspaceId, endpointId)))
        throw new DeveloperError('NOT_FOUND', 404)
      return repo.listDeliveries(ctx.workspaceId, endpointId, 50)
    },

    async retryDelivery(ctx: TenancyContext, deliveryId: string): Promise<DeliveryRow> {
      const row = await repo.requeueDelivery(ctx.workspaceId, deliveryId)
      if (!row) throw new DeveloperError('NOT_FOUND', 404)
      return row
    },

    eventCatalogue() {
      return WEBHOOK_EVENTS
    },

    // ─── the event path ──────────────────────────────────────────────────────

    /**
     * Called from logBusinessEvent for every business event. Most are not in
     * the public catalogue and return at once; the rest become one delivery
     * per subscribed endpoint, written in one database statement.
     *
     * Never throws: an integration must not be able to fail an invoice.
     */
    async emitEvent(input: {
      workspaceId: string
      entityType: string
      action: string
      entityId: string
    }) {
      const type = publicEventFor(input.entityType, input.action)
      if (!type) return 0
      try {
        const envelope = buildEnvelope({
          id: randomUUID(),
          type,
          workspaceId: input.workspaceId,
          entityId: input.entityId,
          createdAt: new Date(),
        })
        return await repo.enqueueEvent(input.workspaceId, envelope.id, type, envelope)
      } catch (err) {
        // Before the migration there is nothing to enqueue into — quiet.
        if (err instanceof NotConfiguredError) return 0
        console.error(`[webhooks] enqueue ${type} failed:`, err)
        return 0
      }
    },

    /** One poll: due deliveries, claimed by this instance only. */
    async drainWebhooks() {
      const claimed = await repo.claimDeliveries(
        WORKER_ID,
        DELIVERY_BATCH,
        DELIVERY_LEASE_SECONDS,
        null,
      )
      if (claimed.length === 0) return { sent: 0, failed: 0 }
      return deliverClaimed(claimed)
    },
  }
}

export const developerService = createDeveloperService()
export type DeveloperService = ReturnType<typeof createDeveloperService>
