// Request #102 — the refused field gets the message AND the cursor.
import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { focusField, useServerFieldErrors } from '../use-server-field-errors'

const axiosError = (data: unknown) =>
  Object.assign(new Error('Request failed with status code 400'), { response: { data } })

/**
 * Renders the hook and hands its value back.
 *
 * ⚠️ `report` is read through `seen.current` AFTER an `act()`, because the
 * state it sets only reaches the caller on the next render — reading the old
 * object back would assert on the value before the update.
 */
function harness() {
  const seen: { current: ReturnType<typeof useServerFieldErrors> | null } = { current: null }
  function Probe() {
    seen.current = useServerFieldErrors()
    return null
  }
  const view = render(<Probe />)
  return { seen, view }
}

describe('focusField', () => {
  it('finds the control by name and puts the cursor in it', () => {
    const { container } = render(
      <div>
        <input name="email" />
      </div>,
    )
    const input = container.querySelector<HTMLInputElement>('[name="email"]')!
    // jsdom has no layout, so scrollIntoView is not implemented there.
    input.scrollIntoView = vi.fn()

    expect(focusField('email', container)).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(input.scrollIntoView).toHaveBeenCalled()
  })

  it('falls back to id, then to data-field', () => {
    const { container } = render(
      <div>
        <input id="branchId" />
        <div data-field="lines.0.quantity" />
      </div>,
    )
    for (const node of container.querySelectorAll<HTMLElement>('*')) {
      node.scrollIntoView = vi.fn()
    }
    expect(focusField('branchId', container)).toBe(true)
    expect(focusField('lines.0.quantity', container)).toBe(true)
  })

  it('says so rather than throwing when the field is not on the page', () => {
    const { container } = render(<div />)
    expect(focusField('nowhere', container)).toBe(false)
  })
})

describe('useServerFieldErrors', () => {
  it('puts a named refusal on the field and leaves the banner empty', () => {
    const { seen } = harness()
    act(() => {
      seen.current!.report(
        axiosError({ details: [{ path: ['body', 'email'], message: 'Invalid email' }] }),
        'fallback',
      )
    })
    expect(seen.current!.fields).toEqual({ email: 'Invalid email' })
    // The field says it; repeating it above the form says it twice.
    expect(seen.current!.formError).toBeNull()
  })

  it('uses the banner when no field can be blamed', () => {
    const { seen } = harness()
    act(() => {
      seen.current!.report(axiosError({ error: 'Internal Server Error' }), 'fallback')
    })
    expect(seen.current!.fields).toEqual({})
    expect(seen.current!.formError).toBe('Internal Server Error')
  })

  it('reset clears both, so a fixed field stops looking broken', () => {
    const { seen } = harness()
    act(() => {
      seen.current!.report(axiosError({ message: 'body/email must match format "email"' }), 'f')
    })
    expect(Object.keys(seen.current!.fields)).toEqual(['email'])
    act(() => {
      seen.current!.reset()
    })
    expect(seen.current!.fields).toEqual({})
    expect(seen.current!.formError).toBeNull()
  })
})
