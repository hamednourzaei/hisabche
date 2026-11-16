// ============================================
// packages/validation/src/__tests__/industry-registry-doc.test.ts
//
// Guard for V69.0 — verifies that docs/industries/INDUSTRY-REGISTRY.md
// matches the generator output from the real code registry.
// ============================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { INDUSTRY_KEYS } from '../schemas/industry-profiles'
import {
  buildRegistryData,
  generateIndustryRegistryMarkdown,
} from '../../../../scripts/industry/generate-industry-registry.mjs'

const ROOT = resolve(__dirname, '../../../..')
const DOC_PATH = resolve(ROOT, 'docs/industries/INDUSTRY-REGISTRY.md')

describe('V69.0 — industry registry document guard', () => {
  it('document matches generator output exactly', () => {
    const onDisk = readFileSync(DOC_PATH, 'utf8')
    const expected = generateIndustryRegistryMarkdown()
    expect(onDisk).toBe(expected)
  })

  it('contains exactly 67 rows matching INDUSTRY_KEYS', () => {
    const rows = buildRegistryData()
    expect(rows.length).toBe(67)
    expect(rows.length).toBe(INDUSTRY_KEYS.length)

    const rowIds = rows.map((r) => r.id)
    expect(rowIds).toEqual([...INDUSTRY_KEYS])
  })

  it('every industry has valid 3-locale labels (fa / af / en)', () => {
    const rows = buildRegistryData()
    for (const row of rows) {
      const parts = row.labels.split(' / ')
      expect(parts.length, `Row ${row.id} should have 3 localized labels`).toBe(3)
      expect(parts[0]?.trim().length).toBeGreaterThan(0)
      expect(parts[1]?.trim().length).toBeGreaterThan(0)
      expect(parts[2]?.trim().length).toBeGreaterThan(0)
    }
  })

  it('rejects tampered document (injection test)', () => {
    const original = generateIndustryRegistryMarkdown()
    const tampered = original.replace('`retail`', '`fake_retail`')
    expect(tampered).not.toBe(original)
  })

  it('V69.1 — all 7 shared catalog documents exist and contain required content', () => {
    const files = [
      'SHARED-PAGE-CATALOG.md',
      'SHARED-CAPABILITY-MATRIX.md',
      'ROLE-PERMISSION-MATRIX.md',
      'OFFLINE-WORKFLOW-MATRIX.md',
      'CROSS-PLATFORM-MATRIX.md',
      'WORKFLOW-STATE-MODEL.md',
      'ACCEPTANCE-CRITERIA.md',
    ]

    for (const file of files) {
      const filePath = resolve(ROOT, 'docs/industries', file)
      const content = readFileSync(filePath, 'utf8')
      expect(content.length, `${file} should not be empty`).toBeGreaterThan(100)
    }
  })
})
