// Requested 26 Sep 2026: a signed-in person on a public page saw «شروع رایگان»
// and «ورود» — sign-up and sign-in for an account they already had. The header
// now offers «داشبورد» instead, decided AFTER MOUNT: the landing is prerendered
// once for everyone, so its HTML — and the client's first render — stay the
// signed-out header.
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  // Returning the key makes TopNav fall back to its own Persian text.
  useTranslations: () => (key: string) => key,
  useLocale: () => 'fa',
}))
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...rest
  }: ComponentProps<'a'> & {
    prefetch?: boolean
  }) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
}))
vi.mock('next/dynamic', () => ({ default: () => () => null }))

// jsdom has no ResizeObserver; the landing's scroll tracking attaches one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const { useAuthStore } = await import('@hisabche/store')
const { NavigationProvider } = await import('../hooks/menu/use-navigation-state')
const { TopNav } = await import('../components/ui/navigation/top-nav')

const SECTIONS = [{ id: 'hero', label: 'خانه', narrative: 'frustration' as const }]

// A JWT whose payload carries only `exp` (seconds). The signature is never
// checked on the client — only the server decides whether a token is good.
function tokenExpiringIn(seconds: number): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }))
  return `header.${payload}.signature`
}

const USER = {
  id: 'u-1',
  email: 'owner@example.com',
  fullName: 'Owner',
  businessName: 'دکان',
  createdAt: '2026-01-01T00:00:00Z',
}

function signIn(token: string, refreshToken: string | null) {
  useAuthStore.setState({ user: USER, token, refreshToken, isAuthenticated: true })
}

function header() {
  return (
    <NavigationProvider sections={SECTIONS}>
      <TopNav variant="landing" localePrefix="fa" />
    </NavigationProvider>
  )
}

beforeEach(() => {
  useAuthStore.setState({ user: null, token: null, refreshToken: null, isAuthenticated: false })
})
afterEach(cleanup)

describe('public header — signed in shows «Dashboard»', () => {
  it('a signed-in visitor gets one «Dashboard» link to /fa/dashboard, with rel="nofollow"', () => {
    signIn(tokenExpiringIn(3600), 'refresh')
    render(header())

    const link = screen.getByTestId('landing-dashboard-link')
    expect(link.getAttribute('href')).toBe('/fa/dashboard')
    expect(link.getAttribute('rel')).toBe('nofollow')
    expect(link.textContent).toBe('داشبورد')
    expect(document.querySelector('a[href="/fa/signup"]')).toBeNull()
    expect(document.querySelector('a[href="/fa/login"]')).toBeNull()
  })

  it('a visitor without a session keeps «ورود» and «شروع رایگان»', () => {
    render(header())

    expect(screen.queryByTestId('landing-dashboard-link')).toBeNull()
    expect(document.querySelector('a[href="/fa/signup"]')).not.toBeNull()
    expect(document.querySelector('a[href="/fa/login"]')).not.toBeNull()
  })

  it('an expired access token with no refresh token is not a session', () => {
    signIn(tokenExpiringIn(-60), null)
    render(header())

    expect(screen.queryByTestId('landing-dashboard-link')).toBeNull()
  })

  it('an expired access token that a refresh token can renew still is', () => {
    signIn(tokenExpiringIn(-60), 'refresh')
    render(header())

    expect(screen.getByTestId('landing-dashboard-link')).toBeTruthy()
  })

  it('the server render is the signed-out header even when the store has a session', () => {
    signIn(tokenExpiringIn(3600), 'refresh')
    const html = renderToString(header())

    expect(html).toContain('href="/fa/signup"')
    expect(html).not.toContain('/fa/dashboard')
  })

  it('the landing logo is the brand, not the stored business name', () => {
    signIn(tokenExpiringIn(3600), 'refresh')
    render(header())

    expect(document.querySelector('a[href="/fa"]')?.textContent).not.toContain('دکان')
  })

  it('⚠️ the first client render says «signed out» even with a session in the store', async () => {
    const { useSignedInAfterMount } = await import('../hooks/use-signed-in-after-mount')
    signIn(tokenExpiringIn(3600), 'refresh')
    const seen: boolean[] = []
    renderHook(() => {
      const value = useSignedInAfterMount()
      seen.push(value)
      return value
    })

    expect(seen[0]).toBe(false)
    expect(seen.at(-1)).toBe(true)
  })
})

describe('the phone drawer follows the same rule', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  const drawer = strip(
    readFileSync(join(__dirname, '../components/ui/navigation/landing-mobile-menu.tsx'), 'utf8'),
  )

  it('links the dashboard with rel="nofollow" only when TopNav says signed in', () => {
    expect(drawer).toMatch(/signedIn \? \(/)
    expect(drawer).toContain('href={`${routePrefix}/dashboard`}')
    expect(drawer).toContain('rel="nofollow"')
  })

  it('never reads the auth store itself (TopNav decides, after mount)', () => {
    expect(drawer).not.toContain('useAuthStore')
  })
})
