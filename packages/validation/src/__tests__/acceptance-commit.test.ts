// ============================================
// packages/validation/src/__tests__/acceptance-commit.test.ts
//
// V64 §21.4 — acceptance evidence must describe the commit that ships.
//
// `scripts/release/check-acceptance-commit.mjs` is the gate. These tests run it
// against fixtures, not against the repository's own artifact: the working tree
// is normally dirty while a change is being made, and a test that expected that
// would be a test that expects the gate to fail.
//
// What is held here:
//   ✓ a report from another commit is refused, with a code
//   ✓ a report recorded over uncommitted edits is refused
//   ✓ a failed file, an empty report, and totals that disagree are refused
//   ✓ a clean, green report naming HEAD is the only thing that passes
// ============================================

import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../../..')
const GATE = resolve(ROOT, 'scripts/release/check-acceptance-commit.mjs')

const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim()

let scratch = ''

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), 'hisabche-acceptance-gate-'))
})

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true })
})

function artifact(overrides: Record<string, unknown> = {}) {
  return {
    commit: head,
    worktreeDirty: false,
    dirtyFiles: [],
    results: { 'backend/src/__tests__/a.test.ts': { status: 'passed' } },
    totals: { files: 1, filesPassed: 1, filesFailed: 0, filesNotRun: 0 },
    ...overrides,
  }
}

function runGate(document: unknown, name: string) {
  const file = join(scratch, `${name}.json`)
  writeFileSync(file, JSON.stringify(document, null, 2))
  return spawnSync(process.execPath, [GATE, '--file', file], { encoding: 'utf8' })
}

function codes(stderr: string): string[] {
  return [...stderr.matchAll(/\b([A-Z][A-Z0-9_]+):/g)].map((match) => match[1] ?? '')
}

describe('scripts/release/check-acceptance-commit.mjs — evidence must describe HEAD', () => {
  it('passes a clean, green report that names HEAD', () => {
    const run = runGate(artifact(), 'clean')
    expect(run.stderr).toBe('')
    expect(run.status).toBe(0)
    expect(run.stdout).toContain('OK:')
  })

  it('refuses a report recorded at another commit', () => {
    const run = runGate(artifact({ commit: '0'.repeat(40) }), 'other-commit')
    expect(run.status).toBe(1)
    expect(codes(run.stderr)).toContain('ACCEPTANCE_COMMIT_MISMATCH')
  })

  it('refuses a report recorded over uncommitted edits', () => {
    const run = runGate(
      artifact({ worktreeDirty: true, dirtyFiles: ['packages/ui/src/a.tsx'] }),
      'dirty',
    )
    expect(run.status).toBe(1)
    expect(codes(run.stderr)).toContain('EVIDENCE_NOT_ON_COMMITTED_TREE')
  })

  it('refuses a report with a failed file, and names it', () => {
    const run = runGate(
      artifact({
        results: { 'backend/src/__tests__/a.test.ts': { status: 'failed' } },
        totals: { files: 1, filesPassed: 0, filesFailed: 1, filesNotRun: 0 },
      }),
      'failed',
    )
    expect(run.status).toBe(1)
    expect(codes(run.stderr)).toContain('EVIDENCE_NOT_GREEN')
    expect(run.stderr).toContain('a.test.ts')
  })

  it('refuses an empty report instead of reading «no failures» as green', () => {
    const run = runGate(
      artifact({
        results: {},
        totals: { files: 0, filesPassed: 0, filesFailed: 0, filesNotRun: 0 },
      }),
      'empty',
    )
    expect(run.status).toBe(1)
    expect(codes(run.stderr)).toContain('EVIDENCE_EMPTY')
  })

  it('refuses totals that do not describe the results they sit beside', () => {
    const run = runGate(artifact({ totals: { files: 9, filesPassed: 9 } }), 'totals')
    expect(run.status).toBe(1)
    expect(codes(run.stderr)).toContain('EVIDENCE_TOTALS_DISAGREE')
  })

  it('is blocked, not green, when there is no artifact to check', () => {
    const missing = join(scratch, 'does-not-exist.json')
    const run = spawnSync(process.execPath, [GATE, '--file', missing], { encoding: 'utf8' })
    expect(run.status).toBe(2)
    expect(run.stderr).toContain('BLOCKED')
  })
})
