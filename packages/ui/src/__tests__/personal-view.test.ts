// ============================================
// «نمای شخصی» and «دسترسی ندارید» — two different things, kept apart.
//
//   permission      the role decides. A denied page is NOT MOUNTED (so it does
//                   not fetch), is not in the menu and is not prefetched.
//   personal view   the person decides, among what they may see. A hidden part
//                   is NOT MOUNTED and its query and live channel do not run.
//
// What can go wrong: hiding with CSS while the part keeps fetching; a part
// fetching before the stored choice is known; the choice following a person
// into another business, or to the next person on the same computer; a hidden
// id showing a part the role does not include; a denied page mounting and
// firing twenty refused requests; a menu or a hub emptied with no way back.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isRouteDenied } from '@hisabche/ui-contract'

import { lookOwner } from '../lib/page-look'
import {
  DASHBOARD_PARTS,
  MENU_ALWAYS,
} from '../components/ui/dashboard/containers/dashboard-container'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
/** Comments describe the bugs; only code is asserted on. Flattened: the formatter wraps. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')
const ui = (...parts: string[]) => code(read('packages', 'ui', 'src', ...parts))

const store = ui('lib', 'page-look.ts')
const data = ui('hooks', 'dashboard', 'use-dashboard-data.ts')
const container = ui('components', 'ui', 'dashboard', 'containers', 'dashboard-container.tsx')
const view = ui('components', 'ui', 'dashboard', 'dashboard-view.tsx')
const hub = ui('components', 'ui', 'page-hub.tsx')
const web = code(read('apps', 'web', 'app', '[lang]', '(dashboard)', 'dashboard-layout.tsx'))
const shell = code(read('packages', 'app-shell', 'src', 'components', 'layout', 'app-shell.tsx'))
const sidebar = code(read('packages', 'app-shell', 'src', 'components', 'layout', 'sidebar.tsx'))

describe('whose view it is', () => {
  it('one person in one business — never known before both are', () => {
    expect(lookOwner('u1', 'w1')).toBe('u1.w1')
    expect(lookOwner('u1', 'w2')).not.toBe(lookOwner('u1', 'w1'))
    expect(lookOwner('u2', 'w1')).not.toBe(lookOwner('u1', 'w1'))
    expect(lookOwner(null, 'w1')).toBeNull()
    expect(lookOwner('u1', null)).toBeNull()
  })

  it('the store is keyed by that owner, and reads nothing on the server', () => {
    expect(store).toContain('window.localStorage.getItem(PREFIX + owner)')
    expect(store).toContain('const ready = owner !== null')
    expect(store).toContain('() => NOTHING,')
  })

  it('«shown» is for drawing, «active» is for fetching — a part never fetches on a guess', () => {
    expect(store).toContain('active: (id: string) => ready && !hiddenIds.includes(id),')
    expect(store).toContain('shows: (id: string) => !hiddenIds.includes(id),')
  })
})

describe('the dashboard: hidden means not fetched', () => {
  it('six parts, by stable name', () => {
    expect([...DASHBOARD_PARTS]).toEqual([
      'workQueue',
      'kpis',
      'chart',
      'insights',
      'activities',
      'manufacturing',
    ])
  })

  it('each read and each live channel is switched off with its part', () => {
    expect(data).toContain('useDashboardKPIs({ enabled: parts.kpis })')
    expect(data).toContain('useAIInsights({ enabled: parts.insights })')
    expect(data).toContain('{ enabled: parts.kpis || parts.chart },')
    expect(data).toContain('enabled: parts.activities,')
    const hooks = code(read('packages', 'api', 'src', 'hooks', 'dashboard.ts'))
    expect(hooks.split('enabled: authReady && enabled,').length - 1).toBe(3)
    expect(hooks).toContain("useRealtime({ table: 'invoices', queryKey: kpisKey, enabled })")
    expect(code(read('packages', 'api', 'src', 'hooks', 'useRealtime.ts'))).toContain(
      'if (!enabled) return',
    )
  })

  it('the container asks the look with `active`, and draws with `shows`', () => {
    expect(container).toContain("kpis: look.active('kpis'),")
    expect(container).toContain("kpis: look.shows('kpis'),")
    expect(container).toContain("{look.shows('workQueue') ? (")
    expect(container).toContain("{look.shows('manufacturing') ? (")
  })

  it('a part that is off is not rendered at all — no CSS hiding', () => {
    for (const part of ['kpis', 'chart', 'insights', 'activities']) {
      expect(view, part).toContain(`show?.${part} === false ? null : (`)
    }
    for (const file of [view, container, hub]) {
      expect(file).not.toContain('display: none')
      expect(file).not.toContain("'hidden'")
    }
  })

  it('two reads nothing showed are gone from the home screen', () => {
    // The five latest invoices and the first hundred products: fetched on
    // every opening, returned, and used by nothing.
    expect(data).not.toContain('useInvoices(')
    expect(data).not.toContain('useProducts(')
  })

  it('permission comes first: a part the role does not include is not asked for', () => {
    expect(container).toContain("chart: look.active('chart') && may('invoice.read'),")
    expect(container).toContain(
      "const mayInsights = may('invoice.read') && may('customer.read') && may('product.read')",
    )
    // A figure the server did not tell is left out, never drawn as zero.
    expect(container).toContain('hiddenFigures={kpis?.hidden ?? []}')
    expect(view).toContain("{hiddenFigures.includes('sales') ? null : (")
    expect(view).toContain("{hiddenFigures.includes('stockValue') ? null : (")
  })
})

describe('the wrench', () => {
  const wrench = ui('components', 'ui', 'page-customizer.tsx')

  it('says what it is: your own view, nobody’s access', () => {
    expect(wrench).toContain("'pageLook.hint',")
    expect(wrench).toContain('data-page-customizer=""')
  })

  it('shows that something is hidden, and can put everything back', () => {
    expect(wrench).toContain('{hiddenCount > 0 ? (')
    expect(wrench).toContain('for (const group of offered) group.look.reset()')
  })

  it('a page cannot be emptied with no way back', () => {
    expect(wrench).toContain('const last = group.keepOne === true && shown && visible === 1')
    expect(hub).toContain('keepOne: true,')
    // The way home and the way to undo anything never leave the menu.
    expect([...MENU_ALWAYS]).toEqual(['/dashboard', '/settings'])
  })

  it('the menu group offers only pages the role includes', () => {
    expect(container).toContain(
      '!MENU_ALWAYS.includes(item.path) && !isNavLocked(item.path, hiddenByRole),',
    )
  })

  it('every word exists in all three languages', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const all = JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json'))
      for (const key of ['open', 'title', 'hint', 'reset', 'done', 'dashboardParts', 'menu']) {
        expect(all.pageLook[key], `${lang} pageLook.${key}`).toEqual(expect.any(String))
      }
      for (const part of DASHBOARD_PARTS) {
        expect(all.pageLook.dashboard[part], `${lang} ${part}`).toEqual(expect.any(String))
      }
      for (const key of ['deniedTitle', 'deniedBody', 'goHome']) {
        expect(all.access[key], `${lang} access.${key}`).toEqual(expect.any(String))
      }
    }
  })
})

describe('a hub: permission first, then the person’s choice', () => {
  it('the look is applied to what the person MAY open, never the other way round', () => {
    expect(hub).toContain('const allowed = offeredHubTabs(tabs, blocked)')
    expect(hub.indexOf('const allowed = offeredHubTabs(tabs, blocked)')).toBeLessThan(
      hub.indexOf('look.shows(hubLookId(tab.id, section.id))'),
    )
    // …and the wrench lists only those.
    expect(hub).toContain('items: allowed.flatMap((tab) =>')
  })

  it.each(['accounting', 'billing', 'data', 'settings'])('the %s hub has the wrench', (id) => {
    const files: Record<string, string[]> = {
      accounting: ['components', 'ui', 'accounting', 'AccountingPage.tsx'],
      billing: ['components', 'ui', 'billing', 'containers', 'billing-hub-container.tsx'],
      data: ['components', 'ui', 'data-and-sync', 'containers', 'data-hub-container.tsx'],
      settings: ['components', 'ui', 'settings', 'settings-hub-container.tsx'],
    }
    expect(ui(...(files[id] as string[]))).toContain(`lookId="${id}"`)
  })
})

describe('a page the role does not include is not mounted', () => {
  it('the address decides, whatever comes after the page', () => {
    expect(isRouteDenied('/invoices', ['invoices'])).toBe(true)
    expect(isRouteDenied('/invoices/new', ['invoices'])).toBe(true)
    expect(isRouteDenied('/invoices?type=purchase', ['invoices'])).toBe(true)
    expect(isRouteDenied('/warehouse/abc', ['invoices'])).toBe(false)
    expect(isRouteDenied('/invoices', [])).toBe(false)
    // The way home is never a module: nobody can be locked out of it.
    expect(isRouteDenied('/dashboard', ['invoices', 'reports', 'workspace'])).toBe(false)
    expect(isRouteDenied('/', ['invoices'])).toBe(false)
  })

  it('both shells draw the notice INSTEAD of the page', () => {
    expect(web).toContain(
      ") : routeDenied ? ( <NoAccessNotice onHome={() => router.push(withLocale('/dashboard'))} /> ) : ( children )}",
    )
    expect(shell).toContain(
      ") : routeDenied ? ( <NoAccessNotice onHome={() => navigate('/')} /> ) : ( <Outlet /> )}",
    )
  })

  it('the web strips the locale before asking', () => {
    expect(web).toContain("(pathname ?? '').replace(new RegExp(`^/${locale}(?=/|$)`), ''),")
  })

  it('nothing the person will not open is prefetched', () => {
    expect(web).toContain('(path) => !isNavLocked(path, denied) && !hiddenPaths.includes(path),')
  })

  it('a page hidden from one’s own menu is filtered in both shells — and is not a refusal', () => {
    expect(web).toContain("!menuHiddenKey.split(',').includes(item.path),")
    expect(sidebar).toContain("!menuHiddenKey.split(',').includes(item.path),")
    // The personal look never feeds the denial.
    expect(web).toContain('[...blockedOf(blockedKey), ...blockedOf(hiddenKey)],')
    expect(
      web.slice(
        web.indexOf('const routeDenied = isRouteDenied('),
        web.indexOf('usePrefetchRoutes(locale,'),
      ),
    ).not.toContain('menuHiddenKey')
  })
})
