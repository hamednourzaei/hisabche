import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// buildLegalMetadata appends the brand; a title that carries it too renders
// «… | حسابچه | حسابچه» in the tab and the search result.
describe.each(['fa', 'af', 'en'])('%s feature page titles', (lang) => {
  const m = JSON.parse(
    readFileSync(join(__dirname, `../../../i18n/messages/${lang}/common.json`), 'utf8'),
  )
  const pages = m.landing.featurePage as Record<
    string,
    { metaTitle?: string; metaDescription?: string; h1?: string; faq?: unknown[] }
  >
  const withContent = Object.entries(pages).filter(
    ([, v]) => v && typeof v === 'object' && 'h1' in v,
  )

  it('has the six feature pages', () => {
    expect(withContent.map(([k]) => k).sort()).toEqual(
      ['customerDebt', 'daybook', 'inventory', 'invoicing', 'offline', 'shopAccounting'].sort(),
    )
  })

  it.each(withContent)(
    '%s: title without the brand, description present, FAQ present',
    (_key, page) => {
      expect(page.metaTitle).toBeTruthy()
      expect(page.metaTitle).not.toMatch(/\|\s*(حسابچه|Hisabche)\s*$/)
      expect((page.metaDescription ?? '').length).toBeGreaterThan(80)
      expect(Array.isArray(page.faq) && page.faq.length).toBeTruthy()
    },
  )
})
