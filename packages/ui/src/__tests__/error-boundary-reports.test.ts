// ============================================
// A caught crash has to be reported somewhere a person will see it.
//
// ---------------------------------------------------------------------------
// ⚠️ WHAT THIS COST
//
// `apps/web` ships three Sentry configs — client, server and edge — and the
// one component that catches EVERY React crash reported to none of them.
// `ErrorBoundary` wrote to `console.error`, and `next.config` strips
// `console.log` in production while keeping `error`, so the message landed in
// a browser console nobody reads and was then gone.
//
// A live `ReferenceError: Cannot access 'Y' before initialization` reached a
// user and could not be diagnosed from source: `'Y'` is a MINIFIED name, and
// with no report there was no source map, no component stack and no route to
// resolve it against. A full import-graph scan of the monorepo found exactly
// one cycle, in a package `apps/web` cannot even reach — so the source told us
// nothing, and the one artefact that could have (the report) was never sent.
//
// The boundary itself stays framework-agnostic: it takes `onError`, and the
// web app supplies the Sentry reporter. Desktop and mobile have no Sentry and
// must not be made to depend on it.
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

const ROOT = join(__dirname, '..', '..', '..', '..')
const boundary = code(join(__dirname, '..', 'components', 'ui', 'error-boundary.tsx'))
const webWrapper = code(join(ROOT, 'apps', 'web', 'app', '[lang]', 'client-error-boundary.tsx'))

describe('the boundary stays portable', () => {
  it('⚠️ does not import Sentry itself', () => {
    // Desktop (Electron) and mobile (React Native) render this same component
    // and have no Sentry. The reporter is injected, not baked in.
    expect(boundary).not.toContain('@sentry')
  })

  it('offers the hook the app plugs into', () => {
    expect(boundary).toContain('onError?')
    expect(boundary).toContain('this.props.onError?.(error, errorInfo)')
  })

  it('still logs locally, for the case where no reporter is wired', () => {
    expect(boundary).toContain('console.error')
  })
})

describe('the web app actually reports', () => {
  it('⚠️ passes a reporter to the root boundary', () => {
    // This is the assertion that would have failed for the whole time the
    // production crash was undiagnosable.
    expect(webWrapper).toContain('onError={report}')
  })

  it('sends the error to Sentry', () => {
    expect(webWrapper).toContain('Sentry.captureException(error)')
  })

  it('⚠️ attaches the component stack as CONTEXT, not as the message', () => {
    // Putting the stack in the message makes Sentry group every screen as a
    // separate issue, which buries the pattern instead of showing it.
    expect(webWrapper).toContain('scope.setContext(')
    expect(webWrapper).toContain('componentStack')
  })

  it('records which route and which locale crashed', () => {
    // Without these, a minified name is still all anyone has.
    expect(webWrapper).toContain('pathname,')
    expect(webWrapper).toContain('locale: lang,')
  })
})
