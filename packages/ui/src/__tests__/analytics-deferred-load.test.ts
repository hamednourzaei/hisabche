// Analytics must not load inside the page-load window. Measured on PageSpeed
// (mobile, slow 4G): with PostHog + gtag starting from a 12 s fallback timer,
// Total Blocking Time went from 0.56 s to 6.1 s. They start on a real person's
// first tap / click / key / wheel only — never on a timer, never on `scroll`
// (layout changes fire scroll events without anyone touching the page).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const web = (p: string) =>
  readFileSync(join(__dirname, '../../../../apps/web/app/[lang]', p), 'utf8')

describe('analytics start on engagement only', () => {
  it('gtag loader: engagement events, no timer, no scroll', () => {
    const layout = web('layout.tsx')
    const inline = layout.slice(layout.indexOf('id="google-analytics"'))
    const script = inline.slice(0, inline.indexOf('}}'))
    expect(script).toContain("'pointerdown','keydown','touchstart','wheel'")
    expect(script).not.toContain('setTimeout')
    expect(script).not.toContain("'scroll'")
    expect(layout).not.toContain(
      'strategy="afterInteractive"\n          src="https://www.googletagmanager.com',
    )
  })

  it('PostHog/Sentry bootstrap: engagement events, no timer, no idle callback', () => {
    const src = web('heavy-providers.tsx')
    const fn = src.slice(src.indexOf('function loadAnalytics'), src.indexOf('// ─── Adaptive UI'))
    expect(fn).toContain("['pointerdown', 'keydown', 'touchstart', 'wheel']")
    expect(fn).not.toMatch(/setTimeout|requestIdleCallback/)
  })
})
