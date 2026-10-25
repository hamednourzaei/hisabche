import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { OFFLINE_ENDPOINT_MATRIX } from '../index'

const ROOT = path.resolve(__dirname, '../../../../')
const CSV_PATH = path.join(ROOT, 'docs/architecture/capability-matrix.csv')
const MATRIX_FILE = path.join(ROOT, 'packages/validation/src/schemas/offline-endpoint-matrix.ts')

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

const HEADERS = [
  'endpoint',
  'feature',
  'status',
  'domain',
  'server_reason',
  'can_run_locally',
  'data_needed_locally',
  'local_tables_exist',
  'conflict_risk',
  'target_path',
  'wave',
  'registry_intent',
  'tests_required',
  'evidence',
]

interface Row {
  line: number
  cells: string[]
  get: (header: string) => string
}

function readCsv(): Row[] {
  const lines = fs.readFileSync(CSV_PATH, 'utf8').trim().split('\n')
  const header = parseCsvLine(lines[0]!)
  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line)
    return {
      line: index + 2,
      cells,
      get: (name: string) => cells[header.indexOf(name)] ?? '',
    }
  })
}

describe('capability-matrix.csv — generated from code, and CHECKED against it', () => {
  it('exists, covers all 462 matrix endpoints, with the documented header', () => {
    expect(fs.existsSync(CSV_PATH), `Missing ${CSV_PATH}`).toBe(true)
    const lines = fs.readFileSync(CSV_PATH, 'utf8').trim().split('\n')
    expect(lines.length).toBe(463)
    expect(lines[0]).toBe(HEADERS.join(','))

    const rows = readCsv()
    const csvEndpoints = new Set(rows.map((r) => r.get('endpoint')))
    const matrixKeys = Object.keys(OFFLINE_ENDPOINT_MATRIX)
    expect(matrixKeys.length).toBe(462)
    for (const key of matrixKeys) {
      expect(csvEndpoints.has(key), `Endpoint ${key} missing from capability-matrix.csv`).toBe(true)
    }
  })

  it('every row carries REAL evidence: its own matrix line, not a shared placeholder', () => {
    // ⚠️ THE DEFECT THIS REPLACES. 273 of 462 rows used to cite
    // `offline-endpoint-matrix.ts:41` — the line the array opens on — because
    // the generator's fallback was hard-coded. Evidence that points at the
    // array opener proves nothing about the row it sits on.
    const rows = readCsv()
    const matrixLines = fs.readFileSync(MATRIX_FILE, 'utf8').split('\n')

    const seenLine = new Map<string, string>()
    for (const row of rows) {
      const evidence = row.get('evidence')
      const match = evidence.match(/matrix@([^\s:]+):(\d+)/)
      expect(match, `row ${row.line} has no matrix@ file:line evidence: ${evidence}`).not.toBeNull()

      const file = match![1]!
      const lineNumber = Number(match![2])
      expect(file).toBe('packages/validation/src/schemas/offline-endpoint-matrix.ts')

      // The cited line must be THIS row's declaration, not a neighbour's.
      const cited = (matrixLines[lineNumber - 1] ?? '').trim()
      const endpoint = row.get('endpoint')
      expect(
        cited,
        `row ${row.line} (${endpoint}) cites line ${lineNumber}, which is: ${cited}`,
      ).toContain(`'${endpoint}'`)

      // Two rows may never share one line.
      const previous = seenLine.get(`${file}:${lineNumber}`)
      expect(
        previous,
        `${endpoint} and ${previous} both cite ${file}:${lineNumber}`,
      ).toBeUndefined()
      seenLine.set(`${file}:${lineNumber}`, endpoint)
    }

    // Distinct evidence everywhere it is expected: one per row.
    const distinct = new Set(rows.map((r) => r.get('evidence')))
    expect(distinct.size).toBe(rows.length)
  })

  it('every server_route claim points at a line that registers that route', () => {
    const rows = readCsv()
    let asserted = 0
    for (const row of rows) {
      // Evidence is space-separated; `server@none` means no route was found.
      const match = row.get('evidence').match(/server@([^\s:]+):(\d+)/)
      if (!match) continue
      const [, file, lineNumber] = match
      const cited = (
        fs.readFileSync(path.join(ROOT, file!), 'utf8').split('\n')[Number(lineNumber) - 1] ?? ''
      ).trim()
      // The registration opener. The path literal is on the next line in this
      // codebase, so the opener is what the evidence can honestly point at.
      expect(cited, `${row.get('endpoint')} cites ${file}:${lineNumber}`).toMatch(
        /\.(get|post|put|patch|delete)\s*(<[^>]*>)?\(/i,
      )
      asserted++
    }
    // The generator resolves 461 of 462; one client call has no server route.
    expect(asserted).toBeGreaterThanOrEqual(460)
  })

  it('a cloud-only reason is only claimed with the code that proves it', () => {
    const rows = readCsv()
    for (const row of rows) {
      const reason = row.get('server_reason')
      if (['none', 'unproven'].includes(reason)) continue
      // Every non-trivial reason carries a `reason@` (scoped) or `reason~`
      // (domain-wide only) proof line.
      expect(row.get('evidence'), `row ${row.line} claims ${reason} without a proof line`).toMatch(
        /reason[@~][^:]+:\d+/,
      )
    }
  })

  it('⚠️ most proofs are SCOPED to the endpoint, not just its domain', () => {
    // `reason@` = the line is in a file this endpoint's own handler reaches.
    // `reason~` = it was only found somewhere in the feature's service
    // directory — which is how `GET /developer/catalog` ended up "proved" by
    // `signWebhookPayload`, a different operation in the same folder.
    const rows = readCsv()
    const proven = rows.filter((r) => !['none', 'unproven'].includes(r.get('server_reason')))
    const scoped = proven.filter((r) => /reason@/.test(r.get('evidence')))
    const unscoped = proven.filter((r) => /reason~/.test(r.get('evidence')))

    expect(proven.length).toBeGreaterThan(50)
    // The majority of proofs must be about the row itself. A regression toward
    // directory-wide proofs would push this ratio down.
    expect(
      scoped.length / proven.length,
      `${unscoped.length} proofs are domain-wide only: ${unscoped
        .map((r) => r.get('endpoint'))
        .slice(0, 8)
        .join(', ')}`,
    ).toBeGreaterThan(0.7)
  })

  it('a delivery reason is only claimed by a row that delivers', () => {
    // The webhook proof used to cover the whole `/developer/*` surface, so a
    // catalogue read was filed as a webhook operation.
    for (const row of readCsv()) {
      if (row.get('server_reason') !== 'webhook-delivery') continue
      expect(
        /[Ww]ebhook|[Dd]eliver/.test(row.get('endpoint')),
        `webhook-delivery claimed by ${row.get('endpoint')}, which does not deliver`,
      ).toBe(true)
    }
  })

  it('contains valid classifications for every row', () => {
    const validStatuses = new Set(['available', 'online_required', 'not_supported'])
    const validServerReasons = new Set([
      'none',
      'unproven',
      'auth',
      'payment-gateway',
      'sms-email',
      'subscription-billing',
      'cross-device',
      'cross-branch-aggregation',
      'file-storage',
      'large-report',
      'ai-provider',
      'webhook-delivery',
      'server-worker',
    ])
    const validLocalRun = new Set(['yes', 'partly', 'no'])
    const validLocalTables = new Set(['yes', 'no', 'partial', 'n/a'])
    const validConflictRisk = new Set(['low', 'med', 'high'])
    const validTargetPath = new Set(['LOCAL_FIRST', 'HYBRID', 'SERVER_ONLY'])

    for (const row of readCsv()) {
      expect(validStatuses.has(row.get('status')), `Invalid status at line ${row.line}`).toBe(true)
      expect(
        validServerReasons.has(row.get('server_reason')),
        `Invalid server_reason at line ${row.line}`,
      ).toBe(true)
      expect(
        validLocalRun.has(row.get('can_run_locally')),
        `Invalid can_run_locally at line ${row.line}`,
      ).toBe(true)
      expect(
        validLocalTables.has(row.get('local_tables_exist')),
        `Invalid local_tables_exist at line ${row.line}`,
      ).toBe(true)
      expect(
        validConflictRisk.has(row.get('conflict_risk')),
        `Invalid conflict_risk at line ${row.line}`,
      ).toBe(true)
      expect(
        validTargetPath.has(row.get('target_path')),
        `Invalid target_path at line ${row.line}`,
      ).toBe(true)
    }
  })

  it('a SERVER_ONLY row must be cloud-proven; a LOCAL row must not claim a cloud reason', () => {
    for (const row of readCsv()) {
      const target = row.get('target_path')
      const reason = row.get('server_reason')
      if (target === 'SERVER_ONLY') {
        expect(
          ['none', 'unproven'].includes(reason),
          `line ${row.line}: SERVER_ONLY without a proven reason (${row.get('endpoint')})`,
        ).toBe(false)
      }
      if (target === 'LOCAL_FIRST' && row.get('status') === 'available') {
        expect(reason, `line ${row.line}: available locally but claims ${reason}`).toBe('none')
      }
    }
  })
})
