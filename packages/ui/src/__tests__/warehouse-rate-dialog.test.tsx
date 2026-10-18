// Warehouse currency chips. 27 Sep 2026: no rate form open in the middle of the
// page. 18 Oct 2026 (owner): a «+» beside the chips adds a currency or unit, up
// to five, and every chip opens THE DASHBOARD'S rate form — the shared
// ExchangeRateDialog, mounted by the container. The view only says which code.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'fa' }))

const { WarehouseView, MAX_CHIPS } = await import('../components/ui/warehouse/warehouse-view')

afterEach(cleanup)

const t = (_key: string, fallback?: string) => fallback ?? _key
const two = [
  { code: 'USD', label: 'دالر', rate: 1 / 75, afnPerUnit: 75 },
  { code: 'IRT', label: 'تومان', rate: null, afnPerUnit: null },
]

function renderView(currencies = two, onOpenRate = vi.fn()) {
  render(
    <WarehouseView
      t={t}
      fmt={(v) => String(Math.round(v))}
      search=""
      onSearchChange={() => undefined}
      onOpenAddModal={() => undefined}
      deletingId={null}
      products={[]}
      isLoading={false}
      summary={{ productCount: 3, totalValue: 7500, lowStockCount: 0, outOfStockCount: 0 }}
      currencies={currencies}
      onOpenRate={onOpenRate}
      onNavigate={() => undefined}
      onDelete={() => undefined}
      stockStatus={() => 'success'}
      stockLabel={() => ''}
    />,
  )
  return onOpenRate
}

describe('warehouse currency chips → the shared rate form', () => {
  it('no rate form on the page; afghani is a label, not a button', () => {
    renderView()
    expect(document.querySelector('[data-rate-form]')).toBeNull()
    expect(screen.queryByRole('button', { name: /افغانی/ })).toBeNull()
  })

  it('a chip opens the form on its code; «+» opens it empty', () => {
    const onOpenRate = renderView()
    fireEvent.click(screen.getByRole('button', { name: /دالر/ }))
    expect(onOpenRate).toHaveBeenLastCalledWith('USD')
    fireEvent.click(document.querySelector('[data-add-rate]')!)
    expect(onOpenRate).toHaveBeenLastCalledWith(null)
  })

  it('up to five: no «+» once five are shown, and never more than five chips', () => {
    const many = ['USD', 'EUR', 'IRT', 'PKR', 'unit:ماشین', 'GBP'].map((code) => ({
      code,
      label: code,
      rate: 1,
      afnPerUnit: 1,
    }))
    expect(MAX_CHIPS).toBe(5)
    renderView(many)
    expect(document.querySelector('[data-add-rate]')).toBeNull()
    expect(document.querySelectorAll('[data-currency-chips] button')).toHaveLength(5)
  })

  it('the container mounts the dashboard dialog, not a form of its own', () => {
    const src = readFileSync(
      join(__dirname, '../components/ui/warehouse/containers/Warehouse-container.tsx'),
      'utf8',
    )
    expect(src).toContain('<ExchangeRateDialog')
    const view = readFileSync(
      join(__dirname, '../components/ui/warehouse/warehouse-view.tsx'),
      'utf8',
    )
    expect(view).not.toContain('function RateDialog')
  })
})
