// ============================================
// packages/validation/src/__tests__/unused-hooks-ledger.test.ts
//
// V64 §4: a capability is not operational because its hook exists. This ledger
// names the hooks `packages/api` exports that no application calls, so «connect
// them all» cannot happen by accident and each one gets an explicit product
// decision instead.
//
// The guard re-runs the generator: if somebody wires a hook (or adds a new one
// nobody uses), the ledger is stale and this fails until it is regenerated.
// ============================================

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../../..')
const CSV = resolve(ROOT, 'docs/architecture/universal-core/UNUSED-HOOKS.csv')
const GENERATOR = resolve(ROOT, 'scripts/api/unused-hooks.mjs')

const lines = readFileSync(CSV, 'utf8')
  .split(/\r?\n/)
  .filter((line) => line.trim().length > 0)

const COLUMNS = [
  'hook',
  'defined_in',
  'module',
  'exported_as',
  'duplicate_in',
  'server_route',
  'server_route_evidence',
  'decision',
] as const

interface HookRow {
  hook: string
  defined_in: string
  module: string
  exported_as: string
  duplicate_in: string
  server_route: string
  server_route_evidence: string
  decision: string
}

const header = (lines[0] ?? '').split(',')

const rows: HookRow[] = lines.slice(1).map((line) => {
  // Every cell is quoted by the generator and no value contains a comma.
  const cells = line.split('","').map((cell) => cell.replace(/^"|"$/g, ''))
  return {
    hook: cells[0] ?? '',
    defined_in: cells[1] ?? '',
    module: cells[2] ?? '',
    exported_as: cells[3] ?? '',
    duplicate_in: cells[4] ?? '',
    server_route: cells[5] ?? '',
    server_route_evidence: cells[6] ?? '',
    decision: cells[7] ?? '',
  }
})

describe('UNUSED-HOOKS.csv — measured, not guessed', () => {
  it('has the columns the parser reads, in order', () => {
    expect(header).toEqual([...COLUMNS])
  })

  it('is not stale', () => {
    const run = spawnSync(process.execPath, [GENERATOR, '--check'], {
      encoding: 'utf8',
      timeout: 240_000,
    })
    expect(run.stderr.trim(), 'run node scripts/api/unused-hooks.mjs').toBe('')
    expect(run.status).toBe(0)
  }, 300_000)

  it('names each hook once, with the file that defines it', () => {
    const hooks = rows.map((row) => row.hook)
    expect(new Set(hooks).size).toBe(hooks.length)
    for (const row of rows) {
      expect(row.hook).toMatch(/^use[A-Z][A-Za-z0-9]*$/)
      expect(row.defined_in).toMatch(/^packages\/api\/src\/hooks\/.+\.ts$/)
      expect(row.module.length).toBeGreaterThan(0)
    }
  })

  it('leaves every decision to the owner, and says so', () => {
    // The owner's instruction: wiring all of them would be wrong. A row that
    // says anything else would be an agent making a product decision.
    for (const row of rows) expect(row.decision, row.hook).toBe('NEEDS_OWNER_DECISION')
  })

  it('cites the server route only with a file and a line', () => {
    for (const row of rows) {
      if (!row.server_route) {
        expect(row.server_route_evidence, row.hook).toBe('')
        continue
      }
      expect(row.server_route).toMatch(/^\//)
      // A route lives either in the Fastify backend or in the device's local
      // engine; both are real, and the evidence is a file plus a line.
      expect(row.server_route_evidence).toMatch(
        /^(backend\/src|packages\/local-engine\/src)\/.*:\d+( ; (backend\/src|packages\/local-engine\/src)\/.*:\d+)*$/,
      )
    }
  })
})
