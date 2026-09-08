// @vitest-environment jsdom
// ============================================
// The sidebar's BEHAVIOUR, rendered.
//
// The sibling file tests `isPathActive` as a function. This one drives the real
// component, because the things most likely to break — a panel showing the
// wrong domain for the current page, a keyboard shortcut that fires while
// someone is typing, a badge that says «۰» — are not visible in a pure
// function.
//
// ---------------------------------------------------------------------------
// THE SHAPE UNDER TEST
//
//   rail    one button per domain: the daily destinations, then each group
//   panel   the destinations inside the selected domain
//
// The panel follows the ROUTE until the rail is clicked, and the chosen domain
// is then kept. That pair of rules is what most of this file is about.
// ============================================

import * as React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DashboardSidebar, SIDEBAR_STORAGE_KEY, type NavItem } from '../dashboard-sidebar'

// ── Test doubles for the two modules the sidebar reaches out to ──
// Neither is what is under test; both would otherwise need a provider tree.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const authState = { user: { businessName: 'فروشگاه نمونه', fullName: 'حامد' } }
vi.mock('@hisabche/store', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}))

function Icon() {
  return <svg data-testid="icon" />
}

const primaryItems: NavItem[] = [
  { id: 'today', icon: Icon, label: 'خانه', path: '/dashboard' },
  { id: 'get-paid', icon: Icon, label: 'فاکتورها', path: '/invoices' },
]

const moreGroups = [
  {
    id: 'work',
    label: 'کارها',
    icon: Icon,
    items: [
      { id: 'bank', icon: Icon, label: 'بانک', path: '/bank' },
      { id: 'assets', icon: Icon, label: 'دارایی‌ها', path: '/assets' },
    ],
  },
  {
    id: 'system',
    label: 'سامانه',
    icon: Icon,
    items: [{ id: 'settings', icon: Icon, label: 'تنظیمات', path: '/settings' }],
  },
]

function renderSidebar(activeNav: string, onNavigate = vi.fn()) {
  return {
    onNavigate,
    ...render(
      <DashboardSidebar
        primaryItems={primaryItems}
        moreGroups={moreGroups}
        activeNav={activeNav}
        onNavigate={onNavigate}
      />,
    ),
  }
}

/** What the browser actually stored, or null. */
function stored(): { railExpanded?: boolean; panelOpen?: boolean } | null {
  const raw = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
  return raw ? JSON.parse(raw) : null
}

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(cleanup)

describe('the panel follows the route', () => {
  it('⚠️ opens on the domain holding the current page', () => {
    // Arriving on /bank from a bookmark must not show the daily destinations —
    // the sidebar would be pointing somewhere the reader is not.
    renderSidebar('/fa/bank')
    expect(screen.getByRole('button', { name: 'بانک' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'تنظیمات' })).toBeNull()
  })

  it('shows the daily destinations for a primary route', () => {
    renderSidebar('/fa/invoices')
    expect(screen.getByRole('button', { name: 'فاکتورها' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'بانک' })).toBeNull()
  })

  it('falls back to the daily destinations for a route in no domain', () => {
    // An unmapped route must not render an empty panel.
    renderSidebar('/fa/some-unmapped-page')
    expect(screen.getByRole('button', { name: 'خانه' })).toBeTruthy()
  })

  it('marks the current destination, and only it', () => {
    renderSidebar('/fa/invoices')
    expect(screen.getByRole('button', { name: 'فاکتورها' }).getAttribute('aria-current')).toBe(
      'page',
    )
    expect(screen.getByRole('button', { name: 'خانه' }).getAttribute('aria-current')).toBeNull()
  })

  it('marks a child route as the parent destination', () => {
    renderSidebar('/fa/invoices/42')
    expect(screen.getByRole('button', { name: 'فاکتورها' }).getAttribute('aria-current')).toBe(
      'page',
    )
  })
})

describe('choosing a domain from the rail', () => {
  it('swaps the panel to that domain', () => {
    renderSidebar('/fa/invoices')
    fireEvent.click(screen.getByRole('button', { name: 'سامانه' }))
    expect(screen.getByRole('button', { name: 'تنظیمات' })).toBeTruthy()
  })

  it('⚠️ the choice STICKS while the reader stays on the same page', () => {
    // Browsing «سامانه» while sitting on an invoice is deliberate. A panel that
    // snapped back to the route's own domain would make it impossible.
    const { rerender } = renderSidebar('/fa/invoices')
    fireEvent.click(screen.getByRole('button', { name: 'سامانه' }))

    rerender(
      <DashboardSidebar
        primaryItems={primaryItems}
        moreGroups={moreGroups}
        activeNav="/fa/invoices"
        onNavigate={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'تنظیمات' })).toBeTruthy()
  })

  it('⚠️ reopens the panel if it was closed', () => {
    // Picking a domain and seeing nothing happen is the kind of dead click
    // that makes people stop using a control.
    renderSidebar('/fa/invoices')
    fireEvent.click(screen.getByRole('button', { name: 'nav.collapseSidebar' }))
    expect(screen.queryByRole('button', { name: 'تنظیمات' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'سامانه' }))
    expect(screen.getByRole('button', { name: 'تنظیمات' })).toBeTruthy()
  })

  it('the rail marks the domain holding the current page', () => {
    renderSidebar('/fa/bank')
    expect(screen.getByRole('button', { name: 'کارها' }).getAttribute('aria-current')).toBe('true')
  })
})

describe('the panel can be closed and reopened', () => {
  it('closing hides the destinations and persists it', () => {
    renderSidebar('/fa/invoices')
    fireEvent.click(screen.getByRole('button', { name: 'nav.collapseSidebar' }))

    expect(stored()?.panelOpen).toBe(false)
    expect(screen.queryByRole('button', { name: 'فاکتورها' })).toBeNull()
  })

  it('⚠️ a closed panel is not a one-way door', () => {
    // Before the reopen strip existed, closing the panel left only the rail —
    // whose own toggle changes its WIDTH, not the panel — so the only way back
    // was to pick a domain, which also navigated the panel somewhere else.
    renderSidebar('/fa/invoices')
    fireEvent.click(screen.getByRole('button', { name: 'nav.collapseSidebar' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'nav.expandSidebar' }).at(-1)!)
    expect(screen.getByRole('button', { name: 'فاکتورها' })).toBeTruthy()
  })

  it('restores a stored closed panel', () => {
    window.localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      JSON.stringify({ railExpanded: false, panelOpen: false }),
    )
    renderSidebar('/fa/invoices')
    expect(screen.queryByRole('button', { name: 'فاکتورها' })).toBeNull()
  })

  it('⚠️ a stored value from an older shape leaves the panel OPEN', () => {
    // The panel is open by default. Reading `panelOpen === true` rather than
    // `!== false` would close it for everyone carrying the previous format.
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify({ railExpanded: true }))
    renderSidebar('/fa/invoices')
    expect(screen.getByRole('button', { name: 'فاکتورها' })).toBeTruthy()
  })

  it('⚠️ the chosen domain is NOT persisted', () => {
    // A domain picked last Tuesday is not where the reader is today.
    renderSidebar('/fa/invoices')
    fireEvent.click(screen.getByRole('button', { name: 'سامانه' }))
    expect(stored()).not.toHaveProperty('section')
  })

  it('survives localStorage throwing, which it does in a blocked-cookies browser', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => renderSidebar('/fa/invoices')).not.toThrow()
    spy.mockRestore()
  })

  it('survives a corrupt stored value', () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, 'not json')
    expect(() => renderSidebar('/fa/invoices')).not.toThrow()
  })
})

describe('the rail expands to show names', () => {
  it('the choice persists', () => {
    renderSidebar('/fa/invoices')
    fireEvent.click(screen.getAllByRole('button', { name: 'nav.expandSidebar' })[0]!)
    expect(stored()?.railExpanded).toBe(true)
  })
})

describe('Ctrl/Cmd+B', () => {
  it('toggles the panel', () => {
    renderSidebar('/fa/invoices')
    fireEvent.keyDown(document, { key: 'b', ctrlKey: true })
    expect(stored()?.panelOpen).toBe(false)
  })

  it('works with the meta key too', () => {
    renderSidebar('/fa/invoices')
    fireEvent.keyDown(document, { key: 'b', metaKey: true })
    expect(stored()?.panelOpen).toBe(false)
  })

  it('⚠️ does NOT fire while someone is typing', () => {
    // Ctrl+B inside a text field is the browser's bold, and collapsing the
    // navigation mid-sentence is never what was meant.
    renderSidebar('/fa/invoices')
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    fireEvent.keyDown(input, { key: 'b', ctrlKey: true })
    expect(stored()).toBeNull()

    input.remove()
  })

  it('ignores a bare b', () => {
    renderSidebar('/fa/invoices')
    fireEvent.keyDown(document, { key: 'b' })
    expect(stored()).toBeNull()
  })
})

describe('badges', () => {
  it('⚠️ does not render a badge for zero', () => {
    // A grey pill reading «۰» draws the eye to say nothing is waiting. Every
    // destination with a counter wore one permanently.
    render(
      <DashboardSidebar
        primaryItems={[
          { id: 'approvals', icon: Icon, label: 'تأییدها', path: '/approvals', badge: 0 },
        ]}
        moreGroups={[]}
        activeNav="/fa/approvals"
        onNavigate={vi.fn()}
      />,
    )
    expect(screen.queryByText('0')).toBeNull()
  })

  it('renders a real count', () => {
    render(
      <DashboardSidebar
        primaryItems={[
          { id: 'approvals', icon: Icon, label: 'تأییدها', path: '/approvals', badge: 3 },
        ]}
        moreGroups={[]}
        activeNav="/fa/approvals"
        onNavigate={vi.fn()}
      />,
    )
    expect(screen.getByText('3')).toBeTruthy()
  })
})

describe('navigation', () => {
  it('reports the id and the path it was given', () => {
    const onNavigate = vi.fn()
    renderSidebar('/fa/invoices', onNavigate)
    fireEvent.click(screen.getByRole('button', { name: 'فاکتورها' }))
    expect(onNavigate).toHaveBeenCalledWith('get-paid', '/invoices')
  })

  it('works from another domain', () => {
    const onNavigate = vi.fn()
    renderSidebar('/fa/bank', onNavigate)
    fireEvent.click(screen.getByRole('button', { name: 'دارایی‌ها' }))
    expect(onNavigate).toHaveBeenCalledWith('assets', '/assets')
  })
})

describe('workspace identity', () => {
  it('shows the real business name, never an invented one', () => {
    renderSidebar('/fa/invoices')
    expect(screen.getByText('فروشگاه نمونه')).toBeTruthy()
  })
})
