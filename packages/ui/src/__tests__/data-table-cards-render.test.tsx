// The cards and the pager, rendered: a phone-width screen sees cards, never
// the table; 25 rows become pages of 10.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () =>
    Object.assign((key: string) => key, { raw: () => undefined, has: () => false }),
  useLocale: () => 'fa',
}))

import { DataTable } from '../components/ui/data-table/data-table'
import type { TableColumn } from '../components/ui/data-table/table-types'

type Row = { id: string; name: string; qty: number }
const rows: Row[] = Array.from({ length: 25 }, (_, i) => ({
  id: `r${i}`,
  name: `کالا ${i}`,
  qty: i,
}))
const columns: TableColumn<Row>[] = [
  { id: 'name', labelKey: 'name', labelFallback: 'نام', render: (r) => r.name },
  { id: 'qty', labelKey: 'qty', labelFallback: 'مقدار', render: (r) => String(r.qty) },
]
const t = (_key: string, fallback?: string) => fallback ?? _key

function setWidth(narrow: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: narrow,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('DataTable on a phone', () => {
  it('renders cards (no table) and pages them 10 at a time', async () => {
    setWidth(true)
    await act(async () => {
      render(
        <DataTable tableId="t-cards" t={t} rows={rows} columns={columns} rowKey={(r) => r.id} />,
      )
    })
    expect(document.querySelector('table')).toBeNull()
    expect(document.querySelectorAll('[data-table-cards] > li')).toHaveLength(10)
    expect(screen.getByText('1 / 3')).toBeTruthy()

    fireEvent.click(screen.getByText('بعدی'))
    expect(screen.getByText('2 / 3')).toBeTruthy()
    expect(screen.getByText('کالا 10')).toBeTruthy()
  })

  it('a wide screen keeps the table — and the same pager', async () => {
    setWidth(false)
    await act(async () => {
      render(
        <DataTable tableId="t-table" t={t} rows={rows} columns={columns} rowKey={(r) => r.id} />,
      )
    })
    expect(document.querySelector('[data-table-cards]')).toBeNull()
    expect(document.querySelectorAll('tbody tr')).toHaveLength(10)
  })

  it('paginate={false}: every row, no pager', async () => {
    setWidth(false)
    await act(async () => {
      render(
        <DataTable
          tableId="t-off"
          paginate={false}
          t={t}
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
        />,
      )
    })
    expect(document.querySelectorAll('tbody tr')).toHaveLength(25)
    expect(document.querySelector('[data-table-pager]')).toBeNull()
  })
})

describe('the Android card (owner’s mock-up)', () => {
  it('the row’s tone is the card’s edge; cells are label over value, two by two', async () => {
    setWidth(true)
    await act(async () => {
      render(
        <DataTable
          tableId="t-tone"
          t={t}
          rows={rows.slice(0, 2)}
          columns={columns}
          rowKey={(r) => r.id}
          cardTone={(r) => (r.qty === 0 ? 'destructive' : 'success')}
        />,
      )
    })
    const cards = [...document.querySelectorAll('[data-table-cards] > li')]
    expect(cards.map((c) => c.getAttribute('data-card-tone'))).toEqual(['destructive', 'success'])
    // «مقدار» is a label (dt) over its value (dd) inside the grid
    const dt = cards[1]!.querySelector('dl dt')!
    expect(dt.textContent).toBe('مقدار')
    expect(dt.nextElementSibling?.textContent).toBe('1')
  })
})
