// ============================================
// backend/src/services/oauth/oauth.service.ts
//
// OAuth apps: register (publisher), install (another business, by consent),
// exchange a code for a token (the app's server), and review (platform
// admin). Rules in oauth.domain.ts; the single-use code in the database
// (redeem_oauth_code).
//
// ⚠️ THE TOKEN IS AN API KEY. Issued through developerRepository.insertKey
// with app_id — so the route allowlist, scope narrowing, the per-key rate
// limit, the request log and revocation all apply unchanged. There is no
// second token system to keep in step.
// ============================================

import {
  type ApiKeyScope,
  type OAuthAppCreateInput,
  type OAuthAppStatus,
  type OAuthAppUpdateInput,
  type OAuthErrorCode,
} from '@hisabche/validation'

import { supabase } from '../../db'
import { holds, type Capability } from '../authorization'
import { resolveWorkspaceAccess } from '../authorization/workspace-access.service'
import { isMissingSchema } from '../blog/blog.domain'
import {
  NotConfiguredError,
  developerRepository,
  type DeveloperRepository,
} from '../developer/developer.repository'
import {
  displayPrefix,
  generateApiKey,
  grantForKey,
  hashApiKey,
} from '../developer/developer.domain'
import type { TenancyContext } from '../tenancy.service'
import {
  CHALLENGE,
  CODE_TTL_MS,
  generateClientId,
  generateClientSecret,
  generateCode,
  mayEdit,
  mayInstall,
  parseScope,
  pkceMatches,
  redirectUriRegistered,
  sameDigest,
  sha256Hex,
} from './oauth.domain'

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

function check(error: { code?: string; message?: string } | null): void {
  if (!error) return
  if (isMissingSchema(error)) throw new NotConfiguredError()
  throw Object.assign(new Error(error.message ?? 'database error'), { code: error.code })
}

export interface AppRow {
  id: string
  owner_workspace_id: string
  name: string
  description: string
  homepage_url: string | null
  redirect_uris: string[]
  requested_scopes: ApiKeyScope[]
  client_id: string
  status: OAuthAppStatus
  review_note: string | null
  created_at: string
  updated_at: string
}
// The secret hash is never in this list: it is read only where it is compared.
const APP_COLUMNS =
  'id, owner_workspace_id, name, description, homepage_url, redirect_uris, requested_scopes, client_id, status, review_note, created_at, updated_at'

async function appById(id: string): Promise<AppRow | null> {
  const { data, error } = await supabase
    .from('oauth_apps')
    .select(APP_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  check(error)
  return (data as AppRow | null) ?? null
}

async function appByClientId(clientId: string): Promise<AppRow | null> {
  const { data, error } = await supabase
    .from('oauth_apps')
    .select(APP_COLUMNS)
    .eq('client_id', clientId)
    .maybeSingle()
  check(error)
  return (data as AppRow | null) ?? null
}

async function workspaceNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const { data, error } = await supabase.from('workspaces').select('id, name').in('id', ids)
  check(error)
  return new Map(((data ?? []) as Array<{ id: string; name: string }>).map((w) => [w.id, w.name]))
}

export function createOAuthService(
  keys: Pick<DeveloperRepository, 'insertKey'> = developerRepository,
) {
  /** The app a publisher may act on — theirs, or NOT_FOUND (never «forbidden»: existence is not disclosed). */
  async function ownApp(ctx: TenancyContext, id: string): Promise<AppRow> {
    const app = await appById(id)
    if (!app || app.owner_workspace_id !== ctx.workspaceId)
      throw new OAuthError('APP_NOT_FOUND', 404)
    return app
  }

  /** Validates an authorization request; the same checks for preview and approval. */
  async function authorizationRequest(
    ctx: TenancyContext,
    input: { clientId: string; redirectUri: string; scope: string },
  ) {
    const app = await appByClientId(input.clientId)
    if (!app) throw new OAuthError('APP_NOT_FOUND', 404)
    // ⚠️ Never redirect to an unregistered URI — not even to report an error.
    if (!redirectUriRegistered(app.redirect_uris, input.redirectUri)) {
      throw new OAuthError('REDIRECT_URI_NOT_REGISTERED', 400)
    }
    if (
      !mayInstall({ status: app.status, ownerWorkspaceId: app.owner_workspace_id }, ctx.workspaceId)
    ) {
      throw new OAuthError('APP_NOT_AVAILABLE', 403)
    }
    const requested = parseScope(input.scope)
    if (!requested) throw new OAuthError('SCOPE_INVALID', 400)
    // An app can never ask for more than it registered.
    if (!requested.every((s) => app.requested_scopes.includes(s)))
      throw new OAuthError('SCOPE_NOT_REGISTERED', 400)
    const grant = grantForKey(requested, (cap: Capability) => holds(ctx, cap))
    return { app, requested, grant }
  }

  return {
    // ─── publisher ───────────────────────────────────────────────────────────

    /** The client secret is in this return value and nowhere else, ever. */
    async createApp(ctx: TenancyContext, input: OAuthAppCreateInput) {
      const secret = generateClientSecret()
      const { data, error } = await supabase
        .from('oauth_apps')
        .insert({
          owner_workspace_id: ctx.workspaceId,
          created_by: ctx.userId,
          name: input.name,
          description: input.description,
          homepage_url: input.homepageUrl ?? null,
          redirect_uris: input.redirectUris,
          requested_scopes: input.requestedScopes,
          client_id: generateClientId(),
          client_secret_hash: sha256Hex(secret),
        })
        .select(APP_COLUMNS)
        .single()
      check(error)
      return { app: data as AppRow, clientSecret: secret }
    },

    async listApps(ctx: TenancyContext): Promise<AppRow[]> {
      const { data, error } = await supabase
        .from('oauth_apps')
        .select(APP_COLUMNS)
        .eq('owner_workspace_id', ctx.workspaceId)
        .order('created_at', { ascending: false })
      check(error)
      return (data ?? []) as AppRow[]
    },

    async updateApp(ctx: TenancyContext, id: string, input: OAuthAppUpdateInput): Promise<AppRow> {
      const app = await ownApp(ctx, id)
      // A reviewed app does not change under its installers' feet.
      if (!mayEdit(app.status)) throw new OAuthError('APP_LOCKED', 409)
      const { data, error } = await supabase
        .from('oauth_apps')
        .update({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.homepageUrl !== undefined ? { homepage_url: input.homepageUrl } : {}),
          ...(input.redirectUris !== undefined ? { redirect_uris: input.redirectUris } : {}),
          ...(input.requestedScopes !== undefined
            ? { requested_scopes: input.requestedScopes }
            : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select(APP_COLUMNS)
        .single()
      check(error)
      return data as AppRow
    },

    async submitApp(ctx: TenancyContext, id: string): Promise<AppRow> {
      const app = await ownApp(ctx, id)
      if (!mayEdit(app.status)) throw new OAuthError('APP_LOCKED', 409)
      const { data, error } = await supabase
        .from('oauth_apps')
        .update({ status: 'in_review', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(APP_COLUMNS)
        .single()
      check(error)
      return data as AppRow
    },

    async rotateSecret(ctx: TenancyContext, id: string): Promise<{ clientSecret: string }> {
      await ownApp(ctx, id)
      const secret = generateClientSecret()
      const { error } = await supabase
        .from('oauth_apps')
        .update({ client_secret_hash: sha256Hex(secret), updated_at: new Date().toISOString() })
        .eq('id', id)
      check(error)
      return { clientSecret: secret }
    },

    /** Only an app nobody else relies on: deleting a published app would uninstall it everywhere. */
    async deleteApp(ctx: TenancyContext, id: string): Promise<void> {
      const app = await ownApp(ctx, id)
      if (app.status === 'published') throw new OAuthError('APP_PUBLISHED', 409)
      const { error } = await supabase.from('oauth_apps').delete().eq('id', id)
      check(error)
    },

    // ─── installer ───────────────────────────────────────────────────────────

    /** What the consent screen shows: the app, its publisher, and what THIS person can grant. */
    async consentPreview(
      ctx: TenancyContext,
      input: { clientId: string; redirectUri: string; scope: string },
    ) {
      const { app, requested, grant } = await authorizationRequest(ctx, input)
      const names = await workspaceNames([app.owner_workspace_id])
      return {
        app: {
          name: app.name,
          description: app.description,
          homepageUrl: app.homepage_url,
          publisher: names.get(app.owner_workspace_id) ?? null,
          // «Not reviewed» is said on the screen, not hidden.
          reviewed: app.status === 'published',
        },
        requested,
        granted: grant.granted,
        refused: grant.refused,
      }
    },

    /** The person approved: a one-time code, and where to send them. */
    async approve(
      ctx: TenancyContext,
      input: {
        clientId: string
        redirectUri: string
        scope: string
        state?: string | undefined
        codeChallenge: string
      },
    ): Promise<{ redirectTo: string }> {
      if (!CHALLENGE.test(input.codeChallenge)) throw new OAuthError('PKCE_REQUIRED', 400)
      const { app, grant } = await authorizationRequest(ctx, input)
      if (grant.granted.length === 0) throw new OAuthError('NO_SCOPE_GRANTED', 403)
      const code = generateCode()
      const { error } = await supabase.from('oauth_authorization_codes').insert({
        code_hash: sha256Hex(code),
        app_id: app.id,
        workspace_id: ctx.workspaceId,
        user_id: ctx.userId,
        scopes: grant.granted,
        redirect_uri: input.redirectUri,
        code_challenge: input.codeChallenge,
        expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
      })
      check(error)
      const target = new URL(input.redirectUri)
      target.searchParams.set('code', code)
      if (input.state) target.searchParams.set('state', input.state)
      return { redirectTo: target.toString() }
    },

    async installedApps(ctx: TenancyContext) {
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, app_id, scopes, created_at, last_used_at')
        .eq('workspace_id', ctx.workspaceId)
        .not('app_id', 'is', null)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
      check(error)
      const rows = (data ?? []) as Array<{
        id: string
        app_id: string
        scopes: string[]
        created_at: string
        last_used_at: string | null
      }>
      const apps = new Map<string, AppRow>()
      for (const id of [...new Set(rows.map((r) => r.app_id))]) {
        const app = await appById(id)
        if (app) apps.set(id, app)
      }
      return rows.map((r) => ({
        keyId: r.id,
        appName: apps.get(r.app_id)?.name ?? null,
        homepageUrl: apps.get(r.app_id)?.homepage_url ?? null,
        scopes: r.scopes,
        installedAt: r.created_at,
        lastUsedAt: r.last_used_at,
      }))
    },

    // ─── marketplace ─────────────────────────────────────────────────────────

    async marketplace() {
      const { data, error } = await supabase
        .from('oauth_apps')
        .select(APP_COLUMNS)
        .eq('status', 'published')
        .order('name', { ascending: true })
      check(error)
      const apps = (data ?? []) as AppRow[]
      const names = await workspaceNames([...new Set(apps.map((a) => a.owner_workspace_id))])
      return apps.map((a) => ({
        id: a.id,
        clientId: a.client_id,
        name: a.name,
        description: a.description,
        homepageUrl: a.homepage_url,
        publisher: names.get(a.owner_workspace_id) ?? null,
        scopes: a.requested_scopes,
      }))
    },

    // ─── the app's server ────────────────────────────────────────────────────

    /**
     * authorization_code → access token (RFC 6749 §4.1.3, RFC 7636 §4.5).
     * The code is spent by the database before anything else is decided: a
     * failed verifier burns it, as it should.
     */
    async exchange(input: {
      grantType: string
      code: string
      redirectUri: string
      clientId: string
      clientSecret: string
      codeVerifier: string
    }) {
      if (input.grantType !== 'authorization_code') {
        throw new OAuthError('UNSUPPORTED_GRANT_TYPE', 400, 'unsupported_grant_type')
      }
      const { data: appRow, error } = await supabase
        .from('oauth_apps')
        .select(`${APP_COLUMNS}, client_secret_hash`)
        .eq('client_id', input.clientId)
        .maybeSingle()
      check(error)
      const app = appRow as (AppRow & { client_secret_hash: string }) | null
      if (
        !app ||
        app.status === 'suspended' ||
        !sameDigest(sha256Hex(input.clientSecret), app.client_secret_hash)
      ) {
        throw new OAuthError('CLIENT_INVALID', 401, 'invalid_client')
      }

      const { data: redeemed, error: redeemError } = await supabase.rpc('redeem_oauth_code', {
        p_code_hash: sha256Hex(input.code),
        p_app_id: app.id,
        p_redirect_uri: input.redirectUri,
      })
      check(redeemError)
      const code = (
        (redeemed ?? []) as Array<{
          workspace_id: string
          user_id: string
          scopes: string[]
          code_challenge: string
        }>
      )[0]
      if (!code) throw new OAuthError('CODE_INVALID', 400, 'invalid_grant')
      if (!pkceMatches(input.codeVerifier, code.code_challenge)) {
        throw new OAuthError('PKCE_MISMATCH', 400, 'invalid_grant')
      }

      // The installer must still be a member, and the grant is recomputed
      // against what they hold NOW — a demotion between consent and exchange
      // is honoured.
      let ctx: TenancyContext
      try {
        ctx = await resolveWorkspaceAccess(code.user_id, code.workspace_id)
      } catch {
        throw new OAuthError('INSTALLER_NOT_MEMBER', 400, 'invalid_grant')
      }
      const grant = grantForKey(code.scopes as ApiKeyScope[], (cap: Capability) => holds(ctx, cap))
      if (grant.granted.length === 0) throw new OAuthError('NO_SCOPE_GRANTED', 400, 'invalid_scope')

      const token = generateApiKey()
      await keys.insertKey({
        workspace_id: code.workspace_id,
        created_by: code.user_id,
        name: app.name,
        prefix: displayPrefix(token),
        key_hash: hashApiKey(token),
        scopes: grant.granted,
        expires_at: null,
        app_id: app.id,
      })
      return { access_token: token, token_type: 'Bearer' as const, scope: grant.granted.join(' ') }
    },

    // ─── platform review ─────────────────────────────────────────────────────

    async listForReview(status: OAuthAppStatus) {
      const { data, error } = await supabase
        .from('oauth_apps')
        .select(APP_COLUMNS)
        .eq('status', status)
        .order('updated_at', { ascending: true })
      check(error)
      const apps = (data ?? []) as AppRow[]
      const names = await workspaceNames([...new Set(apps.map((a) => a.owner_workspace_id))])
      return apps.map((a) => ({ ...a, publisher: names.get(a.owner_workspace_id) ?? null }))
    },

    async review(
      adminUserId: string,
      id: string,
      decision: 'published' | 'rejected' | 'suspended',
      note: string | null,
    ) {
      const app = await appById(id)
      if (!app) throw new OAuthError('APP_NOT_FOUND', 404)
      const { data, error } = await supabase
        .from('oauth_apps')
        .update({
          status: decision,
          review_note: note,
          reviewed_by: adminUserId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select(APP_COLUMNS)
        .single()
      check(error)
      return data as AppRow
    },
  }
}

export const oauthService = createOAuthService()
export type OAuthService = ReturnType<typeof createOAuthService>
