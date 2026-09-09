// ============================================
// The desktop update feed.
//
// ---------------------------------------------------------------------------
// WHY IT MATTERS MORE THAN IT LOOKS
//
// This endpoint decides what binary every desktop installation runs next.
// electron-updater verifies the file against the `sha512` in the manifest
// before executing it, so that field is the security boundary — not https, and
// not the file host. A manifest that omits it, or carries the wrong one, either
// refuses every update or accepts a file this backend never vouched for.
//
// It is also the one route in this backend with no `workspace_id`, which is
// correct and worth stating: a release is the same file for every customer.
// The tests below pin both the correctness of the manifest and the reasons the
// module is shaped the way it is.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROUTE = join(__dirname, '..', 'routes', 'updates.routes.ts')
const MIGRATION = join(
  __dirname,
  '..',
  '..',
  '..',
  'docs',
  'module-desktop-update-feed-migration.sql',
)

/** Comments stripped — the reasoning is discussed at length in comments. */
const source = readFileSync(ROUTE, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '')

const sql = readFileSync(MIGRATION, 'utf8')

describe('the manifest electron-updater parses', () => {
  it('emits every field the client requires', () => {
    // Missing any of these makes the updater throw rather than report "no
    // update", so the app shows a failure for a channel that is working.
    for (const key of ['version:', 'files:', 'url:', 'sha512:', 'size:', 'path:', 'releaseDate:']) {
      expect(source, `manifest is missing ${key}`).toContain(key)
    }
  })

  it('⚠️ serves it as YAML, not as JSON', () => {
    // The generic provider parses the body as YAML. Sent as
    // `application/json` some clients still parse it, which makes the mistake
    // survive testing and fail in the field.
    expect(source).toMatch(/Content-Type', 'text\/yaml/)
  })

  it('quotes the values that can contain a colon', () => {
    // A file name or a release note with `: ` in it breaks the document.
    expect(source).toMatch(/const quoted = \(value: string\) => JSON\.stringify\(value\)/)
  })

  it('release notes are omitted when absent, not emitted empty', () => {
    expect(source).toMatch(/release\.release_notes \? \[`releaseNotes:/)
  })
})

describe('choosing the newest release', () => {
  it('⚠️ orders by released_at, NEVER by version', () => {
    // A text sort puts '0.9.0' after '0.10.0', so ordering by version would
    // serve an older build as the newest and every client would refuse to
    // move — with no error anywhere.
    expect(source).toMatch(/\.order\('released_at', \{ ascending: false \}\)/)
    expect(source).not.toMatch(/\.order\('version'/)
  })

  it('only ever serves a published release', () => {
    // A half-finished upload must not reach every desktop in the field.
    expect(source).toMatch(/\.eq\('is_published', true\)/)
  })

  it('⚠️ a missing table is «no releases», not a 500', () => {
    // The code ships before the migration runs. An updater that reports «no
    // update» is correct both before and after.
    expect(source).toMatch(/42P01/)
    expect(source).toMatch(/PGRST205/)
  })

  it('⚠️ no releases yields 404, not an empty manifest', () => {
    // electron-updater reads 404 as «no feed yet» and stays quiet; an empty
    // version makes it throw.
    expect(source).toMatch(/if \(!release\) return reply\.code\(404\)\.send\(\)/)
  })
})

describe('the download route', () => {
  it('⚠️ refuses a file name the manifest did not promise', () => {
    // Without this it would redirect ANY name to the current binary, so a
    // client could receive a different file than it asked for — failing the
    // sha512 check and sending whoever debugs it to the file host instead of
    // to this route.
    expect(source).toMatch(/if \(fileName !== release\.file_name\) return reply\.code\(404\)/)
  })

  it('redirects rather than proxies', () => {
    // ~80 MB through this process would hold a worker for the length of every
    // download on every connection.
    expect(source).toMatch(/reply\.redirect\(release\.download_url, 302\)/)
  })

  it('rejects an unknown platform before touching the database', () => {
    expect(source).toMatch(/PLATFORMS\.has\(platform\)/)
  })
})

describe('it is deliberately unauthenticated', () => {
  it('has no authenticate or workspace preHandler', () => {
    // The updater runs before anyone signs in and on machines whose session
    // has expired. Requiring a token would mean an app that can only update
    // while somebody happens to be logged in.
    expect(source).not.toMatch(/authenticate/)
    expect(source).not.toMatch(/requireWorkspaceContext/)
  })

  it('⚠️ reads no workspace_id anywhere', () => {
    // Every other table here is tenant data and `workspace_id` is the only
    // security boundary. A release is not tenant data — the same file for
    // every customer — and a workspace column would imply per-customer builds
    // that do not exist.
    expect(source).not.toMatch(/workspace_id/)
  })
})

describe('the migration', () => {
  it('creates the table the route reads', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.app_releases/)
  })

  it('is additive and re-runnable', () => {
    expect(sql).toMatch(/IF NOT EXISTS/)
    expect(sql).not.toMatch(/DROP TABLE public\.app_releases/)
  })

  it('⚠️ requires the sha512 — a row without it can never work', () => {
    expect(sql).toMatch(/sha512\s+text\s+NOT NULL/)
  })

  it('⚠️ defaults is_published to FALSE', () => {
    // So an uploaded-but-unverified release is never offered.
    expect(sql).toMatch(/is_published\s+boolean\s+NOT NULL DEFAULT false/)
  })

  it('enforces one row per version per platform', () => {
    expect(sql).toMatch(/UNIQUE \(platform, version\)/)
  })

  it('⚠️ RLS allows reading a published release and writing nothing', () => {
    // Enabling RLS with no policy at all would deny the public read the
    // updater needs; adding a write policy would let a client publish.
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/FOR SELECT\s*\n\s*USING \(is_published\)/)
    expect(sql).not.toMatch(/FOR (INSERT|UPDATE|DELETE)/)
  })

  it('carries a rollback block and a verification query', () => {
    expect(sql).toMatch(/ROLLBACK \/ MITIGATION/)
    expect(sql).toMatch(/VERIFICATION/)
    expect(sql).toMatch(/write_policies/)
  })

  it('reloads the PostgREST schema cache', () => {
    expect(sql).toMatch(/NOTIFY pgrst/)
  })
})
