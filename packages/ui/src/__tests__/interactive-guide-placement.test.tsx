// ============================================
// The guide card (owner request, 8 Nov 2026): it waits for the person's
// record, points at its section in both reading directions, locks the page
// behind a spotlight, records what was read, and leads to the next page.
// ============================================

import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useAuthStore, useGuideStore } from '@hisabche/store'
import { GUIDE_CATALOG } from '@hisabche/ui-contract'
import { placeGuideCard, spotlightHole } from '../components/ui/guide/guide-placement'

const remote = vi.hoisted(() => ({
  state: { isSuccess: true, isError: false, data: { configured: true, steps: [] as unknown[] } },
  saved: [] as unknown[],
  pushed: [] as string[],
  mutation: { mutate: (steps: unknown) => void remote.saved.push(steps) },
}))

vi.mock('next-intl', () => ({ useLocale: () => 'fa' }))
vi.mock('@hisabche/api', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useGuideProgress: () => remote.state,
  // Stable, as TanStack's `mutate` is.
  useMarkGuideStepsSeen: () => remote.mutation,
}))
vi.mock('../hooks/use-locale-push', () => ({
  useLocalePush: () => (path: string) => remote.pushed.push(path),
}))
vi.mock('../lib/capability/use-action-availability', () => ({
  useActionAvailability: () => ({ available: true }),
}))

const { InteractiveGuide } = await import('../components/ui/guide/interactive-guide')
const translate = (key: string) => key

describe('placeGuideCard — pure', () => {
  const viewport = { width: 1200, height: 800 }

  it('LTR: a wide section — the card starts where the section starts', () => {
    const p = placeGuideCard({
      target: { top: 400, bottom: 600, left: 100, right: 1100 },
      viewport,
      cardHeight: 120,
      direction: 'ltr',
    })
    expect(p.left).toBe(100)
    expect(p.top).toBe(400 - 120 - 12)
    expect(p.arrow).toBe('bottom')
    expect(p.arrowOffset).toBe(28 - 6)
  })

  it('⚠️ RTL: a wide section — the card aligns with its RIGHT edge and the arrow points there', () => {
    const p = placeGuideCard({
      target: { top: 400, bottom: 600, left: 100, right: 1100 },
      viewport,
      cardHeight: 120,
      direction: 'rtl',
    })
    expect(p.left).toBe(1100 - 340)
    // The arrow sits near the card's right end, over the section's start.
    expect(p.left + p.arrowOffset + 6).toBe(1100 - 28)
  })

  it('a narrow section — centred on it, arrow at its middle, either direction', () => {
    for (const direction of ['ltr', 'rtl'] as const) {
      const p = placeGuideCard({
        target: { top: 400, bottom: 440, left: 500, right: 560 },
        viewport,
        cardHeight: 120,
        direction,
      })
      expect(p.left + p.arrowOffset + 6).toBe(530)
    }
  })

  it('goes below when there is no room above, and inside when the section fills the screen', () => {
    const below = placeGuideCard({
      target: { top: 40, bottom: 200, left: 0, right: 300 },
      viewport,
      cardHeight: 120,
      direction: 'rtl',
    })
    expect(below.arrow).toBe('top')
    expect(below.top).toBe(212)
    const inside = placeGuideCard({
      target: { top: 0, bottom: 800, left: 0, right: 1200 },
      viewport,
      cardHeight: 120,
      direction: 'rtl',
    })
    expect(inside.arrow).toBeNull()
  })

  it('no section: the middle of the screen', () => {
    const p = placeGuideCard({ target: null, viewport, cardHeight: 200, direction: 'rtl' })
    expect(p).toMatchObject({ top: 300, left: 430, arrow: null })
  })

  it('the spotlight hole keeps a little room and stays on screen', () => {
    expect(spotlightHole({ top: 2, bottom: 900, left: 10, right: 200 }, viewport)).toEqual({
      top: 0,
      bottom: 800,
      left: 4,
      right: 206,
    })
  })
})

describe('InteractiveGuide', () => {
  beforeEach(() => {
    remote.state = { isSuccess: true, isError: false, data: { configured: true, steps: [] } }
    remote.saved = []
    remote.pushed = []
    useAuthStore.setState({ user: { id: 'person-1' } } as never)
    useGuideStore.setState({
      ownerId: 'person-1',
      completedSteps: {},
      replayRoute: null,
      replaySeen: [],
    })
    document.body.innerHTML = ''
    const section = document.createElement('section')
    section.setAttribute('data-guide', 'dashboard-overview')
    document.body.appendChild(section)
  })
  afterEach(() => cleanup())

  it('⚠️ draws nothing until the server record has answered', () => {
    remote.state = { isSuccess: false, isError: false, data: { configured: true, steps: [] } }
    render(<InteractiveGuide currentRoute="/fa/dashboard" t={translate} />)
    expect(document.querySelector('[data-guide-card]')).toBeNull()
  })

  it('⚠️ a step the server already has is never shown again', async () => {
    const all = (GUIDE_CATALOG.dashboard ?? []).map((step) => step.id)
    remote.state = {
      isSuccess: true,
      isError: false,
      data: {
        configured: true,
        steps: all.map((stepId) => ({ stepId, routeId: 'dashboard', seenAt: 'x' })),
      },
    }
    useGuideStore.setState({ completedSteps: {} })
    render(<InteractiveGuide currentRoute="/fa/dashboard" t={translate} />)
    await waitFor(() =>
      expect(useGuideStore.getState().isStepSeen('dashboard-overview')).toBe(true),
    )
    expect(document.querySelector('[data-guide-card]')).toBeNull()
  })

  it('is a modal that locks the page: wheel and scroll keys outside the card are stopped', () => {
    render(<InteractiveGuide currentRoute="/fa/dashboard" t={translate} />)
    const card = document.querySelector('[data-guide-card]') as HTMLElement
    expect(card.getAttribute('role')).toBe('dialog')
    expect(card.getAttribute('aria-modal')).toBe('true')
    const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true })
    document.body.dispatchEvent(wheel)
    expect(wheel.defaultPrevented).toBe(true)
    const key = new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true })
    document.body.dispatchEvent(key)
    expect(key.defaultPrevented).toBe(true)
  })

  it('«next» records the step on the device and on the server', async () => {
    render(<InteractiveGuide currentRoute="/fa/dashboard" t={translate} />)
    fireEvent.click(screen.getByText('guide.next'))
    await waitFor(() =>
      expect(useGuideStore.getState().isStepSeen('dashboard-overview')).toBe(true),
    )
    expect(remote.saved).toContainEqual([{ stepId: 'dashboard-overview', routeId: 'dashboard' }])
  })

  it('× records the rest of the page as seen — it does not come back', async () => {
    render(<InteractiveGuide currentRoute="/fa/dashboard" t={translate} />)
    fireEvent.click(screen.getByLabelText('guide.close'))
    await waitFor(() =>
      expect(useGuideStore.getState().isStepSeen('dashboard-sales-chart')).toBe(true),
    )
    expect(document.querySelector('[data-guide-card]')).toBeNull()
  })

  it('the last step leads to the next page that still has something to teach', async () => {
    // Every dashboard step but the last (the guide was rewritten with more
    // steps on 10 Nov 2026 — read from the catalog, not counted by hand).
    const steps = (GUIDE_CATALOG.dashboard ?? []).slice(0, -1).map((step) => step.id)
    useGuideStore
      .getState()
      .markStepsSeen(steps.map((stepId) => ({ stepId, routeId: 'dashboard' })))
    render(<InteractiveGuide currentRoute="/fa/dashboard" t={translate} />)
    await act(async () => {
      fireEvent.click(screen.getByText('guide.finish'))
    })
    const go = await screen.findByText(/guide\.goTo/)
    expect(go.closest('button')?.getAttribute('data-guide-next-page')).toBe('invoices')
    fireEvent.click(go)
    expect(remote.pushed).toEqual(['/invoices'])
  })
})
