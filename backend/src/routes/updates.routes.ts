// ============================================
// backend/src/routes/updates.routes.ts
//
// The desktop application's update feed.
//
// ---------------------------------------------------------------------------
// WHAT electron-updater ACTUALLY ASKS FOR
//
// Its `generic` provider makes exactly two kinds of request against a base URL:
//
//   GET <base>/latest.yml        the manifest — version, file name, sha512
//   GET <base>/<file named in that manifest>
//
// So this serves those two paths and nothing else. The manifest is generated
// from `app_releases`; the binary is not stored here — the second route
// redirects to wherever the release was uploaded.
//
// ---------------------------------------------------------------------------
// ⚠️ DELIBERATELY UNAUTHENTICATED
//
// The updater runs before anyone signs in, and on a machine whose session may
// have expired. Requiring a token would mean an app that can only update while
// someone happens to be logged in — which is the opposite of what an update
// channel is for.
//
// Nothing here is tenant data. A release is the same file for every customer,
// and its version number is on the download page anyway. There is no
// `workspace_id` in this module because there is no workspace: this is the
// product, not anybody's books.
//
// ⚠️ PUBLISHING one, however, is not public. See `updates-admin.routes.ts` —
// writing a release row is a platform-admin action.
//
// ---------------------------------------------------------------------------
// ⚠️ sha512 IS THE SECURITY BOUNDARY, NOT https
//
// electron-updater verifies the downloaded file against the `sha512` in the
// manifest before it will run it. If that field is wrong the update is
// refused, which is exactly right: a compromised file host cannot ship a
// binary this backend did not vouch for. So the hash is REQUIRED on a release
// row and is never computed here from whatever arrived — it is recorded when
// the release is published, from the artifact that was actually built.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { supabase } from '../db'
import { authenticate } from '../middleware/auth.middleware'
import { requireAdminPermission } from '../middleware/admin-rbac.middleware'
import { platformAdminGuard } from '../middleware/platform-admin.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import {
  checkCompatibleUpdates,
  promoteReleaseRing,
  recordDeviceRolloutTelemetry,
} from '../services/updates/control-plane.service'

/** Platforms a release can target. Matches what electron-builder produces. */
const PLATFORMS = new Set(['win', 'mac', 'linux'])

interface ReleaseRow {
  version: string
  file_name: string
  file_size: number
  sha512: string
  release_notes: string | null
  download_url: string
  released_at: string
}

/**
 * The newest published release for a platform, or `null`.
 *
 * ⚠️ ORDERED BY `released_at`, NOT BY VERSION. Sorting version strings
 * lexically puts `0.9.0` after `0.10.0`, so a text sort would serve an older
 * build as the newest one and every client would refuse to move.
 */
async function latestRelease(platform: string): Promise<ReleaseRow | null> {
  const { data, error } = await supabase
    .from('app_releases')
    .select('version, file_name, file_size, sha512, release_notes, download_url, released_at')
    .eq('platform', platform)
    .eq('is_published', true)
    .order('released_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // A missing table is «no releases yet», not a 500. The migration may not
  // have run on this deployment, and an updater that reports «no update» is
  // correct in both cases.
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return null
    throw error
  }

  return (data as ReleaseRow | null) ?? null
}

/**
 * The manifest, in the shape electron-updater parses.
 *
 * Hand-written rather than passed through a YAML library: the document is four
 * scalar fields and one list entry, and every value is quoted, so there is
 * nothing for a serializer to decide. It also keeps the exact key names
 * visible, which is what the client matches on.
 */
function toManifest(release: ReleaseRow): string {
  const quoted = (value: string) => JSON.stringify(value)

  return [
    `version: ${release.version}`,
    `files:`,
    `  - url: ${quoted(release.file_name)}`,
    `    sha512: ${quoted(release.sha512)}`,
    `    size: ${release.file_size}`,
    `path: ${quoted(release.file_name)}`,
    `sha512: ${quoted(release.sha512)}`,
    `releaseDate: ${quoted(new Date(release.released_at).toISOString())}`,
    ...(release.release_notes ? [`releaseNotes: ${quoted(release.release_notes)}`] : []),
    '',
  ].join('\n')
}

export async function updatesRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════
  // GET /api/updates/:platform/latest.yml
  // ═══════════════════════════════════════════════════════════
  fastify.get(
    '/api/updates/:platform/latest.yml',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { platform } = request.params as { platform: string }
      if (!PLATFORMS.has(platform)) return reply.code(404).send()

      try {
        const release = await latestRelease(platform)

        // ⚠️ 404, NOT AN EMPTY MANIFEST. electron-updater treats a 404 as «no
        // feed yet» and reports no update; a manifest with an empty version
        // makes it throw and the app shows a failure for a channel that is
        // simply not in use.
        if (!release) return reply.code(404).send()

        return (
          reply
            .header('Content-Type', 'text/yaml; charset=utf-8')
            // ⚠️ SHORT CACHE. A long one means a release
            // is invisible for as long as it lasts, and the whole point of
            // pushing an update is that it arrives.
            // `s-maxage` lets Cloudflare answer every installed copy's poll;
            // `stale-if-error` keeps the feed up while Render is not — which is
            // why `must-revalidate` went: it forbids exactly that. An old
            // manifest during an outage only means «no update yet».
            .header('Cache-Control', 'public, max-age=60, s-maxage=60, stale-if-error=86400')
            .send(toManifest(release))
        )
      } catch (err) {
        fastify.log.error(err, 'Failed to build the update manifest')
        return reply.code(500).send()
      }
    },
  )

  // ═══════════════════════════════════════════════════════════
  // GET /api/updates/:platform/:fileName
  //
  // The installer itself. Redirected rather than proxied: the binary is ~80 MB
  // and streaming it through this process would hold a Node worker for the
  // length of every download on every connection.
  // ═══════════════════════════════════════════════════════════
  fastify.get(
    '/api/updates/:platform/:fileName',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { platform, fileName } = request.params as { platform: string; fileName: string }
      if (!PLATFORMS.has(platform)) return reply.code(404).send()

      try {
        const release = await latestRelease(platform)
        if (!release) return reply.code(404).send()

        // ⚠️ THE NAME MUST MATCH THE MANIFEST, EXACTLY.
        //
        // Without this the route would redirect ANY requested name to the
        // current binary — so a client asking for the file it was promised
        // could silently receive a different one. It would then fail the
        // sha512 check and report a corrupt download, which sends whoever is
        // debugging it to the file host rather than to this line.
        if (fileName !== release.file_name) return reply.code(404).send()

        return reply.redirect(release.download_url, 302)
      } catch (err) {
        fastify.log.error(err, 'Failed to resolve the release download')
        return reply.code(500).send()
      }
    },
  )

  // ═══════════════════════════════════════════════════════════
  // V13 UNIFIED UPDATE CONTROL PLANE (/api/updates/v2/*)
  // Extends the single update authority without a second registry.
  // ═══════════════════════════════════════════════════════════
  const checkQuerySchema = z.object({
    platform: z.enum(['web', 'windows', 'android']),
    channel: z.enum(['development', 'internal', 'beta', 'stable']).default('stable'),
    deviceId: z.string().trim().min(1).max(128),
    clientVersion: z.string().trim().min(1).max(40).default('1.0.0'),
    requiredApiRange: z.string().trim().min(1).max(64).default('>=1.0.0 <2.0.0'),
  })

  fastify.get(
    '/api/updates/v2/check',
    {
      preHandler: [authenticate, requireWorkspaceContext],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = checkQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'INVALID_UPDATE_CHECK_QUERY', details: parsed.error.flatten() })
      }
      try {
        const workspaceId = request.tenancy?.workspaceId
        let workspaceCapabilities: string[] = []
        if (workspaceId) {
          const { data: ws } = await supabase
            .from('workspaces')
            .select('plan')
            .eq('id', workspaceId)
            .maybeSingle()
          const plan = (ws as { plan?: string } | null)?.plan ?? 'free'
          workspaceCapabilities =
            plan === 'free'
              ? ['core']
              : [
                  'core',
                  'operations',
                  'manufacturing',
                  'workforce',
                  'approvals',
                  'intelligence',
                  'marketplace',
                  'crm_campaigns',
                ]
        }

        const result = await checkCompatibleUpdates({
          platform: parsed.data.platform,
          channel: parsed.data.channel,
          deviceId: parsed.data.deviceId,
          clientVersion: parsed.data.clientVersion,
          clientRequiredApiRange: parsed.data.requiredApiRange,
          workspaceId,
          workspaceCapabilities,
        })

        if (result.apiCompatibility === 'STRUCTURED_UPGRADE_REQUIRED') {
          return reply.code(426).send({
            code: 'UPGRADE_REQUIRED',
            offlineSafe: true,
            minSupportedClientVersion: result.minSupportedClientVersion,
            serverApiVersion: result.serverApiVersion,
            serverTimeMs: result.serverTimeMs,
            coreUpdate: result.coreUpdate,
          })
        }

        return reply.send(result)
      } catch (err) {
        fastify.log.error(err, 'Failed to check compatible updates')
        return reply.code(500).send({ error: 'UPDATE_CHECK_FAILED' })
      }
    },
  )

  const telemetryBodySchema = z.object({
    deviceId: z.string().trim().min(1).max(128),
    releaseId: z.string().uuid(),
    ring: z.enum(['development', 'internal', 'canary', 'expanded', 'everyone']),
    eventKind: z.enum([
      'activation_success',
      'startup_failure',
      'rollback_triggered',
      'signature_failure',
    ]),
    reasonCode: z.string().trim().max(120).optional(),
  })

  fastify.post(
    '/api/updates/v2/telemetry',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = telemetryBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'INVALID_TELEMETRY_PAYLOAD' })
      }
      const workspaceId = request.tenancy?.workspaceId
      if (!workspaceId) {
        return reply.code(403).send({ error: 'WORKSPACE_REQUIRED' })
      }
      const res = await recordDeviceRolloutTelemetry({
        workspaceId,
        deviceId: parsed.data.deviceId,
        releaseId: parsed.data.releaseId,
        ring: parsed.data.ring,
        eventKind: parsed.data.eventKind,
        reasonCode: parsed.data.reasonCode,
      })
      return reply.send(res)
    },
  )

  const publishReleaseSchema = z.object({
    layer: z.enum(['core', 'module', 'data-pack', 'bootstrap']),
    componentId: z.string().trim().min(1).max(80),
    version: z.string().trim().min(1).max(40),
    channel: z.enum(['development', 'internal', 'beta', 'stable']),
    ring: z.enum(['development', 'internal', 'canary', 'expanded', 'everyone']).default('internal'),
    rolloutPercent: z.number().int().min(0).max(100).default(5),
    platforms: z.array(z.enum(['web', 'windows', 'android'])).min(1),
    manifestJson: z.record(z.string(), z.unknown()),
    signatureJson: z.record(z.string(), z.unknown()),
    sequenceNo: z.number().int().min(1),
    rollbackTargetVersion: z.string().trim().max(40).nullable().optional(),
    minSupportedVersion: z.string().trim().max(40).default('1.0.0'),
  })

  fastify.post(
    '/api/updates/v2/releases',
    {
      preHandler: [authenticate, platformAdminGuard, requireAdminPermission('operations.jobs.run')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = publishReleaseSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'INVALID_RELEASE_PAYLOAD', details: parsed.error.flatten() })
      }
      const { data, error } = await supabase
        .from('runtime_release_artifacts')
        .insert({
          layer: parsed.data.layer,
          component_id: parsed.data.componentId,
          version: parsed.data.version,
          channel: parsed.data.channel,
          ring: parsed.data.ring,
          rollout_percent: parsed.data.rolloutPercent,
          platforms: parsed.data.platforms,
          manifest_json: parsed.data.manifestJson,
          signature_json: parsed.data.signatureJson,
          sequence_no: parsed.data.sequenceNo,
          status: 'active',
          rollback_target_version: parsed.data.rollbackTargetVersion ?? null,
          min_supported_version: parsed.data.minSupportedVersion,
        })
        .select('id, layer, component_id, version, channel, ring, rollout_percent, status')
        .single()
      if (error) return reply.code(500).send({ error: error.message })
      return reply.code(201).send({ release: data })
    },
  )

  const promoteSchema = z.object({
    targetRing: z.enum(['development', 'internal', 'canary', 'expanded', 'everyone']),
    rolloutPercent: z.number().int().min(0).max(100),
  })

  fastify.post(
    '/api/updates/v2/releases/:releaseId/promote',
    {
      preHandler: [authenticate, platformAdminGuard, requireAdminPermission('operations.jobs.run')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { releaseId } = request.params as { releaseId: string }
      const parsed = promoteSchema.safeParse(request.body)
      if (!parsed.success) return reply.code(400).send({ error: 'INVALID_PROMOTE_PAYLOAD' })
      const res = await promoteReleaseRing({
        releaseId,
        targetRing: parsed.data.targetRing,
        rolloutPercent: parsed.data.rolloutPercent,
      })
      if (!res.ok) return reply.code(409).send(res)
      return reply.send(res)
    },
  )

  const haltSchema = z.object({
    status: z.enum(['halted', 'revoked']).default('halted'),
    reason: z.string().trim().min(3).max(200),
    rollbackTarget: z.string().trim().max(40).nullable().optional(),
    directiveJson: z.record(z.string(), z.unknown()),
    signatureJson: z.record(z.string(), z.unknown()),
    sequenceNo: z.number().int().min(1),
  })

  fastify.post(
    '/api/updates/v2/releases/:releaseId/halt',
    {
      preHandler: [authenticate, platformAdminGuard, requireAdminPermission('operations.jobs.run')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { releaseId } = request.params as { releaseId: string }
      const parsed = haltSchema.safeParse(request.body)
      if (!parsed.success) return reply.code(400).send({ error: 'INVALID_HALT_PAYLOAD' })
      const { data, error } = await supabase.rpc('halt_runtime_release_atomic', {
        p_release_id: releaseId,
        p_status: parsed.data.status,
        p_reason: parsed.data.reason,
        p_rollback_target: parsed.data.rollbackTarget ?? null,
        p_directive_json: parsed.data.directiveJson,
        p_signature_json: parsed.data.signatureJson,
        p_sequence_no: parsed.data.sequenceNo,
      })
      if (error) return reply.code(500).send({ error: error.message })
      return reply.send(data)
    },
  )
}
