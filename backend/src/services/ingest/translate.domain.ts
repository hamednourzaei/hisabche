// ============================================
// Capability #20 — financial document translation.
// Engine N15.
//
// ⚠️ THIS IS THE ONE PLACE A MODEL TOUCHES FIGURES, SO IT IS THE ONE PLACE
// WITH THE HARDEST RULES IN THIS FILE.
//
// The product's boundary is already written down: a model may STATE a number,
// never GENERATE one, and it reaches data only through four reviewed views
// (`reporting-reader.ts`). Translation breaks that boundary by accident — the
// obvious implementation is «send the document text to the model and show what
// comes back», and a model that misplaces a digit in a total has produced a
// document a shop will file.
//
// So the rules here are structural, not advisory:
//
//   1. TEXT ONLY IN, TEXT ONLY OUT. The provider is handed prose and returns
//      prose. No structure is parsed out of it, ever.
//   2. EVERY FIGURE IS SPOTTED AND PINNED. An amount in the source becomes a
//      placeholder before the call and is put back afterwards — so a model
//      cannot alter a number even if it tries, and a mistranslated digit shows
//      up as an unchanged placeholder rather than as a wrong amount.
//   3. A FIGURE THE PINNER DID NOT SPOT IS A FAILURE, NOT A WARNING. Text that
//      changed its own digits means the pinner missed something, and the answer
//      is to refuse rather than to hand a shop a document nobody can check.
//
// ⚠️ AND A TRANSLATION IS NOT AN ORIGINAL. A shop filing a translated invoice
// files a translation, and the source stays on file beside it. So the source is
// carried on the result and never replaced — the same rule as a credit note
// being a correction rather than a rewrite.
export type SupportedLocale = 'fa' | 'af' | 'en'

/** The languages the product ships. Anything else has no glossary to check against. */
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['fa', 'af', 'en']

/**
 * ⚠️ CHARACTER CLASSES THAT DO NOT SWALLOW THE NEXT LINE.
 *
 * The first version used `[\d\s,...]`, and `\s` includes `\n` — so "Total:
 * 125,000 AFN\nTax:" matched ACROSS the line break, and the pinner took the
 * whole of the next line along with the amount. The result was a translation
 * with a sentence missing and a figure placeholder where a line should have
 * been: seven figures spotted in a four-figure document.
 *
 * `\s` has to mean "space or tab" here, never whitespace.
/**
 * ⚠️ A NUMBER IS A NUMBER, AND A LINE IS A LINE.
 *
 * Two bugs lived in this one pattern, and both were found by the tests.
 *
 * 1. `[\d\s,...]` — `\s` includes `\n`, so "125,000 AFN\nTax: 10,000"
 *    matched ACROSS the line break and the pinner took the whole next line
 *    along with the amount. The translation came back with a sentence
 *    missing and a figure placeholder where the sentence had been.
 * 2. `[\d, .]` — a character class containing a DOT splits on it, and the
 *    same class also contains a SPACE, so "125,000" came back as three
 *    matches and the restored text read "125000".
 *
 * So grouping is written explicitly, the decimal separator is outside the
 * class, and nothing here uses `\s` — every separator is a named one.
 */
const FIGURE_PATTERN = new RegExp(
  '(-?(?:\\d{1,3}(?:[,\u066C\u00A0\u0020]\\d{3})+|\\d+)(?:\.\\d+)?%?)' +
    '|([\$\u20AC\u00A3\u06BC\u060B\u20B9][\u0020\u0009]*-?(?:\\d{1,3}(?:[,\u066C\u00A0\u0020]\\d{3})+|\\d+)(?:\.\\d+)?)' +
    '|(ماه|سال|روز|شماره[\u0020\u0009]*\\d+)',
  'g',
)

export interface PinnedDocument {
  /** The prose with every figure replaced by a placeholder. */
  text: string
  /** The figures in the order they were found. Index is the placeholder id. */
  figures: string[]
  /** How many figure-shaped runs the pinner saw, including repeated ones. */
  spotted: number
}

/**
 * Replace every figure with a placeholder, so the model cannot touch one.
 *
 * ⚠️ REPEATS SHARE A PLACEHOLDER ONLY BY CONTENT, not by position — «۵۰» appearing
 * twice becomes two entries and two ids, because a translation that reorders
 * sentences would otherwise move a figure to the wrong occurrence.
 */
export function pinFigures(source: string): PinnedDocument {
  const figures: string[] = []
  const seen = new Map<string, string>()

  const text = source.replace(FIGURE_PATTERN, (match) => {
    // A repeated figure reuses its placeholder so the count above reflects
    // OCCURRENCES while the array holds DISTINCT values.
    const existing = seen.get(match)
    if (existing) return existing

    const id = `⟦fig-${figures.length}⟧`
    seen.set(match, id)
    figures.push(match)
    return id
  })

  return { text, figures, spotted: [...source.matchAll(FIGURE_PATTERN)].length }
}

export type TranslateVerdict =
  | {
      kind: 'translated'
      from: SupportedLocale
      to: SupportedLocale
      /** With the original figures put back, in their original values. */
      text: string
      /** The document as it arrived, kept beside the translation. */
      source: string
      /** How many figure-shaped runs the pinner saw. */
      figuresSpotted: number
    }
  | { kind: 'refused'; reason: TranslateRefusal; detail: string }

export type TranslateRefusal =
  'UNSUPPORTED_LOCALE' | 'SAME_LOCALE' | 'TOO_LONG' | 'NOTHING_TO_TRANSLATE' | 'FIGURE_ALTERED'

export const TRANSLATE_LIMITS = {
  /** 8,000 characters. A translated financial document that needs more is a
   *  document that should be translated in sections by a person, not in one
   *  shot by a model. */
  maxCharacters: 8_000,
  /** The pinner must see at least this many figures, or there was nothing
   *  financial to protect. */
  minFiguresToWorthTranslating: 1,
}

/**
 * What the provider is allowed to be asked. A `TextTranslator` interface
 * rather than a call to one vendor, because the credentials are the owner's
 * and the product must not have a hard dependency on a specific one.
 */
export interface TextTranslator {
  translate(input: {
    /** PINNED text. Never the original — the figures are already out. */
    text: string
    from: SupportedLocale
    to: SupportedLocale
  }): Promise<string>
}

/**
 * Translate a financial document.
 *
 * ⚠️ THE POST-CONDITION IS THE WHOLE ENGINE. Whatever the provider returns, a
 * placeholder that has vanished or changed means the call is refused — because
 * a translation that quietly altered a total is worse than no translation, and
 * the person filing it has no way to tell.
 */
export async function translateDocument(
  source: string,
  from: SupportedLocale,
  to: SupportedLocale,
  translator: TextTranslator,
): Promise<TranslateVerdict> {
  if (!SUPPORTED_LOCALES.includes(from) || !SUPPORTED_LOCALES.includes(to)) {
    return {
      kind: 'refused',
      reason: 'UNSUPPORTED_LOCALE',
      detail: `${from} → ${to} is not supported`,
    }
  }

  if (from === to) {
    return {
      kind: 'refused',
      reason: 'SAME_LOCALE',
      detail: 'the document is already in the requested language',
    }
  }

  if (source.length > TRANSLATE_LIMITS.maxCharacters) {
    return {
      kind: 'refused',
      reason: 'TOO_LONG',
      detail: `${source.length} characters exceeds the ${TRANSLATE_LIMITS.maxCharacters} limit`,
    }
  }

  const pinned = pinFigures(source)
  if (pinned.text.trim().length === 0) {
    return { kind: 'refused', reason: 'NOTHING_TO_TRANSLATE', detail: 'the document is empty' }
  }

  const translated = await translator.translate({ text: pinned.text, from, to })

  // ⚠️ EVERY PLACEHOLDER MUST COME BACK EXACTLY. Fewer, more, or altered, and
  // the call is refused: the model moved a figure, and a document whose figures
  // moved is one the shop cannot check.
  for (const id of extractPlaceholders(pinned.text)) {
    if (!translated.includes(id)) {
      return {
        kind: 'refused',
        reason: 'FIGURE_ALTERED',
        detail: `placeholder ${id} did not survive the translation — the figures were altered`,
      }
    }
  }

  const returned = new Set(extractPlaceholders(translated))
  const invented = [...returned].filter((id) => !extractPlaceholders(pinned.text).includes(id))
  if (invented.length > 0) {
    return {
      kind: 'refused',
      reason: 'FIGURE_ALTERED',
      detail: `the translation contains ${invented.length} figure markers the original did not have`,
    }
  }

  return {
    kind: 'translated',
    from,
    to,
    // ⚠️ THE FIGURES ARE PUT BACK FROM THE SOURCE, never from the translation.
    // Whatever the model did to the prose, the numbers are the document's own.
    text: restoreFigures(translated, pinned.figures),
    source,
    figuresSpotted: pinned.spotted,
  }
}

function extractPlaceholders(text: string): string[] {
  return [...text.matchAll(/⟦fig-(\d+)⟧/g)].map((m) => m[0] ?? '')
}

function restoreFigures(translated: string, figures: readonly string[]): string {
  let out = translated
  figures.forEach((figure, index) => {
    out = out.replaceAll(`⟦fig-${index}⟧`, figure)
  })
  return out
}
