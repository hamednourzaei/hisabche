// ============================================
// The customer portal on screen: the public page on every host, hidden from
// crawlers; the panel on the customer's account tab; every sentence in three
// languages; and the «latest 100» line equal to the server's real limit.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../../../..')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (p: string) => strip(readFileSync(join(ROOT, p), 'utf8'))
const catalog = (lang: string) =>
  JSON.parse(readFileSync(join(ROOT, 'packages/i18n/messages', lang, 'common.json'), 'utf8')) as {
    portal: Record<string, string>
  }

describe('the customer portal', () => {
  it('the public page exists on web and desktop, and crawlers are kept out', () => {
    expect(read('apps/web/app/[lang]/portal/[token]/page.tsx')).toContain(
      '<PublicPortalContainer token={token} />',
    )
    expect(read('apps/web/app/[lang]/portal/[token]/page.tsx')).toContain('index: false')
    expect(read('packages/app-shell/src/app/app.tsx')).toContain(
      "{ path: 'portal/:token', element: <PublicPortalPage /> }",
    )
    const robots = readFileSync(join(ROOT, 'apps/web/app/robots.ts'), 'utf8')
    expect(robots).toContain("'/portal/'")
    expect(robots).toContain("'/*/portal/'")
  })

  it('the panel is on the customer’s account tab', () => {
    const view = read('packages/ui/src/components/ui/customers/customer-detail-view.tsx')
    const account = view.slice(view.indexOf('<TabsContent value="account">'))
    expect(account.slice(0, 300)).toContain('<CustomerPortalPanel customerId={customer.id} />')
  })

  it('a dead link and a failed request are different sentences', () => {
    const page = read(
      'packages/ui/src/components/ui/customers/containers/public-portal-container.tsx',
    )
    expect(page).toContain("if (res.status === 404) return setState({ kind: 'gone' })")
    expect(page).toContain("t('portal.gone')")
    expect(page).toContain("t('portal.loadError')")
  })

  it('«latest 100» says the server’s real limit', () => {
    const service = read('backend/src/services/customer-portal/customer-portal.service.ts')
    expect(service).toContain('export const PORTAL_LIST_LIMIT = 100')
    for (const lang of ['fa', 'af', 'en']) {
      expect(catalog(lang).portal.showingLatest).toMatch(/100|۱۰۰/)
    }
  })
})
