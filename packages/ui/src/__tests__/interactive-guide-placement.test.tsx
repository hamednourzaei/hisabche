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
import { formatNumber } from '@hisabche/formatting'
import { placeGuideCard, spotlightHole } from '../components/ui/guide/guide-placement'

const remote = vi.hoisted(() => ({
  state: { isSuccess: true, isError: false, data: { configured: true, steps: [] as unknown[] } },
  saved: [] as unknown[],
  pushed: [] as string[],
  replaced: [] as string[],
  // What this person has: their menu and their business's DNA modules (use-guide-scope).
  scope: {
    isReachable: (_path: string): boolean => true,
    activeModules: null as ReadonlySet<string> | null,
  },
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
vi.mock('../components/ui/guide/use-guide-scope', () => ({
  useGuideScope: () => remote.scope,
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/fa/dashboard',
  useRouter: () => ({
    push: (href: string) => void remote.pushed.push(href),
    replace: (href: string) => void remote.replaced.push(href),
  }),
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
    remote.replaced = []
    remote.scope = { isReachable: () => true, activeModules: null }
    useAuthStore.setState({ user: { id: 'person-1' } } as never)
    useGuideStore.setState({
      ownerId: 'person-1',
      completedSteps: {},
      skippedSteps: {},
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

  it('⚠️ starts at step one even when later steps were seen before (owner, 10 Nov 2026)', () => {
    const steps = GUIDE_CATALOG.dashboard ?? []
    // Seen on an earlier visit: the first two. The walk still opens at «1 / n».
    useGuideStore
      .getState()
      .markStepsSeen(steps.slice(0, 2).map((step) => ({ stepId: step.id, routeId: 'dashboard' })))
    render(<InteractiveGuide currentRoute="/fa/dashboard" t={translate} />)
    expect(screen.getByText(steps[0]!.titleKey)).toBeTruthy()
  })

  it('the last step leads to the next page that still has something to teach', async () => {
    // Every dashboard step but the last was seen before; the walk still goes
    // from step one (read from the catalog, not counted by hand).
    const steps = GUIDE_CATALOG.dashboard ?? []
    useGuideStore
      .getState()
      .markStepsSeen(steps.slice(0, -1).map((step) => ({ stepId: step.id, routeId: 'dashboard' })))
    render(<InteractiveGuide currentRoute="/fa/dashboard" t={translate} />)
    for (let index = 0; index < steps.length - 1; index++) {
      await act(async () => {
        fireEvent.click(screen.getByText('guide.next'))
      })
    }
    await act(async () => {
      fireEvent.click(screen.getByText('guide.finish'))
    })
    const go = await screen.findByText(/guide\.goTo/)
    expect(go.closest('button')?.getAttribute('data-guide-next-page')).toBe('invoices')
    fireEvent.click(go)
    expect(remote.pushed).toEqual(['/invoices'])
  })

  /** Walks the dashboard to its end and returns the «where next» button, if any. */
  async function finishDashboard() {
    const steps = GUIDE_CATALOG.dashboard ?? []
    render(<InteractiveGuide currentRoute="/fa/dashboard" t={translate} />)
    for (let index = 0; index < steps.length - 1; index++) {
      await act(async () => {
        fireEvent.click(screen.getByText('guide.next'))
      })
    }
    await act(async () => {
      fireEvent.click(screen.getByText('guide.finish'))
    })
  }

  it("⚠️ never leads to a page that is not in this person's menu (owner, 15 Nov 2026)", async () => {
    // A salon: no sales list in this person's menu (e.g. hidden by the role), no warehouse.
    remote.scope = {
      isReachable: (path) => path !== '/invoices' && path !== '/warehouse',
      activeModules: null,
    }
    await finishDashboard()
    const go = await screen.findByText(/guide\.goTo/)
    const next = go.closest('button')?.getAttribute('data-guide-next-page')
    expect(next).not.toBe('invoices')
    expect(next).not.toBe('warehouse')
    expect(next).not.toBe('stock-count')
  })

  it('⚠️ says «all done» instead of sending the reader nowhere when no page of theirs is left', async () => {
    remote.scope = { isReachable: (path) => path === '/dashboard', activeModules: null }
    await finishDashboard()
    expect(await screen.findByText('guide.allDoneTitle')).toBeTruthy()
    expect(screen.queryByText(/guide\.goTo/)).toBeNull()
  })

  it("opens a step's tab through the address — never by clicking the tab bar", async () => {
    vi.useFakeTimers()
    try {
      // Customers: the first step is in the «customers» tab, which this screen offers.
      const tab = document.createElement('button')
      tab.setAttribute('data-guide-tab', 'customers')
      document.body.appendChild(tab)
      render(<InteractiveGuide currentRoute="/fa/customers" t={translate} />)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200)
      })
      // Not yet the open tab: the guide asks the address for it — never clicks.
      expect(remote.replaced[0]).toContain('tab=customers')
      tab.setAttribute('data-guide-active', '')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400)
      })
      expect(screen.getByText('guide.customers.overview.title')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it("⚠️ a step whose tab is not on this person's screen is skipped — not taught, not «seen»", async () => {
    vi.useFakeTimers()
    try {
      // No «customers» tab marker anywhere: this screen does not offer it.
      render(<InteractiveGuide currentRoute="/fa/customers" t={translate} />)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000)
      })
      const state = useGuideStore.getState()
      expect(state.skippedSteps['customers-overview']).toBe('customers')
      expect(state.isStepSeen('customers-overview')).toBe(false)
      expect(screen.queryByText('guide.customers.overview.title')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('⚠️ a step of a module the business does not run is not taught (DNA scope)', async () => {
    vi.useFakeTimers()
    try {
      // A shop (products, no services, no repairs): the sessions tab is offered
      // by the screen, but its steps are not for this business.
      remote.scope = { isReachable: () => true, activeModules: new Set(['products', 'invoices']) }
      for (const id of ['customers', 'sessions']) {
        const tab = document.createElement('button')
        tab.setAttribute('data-guide-tab', id)
        tab.setAttribute('data-guide-active', '')
        document.body.appendChild(tab)
      }
      const view = document.createElement('button')
      view.setAttribute('data-guide-view', 'sessions')
      view.setAttribute('data-guide-active', '')
      document.body.appendChild(view)
      render(<InteractiveGuide currentRoute="/fa/customers" t={translate} />)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300)
      })
      // «n» in «1 / n» counts only this business's steps.
      const inScope = (GUIDE_CATALOG.customers ?? []).filter(
        (step) => !step.modules || step.modules.some((m) => m === 'products' || m === 'invoices'),
      )
      const counter = `${formatNumber(1, 'fa')} / ${formatNumber(inScope.length, 'fa')}`
      expect(screen.getAllByText(counter, { exact: false }).length).toBeGreaterThan(0)
      expect(inScope.some((step) => step.id === 'customers-repairs')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
