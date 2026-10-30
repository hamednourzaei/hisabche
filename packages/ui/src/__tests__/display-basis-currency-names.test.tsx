// @vitest-environment jsdom
// ============================================
// B6 (live audit, 28 Oct 2026): the currency names in the display-basis picker
// and the exchange-rate form came from a Persian-only `LABEL` table in
// display-basis-picker.tsx, so the ENGLISH and DARI screens offered
// «افغانی · دالر · تومان». On the one control that decides what every figure on
// the dashboard means, a reader who cannot read Persian could not tell which
// unit they were looking at.
//
// The names now come from the bundle (`currency.*`, `metal.*`) through
// `nameOfCurrency`, and the afghani's sign through `currencySign(code, locale)`.
// This test reads the REAL catalogs, so a key that goes missing fails here
// rather than printing Persian on an English page.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { ReactNode } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const localeState = vi.hoisted(() => ({ current: 'en' }))

vi.mock('next-intl', () => ({
  useLocale: () => localeState.current,
  useTranslations: () =>
    Object.assign((key: string) => key, { raw: () => undefined, has: () => false }),
}))

// The real SelectField is a Radix list whose options exist only while it is
// open; a plain <select> puts every label in the DOM, which is what is read.
vi.mock('../components/ui/select-field', () => ({
  SelectField: (p: { options: readonly { value: string; label: ReactNode }[] }) => (
    <select>
      {p.options.map((option) => (
        <option key={option.value} value={option.value}>
          {typeof option.label === 'string' ? option.label : option.value}
        </option>
      ))}
    </select>
  ),
}))

const { ExchangeRateForm } = await import('../components/ui/dashboard/display-basis-picker')

const catalogOf = (locale: 'en' | 'fa'): unknown =>
  JSON.parse(
    readFileSync(join(__dirname, '../../../i18n/messages', locale, 'common.json'), 'utf8'),
  ) as unknown

const lookup = (catalog: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], catalog)

/** The screen's translator, resolved against the real catalog. */
const translator = (locale: 'en' | 'fa') => {
  const catalog = catalogOf(locale)
  return (key: string, fallback?: string): string => {
    const found = lookup(catalog, key)
    return typeof found === 'string' ? found : (fallback ?? key)
  }
}

/** Persian, Arabic and their presentation forms. */
const PERSIAN_OR_ARABIC = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/

const optionLabels = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('option')].map((option) => option.textContent ?? '')

afterEach(cleanup)

describe('currency names in the display-basis controls (B6)', () => {
  it('English names currencies in English: no Persian script on the English screen', () => {
    localeState.current = 'en'
    const { container } = render(
      <ExchangeRateForm
        t={translator('en')}
        base="AFN"
        currencies={['USD', 'IRT']}
        onSave={vi.fn()}
      />,
    )

    const labels = optionLabels(container)
    expect(labels).toContain('Afghan afghani — your books’ currency')
    expect(labels).toContain('US dollar ($)')
    expect(labels).toContain('Iranian toman')
    expect(labels.filter((label) => PERSIAN_OR_ARABIC.test(label))).toEqual([])
  })

  it('Persian keeps the Persian names the reader already knows', () => {
    localeState.current = 'fa'
    const { container } = render(
      <ExchangeRateForm
        t={translator('fa')}
        base="AFN"
        currencies={['USD', 'IRT']}
        onSave={vi.fn()}
      />,
    )

    const labels = optionLabels(container)
    expect(labels).toContain('افغانی — ارز دفاتر')
    expect(labels).toContain('دالر ($)')
    expect(labels).toContain('تومان')
  })
})
