// ============================================
// Every broken screen has a way out.
//
// ---------------------------------------------------------------------------
// WHAT THESE GUARD
//
// 1. THE DESTINATION IS DECIDED FROM THE ONE AUTH STORE. Signed in → the
//    dashboard, signed out → the landing page. Not from a cookie, not from a
//    second flag, not from a prop a caller may forget to pass.
//
// 2. THE ROUTE IS NOT DECIDED IN THIS PACKAGE. `packages/ui` answers
//    `'dashboard' | 'landing'`; web turns that into `/fa/dashboard` and desktop
//    into a hash route. A literal `/dashboard` here would drop a Persian user
//    onto the default locale and would not resolve on desktop at all.
//
// 3. THE ERROR IS STILL LOGGED. A boundary that hides the cause is worse than
//    the crash.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/.*/g, '')
}

const REPO = join(__dirname, '..', '..', '..', '..')
const boundary = code(join(__dirname, '..', 'components', 'ui', 'error-boundary.tsx'))
const webError = code(join(REPO, 'apps', 'web', 'app', '[lang]', 'error.tsx'))
const webBoundary = code(join(REPO, 'apps', 'web', 'app', '[lang]', 'client-error-boundary.tsx'))
const webGlobal = code(join(REPO, 'apps', 'web', 'app', '[lang]', 'global-error.tsx'))
const desktopError = code(join(REPO, 'packages', 'app-shell', 'src', 'app', 'route-error.tsx'))
const desktopRoutes = code(join(REPO, 'packages', 'app-shell', 'src', 'app', 'app.tsx'))

describe('the shared boundary offers a way out', () => {
  it('reads authentication from the one auth store', () => {
    expect(boundary).toMatch(/from '@hisabche\/store'/)
    expect(boundary).toMatch(/useAuthStore\.getState\(\)\.isAuthenticated/)
  })

  it('signed in goes to the dashboard, signed out to the landing page', () => {
    expect(boundary).toMatch(/\? 'dashboard' : 'landing'/)
  })

  it('⚠️ but it does not invent a route — that belongs to each app', () => {
    expect(boundary).not.toMatch(/['"`]\/dashboard['"`]/)
    expect(boundary).not.toMatch(/router\.(push|replace)/)
  })

  it('still logs what it caught', () => {
    expect(boundary).toMatch(/console\.error/)
  })
})

describe('web keeps the locale prefix', () => {
  for (const [name, source] of [
    ['error.tsx', webError],
    ['client-error-boundary.tsx', webBoundary],
  ] as const) {
    it(`${name} builds the destination through localePath`, () => {
      expect(source).toMatch(/localePath\(/)
      // A bare, unprefixed literal path would be a silent language switch.
      expect(source).not.toMatch(/replace\(\s*['"`]\/dashboard['"`]/)
      expect(source).not.toMatch(/replace\(\s*['"`]\/['"`]\s*\)/)
    })
  }

  it('error.tsx reports the error rather than swallowing it', () => {
    expect(webError).toMatch(/Sentry\.captureException/)
    expect(webError).toMatch(/console\.error/)
  })

  it('global-error, which has no intl provider, still translates', () => {
    expect(webGlobal).toMatch(/@hisabche\/i18n\/messages/)
    expect(webGlobal).toMatch(/console\.error/)
    // ⚠️ Reading `window` during render is a hydration mismatch under React 19
    // and would discard the very tree showing the error. So every read of it
    // must sit AFTER the first `useEffect(` — inside one, never in the render
    // body or a `useState` initialiser.
    const firstEffect = webGlobal.indexOf('useEffect(')
    const firstWindow = webGlobal.indexOf('window.location')
    expect(firstEffect).toBeGreaterThan(-1)
    expect(firstWindow).toBeGreaterThan(firstEffect)
  })
})

describe('desktop uses the router’s own mechanism', () => {
  it('both top-level routes declare an errorElement', () => {
    expect(desktopRoutes.match(/errorElement:/g)?.length).toBe(2)
    expect(desktopRoutes).toMatch(/RouteErrorBoundary/)
  })

  it('it renders the SHARED fallback, not a second error screen', () => {
    expect(desktopError).toMatch(/ErrorFallbackView/)
    expect(desktopError).toMatch(/from '@hisabche\/ui'/)
  })

  it('signed in lands on the dashboard, signed out on the login screen', () => {
    expect(desktopError).toMatch(/destination === 'dashboard' \? '\/' : '\/login'/)
  })

  it('and it logs the routing error', () => {
    expect(desktopError).toMatch(/console\.error/)
  })
})
