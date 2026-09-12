// ============================================
// A line that moves no stock has to say so.
//
// ---------------------------------------------------------------------------
// ⚠️ WHAT ACTUALLY HAPPENED
//
// Three invoices were entered — «halghe», «aloow», «انگشتر» — against a
// catalogue holding one product, «kartoon». Every line saved with
// `product_id = NULL`, every invoice completed cleanly, and the warehouse
// figure never moved. `stock_movements` held exactly one row: the Phase C
// opening.
//
// The backend was right: it cannot deduct stock for a product that does not
// exist. The grid already marks a LINKED line with a green package icon.
//
// But the ABSENCE of a mark is not a signal. Somebody has to already know the
// icon exists to notice it is missing — and the person checking their
// warehouse afterwards was told nothing at all, so they concluded the stock
// feature was broken. It was not; the lines were free text.
//
// ⚠️ THIS IS NOT AN ERROR AND MUST NOT BLOCK THE SAVE. A free-text line is a
// legitimate invoice line — services, one-off items, anything not in the
// catalogue. Refusing it would be false. The notice states what will happen
// while the person can still act on it.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/.*/g, '')
}

const preview = code(
  join(
    __dirname,
    '..',
    'components',
    'ui',
    'invoice-builder',
    'containers',
    'invoice-preview-container.tsx',
  ),
)

describe('the unlinked-line notice', () => {
  it('⚠️ is derived from the real lines, not from a flag', () => {
    expect(preview).toMatch(/items\.filter\(\(item\) => !item\.productId\)/)
  })

  it('⚠️ does NOT block the save', () => {
    // Only `issues` may disable confirm. A free-text line is legitimate.
    expect(preview).not.toMatch(/disabled=\{unlinkedLines/)
    expect(preview).toMatch(/disabled=\{issues\.length > 0\}/)
  })

  it('renders nothing when every line is linked', () => {
    expect(preview).toMatch(/unlinkedLines\.length > 0 \?/)
  })

  it('names the lines, so the person knows which ones', () => {
    expect(preview).toMatch(/unlinkedLines\.join/)
  })

  it('the strings exist in every locale', () => {
    for (const locale of ['fa', 'af', 'en']) {
      const bundle = JSON.parse(
        readFileSync(
          join(__dirname, '..', '..', '..', 'i18n', 'messages', locale, 'common.json'),
          'utf8',
        ),
      ) as { invoiceBuilder: Record<string, string> }

      expect(bundle.invoiceBuilder.notLinkedTitle, `${locale}.notLinkedTitle`).toBeTruthy()
      expect(bundle.invoiceBuilder.notLinkedHint, `${locale}.notLinkedHint`).toBeTruthy()
    }
  })
})
