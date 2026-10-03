// ============================================
// Capability: content brief (Phase 3).
// Service: services/blog/brief.service.ts
// Routes:  /api/admin/blog/intelligence/briefs (POST, GET :id)
//
// ⚠️ TWO CLASSES OF GUARD LIVE HERE.
//
// 1. BEHAVIOUR of the pure parts: `extractJson` (models wrap JSON in prose
//    despite being told not to) and `briefOutputSchema` (the contract that
//    stops the model's output from being guessed at).
//
// 2. SCHEMA DRIFT — the bug class this file was written for. `saveResearchRun`
//    once inserted `workspace_id` into `blog_sources`; the migration defines no
//    such column (sources are global, deduplicated by URL). Every insert would
//    have failed, every failure was swallowed by `continue`, and the brief was
//    still marked ready — silent data loss behind a green status. No unit test
//    could see it, because the bug is an AGREEMENT between two files.
//
//    So: parse the migration for the real columns, parse the services for the
//    columns they write, and assert subset. The same check that
//    `SETUP-COMPLETE.sql` vs live-DB drift (P4, 30 Sep) was missing.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { briefOutputSchema, extractJson } from '../services/blog/brief.service'

const SRC = join(__dirname, '..')
const MIGRATION = readFileSync(
  join(SRC, '..', '..', 'docs', 'content-intelligence-01-migration.sql'),
  'utf8',
)

/**
 * Line comments BEFORE block comments — BUG-029.
 *
 * ⚠️ AND `//` MUST BE STRIPPED TOO, PROTOCOL-SAFE. The drift guard below
 * parses written column names out of the source; a `//` comment that mentions
 * `workspace_id` or sits between two keys would otherwise be read as code — and
 * the very first run of this file failed both ways because of it. `(^|[^:])`
 * keeps `https://…` intact by refusing to treat a `//` preceded by a colon as a
 * comment.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/--.*$/gm, '')
}

// ─── extractJson ─────────────────────────────────────────────────────────────

describe("brief — extractJson takes the model's object out of whatever it wrapped it in", () => {
  it('reads a bare object', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('reads an object out of a code fence and prose', () => {
    expect(extractJson('Here you go:\n```json\n{"a": 1}\n```\nHope that helps!')).toEqual({ a: 1 })
  })

  it('stops at the FIRST balanced object, braces inside strings do not fool it', () => {
    const parsed = extractJson('{"purpose": "explain {x} and }y{", "n": 2} trailing {"evil": true}')
    expect(parsed).toEqual({ purpose: 'explain {x} and }y{', n: 2 })
  })

  it('no object at all is a VALIDATION failure, never a guess', () => {
    // ⚠️ Falling back to `{}` here would let the schema's defaults build a
    // brief that says nothing — an empty plan that looks generated.
    expect(() => extractJson('I cannot help with that.')).toThrow(/BRIEF_OUTPUT_NOT_JSON/)
    expect(() => extractJson('{"unterminated": ')).toThrow(/BRIEF_OUTPUT_NOT_JSON/)
  })
})

// ─── the output contract ─────────────────────────────────────────────────────

describe('brief — the output schema is the contract, not a suggestion', () => {
  const minimal = {
    searchIntent: 'یافتن راه‌حل مدیریت بدهی',
    targetAudience: 'صاحبان کسب‌وکار کوچک',
    businessProblem: 'مشتریان دیر پرداخت می‌کنند',
    primaryKeyword: 'مدیریت بدهی مشتریان',
    originalValue: ['چک‌لیست سنبله‌ای ۳۰ روزه'],
    requiredSections: [
      { heading: 'بدهی چیست', purpose: 'تعریف' },
      { heading: 'چطور پیگیری کنیم', purpose: 'فرآیند' },
    ],
  }

  it('accepts a complete, well-formed brief', () => {
    const parsed = briefOutputSchema.parse(minimal)
    expect(parsed.articleType).toBe('guide')
    expect(parsed.qualityNotes).toEqual([])
  })

  it('qualityNotes may be empty but the plan may NOT be sectionless', () => {
    // ⚠️ A brief with fewer than two sections is not a plan, it is a topic
    // restated — and the editor sees a green status over nothing.
    expect(() => briefOutputSchema.parse({ ...minimal, requiredSections: [] })).toThrow()
    expect(() =>
      briefOutputSchema.parse({
        ...minimal,
        requiredSections: minimal.requiredSections.slice(0, 1),
      }),
    ).toThrow()
  })

  it('originalValue is REQUIRED and non-empty', () => {
    // ⚠️ The whole reason a brief exists: what this article gives that the
    // sources do not. A model that cannot answer must fail the schema, not
    // ship a brief that is a summary of everyone else.
    expect(() => briefOutputSchema.parse({ ...minimal, originalValue: [] })).toThrow()
    expect(() => briefOutputSchema.parse({ ...minimal, originalValue: undefined })).toThrow()
  })

  it('an unknown articleType is rejected, not defaulted', () => {
    expect(() => briefOutputSchema.parse({ ...minimal, articleType: 'listicle' })).toThrow()
  })

  it('THE SCHEMA ACCEPTS NO URL FIELD — zod strips what it does not name', () => {
    // ⚠️ §13 / hardening rule 4: «URL هرگز از مدل ساخته نمی‌شود.» The model
    // WILL offer citations if it can; the contract must make them impossible to
    // persist. Parse output with a smuggled url and assert it is gone.
    const parsed = briefOutputSchema.parse({
      ...minimal,
      url: 'https://invented.example/guide',
      sources: [{ url: 'https://invented.example/2' }],
    })
    expect(parsed).not.toHaveProperty('url')
    expect(parsed).not.toHaveProperty('sources')
    expect(JSON.stringify(parsed)).not.toContain('invented.example')
  })
})

// ─── schema drift: the code writes only columns the migration defines ───────

/** The columns a CREATE TABLE in the migration actually defines. */
function migrationColumns(table: string): Set<string> {
  const body = new RegExp(
    `CREATE TABLE IF NOT EXISTS public\\.${table} \\(([\\s\\S]*?)\\n\\);`,
  ).exec(stripComments(MIGRATION))?.[1]
  expect(body, `migration must define ${table}`).toBeTruthy()
  const columns = new Set<string>()
  for (const line of body!.split('\n')) {
    const m = /^\s*(\w+)\s+(uuid|text|jsonb|numeric|integer|boolean|timestamptz)/.exec(line)
    if (m) columns.add(m[1]!)
  }
  return columns
}

/**
 * The top-level keys written by `.insert({...})` / `.upsert({...})` /
 * `.update({...})` calls that follow `.from('<table>')` in a service file.
 */
function writtenColumns(file: string, table: string): string[] {
  const code = stripComments(readFileSync(join(SRC, file), 'utf8'))
  const keys: string[] = []
  const fromRe = new RegExp(`\\.from\\('${table}'\\)`, 'g')
  let from: RegExpExecArray | null
  while ((from = fromRe.exec(code))) {
    const tail = code.slice(from.index)
    const write = /\.(insert|upsert|update)\(\s*\{/.exec(tail)
    if (!write || write.index > 400) continue // the chain moved on to something else
    const open = tail.indexOf('{', write.index)
    let depth = 0
    let end = -1
    for (let i = open; i < tail.length; i++) {
      if (tail[i] === '{') depth++
      else if (tail[i] === '}') {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    if (end === -1) continue
    const payload = tail.slice(open + 1, end)
    // Top-level `key:` only — nested objects are jsonb values, not columns.
    let d = 0
    let key = ''
    let atKey = true
    for (const ch of payload) {
      if (ch === '{' || ch === '[' || ch === '(') d++
      else if (ch === '}' || ch === ']' || ch === ')') d--
      if (d === 0 && atKey) {
        if (/[\w]/.test(ch)) key += ch
        else if (ch === ':' && key) {
          keys.push(key)
          key = ''
          atKey = false
        } else if (ch === ',') {
          key = ''
        } else if (ch !== ' ' && ch !== '\n' && ch !== '\r' && ch !== '\t' && key === '') {
          // a value at depth 0 that ended — next token may be a key
        }
        if (ch === ',') atKey = true
      } else if (d === 0 && !atKey) {
        if (ch === ',') atKey = true
      }
    }
  }
  return keys
}

describe('brief — the services write only columns the migration defines', () => {
  const tables = [
    'blog_content_briefs',
    'blog_research_runs',
    'blog_sources',
    'blog_article_sources',
  ]
  const services = [
    'services/blog/research.service.ts',
    'services/blog/brief.service.ts',
    'plugins/job-scheduler.plugin.ts',
  ]

  for (const table of tables) {
    const defined = migrationColumns(table)

    for (const service of services) {
      it(`${service.split('/').pop()} × ${table}`, () => {
        const written = writtenColumns(service, table)
        // The parser must have found something, or the guard is vacuous.
        // (blog_article_sources is not written yet — skip when unused.)
        if (written.length === 0) return
        const unknown = written.filter((k) => !defined.has(k))
        expect(
          unknown,
          `${service} writes columns ${unknown.join(', ')} that ${table} does not define — ` +
            `every such insert fails at runtime, and research.service once swallowed that failure`,
        ).toEqual([])
      })
    }
  }

  it('no content-intelligence table has workspace_id, so no service writes one', () => {
    // ⚠️ THE SPECIFIC BUG THIS GUARD EXISTS FOR. The blog is a platform asset:
    // these four tables are scoped by nothing, or by created_by. A service that
    // "helpfully" tenancy-scopes them writes a column that does not exist.
    for (const table of tables) {
      expect(migrationColumns(table).has('workspace_id'), table).toBe(false)
    }
    for (const service of ['services/blog/research.service.ts', 'services/blog/brief.service.ts']) {
      const code = stripComments(readFileSync(join(SRC, service), 'utf8'))
      expect(code, service).not.toContain('workspace_id')
    }
  })

  it('the drift parser is not vacuous — it sees the columns research.service really writes', () => {
    // ⚠️ A parser that silently returns [] on every file makes the whole suite
    // above pass for the wrong reason. One positive control, named explicitly.
    const written = writtenColumns('services/blog/research.service.ts', 'blog_research_runs')
    expect(written).toContain('run_key')
    expect(written).toContain('brief_id')
    expect(written).toContain('result_meta')
  })
})

// ─── the route is the caller the pipeline was missing ────────────────────────

describe('brief — the intelligence routes exist, admin-only and rate-limited', () => {
  const routes = readFileSync(join(SRC, 'routes', 'blog.routes.ts'), 'utf8')

  it('POST creates a brief under the platform-admin guard', () => {
    expect(routes).toContain("'/api/admin/blog/intelligence/briefs'")
    // ⚠️ Every POST costs a Tavily run and a provider call. Unbounded, a
    // runaway script bills both; the rate limit is part of the contract.
    expect(routes).toMatch(/intelligence\/briefs[\s\S]{0,400}rateLimit/)
  })

  it('GET reads one brief back', () => {
    expect(routes).toContain("'/api/admin/blog/intelligence/briefs/:id'")
  })
})

describe('brief — the job generates the brief BEFORE it may say brief_ready', () => {
  const plugin = stripComments(
    readFileSync(join(SRC, 'plugins', 'job-scheduler.plugin.ts'), 'utf8'),
  )

  it('generateBrief runs on the persisted ids, inside the ready branch', () => {
    // ⚠️ A status that says "the brief is ready" over empty intent/sections
    // columns is the same lie as brief_ready over zero sources, one level up.
    expect(plugin).toMatch(/if \(ready\) await generateBrief\(briefId, saved\.sourceIds\)/)
  })
})
