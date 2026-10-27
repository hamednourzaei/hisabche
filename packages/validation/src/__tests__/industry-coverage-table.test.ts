// ============================================
// The industry coverage matrix is evidence, not prose.
//
// `scripts/industry/generate-coverage-table.mjs` builds the Markdown, the CSV and
// the support matrix from ONE data file and resolves every file:line by searching
// the source for a named symbol. This guard:
//   · fails when any generated file is stale (a symbol moved, a test vanished)
//   · re-reads the CSV and checks the rules the document promises
//   · checks that every onboarding option the owner required is a REAL registry
//     key — the matrix computes that column from the registry, but a required
//     option that is simply missing must also turn this suite red
// ============================================

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { INDUSTRY_KEYS } from '../index'

const ROOT = resolve(__dirname, '../../../..')
const CSV = resolve(ROOT, 'docs/architecture/universal-core/INDUSTRY-COVERAGE-TABLE.csv')

const STATUSES = [
  'VERIFIED_SUPPORTED',
  'PARTIALLY_SUPPORTED',
  'UNSUPPORTED',
  'NOT_APPLICABLE',
  'IMPLEMENTED_THIS_ROUND',
]

/** Minimal RFC-4180 reader: every cell is quoted, `""` is a quote. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  return rows
}

const [header, ...records] = parseCsv(readFileSync(CSV, 'utf8'))

const col = (name: string): number => {
  const index = header!.indexOf(name)
  if (index < 0) throw new Error(`CSV has no column ${name}`)
  return index
}

describe('industry coverage table', () => {
  it('is current: every symbol, test file and onboarding key it cites still exists', () => {
    const result = spawnSync(
      process.execPath,
      ['scripts/industry/generate-coverage-table.mjs', '--check'],
      { cwd: ROOT, encoding: 'utf8' },
    )
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
  })

  it('has the owner’s required business models, one row per industry-capability pair', () => {
    const models = new Set(records.map((r) => r[col('business_model')]))
    for (const required of [
      'General retail',
      'General wholesale',
      'Clothing retail and wholesale',
      'Footwear',
      'Fabric sold by the meter',
      'Fabric sold by the roll',
      'Kitchenware',
      'Household goods',
      'Computer components',
      'Consumer electronics',
      'Vehicle sales',
      'Automotive parts',
      'Carpet sales',
      'Furniture',
      'Gold and jewelry',
      'Grocery and food retail',
      'Construction and building materials',
      'Freight and cargo transport',
      'Passenger transport',
      'Courier and delivery services',
      'General services and professional businesses',
      'Manufacturing and workshops',
      'Agriculture and livestock',
      'Other businesses using the universal core',
    ]) {
      expect(models.has(required), required).toBe(true)
    }

    const pairs = records.map((r) => `${r[col('business_model')]}|${r[col('required_capability')]}`)
    expect(new Set(pairs).size).toBe(pairs.length)
  })

  it('uses only the allowed statuses and confidence levels', () => {
    for (const r of records) {
      expect(STATUSES).toContain(r[col('hisabche_status')])
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(r[col('confidence')])
    }
  })

  it('never calls something supported without a repository anchor and a test', () => {
    for (const r of records) {
      if (r[col('hisabche_status')] !== 'VERIFIED_SUPPORTED') continue
      const evidence = r[col('repository_evidence')]!
      expect(evidence, r.join(' · ')).toMatch(/\.(ts|tsx|sql|mjs):\d+/)
      expect(evidence, r.join(' · ')).toMatch(/\.test\.tsx?/)
    }
  })

  it('explains every missing or partial row, and never fakes a source', () => {
    for (const r of records) {
      const status = r[col('hisabche_status')]
      if (status === 'UNSUPPORTED' || status === 'PARTIALLY_SUPPORTED') {
        expect(r[col('why_missing_or_partial')]!.length, r.join(' · ')).toBeGreaterThan(40)
      }
      const source = r[col('external_source')]!
      if (source === 'No source found') {
        expect(r[col('confidence')], r.join(' · ')).toBe('LOW')
      } else {
        expect(source).toMatch(/https:\/\/\S+ \(accessed \d{4}-\d{2}-\d{2}\)/)
      }
    }
  })

  it('every onboarding option the owner required is a real, individually selectable registry key', () => {
    for (const key of [
      'freightTransport',
      'passengerTransport',
      'courier',
      'clothing',
      'fabricRoll',
      'fabric',
      'kitchenware',
      'computerComponents',
      'carDealer',
      'carpet',
      'other',
    ]) {
      expect(INDUSTRY_KEYS as readonly string[], key).toContain(key)
    }
  })
})
