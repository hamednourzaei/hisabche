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
// The file→industry mapping is NOT duplicated here: it is read from
// `scripts/industry/coverage-data.mjs` (`INDUSTRY_ACCEPTANCE_TESTS`), the same
// constant the coverage generator uses.
//
// What these tests are: HTTP-injection suites (`*.test.ts`) that build the real
// Fastify server and inject requests. They are NOT PostgreSQL tests
// (`*.pg.test.ts`) and NOT browser tests. The runner says so in its own output,
// and `generate-sellable.mjs` refuses to call an industry SELLABLE on them.
//
//   node scripts/industry/run-acceptance.mjs              # run and record
//   node scripts/industry/run-acceptance.mjs --dry-run    # print the plan only
// ============================================

import { execSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { INDUSTRY_ACCEPTANCE_TESTS } from './coverage-data.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = 'docs/architecture/industry/acceptance-results.json'
const BACKEND = path.join(ROOT, 'backend')
const DRY_RUN = process.argv.includes('--dry-run')

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
// 1. The plan: every mapped file, once, and every industry it answers for.
// ---------------------------------------------------------------
const files = [...new Set(Object.values(INDUSTRY_ACCEPTANCE_TESTS).flat())].sort()
const industriesOf = (file) =>
  Object.entries(INDUSTRY_ACCEPTANCE_TESTS)
    .filter(([, mapped]) => mapped.includes(file))
    .map(([key]) => key)
    .sort()

const missing = files.filter((file) => !exists(file))
if (files.length === 0) {
  console.error('BLOCKED: INDUSTRY_ACCEPTANCE_TESTS maps no test file.')
  process.exit(2)
}
if (missing.length > 0) {
  console.error(`BLOCKED: mapped acceptance test file(s) not on disk:`)
  for (const file of missing) console.error(`  ${file}`)
  console.error('Nothing was recorded: a mapping that points at a deleted test is a defect.')
  process.exit(2)
}

const vitestCandidates = [
  path.join(BACKEND, 'node_modules', 'vitest', 'vitest.mjs'),
  path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs'),
]
const vitest = vitestCandidates.find((candidate) => existsSync(candidate))
if (!vitest) {
  console.error('BLOCKED_EXTERNAL: vitest CLI not found (expected backend/node_modules/vitest).')
  process.exit(2)
}

console.log(
  `${files.length} file(s), ${Object.keys(INDUSTRY_ACCEPTANCE_TESTS).length} industry(ies):`,
)
for (const file of files) console.log(`  ${file}  ← ${industriesOf(file).join(', ')}`)

if (DRY_RUN) {
  console.log('\n--dry-run: nothing executed, nothing written.')
  process.exit(0)
}

// ---------------------------------------------------------------
// 2. Run them, once, with the JSON reporter.
// ---------------------------------------------------------------
const scratch = mkdtempSync(path.join(tmpdir(), 'hisabche-acceptance-'))
const reportPath = path.join(scratch, 'vitest.json')
// The files are named relative to the repository; vitest runs from `backend`.
const args = files.map((file) =>
  path.relative(BACKEND, path.join(ROOT, file)).split(path.sep).join('/'),
)

const run = spawnSync(
  process.execPath,
  [vitest, 'run', ...args, '--reporter=json', `--outputFile=${reportPath}`],
  { cwd: BACKEND, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
)

let vitestReport = null
try {
  vitestReport = JSON.parse(readFileSync(reportPath, 'utf8'))
} catch {
  vitestReport = null
}
rmSync(scratch, { recursive: true, force: true })

if (!vitestReport || !Array.isArray(vitestReport.testResults)) {
  // No report means no evidence. Refuse to write a file that would otherwise
  // claim something about tests we cannot see.
  console.error('BLOCKED: vitest produced no JSON report; acceptance-results.json was NOT written.')
  if (run.stdout) console.error(run.stdout.slice(-4000))
  if (run.stderr) console.error(run.stderr.slice(-4000))
  process.exit(2)
}

// ---------------------------------------------------------------
// 3. One status per planned file, from the report — never from hope.
// ---------------------------------------------------------------
const byPath = new Map()
for (const suite of vitestReport.testResults) {
  const absolute = path.resolve(String(suite.name))
  const relative = path.relative(ROOT, absolute).split(path.sep).join('/')
  const assertions = Array.isArray(suite.assertionResults) ? suite.assertionResults : []
  const passed = assertions.filter((one) => one.status === 'passed').length
  const failed = assertions.filter((one) => one.status === 'failed').length
  const skipped = assertions.filter(
    (one) => one.status === 'skipped' || one.status === 'pending' || one.status === 'todo',
  ).length
  byPath.set(relative, {
    status: suite.status === 'passed' && failed === 0 ? 'passed' : 'failed',
    date: new Date(Number(suite.endTime) || Date.now()).toISOString().slice(0, 10),
    tests: assertions.length,
    passed,
    failed,
    skipped,
    durationMs: Number(suite.endTime) - Number(suite.startTime) || 0,
  })
}

const results = {}
const limitations = []
let failedFiles = 0
let notRunFiles = 0
let totalTests = 0
let totalPassed = 0

for (const file of files) {
  const measured = byPath.get(file)
  if (!measured) {
    // vitest did not report this file (a crash before collection, a bad path).
    // Recording it as anything but `not_run` would be a lie.
    results[file] = { status: 'not_run', reason: 'VITEST_REPORTED_NO_RESULT' }
    limitations.push(`NOT_RUN:${file}`)
    notRunFiles += 1
    continue
  }
  results[file] = measured
  totalTests += measured.tests
  totalPassed += measured.passed
  if (measured.status !== 'passed') {
    failedFiles += 1
    limitations.push(`FAILED:${file}`)
  } else if (measured.skipped > 0) {
    limitations.push(`SKIPPED_TESTS:${file}`)
  }
}

// Facts about what this evidence can and cannot prove. Written from the measured
// run, not typed from memory.
limitations.push('POSTGRES_EVIDENCE_NOT_INCLUDED')
limitations.push('BROWSER_VERIFICATION_NOT_RUN')

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
  environment: {
    runner: 'scripts/industry/run-acceptance.mjs',
    reporter: 'vitest --reporter=json',
    vitest: (() => {
      try {
        return JSON.parse(read(path.join('backend', 'node_modules', 'vitest', 'package.json')))
          .version
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

if (failedFiles > 0 || notRunFiles > 0) {
  console.error(
    `\nRefusing to call this evidence green: ${failedFiles} failed, ${notRunFiles} not run.`,
  )
  process.exit(1)
}
