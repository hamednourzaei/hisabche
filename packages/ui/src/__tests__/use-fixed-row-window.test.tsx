// useFixedRowWindow — the data grid's row window (13 Nov 2026).
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useFixedRowWindow } from '../hooks/use-fixed-row-window'

afterEach(() => cleanup())

function List({ count }: { count: number }) {
  const rows = useFixedRowWindow(count, 48, 480, 2)
  return (
    <div data-testid="scroller" onScroll={rows.onScroll}>
      <span data-testid="total">{rows.totalSize}</span>
      <span data-testid="drawn">
        {rows.items.map((item) => `${item.index}@${item.start}`).join(',')}
      </span>
    </div>
  )
}

describe('useFixedRowWindow', () => {
  it('draws the first screen plus overscan, and sizes the whole list', () => {
    render(<List count={1000} />)
    expect(screen.getByTestId('total').textContent).toBe('48000')
    const drawn = screen.getByTestId('drawn').textContent?.split(',') ?? []
    expect(drawn[0]).toBe('0@0')
    // 480 / 48 = 10 visible, + 2 overscan below
    expect(drawn.at(-1)).toBe('12@576')
  })

  it('moves the window with the scroll offset', () => {
    render(<List count={1000} />)
    const scroller = screen.getByTestId('scroller')
    act(() => {
      Object.defineProperty(scroller, 'scrollTop', { value: 4800, configurable: true })
      fireEvent.scroll(scroller)
    })
    const drawn = screen.getByTestId('drawn').textContent?.split(',') ?? []
    expect(drawn[0]).toBe('98@4704')
    expect(drawn.at(-1)).toBe('112@5376')
  })

  it('never draws rows that do not exist', () => {
    render(<List count={3} />)
    expect(screen.getByTestId('drawn').textContent).toBe('0@0,1@48,2@96')
    render(<List count={0} />)
    expect(screen.getAllByTestId('drawn')[1]?.textContent).toBe('')
  })
})
