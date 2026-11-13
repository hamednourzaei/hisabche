// ============================================
// The V61 audit screens (12 Nov 2026) — RFQ, consignment, org chart, bundles,
// RFM, snapshots — for server routes that existed with no client at all.
//
// `t()` THROWS on a missing key and takes the page to the error boundary, so
// every literal key each screen reads is checked in fa, af and en; every
// refusal code a screen can explain has its sentence; every endpoint the hooks
// call has its row in the offline matrix; and each screen is mounted where the
// owner will look for it.
// ============================================
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { OFFLINE_ENDPOINT_MATRIX } from '@hisabche/validation'

import { RFQ_ERROR_CODES } from '../components/ui/erp-core/rfq-section'
import { CONSIGNMENT_ERROR_CODES } from '../components/ui/erp-core/consignment-section'
import { ORG_CHART_ERROR_CODES, orgDepths } from '../components/ui/erp-core/org-chart-section'
import { BUNDLE_ERROR_CODES } from '../components/ui/erp-core/bundle-editor'
import { RFM_SEGMENTS } from '../components/ui/erp-core/rfm-section'
import { lowestByCurrency } from '../components/ui/erp-core/rfq-section'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
const UI = ['packages', 'ui', 'src', 'components', 'ui']

const SCREENS = {
  'rfq-section.tsx': 'rfq',
  'consignment-section.tsx': 'consignment',
  'org-chart-section.tsx': 'orgChart',
  'bundle-editor.tsx': 'bundle',
  'rfm-section.tsx': 'rfm',
  'snapshots-section.tsx': 'snapshots',
} as const

type Tree = { [key: string]: string | Tree }
const messages = (lang: string) =>
  JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json')) as Tree
const at = (tree: Tree, path: string): unknown =>
  path.split('.').reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree)

describe.each(['fa', 'af', 'en'])('every key the screens read exists in %s', (lang) => {
  const all = messages(lang)
  for (const [file, ns] of Object.entries(SCREENS)) {
    it(file, () => {
      const source = read(...UI, 'erp-core', file)
      const missing: string[] = []
      // tr('literal') — dynamic keys (`status.${x}`) are checked below by their lists.
      for (const m of source.matchAll(/\btr\('([a-zA-Z0-9_.]+)'\)/g)) {
        if (typeof at(all, `erpCore.${ns}.${m[1]}`) !== 'string') missing.push(m[1]!)
      }
      // Column headers are FULL keys.
      for (const m of source.matchAll(/labelKey: '([a-zA-Z0-9_.]+)'/g)) {
        if (typeof at(all, m[1]!) !== 'string') missing.push(m[1]!)
      }
      for (const key of ['loading', 'loadFailed', 'retry', 'errors.general']) {
        if (typeof at(all, `erpCore.${ns}.${key}`) !== 'string') missing.push(key)
      }
      expect(missing).toEqual([])
    })
  }

  it('every refusal code has its sentence', () => {
    const lists: Array<[string, readonly string[]]> = [
      ['rfq', RFQ_ERROR_CODES],
      ['consignment', CONSIGNMENT_ERROR_CODES],
      ['orgChart', ORG_CHART_ERROR_CODES],
      ['bundle', BUNDLE_ERROR_CODES],
    ]
    for (const [ns, codes] of lists) {
      for (const code of codes) {
        expect(typeof at(all, `erpCore.${ns}.errors.${code}`), `${ns}.${code}`).toBe('string')
      }
    }
  })

  it('every status and segment the screens draw has a label', () => {
    for (const s of ['open', 'awarded', 'cancelled']) {
      expect(typeof at(all, `erpCore.rfq.rfqStatus.${s}`)).toBe('string')
    }
    for (const s of ['submitted', 'chosen', 'rejected', 'expired']) {
      expect(typeof at(all, `erpCore.rfq.quotationStatus.${s}`)).toBe('string')
    }
    for (const s of ['open', 'settled', 'returned']) {
      expect(typeof at(all, `erpCore.consignment.status.${s}`)).toBe('string')
    }
    for (const s of RFM_SEGMENTS) {
      expect(typeof at(all, `erpCore.rfm.segments.${s}`)).toBe('string')
    }
  })

  it('the hub section labels exist', () => {
    expect(typeof at(all, 'warehouseHub.sections.rfqs')).toBe('string')
    expect(typeof at(all, 'warehouseHub.sections.consignments')).toBe('string')
    expect(typeof at(all, 'teamHub.sections.orgChart')).toBe('string')
    expect(typeof at(all, 'customersHub.sections.rfm')).toBe('string')
    expect(typeof at(all, 'dataHub.snapshots')).toBe('string')
  })
})

describe('the screens say what they do NOT do', () => {
  it('consignment is a register: it moves no stock', () => {
    expect(String(at(messages('en'), 'erpCore.consignment.intro'))).toContain(
      'does not change stock',
    )
  })
  it('choosing a quotation records no purchase', () => {
    expect(String(at(messages('en'), 'erpCore.rfq.intro'))).toContain('records no purchase')
  })
  it('a snapshot is not a backup', () => {
    expect(String(at(messages('en'), 'erpCore.snapshots.intro'))).toContain('not a backup')
  })
})

describe('every endpoint the new hooks call has an offline-matrix row', () => {
  const endpoints = [
    'GET /rfqs',
    'POST /rfqs',
    'POST /rfqs/:x/quotations',
    'POST /quotations/:x/choose',
    'GET /purchase-contracts/prices',
    'POST /purchase-contracts/prices',
    'GET /employees/org-chart',
    'PATCH /employees/:x/reports-to',
    'GET /employees/:x/documents',
    'POST /employees/:x/documents',
    'GET /employees/:x/appraisals',
    'POST /employees/:x/appraisals',
    'GET /warehouses/consignments',
    'POST /warehouses/consignments',
    'GET /products/:x/bundle-items',
    'PUT /products/:x/bundle-items',
    'GET /crm/rfm',
    'GET /snapshots',
    'POST /snapshots',
    'GET /snapshots/:x/compare',
  ]
  it.each(endpoints)('%s', (endpoint) => {
    const row = (OFFLINE_ENDPOINT_MATRIX as Record<string, readonly [string, string]>)[endpoint]
    expect(row?.[1]).toBe('online_required')
  })
})

describe('each screen is mounted where the owner looks for it', () => {
  it('warehouse hub › stock: RFQs and consignment', () => {
    const hub = read(...UI, 'warehouse', 'containers', 'warehouse-tabs-container.tsx')
    expect(hub).toContain("section === 'rfqs' ? (\n              <RfqSection />")
    expect(hub).toContain("section === 'consignments' ? (\n              <ConsignmentSection />")
  })
  it('team hub › team: the org chart', () => {
    const hub = read(...UI, 'team-and-payroll', 'containers', 'team-and-payroll-container.tsx')
    expect(hub).toContain("if (section === 'orgChart') return <OrgChartSection />")
  })
  it('customers hub › outreach: RFM', () => {
    const hub = read(...UI, 'customers', 'containers', 'customers-hub-container.tsx')
    expect(hub).toContain("section === 'rfm' ? (\n                <RfmSection />")
  })
  it('data hub: snapshots, offered to manager and up', () => {
    const hub = read(...UI, 'data-and-sync', 'containers', 'data-hub-container.tsx')
    expect(hub).toContain('render: () => <SnapshotsSection />')
    expect(hub).toContain("['owner', 'admin', 'manager'].includes(capabilities?.role ?? '')")
  })
  it('the product page: the bundle editor', () => {
    const page = read(...UI, 'warehouse-detail', 'containers', 'warehouse-detail-container.tsx')
    expect(page).toContain('<BundleEditor productId={id} />')
  })
})

describe('tables read FULL keys (a scoped reader looked up «ns.ns.…» and threw)', () => {
  it.each([...Object.keys(SCREENS), '../accounting/tabs/ChequesTab.tsx'])('%s', (file) => {
    const source = read(...UI, 'erp-core', file)
    if (source.includes('<DataTable')) {
      expect(source).toContain('t={label}')
      expect(source).not.toContain('t={tr}')
    }
  })
})

describe('rules the screens apply', () => {
  it('the lowest quotation is per currency — AFN and USD are never compared', () => {
    const q = (id: string, currency: string, total: number, status = 'submitted') => ({
      id,
      rfq_id: 'r',
      supplier_id: 's',
      currency,
      valid_until: '2026-12-31',
      lead_time_days: 0,
      lines: [],
      total_minor: total,
      status: status as 'submitted',
      created_at: '',
    })
    const best = lowestByCurrency([
      q('a', 'AFN', 9_000),
      q('b', 'AFN', 7_000),
      q('c', 'USD', 100),
      q('d', 'AFN', 1, 'rejected'),
    ])
    expect(best.get('AFN')).toBe('b')
    expect(best.get('USD')).toBe('c')
  })

  it('org depth follows reports_to and survives a loop in stale data', () => {
    const row = (id: string, reportsTo: string | null) => ({
      id,
      first_name: id,
      last_name: '',
      position: null,
      department_id: null,
      reports_to: reportsTo,
    })
    const depths = orgDepths([
      row('a', null),
      row('b', 'a'),
      row('c', 'b'),
      row('x', 'y'),
      row('y', 'x'),
    ])
    expect(depths.get('a')).toBe(0)
    expect(depths.get('c')).toBe(2)
    expect(depths.get('x')).toBeLessThan(3)
  })
})
