// #38 (owner's request, 26 Sep 2026): the dashboard rate is entered as a pair
// — «هر ۳٬۰۰۰ افغانی = ۱٬۰۰۰٬۰۰۰ تومان» — and stored as base per one unit.
// «اصلاح قیمت» opens on the currency being displayed. Display only.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () =>
    Object.assign((key: string) => key, { raw: () => undefined, has: () => false }),
  useLocale: () => 'fa',
}))

const { ExchangeRateForm } = await import('../components/ui/dashboard/display-basis-picker')

afterEach(cleanup)

function amounts(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]')]
}

describe('ExchangeRateForm (pair)', () => {
  it('«70 AFN = 1 USD» is stored as 70 base per dollar', () => {
    const onSave = vi.fn()
    const { container } = render(
      <ExchangeRateForm base="AFN" currencies={['USD', 'IRT']} onSave={onSave} />,
    )
    const [left, right] = amounts(container)
    fireEvent.change(left!, { target: { value: '70' } })
    fireEvent.change(right!, { target: { value: '1' } })
    fireEvent.submit(container.querySelector('form')!)
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ currency: 'USD', rate: 70 }))
  })

  it('«اصلاح قیمت» starts on the displayed currency: «1 USD = 72 AFN» → 72', () => {
    const onSave = vi.fn()
    const { container } = render(
      <ExchangeRateForm
        base="AFN"
        currencies={['USD', 'IRT']}
        initialCurrency="USD"
        onSave={onSave}
      />,
    )
    const [, right] = amounts(container)
    fireEvent.change(right!, { target: { value: '72' } })
    fireEvent.submit(container.querySelector('form')!)
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ currency: 'USD', rate: 72 }))
  })

  it('an empty side is refused with a message, nothing is saved', () => {
    const onSave = vi.fn()
    const { container, getByRole } = render(
      <ExchangeRateForm base="AFN" currencies={['USD']} onSave={onSave} />,
    )
    fireEvent.submit(container.querySelector('form')!)
    expect(onSave).not.toHaveBeenCalled()
    expect(getByRole('alert').textContent).toContain('بزرگ‌تر از صفر')
  })
})

describe('a unit the business names itself (live audit #82)', () => {
  it('«+» makes a new unit, like the product form; Persian digits are read', () => {
    const onSaveUnit = vi.fn()
    const { container } = render(
      <ExchangeRateForm base="AFN" currencies={['USD']} onSave={vi.fn()} onSaveUnit={onSaveUnit} />,
    )
    expect(container.textContent).not.toContain('هزار')
    expect(container.textContent).not.toContain('میلیون')
    // «افزودن دلخواه» — one card under the two sides (owner's design, 18 Oct 2026)
    const plus = container.querySelector('[data-new-unit]')!
    fireEvent.click(plus)
    const name = container.querySelector<HTMLInputElement>(
      '[data-rate-side="left"] input[maxlength="40"]',
    )!
    fireEvent.change(name, { target: { value: 'یخچال' } })
    const [left, right] = amounts(container)
    fireEvent.change(left!, { target: { value: '۱' } })
    fireEvent.change(right!, { target: { value: '۲۵٬۰۰۰' } })
    fireEvent.submit(container.querySelector('form')!)
    expect(onSaveUnit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'یخچال', perUnit: 25000 }),
    )
  })

  it('«1 ماشین = 500,000 AFN» is saved as a unit, not as a currency', () => {
    const onSave = vi.fn()
    const onSaveUnit = vi.fn()
    const { container } = render(
      <ExchangeRateForm
        base="AFN"
        currencies={['USD']}
        customUnits={['ماشین']}
        onSave={onSave}
        onSaveUnit={onSaveUnit}
        initialCurrency="unit:ماشین"
      />,
    )
    const [left, right] = amounts(container)
    fireEvent.change(left!, { target: { value: '1' } })
    fireEvent.change(right!, { target: { value: '500000' } })
    fireEvent.submit(container.querySelector('form')!)
    expect(onSave).not.toHaveBeenCalled()
    expect(onSaveUnit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ماشین', perUnit: 500000 }),
    )
  })

  it('one row per side (it lives in a dialog now) and the date is the reader’s calendar', () => {
    const { container } = render(
      <ExchangeRateForm base="AFN" currencies={['USD']} onSave={vi.fn()} />,
    )
    expect(container.querySelector('input[type="date"]')).toBeNull()
    expect(container.querySelector('[data-rate-side="left"]')).not.toBeNull()
    expect(container.querySelector('[data-rate-side="right"]')).not.toBeNull()
  })
})

describe('measures (owner, 18 Oct 2026): kilogram of gold, million toman', () => {
  it('stored units: gold per gram, a currency per one, a named unit per piece', async () => {
    const { inStoredUnit, measuresFor, namedUnit } = await import('../lib/rate-measures')
    expect(measuresFor('XAU')[0]!.id).toBe('gram')
    expect(inStoredUnit(1, 'XAU', 'kilogram')).toBe(1000)
    expect(inStoredUnit(2, 'XAG', 'ton')).toBe(2_000_000)
    expect(inStoredUnit(1, 'XAU', 'mithqal')).toBeCloseTo(4.608)
    // «واحد» is what is priced, never «هزار/میلیون» of money: a currency has one measure.
    expect(measuresFor('IRT').map((m) => m.id)).toEqual(['one'])
    expect(inStoredUnit(3, 'IRT', 'million')).toBe(3)
    expect(namedUnit('یخچال', 'device', { kilogram: 'کیلوگرم', own: '' })).toBe('یخچال')
    // A named unit: by count, by weight (kept per kilogram), or the person's own measure.
    expect(measuresFor('unit:آهن').map((m) => m.id)).toEqual([
      'piece',
      'device',
      'kilogram',
      'gram',
      'ton',
      '__own__',
    ])
    expect(inStoredUnit(1, 'unit:آهن', 'ton')).toBe(1000)
    // Already saved with its measure in the name: quoted as saved, not nested.
    expect(measuresFor('unit:آهن (کیلوگرم)').map((m) => m.id)).toEqual(['piece'])
    expect(inStoredUnit(5, 'USD', 'nonsense')).toBe(5)
  })

  it('the name a named unit is saved under carries its measure', async () => {
    const { namedUnit } = await import('../lib/rate-measures')
    const labels = { kilogram: 'کیلوگرم', own: 'بشکه' }
    expect(namedUnit('ماشین', 'piece', labels)).toBe('ماشین')
    expect(namedUnit('آهن', 'ton', labels)).toBe('آهن (کیلوگرم)')
    expect(namedUnit('نفت', '__own__', labels)).toBe('نفت (بشکه)')
    expect(namedUnit('نفت', '__own__', { kilogram: 'کیلوگرم', own: '' })).toBe('نفت')
  })

  it('gold opens on GRAMS (its stored unit): «1 gram = 2,400,000 AFN» → 2,400,000', () => {
    const onSave = vi.fn()
    const { container } = render(
      <ExchangeRateForm base="AFN" currencies={['XAU']} initialCurrency="XAU" onSave={onSave} />,
    )
    const [l, r] = amounts(container)
    fireEvent.change(l!, { target: { value: '1' } })
    fireEvent.change(r!, { target: { value: '2400000' } })
    fireEvent.submit(container.querySelector('form')!)
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'XAU', rate: 2_400_000 }),
    )
  })

  it('both sides go through inStoredUnit before the pair becomes a rate', () => {
    const form = readFileSync(
      resolve(__dirname, '../components/ui/dashboard/display-basis-picker.tsx'),
      'utf8',
    )
    expect(form).toContain(
      'amount: inStoredUnit(typedNumber(leftAmount) ?? 0, leftCode, leftMeasure)',
    )
    expect(form).toContain(
      'amount: inStoredUnit(typedNumber(rightAmount) ?? 0, rightCode, rightMeasure)',
    )
  })
})

describe('dashboard container wiring', () => {
  const src = readFileSync(
    resolve(__dirname, '../components/ui/dashboard/containers/dashboard-container.tsx'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')

  it('the button says «تبادل نرخ داشبورد», and «اصلاح قیمت» appears only off the base', () => {
    expect(src).toContain("t('display.exchangeButton'")
    expect(src).toContain('display.basis !== display.base ?')
    expect(src).toContain("initialCurrency={rateOpen === 'edit' ? display.basis : undefined}")
  })

  it('the rate form opens in a dialog, not as a strip pushing the dashboard down', () => {
    // One dialog for every page that records a rate (dashboard + warehouse, 18 Oct 2026).
    expect(src).toContain('<ExchangeRateDialog')
    expect(src).toContain('open={rateOpen !== null}')
    const shared = readFileSync(
      resolve(__dirname, '../components/ui/dashboard/exchange-rate-dialog.tsx'),
      'utf8',
    )
    expect(shared).toContain('<DialogContent')
    expect(shared).toContain('<ExchangeRateForm')
    expect(src).not.toContain("aria-expanded={rateOpen === 'new'}")
  })
})

describe('the dialog design (owner, 18 Oct 2026): swap, live rate, cancel', () => {
  it('«⇄» swaps the two sides — codes and amounts — and the saved rate is the same', () => {
    const onSave = vi.fn()
    const { container } = render(
      <ExchangeRateForm base="AFN" currencies={['USD']} onSave={onSave} />,
    )
    const [left, right] = amounts(container)
    fireEvent.change(left!, { target: { value: '65' } })
    fireEvent.change(right!, { target: { value: '1' } })
    fireEvent.click(container.querySelector('[data-rate-swap]')!)
    const [l2, r2] = amounts(container)
    expect(l2!.value).toBe('1')
    expect(r2!.value).toBe('65')
    fireEvent.submit(container.querySelector('form')!)
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ currency: 'USD', rate: 65 }))
  })

  it('shows the rate it will save, live: «1 USD = 65 AFN»; nothing until both sides are filled', () => {
    const { container } = render(
      <ExchangeRateForm base="AFN" currencies={['USD']} initialCurrency="USD" onSave={vi.fn()} />,
    )
    const preview = () => container.querySelector('[data-rate-preview]')!.textContent ?? ''
    expect(preview()).toContain('—')
    const [, right] = amounts(container)
    fireEvent.change(right!, { target: { value: '۶۵' } })
    expect(preview()).toContain('1 USD = 65 AFN')
  })

  it('«انصراف» closes without saving', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    const { getByText } = render(
      <ExchangeRateForm base="AFN" currencies={['USD']} onSave={onSave} onCancel={onCancel} />,
    )
    fireEvent.click(getByText('انصراف'))
    expect(onCancel).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('no «نوع تبدیل» picker — the product keeps one kind of rate (G1: no control that changes nothing)', () => {
    const form = readFileSync(
      resolve(__dirname, '../components/ui/dashboard/display-basis-picker.tsx'),
      'utf8',
    )
    expect(form).not.toContain("'نوع تبدیل'")
  })
})
