// ============================================
// packages/ui/src/__tests__/interactive-guide-placement.test.tsx
// Where the guide card stands, and how a step is finished.
//
// The card used to live in the bottom corner of every page. These tests pin the
// behaviour that replaced it: it measures the section a step names and stands
// directly above it, it docks in the corner only when the section is not on
// screen, and the route's progress can be read a second time.
// ============================================

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGuideStore } from '@hisabche/store'

import { InteractiveGuide } from '../components/ui/guide/interactive-guide'

vi.mock('next-intl', () => ({ useLocale: () => 'fa' }))

const translate = (key: string) => key

const rect = (values: { top: number; bottom: number; left: number }): DOMRect =>
  ({
    top: values.top,
    bottom: values.bottom,
    left: values.left,
    right: values.left + 560,
    width: 560,
    height: values.bottom - values.top,
    x: values.left,
    y: values.top,
    toJSON: () => ({}),
  }) as DOMRect

function mountSection(sectionId: string, values: { top: number; bottom: number; left: number }) {
  const host = document.createElement('div')
  host.innerHTML = `<div data-guide="${sectionId}"></div>`
  document.body.appendChild(host)
  const element = host.querySelector(`[data-guide="${sectionId}"]`) as HTMLElement
  element.getBoundingClientRect = () => rect(values)
  return host
}

beforeEach(() => {
  useGuideStore.getState().resetProgress()
  localStorage.clear()
  // jsdom has no layout: the card's height is what decides "above" vs "below",
  // and the viewport is what it is clamped into.
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => 120,
  })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
  Element.prototype.scrollIntoView = () => {}
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

describe('InteractiveGuide placement', () => {
  it('stands above the section the step describes', async () => {
    mountSection('dashboard-kpis', { top: 400, bottom: 600, left: 80 })
    useGuideStore.getState().markStepSeen('dashboard-overview', 'dashboard')

    render(<InteractiveGuide currentRoute="/fa/dashboard" t={translate} />)

    const card = await screen.findByRole('region')
    // 400 − card height 120 − the 12px gap.
    await waitFor(() => expect(card.style.top).toBe('268px'))
    expect(card.style.left).toBe('80px')
    expect(card.style.width).toBe('340px')
    expect(screen.getByText('guide.dashboard.kpis.title')).toBeTruthy()
  })

  it('goes below the section when the top of the viewport is too close', async () => {
    mountSection('dashboard-kpis', { top: 40, bottom: 200, left: 80 })
    useGuideStore.getState().markStepSeen('dashboard-overview', 'dashboard')

    render(<InteractiveGuide currentRoute="/fa/dashboard" t={translate} />)

    const card = await screen.findByRole('region')
    // 200 + the 12px gap — there is no room for a 120px card above 40px.
    await waitFor(() => expect(card.style.top).toBe('212px'))
  })

  it('docks in the corner when the screen marks no section', async () => {
    render(<InteractiveGuide currentRoute="/fa/billing" t={translate} />)

    const card = await screen.findByRole('region')
    await waitFor(() => expect(card.className).toContain('bottom-6'))
    expect(card.style.top).toBe('')
    expect(screen.getByText('guide.billing.plans.desc')).toBeTruthy()
  })

  it('marks the step as read when the reader moves on', async () => {
    mountSection('dashboard-kpis', { top: 400, bottom: 600, left: 80 })
    useGuideStore.getState().markStepSeen('dashboard-overview', 'dashboard')

    render(<InteractiveGuide currentRoute="/fa/dashboard" t={translate} />)

    fireEvent.click(await screen.findByText('guide.next'))

    await waitFor(() => expect(useGuideStore.getState().isStepSeen('dashboard-kpis')).toBe(true))
  })

  it('leaves a way back in once every step of the page has been read', async () => {
    for (const stepId of ['dashboard-overview', 'dashboard-kpis', 'dashboard-sales-chart']) {
      useGuideStore.getState().markStepSeen(stepId, 'dashboard')
    }

    render(<InteractiveGuide currentRoute="/fa/dashboard" t={translate} />)

    const reopen = await screen.findByRole('button', { name: 'guide.short' })
    fireEvent.click(reopen)

    await waitFor(() =>
      expect(useGuideStore.getState().isStepSeen('dashboard-overview')).toBe(false),
    )
  })
})
