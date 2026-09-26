// ============================================
// backend/src/services/blog/blog.sanitize.ts
//
// The ONLY way HTML reaches `blog_posts.content_html`.
//
// A strict allowlist: the tags the editor can produce, and nothing else. No
// <script>, no <style>, no `on*` handler, no `javascript:` URL, no inline style
// beyond the project's own font families and type scale (the same lists the
// editor's menus read — @hisabche/validation), no colour.
//
// It also enforces what the page needs: every image has alt text (refused
// otherwise), every internal link carries its locale and the right `rel`, and
// every heading gets a stable id for the table of contents.
// ============================================

import sanitizeHtml from 'sanitize-html'
import { BLOG_FONT_FAMILIES, BLOG_FONT_SIZES, type BlogLocale } from '@hisabche/validation'

import { linkDecision, withHeadingIds, type TocEntry } from './blog.domain'

export interface SanitizedArticle {
  html: string
  toc: TocEntry[]
  /** Refusals — the post is not saved while any exist. */
  errors: Array<{ path: string; message: string }>
  /** Changes made on the way in, shown to the admin (never silent). */
  warnings: Array<{ path: string; message: string }>
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const exactly = (values: readonly string[]) => values.map((v) => new RegExp(`^${escapeRegExp(v)}$`))

const BLOCK_TEXT = ['p', 'h2', 'h3', 'h4', 'li', 'blockquote', 'th', 'td']
const DIRECTIONS = new Set(['rtl', 'ltr', 'auto'])

export function sanitizeArticleHtml(input: string, locale: BlogLocale): SanitizedArticle {
  const errors: SanitizedArticle['errors'] = []
  const warnings: SanitizedArticle['warnings'] = []
  let imageIndex = 0

  const blockAttributes = ['dir', 'style']
  const cleaned = sanitizeHtml(input, {
    allowedTags: [
      'p',
      'br',
      'h2',
      'h3',
      'h4',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'blockquote',
      'ul',
      'ol',
      'li',
      'pre',
      'code',
      'a',
      'img',
      'hr',
      'table',
      'colgroup',
      'col',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      'figure',
      'figcaption',
      'span',
    ],
    allowedAttributes: {
      a: ['href', 'rel', 'target'],
      img: ['src', 'alt', 'width', 'height', 'title', 'loading', 'decoding'],
      ol: ['start'],
      code: ['class'],
      th: ['colspan', 'rowspan', ...blockAttributes],
      td: ['colspan', 'rowspan', ...blockAttributes],
      span: ['style'],
      ...Object.fromEntries(
        BLOCK_TEXT.filter((t) => t !== 'th' && t !== 'td').map((t) => [t, blockAttributes]),
      ),
    },
    allowedClasses: { code: ['language-*'] },
    allowedStyles: {
      '*': {
        'font-family': exactly(Object.values(BLOG_FONT_FAMILIES)),
        'font-size': exactly(BLOG_FONT_SIZES),
        'text-align': [/^(left|right|center|justify|start|end)$/],
      },
    },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedSchemesByTag: { img: ['https'] },
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      // The article title is the page's only h1.
      h1: 'h2',
      a: (_tag, attribs) => {
        if (!attribs.href) return { tagName: 'a', attribs: {} }
        const link = linkDecision(attribs.href, locale)
        if (link.localeAdded) {
          warnings.push({
            path: 'contentHtml',
            message: `blog.warnings.linkLocaleAdded:${link.href}`,
          })
        }
        const next: Record<string, string> = { href: link.href }
        if (link.rel) next.rel = link.rel
        if (link.target) next.target = link.target
        return { tagName: 'a', attribs: next }
      },
      img: (_tag, attribs) => {
        imageIndex += 1
        const alt = (attribs.alt ?? '').trim()
        if (!alt) {
          errors.push({ path: 'contentHtml', message: `blog.errors.imageAlt:${imageIndex}` })
        }
        const next: Record<string, string> = { ...attribs, alt, loading: 'lazy', decoding: 'async' }
        return { tagName: 'img', attribs: next }
      },
      '*': (tag, attribs) => {
        // `dir` is allowed on block text only, and only with a real direction.
        if (attribs.dir !== undefined && !DIRECTIONS.has(attribs.dir)) {
          const { dir: _dropped, ...rest } = attribs
          return { tagName: tag, attribs: rest }
        }
        return { tagName: tag, attribs }
      },
    },
    // An image whose src was rejected (http:, data:) is dropped entirely.
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
  })

  const { html, toc } = withHeadingIds(cleaned)
  return { html, toc, errors, warnings }
}
