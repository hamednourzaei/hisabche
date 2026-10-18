// Owner, 18 Oct 2026: below tablet width every table is cards like
// /activities, with full pagination — on every page.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { pageSlice } from '../components/ui/data-table/data-table'
import { cardLayout } from '../components/ui/data-table/data-table-cards'

const ui = join(__dirname, '..', 'components', 'ui')
const read = (p: string) => readFileSync(join(ui, p), 'utf8').split(/\s+/).join(' ')

describe('DataTable — cards below md', () => {
  it('renders the cards below md and the table from md up, from the same columns', () => {
    const src = read('data-table/data-table.tsx')
    // ONE of the two is rendered — never both hidden by CSS (rows drawn twice).
    expect(src).toContain('{cards ? ( <DataTableCards')
    expect(src).not.toContain('md:hidden')
    expect(src).toContain("'(max-width: 767px)'")
    expect(src).toContain('columns={state.visibleColumns}')
  })

  it('a card: first column the title, 3 in the summary, the rest behind the chevron, actions at the foot', () => {
    const col = (id: string) => ({ id, labelKey: id, labelFallback: id, render: () => id })
    const layout = cardLayout(['name', 'a', 'b', 'c', 'd', 'actions', 'e'].map(col))
    expect(layout.title?.id).toBe('name')
    expect(layout.summary.map((c) => c.id)).toEqual(['a', 'b', 'c'])
    expect(layout.more.map((c) => c.id)).toEqual(['d', 'e'])
    expect(layout.actions.map((c) => c.id)).toEqual(['actions'])
  })
})

describe('DataTable — the pager', () => {
  it('slices and clamps', () => {
    expect(pageSlice(45, 1, 10)).toEqual({ page: 1, pageCount: 5, start: 0, end: 10 })
    expect(pageSlice(45, 5, 10)).toEqual({ page: 5, pageCount: 5, start: 40, end: 45 })
    // a filter shrank the rows under the open page
    expect(pageSlice(3, 4, 10)).toEqual({ page: 1, pageCount: 1, start: 0, end: 3 })
    expect(pageSlice(0, 1, 10).pageCount).toBe(1)
  })

  it('pages that page from the server opt out — never two pagers', () => {
    for (const file of [
      'invoices/invoices-view.tsx',
      'orders/orders-view.tsx',
      'products/product-list-view.tsx',
    ]) {
      expect(read(file), file).toContain('<DataTable paginate={false}')
    }
  })
})
