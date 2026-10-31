// ============================================
// A page switched off in DISABLED_PAGES is closed at the proxy, for every
// locale, and the page files themselves carry no switch.
//
// The first version put the redirect inside the two page files, which broke the
// rule that a route file holds a screen and nothing else — and a test that only
// read those files could not have said whether the door shuts. This one sends a
// request through the real proxy.
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

// The locale middleware is not under test (and does not load outside Next): it
// answers 200 with no Location, which is all «left to the locale middleware» means.
vi.mock('next-intl/middleware', () => ({ default: () => () => NextResponse.next() }))

import { DISABLED_PAGES } from '@hisabche/ui-contract'

import proxy from '../../../../apps/web/proxy'

const get = (path: string) => proxy(new NextRequest(`https://hisabche.com${path}`))

describe('the proxy shuts a switched-off page', () => {
  it('lists the two pages this switch exists for', () => {
    expect(DISABLED_PAGES).toEqual(expect.arrayContaining(['/marketplace', '/market-seller']))
  })

  for (const lang of ['fa', 'af', 'en']) {
    for (const page of ['/marketplace', '/market-seller']) {
      it(`${lang}${page} redirects to the settings page`, () => {
        const res = get(`/${lang}${page}`)
        expect(res.status).toBe(307)
        expect(new URL(res.headers.get('location') ?? '').pathname).toBe(`/${lang}/settings`)
      })
    }
  }

  it('a page below it (a deep link) is shut as well', () => {
    const res = get('/fa/marketplace?app=x')
    expect(res.status).toBe(307)
  })

  it('leaves an ordinary page to the locale middleware', () => {
    const res = get('/fa/invoices')
    expect(res.headers.get('location') ?? '').not.toContain('/settings')
  })

  it('does not touch a page whose name merely starts the same', () => {
    const res = get('/fa/marketplaces-report')
    expect(res.headers.get('location') ?? '').not.toContain('/fa/settings')
  })
})
