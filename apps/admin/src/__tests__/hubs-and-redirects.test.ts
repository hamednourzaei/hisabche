import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { ADMIN_NAV } from '../../components/admin-shell/admin-nav'

describe('Admin 8 Hubs & Redirects', () => {
  const monorepoRoot = path.resolve(__dirname, '../../../../')
  const expectedHubs = [
    'dashboard',
    'customers',
    'revenue',
    'offline',
    'product',
    'operations',
    'content',
    'security',
  ]

  it('ADMIN_NAV defines exactly the 8 target hubs in order', () => {
    const hubIds = ADMIN_NAV.map((item) => item.id)
    expect(hubIds).toEqual(expectedHubs)
  })

  it('every hub has localized title and description in fa, af, and en', () => {
    const locales = ['fa', 'af', 'en'] as const

    for (const locale of locales) {
      const messagesPath = path.join(monorepoRoot, `packages/i18n/messages/${locale}/common.json`)
      const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf-8'))

      for (const hub of expectedHubs) {
        expect(messages.admin?.nav?.[hub], `Missing admin.nav.${hub} in ${locale}`).toBeTruthy()
        expect(
          messages.admin?.nav?.[`${hub}Desc`],
          `Missing admin.nav.${hub}Desc in ${locale}`,
        ).toBeTruthy()
        expect(
          messages.admin?.hubs?.[hub]?.title,
          `Missing admin.hubs.${hub}.title in ${locale}`,
        ).toBeTruthy()
      }
    }
  })

  it('all 8 hub pages exist under apps/admin/app/[lang]/(admin)/', () => {
    const adminAppDir = path.resolve(__dirname, '../../app/[lang]/(admin)')

    for (const hub of expectedHubs) {
      const pagePath = path.join(adminAppDir, hub, 'page.tsx')
      expect(fs.existsSync(pagePath), `Page for hub ${hub} must exist at ${pagePath}`).toBe(true)
    }
  })

  it('redirects table covers all legacy routes in next.config.js and proxy.ts', () => {
    const nextConfigPath = path.resolve(__dirname, '../../next.config.js')
    const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf-8')

    const legacyRoutes = [
      'workspaces',
      'users',
      'subscriptions',
      'wallet',
      'ai',
      'oauth-apps',
      'market',
      'servers',
      'blog',
      'audit-logs',
    ]

    for (const route of legacyRoutes) {
      expect(nextConfigContent).toContain(`/${route}`)
    }

    const proxyPath = path.resolve(__dirname, '../../proxy.ts')
    const proxyContent = fs.readFileSync(proxyPath, 'utf-8')

    for (const route of legacyRoutes) {
      expect(proxyContent).toContain(`'/${route}'`)
    }
  })
})
