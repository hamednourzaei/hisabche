// The admin blog console (apps/admin has no test runner of its own; like the
// other cross-app guards, this reads its sources from here).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BLOG_COMMENT_STATUSES,
  BLOG_LOCALES,
  BLOG_POST_STATUSES,
  seoChecklist,
} from '@hisabche/validation'

const ROOT = join(__dirname, '../../../..')
const ADMIN = join(ROOT, 'apps/admin')
// Line comments FIRST: a path glob in one (`/admin/blog/*`) must not open a
// block comment that swallows the code after it.
const strip = (s: string) =>
  s
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
const read = (...p: string[]) => strip(readFileSync(join(ADMIN, ...p), 'utf8'))

const blogDir = join(ADMIN, 'components/blog')
const files = readdirSync(blogDir).map((f) => read('components/blog', f))
const all = files.join('\n')
const editor = read('components/blog/blog-editor.tsx')
const form = read('components/blog/post-editor-client.tsx')

const catalogue = Object.fromEntries(
  ['fa', 'af', 'en'].map((l) => [
    l,
    JSON.parse(
      readFileSync(join(ROOT, 'packages/i18n/messages', l, 'common.json'), 'utf8'),
    ) as unknown,
  ]),
)
const has = (obj: unknown, path: string) =>
  typeof path
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], obj) ===
  'string'

describe('admin blog — every key in all three languages', () => {
  it('static keys', () => {
    const keys = new Set([...all.matchAll(/\bt\('(admin\.blog\.[\w.]+)'/g)].map((m) => m[1]!))
    // label('x') in the editor toolbar is `admin.blog.editor.x`.
    for (const m of editor.matchAll(/\blabel\('([\w.]+)'\)/g)) keys.add(`admin.blog.editor.${m[1]}`)
    expect(keys.size).toBeGreaterThan(60)
    for (const locale of ['fa', 'af', 'en']) {
      expect(
        [...keys].filter((k) => !has(catalogue[locale], k)),
        locale,
      ).toEqual([])
    }
  })

  it('keys built from a value — every value of the vocabulary', () => {
    const keys = [
      ...BLOG_LOCALES.map((l) => `admin.blog.locales.${l}`),
      ...BLOG_POST_STATUSES.map((s) => `admin.blog.status.${s}`),
      ...BLOG_COMMENT_STATUSES.map((s) => `admin.blog.commentStatus.${s}`),
      ...['approved', 'rejected', 'spam'].map((s) => `admin.blog.moderate.${s}`),
      ...['posts', 'comments', 'taxonomy'].map((s) => `admin.blog.tabs.${s}`),
      ...['categories', 'tags'].map((s) => `admin.blog.taxonomy.${s}`),
      ...['sans', 'mono'].map((s) => `admin.blog.editor.fonts.${s}`),
      ...seoChecklist({
        title: '',
        metaTitle: null,
        metaDescription: null,
        focusKeyword: null,
        html: '',
        locale: 'fa',
      }).map((c) => `admin.blog.seo.checks.${c.id}`),
      'admin.blog.title',
      'admin.blog.description',
    ]
    for (const locale of ['fa', 'af', 'en']) {
      expect(
        keys.filter((k) => !has(catalogue[locale], k)),
        locale,
      ).toEqual([])
    }
  })
})

describe('admin blog — contracts', () => {
  it('the nav entry exists only because its endpoint does', () => {
    const nav = read('components/admin-shell/admin-nav.ts')
    expect(nav).toContain("endpoint: 'GET /admin/blog/posts'")
    const routes = readFileSync(join(ROOT, 'backend/src/routes/blog.routes.ts'), 'utf8')
    expect(routes).toContain("'/api/admin/blog/posts', admin")
  })

  it('the editor offers only the project fonts and sizes (the sanitiser’s own lists)', () => {
    expect(editor).toContain('Object.entries(BLOG_FONT_FAMILIES)')
    expect(editor).toContain('BLOG_FONT_SIZES.map(')
    // No colour, no highlight, no free font family.
    expect(editor).not.toMatch(/\bColor\b|Highlight|BackgroundColor/)
  })

  it('an image cannot be inserted without alt text', () => {
    expect(editor).toContain('if (!file || !alt.trim()) return')
    expect(editor).toContain('disabled={upload.isPending || !file || !alt.trim()}')
    expect(editor).toContain('setImage({ src: url, alt: alt.trim() })')
  })

  it('the SEO checklist never blocks publishing', () => {
    // «Publish» is disabled only while a save is in flight.
    expect(form).toMatch(/disabled=\{save\.isPending\}\s+onClick=\{\(\) => submit\('published'\)\}/)
    expect(read('components/blog/seo-panel.tsx')).not.toContain('disabled')
  })

  it('design tokens only — no raw palette colour', () => {
    expect(all).not.toMatch(
      /\b(?:text|bg|border)-(?:red|blue|green|yellow|gray|slate|zinc|amber|emerald)-\d{2,3}\b/,
    )
    expect(all).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
  })

  it('internal links from the editor carry the article’s locale', () => {
    expect(editor).toContain('apply(`/${locale}/blog/${p.slug}`)')
  })
})
