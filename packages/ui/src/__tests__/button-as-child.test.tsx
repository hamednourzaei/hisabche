// «Slot failed to slot onto its children» on /admin/blog: Button asChild
// rendered `{loading && …}{children}` — two children for Radix Slot.
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Button } from '../components/ui/button'

afterEach(cleanup)

describe('Button asChild', () => {
  it('renders its single child as the button, without throwing', () => {
    const { container } = render(
      <Button asChild>
        <a href="/fa/blog/new">new</a>
      </Button>,
    )
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('/fa/blog/new')
    expect(link?.className).toContain('inline-flex')
  })

  it('a plain button still shows the loading spinner', () => {
    const { container } = render(<Button loading>save</Button>)
    expect(container.querySelector('button svg')).not.toBeNull()
  })
})
