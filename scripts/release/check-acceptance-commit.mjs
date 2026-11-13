#!/usr/bin/env node
// ============================================
// scripts/release/check-acceptance-commit.mjs
//
// V64 §21.4: acceptance evidence must describe the commit that ships. A report
// recorded three commits ago, or over uncommitted edits, is not evidence about
// the bytes in the release.
//
// This is the gate that says so, and the ONLY thing it trusts is the artifact
// itself plus `git rev-parse HEAD`:
//
//   exit 0  the artifact names HEAD, the tree was clean, every file passed
//   exit 1  a named failure below — each one prints its own code
//   exit 2  blocked: not a git checkout, or the artifact is missing
//
//   node scripts/release/check-acceptance-commit.mjs
//   node scripts/release/check-acceptance-commit.mjs --file <path>
// ============================================

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DEFAULT_FILE = 'docs/architecture/industry/acceptance-results.json'

const fileIndex = process.argv.indexOf('--file')
const relative = fileIndex === -1 ? DEFAULT_FILE : (process.argv[fileIndex + 1] ?? DEFAULT_FILE)
const file = path.isAbsolute(relative) ? relative : path.join(ROOT, relative)

if (!existsSync(file)) {
  console.error(`BLOCKED: no acceptance artifact at ${relative}. Nothing to check.`)
  process.exit(2)
}

let head = null
try {
  head = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim()
} catch {
  console.error('BLOCKED: not a git checkout, so «which commit was tested» cannot be answered.')
  process.exit(2)
}

let artifact = null
try {
  artifact = JSON.parse(readFileSync(file, 'utf8'))
} catch (error) {
  console.error(`FAIL: ${relative} is not readable JSON (${error.message}).`)
  process.exit(1)
}

const failures = []

if (artifact.commit !== head) {
  failures.push(
    `ACCEPTANCE_COMMIT_MISMATCH: the artifact names ${String(artifact.commit).slice(0, 7)}, HEAD is ${head.slice(0, 7)}.`,
  )
}

if (artifact.worktreeDirty === true) {
  const count = Array.isArray(artifact.dirtyFiles) ? artifact.dirtyFiles.length : 0
  failures.push(
    `EVIDENCE_NOT_ON_COMMITTED_TREE: the run happened over ${count} uncommitted path(s), so the commit does not describe the tested bytes.`,
  )
}

const results = artifact.results && typeof artifact.results === 'object' ? artifact.results : {}
const files = Object.entries(results)
const notPassed = files.filter(([, value]) => value?.status !== 'passed')
if (files.length === 0) {
  failures.push('EVIDENCE_EMPTY: the artifact records no test file at all.')
} else if (notPassed.length > 0) {
  for (const [name, value] of notPassed) {
    failures.push(`EVIDENCE_NOT_GREEN: ${name} is ${String(value?.status)}.`)
  }
}

const totals = artifact.totals && typeof artifact.totals === 'object' ? artifact.totals : null
if (totals) {
  if (typeof totals.files !== 'number' || totals.files !== files.length) {
    failures.push(
      `EVIDENCE_TOTALS_DISAGREE: totals.files is ${String(totals.files)}, the artifact holds ${files.length} result(s).`,
    )
  }
  if (totals.filesPassed !== totals.files) {
    failures.push(
      `EVIDENCE_NOT_GREEN: ${String(totals.filesPassed)}/${String(totals.files)} file(s) passed.`,
    )
  }
}

if (failures.length > 0) {
  console.error(`FAIL: ${relative} is not evidence about this commit.`)
  for (const failure of failures) console.error(`  ${failure}`)
  console.error('\nRe-record with the tree clean at HEAD:')
  console.error('  node scripts/industry/run-acceptance.mjs')
  process.exit(1)
}

console.log(
  `OK: ${files.length} file(s) passed at ${head.slice(0, 7)} over a clean tree (${relative}).`,
)
