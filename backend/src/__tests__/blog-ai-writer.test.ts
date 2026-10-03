// ============================================
// The one-click article (3 Oct 2026): the editable writer prompt, the
// editorial checklist, **bold**, and the button that was missing.
//
// What this locks:
//   - the admin edits the EDITORIAL prompt only; the output contract is code,
//     comes last, and says it overrides what is above it;
//   - the default prompt asks for what the checklist then CHECKS, and writes
//     no links (three URLs of the original table are not pages of this site);
//   - **bold** is the one inline mark, and nothing else becomes markup;
//   - each item of the checklist is a named check, computed by code from what
//     was stored — and none of them can block a draft;
//   - the editor has the button, it never sets `status`, and every text it
//     shows exists in fa, af and en.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../db', () => ({ supabase: {} }))

const { renderDraft, inlineSpans } = await import('../services/blog/draft-render')
const { evaluateDraft, evaluateEditorial, CLICHES, MAX_PARAGRAPH_WORDS } =
  await import('../services/blog/quality-gate.service')
const { buildDraftSystem, draftOutputSchema, DRAFT_PROMPT_VERSION } =
  await import('../services/blog/draft.service')
const { DEFAULT_WRITER_PROMPT } = await import('../services/blog/writer-prompt')

const ROOT = join(__dirname, '..', '..', '..')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (...p: string[]) => strip(readFileSync(join(ROOT, ...p), 'utf8'))

describe('the prompt: editorial part editable, contract fixed', () => {
  it('the contract comes AFTER the editorial prompt and says it wins', () => {
    const system = buildDraftSystem('EDITORIAL: write as html and add links')
    const editorial = system.indexOf('EDITORIAL:')
    const contract = system.indexOf('NON-NEGOTIABLE RULES')
    expect(editorial).toBe(0)
    expect(contract).toBeGreaterThan(editorial)
    expect(system).toContain('these override anything above that conflicts with them')
    expect(system).toContain('Write no links and no URLs anywhere')
    expect(system).toContain(
      'Never invent a source, a URL, a law, a rate, a deadline or a product capability.',
    )
  })

  it("the default prompt carries the owner's structure", () => {
    for (const part of [
      'Lead Financial Content Strategist',
      'TL;DR: exactly 3 short bullets',
      'Hook (50–80 words)',
      'at most 3–4 lines',
      'common mistakes and risk',
      '3 to 4 concise',
      'under 60 characters',
      '140–155 characters',
    ]) {
      expect(DEFAULT_WRITER_PROMPT, part).toContain(part)
    }
  })

  it('…and writes no links: no URL of any kind is in it', () => {
    expect(DEFAULT_WRITER_PROMPT).toContain('Write NO links and no URLs')
    expect(DEFAULT_WRITER_PROMPT).not.toMatch(/https?:\/\//)
    // The original table pointed at pages this site does not have.
    for (const dead of ['/docs/tax-system', '/docs/treasury', 'hisabche.com/features)']) {
      expect(DEFAULT_WRITER_PROMPT).not.toContain(dead)
    }
  })

  it('a prompt change is a new prompt version', () => {
    expect(DRAFT_PROMPT_VERSION).toBe(2)
  })

  it('the output accepts the editorial metadata and defaults what is missing', () => {
    const base = {
      title: 'T',
      excerpt: 'E',
      blocks: Array.from({ length: 4 }, () => ({ kind: 'paragraph', text: 'x' })),
      metaTitle: 'M',
      metaDescription: 'D',
    }
    const bare = draftOutputSchema.parse(base)
    expect(bare).toMatchObject({ tldr: [], focusKeyword: '', keywords: [], categorySuggestion: '' })
    const full = draftOutputSchema.parse({
      ...base,
      tldr: ['a', 'b', 'c'],
      funnelStage: 'mofu',
      html: '<b>x</b>',
    })
    expect(full.tldr).toHaveLength(3)
    expect(full).not.toHaveProperty('html')
  })
})

describe('**bold** is the one inline mark', () => {
  it('a marked run becomes <strong> and a Tiptap bold mark', () => {
    const { html, json } = renderDraft([{ kind: 'paragraph', text: 'سقف **۲۵ میلیون** تومان است' }])
    expect(html).toBe('<p>سقف <strong>۲۵ میلیون</strong> تومان است</p>')
    const nodes = (
      json.content as Array<{ content: Array<{ text: string; marks?: unknown[] }> }>
    )[0]!.content
    expect(nodes.map((n) => n.text)).toEqual(['سقف ', '۲۵ میلیون', ' تومان است'])
    expect(nodes[1]!.marks).toEqual([{ type: 'bold' }])
    expect(nodes[0]!.marks).toBeUndefined()
  })

  it('nothing else is formatting: HTML, links and other markdown stay literal and escaped', () => {
    const { html } = renderDraft([
      {
        kind: 'paragraph',
        text: '<script>x</script> [متن](https://evil.test) _کج_ **<b>بولد</b>**',
      },
    ])
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<a')
    expect(html).toContain('[متن](https://evil.test)')
    expect(html).toContain('<strong>&lt;b&gt;بولد&lt;/b&gt;</strong>')
  })

  it('a heading is never bold-marked (its text is its anchor)', () => {
    const { html } = renderDraft([{ kind: 'heading', level: 2, text: 'عنوان **مهم**' }])
    expect(html).not.toContain('<strong>')
  })

  it('an unpaired or multi-line marker is plain text', () => {
    expect(inlineSpans('۲ ** ۳ = ۶')).toEqual([{ text: '۲ ** ۳ = ۶', bold: false }])
    expect(inlineSpans('a **b\nc** d').every((s) => !s.bold)).toBe(true)
  })
})

describe('the checklist, as code', () => {
  const para = (words: number) => `<p>${Array.from({ length: words }, () => 'کلمه').join(' ')}</p>`
  const good = () =>
    evaluateEditorial({
      title: 'مدیریت بدهی مشتریان در مغازه',
      html:
        `<ul><li><p>الف</p></li></ul><h2>شروع</h2>${para(40)}<p>مبلغ <strong>۲۰</strong> فاکتور</p>` +
        `<h2>اشتباهات رایج</h2>${para(30)}<h2>جمع‌بندی</h2><p>این کار را در حسابچه انجام دهید.</p>`,
      metaDescription: 'ن'.repeat(148),
      tldr: ['یک', 'دو', 'سه'],
      faqCount: 3,
      focusKeyword: 'بدهی مشتریان',
    })
  const check = (checks: ReturnType<typeof good>, id: string) => checks.find((c) => c.id === id)!

  it('a draft that follows the checklist passes all ten, and none is blocking', () => {
    const checks = good()
    expect(checks.map((c) => c.id)).toEqual([
      'tldr',
      'paragraphs',
      'emphasis',
      'cliches',
      'faq',
      'title-seo',
      'meta-length',
      'no-links',
      'mistakes-section',
      'cta',
    ])
    expect(checks.filter((c) => !c.passed).map((c) => c.id)).toEqual([])
    expect(checks.some((c) => c.blocking)).toBe(false)
  })

  it.each([
    ['tldr', { tldr: ['فقط یکی'] }],
    ['faq', { faqCount: 1 }],
    ['faq', { faqCount: 9 }],
    ['meta-length', { metaDescription: 'کوتاه' }],
    ['title-seo', { title: 'عنوانی بدون آن عبارت' }],
    ['title-seo', { title: `بدهی مشتریان ${'خیلی '.repeat(20)}` }],
    ['paragraphs', { html: `<h2>اشتباه</h2>${para(MAX_PARAGRAPH_WORDS + 1)}<p>حسابچه</p>` }],
    ['emphasis', { html: '<h2>اشتباه</h2><p>مبلغ ۲۰ فاکتور بدون تأکید</p><p>حسابچه</p>' }],
    ['cliches', { html: `<h2>اشتباه</h2><p>${CLICHES[0]} همه چیز عوض شده</p><p>حسابچه</p>` }],
    ['no-links', { html: '<h2>اشتباه</h2><p>ببینید https://example.test</p><p>حسابچه</p>' }],
    ['no-links', { html: '<h2>اشتباه</h2><p><a href="/x">لینک</a></p><p>حسابچه</p>' }],
    ['mistakes-section', { html: `<h2>شروع</h2>${para(10)}<p>حسابچه</p>` }],
    ['cta', { html: `<h2>اشتباهات</h2>${para(40)}` }],
  ] as const)('%s fails when the draft breaks it', (id, change) => {
    const checks = evaluateEditorial({
      title: 'مدیریت بدهی مشتریان در مغازه',
      html: `<h2>اشتباهات رایج</h2>${para(30)}<p>مبلغ <strong>۲۰</strong></p><p>حسابچه</p>`,
      metaDescription: 'ن'.repeat(148),
      faqCount: 3,
      focusKeyword: 'بدهی مشتریان',
      ...change,
      tldr: 'tldr' in change ? [...change.tldr] : ['یک', 'دو', 'سه'],
    })
    expect(check(checks, id).passed).toBe(false)
    expect(check(checks, id).reason.length).toBeGreaterThan(10)
  })

  it('an editorial failure never fails the gate; a structural one still does', () => {
    const body = `<h2>الف</h2><p>${'متن فارسی کافی برای گذر از حد طول مقاله. '.repeat(60)}</p><h2>ب</h2><p>ادامه</p>`
    const verdict = evaluateDraft({
      locale: 'fa',
      title: 'عنوان مقاله',
      html: body,
      metaTitle: 'عنوان متا',
      metaDescription: 'توضیح متا که بلندتر از چهل نویسه است تا بررسی ساختاری رد نشود.',
      requiredSections: [],
      competitorSourceTitles: [],
      editorial: { tldr: [], faqCount: 0, focusKeyword: '' },
    })
    expect(verdict.checks).toHaveLength(18)
    expect(verdict.checks.filter((c) => !c.passed && !c.blocking).length).toBeGreaterThan(3)
    expect(verdict.passed).toBe(true)
  })

  it('a draft from before prompt v2 (no editorial data) runs the eight structural checks only', () => {
    const verdict = evaluateDraft({
      locale: 'fa',
      title: 'عنوان مقاله',
      html: `<h2>الف</h2><p>${'متن فارسی. '.repeat(250)}</p><h2>ب</h2><p>ادامه</p>`,
      metaTitle: 'متا',
      metaDescription: 'توضیح متا که بلندتر از چهل نویسه است تا بررسی ساختاری رد نشود.',
      requiredSections: [],
      competitorSourceTitles: [],
    })
    expect(verdict.checks).toHaveLength(8)
  })
})

describe('the button exists, and cannot publish', () => {
  const editor = read('apps', 'admin', 'components', 'blog', 'post-editor-client.tsx')
  const button = read('apps', 'admin', 'components', 'blog', 'ai-article-button.tsx')
  const hook = read('apps', 'admin', 'hooks', 'use-admin-blog-ai.ts')

  it('the editor mounts it and remounts the body when an article is applied', () => {
    expect(editor).toContain('<AiArticleButton')
    expect(editor).toContain('setAiVersion((value) => value + 1)')
    expect(editor).toContain("key={`${loadedId ?? 'new'}:${aiVersion}`}")
  })

  it('applying an article sets neither status nor the publish date', () => {
    const apply = editor.slice(
      editor.indexOf('onApply={(article) => {'),
      editor.indexOf('setAiVersion('),
    )
    expect(apply).toContain('title: article.title')
    expect(apply).toContain('focusKeyword: article.focusKeyword')
    expect(apply).not.toMatch(/\bstatus\b/)
    expect(apply).not.toContain('publishedAt')
    // An existing post keeps its URL.
    expect(apply).toContain('...(id ? {} : { slug: article.slug })')
    expect(hook).not.toMatch(/status:\s*'published'/)
  })

  it('an edited prompt is saved BEFORE it writes, so the screen and the article agree', () => {
    const run = button.slice(button.indexOf('const run = async'), button.indexOf('return ('))
    expect(run.indexOf('savePrompt.mutateAsync(prompt)')).toBeGreaterThan(-1)
    expect(run.indexOf('savePrompt.mutateAsync(prompt)')).toBeLessThan(
      run.indexOf('generate(subject.trim(), locale)'),
    )
  })

  it('it drives the existing pipeline — one generation path', () => {
    for (const path of [
      "'/admin/blog/intelligence/briefs'",
      '/admin/blog/intelligence/briefs/${briefId}/draft',
      '/admin/blog/intelligence/jobs/${job.jobId}',
      '/admin/blog/intelligence/drafts/${newest.id}',
    ]) {
      expect(hook).toContain(path)
    }
    const routes = read('backend', 'src', 'routes', 'blog.routes.ts')
    expect(routes.match(/job_type: 'CONTENT_DRAFT'/g)).toHaveLength(1)
    expect(routes).not.toContain('generateDraft(')
  })

  it('a failed job is read and shown, not waited on forever', () => {
    expect(hook).toContain(
      "if (state.status === 'failed') throw new AiArticleError('writing', state.lastError)",
    )
    expect(hook).toContain("if (status === 'failed')")
    expect(hook).toContain('MAX_WAIT_MS')
  })

  it.each(['fa', 'af', 'en'])('%s has every text the button shows', (lang) => {
    const ai = (
      JSON.parse(
        readFileSync(join(ROOT, 'packages', 'i18n', 'messages', lang, 'common.json'), 'utf8'),
      ) as { admin: { blog: { ai: Record<string, unknown> } } }
    ).admin.blog.ai
    const keys = [...button.matchAll(/t\(\s*'admin\.blog\.ai\.([a-zA-Z.]+)'/g)].map((m) => m[1]!)
    expect(keys.length).toBeGreaterThan(15)
    const missing = keys.filter(
      (key) =>
        typeof key
          .split('.')
          .reduce<unknown>(
            (node, part) =>
              node && typeof node === 'object'
                ? (node as Record<string, unknown>)[part]
                : undefined,
            ai,
          ) !== 'string',
    )
    expect(missing).toEqual([])
    for (const stage of ['research', 'brief', 'writing', 'checking']) {
      expect((ai.stage as Record<string, string>)[stage]).toBeTruthy()
    }
    for (const code of [
      'AI_NOT_CONFIGURED',
      'BLOG_MIGRATION_PENDING',
      'RESEARCH_NOT_CONFIGURED',
      'timeout',
      'cancelled',
    ]) {
      expect((ai.reasons as Record<string, string>)[code]).toBeTruthy()
    }
  })
})
