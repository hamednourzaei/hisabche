// ============================================
// backend/src/services/developer/developer.repository.ts
//
// Every database call of the developer platform, and nothing else. Explicit
// column lists everywhere — `key_hash` and secrets are never selected into a
// row that leaves this file except where the caller exists to use them.
// ============================================

import { supabase } from '../../db'
import { isMissingSchema } from '../blog/blog.domain'

export class NotConfiguredError extends Error {
  constructor() {
    super('DEVELOPER_PLATFORM_NOT_CONFIGURED')
    this.name = 'NotConfiguredError'
  }
}

function check(error: { code?: string; message?: string } | null): void {
  if (!error) return
  if (isMissingSchema(error)) throw new NotConfiguredError()
  throw Object.assign(new Error(error.message ?? 'database error'), { code: error.code })
}

export interface ApiKeyRow {
  id: string
  workspace_id: string
  created_by: string
  name: string
  prefix: string
  scopes: string[]
  expires_at: string | null
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

const KEY_COLUMNS =
  'id, workspace_id, created_by, name, prefix, scopes, expires_at, last_used_at, revoked_at, created_at'

export interface EndpointRow {
  id: string
  workspace_id: string
  url: string
  description: string | null
  events: string[]
  is_active: boolean
  disabled_reason: string | null
  consecutive_failures: number
  created_at: string
  updated_at: string
}

export interface PublishableKeyRow {
  id: string
  name: string
  prefix: string
  public_token: string
  allowed_origins: string[]
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

const PUBLISHABLE_COLUMNS =
  'id, name, prefix, public_token, allowed_origins, last_used_at, revoked_at, created_at'

const ENDPOINT_COLUMNS =
  'id, workspace_id, url, description, events, is_active, disabled_reason, consecutive_failures, created_at, updated_at'

export interface DeliveryRow {
  id: string
  workspace_id: string
  endpoint_id: string
  event_id: string
  event_type: string
  payload: Record<string, unknown>
  status: 'pending' | 'delivering' | 'succeeded' | 'failed'
  attempts: number
  max_attempts: number
  next_attempt_at: string
  last_status_code: number | null
  last_error: string | null
  created_at: string
  delivered_at: string | null
  /**
   * Set by replay_webhook_deliveries (migration 02). Only on rows returned by
   * the claim function — never selected by name, so the delivery list keeps
   * working on a database where 02 has not run yet.
   */
  replayed_at?: string | null | undefined
}

export interface RequestLogRow {
  method: string
  route: string
  status: number
  duration_ms: number
  created_at: string
}

export interface UsageDay {
  day: string
  requests: number
  client_errors: number
  server_errors: number
  avg_ms: number | null
}

const DELIVERY_COLUMNS =
  'id, workspace_id, endpoint_id, event_id, event_type, payload, status, attempts, max_attempts, next_attempt_at, last_status_code, last_error, created_at, delivered_at'

export const developerRepository = {
  // ─── keys ──────────────────────────────────────────────────────────────────

  async insertKey(row: {
    workspace_id: string
    created_by: string
    name: string
    prefix: string
    key_hash: string
    scopes: string[]
    expires_at: string | null
    /** Set only for an installed OAuth app's token (migration 05). */
    app_id?: string | undefined
  }): Promise<ApiKeyRow> {
    const { data, error } = await supabase.from('api_keys').insert(row).select(KEY_COLUMNS).single()
    check(error)
    return data as ApiKeyRow
  },

  async listKeys(workspaceId: string): Promise<ApiKeyRow[]> {
    const { data, error } = await supabase
      .from('api_keys')
      .select(KEY_COLUMNS)
      .eq('workspace_id', workspaceId)
      // Secret keys only. By prefix, not by `kind`: this list must keep
      // working on a database where migration 03 (which adds `kind`) has not run.
      .like('prefix', 'hk_live_%')
      .order('created_at', { ascending: false })
    check(error)
    return (data ?? []) as ApiKeyRow[]
  },

  async revokeKey(
    workspaceId: string,
    id: string,
    by: string,
  ): Promise<{ key_hash: string } | null> {
    const { data, error } = await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString(), revoked_by: by })
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .is('revoked_at', null)
      .select('key_hash')
      .maybeSingle()
    check(error)
    return (data as { key_hash: string } | null) ?? null
  },

  /** The live key for a hash, or null (unknown, revoked, or expired). */
  async findLiveKeyByHash(hash: string): Promise<ApiKeyRow | null> {
    const { data, error } = await supabase
      .from('api_keys')
      .select(KEY_COLUMNS)
      .eq('key_hash', hash)
      .is('revoked_at', null)
      .maybeSingle()
    check(error)
    const row = (data as ApiKeyRow | null) ?? null
    if (row?.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return null
    return row
  },

  /** At most once a minute per key: a write per request would be a write per request. */
  async touchKey(id: string): Promise<void> {
    const cutoff = new Date(Date.now() - 60_000).toISOString()
    const { error } = await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', id)
      .or(`last_used_at.is.null,last_used_at.lt.${cutoff}`)
    check(error)
  },

  // ─── publishable keys (migration 03) ───────────────────────────────────────

  async insertPublishableKey(row: {
    workspace_id: string
    created_by: string
    name: string
    prefix: string
    key_hash: string
    public_token: string
    allowed_origins: string[]
  }): Promise<PublishableKeyRow> {
    const { data, error } = await supabase
      .from('api_keys')
      // `storefront` is not an API scope and nothing reads it as one: a
      // publishable key never reaches the secret-key path (different prefix,
      // so a different hash). The column simply may not be empty.
      .insert({ ...row, kind: 'publishable', scopes: ['storefront'], expires_at: null })
      .select(PUBLISHABLE_COLUMNS)
      .single()
    check(error)
    return data as PublishableKeyRow
  },

  async listPublishableKeys(workspaceId: string): Promise<PublishableKeyRow[]> {
    const { data, error } = await supabase
      .from('api_keys')
      .select(PUBLISHABLE_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('kind', 'publishable')
      .order('created_at', { ascending: false })
    check(error)
    return (data ?? []) as PublishableKeyRow[]
  },

  async findPublishableByHash(
    hash: string,
  ): Promise<{ id: string; workspace_id: string; allowed_origins: string[] } | null> {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, workspace_id, allowed_origins')
      .eq('key_hash', hash)
      .eq('kind', 'publishable')
      .is('revoked_at', null)
      .maybeSingle()
    check(error)
    return (data as { id: string; workspace_id: string; allowed_origins: string[] } | null) ?? null
  },

  // ─── endpoints ─────────────────────────────────────────────────────────────

  async insertEndpoint(
    row: {
      workspace_id: string
      created_by: string
      url: string
      description: string | null
      events: string[]
    },
    secret: string,
  ): Promise<EndpointRow> {
    const { data, error } = await supabase
      .from('webhook_endpoints')
      .insert(row)
      .select(ENDPOINT_COLUMNS)
      .single()
    check(error)
    const endpoint = data as EndpointRow
    const { error: secretError } = await supabase
      .from('webhook_endpoint_secrets')
      .insert({ endpoint_id: endpoint.id, secret })
    if (secretError) {
      // An endpoint with no secret could never sign a delivery: undo the pair.
      // This is the endpoint we just created, not a compensating delete of
      // anybody's data.
      await supabase.from('webhook_endpoints').delete().eq('id', endpoint.id)
      check(secretError)
    }
    return endpoint
  },

  async listEndpoints(workspaceId: string): Promise<EndpointRow[]> {
    const { data, error } = await supabase
      .from('webhook_endpoints')
      .select(ENDPOINT_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    check(error)
    return (data ?? []) as EndpointRow[]
  },

  async getEndpoint(workspaceId: string, id: string): Promise<EndpointRow | null> {
    const { data, error } = await supabase
      .from('webhook_endpoints')
      .select(ENDPOINT_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .maybeSingle()
    check(error)
    return (data as EndpointRow | null) ?? null
  },

  async updateEndpoint(
    workspaceId: string,
    id: string,
    patch: Partial<
      Pick<
        EndpointRow,
        'description' | 'events' | 'is_active' | 'disabled_reason' | 'consecutive_failures'
      >
    >,
  ): Promise<EndpointRow | null> {
    const { data, error } = await supabase
      .from('webhook_endpoints')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .select(ENDPOINT_COLUMNS)
      .maybeSingle()
    check(error)
    return (data as EndpointRow | null) ?? null
  },

  async deleteEndpoint(workspaceId: string, id: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('webhook_endpoints')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .select('id')
    check(error)
    return (data ?? []).length > 0
  },

  async setSecret(endpointId: string, secret: string): Promise<void> {
    const { error } = await supabase
      .from('webhook_endpoint_secrets')
      .upsert({ endpoint_id: endpointId, secret, rotated_at: new Date().toISOString() })
    check(error)
  },

  async secretsFor(endpointIds: string[]): Promise<Map<string, string>> {
    if (endpointIds.length === 0) return new Map()
    const { data, error } = await supabase
      .from('webhook_endpoint_secrets')
      .select('endpoint_id, secret')
      .in('endpoint_id', endpointIds)
    check(error)
    return new Map(
      ((data ?? []) as Array<{ endpoint_id: string; secret: string }>).map((r) => [
        r.endpoint_id,
        r.secret,
      ]),
    )
  },

  async endpointUrls(endpointIds: string[]): Promise<Map<string, string>> {
    if (endpointIds.length === 0) return new Map()
    const { data, error } = await supabase
      .from('webhook_endpoints')
      .select('id, url')
      .in('id', endpointIds)
    check(error)
    return new Map(((data ?? []) as Array<{ id: string; url: string }>).map((r) => [r.id, r.url]))
  },

  // ─── deliveries ────────────────────────────────────────────────────────────

  async enqueueEvent(
    workspaceId: string,
    eventId: string,
    type: string,
    payload: object,
  ): Promise<number> {
    const { data, error } = await supabase.rpc('enqueue_webhook_event', {
      p_workspace_id: workspaceId,
      p_event_id: eventId,
      p_event_type: type,
      p_payload: payload,
    })
    check(error)
    return Number(data ?? 0)
  },

  /** A single delivery to one endpoint (a test ping), outside the fan-out. */
  async insertDelivery(row: {
    workspace_id: string
    endpoint_id: string
    event_id: string
    event_type: string
    payload: object
  }): Promise<DeliveryRow> {
    const { data, error } = await supabase
      .from('webhook_deliveries')
      .insert(row)
      .select(DELIVERY_COLUMNS)
      .single()
    check(error)
    return data as DeliveryRow
  },

  async listDeliveries(
    workspaceId: string,
    endpointId: string,
    limit: number,
  ): Promise<DeliveryRow[]> {
    const { data, error } = await supabase
      .from('webhook_deliveries')
      .select(DELIVERY_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('endpoint_id', endpointId)
      .order('created_at', { ascending: false })
      .limit(limit)
    check(error)
    return (data ?? []) as DeliveryRow[]
  },

  /** Put a finished delivery back in line (a person pressed «send again»). */
  async requeueDelivery(workspaceId: string, id: string): Promise<DeliveryRow | null> {
    const { data, error } = await supabase
      .from('webhook_deliveries')
      .update({
        status: 'pending',
        attempts: 0,
        next_attempt_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .in('status', ['failed', 'succeeded'])
      .select(DELIVERY_COLUMNS)
      .maybeSingle()
    check(error)
    return (data as DeliveryRow | null) ?? null
  },

  async claimDeliveries(
    worker: string,
    limit: number,
    leaseSeconds: number,
    id: string | null,
  ): Promise<DeliveryRow[]> {
    const { data, error } = await supabase.rpc('claim_webhook_deliveries', {
      p_worker: worker,
      p_limit: limit,
      p_lease_seconds: leaseSeconds,
      p_id: id,
    })
    check(error)
    return (data ?? []) as DeliveryRow[]
  },

  async completeDelivery(id: string, worker: string, statusCode: number): Promise<boolean> {
    const { data, error } = await supabase.rpc('complete_webhook_delivery', {
      p_id: id,
      p_worker: worker,
      p_status_code: statusCode,
    })
    check(error)
    return data === true
  },

  async failDelivery(
    id: string,
    worker: string,
    message: string,
    statusCode: number | null,
    delaySeconds: number,
  ): Promise<string | null> {
    const { data, error } = await supabase.rpc('fail_webhook_delivery', {
      p_id: id,
      p_worker: worker,
      p_error: message,
      p_status_code: statusCode,
      p_retry_delay_seconds: delaySeconds,
    })
    check(error)
    return (data as string | null) ?? null
  },

  // ─── request log (migration 02) ────────────────────────────────────────────

  async getKey(workspaceId: string, id: string): Promise<ApiKeyRow | null> {
    const { data, error } = await supabase
      .from('api_keys')
      .select(KEY_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .maybeSingle()
    check(error)
    return (data as ApiKeyRow | null) ?? null
  },

  async logRequest(row: {
    workspace_id: string
    key_id: string
    method: string
    route: string
    status: number
    duration_ms: number
  }): Promise<void> {
    const { error } = await supabase.from('api_request_logs').insert(row)
    check(error)
  },

  /** Exact per-day counts (count(*) in SQL — never a page of rows). */
  async usage(workspaceId: string, keyId: string, days: number): Promise<UsageDay[]> {
    const { data, error } = await supabase.rpc('api_key_usage', {
      p_workspace_id: workspaceId,
      p_key_id: keyId,
      p_days: days,
    })
    check(error)
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      day: String(r.day),
      requests: Number(r.requests),
      client_errors: Number(r.client_errors),
      server_errors: Number(r.server_errors),
      avg_ms: r.avg_ms === null ? null : Number(r.avg_ms),
    }))
  },

  /** The latest requests, for reading — a sample by design, not a figure. */
  async recentRequests(
    workspaceId: string,
    keyId: string,
    limit: number,
  ): Promise<RequestLogRow[]> {
    const { data, error } = await supabase
      .from('api_request_logs')
      .select('method, route, status, duration_ms, created_at')
      .eq('workspace_id', workspaceId)
      .eq('key_id', keyId)
      .order('created_at', { ascending: false })
      .limit(limit)
    check(error)
    return (data ?? []) as RequestLogRow[]
  },

  async purgeRequestLogs(keepDays: number): Promise<number> {
    const { data, error } = await supabase.rpc('purge_api_request_logs', { p_keep_days: keepDays })
    check(error)
    return Number(data ?? 0)
  },

  /** Requeue an endpoint's finished deliveries since `since`. 22023 = window too long. */
  async replay(workspaceId: string, endpointId: string, since: string): Promise<number> {
    const { data, error } = await supabase.rpc('replay_webhook_deliveries', {
      p_workspace_id: workspaceId,
      p_endpoint_id: endpointId,
      p_since: since,
    })
    check(error)
    return Number(data ?? 0)
  },
}

export type DeveloperRepository = typeof developerRepository
