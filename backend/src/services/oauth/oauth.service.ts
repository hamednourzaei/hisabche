// ============================================
// backend/src/services/oauth/oauth.service.ts
//
// OAuth apps, end to end:
//   publisher   register an app, edit its DRAFT (listing + config), snapshot
//               it as a version for review, rotate its secrets;
//   installer   consent, the installed-apps list, update to a newer version,
//               uninstall;
//   app server  exchange a code for a token (RFC 6749 + PKCE);
//   platform    review versions, suspend / reinstate apps.
//
// Rules in oauth.domain.ts; rows and reads in oauth.repository.ts; every
// multi-table write is a database function
// (docs/developer-platform-07-marketplace-migration.sql).
//
// ⚠️ THE TOKEN IS AN API KEY (api_keys.app_id), written by install_oauth_app
// — so the route allowlist, scope narrowing, the per-key rate limit, the
// request log and revocation all apply unchanged. Uninstall is revoking it.
// ============================================

import {
  type ApiKeyScope,
  type AppVersionSubmitInput,
  type OAuthAppCreateInput,
  type OAuthAppStatus,
  type OAuthAppUpdateInput,
} from '@hisabche/validation'

import { supabase } from '../../db'
import { holds, type Capability } from '../authorization'
import { resolveWorkspaceAccess } from '../authorization/workspace-access.service'
import {
  checkWebhookUrl,
  displayPrefix,
  generateApiKey,
  grantForKey,
  hashApiKey,
} from '../developer/developer.domain'
import { developerService, type DeveloperService } from '../developer/developer.service'
import type { TenancyContext } from '../tenancy.service'
import {
  ACCESS_TOKEN_SECONDS,
  CHALLENGE,
  CODE_TTL_MS,
  REFRESH_TOKEN_SECONDS,
  eventsForGrant,
  generateClientId,
  generateClientSecret,
  generateCode,
  generateRefreshToken,
  generateWebhookSecret,
  isCompatible,
  looksLikeRefreshToken,
  mayInstall,
  parseScope,
  permissionDisclosure,
  pkceMatches,
  redirectUriRegistered,
  riskFlags,
  sameDigest,
  scopeDiff,
  sha256Hex,
} from './oauth.domain'
import {
  APP_COLUMNS,
  OAuthError,
  VERSION_COLUMNS,
  appByClientId,
  appById,
  check,
  liveConfig,
  pricingOf,
  publisherView,
  publishersOf,
  versionById,
  type AppRow,
  type VersionRow,
} from './oauth.repository'

export { OAuthError } from './oauth.repository'

export function createOAuthService(
  developer: Pick<DeveloperService, 'revokeKey' | 'forgetKeys'> = developerService,
) {
  /** The app a publisher may act on — theirs, or NOT_FOUND (existence is not disclosed). */
  async function ownApp(ctx: TenancyContext, id: string): Promise<AppRow> {
    const app = await appById(id)
    if (!app || app.owner_workspace_id !== ctx.workspaceId)
      throw new OAuthError('APP_NOT_FOUND', 404)
    return app
  }

  /** The app whose server is calling, by its client id and secret — or invalid_client. */
  async function clientApp(clientId: string, clientSecret: string): Promise<AppRow> {
    const { data: appRow, error } = await supabase
      .from('oauth_apps')
      .select(`${APP_COLUMNS}, client_secret_hash`)
      .eq('client_id', clientId)
      .maybeSingle()
    check(error)
    const app = appRow as unknown as (AppRow & { client_secret_hash: string }) | null
    if (
      !app ||
      app.status === 'suspended' ||
      !sameDigest(sha256Hex(clientSecret), app.client_secret_hash)
    ) {
      throw new OAuthError('CLIENT_INVALID', 401, 'invalid_client')
    }
    return app
  }

  /** Validates an authorization request; the same checks for preview and approval. */
  async function authorizationRequest(
    ctx: TenancyContext,
    input: { clientId: string; redirectUri: string; scope: string },
  ) {
    const app = await appByClientId(input.clientId)
    if (!app) throw new OAuthError('APP_NOT_FOUND', 404)
    if (
      !mayInstall({ status: app.status, ownerWorkspaceId: app.owner_workspace_id }, ctx.workspaceId)
    ) {
      throw new OAuthError('APP_NOT_AVAILABLE', 403)
    }
    const config = await liveConfig(app, ctx.workspaceId)
    if (!config) throw new OAuthError('APP_NOT_AVAILABLE', 403)
    // ⚠️ Never redirect to an unregistered URI — not even to report an error.
    if (!redirectUriRegistered(config.redirect_uris, input.redirectUri)) {
      throw new OAuthError('REDIRECT_URI_NOT_REGISTERED', 400)
    }
    if (!isCompatible(config.api_version)) throw new OAuthError('APP_INCOMPATIBLE', 409)
    const requested = parseScope(input.scope)
    if (!requested) throw new OAuthError('SCOPE_INVALID', 400)
    // An app can never ask for more than its version declares.
    if (!requested.every((s) => config.requested_scopes.includes(s))) {
      throw new OAuthError('SCOPE_NOT_REGISTERED', 400)
    }
    const grant = grantForKey(requested, (cap: Capability) => holds(ctx, cap))
    return { app, config, requested, grant }
  }

  async function activeInstallation(ctx: TenancyContext, id: string) {
    const { data, error } = await supabase
      .from('app_installations')
      .select('id, app_id, key_id, version_id, status')
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle()
    check(error)
    const row = data as {
      id: string
      app_id: string
      key_id: string | null
      version_id: string | null
      status: string
    } | null
    if (!row) throw new OAuthError('INSTALLATION_NOT_FOUND', 404)
    if (row.status !== 'active' || !row.key_id) throw new OAuthError('INSTALLATION_NOT_ACTIVE', 409)
    return { ...row, key_id: row.key_id }
  }

  /** What updating an installation to the app's published version would change. */
  async function updatePlan(ctx: TenancyContext, installationId: string) {
    const inst = await activeInstallation(ctx, installationId)
    const app = await appById(inst.app_id)
    if (!app || app.status === 'suspended') throw new OAuthError('APP_NOT_AVAILABLE', 403)
    // A test install of the draft has no version to move from.
    if (
      !inst.version_id ||
      !app.published_version_id ||
      app.published_version_id === inst.version_id
    ) {
      throw new OAuthError('NO_UPDATE', 409)
    }
    const [next, key] = await Promise.all([
      versionById(app.published_version_id),
      supabase.from('api_keys').select('scopes, key_hash').eq('id', inst.key_id).maybeSingle(),
    ])
    check(key.error)
    if (!next) throw new OAuthError('NO_UPDATE', 409)
    if (!isCompatible(next.api_version)) throw new OAuthError('APP_INCOMPATIBLE', 409)
    const keyRow = key.data as { scopes: string[]; key_hash: string } | null
    const current = (keyRow?.scopes ?? []) as ApiKeyScope[]
    const grant = grantForKey(next.requested_scopes, (cap: Capability) => holds(ctx, cap))
    const events = eventsForGrant(next.webhook_events, grant.granted)
    const from = await versionById(inst.version_id)
    return {
      inst,
      next,
      keyHash: keyRow?.key_hash ?? null,
      grant,
      events,
      preview: {
        fromVersion: from?.version ?? null,
        toVersion: next.version,
        changelog: next.changelog,
        ...scopeDiff(current, grant.granted),
        refused: grant.refused,
        events,
      },
    }
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
      return { app: data as unknown as AppRow, clientSecret: secret }
    },

    async listApps(ctx: TenancyContext): Promise<AppRow[]> {
      const { data, error } = await supabase
        .from('oauth_apps')
        .select(APP_COLUMNS)
        .eq('owner_workspace_id', ctx.workspaceId)
        .order('created_at', { ascending: false })
      check(error)
      return (data ?? []) as unknown as AppRow[]
    },

    /**
     * Edit the listing and the DRAFT config. The draft reaches other
     * businesses only as a reviewed version, so it may change at any time —
     * except on a suspended app.
     *
     * Returns the app's webhook secret ONCE, the first time a webhook
     * subscription is configured.
     */
    async updateApp(ctx: TenancyContext, id: string, input: OAuthAppUpdateInput) {
      const app = await ownApp(ctx, id)
      if (app.status === 'suspended') throw new OAuthError('APP_SUSPENDED', 409)
      if (input.webhookUrl && !checkWebhookUrl(input.webhookUrl).ok) {
        throw new OAuthError('WEBHOOK_URL_INVALID', 400)
      }
      const pricing =
        input.pricing === undefined
          ? {}
          : input.pricing.model === 'free'
            ? {
                pricing_model: 'free',
                price_minor: null,
                price_currency: null,
                price_interval: null,
              }
            : {
                pricing_model: 'paid',
                price_minor: input.pricing.priceMinor,
                price_currency: input.pricing.currency,
                price_interval: input.pricing.interval,
              }
      const patch: Record<string, unknown> = {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.homepageUrl !== undefined ? { homepage_url: input.homepageUrl } : {}),
        ...(input.redirectUris !== undefined ? { redirect_uris: input.redirectUris } : {}),
        ...(input.requestedScopes !== undefined ? { requested_scopes: input.requestedScopes } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.tagline !== undefined ? { tagline: input.tagline } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.iconUrl !== undefined ? { icon_url: input.iconUrl } : {}),
        ...(input.privacyUrl !== undefined ? { privacy_url: input.privacyUrl } : {}),
        ...(input.termsUrl !== undefined ? { terms_url: input.termsUrl } : {}),
        ...(input.installUrl !== undefined ? { install_url: input.installUrl } : {}),
        ...(input.webhookUrl !== undefined ? { webhook_url: input.webhookUrl } : {}),
        ...(input.webhookEvents !== undefined ? { webhook_events: input.webhookEvents } : {}),
        ...(input.apiVersion !== undefined ? { api_version: input.apiVersion } : {}),
        ...pricing,
        updated_at: new Date().toISOString(),
      }
      const { data, error } = await supabase
        .from('oauth_apps')
        .update(patch)
        .eq('id', id)
        .select(APP_COLUMNS)
        .single()
      check(error)
      const updated = data as unknown as AppRow

      let webhookSecret: string | null = null
      if (updated.webhook_url && updated.webhook_events.length > 0) {
        const { data: existing, error: secretError } = await supabase
          .from('oauth_app_webhook_secrets')
          .select('app_id')
          .eq('app_id', id)
          .maybeSingle()
        check(secretError)
        if (!existing) {
          webhookSecret = generateWebhookSecret()
          const { error: rotateError } = await supabase.rpc('rotate_app_webhook_secret', {
            p_app: id,
            p_secret: webhookSecret,
          })
          check(rotateError)
        }
      }
      return { app: updated, webhookSecret }
    },

    /** Snapshot the draft as a new version, for review. */
    async submitVersion(
      ctx: TenancyContext,
      id: string,
      input: AppVersionSubmitInput,
    ): Promise<VersionRow> {
      await ownApp(ctx, id)
      // Installers must be able to see who publishes what they install.
      if (!(await publishersOf([ctx.workspaceId])).has(ctx.workspaceId)) {
        throw new OAuthError('PUBLISHER_REQUIRED', 400)
      }
      const { data, error } = await supabase.rpc('submit_app_version', {
        p_app: id,
        p_user: ctx.userId,
        p_version: input.version,
        p_changelog: input.changelog,
      })
      check(error)
      const version = await versionById(data as string)
      if (!version) throw new OAuthError('VERSION_NOT_FOUND', 404)
      return version
    },

    async listVersions(ctx: TenancyContext, id: string): Promise<VersionRow[]> {
      await ownApp(ctx, id)
      const { data, error } = await supabase
        .from('app_versions')
        .select(VERSION_COLUMNS)
        .eq('app_id', id)
        .order('created_at', { ascending: false })
      check(error)
      return (data ?? []) as unknown as VersionRow[]
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

    /** A new webhook signing secret; every installation's endpoint follows at once. */
    async rotateWebhookSecret(ctx: TenancyContext, id: string): Promise<{ webhookSecret: string }> {
      await ownApp(ctx, id)
      const secret = generateWebhookSecret()
      const { error } = await supabase.rpc('rotate_app_webhook_secret', {
        p_app: id,
        p_secret: secret,
      })
      check(error)
      return { webhookSecret: secret }
    },

    /** Only an app nobody else relies on: one ever published has installers. */
    async deleteApp(ctx: TenancyContext, id: string): Promise<void> {
      const app = await ownApp(ctx, id)
      if (app.published_version_id) throw new OAuthError('APP_PUBLISHED', 409)
      const { error } = await supabase.from('oauth_apps').delete().eq('id', id)
      check(error)
    },

    // ─── installer ───────────────────────────────────────────────────────────

    /** What the consent screen shows: who, which version, what it costs, what THIS person can grant. */
    async consentPreview(
      ctx: TenancyContext,
      input: { clientId: string; redirectUri: string; scope: string },
    ) {
      const { app, config, requested, grant } = await authorizationRequest(ctx, input)
      const publisher = (await publisherView([app.owner_workspace_id]))(app.owner_workspace_id)
      return {
        app: {
          name: app.name,
          description: app.description,
          homepageUrl: app.homepage_url,
          iconUrl: app.icon_url,
          privacyUrl: app.privacy_url,
          termsUrl: app.terms_url,
          publisher: publisher.name,
          publisherVerified: publisher.verified,
          // «Not reviewed» is said on the screen, not hidden. A test install
          // of the draft is never reviewed.
          reviewed: app.status === 'published' && config.versionId !== null,
          version: config.version,
          pricing: pricingOf(app),
        },
        requested,
        granted: grant.granted,
        refused: grant.refused,
        disclosure: permissionDisclosure(
          grant.granted,
          eventsForGrant(config.webhook_events, grant.granted),
        ),
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

    /** The apps holding a token into this business, what each may do, and whether it can be updated. */
    async installedApps(ctx: TenancyContext) {
      const { data, error } = await supabase
        .from('app_installations')
        .select('id, app_id, key_id, version_id, endpoint_id, installed_at')
        .eq('workspace_id', ctx.workspaceId)
        .eq('status', 'active')
        .order('installed_at', { ascending: false })
      check(error)
      const rows = (data ?? []) as Array<{
        id: string
        app_id: string
        key_id: string | null
        version_id: string | null
        endpoint_id: string | null
        installed_at: string
      }>
      if (rows.length === 0) return []
      const appIds = [...new Set(rows.map((r) => r.app_id))]
      const keyIds = rows.map((r) => r.key_id).filter((k): k is string => !!k)
      const versionIds = [...new Set(rows.map((r) => r.version_id).filter((v): v is string => !!v))]
      const [apps, keys, versions] = await Promise.all([
        supabase.from('oauth_apps').select(APP_COLUMNS).in('id', appIds),
        supabase.from('api_keys').select('id, scopes, last_used_at').in('id', keyIds),
        supabase.from('app_versions').select('id, version').in('id', versionIds),
      ])
      check(apps.error)
      check(keys.error)
      check(versions.error)
      const appMap = new Map(((apps.data ?? []) as unknown as AppRow[]).map((a) => [a.id, a]))
      const keyMap = new Map(
        (
          (keys.data ?? []) as Array<{ id: string; scopes: string[]; last_used_at: string | null }>
        ).map((k) => [k.id, k]),
      )
      const versionMap = new Map(
        ((versions.data ?? []) as Array<{ id: string; version: string }>).map((v) => [
          v.id,
          v.version,
        ]),
      )
      return rows.map((r) => {
        const app = appMap.get(r.app_id)
        const key = r.key_id ? keyMap.get(r.key_id) : undefined
        return {
          installationId: r.id,
          appId: r.app_id,
          appName: app?.name ?? null,
          slug: app?.slug ?? null,
          iconUrl: app?.icon_url ?? null,
          homepageUrl: app?.homepage_url ?? null,
          // null = the publisher's own test install of the draft.
          version: r.version_id ? (versionMap.get(r.version_id) ?? null) : null,
          updateAvailable:
            !!r.version_id &&
            !!app?.published_version_id &&
            app.published_version_id !== r.version_id,
          suspended: app?.status === 'suspended',
          scopes: (key?.scopes ?? []) as ApiKeyScope[],
          receivesWebhooks: !!r.endpoint_id,
          installedAt: r.installed_at,
          lastUsedAt: key?.last_used_at ?? null,
        }
      })
    },

    /** What an update would change — shown before the installer approves it. */
    async updatePreview(ctx: TenancyContext, installationId: string) {
      return (await updatePlan(ctx, installationId)).preview
    },

    /** Move to the published version, with the scopes THIS person holds. */
    async applyUpdate(ctx: TenancyContext, installationId: string) {
      const plan = await updatePlan(ctx, installationId)
      if (plan.grant.granted.length === 0) throw new OAuthError('NO_SCOPE_GRANTED', 403)
      const { error } = await supabase.rpc('update_app_installation', {
        p_installation: plan.inst.id,
        p_user: ctx.userId,
        p_version: plan.next.id,
        p_scopes: plan.grant.granted,
        p_webhook_url: plan.events.length > 0 ? plan.next.webhook_url : null,
        p_events: plan.events,
      })
      check(error)
      // The key's scopes changed: no instance may keep serving the old ones.
      if (plan.keyHash) await developer.forgetKeys([plan.keyHash])
      return plan.preview
    },

    /** Uninstall = revoke the app's key; the database ends the installation and removes its endpoint. */
    async uninstall(ctx: TenancyContext, installationId: string): Promise<void> {
      const inst = await activeInstallation(ctx, installationId)
      await developer.revokeKey(ctx, inst.key_id)
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
      const app = await clientApp(input.clientId, input.clientSecret)

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
      // …and against the version live NOW: a scope a newer published
      // version dropped is not granted.
      const config = await liveConfig(app, code.workspace_id)
      if (!config) throw new OAuthError('APP_NOT_AVAILABLE', 400, 'invalid_grant')
      if (!isCompatible(config.api_version)) {
        throw new OAuthError('APP_INCOMPATIBLE', 400, 'invalid_grant')
      }
      const scopes = (code.scopes as ApiKeyScope[]).filter((s) =>
        config.requested_scopes.includes(s),
      )
      const grant = grantForKey(scopes, (cap: Capability) => holds(ctx, cap))
      if (grant.granted.length === 0) throw new OAuthError('NO_SCOPE_GRANTED', 400, 'invalid_scope')
      const events = eventsForGrant(config.webhook_events, grant.granted)

      const token = generateApiKey()
      const refreshToken = generateRefreshToken()
      const install = {
        p_app: app.id,
        p_workspace: code.workspace_id,
        p_user: code.user_id,
        p_version: config.versionId,
        p_key_name: app.name,
        p_prefix: displayPrefix(token),
        p_key_hash: hashApiKey(token),
        p_scopes: grant.granted,
        p_webhook_url: events.length > 0 ? config.webhook_url : null,
        p_events: events,
      }
      const withRefresh = await supabase.rpc('install_oauth_app_with_refresh', {
        ...install,
        p_refresh_hash: sha256Hex(refreshToken),
        p_access_seconds: ACCESS_TOKEN_SECONDS,
        p_refresh_seconds: REFRESH_TOKEN_SECONDS,
      })
      if (!withRefresh.error) {
        return {
          access_token: token,
          token_type: 'Bearer' as const,
          expires_in: ACCESS_TOKEN_SECONDS,
          refresh_token: refreshToken,
          scope: grant.granted.join(' '),
        }
      }
      // developer-platform-08 not run on this database: the token is issued
      // as before — it does not expire and there is no refresh token. Said by
      // the ABSENCE of expires_in / refresh_token in the response (RFC 6749
      // §5.1 makes both optional), never by a refresh token that cannot work.
      if (!['PGRST202', '42883'].includes(withRefresh.error.code ?? '')) check(withRefresh.error)
      const { error: installError } = await supabase.rpc('install_oauth_app', install)
      check(installError)
      return { access_token: token, token_type: 'Bearer' as const, scope: grant.granted.join(' ') }
    },

    /**
     * refresh_token → a new access token AND a new refresh token (rotation).
     * Presenting a refresh token a second time is treated as theft: the
     * database revokes the whole family and the access token, and that is
     * committed before this answers invalid_grant.
     */
    async refresh(input: { refreshToken: string; clientId: string; clientSecret: string }) {
      const app = await clientApp(input.clientId, input.clientSecret)
      if (!looksLikeRefreshToken(input.refreshToken)) {
        throw new OAuthError('REFRESH_INVALID', 400, 'invalid_grant')
      }
      const refreshHash = sha256Hex(input.refreshToken)

      // Read only to recompute the grant; the function re-checks everything
      // under a lock and is what decides.
      const { data: found, error: findError } = await supabase
        .from('oauth_refresh_tokens')
        .select('workspace_id, installation:app_installations!inner(installed_by, key_id, status)')
        .eq('token_hash', refreshHash)
        .eq('app_id', app.id)
        .maybeSingle()
      check(findError)
      const row = found as unknown as {
        workspace_id: string
        installation: { installed_by: string; key_id: string | null; status: string }
      } | null
      if (!row) throw new OAuthError('REFRESH_INVALID', 400, 'invalid_grant')

      // The grant is recomputed against what the installer holds NOW, and
      // against the version live NOW — the same rule as at exchange.
      let ctx: TenancyContext
      try {
        ctx = await resolveWorkspaceAccess(row.installation.installed_by, row.workspace_id)
      } catch {
        throw new OAuthError('INSTALLER_NOT_MEMBER', 400, 'invalid_grant')
      }
      const config = await liveConfig(app, row.workspace_id)
      if (!config) throw new OAuthError('APP_NOT_AVAILABLE', 400, 'invalid_grant')
      let current: ApiKeyScope[] = []
      if (row.installation.key_id) {
        const { data: key, error: keyError } = await supabase
          .from('api_keys')
          .select('scopes')
          .eq('id', row.installation.key_id)
          .maybeSingle()
        check(keyError)
        current = ((key as { scopes?: string[] } | null)?.scopes ?? []) as ApiKeyScope[]
      }
      const grant = grantForKey(
        current.filter((s) => config.requested_scopes.includes(s)),
        (cap: Capability) => holds(ctx, cap),
      )
      if (grant.granted.length === 0) throw new OAuthError('NO_SCOPE_GRANTED', 400, 'invalid_scope')

      const token = generateApiKey()
      const nextRefresh = generateRefreshToken()
      const { data, error } = await supabase.rpc('rotate_oauth_refresh_token', {
        p_app: app.id,
        p_refresh_hash: refreshHash,
        p_new_refresh_hash: sha256Hex(nextRefresh),
        p_new_prefix: displayPrefix(token),
        p_new_key_hash: hashApiKey(token),
        p_scopes: grant.granted,
        p_access_seconds: ACCESS_TOKEN_SECONDS,
        p_refresh_seconds: REFRESH_TOKEN_SECONDS,
      })
      if (error?.message?.includes('OAUTH_REFRESH_INVALID')) {
        throw new OAuthError('REFRESH_INVALID', 400, 'invalid_grant')
      }
      check(error)
      const out = ((data ?? []) as Array<{ old_key_hash: string | null; reused: boolean }>)[0]
      // The old access token must stop on every instance now, not in a minute.
      if (out?.old_key_hash) await developer.forgetKeys([out.old_key_hash])
      if (!out || out.reused) throw new OAuthError('REFRESH_REUSED', 400, 'invalid_grant')
      return {
        access_token: token,
        token_type: 'Bearer' as const,
        expires_in: ACCESS_TOKEN_SECONDS,
        refresh_token: nextRefresh,
        scope: grant.granted.join(' '),
      }
    },

    /**
     * RFC 7009: the app gives its token up. The family and the access token
     * go, which ends the installation. An unknown token is NOT an error — the
     * answer is the same, so a caller learns nothing about which tokens exist.
     */
    async revoke(input: { token: string; clientId: string; clientSecret: string }): Promise<void> {
      const app = await clientApp(input.clientId, input.clientSecret)
      if (!looksLikeRefreshToken(input.token)) return
      const { data, error } = await supabase.rpc('revoke_oauth_refresh_token', {
        p_app: app.id,
        p_refresh_hash: sha256Hex(input.token),
      })
      check(error)
      if (typeof data === 'string' && data) await developer.forgetKeys([data])
    },

    // ─── platform review ─────────────────────────────────────────────────────

    async listForReview(status: OAuthAppStatus) {
      const { data, error } = await supabase
        .from('oauth_apps')
        .select(APP_COLUMNS)
        .eq('status', status)
        .order('updated_at', { ascending: true })
      check(error)
      const apps = (data ?? []) as unknown as AppRow[]
      const view = await publisherView([...new Set(apps.map((a) => a.owner_workspace_id))])
      return apps.map((a) => {
        const p = view(a.owner_workspace_id)
        return { ...a, publisher: p.name, publisherVerified: p.verified }
      })
    },

    /** Versions waiting for review, each with what the reviewer must look at. */
    async versionQueue() {
      const { data, error } = await supabase
        .from('app_versions')
        .select(VERSION_COLUMNS)
        .eq('status', 'in_review')
        .order('created_at', { ascending: true })
      check(error)
      const versions = (data ?? []) as unknown as VersionRow[]
      const appIds = [...new Set(versions.map((v) => v.app_id))]
      if (appIds.length === 0) return []
      const [apps, reports] = await Promise.all([
        supabase.from('oauth_apps').select(APP_COLUMNS).in('id', appIds),
        supabase.from('app_reports').select('app_id').in('app_id', appIds).eq('status', 'open'),
      ])
      check(apps.error)
      check(reports.error)
      const appMap = new Map(((apps.data ?? []) as unknown as AppRow[]).map((a) => [a.id, a]))
      const openReports = new Map<string, number>()
      for (const r of (reports.data ?? []) as Array<{ app_id: string }>) {
        openReports.set(r.app_id, (openReports.get(r.app_id) ?? 0) + 1)
      }
      const view = await publisherView([
        ...new Set([...appMap.values()].map((a) => a.owner_workspace_id)),
      ])
      const out = []
      for (const v of versions) {
        const app = appMap.get(v.app_id)
        if (!app) continue
        const previous = app.published_version_id
          ? await versionById(app.published_version_id)
          : null
        const publisher = view(app.owner_workspace_id)
        out.push({
          ...v,
          appName: app.name,
          appSlug: app.slug,
          appStatus: app.status,
          publisher: publisher.name,
          publisherVerified: publisher.verified,
          previousVersion: previous?.version ?? null,
          flags: riskFlags({
            version: v,
            previous,
            publisherVerified: publisher.verified,
            openReports: openReports.get(app.id) ?? 0,
          }),
        })
      }
      return out
    },

    async decideVersion(
      adminUserId: string,
      versionId: string,
      decision: 'publish' | 'reject',
      note: string | null,
    ) {
      const { error } = await supabase.rpc(
        decision === 'publish' ? 'publish_app_version' : 'reject_app_version',
        { p_version: versionId, p_admin: adminUserId, p_note: note },
      )
      check(error)
      const version = await versionById(versionId)
      if (!version) throw new OAuthError('VERSION_NOT_FOUND', 404)
      return version
    },

    /**
     * Suspend: no new installs or token exchanges. With revokeInstallations,
     * every installed token stops too (the database ends each installation).
     * Reinstate: back to published if it has a live version, else private.
     */
    async setAppStatus(
      adminUserId: string,
      id: string,
      action: 'suspend' | 'reinstate',
      revokeInstallations: boolean,
      note: string | null,
    ): Promise<AppRow> {
      const app = await appById(id)
      if (!app) throw new OAuthError('APP_NOT_FOUND', 404)
      const now = new Date().toISOString()
      const status: OAuthAppStatus =
        action === 'suspend' ? 'suspended' : app.published_version_id ? 'published' : 'private'
      const { data, error } = await supabase
        .from('oauth_apps')
        .update({
          status,
          review_note: note,
          reviewed_by: adminUserId,
          reviewed_at: now,
          updated_at: now,
        })
        .eq('id', id)
        .select(APP_COLUMNS)
        .single()
      check(error)
      if (action === 'suspend' && revokeInstallations) {
        const { data: revoked, error: revokeError } = await supabase
          .from('api_keys')
          .update({ revoked_at: now, revoked_by: adminUserId })
          .eq('app_id', id)
          .is('revoked_at', null)
          .select('key_hash')
        check(revokeError)
        await developer.forgetKeys(
          ((revoked ?? []) as Array<{ key_hash: string }>).map((k) => k.key_hash),
        )
      }
      return data as unknown as AppRow
    },
  }
}

export const oauthService = createOAuthService()
export type OAuthService = ReturnType<typeof createOAuthService>
