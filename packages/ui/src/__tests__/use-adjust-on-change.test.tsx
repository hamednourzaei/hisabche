// useAdjustOnChange — the render-time replacement for «setState in an effect» (13 Nov 2026).
import { useState } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAdjustOnChange } from '../hooks/use-adjust-on-change'

afterEach(() => cleanup())

const rendered = vi.fn()
function Form({ open, initial }: { open: boolean; initial: string }) {
  rendered()
  const [name, setName] = useState('typed by hand')
  useAdjustOnChange([open], () => {
    if (open) setName(initial)
  })
  return <span data-testid="name">{name}</span>
}

describe('useAdjustOnChange', () => {
  it('applies on the first render, with no stale frame', () => {
    render(<Form open initial="saved" />)
    expect(screen.getByTestId('name').textContent).toBe('saved')
  })

  it('applies when a dep changes, and not on an unrelated re-render', () => {
    const { rerender } = render(<Form open={false} initial="saved" />)
    expect(screen.getByTestId('name').textContent).toBe('typed by hand')
    rerender(<Form open initial="saved" />)
    expect(screen.getByTestId('name').textContent).toBe('saved')
    // `initial` is not a dep: changing it while open keeps what is on screen
    rerender(<Form open initial="other" />)
    expect(screen.getByTestId('name').textContent).toBe('saved')
  })

  it('does not loop: a change costs one extra render, not a cascade', () => {
    rendered.mockClear()
    const { rerender } = render(<Form open={false} initial="x" />)
    const afterMount = rendered.mock.calls.length
    act(() => rerender(<Form open initial="x" />))
    expect(rendered.mock.calls.length - afterMount).toBeLessThanOrEqual(2)
  })
})
