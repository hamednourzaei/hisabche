// ============================================
// packages/validation/src/__tests__/sellable-industries.test.ts
//
// V65 · V64 §12–13 — «which industries may we sell today?» is a generated answer
// with a reason beside every «no», not a number typed into a report.
//
// The file is produced by `scripts/industry/generate-sellable.mjs` from the
// generated support levels + the acceptance results. Acceptance evidence that
// was recorded at another commit proves nothing about this one, so the
// generator downgrades every industry to `sellable: false` until it is
// re-recorded. This suite holds that rule in place.
// ============================================

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { INDUSTRY_KEYS } from '../schemas/industry-profiles'

const ROOT = resolve(__dirname, '../../../..')
const JSON_PATH = resolve(ROOT, 'docs/architecture/industry/sellable-industries.json')
const GENERATOR = resolve(ROOT, 'scripts/industry/generate-sellable.mjs')

interface IndustryRow {
  key: string
  status: string
  sellable: boolean
  registered: boolean
  profiled: boolean
  workflowComplete: boolean
  tests: string[]
  postgresEvidence: boolean
  browserEvidence: boolean
  missingEvidence: string[]
}

interface SellableCounts {
  registered: number
  profiled: number
  workflowVerified: number
  sellable: number
  notYetSellable: number
  postgresEvidence: number
  browserEvidence: number
}

interface SellableReport {
  head: string | null
  acceptanceCommit: string | null
  evidenceFresh: boolean
  acceptanceWorktreeDirty: boolean
  limitations: string[]
  counts: SellableCounts
  industries: IndustryRow[]
}

const report = JSON.parse(readFileSync(JSON_PATH, 'utf8')) as SellableReport

const STATUSES = ['SELLABLE', 'WORKFLOW_VERIFIED', 'PARTIALLY_SUPPORTED', 'REGISTERED']

describe('sellable-industries.json — generated, and honest', () => {
  it('is not stale', () => {
    const run = spawnSync(process.execPath, [GENERATOR, '--check'], { encoding: 'utf8' })
    expect(run.stderr.trim(), 'run node scripts/industry/generate-sellable.mjs').toBe('')
    expect(run.status).toBe(0)
  })

  it('answers for exactly the registered industries, once each', () => {
    expect(report.industries.map((row) => row.key).sort()).toEqual([...INDUSTRY_KEYS].sort())
    expect(new Set(report.industries.map((row) => row.key)).size).toBe(report.industries.length)
    for (const row of report.industries) expect(STATUSES, row.key).toContain(row.status)
  })

  it('reports the counts it actually contains', () => {
    const measured = {
      registered: report.industries.filter((row) => row.registered).length,
      profiled: report.industries.filter((row) => row.profiled).length,
      workflowVerified: report.industries.filter((row) => row.workflowComplete).length,
      sellable: report.industries.filter((row) => row.sellable).length,
      notYetSellable: report.industries.filter((row) => !row.sellable).length,
      postgresEvidence: report.industries.filter((row) => row.postgresEvidence).length,
      browserEvidence: report.industries.filter((row) => row.browserEvidence).length,
    }
    expect(report.counts).toEqual(measured)
    expect(report.counts.registered).toBe(INDUSTRY_KEYS.length)
    expect(report.counts.sellable + report.counts.notYetSellable).toBe(report.industries.length)
  })

  it('never says SELLABLE without fresh proof', () => {
    for (const row of report.industries) {
      if (!row.sellable) continue
      expect(report.evidenceFresh, `${row.key}: stale acceptance evidence`).toBe(true)
      expect(row.profiled, row.key).toBe(true)
      expect(row.workflowComplete, row.key).toBe(true)
      expect(row.tests.length, row.key).toBeGreaterThan(0)
      expect(row.missingEvidence, row.key).toEqual([])
      // V65: V64 §13.17. An HTTP-injection test is not PostgreSQL integration
      // coverage, and a fresh HTTP run is not a reason to sell the industry.
      expect(row.postgresEvidence, `${row.key}: no Postgres evidence`).toBe(true)
    }
    if (!report.evidenceFresh) {
      expect(report.limitations).toContain('ACCEPTANCE_EVIDENCE_STALE')
      expect(report.industries.every((row) => !row.sellable)).toBe(true)
    }
  })

  it('cannot be made sellable by a fresh HTTP run alone', () => {
    // The acceptance files this repository maps are `*.test.ts` HTTP-injection
    // suites; none of them is a `*.pg.test.ts`. So even with evidence recorded
    // at HEAD, every mapped industry stays WORKFLOW_VERIFIED, and each says
    // which evidence is still missing.
    for (const row of report.industries) {
      if (row.postgresEvidence) continue
      expect(row.sellable, `${row.key} sold without Postgres evidence`).toBe(false)
      expect(row.missingEvidence, row.key).toContain('POSTGRES_EVIDENCE')
      expect(['WORKFLOW_VERIFIED', 'PARTIALLY_SUPPORTED', 'REGISTERED'], row.key).toContain(
        row.status,
      )
    }
    expect(report.counts.postgresEvidence).toBe(
      report.industries.filter((row) => row.postgresEvidence).length,
    )
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
    for (const code of report.limitations) expect(code).toMatch(/^[A-Z][A-Z0-9_]*$/)
  })

  it('will not sell on evidence recorded over uncommitted edits', () => {
    // The acceptance runner records `worktreeDirty`. If the tested tree held
    // edits, the commit named in the file does not describe the tested code.
    if (!report.acceptanceWorktreeDirty) return
    expect(report.industries.every((row) => !row.sellable)).toBe(true)
    for (const row of report.industries) {
      expect(row.missingEvidence, row.key).toContain('EVIDENCE_NOT_ON_COMMITTED_TREE')
    }
  })

  it('gives every «not yet» a reason a person can act on', () => {
    for (const row of report.industries) {
      if (row.sellable) continue
      expect(row.missingEvidence.length, `${row.key} has no reason`).toBeGreaterThan(0)
      for (const code of row.missingEvidence) {
        expect(code, `${row.key}: «${code}»`).toMatch(/^[A-Z][A-Z0-9_]*$/)
      }
    }
  })

  it('names the commit its evidence came from', () => {
    // A report that cannot say what it tested is not evidence.
    expect(report.head).toMatch(/^[0-9a-f]{40}$/)
    if (report.acceptanceCommit !== null) {
      expect(report.acceptanceCommit).toMatch(/^[0-9a-f]{40}$/)
    }
    expect(report.evidenceFresh).toBe(report.acceptanceCommit === report.head)
  })
})
