// ============================================
// One UX. The «قبل / بعد» comparison is over (owner's decision, 5 Oct 2026):
// «بعد» is the product on the web, on Windows and on mobile.
//
// What can go wrong: a version check left behind (a screen that still has two
// layouts); the switch still mounted; a page that became a section still sitting
// in the menu beside the page that holds it; and — the owner's own worry —
// something «بعد» needs having been removed with «قبل».
// ============================================

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NAV_CONTRACT } from '@hisabche/ui-contract'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
const ui = (...parts: string[]) => read('packages', 'ui', 'src', 'components', 'ui', ...parts)

function sources(folder: string): string[] {
  if (!existsSync(folder)) return []
  return readdirSync(folder).flatMap((name) => {
    if (name === 'node_modules' || name === '__tests__' || name.startsWith('.')) return []
    const path = join(folder, name)
    if (statSync(path).isDirectory()) return sources(path)
    return name.endsWith('.ts') || name.endsWith('.tsx') ? [path] : []
  })
}

describe('the comparison is gone', () => {
  it('no source file reads, sets or shows a UX version', () => {
    const roots = [
      join(ROOT, 'packages', 'ui', 'src'),
      join(ROOT, 'packages', 'app-shell', 'src'),
      join(ROOT, 'packages', 'store', 'src'),
      join(ROOT, 'packages', 'ui-contract', 'src'),
      join(ROOT, 'apps', 'web', 'app'),
    ]
    const words = ['useUxVersion', 'visibleInUx', 'UxVersionSwitch', 'uxVersion', 'UX_VERSIONS']
    const left = roots
      .flatMap(sources)
      .filter((path) => words.some((word) => readFileSync(path, 'utf8').includes(word)))
      .map((path) => path.slice(ROOT.length + 1))
    expect(left).toEqual([])
  })

  it('the switch component and its words are gone', () => {
    expect(
      existsSync(join(ROOT, 'packages', 'ui', 'src', 'components', 'ui', 'ux-version-switch.tsx')),
    ).toBe(false)
    for (const lang of ['fa', 'af', 'en']) {
      const words = JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json'))
      expect(words.uxSwitch, lang).toBeUndefined()
    }
  })

  it('a page that became a section is not in the menu beside its hub', () => {
    const folded = [
      '/tasks',
      '/campaigns',
      '/promotions',
      '/expiry',
      '/timesheets',
      '/assets',
      '/bank',
      '/budgets',
      '/workflow-templates',
      '/sync-center',
      '/conflicts',
      '/data-migration',
      '/wallet',
      '/referrals',
      '/sales-workspace',
      '/inventory-workspace',
      '/accounting-workspace',
      '/people-workspace',
    ]
    const menu = NAV_CONTRACT.map((item) => item.path)
    expect(folded.filter((path) => menu.includes(path))).toEqual([])
    // …nor a page of its own: its address opens the section, on every platform.
    // (/sync-center stays — on Windows it is the device's own outbox screen.)
    const config = read('apps', 'web', 'next.config.js')
    // Flattened: the formatter wraps a long route over several lines.
    const router = read('packages', 'app-shell', 'src', 'app', 'app.tsx').split(/\s+/).join(' ')
    for (const path of folded.filter((item) => item !== '/sync-center')) {
      const name = path.slice(1)
      expect(
        existsSync(join(ROOT, 'apps', 'web', 'app', '[lang]', '(dashboard)', name)),
        `${path} is still a web page`,
      ).toBe(false)
      expect(config, path).toContain(`['${name}', '`)
      expect(router, path).toContain(`{ path: '${name}', element: <Navigate to="/`)
    }
    // …and the hubs themselves are.
    for (const hub of [
      '/invoices',
      '/warehouse',
      '/accounting',
      '/customers',
      '/team-and-payroll',
      '/approvals',
      '/data-and-sync',
      '/billing',
      '/settings',
    ]) {
      expect(menu, hub).toContain(hub)
    }
  })
})

describe('nothing «بعد» needs went with «قبل»', () => {
  // Every hub still mounts every screen it held. The left column is the hub,
  // the right is what must still be in it.
  it.each([
    [
      'invoices/containers/sales-hub-container.tsx',
      ['<InvoicesContainer />', '<PromotionsContainer />'],
    ],
    [
      'warehouse/containers/warehouse-tabs-container.tsx',
      [
        '<WarehouseStockTab />',
        '<ProductListContainer />',
        '<ExpiryContainer />',
        '<OpsSectionContainer',
      ],
    ],
    [
      'accounting/AccountingPage.tsx',
      [
        '<AccountsTab />',
        '<JournalTab />',
        '<MonthEndTab />',
        '<BankContainer />',
        '<AssetsContainer />',
        '<FinancingTab />',
        '<TrialBalanceTab />',
        '<BalanceSheetTab />',
        '<IncomeStatementTab />',
        '<BudgetsContainer />',
        '<PostUnpostedAction />',
        '<BranchScopeProvider>',
      ],
    ],
    [
      'customers/containers/customers-hub-container.tsx',
      [
        '<CustomersContainer />',
        '<CrmContainer />',
        '<CampaignsContainer />',
        '<OpsSectionContainer',
      ],
    ],
    [
      'team-and-payroll/containers/team-and-payroll-container.tsx',
      ['<TeamAndPayrollScreen', '<TimesheetsContainer />', '<BranchTreeView', '<AttendanceSheet'],
    ],
    [
      'workflow/containers/approvals-hub-container.tsx',
      ['<ApprovalsContainer', '<WorkflowTemplatesContainer />'],
    ],
    [
      'data-and-sync/containers/data-hub-container.tsx',
      [
        '<DataAndSyncContainer />',
        '<SyncCenterContainer />',
        '<ConflictsContainer />',
        '<DataMigrationContainer />',
      ],
    ],
    [
      'billing/containers/billing-hub-container.tsx',
      ['<BillingContainer />', '<WalletContainer />', '<ReferralsContainer />'],
    ],
    [
      'settings/settings-hub-container.tsx',
      ['<SettingsPage />', '<DevelopersContainer />', '<MarketplaceContainer />'],
    ],
    [
      'governance/containers/governance-hub-container.tsx',
      [
        '<GovernanceOverview',
        '<WorkspaceContainer />',
        '<PermissionsContainer />',
        '<ApprovalsContainer />',
        '<GovernanceContainer />',
        '<AuditContainer />',
      ],
    ],
    ['activity/ActivitiesPage.tsx', ['<HubTabs', '<SegmentedControl', '<AuditContainer />']],
    [
      'analysis/analysis-container.tsx',
      [
        '<Collections',
        '<Suppliers',
        '<BreakEven',
        '<Cohorts',
        '<WorkingCapital',
        '<PeerBenchmark />',
        '<ReportBuilder />',
      ],
    ],
  ] as Array<[string, string[]]>)('%s', (file, mounts) => {
    const source = ui(...file.split('/'))
    for (const mount of mounts) expect(source, `${file} → ${mount}`).toContain(mount)
  })

  it('the customer page still has all nine parts', () => {
    const view = ui('customers', 'customer-detail-view.tsx')
    const parts = [...view.matchAll(/<TabsContent value="(\w+)"/g)].map((match) => match[1])
    expect(parts).toHaveLength(9)
    expect(view).toContain('<HubTabs')
    expect(view).toContain('<SegmentedControl')
  })

  it('both shells still mount the hubs', () => {
    const web = (route: string) =>
      read('apps', 'web', 'app', '[lang]', '(dashboard)', route, 'page.tsx')
    expect(web('invoices')).toContain('<SalesHubContainer />')
    expect(web('customers')).toContain('<CustomersHubContainer />')
    expect(web('approvals')).toContain('<ApprovalsHubContainer />')
    expect(web('data-and-sync')).toContain('<DataHubContainer />')
    expect(web('billing')).toContain('<BillingHubContainer />')
    expect(web('settings')).toContain('<SettingsHubContainer />')
    const shell = read('packages', 'app-shell', 'src', 'features', 'settings', 'settings-page.tsx')
    expect(shell).toContain('<SettingsHubContainer general={renderDesktopSettings} />')
  })
})
