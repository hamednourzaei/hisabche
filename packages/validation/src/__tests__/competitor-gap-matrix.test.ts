// ============================================
// V70.1 — the 60-gap competitor catalog and the 67-industry matrix are evidence,
// not prose.
//
// `scripts/industry/generate-gap-matrix.mjs` builds both Markdown documents from
// `competitor-gaps.data.mjs` and measures every claimed gap against four real name
// inventories (backend routes, service directories, SQL tables, FEATURE_REGISTRY keys).
// This guard:
//   · fails when a document on disk is not what the generator produces
//   · re-reads the documents and checks the numbers they promise (60 / 67 / ≥5 / probe 0)
//   · proves the rules bite: a dataset of 59 gaps, or one gap whose probe matches a
//     name that exists, must turn the generator red
// ============================================

import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

import { INDUSTRY_KEYS } from '../index'

const ROOT = resolve(__dirname, '../../../..')
const CATALOG = resolve(ROOT, 'docs/architecture/V70-COMPETITOR-GAPS.md')
const MATRIX = resolve(ROOT, 'docs/industries/COMPETITOR-GAP-MATRIX.md')
const SCRIPTS = resolve(ROOT, 'scripts/industry')

const MIN_GAPS_PER_INDUSTRY = 5
const TOTAL_GAPS = 60
const TOTAL_INDUSTRIES = 67

const run = (args: string[], cwd = ROOT) =>
  spawnSync(process.execPath, args, { cwd, encoding: 'utf8' })

type CatalogRow = { id: string; industries: number; probe: string }

/** Read the generated catalog table back: `| G01 | family | fa | fa/en | rival | p/p/p/p | n | phase |`. */
function readCatalog(): CatalogRow[] {
  const rows: CatalogRow[] = []
  for (const line of readFileSync(CATALOG, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\|\s*(G\d{2,3})\s*\|(.*)\|\s*(\d+)\s*\|\s*(V\d+)\s*\|$/)
    if (!m) continue
    const probe =
      m[2]!
        .split('|')
        .map((cell) => cell.trim())
        .filter(Boolean)[4] ?? ''
    rows.push({ id: m[1]!, industries: Number(m[3]), probe })
  }
  return rows
}

type MatrixRow = { id: string; archetype: string; count: number; gaps: string[] }

/** Read the generated matrix table back: `| n | \`id\` | \`ARCH\` | n | G01, G02, … |`. */
function readMatrix(): MatrixRow[] {
  const rows: MatrixRow[] = []
  for (const line of readFileSync(MATRIX, 'utf8').split(/\r?\n/)) {
    const m = line.match(
      /^\|\s*\d+\s*\|\s*`([A-Za-z]+)`\s*\|\s*`([A-Z_]+)`\s*\|\s*(\d+)\s*\|\s*(.*?)\s*\|$/,
    )
    if (!m) continue
    rows.push({
      id: m[1]!,
      archetype: m[2]!,
      count: Number(m[3]),
      gaps: m[4]!
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    })
  }
  return rows
}

/** Copy the three generator modules into a scratch directory so a bad dataset can be injected. */
function scratchScripts(dataSource: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'hisabche-gaps-'))
  const industry = join(dir, 'scripts', 'industry')
  mkdirSync(industry, { recursive: true })
  copyFileSync(join(SCRIPTS, 'gap-matrix.lib.mjs'), join(industry, 'gap-matrix.lib.mjs'))
  copyFileSync(join(SCRIPTS, 'generate-gap-matrix.mjs'), join(industry, 'generate-gap-matrix.mjs'))
  writeFileSync(join(industry, 'competitor-gaps.data.mjs'), dataSource, 'utf8')
  return dir
}

const REAL_DATA_URL = pathToFileURL(join(SCRIPTS, 'competitor-gaps.data.mjs')).href

describe('competitor gap matrix', () => {
  it(
    'is current: both documents on disk are what the generator produces',
    { timeout: 20_000 },
    () => {
      const result = run(['scripts/industry/generate-gap-matrix.mjs', '--check'])
      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
    },
  )

  it(`catalogues exactly ${TOTAL_GAPS} unique gaps`, () => {
    const rows = readCatalog()
    expect(rows.length).toBe(TOTAL_GAPS)
    expect(new Set(rows.map((r) => r.id)).size).toBe(TOTAL_GAPS)
    const ids = rows.map((r) => r.id).sort()
    expect(ids[0]).toBe('G01')
    for (const id of ids) expect(id).toMatch(/^G\d{2,3}$/)
  })

  it('never claims a gap whose probe names something that already exists', () => {
    const rows = readCatalog()
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.probe, `${row.id} must show 0/0/0/0`).toBe('۰/۰/۰/۰')
    }
  })

  it(`maps all ${TOTAL_INDUSTRIES} industries once each, with at least ${MIN_GAPS_PER_INDUSTRY} gaps`, () => {
    const rows = readMatrix()
    expect(rows.length).toBe(TOTAL_INDUSTRIES)

    const seen = rows.map((r) => r.id)
    expect(new Set(seen).size).toBe(TOTAL_INDUSTRIES)
    for (const key of INDUSTRY_KEYS) {
      expect(seen, `missing row for ${key}`).toContain(key)
    }

    for (const row of rows) {
      expect(row.count, `${row.id} count column`).toBe(row.gaps.length)
      expect(
        row.gaps.length,
        `${row.id} must have at least ${MIN_GAPS_PER_INDUSTRY} gaps`,
      ).toBeGreaterThanOrEqual(MIN_GAPS_PER_INDUSTRY)
      expect(row.archetype, `${row.id} archetype`).toMatch(/^[A-Z_]+$/)
    }
  })

  it('leaves no orphan gap: every gap applies to at least one industry', () => {
    const rows = readCatalog()
    const matrix = readMatrix()
    const covered = new Set(matrix.flatMap((r) => r.gaps))
    for (const row of rows) {
      expect(covered.has(row.id), `${row.id} applies to no industry`).toBe(true)
      expect(row.industries, `${row.id} industry count`).toBeGreaterThan(0)
    }
    // The catalog's own industry count must agree with the matrix.
    for (const row of rows) {
      const fromMatrix = matrix.filter((r) => r.gaps.includes(row.id)).length
      expect(row.industries, `${row.id} catalog count vs matrix`).toBe(fromMatrix)
    }
  })

  it('goes red when a gap is removed from the dataset', { timeout: 20_000 }, () => {
    const dir = scratchScripts(
      `import { GAPS as ALL } from ${JSON.stringify(REAL_DATA_URL)}\nexport const GAPS = ALL.filter((gap) => gap.id !== 'G01')\n`,
    )
    try {
      const result = run(
        [join(dir, 'scripts/industry/generate-gap-matrix.mjs'), '--check', '--root', ROOT],
        dir,
      )
      expect(result.status).not.toBe(0)
      expect(`${result.stderr}${result.stdout}`).toMatch(/60|59/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('goes red when a gap probe names something that already exists', { timeout: 20_000 }, () => {
    const dir = scratchScripts(
      `import { GAPS as ALL } from ${JSON.stringify(REAL_DATA_URL)}\nexport const GAPS = ALL.map((gap) =>\n  gap.id === 'G01' ? { ...gap, probe: [...gap.probe, 'invoice'] } : gap,\n)\n`,
    )
    try {
      const result = run(
        [join(dir, 'scripts/industry/generate-gap-matrix.mjs'), '--check', '--root', ROOT],
        dir,
      )
      expect(result.status).not.toBe(0)
      expect(`${result.stderr}${result.stdout}`).toMatch(/G01/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
