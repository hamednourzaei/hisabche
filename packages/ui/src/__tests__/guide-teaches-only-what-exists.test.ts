// ============================================
// The in-app guide teaches only what exists — and only what THIS person has
// (owner, 15 Nov 2026: «guide های کاربری که صنفش را انتخاب کرده نباید به هسته‌ای
// اشاره کند که لازمش نیست؛ وگرنه قدم بعدی به هیچ صفحه‌ای نمی‌رود»).
//
//   · every step's tab / view is a real tab / section of its hub (source)
//   · every explicit anchor is a real `data-guide` in the UI
//   · every docs link is a real article AND section
//   · every DNA module a step names is a module the resolver can activate
//   · the tour only names menu paths, and never sends a reader to a page
//     that is not theirs or has nothing of theirs left
//   · the Dari copy follows the glossary
// Each source guard is also run on a broken FIXTURE, to prove it can fail.
// ============================================

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  GUIDE_CATALOG,
  GUIDE_TOUR,
  guidePageAnchor,
  guideRouteOf,
  guideStepInScope,
  nextGuideRoute,
  type GuideStepDefinition,
} from '@hisabche/ui-contract'
import { DOCS_ARTICLES } from '../lib/docs/docs-content'
import { NAV_ITEMS } from '../lib/menu/nav-items'

const ROOT = join(__dirname, '../../../..')
const read = (relative: string) => readFileSync(join(ROOT, relative), 'utf8')
const UI = 'packages/ui/src/components/ui/'

/** Where each route's hub declares its tabs and section switches. */
const HUB_SOURCES: Record<string, readonly string[]> = {
  invoices: [`${UI}invoices/containers/sales-hub-container.tsx`],
  warehouse: [`${UI}warehouse/containers/warehouse-tabs-container.tsx`],
  accounting: [`${UI}accounting/AccountingPage.tsx`],
  customers: [`${UI}customers/containers/customers-hub-container.tsx`],
  till: [`${UI}till/containers/till-container.tsx`],
  'team-and-payroll': [`${UI}team-and-payroll/containers/team-and-payroll-container.tsx`],
  'data-and-sync': [`${UI}data-and-sync/containers/data-hub-container.tsx`],
  settings: [`${UI}settings/settings-hub-container.tsx`],
  billing: [`${UI}billing/containers/billing-hub-container.tsx`],
}

const allSteps: GuideStepDefinition[] = Object.values(GUIDE_CATALOG).flat()

/** Steps whose tab or view is not a quoted id in their hub's source. */
function tabsMissingFromSource(
  steps: readonly GuideStepDefinition[],
  sources: Record<string, readonly string[]>,
  readSource: (relative: string) => string,
): string[] {
  const problems: string[] = []
  for (const step of steps) {
    if (!step.tab && !step.view) continue
    const files = sources[step.routeId]
    if (!files) {
      problems.push(`${step.id}: route «${step.routeId}» has no hub source`)
      continue
    }
    const text = files.map(readSource).join('\n')
    for (const id of [step.tab, step.view]) {
      if (id && !text.includes(`'${id}'`)) problems.push(`${step.id}: «${id}» not in its hub`)
    }
  }
  return problems
}

function uiAnchors(): Set<string> {
  const found = new Set<string>()
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue
      const path = `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(path)
      else if (/\.tsx?$/.test(entry.name)) {
        for (const match of read(path).matchAll(/data-guide="([a-z0-9-]+)"/g)) found.add(match[1]!)
      }
    }
  }
  walk('packages/ui/src')
  walk('packages/app-shell/src')
  return found
}

describe('every step points at something real', () => {
  it("a step's tab and switch are real ids of its hub", () => {
    expect(tabsMissingFromSource(allSteps, HUB_SOURCES, read)).toEqual([])
  })

  it('… and that guard fails on a step naming a tab that does not exist (fixture)', () => {
    const broken: GuideStepDefinition = {
      id: 'fixture',
      routeId: 'warehouse',
      order: 1,
      tab: 'stock',
      view: 'floorPlan', // the old «نقشه انبار» — removed, must never come back
      sectionId: guidePageAnchor('warehouse'),
      titleKey: 'guide.x.title',
      descriptionKey: 'guide.x.desc',
    }
    expect(tabsMissingFromSource([broken], HUB_SOURCES, read)).toEqual([
      'fixture: «floorPlan» not in its hub',
    ])
  })

  it('an explicit anchor (not the page fallback) is a real data-guide in the UI', () => {
    const anchors = uiAnchors()
    const missing = allSteps
      .filter((step) => step.sectionId !== guidePageAnchor(step.routeId))
      .filter((step) => !anchors.has(step.sectionId))
      .map((step) => `${step.id} → ${step.sectionId}`)
    expect(missing).toEqual([])
  })

  it("the product page's panels are taught on the product page, not on the warehouse list", () => {
    const list = (GUIDE_CATALOG.warehouse ?? []).map((step) => step.sectionId)
    const detail = (GUIDE_CATALOG['warehouse-detail'] ?? []).map((step) => step.sectionId)
    for (const panel of ['product-units', 'product-waste', 'product-serials']) {
      expect(list).not.toContain(panel)
      expect(detail).toContain(panel)
    }
  })

  it('a docs link is a real article and a real section of it', () => {
    const problems: string[] = []
    for (const step of allSteps) {
      const docs = step.docs
      if (!docs) continue
      const article = DOCS_ARTICLES.find((candidate) => candidate.slug === docs.slug)
      if (!article) problems.push(`${step.id}: no article «${docs.slug}»`)
      else if (docs.section && !article.sections.some((section) => section.id === docs.section)) {
        problems.push(`${step.id}: «${docs.slug}» has no section «${docs.section}»`)
      }
    }
    expect(problems).toEqual([])
  })

  it('the docs page gives each section an id the guide can link to', () => {
    expect(read(`${UI}docs/docs-view.tsx`)).toContain('id={section.id}')
  })

  it('a DNA module a step names is one the capability resolver can activate', () => {
    const resolver = read('packages/validation/src/schemas/business-capabilities.ts')
    const known = new Set([
      ...[...resolver.matchAll(/activeModules\.add\('([a-z_]+)'\)/g)].map((m) => m[1]!),
      'accounting',
      'invoices',
      'customers',
    ])
    const unknown = allSteps.flatMap((step) =>
      (step.modules ?? []).filter((module) => !known.has(module)).map((m) => `${step.id}: ${m}`),
    )
    expect(unknown).toEqual([])
  })

  it("every route's steps are numbered 1…n with distinct ids", () => {
    for (const [route, steps] of Object.entries(GUIDE_CATALOG)) {
      steps.forEach((step, index) => {
        expect(step.routeId).toBe(route)
        expect(step.order).toBe(index + 1)
      })
    }
    const ids = allSteps.map((step) => step.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('the tour goes only where this person can go', () => {
  it('every tour stop is a real menu path with steps', () => {
    const menu = new Set(NAV_ITEMS.map((item) => item.path))
    for (const stop of GUIDE_TOUR) {
      expect(menu.has(stop.menuPath), stop.menuPath).toBe(true)
      expect((GUIDE_CATALOG[stop.routeId] ?? []).length, stop.routeId).toBeGreaterThan(0)
    }
  })

  it("a page outside this person's menu is never the next stop", () => {
    const unreachable = new Set(['/warehouse', '/manufacturing', '/till', '/team-and-payroll'])
    let at = 'dashboard'
    const visited: string[] = []
    for (let hop = 0; hop < GUIDE_TOUR.length; hop++) {
      const stop = nextGuideRoute(
        at,
        (id) => visited.some((route) => (GUIDE_CATALOG[route] ?? []).some((s) => s.id === id)),
        (path) => !unreachable.has(path),
      )
      if (!stop) break
      expect(unreachable.has(stop.menuPath), stop.routeId).toBe(false)
      visited.push(stop.routeId)
      at = stop.routeId
    }
    // `/stock-count` goes with the warehouse.
    expect(visited).not.toContain('stock-count')
    expect(visited.length).toBeGreaterThan(0)
  })

  it('nothing reachable and unseen → null («all done»), not a page that does not open', () => {
    expect(
      nextGuideRoute(
        'dashboard',
        () => false,
        (path) => path === '/dashboard',
      ),
    ).toBeNull()
  })

  it('a page whose only unseen steps are for a module the business does not run is skipped', () => {
    const shop = new Set(['accounting', 'invoices', 'customers', 'products', 'inventory'])
    const serviceOnly = (GUIDE_CATALOG.customers ?? []).filter((step) => step.modules)
    expect(serviceOnly.length).toBeGreaterThan(0)
    // Everything on «customers» is seen except the service-only steps.
    const seen = (id: string) => !serviceOnly.some((step) => step.id === id)
    const stop = nextGuideRoute('accounting', seen, () => true, shop)
    expect(stop?.routeId).not.toBe('customers')
  })

  it('unresolved DNA filters nothing (the menu rule)', () => {
    for (const step of allSteps) expect(guideStepInScope(step, null)).toBe(true)
  })
})

describe('the route a step belongs to', () => {
  it.each([
    ['/fa/warehouse', 'warehouse'],
    ['/warehouse', 'warehouse'],
    ['/af/warehouse/123', 'warehouse-detail'],
    ['/en/invoices/new', 'invoices-new'],
    ['/fa/customers?tab=sessions', 'customers'],
    ['/fa', 'dashboard'],
    ['/', 'dashboard'],
  ])('%s → %s', (pathname, route) => {
    expect(guideRouteOf(pathname)).toBe(route)
  })
})

describe('the hubs mark what the guide reads', () => {
  it('HubTabs, SegmentedControl and PageHub carry the tab / view markers', () => {
    expect(read(`${UI}hub-tabs.tsx`)).toContain('data-guide-tab={item.id}')
    expect(read(`${UI}hub-tabs.tsx`)).toContain('data-guide-tab={only.id}')
    expect(read(`${UI}segmented-control.tsx`)).toContain('data-guide-view={option.value}')
    expect(read(`${UI}page-hub.tsx`)).toContain('data-guide-view={section.id}')
  })

  it('the guide opens a tab through the address, never by clicking it', () => {
    const engine = read(`${UI}guide/interactive-guide.tsx`)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(engine).toContain('router.replace(')
    expect(engine).not.toMatch(/\.click\(\)/)
  })
})

describe('Dari copy follows the glossary', () => {
  it('no Iranian-only word in the af guide (کالا، انبار، فاکتور، فروشگاه)', () => {
    const af = JSON.parse(read('packages/i18n/messages/af/common.json')) as { guide: unknown }
    const texts: string[] = []
    const walk = (node: unknown) => {
      if (typeof node === 'string') texts.push(node)
      else if (node && typeof node === 'object') Object.values(node).forEach(walk)
    }
    walk(af.guide)
    const offending = texts.filter((text) => /کالا|انبار|فاکتور|فروشگاه/.test(text))
    expect(offending).toEqual([])
  })
})
