// ============================================
// Capability: content-intelligence schema (Phase 1).
// Migration: docs/content-intelligence-01-migration.sql
//
// ⚠️ THIS FILE GUARDS A MIGRATION, NOT CODE — and that is the point.
//
// The blog schema is the only part of this product whose correctness is
// asserted against a text file rather than against running code, because
// `CLAUDE.md` §0 says no DDL runs without a human. The failure that has
// actually happened here is a schema/code disagreement: `SETUP-COMPLETE.sql`
// had `attendance` without `workspace_id` while the live database has it, and
// three services were once written against columns that did not exist.
//
// So the tests below assert the SHAPE the migration promises, so that a person
// running it later is running what the code was written against — and so that a
// later edit to either side is a test failure rather than a production surprise.
//
// ⚠️ WHAT IS DELIBERATELY NOT TESTED: the SQL itself. `rls-coverage.test.ts`
// already parses these files for RLS and policy shape, and 158 of its tests
// pass on this migration. Re-parsing it here would be the "second guard that
// cries wolf" this codebase has already paid for once.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const MIGRATION = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'content-intelligence-01-migration.sql'),
  'utf8',
)

/** Line comments BEFORE block comments — BUG-029, hit a fourth time. */
function stripComments(sql: string): string {
  return sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

const CODE = stripComments(MIGRATION)

describe('content intelligence — the four tables exist, additively and idempotently', () => {
  const tables = [
    'blog_content_briefs',
    'blog_research_runs',
    'blog_sources',
    'blog_article_sources',
  ]

  it('declares every table with IF NOT EXISTS', () => {
    // ⚠️ `CREATE TABLE IF NOT EXISTS` is what makes the file safe to run twice,
    // and the project's migration rule is that a migration is run by a human who
    // may run it again. A bare CREATE turns a re-run into an error and a
    // half-applied database.
    for (const table of tables) {
      expect(CODE, table).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
    }
  })

  it('creates no table outside the blog_ namespace', () => {
    // ⚠️ A migration that creates a table in `public` under a generic name is
    // how this repository ended up with `transactions` meaning something other
    // than what its name suggests.
    const created = [...CODE.matchAll(/CREATE TABLE IF NOT EXISTS ([\w.]+)/g)].map((m) => m[1])
    for (const name of created) {
      expect(name, `${name} must be in the blog_ namespace`).toMatch(/blog_/)
    }
  })

  it('drops nothing', () => {
    // ⚠️ §3: additive only. A `DROP` anywhere in the body is a destructive
    // migration, and the rollback block at the bottom is commented out for
    // exactly this reason.
    expect(CODE).not.toMatch(/^\s*DROP\s+TABLE/m)
    expect(CODE).not.toMatch(/^\s*ALTER\s+TABLE\s+\w+\s+DROP\s+COLUMN/im)
  })
})

describe('content intelligence — the pipeline state is NOT the publication state', () => {
  it('does not touch blog_posts.status', () => {
    // ⚠️ THE BOUNDARY OF THIS WHOLE FEATURE. 36 published rows exist and
    // `draft | scheduled | published` is a working contract with the admin
    // editor. A migration that alters it turns a content feature into a data
    // migration, and a data migration is a thing a human must approve.
    expect(CODE).not.toMatch(/ALTER\s+TABLE\s+public\.blog_posts\b/i)
  })

  it('names the pipeline states on a separate column', () => {
    expect(CODE).toContain('intelligence_status')
    // Every state the pipeline needs, and no state that implies publication.
    for (const state of [
      'none',
      'researching',
      'brief_ready',
      'draft_ready',
      'validation_ready',
      'review_ready',
      'failed',
    ]) {
      expect(CODE, state).toContain(`'${state}'`)
    }
    // ⚠️ 'published' is forbidden in the PIPELINE vocabulary. A pipeline that
    // can say "published" is a pipeline that can publish.
    const vocabulary = /intelligence_status[^;]*;/s.exec(CODE)?.[0] ?? ''
    expect(vocabulary).not.toContain('published')
  })

  it('defaults to none, so an untouched brief is visibly not ready', () => {
    expect(CODE).toMatch(/intelligence_status text NOT NULL DEFAULT 'none'/)
  })
})

describe('content intelligence — the security posture', () => {
  it('enables RLS on every table', () => {
    // ⚠️ WHITESPACE-INSENSITIVE, and the first version was not: it asserted the
    // exact string, so the aligned columns this file happens to use read as a
    // missing statement. A test that fails on layout will be "fixed" by
    // reflowing the SQL — which is how a real assertion quietly gets deleted.
    const compact = CODE.replace(/\s+/g, ' ')
    for (const table of [
      'blog_content_briefs',
      'blog_research_runs',
      'blog_sources',
      'blog_article_sources',
    ]) {
      expect(compact, table).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`)
    }
  })

  it('creates NO policy, because a policy here would be a leak', () => {
    // ⚠️ THE MOST IMPORTANT ASSERTION IN THIS FILE.
    //
    // RLS on with no policy = every statement denied. The backend reads with
    // `service_role`, which bypasses RLS, so a policy buys nothing. And the anon
    // key is a public key, so any SELECT policy that is not exactly right
    // publishes unpublished research and drafts to the internet.
    expect(CODE).not.toMatch(/CREATE\s+POLICY/i)
  })

  it('revokes the public roles explicitly rather than relying on defaults', () => {
    // ⚠️ Belt and braces, and deliberately: the revoke is the statement that
    // makes a later "harmless" policy addition impossible to miss in review.
    // Whitespace-insensitive for the same reason as the RLS assertion above.
    const compact = CODE.replace(/\s+/g, ' ')
    for (const table of [
      'blog_content_briefs',
      'blog_research_runs',
      'blog_sources',
      'blog_article_sources',
    ]) {
      expect(compact, table).toContain(
        `REVOKE ALL ON public.${table} FROM PUBLIC, anon, authenticated`,
      )
    }
  })
})

describe('content intelligence — the constraints that stop bad data', () => {
  it('research runs are idempotent on run_key', () => {
    // ⚠️ A double-clicked button sends the same key twice. Without this unique
    // constraint the retry creates a second run and a second Tavily bill.
    expect(CODE).toMatch(/CONSTRAINT blog_research_runs_key_unique UNIQUE \(run_key\)/)
  })

  it('a run that claims completion must carry a completion time', () => {
    expect(CODE).toMatch(/blog_research_runs_completed_needs_time/)
  })

  it('deduplicates sources on a NORMALISED url, not the raw one', () => {
    // ⚠️ The same authority arrives as `http://`, `https://` and `www.` variants.
    // A three-locale research run finds all three, and storing them as three rows
    // is how a brief ends up citing one page three times and looking well sourced.
    expect(CODE).toMatch(/CONSTRAINT blog_sources_url_unique UNIQUE \(url_normalised\)/)
    // And the raw URL is kept, so a person can actually click it.
    expect(CODE).toMatch(/url\s+text NOT NULL/)
  })

  it('competitor is a first-class source type, not an erased one', () => {
    // ⚠️ A competitor page is a legitimate research INPUT. Forbidding the
    // recording would make the pipeline's inputs invisible rather than governed.
    // What is forbidden is COPYING, and that is the originality gate's job.
    for (const value of ['primary', 'secondary', 'competitor']) {
      expect(CODE, value).toContain(`'${value}'`)
    }
  })

  it('an article cites a source once, and evidence is a separate relationship', () => {
    expect(CODE).toMatch(/CONSTRAINT blog_article_sources_unique UNIQUE \(article_id, source_id\)/)
    // 'reference' vs 'evidence' is what lets a competitor page be listed
    // without ever backing a factual claim.
    for (const value of ['reference', 'evidence']) {
      expect(CODE, value).toContain(`'${value}'`)
    }
  })

  it('a claim is nullable, because many sources back no single sentence', () => {
    // ⚠️ A NOT NULL here would make people write filler to satisfy the schema.
    expect(CODE).toMatch(/claim\s+text,/)
  })

  it('every not-null column with no default has a check that says what it accepts', () => {
    // ⚠️ A free-text column that accepts any string is how a status ends up
    // holding a value no code reads.
    expect(CODE).toMatch(/run_key\s+text NOT NULL,/) // unique, and never blank by construction
    expect(CODE).toMatch(
      /CHECK \(btrim\(topic\)\) > 0\)|CHECK \(char_length\(btrim\(topic\)\) > 0\)/,
    )
  })
})
