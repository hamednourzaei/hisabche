// ============================================
// packages/validation/src/__tests__/open-decisions.test.ts
//
// docs/architecture/OPEN-DECISIONS.md records the product questions that are
// still the owner's to answer. Two properties have to hold for it to be worth
// anything:
//
//   1. it says what the code actually does (band count, hook count), not what a
//      previous report remembered, and
//   2. it cannot become a gate — nothing under scripts/ or package.json may
//      read it, so «a decision is pending» never stops an independent test run.
//
// This guard reads files only. The 10-second hook scan already runs in
// unused-hooks-ledger.test.ts; here the count is the CSV's data-row count.
// ============================================

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../../..')
const DOC = resolve(ROOT, 'docs/architecture/OPEN-DECISIONS.md')
const CSV = resolve(ROOT, 'docs/architecture/universal-core/UNUSED-HOOKS.csv')
const AUTH_SCHEMA = resolve(ROOT, 'packages/validation/src/schemas/auth.schema.ts')
const ONBOARDING_SLICE = resolve(ROOT, 'packages/store/src/slices/onboarding.slice.ts')

const COLUMNS = [
  'ID',
  'Decision',
  'Status',
  'Measured today',
  'Blocks',
  'Reversible default in force',
  'Revisit when',
] as const

const text = readFileSync(DOC, 'utf8')
const lines = text.split(/\r?\n/)

/** Cells of a pipe-table row, without the leading and trailing empty cell. */
function cellsOf(line: string): string[] {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())
}

function bare(cell: string): string {
  return cell.replace(/`/g, '').trim()
}

const headerLine = lines.find((line) => line.trimStart().startsWith('| ID |'))
const header = headerLine ? cellsOf(headerLine) : []

const decisionRows = lines
  .filter((line) => /^\|\s*D-\d{2}\s*\|/.test(line))
  .map((line) => {
    const cells = cellsOf(line)
    return {
      id: bare(cells[0] ?? ''),
      cells,
      measured: bare(cells[3] ?? ''),
      status: bare(cells[2] ?? ''),
      blocks: bare(cells[4] ?? ''),
    }
  })

function quotedValues(source: string): string[] {
  return [...source.matchAll(/'([^']+)'/g)].map((match) => match[1] ?? '')
}

const authEnum = quotedValues(
  /storeSize: z\.enum\(\[([^\]]*)\]\)/.exec(readFileSync(AUTH_SCHEMA, 'utf8'))?.[1] ?? '',
)

const storeUnion = quotedValues(
  /export type StoreSize =([^\n]*)/.exec(readFileSync(ONBOARDING_SLICE, 'utf8'))?.[1] ?? '',
)

const hookRowCount =
  readFileSync(CSV, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0).length - 1

function filesUnder(directory: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(directory)) {
    const full = resolve(directory, entry)
    if (statSync(full).isDirectory()) out.push(...filesUnder(full))
    else out.push(full)
  }
  return out
}

describe('OPEN-DECISIONS.md — recorded, and not a gate', () => {
  it('has the columns the parser reads, in order', () => {
    expect(header).toEqual([...COLUMNS])
  })

  it('records exactly the two decisions this HEAD has open', () => {
    expect(decisionRows.map((row) => row.id)).toEqual(['D-01', 'D-02'])
    for (const row of decisionRows) {
      expect(row.cells.length, row.id).toBe(COLUMNS.length)
      expect(row.status, row.id).toBe('NEEDS_OWNER_DECISION')
    }
  })

  it('leaves both decisions to the owner and blocks nothing', () => {
    // «Blocks: none» is the owner's requirement: a pending product answer must
    // not stop an independent test run. A row that blocks something would be an
    // agent turning a question into a queue.
    for (const row of decisionRows) expect(row.blocks, row.id).toBe('none')
  })

  it('states the band count the code has, and no other', () => {
    const d01 = decisionRows.find((row) => row.id === 'D-01')
    expect(authEnum.length).toBeGreaterThan(0)
    // The schema and the client store must agree before the document can.
    expect(storeUnion).toEqual(authEnum)
    expect(d01?.measured).toBe(`${authEnum.length} bands`)
    for (const band of authEnum) expect(d01?.cells.join(' '), band).toContain(band)
  })

  it('states the hook count the ledger has, and links the ledger', () => {
    const d02 = decisionRows.find((row) => row.id === 'D-02')
    expect(hookRowCount).toBeGreaterThan(0)
    expect(d02?.measured).toBe(`${hookRowCount} hooks`)
    expect(d02?.cells.join(' ')).toContain('docs/architecture/universal-core/UNUSED-HOOKS.csv')
  })

  it('names only repository paths that exist', () => {
    // A decision is only actionable if «the code that would change» is real.
    // Tokens like `small` or `21-50` are values, not paths, and are not checked.
    const paths = [
      ...text.matchAll(/`((?:backend|packages|apps|docs|scripts|\.ai)\/[^`\s]*)`/g),
    ].map((match) => (match[1] ?? '').replace(/:\d+(?:-\d+)?$/, ''))
    expect(paths.length).toBeGreaterThan(5)
    for (const path of paths) expect(existsSync(resolve(ROOT, path)), path).toBe(true)
  })

  it('is documentation: no script and no package script reads it', () => {
    const packageJson = readFileSync(resolve(ROOT, 'package.json'), 'utf8')
    expect(packageJson).not.toContain('OPEN-DECISIONS')

    const sourceFiles = filesUnder(resolve(ROOT, 'scripts')).filter(
      (file) => !file.endsWith('.map'),
    )
    expect(sourceFiles.length).toBeGreaterThan(10)
    for (const file of sourceFiles) {
      expect(readFileSync(file, 'utf8'), file).not.toContain('OPEN-DECISIONS')
    }
  })
})
