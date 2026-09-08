// @vitest-environment jsdom
// ============================================
// The sidebar's BEHAVIOUR, rendered.
//
// The sibling file tests `isPathActive` as a function. This one drives the
// real component, because the things most likely to break — a group that does
// not open on the route it contains, a label still readable when collapsed, a
// keyboard shortcut that fires while someone is typing — are not visible in a
// pure function.
// ============================================

import * as React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(cleanup)

describe('active state', () => {
  it('marks the current destination, and only it', () => {
    renderSidebar('/fa/invoices')
    // No jest-dom in this repo, so attributes are read directly.
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

describe('groups', () => {
  it('⚠️ auto-opens the group holding the current page', () => {
    // Arriving on /bank from a bookmark with «کارها» closed would otherwise
    // show a sidebar where nothing is highlighted — which reads as being
    // nowhere at all.
    renderSidebar('/fa/bank')
    expect(screen.getByRole('button', { name: /کارها/ }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: /سامانه/ }).getAttribute('aria-expanded')).toBe(
      'false',
    )
  })

  it('the user can close a group that holds the current page', () => {
    renderSidebar('/fa/bank')
    const group = screen.getByRole('button', { name: /کارها/ })
    fireEvent.click(group)
    expect(group.getAttribute('aria-expanded')).toBe('false')
  })

  it('a closed group hides its items from assistive tech, not just visually', () => {
    // `grid-rows-[0fr]` is invisible but still focusable and still read aloud.
    // Without `hidden`, Tab walks through fifteen destinations that are not on
    // screen.
    renderSidebar('/fa/dashboard')
    const systemButton = screen.getByRole('button', { name: /سامانه/ })
    const region = document.getElementById(systemButton.getAttribute('aria-controls')!)!
    expect(within(region).queryByRole('button', { name: 'تنظیمات' })).toBeNull()
  })

  it('points at a real region through aria-controls', () => {
    renderSidebar('/fa/bank')
    const group = screen.getByRole('button', { name: /کارها/ })
    const id = group.getAttribute('aria-controls')
    expect(id).toBeTruthy()
    expect(document.getElementById(id!)).not.toBeNull()
  })
})

describe('collapse', () => {
  it('starts expanded and shows labels', () => {
    renderSidebar('/fa/dashboard')
    expect(screen.getByRole('button', { name: 'فاکتورها' })).toBeTruthy()
  })

  it('collapsing hides the labels and persists the choice', () => {
    renderSidebar('/fa/dashboard')
    fireEvent.click(screen.getByRole('button', { name: 'nav.collapseSidebar' }))

    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('collapsed')
    // The accessible name survives as the tooltip trigger's content; what must
    // be gone is the visible text node.
    expect(screen.queryByText('فاکتورها')).toBeNull()
  })

  it('restores a stored collapsed preference', () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, 'collapsed')
    renderSidebar('/fa/dashboard')
    expect(screen.queryByText('فاکتورها')).toBeNull()
    expect(screen.getByRole('button', { name: 'nav.expandSidebar' })).toBeTruthy()
  })

  it('survives localStorage throwing, which it does in a blocked-cookies browser', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => renderSidebar('/fa/dashboard')).not.toThrow()
    spy.mockRestore()
  })
})

describe('Ctrl/Cmd+B', () => {
  it('toggles the sidebar', () => {
    renderSidebar('/fa/dashboard')
    fireEvent.keyDown(document, { key: 'b', ctrlKey: true })
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('collapsed')
  })

  it('works with the meta key too', () => {
    renderSidebar('/fa/dashboard')
    fireEvent.keyDown(document, { key: 'b', metaKey: true })
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('collapsed')
  })

  it('⚠️ does NOT fire while someone is typing', () => {
    // Ctrl+B inside a text field is the browser's bold, and collapsing the
    // navigation mid-sentence is never what was meant.
    renderSidebar('/fa/dashboard')
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    fireEvent.keyDown(input, { key: 'b', ctrlKey: true })
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBeNull()

    input.remove()
  })

  it('ignores a bare b', () => {
    renderSidebar('/fa/dashboard')
    fireEvent.keyDown(document, { key: 'b' })
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBeNull()
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
        activeNav="/fa/dashboard"
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
        activeNav="/fa/dashboard"
        onNavigate={vi.fn()}
      />,
    )
    expect(screen.getByText('3')).toBeTruthy()
  })
})

describe('navigation', () => {
  it('reports the id and the path it was given', () => {
    const onNavigate = vi.fn()
    renderSidebar('/fa/dashboard', onNavigate)
    fireEvent.click(screen.getByRole('button', { name: 'فاکتورها' }))
    expect(onNavigate).toHaveBeenCalledWith('get-paid', '/invoices')
  })

  it('works from inside a group', () => {
    const onNavigate = vi.fn()
    renderSidebar('/fa/bank', onNavigate)
    fireEvent.click(screen.getByRole('button', { name: 'دارایی‌ها' }))
    expect(onNavigate).toHaveBeenCalledWith('assets', '/assets')
  })
})

describe('workspace header', () => {
  it('shows the real business name, never an invented one', () => {
    renderSidebar('/fa/dashboard')
    expect(screen.getByText('فروشگاه نمونه')).toBeTruthy()
  })
})
