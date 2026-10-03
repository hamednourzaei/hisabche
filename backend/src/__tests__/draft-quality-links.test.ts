// ============================================
// Capabilities: draft (Phase 4), quality gate (Phase 5), internal links (Phase 6).
// Files: services/blog/draft-render.ts, draft.service.ts,
//        quality-gate.service.ts, internal-links.service.ts,
//        plugins/job-scheduler.plugin.ts, routes/blog.routes.ts,
//        docs/content-intelligence-02..04-migration.sql
//
// ⚠️ WHAT IS TESTED BEHAVIOURALLY AND WHAT IS TESTED STRUCTURALLY.
//
// `renderDraft` and `evaluateDraft` are pure: they get real inputs and real
// assertions. Everything behind a database or a provider is asserted against
// the SOURCE, because the failure it guards is structural — a sync route that
// will be cut off by a proxy, an upsert that erases a decision, a status word
// that lets a pipeline claim it published.
// ============================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { renderDraft, type DraftBlock } from '../services/blog/draft-render'
import { evaluateDraft } from '../services/blog/quality-gate.service'
import { draftOutputSchema } from '../services/blog/draft.service'

const SRC = join(__dirname, '..')

function code(rel: string): string {
  const raw = readFileSync(join(SRC, rel), 'utf8')
  // Block comments first, then protocol-safe line comments (CI-007).
  return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

// ─── Phase 4: one structure, two representations ─────────────────────────────

describe('draft render — json and html come from ONE structure', () => {
  const blocks: DraftBlock[] = [
    { kind: 'heading', level: 2, text: 'بدهی چیست' },
    { kind: 'paragraph', text: 'بدهی مشتری پولی است که هنوز نگرفته‌اید.' },
    { kind: 'bulletList', items: ['سن رسید', 'سقف اعتبار'] },
    { kind: 'orderedList', items: ['یادآوری', 'تماس'] },
    { kind: 'blockquote', text: 'قاعده: هیچ فروش بدون مهلت.' },
    { kind: 'heading', level: 3, text: 'How to follow up' },
  ]

  it('the json is a Tiptap doc with only StarterKit nodes', () => {
    const { json } = renderDraft(blocks)
    expect(json.type).toBe('doc')
    const types = new Set<string>()
    const walk = (nodes: unknown[]) => {
      for (const n of nodes as Array<Record<string, unknown>>) {
        types.add(n.type as string)
        if (Array.isArray(n.content)) walk(n.content)
      }
    }
    walk(json.content as unknown[])
    for (const t of types) {
      expect(
        [
          'doc',
          'heading',
          'paragraph',
          'bulletList',
          'orderedList',
          'listItem',
          'blockquote',
          'text',
        ],
        `node type ${t} has no editor extension and would be dropped on load`,
      ).toContain(t)
    }
  })

  it('the html carries the same text as the json, in the same order', () => {
    const { json, html } = renderDraft(blocks)
    const jsonText: string[] = []
    const walk = (nodes: unknown[]) => {
      for (const n of nodes as Array<Record<string, unknown>>) {
        if (typeof n.text === 'string') jsonText.push(n.text)
        if (Array.isArray(n.content)) walk(n.content)
      }
    }
    walk(json.content as unknown[])
    const htmlText = html
      .replace(/<[^>]+>/g, '|')
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean)
    expect(htmlText).toEqual(jsonText)
  })

  it('EVERYTHING the model said is escaped — markup in text stays text', () => {
    const hostile: DraftBlock[] = [
      { kind: 'paragraph', text: '<script>alert(1)</script> and <img src=x onerror=y>' },
      { kind: 'heading', level: 2, text: 'a "quoted" <b>bold?</b>' },
    ]
    const { html, json } = renderDraft(hostile)
    // ⚠️ THE INVARIANT IS "NO LIVE TAG", NOT "THE WORD onerror IS ABSENT":
    // the escaped text `&lt;img … onerror=y&gt;` still CONTAINS the substring,
    // inertly. What must be impossible is an element the model supplied — so
    // every hostile tag must appear escaped, never as a `<`.
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<b>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;img')
    // The JSON side stores PLAIN TEXT: the tags are data there, never nodes.
    expect(JSON.stringify(json)).toContain('<script>')
    expect(JSON.stringify(json)).not.toContain('"type":"script"')
  })

  it('headings get the same id the stored TOC rule would give', () => {
    const { html } = renderDraft([{ kind: 'heading', level: 2, text: 'بدهی چیست' }])
    expect(html).toMatch(/<h2 id="[^"]+">/)
    expect(html).not.toContain('id=""')
  })

  it('empty blocks are dropped, not rendered as empty tags', () => {
    const { html, json } = renderDraft([
      { kind: 'paragraph', text: '   ' },
      { kind: 'bulletList', items: ['', '  '] },
    ])
    expect(html).toBe('')
    expect(json.content as unknown[]).toEqual([])
  })
})

describe('draft output schema — the model returns structure, never markup', () => {
  const minimal = {
    title: 'مدیریت بدهی مشتریان',
    excerpt: 'چطور پولتان را زنده نگه دارید',
    blocks: [
      { kind: 'heading', level: 2, text: 'بدهی چیست' },
      { kind: 'paragraph', text: 'تعریف عملی بدهی مشتری.' },
      { kind: 'paragraph', text: 'چرا اهمیت دارد.' },
      { kind: 'paragraph', text: 'قدم اول.' },
    ],
    metaTitle: 'مدیریت بدهی مشتریان | راهنمای عملی',
    metaDescription:
      'چطور بدهی مشتریان را پیگیری و وصول کنید — راهنمای عملی برای کسب‌وکارهای کوچک.',
  }

  it('accepts a structured draft', () => {
    const parsed = draftOutputSchema.parse(minimal)
    expect(parsed.blocks).toHaveLength(4)
    expect(parsed.qualityNotes).toEqual([])
  })

  it('a heading level outside 2..4 is rejected', () => {
    expect(() =>
      draftOutputSchema.parse({
        ...minimal,
        blocks: [...minimal.blocks, { kind: 'heading', level: 1, text: 'H1' }],
      }),
    ).toThrow()
  })

  it('fewer than four blocks is not an article', () => {
    expect(() =>
      draftOutputSchema.parse({ ...minimal, blocks: minimal.blocks.slice(0, 3) }),
    ).toThrow()
  })

  it('an html or markdown key is DROPPED, never stored', () => {
    const parsed = draftOutputSchema.parse({
      ...minimal,
      html: '<p>smuggled</p>',
      blocks: [...minimal.blocks, { kind: 'paragraph', text: 'x', html: '<b>no</b>' }],
    })
    expect(parsed).not.toHaveProperty('html')
    expect(JSON.stringify(parsed)).not.toContain('smuggled')
  })
})

// ─── Phase 5: the gate is code, not a model ──────────────────────────────────

function goodDraft(overrides: Partial<Parameters<typeof evaluateDraft>[0]> = {}) {
  return evaluateDraft({
    locale: 'fa',
    title: 'مدیریت بدهی مشتریان در کسب‌وکار کوچک',
    html:
      `<h2>بدهی چیست</h2><p>${'بدهی مشتری پولی است که هنوز نگرفته‌اید و باید پیگیری شود. '.repeat(20)}</p>` +
      `<h2>چطور پیگیری کنیم</h2><p>${'یادآوری، تماس، و مهلت سه قدم اصلی پیگیری بدهی هستند. '.repeat(20)}</p>`,
    metaTitle: 'مدیریت بدهی مشتریان | راهنمای عملی',
    metaDescription:
      'چطور بدهی مشتریان را پیگیری و وصول کنید — راهنمای عملی برای کسب‌وکارهای کوچک فارسی‌زبان.',
    requiredSections: [{ heading: 'بدهی چیست' }, { heading: 'چطور پیگیری کنیم' }],
    competitorSourceTitles: ['Odoo invoicing guide for small teams'],
    ...overrides,
  })
}

describe('quality gate — every check is a deterministic read of what is stored', () => {
  it('a complete Persian draft passes all eight checks', () => {
    const verdict = goodDraft()
    expect(verdict.passed).toBe(true)
    expect(verdict.checks).toHaveLength(8)
    expect(verdict.checks.every((c) => c.passed)).toBe(true)
  })

  it('an English body in a fa draft fails the language check, and says so', () => {
    const verdict = goodDraft({
      html:
        '<h2>What is debt</h2><p>' +
        'Customer debt is money you have not collected yet. '.repeat(20) +
        '</p>' +
        '<h2>How to follow up</h2><p>' +
        'Reminder, call and a deadline are the three steps. '.repeat(20) +
        '</p>',
    })
    expect(verdict.passed).toBe(false)
    const lang = verdict.checks.find((c) => c.id === 'language')!
    expect(lang.passed).toBe(false)
    expect(lang.reason).toContain('fa')
  })

  it('a claimed feature the product does not have is a WARNING, never a refusal', () => {
    // `claimsNotInProduct` is the SAME checker the human publish path runs, and
    // there it is explicitly a warning: the list cannot tell «an article ABOUT
    // two-factor login» from «claims Hisabche HAS it». Blocking here would
    // refuse a legitimate accounting topic AND invent a second, harsher claims
    // rule (G2). So the check must FAIL, be NON-BLOCKING, name the claim, and
    // leave the overall verdict passing for the human reviewer.
    const v = goodDraft({ title: 'حسابچه ورود دو مرحله‌ای دارد — راهنمای کامل مدیریت بدهی' })
    const claims = v.checks.find((c) => c.id === 'claims')!
    expect(claims.passed).toBe(false)
    expect(claims.blocking).toBe(false)
    expect(claims.reason).toContain('reviewer')
    // The verdict still passes: a warning is surfaced, not enforced.
    expect(v.passed).toBe(true)
  })

  it('a BLOCKING failure still fails the verdict even when only a warning would pass', () => {
    // ⚠️ The distinction has to cut both ways, or `blocking` is decoration:
    // a blocking check failing must sink the verdict regardless of warnings.
    const v = goodDraft({ metaDescription: 'کوتاه' }) // meta is blocking, too short
    expect(v.checks.find((c) => c.id === 'meta')!.blocking).toBe(true)
    expect(v.passed).toBe(false)
  })

  it('a competitor title reproduced verbatim fails the copy check', () => {
    const verdict = goodDraft({
      competitorSourceTitles: ['Odoo invoicing guide for small teams'],
      html:
        '<h2>بدهی چیست</h2><p>Odoo invoicing guide for small teams — ' +
        'بدهی مشتری پولی است که هنوز نگرفته‌اید. '.repeat(20) +
        '</p><h2>چطور پیگیری کنیم</h2><p>' +
        'یادآوری و تماس و مهلت سه قدم اصلی هستند. '.repeat(20) +
        '</p>',
    })
    const copy = verdict.checks.find((c) => c.id === 'competitor-copy')!
    expect(copy.passed).toBe(false)
    expect(copy.reason).toContain('Odoo invoicing guide')
  })

  it('a required section that is missing fails brief-sections and NAMES it', () => {
    const verdict = goodDraft({ requiredSections: [{ heading: 'بخشی که وجود ندارد' }] })
    const sections = verdict.checks.find((c) => c.id === 'brief-sections')!
    expect(sections.passed).toBe(false)
    expect(sections.reason).toContain('بخشی که وجود ندارد')
  })

  it('a thin draft fails length, a padded one fails it the other way', () => {
    expect(
      goodDraft({ html: '<h2>الف</h2><p>کوتاه</p><h2>ب</h2><p>باز هم کوتاه</p>' }).checks.find(
        (c) => c.id === 'length',
      )!.passed,
    ).toBe(false)
    const padded = '<h2>الف</h2><p>' + 'پر '.repeat(7000) + '</p><h2>ب</h2><p>پایان</p>'
    const v = goodDraft({ html: padded })
    expect(v.checks.find((c) => c.id === 'length')!.passed).toBe(false)
  })

  it('a failed gate still produced checks with reasons — the editor sees WHY', () => {
    const verdict = goodDraft({ metaDescription: 'کوتاه' })
    expect(verdict.passed).toBe(false)
    for (const check of verdict.checks) {
      expect(check.reason.length).toBeGreaterThan(5)
    }
  })
})

describe('quality gate — the source keeps its promises', () => {
  const gate = code('services/blog/quality-gate.service.ts')
  const draftSvc = code('services/blog/draft.service.ts')
  const links = code('services/blog/internal-links.service.ts')
  const plugin = code('plugins/job-scheduler.plugin.ts')
  const routes = code('routes/blog.routes.ts')

  it('the gate never calls the provider — it is code, not a judge', () => {
    expect(gate).not.toContain('callProvider')
    expect(gate).not.toContain('getConfig')
  })

  it('a passed gate advances the brief; a failed one does not', () => {
    expect(gate).toMatch(/if \(verdict\.passed\) \{[\s\S]*?validation_ready/)
  })

  it('the gate writes a report row on BOTH verdicts', () => {
    // The insert is before the status branch — a failed gate that stored nothing
    // would be an invisible failure, the one this table exists against.
    const insertAt = gate.indexOf(".from('blog_quality_reports')")
    const branchAt = gate.indexOf('if (verdict.passed)')
    expect(insertAt).toBeGreaterThan(-1)
    expect(insertAt).toBeLessThan(branchAt)
  })

  it('NO content-intelligence service ever WRITES blog_posts or SETS a published status', () => {
    // ⚠️ READING published posts is correct and required: internal-links picks
    // link targets from published posts, and draft lists them. The invariant is
    // narrower than "never mention published" — it is "never WRITE blog_posts,
    // and never assign a published status". A blanket string ban would forbid
    // the legitimate `.eq('status','published')` reads that make links work.
    for (const [name, src] of [
      ['draft.service', draftSvc],
      ['quality-gate', gate],
      ['internal-links', links],
      [
        'plugin handler',
        plugin.slice(plugin.indexOf('runContentDraft'), plugin.indexOf('const JOB_HANDLERS')),
      ],
    ] as const) {
      // The one hard rule: no mutation of blog_posts. Reads (`.select`, `.eq`)
      // are allowed and expected.
      expect(src, `${name} must not write blog_posts`).not.toMatch(
        /from\('blog_posts'\)[\s\S]{0,120}?\.(insert|upsert|update|delete)\(/,
      )
      // No service publishes: neither a publish() call nor a status set to
      // 'published'. (`status: 'published'` in an update payload, or a
      // `.update({ ... published ... })`.)
      expect(src, `${name} must not call publish`).not.toMatch(/\bpublish\s*\(/)
      expect(src, `${name} must not set a published status`).not.toMatch(
        /status:\s*['"]published['"]/,
      )
      // And the pipeline's own status vocabulary must never contain 'published'
      // (content-intelligence-schema.test.ts asserts this on the migration too).
      expect(src, `${name} must not write intelligence_status published`).not.toMatch(
        /intelligence_status:\s*['"]published['"]/,
      )
    }
  })

  it('the draft route ENQUEUES a job — it does not generate synchronously', () => {
    // ⚠️ A sync draft call holds an HTTP request open for up to 180 s; the
    // proxy cuts it off and the client sees a failure over work that completed.
    expect(routes).toMatch(/intelligence\/briefs\/:id\/draft[\s\S]{0,700}job_type: 'CONTENT_DRAFT'/)
    expect(routes).not.toMatch(/await generateDraft\(/)
  })

  it('the draft job runs gate AFTER draft, and links only after a PASSED gate', () => {
    const handler = plugin.slice(
      plugin.indexOf('async function runContentDraft'),
      plugin.indexOf('const JOB_HANDLERS'),
    )
    expect(handler.indexOf('generateDraft(')).toBeLessThan(handler.indexOf('runQualityGate('))
    expect(handler).toMatch(/if \(verdict\.passed\) \{[\s\S]*suggestInternalLinks/)
  })

  it('a decided link suggestion is never overwritten by a re-run', () => {
    // «نتیجه‌ی ثبت‌شده toggle نیست» — an accepted/rejected row must survive a
    // new suggestion pass; the check is explicit in the source.
    expect(links).toMatch(/existing\.status !== 'suggested'/)
    expect(links).toMatch(/if \(existing && existing\.status !== 'suggested'\) continue/)
  })

  it('link targets resolve from the shown candidates; invented ids are counted, not stored', () => {
    expect(links).toMatch(/if \(!byId\.has\(s\.postId\)\) \{/)
    expect(links).toMatch(/rejected \+= 1/)
  })
})

// ─── migrations 02–04 keep the 01 posture ────────────────────────────────────

describe('content intelligence 02–04 — same security posture as 01', () => {
  const files = [
    'content-intelligence-02-migration.sql',
    'content-intelligence-03-migration.sql',
    'content-intelligence-04-migration.sql',
  ]

  for (const file of files) {
    const raw = readFileSync(join(SRC, '..', '..', 'docs', file), 'utf8')
    const sql = raw.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

    it(`${file} is additive, idempotent, blog_-namespaced`, () => {
      for (const m of sql.matchAll(/CREATE TABLE IF NOT EXISTS ([\w.]+)/g)) {
        expect(m[1]).toMatch(/blog_/)
      }
      expect(sql).not.toMatch(/^\s*DROP\s+TABLE/m)
      expect(sql).not.toMatch(/ALTER\s+TABLE\s+public\.blog_posts\b/i)
    })

    it(`${file} enables RLS with NO policy and explicit revokes`, () => {
      const compact = sql.replace(/\s+/g, ' ')
      for (const m of sql.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g)) {
        expect(compact, `RLS on ${m[1]}`).toContain(
          `ALTER TABLE public.${m[1]} ENABLE ROW LEVEL SECURITY;`,
        )
        expect(compact, `revoke on ${m[1]}`).toContain(
          `REVOKE ALL ON public.${m[1]} FROM PUBLIC, anon, authenticated`,
        )
      }
      expect(sql).not.toMatch(/CREATE\s+POLICY/i)
    })

    it(`${file} documents its rollback`, () => {
      expect(raw).toContain('ROLLBACK')
    })
  }

  it('02 makes versions immutable WITH A TRIGGER, not a comment', () => {
    const sql = readFileSync(
      join(SRC, '..', '..', 'docs', 'content-intelligence-02-migration.sql'),
      'utf8',
    )
    expect(sql).toMatch(
      /CREATE TRIGGER blog_article_versions_no_mutation\s*\n\s*BEFORE UPDATE OR DELETE/,
    )
    expect(sql).toContain('RAISE EXCEPTION')
    expect(sql).toMatch(
      /CONSTRAINT blog_article_versions_anchored CHECK \(article_id IS NOT NULL OR brief_id IS NOT NULL\)/,
    )
  })

  it('04 requires a REAL target post — no nullable, no free-text url', () => {
    const sql = readFileSync(
      join(SRC, '..', '..', 'docs', 'content-intelligence-04-migration.sql'),
      'utf8',
    )
    expect(sql).toMatch(
      /target_post_id\s+uuid NOT NULL REFERENCES public\.blog_posts \(id\) ON DELETE CASCADE/,
    )
    expect(sql).not.toMatch(/target_url|target_href/)
    expect(sql).toMatch(
      /CONSTRAINT blog_internal_links_unique UNIQUE \(version_id, target_post_id\)/,
    )
  })
})
