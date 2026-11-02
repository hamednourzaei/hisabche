// ============================================
// packages/ui/src/__tests__/package-product-form-and-return-ui.test.ts
//
// M5 2.1 / 2.4 guards on the EXISTING forms (no parallel form):
//   · the product form can create an offering of type `package`, with a term of 1 / 6 / 12 months or none, and sends the term
//     only for a package;
//   · the return dialog sends an explicit disposition for every line (no hidden default), disables SCRAP without stock.adjust and
//     says why, and refuses to send a scrap that the server would refuse;
//   · every new string exists in fa, af and en.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...p: string[]) =>
  readFileSync(join(ROOT, ...p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    // whitespace flattened: the formatter re-wraps long lines after every save, and a guard must not care
    .split(/\s+/)
    .join(' ')
const form = read('packages', 'ui', 'src', 'components', 'ui', 'add-product-modal.tsx')
const dialog = read(
  'packages',
  'ui',
  'src',
  'components',
  'ui',
  'invoices',
  'invoice-returns-dialog.tsx',
)

describe('product form: package offering and term', () => {
  it('offers the package type and the three terms, and sends a term only for a package', () => {
    expect(form).toContain("value: 'package'")
    for (const term of ["'1'", "'6'", "'12'"]) expect(form).toContain(`value: ${term}`)
    expect(form).toMatch(/formData\.offeringType === 'package' && formData\.packageTermMonths/)
  })

  it('a package moves no stock (quantity 0 like a service)', () => {
    expect(form).toMatch(/isService = formData\.offeringType !== 'goods'/)
  })
})

describe('return dialog: explicit disposition, scrap gated by stock.adjust', () => {
  it('sends the chosen destination of every line and has no fallback value', () => {
    expect(dialog).toMatch(/restockChoice: row\.destination/)
    expect(dialog).not.toMatch(/restockChoice: [^,\n]*\?\?/)
  })

  it('disables scrap without stock.adjust, explains why, and does not send it', () => {
    expect(dialog).toContain("can('stock.adjust')")
    expect(dialog).toMatch(/disabled: !mayScrap/)
    expect(dialog).toContain('returnScrapNeedsPermission')
    expect(dialog).toMatch(/!mayScrap && lines\.some/)
  })
})

describe('strings exist in fa, af, en', () => {
  const keys: Array<[string, string]> = [
    ['product', 'package'],
    ['product', 'packageTerm'],
    ['product', 'packageTermNone'],
    ['product', 'packageTerm1'],
    ['product', 'packageTerm6'],
    ['product', 'packageTerm12'],
    ['product', 'packageTermHint'],
    ['invoices', 'returnScrapNeedsPermission'],
    ['invoices', 'returnErrStockDecision'],
  ]
  for (const lang of ['fa', 'af', 'en']) {
    it(lang, () => {
      const messages = JSON.parse(
        readFileSync(join(ROOT, 'packages', 'i18n', 'messages', lang, 'common.json'), 'utf8'),
      ) as Record<string, Record<string, unknown>>
      for (const [ns, key] of keys)
        expect(messages[ns]?.[key], `${lang}:${ns}.${key}`).toEqual(expect.any(String))
    })
  }
})
