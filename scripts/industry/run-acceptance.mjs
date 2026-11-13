#!/usr/bin/env node
// ============================================
// scripts/industry/run-acceptance.mjs
//
// The ONLY writer of `docs/architecture/industry/acceptance-results.json`.
//
// V64 §19: the acceptance runner must record the commit it actually tested, the
// time it actually ran, and one status per test file. An unexecuted test is
// never `passed`; a file that vitest did not report on is written as `not_run`
// with the reason, never optimistically as green.
//
// WHAT RUNS
//   mapped      the industry acceptance files (`INDUSTRY_ACCEPTANCE_TESTS`)
//   globals     the files that prove a V64 §2 criterion for every industry
//               (`sellable-criteria.mjs`), from whatever package owns them
//
// WHAT DOES NOT RUN BY DEFAULT
//   PostgreSQL journeys (`--postgres`) and Playwright scenarios (`--browser`).
//   Both are recorded as `ran: false` with a reason, so an absent section can
//   never be read as a passing one. With the flag, the mapped files really run
//   and their per-file status comes from the tool's JSON report.
//
//   node scripts/industry/run-acceptance.mjs              # run and record
//   node scripts/industry/run-acceptance.mjs --dry-run     # print the plan only
//   node scripts/industry/run-acceptance.mjs --postgres    # also run mapped pg journeys
//   node scripts/industry/run-acceptance.mjs --browser     # also run mapped browser journeys
// ============================================

import { execSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { INDUSTRY_ACCEPTANCE_TESTS } from './coverage-data.mjs'
import { CRITERIA, INDUSTRY_BROWSER_TESTS, INDUSTRY_POSTGRES_TESTS } from './sellable-criteria.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = 'docs/architecture/industry/acceptance-results.json'
const DRY_RUN = process.argv.includes('--dry-run')
const RUN_POSTGRES = process.argv.includes('--postgres')
const RUN_BROWSER = process.argv.includes('--browser')

const read = (relative) => readFileSync(path.join(ROOT, relative), 'utf8')
const exists = (relative) => existsSync(path.join(ROOT, relative))

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

// ---------------------------------------------------------------
// 1. The plan: every mapped file, every global proof, once each.
// ---------------------------------------------------------------
const mappedFiles = [...new Set(Object.values(INDUSTRY_ACCEPTANCE_TESTS).flat())].sort()
const globalFiles = [
  ...new Set(
    CRITERIA.flatMap((criterion) => {
      if (criterion.kind === 'global') return criterion.files ?? []
      if (criterion.kind === 'industry-in-file') return [criterion.file]
      return []
    }),
  ),
].sort()
const files = [...new Set([...mappedFiles, ...globalFiles])].sort()
const postgresFiles = [...new Set(Object.values(INDUSTRY_POSTGRES_TESTS).flat())].sort()
const browserFiles = [...new Set(Object.values(INDUSTRY_BROWSER_TESTS).flat())].sort()

const industriesOf = (file) =>
  Object.entries(INDUSTRY_ACCEPTANCE_TESTS)
    .filter(([, mapped]) => mapped.includes(file))
    .map(([key]) => key)
    .sort()

const missing = [...files, ...postgresFiles, ...browserFiles].filter((file) => !exists(file))
if (files.length === 0) {
  console.error('BLOCKED: INDUSTRY_ACCEPTANCE_TESTS maps no test file.')
  process.exit(2)
}
if (missing.length > 0) {
  console.error(`BLOCKED: mapped test file(s) not on disk:`)
  for (const file of new Set(missing)) console.error(`  ${file}`)
  console.error('Nothing was recorded: a mapping that points at a deleted test is a defect.')
  process.exit(2)
}

/** `backend/…` or `packages/<name>/…` or `apps/<name>/…` — the package that owns it. */
function packageRootOf(relative) {
  const [first, second] = relative.split('/')
  if (first === 'backend') return 'backend'
  if (first === 'packages' || first === 'apps') return `${first}/${second}`
  throw new Error(`Cannot tell which package owns ${relative}`)
}

const groups = new Map()
for (const file of files) {
  const owner = packageRootOf(file)
  const group = groups.get(owner) ?? []
  group.push(file)
  groups.set(owner, group)
}

console.log(
  `${files.length} file(s) in ${groups.size} package(s), ${Object.keys(INDUSTRY_ACCEPTANCE_TESTS).length} industry(ies):`,
)
for (const [owner, group] of groups) {
  console.log(`  ${owner} — ${group.length} file(s)`)
  for (const file of group)
    console.log(
      `    ${file}${industriesOf(file).length > 0 ? `  ← ${industriesOf(file).join(', ')}` : ''}`,
    )
}

if (DRY_RUN) {
  console.log('\n--dry-run: nothing executed, nothing written.')
  process.exit(0)
}

// ---------------------------------------------------------------
// 2. Run each package's files with that package's vitest.
// ---------------------------------------------------------------
function vitestBinary(packageRoot) {
  return [
    path.join(ROOT, packageRoot, 'node_modules', 'vitest', 'vitest.mjs'),
    path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs'),
  ].find((candidate) => existsSync(candidate))
}

function runVitest(packageRoot, relativeFiles, extraArgs = []) {
  const binary = vitestBinary(packageRoot)
  if (!binary) return { report: null, reason: 'VITEST_NOT_INSTALLED', output: '' }

  const scratch = mkdtempSync(path.join(tmpdir(), 'hisabche-acceptance-'))
  const reportPath = path.join(scratch, 'vitest.json')
  const cwd = path.join(ROOT, packageRoot)
  const args = relativeFiles.map((file) =>
    path.relative(cwd, path.join(ROOT, file)).split(path.sep).join('/'),
  )

  const run = spawnSync(
    process.execPath,
    [binary, 'run', ...args, ...extraArgs, '--reporter=json', `--outputFile=${reportPath}`],
    { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )

  let report = null
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'))
  } catch {
    report = null
  }
  rmSync(scratch, { recursive: true, force: true })

  return {
    report: report && Array.isArray(report.testResults) ? report : null,
    reason: report ? null : 'NO_JSON_REPORT',
    output: `${run.stdout ?? ''}${run.stderr ?? ''}`.slice(-4000),
  }
}

/** One status per planned file, from a vitest JSON report — never from hope. */
function statusesFrom(report) {
  const byPath = new Map()
  if (!report) return byPath
  for (const suite of report.testResults) {
    const relative = path
      .relative(ROOT, path.resolve(String(suite.name)))
      .split(path.sep)
      .join('/')
    const assertions = Array.isArray(suite.assertionResults) ? suite.assertionResults : []
    const failed = assertions.filter((one) => one.status === 'failed').length
    const skipped = assertions.filter(
      (one) => one.status === 'skipped' || one.status === 'pending' || one.status === 'todo',
    ).length
    byPath.set(relative, {
      status: suite.status === 'passed' && failed === 0 ? 'passed' : 'failed',
      date: new Date(Number(suite.endTime) || Date.now()).toISOString().slice(0, 10),
      tests: assertions.length,
      passed: assertions.filter((one) => one.status === 'passed').length,
      failed,
      skipped,
      durationMs: Number(suite.endTime) - Number(suite.startTime) || 0,
    })
  }
  return byPath
}

const results = {}
const limitations = []
let failedFiles = 0
let notRunFiles = 0
let totalTests = 0
let totalPassed = 0

for (const [owner, group] of groups) {
  const run = runVitest(owner, group)
  if (!run.report) {
    console.error(`BLOCKED: vitest produced no JSON report for ${owner} (${run.reason}).`)
    if (run.output) console.error(run.output)
    process.exit(2)
  }
  const measured = statusesFrom(run.report)
  for (const file of group) {
    const one = measured.get(file)
    if (!one) {
      // vitest did not report this file (a crash before collection, a bad path).
      // Recording it as anything but `not_run` would be a lie.
      results[file] = { status: 'not_run', reason: 'VITEST_REPORTED_NO_RESULT' }
      limitations.push(`NOT_RUN:${file}`)
      notRunFiles += 1
      continue
    }
    results[file] = one
    totalTests += one.tests
    totalPassed += one.passed
    if (one.status !== 'passed') {
      failedFiles += 1
      limitations.push(`FAILED:${file}`)
    } else if (one.skipped > 0) {
      limitations.push(`SKIPPED_TESTS:${file}`)
    }
  }
}

// ---------------------------------------------------------------
// 3. PostgreSQL and browser journeys: run only when asked, record only truth.
// ---------------------------------------------------------------
function recordSection(kind, requested, mappedFileList, run) {
  if (!requested) return { ran: false, reason: 'NOT_REQUESTED', results: {} }
  if (mappedFileList.length === 0) {
    return { ran: false, reason: `NO_MAPPED_${kind.toUpperCase()}_JOURNEY`, results: {} }
  }
  if (!run.report) {
    // The tool is missing or the suite could not start: that is not a pass.
    return { ran: false, reason: run.reason ?? 'RUN_FAILED', results: {} }
  }
  const measured = statusesFrom(run.report)
  const out = {}
  for (const file of mappedFileList) {
    out[file] = measured.get(file) ?? { status: 'not_run', reason: 'VITEST_REPORTED_NO_RESULT' }
  }
  return { ran: true, reason: null, results: out }
}

const postgresRun = RUN_POSTGRES
  ? runVitest('backend', postgresFiles, ['--project', 'pg'])
  : { report: null, reason: 'NOT_REQUESTED', output: '' }
const postgres = recordSection('postgres', RUN_POSTGRES, postgresFiles, postgresRun)

function playwrightResults(report) {
  const out = {}
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      const raw = spec.file ?? suite.file
      if (!raw) continue
      const key = raw.startsWith('apps/') ? raw : `apps/web/e2e/${raw.replace(/^\.\//, '')}`
      const status = spec.ok === true ? 'passed' : 'failed'
      out[key] = out[key] === 'failed' ? false : status
    }
    for (const child of suite.suites ?? []) walk(child)
  }
  for (const suite of report.suites ?? []) walk(suite)
  return Object.fromEntries(
    Object.entries(out).map(([key, status]) => [
      key,
      { status: status === 'passed' ? 'passed' : 'failed' },
    ]),
  )
}

let browser = { ran: false, reason: 'NOT_REQUESTED', results: {} }
if (RUN_BROWSER) {
  if (browserFiles.length === 0) {
    browser = { ran: false, reason: 'NO_MAPPED_BROWSER_JOURNEY', results: {} }
  } else {
    const cwd = path.join(ROOT, 'apps', 'web')
    const scratch = mkdtempSync(path.join(tmpdir(), 'hisabche-browser-'))
    const reportPath = path.join(scratch, 'playwright.json')
    const run = spawnSync(
      process.execPath,
      [
        path.join(cwd, 'node_modules', '@playwright', 'test', 'cli.js'),
        'test',
        ...browserFiles.map((file) =>
          path.relative(cwd, path.join(ROOT, file)).split(path.sep).join('/'),
        ),
        '--reporter=json',
      ],
      {
        cwd,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath },
      },
    )
    let report = null
    try {
      report = JSON.parse(readFileSync(reportPath, 'utf8'))
    } catch {
      report = null
    }
    rmSync(scratch, { recursive: true, force: true })
    browser = report
      ? { ran: true, reason: null, results: playwrightResults(report) }
      : {
          ran: false,
          reason: 'PLAYWRIGHT_PRODUCED_NO_REPORT',
          results: {},
          output: `${run.stdout ?? ''}${run.stderr ?? ''}`.slice(-2000),
        }
  }
}

if (Object.keys(postgres.results).length === 0) limitations.push('POSTGRES_EVIDENCE_NOT_INCLUDED')
if (Object.keys(browser.results).length === 0) limitations.push('BROWSER_VERIFICATION_NOT_RUN')

const worktree = git('status --porcelain')
const dirtyFiles = worktree ? worktree.split(/\r?\n/).filter(Boolean) : []
const commit = git('rev-parse HEAD')

const doc = {
  generatedAt: new Date().toISOString(),
  commit,
  // V64 §19: the commit must describe the code that was tested. When the tree is
  // dirty it does not, so the runner says so and `generate-sellable.mjs` refuses
  // to call anything SELLABLE on this evidence.
  worktreeDirty: dirtyFiles.length > 0,
  dirtyFiles,
  results,
  postgres,
  browser,
  environment: {
    runner: 'scripts/industry/run-acceptance.mjs',
    reporter: 'vitest --reporter=json',
    vitest: (() => {
      try {
        return JSON.parse(read('backend/node_modules/vitest/package.json')).version
      } catch {
        return null
      }
    })(),
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
  },
  limitations,
  totals: {
    files: files.length,
    filesPassed: files.length - failedFiles - notRunFiles,
    filesFailed: failedFiles,
    filesNotRun: notRunFiles,
    tests: totalTests,
    testsPassed: totalPassed,
  },
}

writeFileSync(path.join(ROOT, OUT), JSON.stringify(doc, null, 2) + '\n')

console.log(
  `\nWrote ${OUT}: ${doc.totals.filesPassed}/${doc.totals.files} file(s) passed · ` +
    `${doc.totals.testsPassed}/${doc.totals.tests} test(s) passed`,
)
console.log(
  `commit ${commit?.slice(0, 7) ?? 'unknown'} · worktree ${doc.worktreeDirty ? `DIRTY (${dirtyFiles.length} path(s))` : 'clean'}`,
)
console.log(
  `postgres journeys: ${postgres.ran ? 'ran' : postgres.reason} · browser journeys: ${browser.ran ? 'ran' : browser.reason}`,
)

if (failedFiles > 0 || notRunFiles > 0) {
  console.error(
    `\nRefusing to call this evidence green: ${failedFiles} failed, ${notRunFiles} not run.`,
  )
  process.exit(1)
}
