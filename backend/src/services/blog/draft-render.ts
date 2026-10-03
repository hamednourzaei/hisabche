// ============================================
// Capability: draft rendering (Phase 4) — the ONE structure, TWO representations.
//
// ⚠️ WHY THIS FILE EXISTS, AND WHY THE MODEL NEVER SEES HTML.
//
// The backend has no Tiptap and no prosemirror (checked: neither is a
// dependency), so it CANNOT render a Tiptap document from the model's HTML with
// the real node schema. Two ways out:
//
//   1. Ask the model for HTML, store it, and hope the editor can parse it back
//      into the same document. It can't reliably — and an `html` and a `json`
//      that disagree is the bug that makes the editor silently drop content on
//      the first keystroke.
//   2. Ask the model for STRUCTURED SECTIONS (headings, paragraphs, list items
//      — plain strings, no markup), then build BOTH the Tiptap doc-JSON and the
//      HTML from that one structure here.
//
// This file is option 2. The two representations cannot drift because they are
// emitted from the same nodes in the same loop. And because the model only ever
// produced plain text, there is no `<script>`, no `<img src=…>`, no `onclick`
// to smuggle — the escaping below is belt-and-braces, not the only defence.
//
// ⚠️ NODES ARE LIMITED TO WHAT THE EDITOR'S StarterKit ACTUALLY LOADS:
// heading (2/3/4), paragraph, bulletList, orderedList, listItem, blockquote.
// A node the editor has no extension for would be dropped on load — invisible
// data loss — so anything else in the input is refused by the schema, not here.
// ============================================

import { headingSlug } from './blog.domain'

/** One block of the article. `text`/`items` are PLAIN strings — never markup. */
export type DraftBlock =
  | { kind: 'heading'; level: 2 | 3 | 4; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bulletList'; items: string[] }
  | { kind: 'orderedList'; items: string[] }
  | { kind: 'blockquote'; text: string }

/** A Tiptap JSONContent node — the shape `content: initialContent` expects. */
export interface TipNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TipNode[]
  text?: string
  marks?: Array<{ type: 'bold' }>
}

export interface RenderedDraft {
  /** The Tiptap document, ready for `contentJson`. */
  json: Record<string, unknown>
  /** The same content as HTML, ready to be sanitised and stored. */
  html: string
}

/** Escape the five characters that would otherwise become markup. */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─── inline emphasis ─────────────────────────────────────────────────────────
//
// The ONE piece of inline formatting a draft may carry: **bold**, for the key
// numbers, dates and terms an editorial checklist asks to be scannable.
//
// ⚠️ This is NOT markdown support. Only a `**…**` pair on one line is read;
// every other character — including `<`, `[text](url)`, `_x_`, `#` — stays
// literal text and is escaped. Links are deliberately not here: an internal
// link is a human decision (internal-links.service), never something a model
// writes straight into the body.

const BOLD = /\*\*([^*\n]{1,200}?)\*\*/g

interface Span {
  text: string
  bold: boolean
}

export function inlineSpans(text: string): Span[] {
  const spans: Span[] = []
  let last = 0
  for (const match of text.matchAll(BOLD)) {
    const start = match.index ?? 0
    if (start > last) spans.push({ text: text.slice(last, start), bold: false })
    spans.push({ text: match[1] ?? '', bold: true })
    last = start + match[0].length
  }
  if (last < text.length) spans.push({ text: text.slice(last), bold: false })
  return spans.filter((span) => span.text.length > 0)
}

/** The inline nodes of one run of text — plain, or bold where it was marked. */
function textNodes(text: string): TipNode[] {
  return inlineSpans(text).map((span) =>
    span.bold
      ? { type: 'text', text: span.text, marks: [{ type: 'bold' }] }
      : { type: 'text', text: span.text },
  )
}

/** The same run as HTML: every span escaped, bold ones wrapped. */
function inlineHtml(text: string): string {
  return inlineSpans(text)
    .map((span) => (span.bold ? `<strong>${esc(span.text)}</strong>` : esc(span.text)))
    .join('')
}

/** A heading is never bold-marked: its text is also its anchor. */
function textNode(text: string): TipNode {
  return { type: 'text', text }
}

function blockToNodes(block: DraftBlock): TipNode[] {
  switch (block.kind) {
    case 'heading':
      return [{ type: 'heading', attrs: { level: block.level }, content: [textNode(block.text)] }]
    case 'paragraph':
      return [{ type: 'paragraph', content: textNodes(block.text) }]
    case 'blockquote':
      return [
        { type: 'blockquote', content: [{ type: 'paragraph', content: textNodes(block.text) }] },
      ]
    case 'bulletList':
      return [
        {
          type: 'bulletList',
          content: block.items.map((item) => ({
            type: 'listItem',
            content: [{ type: 'paragraph', content: textNodes(item) }],
          })),
        },
      ]
    case 'orderedList':
      return [
        {
          type: 'orderedList',
          attrs: { start: 1 },
          content: block.items.map((item) => ({
            type: 'listItem',
            content: [{ type: 'paragraph', content: textNodes(item) }],
          })),
        },
      ]
  }
}

function blockToHtml(block: DraftBlock): string {
  switch (block.kind) {
    case 'heading':
      // ⚠️ The id matches `withHeadingIds`/`headingSlug` so the stored TOC and
      // the rendered one agree — a heading without an id has no anchor.
      return `<h${block.level} id="${esc(headingSlug(block.text))}">${esc(block.text)}</h${block.level}>`
    case 'paragraph':
      return `<p>${inlineHtml(block.text)}</p>`
    case 'blockquote':
      return `<blockquote><p>${inlineHtml(block.text)}</p></blockquote>`
    case 'bulletList':
      return `<ul>${block.items.map((i) => `<li><p>${inlineHtml(i)}</p></li>`).join('')}</ul>`
    case 'orderedList':
      return `<ol>${block.items.map((i) => `<li><p>${inlineHtml(i)}</p></li>`).join('')}</ol>`
  }
}

/**
 * Turn the structured blocks into the two stored representations.
 *
 * ⚠️ EMPTY BLOCKS ARE DROPPED, NOT RENDERED AS EMPTY TAGS. A heading with no
 * text or a list with no items is a model artefact; rendering `<h2></h2>` would
 * put a stray heading in the editor and the TOC. Dropping it is the honest
 * result — and `renderDraft` returning an empty document is the caller's signal
 * that the model produced nothing, which fails the draft rather than saving it.
 */
export function renderDraft(blocks: readonly DraftBlock[]): RenderedDraft {
  const kept = blocks.filter((b) => {
    if ('text' in b) return b.text.trim().length > 0
    return b.items.some((i) => i.trim().length > 0)
  })

  const content: TipNode[] = kept.flatMap(blockToNodes)
  const html = kept.map(blockToHtml).join('')

  return {
    json: { type: 'doc', content },
    html,
  }
}
