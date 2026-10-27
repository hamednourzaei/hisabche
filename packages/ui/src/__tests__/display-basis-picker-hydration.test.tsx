// @vitest-environment jsdom
// React #418 on the dashboard: the picker existed on the first client render
// (rates restored from the persisted query cache) but not in the server HTML.
import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../components/ui/select-field', () => ({
  SelectField: (p: { 'aria-label'?: string }) => <select aria-label={p['aria-label']} />,
}))

import { DisplayBasisPicker } from '../components/ui/dashboard/display-basis-picker'

const props = {
  base: 'AFN',
  basis: 'AFN',
  available: ['AFN', 'USD'],
  onChange: () => {},
}

describe('DisplayBasisPicker hydration', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders nothing on the server even when rates are available', () => {
    expect(renderToString(<DisplayBasisPicker {...props} />)).toBe('')
  })

  it('hydrates server HTML without a mismatch, then shows the picker', async () => {
    const errors: string[] = []
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.map(String).join(' '))
    })
    const container = document.createElement('div')
    container.innerHTML = renderToString(<DisplayBasisPicker {...props} />)
    document.body.appendChild(container)

    await act(async () => {
      hydrateRoot(container, <DisplayBasisPicker {...props} />, {
        onRecoverableError: (e) => errors.push(String(e)),
      })
    })

    expect(errors.filter((e) => /hydrat|418/i.test(e))).toEqual([])
    expect(container.querySelector('[aria-label]')).not.toBeNull()
  })
})
