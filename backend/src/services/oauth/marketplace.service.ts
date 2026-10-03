// ============================================
// backend/src/services/oauth/marketplace.service.ts
//
// The marketplace around OAuth apps
// (docs/developer-platform-07-marketplace-migration.sql):
//
//   any member      browse, open a listing, report an app
//   owner/manager   rate an app THIS business installed (one review per
//                   business), edit the publisher profile, screenshots,
//                   read their apps' analytics and health
//   platform admin  verify publishers, work the report queue, hide reviews
//
// Every number is an exact count from the database (راهنمای سشن §۷٫۴).
// Reviews are shown without the reviewing business's name: who uses which
// software is that business's own information.
// ============================================

import type {
  AppCategory,
  AppReportInput,
  AppReviewInput,
  AppScreenshotInput,
  PublisherProfileInput,
} from '@hisabche/validation'
import { APP_SCREENSHOT_LIMIT } from '@hisabche/validation'

import { randomUUID } from 'node:crypto'

import { supabase } from '../../db'
import { IMAGE_EXTENSION, sniffImageType } from '../blog/blog.domain'
import { NotConfiguredError } from '../developer/developer.repository'
import type { TenancyContext } from '../tenancy.service'
import { appHealth, permissionDisclosure } from './oauth.domain'

/** developer-platform-08: icons and screenshots, public, png/jpeg/webp, 1 MB. */
export const APP_IMAGE_BUCKET = 'app-images'
export const APP_IMAGE_MAX_BYTES = 1024 * 1024
const APP_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
import {
  APP_COLUMNS,
  OAuthError,
  PUBLISHER_COLUMNS,
  VERSION_COLUMNS,
  appById,
  check,
  pricingOf,
  publisherView,
  workspaceNames,
  type AppRow,
  type PublisherRow,
  type VersionRow,
} from './oauth.repository'

interface ListingStats {
  app_id: string
  reviews: number
  average: number | null
  stars: number[]
  active_installs: number
}

async function listingStats(appIds: string[]): Promise<Map<string, ListingStats>> {
  if (appIds.length === 0) return new Map()
  const { data, error } = await supabase.rpc('oauth_app_listing_stats', { p_apps: appIds })
  check(error)
  return new Map(
    ((data ?? []) as Array<Record<string, unknown>>).map((r) => [
      String(r.app_id),
      {
        app_id: String(r.app_id),
        reviews: Number(r.reviews ?? 0),
        average: r.average === null || r.average === undefined ? null : Number(r.average),
        stars: ((r.stars as unknown[]) ?? []).map(Number),
        active_installs: Number(r.active_installs ?? 0),
      },
    ]),
  )
}

/** Escapes a search term for a PostgREST ilike filter. */
function likeTerm(q: string): string {
  return `%${q.replace(/[\\%_,()]/g, (c) => `\\${c}`)}%`
}

export function createMarketplaceService() {
  async function ownApp(ctx: TenancyContext, id: string): Promise<AppRow> {
    const app = await appById(id)
    if (!app || app.owner_workspace_id !== ctx.workspaceId)
      throw new OAuthError('APP_NOT_FOUND', 404)
    return app
  }

  /** A listing this workspace may see: published, or its own (a preview). */
  async function visibleApp(ctx: TenancyContext, slugOrId: string): Promise<AppRow> {
    const byId = /^[0-9a-f-]{36}$/.test(slugOrId)
    const { data, error } = await supabase
      .from('oauth_apps')
      .select(APP_COLUMNS)
      .eq(byId ? 'id' : 'slug', slugOrId)
      .maybeSingle()
    check(error)
    const app = data as unknown as AppRow | null
    if (!app || (app.status !== 'published' && app.owner_workspace_id !== ctx.workspaceId)) {
      throw new OAuthError('APP_NOT_FOUND', 404)
    }
    return app
  }

  async function everInstalled(
    appId: string,
    workspaceId: string,
  ): Promise<{ ever: boolean; active: boolean }> {
    const { data, error } = await supabase
      .from('app_installations')
      .select('status')
      .eq('app_id', appId)
      .eq('workspace_id', workspaceId)
    check(error)
    const rows = (data ?? []) as Array<{ status: string }>
    return { ever: rows.length > 0, active: rows.some((r) => r.status === 'active') }
  }

  async function screenshotsOf(ctx: TenancyContext, appId: string) {
    await ownApp(ctx, appId)
    const { data, error } = await supabase
      .from('app_screenshots')
      .select('id, url, caption, position')
      .eq('app_id', appId)
      .order('position', { ascending: true })
    check(error)
    return (data ?? []) as Array<{ id: string; url: string; caption: string; position: number }>
  }

  /** Usage per day, install counts and health — exact, from the request log and deliveries. */
  async function statsOf(ctx: TenancyContext | null, appId: string, days: number) {
    // null ctx = a platform admin (any app).
    if (ctx) await ownApp(ctx, appId)
    const [usage, totals] = await Promise.all([
      supabase.rpc('oauth_app_usage', { p_app: appId, p_days: days }),
      supabase.rpc('oauth_app_stats', { p_app: appId, p_days: days }),
    ])
    check(usage.error)
    check(totals.error)
    const t = ((totals.data ?? []) as Array<Record<string, unknown>>)[0] ?? {}
    const n = (k: string) => Number(t[k] ?? 0)
    const counts = {
      requests24h: n('requests_24h'),
      serverErrors24h: n('server_errors_24h'),
      deliveries24h: n('deliveries_24h'),
      failedDeliveries24h: n('failed_deliveries_24h'),
    }
    return {
      days,
      usage: ((usage.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        day: String(r.day),
        requests: Number(r.requests),
        clientErrors: Number(r.client_errors),
        serverErrors: Number(r.server_errors),
        avgMs: Number(r.avg_ms),
      })),
      installs: {
        active: n('active_installs'),
        installedInPeriod: n('installs_in_period'),
        uninstalledInPeriod: n('uninstalls_in_period'),
      },
      lastRequestAt: (t.last_request_at as string | null) ?? null,
      ...counts,
      health: appHealth(counts),
    }
  }

  return {
    // ─── browse ──────────────────────────────────────────────────────────────

    async list(
      ctx: TenancyContext,
      filter: { category?: AppCategory | undefined; q?: string | undefined },
    ) {
      let query = supabase.from('oauth_apps').select(APP_COLUMNS).eq('status', 'published')
      if (filter.category) query = query.eq('category', filter.category)
      if (filter.q) {
        const term = likeTerm(filter.q)
        query = query.or(`name.ilike.${term},tagline.ilike.${term}`)
      }
      const { data, error } = await query.order('name', { ascending: true })
      check(error)
      const apps = (data ?? []) as unknown as AppRow[]
      const ids = apps.map((a) => a.id)
      const [stats, view, installed] = await Promise.all([
        listingStats(ids),
        publisherView([...new Set(apps.map((a) => a.owner_workspace_id))]),
        ids.length
          ? supabase
              .from('app_installations')
              .select('app_id')
              .eq('workspace_id', ctx.workspaceId)
              .eq('status', 'active')
              .in('app_id', ids)
          : Promise.resolve({ data: [], error: null }),
      ])
      check(installed.error)
      const mine = new Set(
        ((installed.data ?? []) as Array<{ app_id: string }>).map((r) => r.app_id),
      )
      return apps.map((a) => {
        const p = view(a.owner_workspace_id)
        const s = stats.get(a.id)
        return {
          id: a.id,
          slug: a.slug,
          name: a.name,
          tagline: a.tagline,
          category: a.category,
          iconUrl: a.icon_url,
          publisher: p.name,
          publisherVerified: p.verified,
          pricing: pricingOf(a),
          rating: s?.average ?? null,
          reviews: s?.reviews ?? 0,
          activeInstalls: s?.active_installs ?? 0,
          installed: mine.has(a.id),
        }
      })
    },

    /** One listing, everything an installer should know before installing. */
    async detail(ctx: TenancyContext, slugOrId: string) {
      const app = await visibleApp(ctx, slugOrId)
      const isOwner = app.owner_workspace_id === ctx.workspaceId
      const [screens, history, reviews, myReview, stats, view, installs] = await Promise.all([
        supabase
          .from('app_screenshots')
          .select('id, url, caption, position')
          .eq('app_id', app.id)
          .order('position', { ascending: true }),
        supabase
          .from('app_versions')
          .select(VERSION_COLUMNS)
          .eq('app_id', app.id)
          .in('status', ['published', 'superseded'])
          .order('published_at', { ascending: false }),
        supabase
          .from('app_reviews')
          .select('id, rating, body, created_at, updated_at, workspace_id')
          .eq('app_id', app.id)
          .is('hidden_at', null)
          .order('updated_at', { ascending: false })
          .limit(50),
        supabase
          .from('app_reviews')
          .select('id, rating, body, hidden_at, updated_at')
          .eq('app_id', app.id)
          .eq('workspace_id', ctx.workspaceId)
          .maybeSingle(),
        listingStats([app.id]),
        publisherView([app.owner_workspace_id]),
        everInstalled(app.id, ctx.workspaceId),
      ])
      check(screens.error)
      check(history.error)
      check(reviews.error)
      check(myReview.error)
      const versions = (history.data ?? []) as unknown as VersionRow[]
      const live = versions.find((v) => v.status === 'published') ?? null
      const s = stats.get(app.id)
      const p = view(app.owner_workspace_id)
      // What an installer is shown as the app's reach: the PUBLISHED version.
      // The owner previewing an unpublished app sees the draft, labelled so.
      const reach = live ?? (isOwner ? app : null)
      return {
        id: app.id,
        slug: app.slug,
        name: app.name,
        tagline: app.tagline,
        description: app.description,
        category: app.category,
        iconUrl: app.icon_url,
        homepageUrl: app.homepage_url,
        privacyUrl: app.privacy_url,
        termsUrl: app.terms_url,
        installUrl: app.install_url,
        status: app.status,
        isOwner,
        pricing: pricingOf(app),
        publisher: {
          name: p.name,
          verified: p.verified,
          websiteUrl: p.websiteUrl,
          supportEmail: p.supportEmail,
          bio: p.bio,
        },
        screenshots: (screens.data ?? []) as Array<{
          id: string
          url: string
          caption: string
          position: number
        }>,
        version: live
          ? { version: live.version, publishedAt: live.published_at, apiVersion: live.api_version }
          : null,
        previewingDraft: !live && isOwner,
        disclosure: reach
          ? permissionDisclosure(reach.requested_scopes, reach.webhook_events)
          : null,
        changelog: versions.map((v) => ({
          version: v.version,
          changelog: v.changelog,
          publishedAt: v.published_at,
        })),
        rating: {
          average: s?.average ?? null,
          reviews: s?.reviews ?? 0,
          stars: s?.stars ?? [0, 0, 0, 0, 0],
        },
        activeInstalls: s?.active_installs ?? 0,
        reviews: (
          (reviews.data ?? []) as Array<{
            id: string
            rating: number
            body: string
            created_at: string
            updated_at: string
            workspace_id: string
          }>
        ).map((r) => ({
          id: r.id,
          rating: r.rating,
          body: r.body,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          mine: r.workspace_id === ctx.workspaceId,
        })),
        myReview: (myReview.data as {
          id: string
          rating: number
          body: string
          hidden_at: string | null
        } | null)
          ? {
              rating: (myReview.data as { rating: number }).rating,
              body: (myReview.data as { body: string }).body,
              hidden: !!(myReview.data as { hidden_at: string | null }).hidden_at,
            }
          : null,
        installed: installs.active,
        // Only a business that actually used the app may rate it, and never its publisher.
        canReview: installs.ever && !isOwner,
      }
    },

    // ─── reviews and reports ─────────────────────────────────────────────────

    async saveReview(ctx: TenancyContext, appId: string, input: AppReviewInput) {
      const app = await visibleApp(ctx, appId)
      if (app.owner_workspace_id === ctx.workspaceId) throw new OAuthError('REVIEW_OWN_APP', 403)
      if (!(await everInstalled(app.id, ctx.workspaceId)).ever) {
        throw new OAuthError('REVIEW_NOT_INSTALLED', 403)
      }
      const { data, error } = await supabase
        .from('app_reviews')
        .upsert(
          {
            app_id: app.id,
            workspace_id: ctx.workspaceId,
            user_id: ctx.userId,
            rating: input.rating,
            body: input.body,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'app_id,workspace_id' },
        )
        .select('id, rating, body, updated_at')
        .single()
      check(error)
      return data as { id: string; rating: number; body: string; updated_at: string }
    },

    async deleteReview(ctx: TenancyContext, appId: string): Promise<void> {
      const { data, error } = await supabase
        .from('app_reviews')
        .delete()
        .eq('app_id', appId)
        .eq('workspace_id', ctx.workspaceId)
        .select('id')
      check(error)
      if (((data ?? []) as unknown[]).length === 0) throw new OAuthError('REVIEW_NOT_FOUND', 404)
    },

    /** A second report while one is open is the same report — returned, not duplicated. */
    async report(ctx: TenancyContext, appId: string, input: AppReportInput) {
      const app = await visibleApp(ctx, appId)
      const { data: open, error: openError } = await supabase
        .from('app_reports')
        .select('id, reason, status, created_at')
        .eq('app_id', app.id)
        .eq('workspace_id', ctx.workspaceId)
        .eq('status', 'open')
        .maybeSingle()
      check(openError)
      if (open) return { ...(open as Record<string, unknown>), duplicate: true }
      const { data, error } = await supabase
        .from('app_reports')
        .insert({
          app_id: app.id,
          workspace_id: ctx.workspaceId,
          user_id: ctx.userId,
          reason: input.reason,
          details: input.details,
        })
        .select('id, reason, status, created_at')
        .single()
      check(error)
      return { ...(data as Record<string, unknown>), duplicate: false }
    },

    // ─── publisher ───────────────────────────────────────────────────────────

    async publisherProfile(ctx: TenancyContext): Promise<PublisherRow | null> {
      const { data, error } = await supabase
        .from('app_publishers')
        .select(PUBLISHER_COLUMNS)
        .eq('workspace_id', ctx.workspaceId)
        .maybeSingle()
      check(error)
      return (data as PublisherRow | null) ?? null
    },

    /** Changing the name or website clears a verified badge — in the database, not here. */
    async savePublisherProfile(
      ctx: TenancyContext,
      input: PublisherProfileInput,
    ): Promise<PublisherRow> {
      const { data, error } = await supabase
        .from('app_publishers')
        .upsert(
          {
            workspace_id: ctx.workspaceId,
            display_name: input.displayName,
            website_url: input.websiteUrl ?? null,
            support_email: input.supportEmail ?? null,
            bio: input.bio,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'workspace_id' },
        )
        .select(PUBLISHER_COLUMNS)
        .single()
      check(error)
      return data as PublisherRow
    },

    screenshots: screenshotsOf,

    /**
     * Store an icon or a screenshot and answer with its public URL — which the
     * publisher then saves through the existing icon / screenshot fields.
     *
     * The type is decided by the BYTES (png, jpeg or webp), never by a name or
     * a claimed type; the object's name is random. Until now these two fields
     * took any https URL, so a listing's images lived on someone else's server
     * and could change after review.
     */
    async uploadImage(
      ctx: TenancyContext,
      appId: string,
      base64: string,
    ): Promise<{ url: string }> {
      await ownApp(ctx, appId)
      const bytes = Buffer.from(base64, 'base64')
      const mime = sniffImageType(bytes)
      if (bytes.length === 0 || !mime || !APP_IMAGE_TYPES.includes(mime)) {
        throw new OAuthError('IMAGE_INVALID', 415)
      }
      if (bytes.length > APP_IMAGE_MAX_BYTES) throw new OAuthError('IMAGE_TOO_LARGE', 413)
      const path = `${randomUUID()}.${IMAGE_EXTENSION[mime]}`
      const upload = await supabase.storage.from(APP_IMAGE_BUCKET).upload(path, bytes, {
        contentType: mime,
        upsert: false,
        cacheControl: '31536000',
      })
      if (upload.error) {
        // The bucket comes with developer-platform-08.
        if (/bucket not found/i.test(upload.error.message)) throw new NotConfiguredError()
        throw Object.assign(new Error(upload.error.message), { code: 'STORAGE' })
      }
      return { url: supabase.storage.from(APP_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl }
    },

    /** Into the first free position; the database's (app, position) key refuses a ninth. */
    async addScreenshot(ctx: TenancyContext, appId: string, input: AppScreenshotInput) {
      const existing = await screenshotsOf(ctx, appId)
      const taken = new Set(existing.map((s) => s.position))
      const position = Array.from({ length: APP_SCREENSHOT_LIMIT }, (_, i) => i).find(
        (i) => !taken.has(i),
      )
      if (position === undefined) throw new OAuthError('SCREENSHOT_LIMIT', 409)
      const { data, error } = await supabase
        .from('app_screenshots')
        .insert({ app_id: appId, url: input.url, caption: input.caption, position })
        .select('id, url, caption, position')
        .single()
      if (error?.code === '23505') throw new OAuthError('SCREENSHOT_LIMIT', 409)
      check(error)
      return data as { id: string; url: string; caption: string; position: number }
    },

    async removeScreenshot(
      ctx: TenancyContext,
      appId: string,
      screenshotId: string,
    ): Promise<void> {
      await ownApp(ctx, appId)
      const { data, error } = await supabase
        .from('app_screenshots')
        .delete()
        .eq('id', screenshotId)
        .eq('app_id', appId)
        .select('id')
      check(error)
      if (((data ?? []) as unknown[]).length === 0)
        throw new OAuthError('SCREENSHOT_NOT_FOUND', 404)
    },

    stats: statsOf,

    // ─── platform ────────────────────────────────────────────────────────────

    async listPublishers() {
      const { data, error } = await supabase
        .from('app_publishers')
        .select(PUBLISHER_COLUMNS)
        .order('display_name', { ascending: true })
      check(error)
      const rows = (data ?? []) as PublisherRow[]
      const names = await workspaceNames(rows.map((r) => r.workspace_id))
      return rows.map((r) => ({ ...r, workspaceName: names.get(r.workspace_id) ?? null }))
    },

    async setVerified(
      adminUserId: string,
      workspaceId: string,
      verified: boolean,
    ): Promise<PublisherRow> {
      const { data, error } = await supabase
        .from('app_publishers')
        .update(
          verified
            ? { verified_at: new Date().toISOString(), verified_by: adminUserId }
            : { verified_at: null, verified_by: null },
        )
        .eq('workspace_id', workspaceId)
        .select(PUBLISHER_COLUMNS)
        .maybeSingle()
      check(error)
      if (!data) throw new OAuthError('PUBLISHER_NOT_FOUND', 404)
      return data as PublisherRow
    },

    async listReports(status: 'open' | 'resolved' | 'dismissed') {
      const { data, error } = await supabase
        .from('app_reports')
        .select(
          'id, app_id, workspace_id, reason, details, status, resolution_note, created_at, resolved_at',
        )
        .eq('status', status)
        .order('created_at', { ascending: true })
      check(error)
      const rows = (data ?? []) as Array<
        { app_id: string; workspace_id: string } & Record<string, unknown>
      >
      const appIds = [...new Set(rows.map((r) => r.app_id))]
      const [apps, names] = await Promise.all([
        appIds.length
          ? supabase.from('oauth_apps').select('id, name, status').in('id', appIds)
          : Promise.resolve({ data: [], error: null }),
        workspaceNames([...new Set(rows.map((r) => r.workspace_id))]),
      ])
      check(apps.error)
      const appMap = new Map(
        ((apps.data ?? []) as Array<{ id: string; name: string; status: string }>).map((a) => [
          a.id,
          a,
        ]),
      )
      return rows.map((r) => ({
        ...r,
        appName: appMap.get(r.app_id)?.name ?? null,
        appStatus: appMap.get(r.app_id)?.status ?? null,
        reporter: names.get(r.workspace_id) ?? null,
      }))
    },

    async resolveReport(
      adminUserId: string,
      id: string,
      status: 'resolved' | 'dismissed',
      note: string | null,
    ) {
      const { data, error } = await supabase
        .from('app_reports')
        .update({
          status,
          resolution_note: note,
          resolved_by: adminUserId,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'open')
        .select('id, status')
        .maybeSingle()
      check(error)
      if (!data) throw new OAuthError('REPORT_NOT_FOUND', 404)
      return data as { id: string; status: string }
    },

    async listReviews(hidden: boolean) {
      let query = supabase
        .from('app_reviews')
        .select('id, app_id, workspace_id, rating, body, hidden_at, hidden_reason, updated_at')
      query = hidden ? query.not('hidden_at', 'is', null) : query.is('hidden_at', null)
      const { data, error } = await query.order('updated_at', { ascending: false }).limit(100)
      check(error)
      const rows = (data ?? []) as Array<
        { app_id: string; workspace_id: string } & Record<string, unknown>
      >
      const appIds = [...new Set(rows.map((r) => r.app_id))]
      const [apps, names] = await Promise.all([
        appIds.length
          ? supabase.from('oauth_apps').select('id, name').in('id', appIds)
          : Promise.resolve({ data: [], error: null }),
        workspaceNames([...new Set(rows.map((r) => r.workspace_id))]),
      ])
      check(apps.error)
      const appNames = new Map(
        ((apps.data ?? []) as Array<{ id: string; name: string }>).map((a) => [a.id, a.name]),
      )
      return rows.map((r) => ({
        ...r,
        appName: appNames.get(r.app_id) ?? null,
        reviewer: names.get(r.workspace_id) ?? null,
      }))
    },

    async setReviewHidden(adminUserId: string, id: string, hidden: boolean, reason: string | null) {
      const { data, error } = await supabase
        .from('app_reviews')
        .update(
          hidden
            ? { hidden_at: new Date().toISOString(), hidden_by: adminUserId, hidden_reason: reason }
            : { hidden_at: null, hidden_by: null, hidden_reason: null },
        )
        .eq('id', id)
        .select('id, hidden_at')
        .maybeSingle()
      check(error)
      if (!data) throw new OAuthError('REVIEW_NOT_FOUND', 404)
      return data as { id: string; hidden_at: string | null }
    },

    /** For the admin: an app's numbers, without a publisher context. */
    async adminStats(appId: string, days: number) {
      if (!(await appById(appId))) throw new OAuthError('APP_NOT_FOUND', 404)
      return statsOf(null, appId, days)
    },
  }
}

export const marketplaceService = createMarketplaceService()
export type MarketplaceService = ReturnType<typeof createMarketplaceService>
