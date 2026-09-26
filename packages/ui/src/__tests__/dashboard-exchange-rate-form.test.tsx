// #38 (owner's request, 26 Sep 2026): the dashboard rate is entered as a pair
// — «هر ۳٬۰۰۰ افغانی = ۱٬۰۰۰٬۰۰۰ تومان» — and stored as base per one unit.
// «اصلاح قیمت» opens on the currency being displayed. Display only.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'fa',
}))

const { ExchangeRateForm } = await import('../components/ui/dashboard/display-basis-picker')

afterEach(cleanup)

function amounts(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLInputElement>('input[type="number"]')]
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
})
