// ============================================
// packages/validation/src/__tests__/sellable-industries.test.ts
//
// V64 §2 — «which industries may we sell today?» is a generated answer with a
// reason beside every «no», not a number typed into a report.
//
// V65 checked five conditions and printed SELLABLE from that subset. The
// generator now evaluates all NINE criteria of V64 §2 (declared once in
// `scripts/industry/sellable-criteria.mjs`) against evidence that actually ran
// at this commit over a clean tree. This suite holds that rule in place.
// ============================================

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { INDUSTRY_KEYS } from '../schemas/industry-profiles'

const ROOT = resolve(__dirname, '../../../..')
const JSON_PATH = resolve(ROOT, 'docs/architecture/industry/sellable-industries.json')
const DOC_PATH = resolve(ROOT, 'docs/sales/SELLABLE-INDUSTRIES.md')
const GENERATOR = resolve(ROOT, 'scripts/industry/generate-sellable.mjs')

interface CriterionRow {
  code: string
  section: string
  title: string
  kind: string
  industriesMeeting: number
}

interface IndustryRow {
  key: string
  status: string
  sellable: boolean
  registered: boolean
  profiled: boolean
  workflowComplete: boolean
  tests: string[]
  criteria: Record<string, boolean>
  operationsVerified: boolean
  postgresEvidence: boolean
  browserEvidence: boolean
  missingEvidence: string[]
}

interface SellableReport {
  head: string | null
  acceptanceCommit: string | null
  evidenceFresh: boolean
  acceptanceWorktreeDirty: boolean
  criteria: CriterionRow[]
  limitations: string[]
  counts: {
    registered: number
    profiled: number
    workflowVerified: number
    operationsVerified: number
    sellable: number
    notYetSellable: number
    postgresEvidence: number
    browserEvidence: number
  }
  industries: IndustryRow[]
}

const report = JSON.parse(readFileSync(JSON_PATH, 'utf8')) as SellableReport

const STATUSES = ['SELLABLE', 'WORKFLOW_VERIFIED', 'PARTIALLY_SUPPORTED', 'REGISTERED']

// The nine criteria of V64 §2, plus the preconditions that are not evidence.
const PRECONDITIONS = [
  'INDUSTRY_NOT_REGISTERED',
  'OPERATIONAL_DNA_PROFILE',
  'ACCEPTANCE_EVIDENCE_STALE',
  'EVIDENCE_NOT_ON_COMMITTED_TREE',
]

const CRITERIA_CODES = report.criteria.map((criterion) => criterion.code)

describe('sellable-industries.json — all nine criteria, generated and honest', () => {
  it('is not stale', () => {
    const run = spawnSync(process.execPath, [GENERATOR, '--check'], { encoding: 'utf8' })
    expect(run.stderr.trim(), 'run node scripts/industry/generate-sellable.mjs').toBe('')
    expect(run.status).toBe(0)
  })

  it('declares V64 §2 in full: nine criteria, sections 2.1–2.9', () => {
    // Five was what V65 checked. A sixth code appearing without a criterion
    // (or a criterion disappearing) fails here.
    expect(CRITERIA_CODES).toEqual([
      'WORKSPACE_JOURNEY',
      'ONBOARDING_JOURNEY',
      'FIRST_VALUE_JOURNEY',
      'DAILY_OPERATIONS_JOURNEY',
      'REPORTING_PROOF',
      'OFFLINE_GATE_PROOF',
      'RETURNS_PROOF',
      'POSTGRES_JOURNEY',
      'BROWSER_JOURNEY',
      'CLAIMS_PROOF',
    ])
    expect(new Set(CRITERIA_CODES).size).toBe(CRITERIA_CODES.length)
    expect(new Set(report.criteria.map((criterion) => criterion.section))).toEqual(
      new Set(['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8', '2.9']),
    )
    for (const criterion of report.criteria) {
      expect(criterion.title.length, criterion.code).toBeGreaterThan(20)
      expect(['global', 'industry-in-file', 'mapped', 'artifact'], criterion.code).toContain(
        criterion.kind,
      )
    }
  })

  it('answers for exactly the registered industries, once each', () => {
    expect(report.industries.map((row) => row.key).sort()).toEqual([...INDUSTRY_KEYS].sort())
    expect(new Set(report.industries.map((row) => row.key)).size).toBe(report.industries.length)
    for (const row of report.industries) expect(STATUSES, row.key).toContain(row.status)
  })

  it('gives every industry a verdict on every criterion, not just the convenient ones', () => {
    for (const row of report.industries) {
      expect(Object.keys(row.criteria).sort(), row.key).toEqual([...CRITERIA_CODES].sort())
      for (const code of CRITERIA_CODES) {
        expect(typeof row.criteria[code], `${row.key} ${code}`).toBe('boolean')
      }
    }
  })

  it('reports the counts it actually contains', () => {
    const measured = {
      registered: report.industries.filter((row) => row.registered).length,
      profiled: report.industries.filter((row) => row.profiled).length,
      workflowVerified: report.industries.filter((row) => row.workflowComplete).length,
      operationsVerified: report.industries.filter((row) => row.criteria.DAILY_OPERATIONS_JOURNEY)
        .length,
      sellable: report.industries.filter((row) => row.sellable).length,
      notYetSellable: report.industries.filter((row) => !row.sellable).length,
      postgresEvidence: report.industries.filter((row) => row.criteria.POSTGRES_JOURNEY).length,
      browserEvidence: report.industries.filter((row) => row.criteria.BROWSER_JOURNEY).length,
    }
    expect(report.counts).toEqual(measured)
    expect(report.counts.registered).toBe(INDUSTRY_KEYS.length)
    expect(report.counts.sellable + report.counts.notYetSellable).toBe(report.industries.length)
  })

  it('derives sellable from the missing-evidence list, and from nothing else', () => {
    // ONE predicate: a criterion can never be added to the reason list and
    // forgotten by the verdict.
    for (const row of report.industries) {
      expect(row.sellable, `${row.key}: sellable must equal «no missing evidence»`).toBe(
        row.missingEvidence.length === 0,
      )
      for (const code of CRITERIA_CODES) {
        if (row.criteria[code]) continue
        expect(row.missingEvidence, `${row.key} lacks ${code} but does not say so`).toContain(code)
      }
    }
  })

  it('never says SELLABLE without every criterion, this commit, over a clean tree', () => {
    for (const row of report.industries) {
      if (!row.sellable) continue
      expect(report.evidenceFresh, `${row.key}: stale acceptance evidence`).toBe(true)
      expect(report.acceptanceWorktreeDirty, `${row.key}: evidence over uncommitted edits`).toBe(
        false,
      )
      expect(row.profiled, row.key).toBe(true)
      expect(row.registered, row.key).toBe(true)
      expect(row.missingEvidence, row.key).toEqual([])
      for (const code of CRITERIA_CODES) expect(row.criteria[code], `${row.key} ${code}`).toBe(true)
      // V64 §2.8: HTTP injection is not PostgreSQL integration coverage.
      expect(row.postgresEvidence, `${row.key}: no Postgres journey`).toBe(true)
      expect(row.browserEvidence, `${row.key}: no Playwright journey`).toBe(true)
    }
    if (!report.evidenceFresh) {
      expect(report.limitations).toContain('ACCEPTANCE_EVIDENCE_STALE')
      expect(report.industries.every((row) => !row.sellable)).toBe(true)
    }
  })

  it('cannot be made sellable by a fresh HTTP run alone', () => {
    // The mapped acceptance files are `*.test.ts` HTTP-injection suites; none is
    // a `*.pg.test.ts`. So even with evidence recorded at HEAD, every mapped
    // industry stays WORKFLOW_VERIFIED at best, and each says what is missing.
    for (const row of report.industries) {
      if (row.criteria.POSTGRES_JOURNEY) continue
      expect(row.sellable, `${row.key} sold without Postgres evidence`).toBe(false)
      expect(row.missingEvidence, row.key).toContain('POSTGRES_JOURNEY')
      expect(['WORKFLOW_VERIFIED', 'PARTIALLY_SUPPORTED', 'REGISTERED'], row.key).toContain(
        row.status,
      )
    }
  })

  it('states the report-level limitations it is measured to have', () => {
    // Read off the counts, so a limitation disappears exactly when the evidence
    // arrives — not when someone remembers to delete a line.
    expect(report.limitations.includes('POSTGRES_EVIDENCE_MISSING')).toBe(
      report.counts.postgresEvidence === 0,
    )
    expect(report.limitations.includes('BROWSER_VERIFICATION_NOT_RUN')).toBe(
      report.counts.browserEvidence === 0,
    )
    expect(report.limitations.includes('ACCEPTANCE_EVIDENCE_STALE')).toBe(!report.evidenceFresh)
    expect(report.limitations.includes('EVIDENCE_NOT_ON_COMMITTED_TREE')).toBe(
      report.acceptanceWorktreeDirty,
    )
    for (const criterion of report.criteria) {
      expect(
        report.limitations.includes(`NO_INDUSTRY_PROVES:${criterion.code}`),
        criterion.code,
      ).toBe(criterion.industriesMeeting === 0)
      expect(criterion.industriesMeeting).toBe(
        report.industries.filter((row) => row.criteria[criterion.code]).length,
      )
    }
    for (const code of report.limitations)
      expect(code).toMatch(/^[A-Z][A-Z0-9_]*(:[A-Za-z0-9_]+)?$/)
  })

  it('will not sell on evidence recorded over uncommitted edits', () => {
    if (!report.acceptanceWorktreeDirty) return
    expect(report.industries.every((row) => !row.sellable)).toBe(true)
    for (const row of report.industries) {
      expect(row.missingEvidence, row.key).toContain('EVIDENCE_NOT_ON_COMMITTED_TREE')
    }
  })

  it('gives every «not yet» a reason a person can act on', () => {
    const known = new Set([...CRITERIA_CODES, ...PRECONDITIONS])
    for (const row of report.industries) {
      if (row.sellable) continue
      expect(row.missingEvidence.length, `${row.key} has no reason`).toBeGreaterThan(0)
      for (const code of row.missingEvidence) expect(known, `${row.key}: «${code}»`).toContain(code)
    }
  })

  it('names the commit its evidence came from', () => {
    expect(report.head).toMatch(/^[0-9a-f]{40}$/)
    if (report.acceptanceCommit !== null) {
      expect(report.acceptanceCommit).toMatch(/^[0-9a-f]{40}$/)
    }
    expect(report.evidenceFresh).toBe(report.acceptanceCommit === report.head)
  })

  it('publishes the same answers for a person', () => {
    expect(existsSync(DOC_PATH), 'docs/sales/SELLABLE-INDUSTRIES.md').toBe(true)
    const doc = readFileSync(DOC_PATH, 'utf8')
    expect(doc).toContain(`${report.counts.registered}** registered`)
    for (const row of report.industries) {
      // The table is prettier-padded, so the status cell is matched by content.
      expect(doc).toMatch(new RegExp(`\\| \`${row.key}\`\\s*\\|\\s*${row.status}\\s*\\|`))
    }
    for (const criterion of report.criteria) expect(doc).toContain(`\`${criterion.code}\``)
  })
})
