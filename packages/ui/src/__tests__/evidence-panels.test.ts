// ============================================
// The evidence panels: every label a database value can reach exists in
// fa, af and en (t() throws on a missing key); an unknown value is shown as
// its code, never looked up; both panels load only when opened; a 403 is
// its own sentence.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { EVIDENCE_SOURCE_TYPES, evidenceSourceLabel } from '../lib/evidence-labels'

const ROOT = join(__dirname, '../../../..')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (p: string) => strip(readFileSync(join(ROOT, p), 'utf8'))
const catalog = (lang: string) =>
  JSON.parse(readFileSync(join(ROOT, 'packages/i18n/messages', lang, 'common.json'), 'utf8')) as {
    evidence: { source: Record<string, string>; warning: Record<string, string> }
  }

describe.each(['fa', 'af', 'en'])('%s', (lang) => {
  it.each([...EVIDENCE_SOURCE_TYPES])('source %s', (type) =>
    expect(catalog(lang).evidence.source[type]).toBeTruthy(),
  )
  it.each(['COST_MISSING', 'COST_ESTIMATED', 'NOT_POSTED'])('warning %s', (w) =>
    expect(catalog(lang).evidence.warning[w]).toBeTruthy(),
  )
})

describe('the panels', () => {
  it('an unknown source is shown as its code, never looked up', () => {
    const t = (key: string) => {
      throw new Error(`looked up ${key}`)
    }
    expect(evidenceSourceLabel(t, 'something_new')).toBe('something_new')
  })

  it('both load only when opened, and say «not allowed» on a 403', () => {
    for (const file of [
      'packages/ui/src/components/ui/invoice-detail/invoice-evidence-panel.tsx',
      'packages/ui/src/components/ui/warehouse-detail/product-journey-panel.tsx',
    ]) {
      const src = read(file)
      expect(src).toMatch(/use(InvoiceEvidence|ProductJourney)\([^)]*open\)/)
      // Whitespace-free, so a formatter's line breaks cannot hide or fake it.
      expect(src.replace(/\s+/g, '')).toMatch(
        /status===403&&\(?<p[^>]*>\{t\('evidence\.forbidden'\)\}/,
      )
      expect(src).not.toMatch(/t\(`evidence\.source\./)
    }
  })

  it('are mounted on the invoice and product pages', () => {
    expect(
      read('packages/ui/src/components/ui/invoice-detail/containers/invoice-detail-container.tsx'),
    ).toContain('<InvoiceEvidencePanel invoiceId={id} />')
    expect(
      read(
        'packages/ui/src/components/ui/warehouse-detail/containers/warehouse-detail-container.tsx',
      ),
    ).toContain('<ProductJourneyPanel t={safeT} productId={id} />')
  })
})
