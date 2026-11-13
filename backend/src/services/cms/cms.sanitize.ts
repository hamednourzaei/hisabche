// ============================================
// backend/src/services/cms/cms.sanitize.ts
//
// V63 · S-4 — the ONLY way HTML reaches a CMS section or global.
//
// ⚠️ WHY
//
// `contentBlockContentSchema.html` is `z.string().max(50000)` — 50 kB of
// arbitrary text that the public site renders with `dangerouslySetInnerHTML`.
// The blog had a sanitiser (`blog.sanitize.ts`); the CMS did not, so a page
// editor was a stored-XSS writer on the marketing site. The console's CSP is
// the second layer; this is the first, on the server, before the row is saved.
//
// The allowlist is the block editor's own vocabulary: prose, headings, lists,
// links, images, tables, figures, code. No <script>, no <style>, no `on*`
// attribute, no `javascript:`/`data:` URL. `data:` is excluded on purpose —
// an <img src="data:image/svg+xml,..."> can carry script in some renderers.
// ============================================

import sanitizeHtml from 'sanitize-html'

const ALLOWED_TAGS = [
  'p',
  'br',
  'hr',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'small',
  'sub',
  'sup',
  'blockquote',
  'ul',
  'ol',
  'li',
  'pre',
  'code',
  'a',
  'img',
  'figure',
  'figcaption',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'div',
  'span',
]

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'loading'],
    th: ['colspan', 'rowspan', 'scope'],
    td: ['colspan', 'rowspan'],
    '*': ['id', 'class', 'dir', 'lang'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  // A link that leaves the site never gets a window handle back.
  transformTags: {
    a: (tagName, attribs) => {
      const external = /^https?:\/\//i.test(attribs.href ?? '')
      return {
        tagName,
        attribs: external
          ? { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' }
          : attribs,
      }
    },
  },
}

/** The keys whose string value is HTML in a CMS section or global. */
const HTML_KEYS = new Set(['html', 'bodyHtml', 'contentHtml'])

export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS)
}

/**
 * Walk any CMS value and sanitise every string that sits under an HTML key.
 *
 * Written recursively because a global carries reviewer-authored JSON whose
 * shape is deliberately open (`z.record(z.unknown())`); a fixed key list would
 * leave the next block type unguarded.
 */
export function sanitizeDeep<T>(value: T): T {
  if (typeof value === 'string') return value as T
  if (Array.isArray(value)) return value.map((item) => sanitizeDeep(item)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] =
        typeof child === 'string' && HTML_KEYS.has(key)
          ? sanitizeRichHtml(child)
          : sanitizeDeep(child)
    }
    return out as T
  }
  return value
}

/** One section: its `content` record, sanitised. */
export function sanitizeSectionContent<T extends Record<string, unknown>>(content: T): T {
  return sanitizeDeep(content)
}

/** Every section of a page. */
export function sanitizeSections<T extends { content: Record<string, unknown> }>(
  sections: readonly T[],
): T[] {
  return sections.map((section) => ({
    ...section,
    content: sanitizeSectionContent(section.content),
  }))
}
