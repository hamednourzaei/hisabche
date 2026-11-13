import { describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ============================================
// V63 — the admin screens for the items that were ⛔ in the 113 table.
//
//   1. every hook calls a route the backend actually declares (a typo in a
//      path is a 404 that type-checks);
//   2. each tab that gained a second list shows ONE section at a time, and
//      the tab's original view stays first so an old link lands where it did;
//   3. every read failure has a retry; the one write needs step-up + reason;
//   4. every key the screens read exists in fa, af and en (`t()` throws on a
//      missing key and takes the page down).
// ============================================

const adminRoot = path.resolve(__dirname, '..', '..')
const repoRoot = path.resolve(adminRoot, '..', '..')
const read = (relative: string) => fs.readFileSync(path.join(adminRoot, relative), 'utf-8')
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const PANELS = [
  'app/[lang]/(admin)/security/failed-logins-panel.tsx',
  'app/[lang]/(admin)/security/permission-matrix.tsx',
  'app/[lang]/(admin)/security/certificates-panel.tsx',
  'app/[lang]/(admin)/operations/maintenance-panel.tsx',
  'app/[lang]/(admin)/operations/migrations-panel.tsx',
  'app/[lang]/(admin)/operations/email-delivery-panel.tsx',
  'app/[lang]/(admin)/revenue/gateways/gateway-analytics-panel.tsx',
  'app/[lang]/(admin)/dashboard/revenue-forecast-panel.tsx',
  'app/[lang]/(admin)/dashboard/signup-funnel-panel.tsx',
  'app/[lang]/(admin)/users/user-activity-sheet.tsx',
  'app/[lang]/(admin)/product/api-usage-panel.tsx',
  'components/customers/workspace-usage-section.tsx',
]

function lookup(tree: unknown, dotted: string): unknown {
  let node: unknown = tree
  for (const part of dotted.split('.')) {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part]
    } else return undefined
  }
  return node
}

describe('V63 admin insights — wiring', () => {
  it('every hook path is a route the backend declares', () => {
    const hooks = strip(read('hooks/use-admin-insights.ts'))
    const routes = fs.readFileSync(
      path.join(repoRoot, 'backend/src/routes/admin-insights.routes.ts'),
      'utf-8',
    )
    const called = [...hooks.matchAll(/apiClient\.(get|put)\(\s*[`']([^`']+)[`']/g)].map((m) => {
      const pathOnly = (m[2] ?? '').replace(/\$\{[^}]+\}/g, ':id')
      return `${(m[1] ?? '').toUpperCase()} /api${pathOnly}`
    })
    expect(called.length).toBeGreaterThanOrEqual(12)
    const declared = new Set(
      [...routes.matchAll(/fastify\.(get|put)\(\s*'([^']+)'/g)].map(
        (m) => `${(m[1] ?? '').toUpperCase()} ${m[2]}`,
      ),
    )
    expect(called.filter((call) => !declared.has(call))).toEqual([])
  })

  it('the tabs that gained a list switch sections, original view first', () => {
    const expectations: Array<[string, string, string]> = [
      ['app/[lang]/(admin)/security/security-client.tsx', "id: 'events'", "id: 'failed_logins'"],
      ['app/[lang]/(admin)/security/security-client.tsx', "id: 'checks'", "id: 'certificates'"],
      ['app/[lang]/(admin)/operations/operations-client.tsx', "id: 'probes'", "id: 'migrations'"],
      ['app/[lang]/(admin)/operations/operations-client.tsx', "id: 'jobs'", "id: 'email'"],
      [
        'app/[lang]/(admin)/operations/operations-client.tsx',
        "id: 'announcements'",
        "id: 'maintenance'",
      ],
      ['app/[lang]/(admin)/revenue/revenue-client.tsx', "id: 'gateways'", "id: 'analytics'"],
      ['app/[lang]/(admin)/product/product-client.tsx', "id: 'apps'", "id: 'api_usage'"],
    ]
    for (const [file, first, second] of expectations) {
      const source = strip(read(file))
      expect(source, file).toContain('<TabSections')
      const a = source.indexOf(first)
      const b = source.indexOf(second)
      expect(a, `${file} ${first}`).toBeGreaterThan(-1)
      expect(b, `${file} ${second}`).toBeGreaterThan(a)
    }
    const switcher = strip(read('components/admin-shell/tab-sections.tsx'))
    expect(switcher).toContain('useHubSection')
    expect(switcher).toContain('<SegmentedControl')
  })

  it('the role cards were replaced by the matrix, which reads the enforced catalogue', () => {
    const security = strip(read('app/[lang]/(admin)/security/security-client.tsx'))
    expect(security).toContain('<PermissionMatrix />')
    expect(security).not.toContain("t('admin.security.fixedRolesTitle')")
    const matrix = strip(read('app/[lang]/(admin)/security/permission-matrix.tsx'))
    expect(matrix).toContain('useAdminRoles()')
    expect(matrix).toContain('allPermissions')
  })

  it('the panels are mounted where the 113 table says', () => {
    expect(read('app/[lang]/(admin)/dashboard/dashboard-client.tsx')).toContain(
      '<SignupFunnelPanel />',
    )
    expect(read('app/[lang]/(admin)/dashboard/dashboard-client.tsx')).toContain(
      '<RevenueForecastPanel />',
    )
    expect(read('components/customers/workspace-360-sheet.tsx')).toContain('<WorkspaceUsageSection')
    expect(read('app/[lang]/(admin)/users/users-client.tsx')).toContain('<UserActivitySheet')
  })

  it('every panel retries a failed read', () => {
    for (const file of PANELS) {
      const source = strip(read(file))
      expect(source, file).toContain('<ErrorState')
      expect(source, file).toContain('onRetry={() => void refetch()}')
    }
  })

  it('the maintenance switch needs a second factor and a reason', () => {
    const source = strip(read('app/[lang]/(admin)/operations/maintenance-panel.tsx'))
    expect(source).toContain('<StepUpDialog')
    expect(source).toContain('requireReason')
    expect(strip(read('hooks/use-admin-insights.ts'))).toContain(
      "'X-Admin-Step-Up-Timestamp': stepUpTimestamp",
    )
  })

  it('no figure is formatted outside admin-format, and no percent sign is hard-coded', () => {
    for (const file of PANELS) {
      const source = strip(read(file))
      expect(source, file).not.toMatch(/toLocale(String|DateString|TimeString)\(/)
      expect(source, file).not.toContain('٪')
    }
  })

  it('switching person never shows the previous person’s timeline', () => {
    expect(strip(read('hooks/use-admin-insights.ts'))).not.toContain('keepPreviousData')
    expect(strip(read('app/[lang]/(admin)/users/user-activity-sheet.tsx'))).toContain(
      'key={user.id}',
    )
  })

  it('every admin.insights key the screens read exists in fa, af and en', () => {
    const generated = [
      ...['SUPER', 'BILLING', 'SUPPORT', 'CONTENT', 'MARKET', 'OPS', 'SECURITY'].map(
        (r) => `admin.insights.matrix.roles.${r}`,
      ),
      ...[
        'billing',
        'offline',
        'customers',
        'product',
        'operations',
        'content',
        'security',
        'admin',
      ].map((a) => `admin.insights.matrix.areas.${a}`),
      ...['ok', 'warning', 'critical', 'expired', 'unreachable'].map(
        (s) => `admin.insights.certificates.states.${s}`,
      ),
      ...['applied', 'not_applied', 'unknown'].map((s) => `admin.insights.migrations.states.${s}`),
      ...['pending', 'sending', 'sent', 'failed'].map((s) => `admin.insights.email.status.${s}`),
      ...['signed_up', 'created_business', 'paid'].map((s) => `admin.insights.funnel.steps.${s}`),
      ...[
        'members',
        'activeDevices',
        'invoices',
        'aiQueries',
        'apiRequests',
        'activeApiKeys',
        'storageBytes',
      ].map((s) => `admin.insights.usage.metrics.${s}`),
    ]
    const used = new Set<string>(generated)
    for (const file of PANELS) {
      for (const m of read(file).matchAll(/'(admin\.insights\.[A-Za-z0-9_.]+)'/g))
        used.add(m[1] ?? '')
    }
    const missing: string[] = []
    for (const locale of ['fa', 'af', 'en'] as const) {
      const bundle = JSON.parse(
        fs.readFileSync(
          path.join(repoRoot, 'packages/i18n/messages', locale, 'common.json'),
          'utf-8',
        ),
      ) as unknown
      for (const key of used) {
        const value = lookup(bundle, key)
        if (typeof value !== 'string' || value.trim() === '') missing.push(`${locale}:${key}`)
      }
    }
    expect(used.size).toBeGreaterThan(100)
    expect(missing).toEqual([])
  })
})
