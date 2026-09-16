// about / contact / legal / features ship only CORE namespaces plus the
// `landing.*` keys under PUBLIC_PAGE_KEY_PREFIXES (apps/web/app/[lang]/
// scoped-messages.tsx). A key outside that set renders its fallback — or the raw
// key — in the browser, so every key their client components read is checked.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB = join(__dirname, '../../../../apps/web/app/[lang]')
const UI = join(__dirname, '../components/ui')
const scoped = readFileSync(join(WEB, 'scoped-messages.tsx'), 'utf8')
const list = (name: string) =>
  [...scoped.match(new RegExp(`${name} = \\[([^\\]]*)\\]`))![1]!.matchAll(/'([^']+)'/g)].map(
    (m) => m[1]!,
  )
const core = list('CORE_NAMESPACES')
const prefixes = list('PUBLIC_PAGE_KEY_PREFIXES')

const CLIENT_FILES = [
  join(WEB, 'legal/LegalPageClient.tsx'),
  join(WEB, 'contact/ContactPageClient.tsx'),
  join(WEB, 'features/FeaturePageClient.tsx'),
  join(UI, 'landing/site-footer.tsx'),
  join(UI, 'landing/site-footer-view.tsx'),
]

describe('public page message subset', () => {
  const keys = CLIENT_FILES.flatMap((file) => [
    ...readFileSync(file, 'utf8').matchAll(/\b(?:t|safeT)\(\s*[`']([a-zA-Z]+)\.([a-zA-Z]*)/g),
  ]).map((m) => [m[1]!, m[2]!] as const)

  it('found the keys', () => {
    expect(keys.length).toBeGreaterThan(15)
  })

  it('every namespace read is shipped', () => {
    const missing = keys.filter(
      ([ns, key]) =>
        !core.includes(ns) && !(ns === 'landing' && prefixes.some((p) => key.startsWith(p))),
    )
    expect(missing.map((k) => k.join('.'))).toEqual([])
  })

  it('the four route trees use the scoped layout', () => {
    for (const dir of ['about', 'contact', 'legal', 'features'])
      expect(readFileSync(join(WEB, dir, 'layout.tsx'), 'utf8')).toContain(
        'PublicPageMessagesLayout',
      )
  })
})
