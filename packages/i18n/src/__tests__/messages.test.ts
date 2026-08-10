// ============================================
// The message catalogs are the single source of UI copy for web, desktop and
// mobile. These tests pin the resolution behaviour the desktop next-intl shim
// depends on, and guard locale parity so a string added for one language cannot
// ship missing in another.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  defaultMessageLocale,
  formatMessage,
  getMessages,
  messageCatalogs,
  resolveMessage,
  toMessageLocale,
  type MessageCatalog,
} from '../messages'

describe('toMessageLocale', () => {
  it.each([
    ['fa-IR', 'fa'],
    ['fa', 'fa'],
    ['fa-AF', 'af'],
    ['af', 'af'],
    ['en', 'en'],
  ])('maps %s to the %s catalog', (input, expected) => {
    expect(toMessageLocale(input)).toBe(expected)
  })

  it('keeps Dari separate from Iranian Persian', () => {
    // fa-AF has its own vocabulary — گدام vs انبار, بل vs فاکتور. Collapsing it
    // onto fa would silently show Afghan users the wrong words.
    expect(toMessageLocale('fa-AF')).not.toBe(toMessageLocale('fa-IR'))
  })

  it.each([[null], [undefined], [''], ['de'], ['ps']])(
    'falls back to the default locale for %s',
    (input) => {
      expect(toMessageLocale(input as string | null | undefined)).toBe(defaultMessageLocale)
    },
  )
})

describe('resolveMessage', () => {
  const catalog: MessageCatalog = {
    nav: { sell: 'فروش', nested: { deep: 'عمیق' } },
    empty: '',
  }

  it('resolves a dotted path', () => {
    expect(resolveMessage(catalog, 'nav.sell')).toBe('فروش')
    expect(resolveMessage(catalog, 'nav.nested.deep')).toBe('عمیق')
  })

  it('returns undefined for a missing key so callers can fall back', () => {
    expect(resolveMessage(catalog, 'nav.missing')).toBeUndefined()
    expect(resolveMessage(catalog, 'nope.at.all')).toBeUndefined()
  })

  it('returns undefined when the path stops on an object rather than a string', () => {
    // `t('nav')` must not render "[object Object]".
    expect(resolveMessage(catalog, 'nav')).toBeUndefined()
  })

  it('does not treat descending through a string as a match', () => {
    expect(resolveMessage(catalog, 'nav.sell.extra')).toBeUndefined()
  })

  it('preserves an intentionally empty string', () => {
    expect(resolveMessage(catalog, 'empty')).toBe('')
  })
})

describe('formatMessage', () => {
  it('substitutes named placeholders', () => {
    expect(formatMessage('سلام {name}', { name: 'مجید' })).toBe('سلام مجید')
  })

  it('substitutes numbers', () => {
    expect(formatMessage('{count} قلم', { count: 3 })).toBe('3 قلم')
  })

  it('leaves a placeholder intact when no value is supplied', () => {
    expect(formatMessage('سلام {name}', {})).toBe('سلام {name}')
    expect(formatMessage('سلام {name}')).toBe('سلام {name}')
  })

  it('substitutes every occurrence', () => {
    expect(formatMessage('{a}-{b}-{a}', { a: '1', b: '2' })).toBe('1-2-1')
  })
})

describe('catalog parity', () => {
  /** Every dotted path that resolves to a string. */
  function stringKeys(catalog: MessageCatalog, prefix = ''): string[] {
    return Object.entries(catalog).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key
      if (typeof value === 'string') return [path]
      if (typeof value === 'object' && value !== null) {
        return stringKeys(value as MessageCatalog, path)
      }
      return []
    })
  }

  // `landing.security.badge` is a legacy pass-through map left by an i18n
  // codemod: its keys are the source strings themselves, including the Persian
  // originals. Those are lookups, not translatable keys, and demanding the
  // English catalog carry Persian-keyed entries would be meaningless.
  const LEGACY_PASSTHROUGH_PREFIXES = ['landing.security.badge.']

  const faKeys = stringKeys(messageCatalogs.fa).filter(
    (key) => !LEGACY_PASSTHROUGH_PREFIXES.some((prefix) => key.startsWith(prefix)),
  )

  it('ships a non-empty catalog for every locale', () => {
    for (const [locale, catalog] of Object.entries(messageCatalogs)) {
      expect(stringKeys(catalog).length, `${locale} catalog is empty`).toBeGreaterThan(0)
    }
  })

  it.each(['af', 'en'] as const)('%s covers every key present in fa', (locale) => {
    const missing = faKeys.filter(
      (key) => resolveMessage(messageCatalogs[locale], key) === undefined,
    )

    expect(
      missing,
      `missing ${missing.length} keys in ${locale}: ${missing.slice(0, 20).join(', ')}`,
    ).toEqual([])
  })
})

describe('getMessages', () => {
  it('returns the catalog matching the platform language code', () => {
    expect(getMessages('fa-AF')).toBe(messageCatalogs.af)
    expect(getMessages('en')).toBe(messageCatalogs.en)
    expect(getMessages('fa-IR')).toBe(messageCatalogs.fa)
  })
})
