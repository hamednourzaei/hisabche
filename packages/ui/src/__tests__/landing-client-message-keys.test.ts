// The landing page ships only part of `landing.*` to the browser
// (LANDING_CLIENT_KEY_PREFIXES in apps/web/app/[lang]/scoped-messages.tsx).
// Any landing key read by a CLIENT component must fall under those prefixes, or
// the browser shows the fallback/raw key instead of the translation.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ui = (p: string) => readFileSync(join(__dirname, '../components/ui', p), 'utf8')
const scoped = readFileSync(
  join(__dirname, '../../../../apps/web/app/[lang]/scoped-messages.tsx'),
  'utf8',
)
const prefixes = JSON.parse(
  scoped.match(/LANDING_CLIENT_KEY_PREFIXES = (\[[^\]]*\])/)![1]!.replace(/'/g, '"'),
) as string[]

const CLIENT_FILES = [
  'landing/pricing-scene.tsx',
  'landing/faq-scene.tsx',
  'landing/site-footer.tsx',
  'landing/landing-shell.tsx',
  'landing/landing-client-sections.tsx',
  'navigation/top-nav.tsx',
]

describe('landing client message subset', () => {
  it('every landing.* key a client component reads is shipped', () => {
    const keys = new Set<string>()
    for (const f of CLIENT_FILES) {
      for (const m of ui(f).matchAll(/landing\.([a-zA-Z]+)/g)) keys.add(m[1]!)
    }
    expect(keys.size).toBeGreaterThan(10)
    expect([...keys].filter((k) => !prefixes.some((p) => k.startsWith(p)))).toEqual([])
  })
})
