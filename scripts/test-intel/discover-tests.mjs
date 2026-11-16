#!/usr/bin/env node
// ============================================
// scripts/test-intel/discover-tests.mjs
//
// V70.x Phase 1 — test discovery.
//
// Walks the repository once and writes a machine-readable inventory of every
// test file: where it lives, which package owns it, which framework runs it,
// whether it needs Postgres / a device / a browser, which locales it names,
// and which expensive primitives it calls (repo-wide AST parses, child
// processes, recursive reads). Nothing here executes a test or writes into
// a package — it only reads the tree.
//
//   node scripts/test-intel/discover-tests.mjs
//
// Output: docs/architecture/test-intelligence/TEST-REGISTRY.json
// ============================================

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT_DIR = join(ROOT, 'docs', 'architecture', 'test-intelligence')
const OUT = join(OUT_DIR, 'TEST-REGISTRY.json')

/** Directories that never contain hand-written tests worth counting. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.claude', // worktrees and plugin scratch copies are not the working tree
  '.next',
  '.turbo',
  'dist',
  'dist-electron',
  'build',
  'out',
  'coverage',
  '.expo',
  'release',
  'graphify-out',
  '__snapshots__',
])

const TEST_FILE = /\.(test|spec)\.(ts|tsx|mts|cts|js|jsx)$/
const PG_TEST = /\.pg\.test\.(ts|tsx|mts|cts)$/
const E2E_FILE = /\.e2e\.(ts|tsx|js|jsx)$/

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walk(full, out)
    } else if (TEST_FILE.test(entry.name) || E2E_FILE.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

/** The nearest package.json above a file decides who owns it. */
const manifestByDir = new Map()
const bareDirs = new Set()
function owningPackage(file) {
  let dir = dirname(file)
  while (dir.startsWith(ROOT)) {
    const hit = manifestByDir.get(dir)
    if (hit) return hit
    if (!bareDirs.has(dir)) {
      try {
        const manifest = join(dir, 'package.json')
        if (statSync(manifest).isFile()) {
          const json = JSON.parse(readFileSync(manifest, 'utf8'))
          const info = {
            name: json.name ?? relative(ROOT, dir),
            dir: relative(ROOT, dir).split(sep).join('/') || '.',
            testScript: json.scripts?.test ?? null,
          }
          manifestByDir.set(dir, info)
          return info
        }
      } catch {
        /* an unreadable manifest is treated as absent */
      }
      bareDirs.add(dir)
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return { name: '(no package.json)', dir: '.', testScript: null }
}

/** Which runner owns this file: the config on disk, not the filename. */
const RUNNERS = [
  { pkg: 'backend', runner: 'vitest' },
  { pkg: 'packages/ui', runner: 'vitest' },
  { pkg: 'packages/store', runner: 'vitest' },
  { pkg: 'apps/admin', runner: 'vitest' },
]

function frameworkFor(pkg, text) {
  const configured = RUNNERS.find((r) => r.pkg === pkg.dir)
  if (configured) return configured.runner
  if (text.includes("from 'vitest'") || text.includes('from "vitest"')) return 'vitest'
  if (text.includes("from '@jest/globals'")) return 'jest'
  if (/from '(jest|@jest\/globals)'/.test(text)) return 'jest'
  return 'unknown'
}

/** Expensive primitives, counted per file — these are the cost hypotheses. */
const COST_PATTERNS = [
  { key: 'spawnSync', re: /\bspawnSync\s*\(/g },
  { key: 'execSync', re: /\bexecSync\s*\(/g },
  { key: 'execFileSync', re: /\bexecFileSync\s*\(/g },
  { key: 'spawn(', re: /\bspawn\s*\(/g },
  { key: 'createSourceFile', re: /\bts\.createSourceFile\s*\(|\bcreateSourceFile\s*\(/g },
  { key: 'createProgram', re: /\bts\.createProgram\s*\(|\bcreateProgram\s*\(/g },
  { key: 'readdirSync', re: /\breaddirSync\s*\(/g },
  { key: 'readFileSync', re: /\breadFileSync\s*\(/g },
  { key: 'globSync', re: /\bglobSync\s*\(|\bglob\s*\(/g },
  { key: 'embeddedPostgres', re: /\bembedded-postgres\b/g },
  { key: 'buildServer', re: /\bbuildServer\s*\(/g },
  { key: 'app.inject', re: /\.inject\s*\(/g },
  { key: 'newPool|pg.Client', re: /\bnew\s+(Pool|Client)\s*\(/g },
  { key: 'readAllDocsSql', re: /docs['"`)]?,?\s*['"`]?[^'"`\n]*\.sql/g },
]

const LOCALE_PATTERNS = [
  { key: 'fa-IR', re: /fa-IR/g },
  { key: 'fa-AF', re: /fa-AF/g },
  { key: 'en', re: /['"`]en['"`]/g },
]

const CASES = /(?<![\w.$])(it|test)(\.(only|skip|todo|fails|each|concurrent))?\s*\(/g
const SUITES = /(?<![\w.$])(describe)(\.(only|skip|each))?\s*\(/g
const SKIPPED = /(?<![\w.$])(it|test|describe)\.(skip|todo)\s*\(/g

function classifyLevel(file, text) {
  const name = file.split(sep).join('/')
  if (PG_TEST.test(name)) return 'database-integration'
  if (E2E_FILE.test(name)) return 'e2e'
  if (text.includes('.inject(') && text.includes('buildServer')) return 'integration'
  if (
    /architecture|boundaries|guard|ledger|matrix|no-hardcoded|unknown-is-not-zero|contract/.test(
      name,
    )
  )
    return 'architecture-guard'
  if (text.includes('render(') || text.includes('@testing-library')) return 'component'
  if (text.includes('describe(') && !text.includes('render(')) return 'unit'
  return 'unknown'
}

/** The business domain is read off the path, then off the test names. */
const DOMAIN_HINTS = [
  ['auth', /auth|login|session|password/],
  ['tenant-isolation', /tenant|workspace-isolation|rls/],
  ['invoice', /invoice|sales/],
  ['payments', /payment|cheque/],
  ['accounting', /accounting|ledger|journal|profit|margin/],
  ['inventory', /inventory|stock|warehouse|costing/],
  ['purchasing', /purchas|supplier|rfq/],
  ['payroll', /payroll|salary|commission|shift/],
  ['crm', /customer|contact/],
  ['sync', /sync|outbox|conflict|cursor/],
  ['industry', /industry|industries/],
  ['dashboard', /dashboard|analytics|kpi/],
  ['local-engine', /local-engine|sqlite|offline/],
  ['migrations', /migration|verify|schema/],
  ['ui', /packages\/ui|component/],
  ['i18n', /i18n|locale|translation/],
]

function classifyDomain(file) {
  const path = file.split(sep).join('/').toLowerCase()
  for (const [domain, re] of DOMAIN_HINTS) if (re.test(path)) return domain
  return 'unknown'
}

function countMatches(text, re) {
  re.lastIndex = 0
  let n = 0
  while (re.exec(text) !== null) {
    n += 1
    if (n > 5000) break
  }
  return n
}

const files = walk(ROOT).sort()
const registry = []
let totalCases = 0
let totalSkipped = 0
let totalSuites = 0

for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join('/')
  let text = ''
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    registry.push({ file: rel, unreadable: true })
    continue
  }
  const pkg = owningPackage(file)
  const isPg = PG_TEST.test(rel)
  const cases = countMatches(text, CASES)
  const suites = countMatches(text, SUITES)
  const skipped = countMatches(text, SKIPPED)
  totalCases += cases
  totalSuites += suites
  totalSkipped += skipped

  const costs = {}
  for (const { key, re } of COST_PATTERNS) {
    const n = countMatches(text, re)
    if (n > 0) costs[key] = n
  }
  const locales = LOCALE_PATTERNS.filter(({ re }) => countMatches(text, re) > 0).map((l) => l.key)

  registry.push({
    id: rel,
    file: rel,
    package: pkg.name,
    packageDir: pkg.dir,
    testScript: pkg.testScript,
    framework: frameworkFor(pkg, text),
    level: classifyLevel(file, text),
    domain: classifyDomain(file),
    cases,
    suites,
    skipped,
    lines: text.split(/\r?\n/).length,
    needsPostgres: isPg || /\bembedded-postgres\b|\bsync_pull_changes\b/.test(text),
    needsBrowser: /jsdom|happy-dom|@testing-library\/react/.test(text),
    needsDevice: /react-native|expo|android|electron/.test(text),
    locales,
    costs,
  })
}

/** One row per package: where the test weight actually sits. */
const byPackage = new Map()
for (const t of registry) {
  if (!t.package) continue
  const row = byPackage.get(t.package) ?? {
    package: t.package,
    dir: t.packageDir,
    files: 0,
    cases: 0,
    skipped: 0,
    postgresFiles: 0,
    spawnFiles: 0,
    astFiles: 0,
    lines: 0,
  }
  row.files += 1
  row.cases += t.cases
  row.skipped += t.skipped
  row.lines += t.lines
  if (t.needsPostgres) row.postgresFiles += 1
  if (t.costs.spawnSync || t.costs.execSync || t.costs.execFileSync) row.spawnFiles += 1
  if (t.costs.createSourceFile || t.costs.createProgram) row.astFiles += 1
  byPackage.set(t.package, row)
}

const report = {
  generatedAt: new Date().toISOString(),
  root: ROOT,
  totals: {
    files: registry.length,
    suites: totalSuites,
    cases: totalCases,
    skipped: totalSkipped,
  },
  byPackage: [...byPackage.values()].sort((a, b) => b.cases - a.cases),
  tests: registry,
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n', 'utf8')

const pad = (s, n) => String(s).padEnd(n)
console.log(
  `${registry.length} test files · ${totalCases} cases · ${totalSuites} suites · ${totalSkipped} skipped`,
)
console.log('')
console.log(
  pad('package', 34) +
    pad('files', 7) +
    pad('cases', 7) +
    pad('lines', 8) +
    pad('pg', 5) +
    pad('spawn', 7) +
    'ast',
)
for (const row of report.byPackage) {
  console.log(
    pad(row.package, 34) +
      pad(row.files, 7) +
      pad(row.cases, 7) +
      pad(row.lines, 8) +
      pad(row.postgresFiles, 5) +
      pad(row.spawnFiles, 7) +
      row.astFiles,
  )
}
console.log('')
console.log(`wrote ${relative(ROOT, OUT)}`)
