// dashboard-fx-01: an invoice in another currency with no rate is left out of
// every dashboard figure — and the dashboard SAYS so where the figures are
// read (never a silent gap, never added at 1).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(__dirname, '..', 'components', 'ui', 'dashboard', 'containers', 'dashboard-container.tsx'),
  'utf8',
)
const msgs = (lang: string) =>
  JSON.parse(
    readFileSync(
      join(__dirname, '..', '..', '..', 'i18n', 'messages', lang, 'common.json'),
      'utf8',
    ),
  )

describe('the dashboard names what it could not convert', () => {
  it('shows a note when the server counts unconverted invoices', () => {
    expect(src).toContain('kpis?.unconvertedInvoices')
    expect(src).toContain('data-unconverted-invoices')
  })

  it('in all three languages, with the count', () => {
    for (const lang of ['fa', 'af', 'en']) {
      expect(msgs(lang).dashboard.unconvertedInvoices, lang).toContain('{count}')
    }
  })
})
