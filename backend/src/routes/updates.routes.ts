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

import { supabase } from '../db'

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
            // ⚠️ SHORT CACHE, AND `must-revalidate`. A long one means a release
            // is invisible for as long as it lasts, and the whole point of
            // pushing an update is that it arrives.
            .header('Cache-Control', 'public, max-age=60, must-revalidate')
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
}
