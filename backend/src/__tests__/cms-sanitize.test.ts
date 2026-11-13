// ============================================
// backend/src/__tests__/cms-sanitize.test.ts
//
// V63 · S-4 — the CMS stores the marketing site's HTML, so the server must
// sanitise it before the row is written.
//
// The unit cases are the payloads that actually matter: a <script>, an
// `on*` handler, a `javascript:` link, a `data:` image, a style block. The
// source assertion pins that `cms.service.ts` still calls the sanitiser on
// BOTH write paths (page sections and globals) — a new write path that forgets
// it would otherwise be invisible.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { sanitizeDeep, sanitizeRichHtml } from '../services/cms/cms.sanitize'

describe('CMS HTML sanitisation', () => {
  it('removes script tags and their content', () => {
    const out = sanitizeRichHtml('<p>ok</p><script>alert(1)</script>')
    expect(out).toBe('<p>ok</p>')
  })

  it('removes inline event handlers', () => {
    const out = sanitizeRichHtml('<p onclick="steal()">text</p><img src="/x.png" onerror="boom()">')
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('onerror')
  })

  it('drops a javascript: link but keeps the text', () => {
    const out = sanitizeRichHtml('<a href="javascript:alert(1)">click</a>')
    expect(out).not.toContain('javascript:')
    expect(out).toContain('click')
  })

  it('refuses a data: image', () => {
    const out = sanitizeRichHtml('<img src="data:image/svg+xml,<svg onload=alert(1)>">')
    expect(out).not.toContain('data:image')
  })

  it('keeps ordinary article markup', () => {
    const input =
      '<h2>Title</h2><p><strong>bold</strong> <em>italic</em></p>' +
      '<ul><li>one</li></ul><img src="https://cdn.example/x.png" alt="x">'
    const out = sanitizeRichHtml(input)
    expect(out).toContain('<h2>Title</h2>')
    expect(out).toContain('<strong>bold</strong>')
    expect(out).toContain('<li>one</li>')
    expect(out).toContain('alt="x"')
  })

  it('makes an external link safe to open', () => {
    const out = sanitizeRichHtml('<a href="https://example.com">out</a>')
    expect(out).toContain('rel="noopener noreferrer nofollow"')
    expect(out).toContain('target="_blank"')
  })

  it('walks nested section and global content', () => {
    const content = {
      title: 'Safe',
      html: '<p>a</p><script>bad()</script>',
      nested: { html: '<img src=x onerror=alert(1)>' },
      list: [{ html: '<a href="javascript:x">no</a>', keep: 1 }],
    }

    const cleaned = sanitizeDeep(content)
    const serialized = JSON.stringify(cleaned)

    expect(serialized).not.toContain('<script>')
    expect(serialized).not.toContain('onerror')
    expect(serialized).not.toContain('javascript:')
    expect(cleaned.title).toBe('Safe')
    expect(cleaned.list[0]?.keep).toBe(1)
  })

  it('the service sanitises both write paths', () => {
    const source = readFileSync(join(__dirname, '..', 'services', 'cms', 'cms.service.ts'), 'utf8')
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

    // createPage + updatePage
    expect(code.match(/sections: sanitizeSections\(data\.sections\)/g)).toHaveLength(2)
    // upsertGlobal
    expect(code).toContain('sanitizeDeep(content)')
  })
})
