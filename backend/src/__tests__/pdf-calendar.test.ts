// ============================================
// The invoice PDF's calendar.
//
// ---------------------------------------------------------------------------
// ⚠️ WHY THIS ONE MATTERS MORE THAN A SCREEN
//
// `InvoicePDFDocument` formatted every date and every amount with a hardcoded
// `'fa-AF'`. A screen with the wrong month name is a bug you can re-render; a
// PDF leaves the product, gets emailed to a customer and filed. Every invoice
// this server has produced carried the Afghan solar calendar and Persian
// digits regardless of who asked for it.
//
// The default stays `'af'` on purpose: changing it would silently re-date the
// entire archive. Only a caller that actually knows the reader's language
// changes anything.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')
}

const doc = code(join(__dirname, '..', 'pdf', 'InvoicePDFDocument.tsx'))
const route = code(join(__dirname, '..', 'routes', 'invoice-pdf.routes.ts'))

describe('the document takes a language', () => {
  it('⚠️ no hardcoded locale is left in it', () => {
    expect(doc).not.toMatch(/toLocaleDateString\(\s*['"]/)
    expect(doc).not.toMatch(/toLocaleString\(\s*['"]fa/)
  })

  it('formats through the shared helpers, not its own copy', () => {
    // A second `resolveIntlLocale` living in a PDF file is how the three
    // languages drift apart.
    expect(doc).toMatch(/from '@hisabche\/formatting'/)
    expect(doc).toMatch(/resolveIntlLocale\(lang\)/)
  })

  it('⚠️ defaults to Dari, so the archive keeps its meaning', () => {
    expect(doc).toMatch(/lang = 'af'/)
  })
})

describe('the route knows who is reading', () => {
  it('passes the language it derived', () => {
    expect(route).toMatch(/InvoicePDFDocument\(\{ invoice: invoice as any, qrDataUrl, lang \}\)/)
  })

  it('⚠️ checks fa-AF before fa', () => {
    // A plain `startsWith('fa')` first would hand every Dari reader the
    // Iranian month names — the exact defect this replaces, one layer up.
    const helper = route.slice(route.indexOf('function uiLanguageFromHeader'))
    expect(helper.indexOf("'fa-af'")).toBeLessThan(helper.indexOf("startsWith('fa')"))
  })

  it('an absent header is Dari, not a crash', () => {
    expect(route).toMatch(/\?\? ''/)
  })
})
