import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Guard test for the admin redesign (B1/B2/B3/B5/B6).
 *
 * These are source assertions, not a rendered-DOM test: the console needs an
 * authenticated AAL2 session, which is not available in CI. Each assertion
 * pins one rule that a future edit could quietly undo:
 *
 *  - the shell has one skip link and one main landmark,
 *  - shell navigation goes through the locale-aware helpers,
 *  - converted screens format dates and money through `lib/admin-format`,
 *  - converted screens list through the shared `DataTable`,
 *  - every key the redesign added exists in fa, af and en.
 */

const adminRoot = path.resolve(__dirname, '../../')

function read(relative: string): string {
  return fs.readFileSync(path.join(adminRoot, relative), 'utf-8')
}

/** Comments mention the old patterns, so they must not count as usage. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function messages(locale: 'fa' | 'af' | 'en'): Record<string, unknown> {
  const file = path.resolve(adminRoot, `../../packages/i18n/messages/${locale}/common.json`)
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>
}

function lookup(source: Record<string, unknown>, dotted: string): unknown {
  let node: unknown = source
  for (const part of dotted.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return node
}

describe('admin redesign guards', () => {
  it('the shell has exactly one skip link and one main landmark', () => {
    const layout = stripComments(read('app/[lang]/(admin)/dashboard-layout.tsx'))

    expect(layout.split('href="#admin-main"').length - 1).toBe(1)
    expect(layout.split('id="admin-main"').length - 1).toBe(1)
    expect(layout).toContain('admin.shell.skipToContent')
    // The skip link must be the first focusable element in the shell.
    expect(layout.indexOf('href="#admin-main"')).toBeLessThan(layout.indexOf('<AdminSidebar'))
    expect(layout.indexOf('href="#admin-main"')).toBeLessThan(layout.indexOf('<main'))
  })

  it('the permanent rail sticks to the viewport the way the header does', () => {
    const layout = stripComments(read('app/[lang]/(admin)/dashboard-layout.tsx'))

    // The desktop rail's own wrapper, not the mobile Sheet.
    const rail = layout.indexOf('<AdminSidebar')
    const wrapperStart = layout.lastIndexOf('<div', rail)
    const wrapper = layout.slice(wrapperStart, rail)

    // Compare class tokens, not substrings: `z-sticky` contains "sticky" and
    // would keep this guard green after the positioning was removed.
    const classAttribute = wrapper.match(/className="([^"]*)"/)
    expect(classAttribute).not.toBeNull()
    const tokens = (classAttribute?.[1] ?? '').split(/\s+/)

    expect(tokens).toContain('sticky')
    expect(tokens).toContain('top-0')
    expect(tokens).toContain('h-dvh')
    expect(tokens).toContain('shrink-0')
    expect(tokens).toContain('lg:block')

    // Only the nav scrolls inside the rail; the brand and operator stay put.
    const sidebar = stripComments(read('components/admin-shell/admin-sidebar.tsx'))
    const navStart = sidebar.indexOf('<nav')
    const nav = sidebar.slice(navStart, sidebar.indexOf('</nav>'))
    expect(nav).toContain('overflow-y-auto')
    expect(nav).toContain('min-h-0')
    expect(nav).toContain('flex-1')
  })

  it('shell navigation uses the locale-aware helpers, never a bare route', () => {
    const shellDir = path.join(adminRoot, 'components/admin-shell')
    const files = fs
      .readdirSync(shellDir)
      .filter((name) => name.endsWith('.tsx') || name.endsWith('.ts'))

    const offenders: string[] = []
    for (const name of files) {
      const source = stripComments(fs.readFileSync(path.join(shellDir, name), 'utf-8'))
      if (source.includes("router.push('/") || source.includes("router.replace('/")) {
        offenders.push(name)
      }
      if (source.includes('toLocaleString(') || source.includes('toLocaleDateString(')) {
        offenders.push(`${name} (locale-less formatter)`)
      }
    }

    expect(offenders).toEqual([])
  })

  it('the command palette is driven by the nav module and keeps the active tab', () => {
    const palette = stripComments(read('components/admin-shell/command-palette.tsx'))

    expect(palette).toContain('ADMIN_NAV')
    expect(palette).toContain('useLocalePush')
    expect(palette).toContain('defaultTab')
    expect(palette).toContain('DialogTitle')
  })

  it('converted screens list through the shared DataTable', () => {
    const screens: Array<[string, number]> = [
      ['app/[lang]/(admin)/security/security-client.tsx', 4],
      ['app/[lang]/(admin)/revenue/revenue-client.tsx', 3],
    ]

    for (const [file, expected] of screens) {
      const source = stripComments(read(file))
      expect(source.split('<DataTable').length - 1, file).toBe(expected)
      expect(source, file).not.toContain('<table className="w-full')
      expect(source, file).toContain("from '@/components/ui'")
    }
  })

  it('converted screens format every date and amount through lib/admin-format', () => {
    const screens = [
      'app/[lang]/(admin)/security/security-client.tsx',
      'app/[lang]/(admin)/revenue/revenue-client.tsx',
      'app/[lang]/(admin)/dashboard/dashboard-client.tsx',
    ]

    for (const file of screens) {
      const source = stripComments(read(file))
      expect(source, file).toContain("from '@/lib/admin-format'")
      expect(source, file).not.toContain('toLocaleString(')
      expect(source, file).not.toContain('toLocaleDateString(')
      expect(source, file).not.toContain('text-[10px]')
      expect(source, file).not.toContain('text-[11px]')
    }
  })

  it('the revenue screen derives each currency from the field that names it', () => {
    const source = stripComments(read('app/[lang]/(admin)/revenue/revenue-client.tsx'))

    // amount_irr is rial; the toman cell is the same field in IRT (1 toman = 10 rial).
    expect(source).toContain("adminMoney(p.amount_irr, 'IRR', locale)")
    expect(source).toContain("adminMoney(p.amount_irr / 10, 'IRT', locale)")
    // A label is not a currency: the old literal suffix is gone.
    expect(source).not.toContain('>IRR<')
    expect(source).not.toContain("{t('currency.toman')}")
  })

  it('a failed read renders an error state with a retry, never an empty list', () => {
    for (const file of [
      'app/[lang]/(admin)/security/security-client.tsx',
      'app/[lang]/(admin)/revenue/revenue-client.tsx',
      'app/[lang]/(admin)/dashboard/dashboard-client.tsx',
    ]) {
      const source = stripComments(read(file))
      expect(source, file).toContain('<ErrorState')
      expect(source, file).toContain('onRetry={() => void refetch')
    }
  })

  it('the admin barrel exports the table types the screens need', () => {
    const barrel = read('components/ui/index.ts')
    expect(barrel).toContain('DataTable,')
    expect(barrel).toContain('TableColumn,')
  })

  it('every key added by the redesign exists in fa, af and en', () => {
    const added = [
      'admin.shell.skipToContent',
      'admin.security.accountsLoadError',
      'admin.security.revokeSessionFor',
      'admin.dashboard.workspaceRef',
      'admin.dashboard.revenueUnavailableTitle',
      'admin.dashboard.revenueUnavailableHint',
      'admin.revenue.effectiveUntilOpen',
      'admin.offline.seatComputer',
      'admin.offline.seatMobile',
      'admin.offline.deviceActive',
      'admin.offline.deviceReleased',
      'admin.product.toggleAria',
      'admin.market.toggleDesc',
      'admin.blog.taxonomy.deleteDesc',
      'admin.blog.publish.deleteDesc',
      'admin.cms.globalsTitle',
      'admin.cms.globalsSubtitle',
      'admin.cms.addOrUpdate',
      'admin.cms.keyLabel',
      'admin.cms.contentLabel',
      'admin.cms.saveAndPublish',
      'admin.cms.keyPlaceholder',
      'admin.cms.contentPlaceholder',
      'admin.cms.emptyForLocale',
      'admin.cms.themeName',
      'admin.cms.editPage',
      'admin.cms.locales.fa',
      'admin.cms.locales.af',
      'admin.cms.locales.en',
    ]

    const missing: string[] = []
    for (const locale of ['fa', 'af', 'en'] as const) {
      const bundle = messages(locale)
      for (const key of added) {
        const value = lookup(bundle, key)
        if (typeof value !== 'string' || value.trim() === '') {
          missing.push(`${locale}:${key}`)
        }
      }
    }

    expect(missing).toEqual([])
  })

  it('no screen draws a raw table or a native select any more', () => {
    const offenders: string[] = []
    for (const file of adminSources()) {
      const source = stripComments(fs.readFileSync(file, 'utf-8'))
      if (/<table[\s>]/.test(source)) offenders.push(`${relative(file)}: <table>`)
      if (/<select[\s>]/.test(source)) offenders.push(`${relative(file)}: <select>`)
    }
    expect(offenders).toEqual([])
  })

  it('no screen formats a date or a count with the operator locale', () => {
    const offenders: string[] = []
    for (const file of adminSources()) {
      if (relative(file).endsWith('lib/admin-format.ts')) continue
      const source = stripComments(fs.readFileSync(file, 'utf-8'))
      if (/toLocale(String|DateString|TimeString)\(/.test(source)) {
        offenders.push(relative(file))
      }
    }
    expect(offenders).toEqual([])
  })

  it('no screen asks a question through window.confirm', () => {
    const offenders: string[] = []
    for (const file of adminSources()) {
      const source = stripComments(fs.readFileSync(file, 'utf-8'))
      if (/window\.confirm\(/.test(source) || /(^|[^.\w])confirm\(/.test(source)) {
        offenders.push(relative(file))
      }
    }
    expect(offenders).toEqual([])
  })

  it('no screen navigates with a bare route', () => {
    const offenders: string[] = []
    for (const file of adminSources()) {
      const source = stripComments(fs.readFileSync(file, 'utf-8'))
      if (/router\.(push|replace)\('\//.test(source)) offenders.push(relative(file))
    }
    expect(offenders).toEqual([])
  })

  it('no admin text is smaller than 12px', () => {
    const offenders: string[] = []
    for (const file of adminSources()) {
      const source = stripComments(fs.readFileSync(file, 'utf-8'))
      if (/text-\[(?:9|10|11)px\]/.test(source)) offenders.push(relative(file))
    }
    expect(offenders).toEqual([])
  })
})

/** Every .ts/.tsx file the admin app owns, tests and generated output excluded. */
function adminSources(): string[] {
  const skip = new Set(['node_modules', '.next', '__tests__', 'dist'])
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(ts|tsx)$/.test(entry.name) && entry.name !== 'next-env.d.ts') out.push(full)
    }
  }
  walk(adminRoot)
  return out
}

function relative(file: string): string {
  return path.relative(adminRoot, file).replace(/\\/g, '/')
}
