// ============================================
// backend/src/services/oauth/oauth.repository.ts
//
// The rows and reads shared by the OAuth service (apps, consent, tokens,
// installations, review) and the marketplace service (listing, reviews,
// reports, publisher profile). One place for the column lists and for
// turning a database refusal into a named one.
// ============================================

import type {
  ApiKeyScope,
  AppCategory,
  AppPriceInterval,
  AppVersionStatus,
  OAuthAppStatus,
  OAuthErrorCode,
} from '@hisabche/validation'

import { supabase } from '../../db'
import { isMissingSchema } from '../blog/blog.domain'
import { NotConfiguredError } from '../developer/developer.repository'

/** A refusal. `oauth` is the RFC 6749 error code for the token endpoint. */
export class OAuthError extends Error {
  constructor(
    readonly code: OAuthErrorCode,
    readonly statusCode: number,
    readonly oauth?:
      | 'invalid_request'
      | 'invalid_client'
      | 'invalid_grant'
      | 'unsupported_grant_type'
      | 'invalid_scope',
  ) {
    super(code)
    this.name = 'OAuthError'
  }
}

/** What the database functions of migration 07 raise, and what each means. */
const DB_REFUSALS: Array<[OAuthErrorCode, number]> = [
  ['APP_NOT_FOUND', 404],
  ['APP_SUSPENDED', 409],
  ['LISTING_INCOMPLETE', 400],
  ['WEBHOOK_INCOMPLETE', 400],
  ['VERSION_IN_REVIEW', 409],
  ['VERSION_INVALID', 400],
  ['VERSION_NOT_NEWER', 409],
  ['VERSION_NOT_FOUND', 404],
  ['VERSION_NOT_IN_REVIEW', 409],
  ['VERSION_HAS_LOCALHOST', 409],
  ['INSTALLATION_NOT_ACTIVE', 409],
  ['NO_SCOPE_GRANTED', 403],
]

export function check(error: { code?: string; message?: string } | null): void {
  if (!error) return
  if (isMissingSchema(error)) throw new NotConfiguredError()
  const refusal = DB_REFUSALS.find(([code]) => error.message?.includes(code))
  if (refusal) throw new OAuthError(refusal[0], refusal[1])
  if (error.code === '23505' && error.message?.includes('oauth_apps_slug_idx')) {
    throw new OAuthError('SLUG_TAKEN', 409)
  }
  throw Object.assign(new Error(error.message ?? 'database error'), { code: error.code })
}

export interface AppRow {
  id: string
  owner_workspace_id: string
  name: string
  description: string
  homepage_url: string | null
  /** The DRAFT config — what the publisher's own workspace tests. */
  redirect_uris: string[]
  requested_scopes: ApiKeyScope[]
  webhook_url: string | null
  webhook_events: string[]
  api_version: string
  client_id: string
  status: OAuthAppStatus
  review_note: string | null
  slug: string | null
  tagline: string
  category: AppCategory | null
  icon_url: string | null
  privacy_url: string | null
  terms_url: string | null
  install_url: string | null
  pricing_model: 'free' | 'paid'
  /** Minor units; bigint arrives as a number from PostgREST. */
  price_minor: number | null
  price_currency: string | null
  price_interval: AppPriceInterval | null
  published_version_id: string | null
  created_at: string
  updated_at: string
}

// The client secret hash is never in this list: it is read only where it is compared.
export const APP_COLUMNS =
  'id, owner_workspace_id, name, description, homepage_url, redirect_uris, requested_scopes, webhook_url, ' +
  'webhook_events, api_version, client_id, status, review_note, slug, tagline, category, icon_url, privacy_url, ' +
  'terms_url, install_url, pricing_model, price_minor, price_currency, price_interval, published_version_id, ' +
  'created_at, updated_at'

export interface VersionRow {
  id: string
  app_id: string
  version: string
  changelog: string
  redirect_uris: string[]
  requested_scopes: ApiKeyScope[]
  webhook_url: string | null
  webhook_events: string[]
  api_version: string
  status: AppVersionStatus
  review_note: string | null
  created_at: string
  published_at: string | null
}

export const VERSION_COLUMNS =
  'id, app_id, version, changelog, redirect_uris, requested_scopes, webhook_url, webhook_events, api_version, ' +
  'status, review_note, created_at, published_at'

export interface PublisherRow {
  workspace_id: string
  display_name: string
  website_url: string | null
  support_email: string | null
  bio: string
  verified_at: string | null
}

export const PUBLISHER_COLUMNS =
  'workspace_id, display_name, website_url, support_email, bio, verified_at'

export async function appById(id: string): Promise<AppRow | null> {
  const { data, error } = await supabase
    .from('oauth_apps')
    .select(APP_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  check(error)
  return (data as unknown as AppRow | null) ?? null
}

export async function appByClientId(clientId: string): Promise<AppRow | null> {
  const { data, error } = await supabase
    .from('oauth_apps')
    .select(APP_COLUMNS)
    .eq('client_id', clientId)
    .maybeSingle()
  check(error)
  return (data as unknown as AppRow | null) ?? null
}

export async function versionById(id: string): Promise<VersionRow | null> {
  const { data, error } = await supabase
    .from('app_versions')
    .select(VERSION_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  check(error)
  return (data as unknown as VersionRow | null) ?? null
}

/** Publisher profiles by workspace, falling back to nothing (the caller names the workspace). */
export async function publishersOf(workspaceIds: string[]): Promise<Map<string, PublisherRow>> {
  if (workspaceIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('app_publishers')
    .select(PUBLISHER_COLUMNS)
    .in('workspace_id', workspaceIds)
  check(error)
  return new Map(((data ?? []) as PublisherRow[]).map((p) => [p.workspace_id, p]))
}

export async function workspaceNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const { data, error } = await supabase.from('workspaces').select('id, name').in('id', ids)
  check(error)
  return new Map(((data ?? []) as Array<{ id: string; name: string }>).map((w) => [w.id, w.name]))
}

/** How a publisher is shown: its profile if it made one, else its business name. Verified only by an admin. */
export async function publisherView(workspaceIds: string[]) {
  const [profiles, names] = await Promise.all([
    publishersOf(workspaceIds),
    workspaceNames(workspaceIds),
  ])
  return (workspaceId: string) => {
    const p = profiles.get(workspaceId)
    return {
      name: p?.display_name ?? names.get(workspaceId) ?? null,
      verified: !!p?.verified_at,
      websiteUrl: p?.website_url ?? null,
      supportEmail: p?.support_email ?? null,
      bio: p?.bio ?? '',
    }
  }
}

/** The price as disclosed. Money stays in minor units. */
export function pricingOf(app: AppRow) {
  return app.pricing_model === 'paid' && app.price_minor !== null
    ? {
        model: 'paid' as const,
        priceMinor: Number(app.price_minor),
        currency: app.price_currency ?? '',
        interval: app.price_interval ?? 'month',
      }
    : { model: 'free' as const }
}

/**
 * The config a workspace installs: the publisher's own workspace tests the
 * DRAFT; everyone else gets the published version, or nothing.
 */
export async function liveConfig(app: AppRow, workspaceId: string) {
  if (app.owner_workspace_id === workspaceId) {
    return {
      versionId: null,
      version: null,
      redirect_uris: app.redirect_uris,
      requested_scopes: app.requested_scopes,
      webhook_url: app.webhook_url,
      webhook_events: app.webhook_events,
      api_version: app.api_version,
    }
  }
  if (!app.published_version_id) return null
  const v = await versionById(app.published_version_id)
  if (!v) return null
  return {
    versionId: v.id,
    version: v.version,
    redirect_uris: v.redirect_uris,
    requested_scopes: v.requested_scopes,
    webhook_url: v.webhook_url,
    webhook_events: v.webhook_events,
    api_version: v.api_version,
  }
}
