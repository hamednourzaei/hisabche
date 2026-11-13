import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * V63 · S-4 — the admin console's response headers are a control, so they are
 * pinned here.
 *
 * These are source assertions, not a server test: the console needs an AAL2
 * admin session that CI does not have. Each assertion names the header and the
 * property that matters, so an edit that removes it fails a test instead of a
 * penetration report.
 *
 * The split matters and is asserted in both directions:
 *
 *  - next.config.js carries the STATIC headers (HSTS, Permissions-Policy, COOP);
 *  - proxy.ts builds the CSP WITH A NONCE per request, because a static CSP
 *    either needs 'unsafe-inline' or breaks Next's inline bootstrap;
 *  - the CSP must not ALSO be set in next.config.js — Next applies its headers
 *    after the middleware and the browser then intersects both policies, which
 *    silently breaks the app.
 */

const adminRoot = path.resolve(__dirname, '../..')

function read(relative: string): string {
  return fs.readFileSync(path.join(adminRoot, relative), 'utf-8')
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

describe('admin security headers', () => {
  const config = read('next.config.js')

  it('sends HSTS for two years with subdomains and preload', () => {
    expect(config).toContain('Strict-Transport-Security')
    expect(config).toContain('max-age=63072000; includeSubDomains; preload')
  })

  it('turns off camera, microphone and geolocation', () => {
    expect(config).toContain('Permissions-Policy')
    expect(config).toContain('camera=()')
    expect(config).toContain('microphone=()')
    expect(config).toContain('geolocation=()')
  })

  it('keeps the console in its own browsing context group', () => {
    expect(config).toContain('Cross-Origin-Opener-Policy')
    expect(config).toContain("'same-origin'")
  })

  it('keeps the frame, sniffing and referrer headers it already had', () => {
    expect(config).toContain("value: 'DENY'")
    expect(config).toContain('nosniff')
    expect(config).toContain('strict-origin-when-cross-origin')
    expect(config).toContain('noindex, nofollow, noarchive, nosnippet')
  })

  it('does not set a static CSP in next.config.js', () => {
    expect(stripComments(config)).not.toContain('Content-Security-Policy')
  })
})

describe('admin CSP is generated per request', () => {
  const proxy = stripComments(read('proxy.ts'))

  it('generates a fresh nonce and forwards it to Next', () => {
    expect(proxy).toContain('crypto.randomUUID()')
    expect(proxy).toContain("requestHeaders.set('x-nonce', nonce)")
    expect(proxy).toContain("requestHeaders.set('Content-Security-Policy', csp)")
  })

  it('sets the response policy with the same nonce', () => {
    expect(proxy).toContain("response.headers.set('Content-Security-Policy', csp)")
  })

  it('locks the document down', () => {
    expect(proxy).toContain("default-src 'self'")
    expect(proxy).toContain("frame-ancestors 'none'")
    expect(proxy).toContain("object-src 'none'")
    expect(proxy).toContain("base-uri 'none'")
    expect(proxy).toContain("form-action 'self'")
    expect(proxy).toContain("'nonce-${nonce}'")
    expect(proxy).toContain("'strict-dynamic'")
  })

  it('allows eval only outside production', () => {
    // A production build must never eval: the term is behind the `dev` flag and
    // never unconditional.
    expect(proxy).toContain("dev ? \" 'unsafe-eval'\" : ''")
  })

  it('never returns a bare NextResponse.next() without the headers', () => {
    expect(proxy).not.toMatch(/return\s+NextResponse\.next\(\)/)
  })

  it('forbids caching an admin page', () => {
    expect(proxy).toContain("response.headers.set('Cache-Control', 'no-store, max-age=0')")
  })

  it('reaches only the configured API and Supabase origins', () => {
    expect(proxy).toContain('NEXT_PUBLIC_API_URL')
    expect(proxy).toContain('NEXT_PUBLIC_SUPABASE_URL')
    expect(proxy).toContain("'self'")
    // No wildcard connect source: that would allow any host to receive data.
    expect(proxy).not.toContain('connect-src *')
  })
})
