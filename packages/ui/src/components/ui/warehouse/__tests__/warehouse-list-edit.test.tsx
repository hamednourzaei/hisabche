// @vitest-environment jsdom
// ============================================
// The «ویرایش» button on every warehouse row — RENDERED, not just declared.
//
// A column added to a table people have already used can stay invisible if the
// table remembers its columns, so a source assertion is not proof here. This
// renders the real component and clicks the button.
//
// ⚠️ Queries go through the render's own `container`, not the global `screen`.
// Auto-cleanup is not enabled in this package's vitest config, so every test
// after the first would otherwise also see the previous test's copy of the
// table — and click the wrong one.
// ============================================
import { render, fireEvent, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { WarehouseListTable } from '../warehouse-list-table'

const t = (key: string, fallback?: string) => fallback ?? key
const fmt = (value: number) => String(value)
const summary = { productCount: 2, totalValue: 100, lowStockCount: 0, outOfStockCount: 0 }

function setup() {
  const onEdit = vi.fn()
  const onOpen = vi.fn()
  const { container } = render(
    <WarehouseListTable
      t={t}
      fmt={fmt}
      warehouses={[{ id: 'w1', name: 'انبار اصلی', location: 'کابل', isActive: true, summary }]}
      unassigned={summary}
      onOpen={onOpen}
      onAdd={() => {}}
      onEdit={onEdit}
    />,
  )
  return { onEdit, onOpen, view: within(container) }
}

describe('warehouse list — edit', () => {
  it('shows an edit button on a warehouse row and passes its name and location', () => {
    const { onEdit, onOpen, view } = setup()
    // One per real warehouse — never on the «بدون انبار» row.
    const buttons = view.getAllByRole('button', { name: 'ویرایش انبار' })
    expect(buttons).toHaveLength(1)

    fireEvent.click(buttons[0]!)
    expect(onEdit).toHaveBeenCalledWith({ id: 'w1', name: 'انبار اصلی', location: 'کابل' })
    // Editing must not also open the warehouse.
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('the row itself still opens the warehouse', () => {
    const { onOpen, view } = setup()
    const row = view.getAllByText('انبار اصلی')[0]!.closest('tr')
    fireEvent.click(row!)
    expect(onOpen).toHaveBeenCalledWith('w1')
  })
})

describe('the «عملیات» column', () => {
  it('is the LAST column, and the button sits under its own header', () => {
    const { view } = setup()
    const headers = view.getAllByRole('columnheader').map((cell) => cell.textContent?.trim() ?? '')
    expect(headers.at(-1)).toContain('عملیات')

    // Same column index in the row as the header, so the button is under it.
    const header = view.getAllByRole('columnheader').at(-1)!
    const headerIndex = [...header.parentElement!.children].indexOf(header)
    const button = view.getAllByRole('button', { name: 'ویرایش انبار' })[0]!
    const cell = button.closest('td')!
    expect([...cell.parentElement!.children].indexOf(cell)).toBe(headerIndex)
    // Header and cell are both end-aligned, so they line up.
    expect(header.className).toContain('text-end')
    expect(cell.className).toContain('text-end')
  })
})
