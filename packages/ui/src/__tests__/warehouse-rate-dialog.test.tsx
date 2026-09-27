// Warehouse currency chips (owner's request, 27 Sep 2026): no rate form open
// in the middle of the page; clicking a currency chip opens the project's
// Dialog on that currency, saving stores the rate and closes it. And the KPI's
// currency select is code-sized, not full width over the label.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'fa' }))

const { WarehouseView } = await import('../components/ui/warehouse/warehouse-view')

afterEach(cleanup)

const t = (_key: string, fallback?: string) => fallback ?? _key
const currencies = [
  { code: 'USD', label: 'دالر', rate: 1 / 75, afnPerUnit: 75 },
  { code: 'IRT', label: 'تومان', rate: null, afnPerUnit: null },
]

function renderView(onSetRate = vi.fn()) {
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
      onSetRate={onSetRate}
      onNavigate={() => undefined}
      onDelete={() => undefined}
      stockStatus={() => 'success'}
      stockLabel={() => ''}
    />,
  )
  return onSetRate
}

describe('warehouse currency chips → rate dialog', () => {
  it('no rate form is open on the page until a chip is clicked', () => {
    renderView()
    expect(document.querySelector('[data-rate-form]')).toBeNull()
    // Afghani is the base: a label, not a button.
    expect(screen.queryByRole('button', { name: /افغانی/ })).toBeNull()
  })

  it('clicking a currency opens the dialog on it, pre-filled with its rate', async () => {
    renderView()
    fireEvent.click(screen.getByRole('button', { name: /دالر/ }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('دالر')
    const [left, right] = Array.from(
      dialog.querySelectorAll('input[type="number"]'),
    ) as HTMLInputElement[]
    expect(left!.value).toBe('1')
    expect(right!.value).toBe('75')
  })

  it('saving stores the rate and closes the dialog', async () => {
    const onSetRate = renderView()
    fireEvent.click(screen.getByRole('button', { name: /دالر/ }))
    const dialog = await screen.findByRole('dialog')
    const [, right] = Array.from(
      dialog.querySelectorAll('input[type="number"]'),
    ) as HTMLInputElement[]
    fireEvent.change(right!, { target: { value: '750' } })
    fireEvent.submit(dialog.querySelector('form')!)
    expect(onSetRate).toHaveBeenCalledWith('USD', 750)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('an invalid rate keeps the dialog open with the reason', async () => {
    const onSetRate = renderView()
    fireEvent.click(screen.getByRole('button', { name: /تومان/ }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.submit(dialog.querySelector('form')!) // right side empty
    expect(onSetRate).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('بزرگ‌تر از صفر')
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})

describe('the KPI currency select is code-sized', () => {
  it('overrides SelectField’s full width and shrinks its arrow', () => {
    const src = readFileSync(
      join(__dirname, '../components/ui/warehouse/warehouse-view.tsx'),
      'utf8',
    )
    const kpiSelect =
      /aria-label=\{t\('warehouse\.showIn'[\s\S]*?className="([^"]+)"/.exec(src)?.[1] ?? ''
    expect(kpiSelect).toContain('w-auto')
    expect(kpiSelect).toContain('h-6')
    expect(kpiSelect).toContain('[&>svg]:size-3')
  })
})
