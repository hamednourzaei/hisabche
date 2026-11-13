#!/usr/bin/env node
// ============================================
// scripts/industry/generate-sellable.mjs
//
// docs/architecture/industry/sellable-industries.json — the machine-readable
// answer to «which industries may we actually sell today, and why not the rest?»
//
// V64 §12–13: an industry is SELLABLE only when its family workflow AND its own
// deltas are PROVEN, and the proof is recorded against the commit that was
// tested. The acceptance file this repository ships was recorded at another
// commit, so nothing may be SELLABLE until the runner re-records it. That is a
// downgrade, not a warning: the generator writes `ACCEPTANCE_EVIDENCE_STALE`
// into every `missingEvidence` list and sets `sellable: false`.
//
// `sellable` is derived from ONE place — the row's own `missingEvidence` list —
// so a criterion can never be added to the reason list and forgotten by the
// verdict. That list includes POSTGRES_EVIDENCE (V64 §13.17): the mapped
// acceptance files are HTTP-injection tests, and a fresh HTTP run does not make
// an industry sellable.
//
// The support levels are READ from the generated coverage CSV — this script does
// not re-derive «profiled» — so there is still ONE source of truth per fact.
//
//   node scripts/industry/generate-sellable.mjs           # write
//   node scripts/industry/generate-sellable.mjs --check   # fail when stale
// ============================================

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const CHECK_ONLY = process.argv.includes('--check')
const LEVELS = 'docs/architecture/universal-core/INDUSTRY-SUPPORT-LEVELS.csv'
const RESULTS = 'docs/architecture/industry/acceptance-results.json'
const OUT = 'docs/architecture/industry/sellable-industries.json'

const read = (relative) => readFileSync(path.join(ROOT, relative), 'utf8')
const exists = (relative) => existsSync(path.join(ROOT, relative))

function headCommit() {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

function parseCsv(text) {
  // `csvCell` in the coverage generator quotes EVERY cell, so a cell is either
  // bare or wrapped in one pair of quotes. No value contains a comma.
  const unquote = (value) => value.replace(/^"/, '').replace(/"$/, '')
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const header = lines[0].split(',').map(unquote)
  return lines.slice(1).map((line) => {
    const cells = line.split(',')
    const row = {}
    header.forEach((name, index) => {
      row[name] = unquote(cells[index] ?? '')
    })
    return row
  })
}

if (!exists(LEVELS)) {
  console.error(
    `STALE: ${LEVELS} is missing — run node scripts/industry/generate-coverage-table.mjs`,
  )
  process.exit(1)
}

let acceptance = null
if (exists(RESULTS)) {
  try {
    acceptance = JSON.parse(read(RESULTS))
  } catch {
    acceptance = null
  }
}

const head = headCommit()
const acceptanceCommit = typeof acceptance?.commit === 'string' ? acceptance.commit : null
const evidenceFresh = Boolean(head) && acceptanceCommit === head
// A dirty tree means the tested bytes are not the committed bytes, so the
// recorded commit does not describe what ran. The runner records this; here it
// downgrades, because «it passed on my machine with uncommitted edits» is not
// evidence about the commit named in the report.
const acceptanceUnclean = acceptance?.worktreeDirty === true
const results =
  acceptance?.results && typeof acceptance.results === 'object' ? acceptance.results : {}

const industries = parseCsv(read(LEVELS)).map((row) => {
  const key = row.industry_key
  const registered = row.registered === 'true'
  const profiled = row.profiled === 'true'
  const workflowComplete = row.workflow_complete === 'true'
  const tests = row.acceptance_tests
    ? row.acceptance_tests
        .split(';')
        .map((file) => file.trim())
        .filter(Boolean)
    : []
  const allTestsPassed =
    tests.length > 0 && tests.every((file) => results[file]?.status === 'passed')
  const pgTests = tests.filter((file) => file.endsWith('.pg.test.ts'))

  const missingEvidence = []
  if (!registered) missingEvidence.push('INDUSTRY_NOT_REGISTERED')
  if (!profiled) missingEvidence.push('OPERATIONAL_DNA_PROFILE')
  if (tests.length === 0) missingEvidence.push('FAMILY_WORKFLOW_TEST')
  else if (!allTestsPassed) missingEvidence.push('WORKFLOW_TEST_NOT_PASSED')
  if (pgTests.length === 0) missingEvidence.push('POSTGRES_EVIDENCE')
  if (!evidenceFresh) missingEvidence.push('ACCEPTANCE_EVIDENCE_STALE')
  if (acceptanceUnclean) missingEvidence.push('EVIDENCE_NOT_ON_COMMITTED_TREE')

  // V65: ONE predicate — the row is sellable only when its own reason list is
  // empty. `sellable` used to be written out separately and omitted
  // `POSTGRES_EVIDENCE`, so re-recording the acceptance file at HEAD would have
  // flipped 13 industries to SELLABLE on HTTP-injection tests alone while the
  // same row still said «no Postgres evidence». V64 §13.17 requires the
  // PostgreSQL coverage to be proven; a green HTTP test is not it.
  const sellable = missingEvidence.length === 0
  const status = !profiled
    ? 'REGISTERED'
    : sellable
      ? 'SELLABLE'
      : workflowComplete && allTestsPassed
        ? 'WORKFLOW_VERIFIED'
        : 'PARTIALLY_SUPPORTED'

  return {
    key,
    status,
    sellable,
    registered,
    profiled,
    workflowComplete,
    tests,
    postgresEvidence: pgTests.length > 0,
    browserEvidence: false,
    missingEvidence,
  }
})

const counts = {
  registered: industries.filter((row) => row.registered).length,
  profiled: industries.filter((row) => row.profiled).length,
  workflowVerified: industries.filter((row) => row.workflowComplete).length,
  sellable: industries.filter((row) => row.sellable).length,
  notYetSellable: industries.filter((row) => !row.sellable).length,
  postgresEvidence: industries.filter((row) => row.postgresEvidence).length,
  browserEvidence: industries.filter((row) => row.browserEvidence).length,
}

// Report-level facts that are not about one industry. They are read off the
// measured counts, never asserted by hand: a limitation that survives after the
// evidence arrives would be as dishonest as a claim that outruns it.
const limitations = []
if (!evidenceFresh) limitations.push('ACCEPTANCE_EVIDENCE_STALE')
if (acceptanceUnclean) limitations.push('EVIDENCE_NOT_ON_COMMITTED_TREE')
if (counts.postgresEvidence === 0) limitations.push('POSTGRES_EVIDENCE_MISSING')
if (counts.browserEvidence === 0) limitations.push('BROWSER_VERIFICATION_NOT_RUN')

const report = {
  generatedAt: new Date().toISOString(),
  head,
  acceptanceCommit,
  evidenceFresh,
  acceptanceWorktreeDirty: acceptanceUnclean,
  limitations,
  counts,
  industries,
}

// `generatedAt` must not make --check fail: it is the one field that changes
// only because a clock moved.
const stable = (value) => {
  const copy = { ...value }
  delete copy.generatedAt
  return JSON.stringify(copy, null, 2)
}

const serialised = JSON.stringify(report, null, 2) + '\n'

if (CHECK_ONLY) {
  if (!exists(OUT) || stable(JSON.parse(read(OUT))) !== stable(report)) {
    console.error('STALE: run node scripts/industry/generate-sellable.mjs')
    process.exit(1)
  }
  console.log(
    `OK: ${counts.registered} registered · ${counts.profiled} profiled · ${counts.workflowVerified} workflow-verified · ${counts.sellable} sellable · ${counts.postgresEvidence} with postgres evidence`,
  )
  for (const code of limitations) console.log(`  limitation: ${code}`)
} else {
  writeFileSync(path.join(ROOT, OUT), serialised)
  console.log(
    `Wrote ${OUT}: ${counts.registered} registered · ${counts.profiled} profiled · ${counts.workflowVerified} workflow-verified · ${counts.sellable} sellable · ${counts.postgresEvidence} with postgres evidence`,
  )
  if (!evidenceFresh) {
    console.log(
      `Evidence is STALE (acceptance ${acceptanceCommit?.slice(0, 7) ?? 'none'} ≠ HEAD ${head?.slice(0, 7) ?? 'unknown'}): no industry can be SELLABLE.`,
    )
  }
  for (const code of limitations) console.log(`  limitation: ${code}`)
}
