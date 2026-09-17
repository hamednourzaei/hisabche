// Search Console: a dotted path (`/wp-login.php`, `/sitemap-0.xml`) skips the
// proxy and reached `[lang]` as the locale; the layout fell back to `fa` and
// served the full landing page with 200 and a canonical to /fa.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const code = (s: string) => s.replace(/^\s*\/\/.*$/gm, '')
const layout = code(
  readFileSync(join(__dirname, '../../../../apps/web/app/[lang]/layout.tsx'), 'utf8'),
)
const proxy = readFileSync(join(__dirname, '../../../../apps/web/proxy.ts'), 'utf8')

describe('an unknown [lang] segment is a 404, not the Persian home page', () => {
  it('the proxy still skips dotted paths, so the layout must be the guard', () => {
    expect(proxy).toContain('[a-zA-Z0-9]+$).*)')
  })
  it('RootLayout calls notFound() for a segment that is not a locale, before rendering', () => {
    const body = layout.slice(layout.indexOf('export default async function RootLayout'))
    const guard = body.indexOf('if (!isLocale(lang)) notFound()')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(body.indexOf('setRequestLocale('))
  })
})
