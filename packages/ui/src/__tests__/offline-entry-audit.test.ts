// Every PAGE of the product has an explicit offline entry mode. A new dashboard
// page without a row here fails — so a feature the device cannot run cannot
// become a menu item that opens onto a failed list.
//
//   page-gate   → PAGE_FEATURES draws the notice before the page mounts
//   own-gates   → the page is a mix; its parts gate themselves (OfflineGate /
//                 useActionAvailability / the matrix refusal notice)
//   runs-offline→ the engine answers what the page reads and writes
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { featureOfflineAvailability, FEATURE_REGISTRY } from '@hisabche/validation'
import { PAGE_FEATURES, featureForPage } from '../lib/capability/page-features'

const ROOT = join(__dirname, '..', '..', '..', '..')

type Mode = 'page-gate' | 'own-gates' | 'runs-offline' | 'not-in-app'

const PAGES: Record<string, Mode> = {
  accounting: 'own-gates',
  activities: 'runs-offline',
  analysis: 'own-gates',
  approvals: 'page-gate',
  assistant: 'page-gate',
  audit: 'own-gates',
  billing: 'page-gate',
  customers: 'own-gates',
  dashboard: 'own-gates',
  'data-and-sync': 'own-gates',
  developers: 'page-gate',
  governance: 'page-gate',
  invoices: 'own-gates',
  manufacturing: 'page-gate',
  'market-seller': 'page-gate',
  marketplace: 'page-gate',
  onboarding: 'not-in-app',
  operations: 'own-gates',
  settings: 'own-gates',
  'stock-count': 'page-gate',
  'sync-center': 'runs-offline',
  'team-and-payroll': 'own-gates',
  till: 'runs-offline',
  warehouse: 'own-gates',
}

describe('every page has an offline entry mode', () => {
  const dir = join(ROOT, 'apps/web/app/[lang]/(dashboard)')
  const pages = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

  it('lists no page without a mode, and no mode for a page that is gone', () => {
    expect(Object.keys(PAGES).sort()).toEqual([...pages].sort())
  })

  it('page-gate pages are really in the page table', () => {
    for (const [page, mode] of Object.entries(PAGES)) {
      if (mode !== 'page-gate') continue
      expect(featureForPage(`/${page}`, ''), page).not.toBeNull()
    }
  })

  it('every row names a feature the device cannot fully run (no dead gates)', () => {
    const dead: string[] = []
    for (const rule of PAGE_FEATURES) {
      expect(rule.feature in FEATURE_REGISTRY, rule.feature).toBe(true)
      if (featureOfflineAvailability(rule.feature) === 'available') {
        dead.push(`${rule.path} ${rule.tab ?? ''} ${rule.view ?? ''} → ${rule.feature}`)
      }
    }
    expect(dead, 'the device runs these now: drop the rows (and the page mode)').toEqual([])
  })

  it('reads the locale-prefixed web address and the bare device address alike', () => {
    expect(featureForPage('/fa/manufacturing', '')).toBe('manufacturing.bom')
    expect(featureForPage('/manufacturing', '')).toBe('manufacturing.bom')
    expect(featureForPage('/accounting', '?tab=books&view=monthEnd')).toBe(
      'accounting.period_close',
    )
    expect(featureForPage('/accounting', '?tab=books&view=journal')).toBeNull()
    expect(featureForPage('/invoices', '')).toBeNull()
  })
})
