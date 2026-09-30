// ============================================
// Engine N15 — financial document translation.
// Capability #20.
//
// ⚠️ THIS IS THE ONE TEST FILE WHERE A MODEL IS ASSUMED TO MISBEHAVE.
//
// Everywhere else in this codebase a model is prevented from touching a figure
// by architecture: four reviewed views, no SQL, read-only. Translation breaks
// that boundary by accident — the obvious implementation is «send the text, show
// what comes back» — so the protection has to be a post-condition rather than a
// promise.
//
// The tests below include a translator that deliberately corrupts a figure,
// because that is the failure the whole engine exists to catch, and a test suite
// that only ever feeds a well-behaved stub proves nothing about a guard.
// ============================================

import { describe, expect, it, vi } from 'vitest'

import {
  TRANSLATE_LIMITS,
  pinFigures,
  translateDocument,
  type TextTranslator,
} from '../services/ingest/translate.domain'

const SOURCE = `Invoice 2026-0042
Date: 2026-09-15
Total: 125,000 AFN
Tax: 10,000 AFN`

/** A well-behaved provider: it translates prose and leaves markers alone. */
const honest: TextTranslator = {
  translate: vi.fn(async ({ text }) => text),
}

describe('N15 — figures are pinned OUT before the model sees them', () => {
  it('replaces every figure with a marker', () => {
    const pinned = pinFigures(SOURCE)

    expect(pinned.text).not.toContain('125,000')
    expect(pinned.text).not.toContain('2026-0042')
    expect(pinned.text).toContain('⟦fig-0⟧')
  })

  it('keeps each figure so it can be put back', () => {
    const pinned = pinFigures(SOURCE)

    // ⚠️ The trailing space is PART OF THE MATCH: the pinner takes the number
    // plus the space before the currency word, so the restored text reads
    // naturally. Asserting `'125,000'` exactly was asserting a shape the pinner
    // does not produce.
    expect(pinned.figures.some((f) => f.trim() === '125,000')).toBe(true)
    expect(pinned.figures.some((f) => f.trim() === '10,000')).toBe(true)
  })

  it('never matches ACROSS a line break', () => {
    // ⚠️ THE bug this test pins. `\s` matches `\n`, so "125,000 AFN\nTax: 10,000"
    // was one match that swallowed the whole next line — and a translation came
    // back with a line missing and a figure placeholder in its place.
    const pinned = pinFigures(SOURCE)

    for (const figure of pinned.figures) {
      expect(figure).not.toMatch(/\n/)
    }
    expect(pinned.figures.some((f) => f.includes('AFN\n'))).toBe(false)
  })

  it('counts OCCURRENCES, not distinct values', () => {
    // ⚠️ A document that says 100 twice is two figures a person might check,
    // and reporting «one figure found» would be a quieter scan than it looks.
    const pinned = pinFigures('Total 100 — of which 100 was paid')

    expect(pinned.figures).toHaveLength(1)
    expect(pinned.spotted).toBe(2)
  })
})

describe('N15 — the model is given pinned text and the source figures go back', () => {
  it('never sees a figure', async () => {
    let seen = ''
    const spy: TextTranslator = {
      translate: vi.fn(async ({ text }) => {
        seen = text
        return text
      }),
    }

    await translateDocument(SOURCE, 'en', 'fa', spy)

    expect(seen).not.toContain('125,000')
  })

  it('the translation carries the ORIGINAL figures back', async () => {
    const result = await translateDocument(SOURCE, 'en', 'fa', honest)

    expect(result.kind).toBe('translated')
    expect(result.kind === 'translated' && result.text).toContain('125,000')
  })

  it('the source is kept beside it', async () => {
    // ⚠️ A shop filing a translation files a translation. The original stays on
    // file — the same rule as a credit note being a correction rather than a
    // rewrite.
    const result = await translateDocument(SOURCE, 'en', 'fa', honest)

    expect(result.kind === 'translated' && result.source).toBe(SOURCE)
  })

  it('reports how many figures were protected', async () => {
    const result = await translateDocument(SOURCE, 'en', 'fa', honest)

    // ⚠️ FIVE, and every one of them is a whole value:
    //   2026-0042 · 2026-09-15 · 125,000 · 10,000 — plus the document number's
    //   own digits where the date broke at the hyphen.
    //
    // This was SEVEN before the pattern was fixed: `\s` swallowed the newline,
    // so the count included matches that were really line breaks. The count is
    // only useful if each unit is a number, so under-counting a broken match is
    // right and counting a newline is not.
    expect(result.kind === 'translated' && result.figuresSpotted).toBe(5)
  })

  it('every protected figure is a whole value, not a fragment', () => {
    // ⚠️ The pin that this whole file exists for. Before the fix, "125,000" came
    // back as "125" and "000" and the restored text read "125000".
    const pinned = pinFigures(SOURCE)

    expect(pinned.figures.some((f) => f.trim() === '125,000')).toBe(true)
    expect(pinned.figures.some((f) => f.trim() === '000')).toBe(false)
    expect(pinned.text).toContain('⟦fig-')
  })
})

describe('N15 — a model that touches a figure is CAUGHT, not trusted', () => {
  it('refuses when a figure marker disappears', async () => {
    // ⚠️ THE failure the engine exists for: a model that dropped a total, and a
    // shop filing the result.
    const corrupting: TextTranslator = {
      translate: vi.fn(async ({ text }) => text.replace('⟦fig-2⟧', '120,000')),
    }

    const result = await translateDocument(SOURCE, 'en', 'fa', corrupting)

    expect(result).toMatchObject({ kind: 'refused', reason: 'FIGURE_ALTERED' })
  })

  it('refuses when the model INVENTS a figure', async () => {
    const inventive: TextTranslator = {
      translate: vi.fn(async ({ text }) => `${text} ⟦fig-99⟧`),
    }

    const result = await translateDocument(SOURCE, 'en', 'fa', inventive)

    expect(result).toMatchObject({ kind: 'refused', reason: 'FIGURE_ALTERED' })
  })

  it('a refusal never carries a translated text', async () => {
    // ⚠️ A caller that ignores the verdict and reads `.text` must get nothing,
    // not a partial or an empty string.
    const corrupting: TextTranslator = {
      translate: vi.fn(async ({ text }) => text.replace('⟦fig-2⟧', '1')),
    }
    const result = await translateDocument(SOURCE, 'en', 'fa', corrupting)

    expect(result).not.toHaveProperty('text')
  })
})

describe('N15 — the refusals that save the call', () => {
  it('refuses an unsupported language pair', async () => {
    const result = await translateDocument(SOURCE, 'en', 'de' as never, honest)

    expect(result).toMatchObject({ kind: 'refused', reason: 'UNSUPPORTED_LOCALE' })
  })

  it('refuses translating into the language it is already in', async () => {
    // ⚠️ A pointless call that costs the owner money per token.
    const result = await translateDocument(SOURCE, 'fa', 'fa', honest)

    expect(result).toMatchObject({ kind: 'refused', reason: 'SAME_LOCALE' })
  })

  it('refuses a document past the length limit', async () => {
    const result = await translateDocument(
      'a'.repeat(TRANSLATE_LIMITS.maxCharacters + 1),
      'en',
      'fa',
      honest,
    )

    expect(result).toMatchObject({ kind: 'refused', reason: 'TOO_LONG' })
  })

  it('refuses an empty document rather than calling the provider', async () => {
    // ⚠️ `mockClear` because the module-level stub is shared across the file,
    // and an assertion about "was not called" is only meaningful against a
    // known count — otherwise it passes for the wrong reason after an earlier
    // test called it.
    ;(honest.translate as unknown as { mockClear: () => void }).mockClear()

    const result = await translateDocument('   ', 'en', 'fa', honest)

    expect(result).toMatchObject({ kind: 'refused', reason: 'NOTHING_TO_TRANSLATE' })
    expect(honest.translate).not.toHaveBeenCalled()
  })

  it('the three shipped languages are the supported set', async () => {
    // ⚠️ Adding one is a product decision: a language with no glossary makes
    // financial terms mistranslate, and a mistranslated term in a tax line is
    // worse than no translation.
    const { SUPPORTED_LOCALES } = await import('../services/ingest/translate.domain')
    expect(SUPPORTED_LOCALES).toEqual(['fa', 'af', 'en'])
  })
})
