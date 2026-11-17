import { describe, expect, it } from 'vitest'
import {
  INDUSTRY_ACCEPTANCE_TESTS,
  JOURNEY_SHARDS,
  TESTS,
  VALID_EVIDENCE_CLASSES,
  getTestEvidenceClass,
} from '../../../../scripts/industry/coverage-data.mjs'
import { INDUSTRY_KEYS } from '../schemas/industry-profiles'

describe('Coverage Evidence Classes Integrity (Wave 0)', () => {
  it('every test reference has a recognized evidence class', () => {
    // Check all TESTS keys
    for (const testPath of Object.values(TESTS)) {
      const meta = getTestEvidenceClass(testPath)
      expect(meta).toBeDefined()
      expect(VALID_EVIDENCE_CLASSES).toContain(meta.evidenceClass)
    }

    // Check all INDUSTRY_ACCEPTANCE_TESTS references
    for (const testList of Object.values(INDUSTRY_ACCEPTANCE_TESTS)) {
      expect(testList.length).toBeGreaterThan(0)
      for (const testPath of testList) {
        const meta = getTestEvidenceClass(testPath)
        expect(meta).toBeDefined()
        expect(VALID_EVIDENCE_CLASSES).toContain(meta.evidenceClass)
      }
    }
  })

  it('no industry is verified supported solely from shared-core tests', () => {
    for (const [trade, testList] of Object.entries(INDUSTRY_ACCEPTANCE_TESTS)) {
      const classes = testList.map((t: string) => getTestEvidenceClass(t).evidenceClass)
      const hasIndustrySpecific = classes.some(
        (cls: string) =>
          cls === 'industry-pg' || cls === 'industry-http' || cls === 'industry-browser',
      )
      expect(
        hasIndustrySpecific,
        `Trade "${trade}" must have at least one industry-specific test (pg/http/browser), not just shared-core`,
      ).toBe(true)
    }
  })

  it('industry acceptance coverage covers all registered industries', () => {
    const coveredTrades = Object.keys(INDUSTRY_ACCEPTANCE_TESTS)
    expect(coveredTrades.length).toBe(INDUSTRY_KEYS.length)
    expect(coveredTrades.length).toBe(67)
    for (const key of INDUSTRY_KEYS) {
      expect(coveredTrades).toContain(key)
    }
  })

  it('journey shards count is 4 and shards are evenly distributed', () => {
    expect(JOURNEY_SHARDS).toBe(4)
    const shardsSeen = new Set<string>()
    for (const testList of Object.values(INDUSTRY_ACCEPTANCE_TESTS)) {
      const pgTest = testList.find((t: string) => t.includes('journey-industries-'))
      expect(pgTest).toBeDefined()
      if (pgTest) shardsSeen.add(pgTest)
    }
    expect(shardsSeen.size).toBe(4)
  })
})
