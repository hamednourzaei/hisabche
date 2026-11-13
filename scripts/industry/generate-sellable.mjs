#!/usr/bin/env node
// ============================================
// scripts/industry/generate-sellable.mjs
//
// docs/architecture/industry/sellable-industries.json — the machine-readable
// answer to «which industries may we actually sell today, and why not the rest?»
// and docs/sales/SELLABLE-INDUSTRIES.md — the same answer for a person.
//
// V64 §2 lists NINE criteria; the evidence for each is declared once in
// `sellable-criteria.mjs`. This script does not decide what counts as proof, it
// only evaluates the declaration against what actually ran:
//
//   ✓ a criterion is met only when the test that proves it ran and passed in
//     `acceptance-results.json`, recorded at THIS commit, over a clean tree;
//   ✓ a criterion nobody has evidence for is listed by name, per industry;
//   ✓ `sellable` is derived from ONE place — the row's own missingEvidence list
//     — so a criterion can never be added to the list and forgotten by the
//     verdict.
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

import {
  CRITERIA,
  FILE_TAGS,
  INDUSTRY_BROWSER_TESTS,
  INDUSTRY_POSTGRES_TESTS,
  VETOES,
} from './sellable-criteria.mjs'
import { formatMarkdown } from '../lib/format-markdown.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const CHECK_ONLY = process.argv.includes('--check')
const LEVELS = 'docs/architecture/universal-core/INDUSTRY-SUPPORT-LEVELS.csv'
const RESULTS = 'docs/architecture/industry/acceptance-results.json'
const OUT = 'docs/architecture/industry/sellable-industries.json'
const DOC = 'docs/sales/SELLABLE-INDUSTRIES.md'

const MAPS = {
  INDUSTRY_POSTGRES_TESTS,
  INDUSTRY_BROWSER_TESTS,
}

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

// ---------------------------------------------------------------
// 1. The declaration must be checkable: every file it names exists.
// ---------------------------------------------------------------
for (const criterion of CRITERIA) {
  for (const file of criterion.files ?? []) {
    if (!exists(file)) {
      console.error(`STALE: ${criterion.code} names ${file}, which is not on disk.`)
      process.exit(1)
    }
  }
  if (criterion.file && !exists(criterion.file)) {
    console.error(`STALE: ${criterion.code} names ${criterion.file}, which is not on disk.`)
    process.exit(1)
  }
}
for (const veto of Object.values(VETOES)) {
  if (!exists(veto.file)) {
    console.error(`STALE: a veto names ${veto.file}, which is not on disk.`)
    process.exit(1)
  }
}

if (!exists(LEVELS)) {
  console.error(
    `STALE: ${LEVELS} is missing — run node scripts/industry/generate-coverage-table.mjs`,
  )
  process.exit(1)
}

// ---------------------------------------------------------------
// 2. Evidence: what was recorded, and about which tree.
// ---------------------------------------------------------------
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
const artifacts = {
  postgres: acceptance?.postgres?.results ?? {},
  browser: acceptance?.browser?.results ?? {},
}

/** Comments can name an industry the test never exercises; strip them first. */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const mentionsIndustry = (file, key) => {
  if (!exists(file)) return false
  const source = stripComments(read(file))
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`['"\`]${escaped}['"\`]`).test(source)
}

const vetoClear = (code) => {
  const veto = VETOES[code]
  if (!veto) throw new Error(`No declaration for veto ${code}`)
  return read(veto.file).includes(veto.needle)
}

// ---------------------------------------------------------------
// 3. One evaluation per criterion per industry.
// ---------------------------------------------------------------
function criterionMet(criterion, row, maps) {
  switch (criterion.kind) {
    case 'global': {
      const files = criterion.files ?? []
      if (files.length === 0) return false
      if (!files.every((file) => results[file]?.status === 'passed')) return false
      return (criterion.vetoes ?? []).every(vetoClear)
    }
    case 'industry-in-file':
      return (
        results[criterion.file]?.status === 'passed' && mentionsIndustry(criterion.file, row.key)
      )
    case 'mapped': {
      const mine = row.tests.filter((file) => (FILE_TAGS[file] ?? []).includes(criterion.tag))
      if (mine.length === 0) return false
      return mine.some((file) => results[file]?.status === 'passed')
    }
    case 'artifact': {
      const files = maps[criterion.map]?.[row.key] ?? []
      if (files.length === 0) return false
      return files.every((file) => artifacts[criterion.artifact]?.[file]?.status === 'passed')
    }
    default:
      throw new Error(`Unknown criterion kind ${criterion.kind}`)
  }
}

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

  // A mapped file without a declared tag would silently prove nothing; refusing
  // here forces the decision to be written down when the mapping is added.
  for (const file of tests) {
    if (!Object.hasOwn(FILE_TAGS, file)) {
      throw new Error(
        `${key} maps ${file}, which has no FILE_TAGS declaration in sellable-criteria.mjs — say what it proves (or []).`,
      )
    }
  }

  const criteria = {}
  for (const criterion of CRITERIA)
    criteria[criterion.code] = criterionMet(criterion, { key, tests }, MAPS)

  const missingEvidence = []
  if (!registered) missingEvidence.push('INDUSTRY_NOT_REGISTERED')
  if (!profiled) missingEvidence.push('OPERATIONAL_DNA_PROFILE')
  for (const criterion of CRITERIA) {
    if (!criteria[criterion.code]) missingEvidence.push(criterion.code)
  }
  if (!evidenceFresh) missingEvidence.push('ACCEPTANCE_EVIDENCE_STALE')
  if (acceptanceUnclean) missingEvidence.push('EVIDENCE_NOT_ON_COMMITTED_TREE')

  const sellable = missingEvidence.length === 0
  const status = !profiled
    ? 'REGISTERED'
    : sellable
      ? 'SELLABLE'
      : criteria.DAILY_OPERATIONS_JOURNEY
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
    criteria,
    // The CSV's `workflow_complete` is the mapping fact; this is the evidence
    // fact, and the two may disagree (see FILE_TAGS).
    operationsVerified: criteria.DAILY_OPERATIONS_JOURNEY,
    postgresEvidence: criteria.POSTGRES_JOURNEY,
    browserEvidence: criteria.BROWSER_JOURNEY,
    missingEvidence,
  }
})

const criteriaMet = Object.fromEntries(
  CRITERIA.map((criterion) => [
    criterion.code,
    industries.filter((row) => row.criteria[criterion.code]).length,
  ]),
)

const counts = {
  registered: industries.filter((row) => row.registered).length,
  profiled: industries.filter((row) => row.profiled).length,
  workflowVerified: industries.filter((row) => row.workflowComplete).length,
  operationsVerified: industries.filter((row) => row.operationsVerified).length,
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
for (const criterion of CRITERIA) {
  if (criteriaMet[criterion.code] === 0) limitations.push(`NO_INDUSTRY_PROVES:${criterion.code}`)
}

const report = {
  generatedAt: new Date().toISOString(),
  head,
  acceptanceCommit,
  evidenceFresh,
  acceptanceWorktreeDirty: acceptanceUnclean,
  criteria: CRITERIA.map((criterion) => ({
    code: criterion.code,
    section: criterion.section,
    title: criterion.title,
    kind: criterion.kind,
    industriesMeeting: criteriaMet[criterion.code],
  })),
  limitations,
  counts,
  industries,
}

// ---------------------------------------------------------------
// 4. The same answer for a person.
// ---------------------------------------------------------------
const md = []
md.push('# Which industries may we sell today?')
md.push('')
md.push('Generated by `scripts/industry/generate-sellable.mjs` from the registry, the profiles')
md.push('and `acceptance-results.json`. Do not edit by hand: `--check` fails when this file and')
md.push('the evidence disagree.')
md.push('')
md.push(
  `**${counts.registered}** registered · **${counts.profiled}** profiled · ` +
    `**${counts.operationsVerified}** with a proven business-day journey · ` +
    `**${counts.sellable}** sellable`,
)
md.push('')
md.push(
  `Evidence: commit \`${acceptanceCommit ?? 'none'}\` · HEAD \`${head ?? 'unknown'}\` · ` +
    `worktree ${acceptanceUnclean ? 'DIRTY' : 'clean'}`,
)
if (limitations.length > 0) {
  md.push('')
  md.push('Limitations measured on this tree:')
  for (const code of limitations) md.push(`- \`${code}\``)
}
md.push('')
md.push('## The nine criteria of V64 §2')
md.push('')
md.push('| Criterion | § | Industries with proof | What it proves |')
md.push('| --- | --- | --- | --- |')
for (const criterion of CRITERIA) {
  md.push(
    `| \`${criterion.code}\` | ${criterion.section} | ${criteriaMet[criterion.code]} | ${criterion.title} |`,
  )
}
md.push('')
md.push('## Every industry')
md.push('')
md.push('| Industry | Status | Criteria met | Missing evidence |')
md.push('| --- | --- | --- | --- |')
for (const row of industries) {
  const met = Object.values(row.criteria).filter(Boolean).length
  const missing = row.missingEvidence.map((code) => `\`${code}\``).join(', ')
  md.push(`| \`${row.key}\` | ${row.status} | ${met}/${CRITERIA.length} | ${missing} |`)
}
md.push('')
md.push('## What this means')
md.push('')
md.push('`SELLABLE` is printed only when a row has no missing evidence at all: every criterion, at')
md.push('this commit, over a clean tree. An empty «missing evidence» cell means an industry may be')
md.push('sold; anything else is a work list, not a judgement about the product.')
md.push('')
const docText = await formatMarkdown(path.join(ROOT, DOC), md.join('\n'))

const stable = (value) => {
  const copy = { ...value }
  delete copy.generatedAt
  return JSON.stringify(copy, null, 2)
}

if (CHECK_ONLY) {
  let stale = !exists(OUT) || !exists(DOC)
  if (!stale) stale = stable(JSON.parse(read(OUT))) !== stable(report)
  if (!stale) stale = read(DOC) !== docText
  if (stale) {
    console.error('STALE: run node scripts/industry/generate-sellable.mjs')
    process.exit(1)
  }
  console.log(
    `OK: ${counts.registered} registered · ${counts.profiled} profiled · ${counts.operationsVerified} operations-verified · ${counts.sellable} sellable · ${counts.postgresEvidence} with postgres evidence · ${counts.browserEvidence} with browser evidence`,
  )
  for (const code of limitations) console.log(`  limitation: ${code}`)
} else {
  writeFileSync(path.join(ROOT, OUT), JSON.stringify(report, null, 2) + '\n')
  writeFileSync(path.join(ROOT, DOC), docText)
  console.log(
    `Wrote ${OUT} and ${DOC}: ${counts.registered} registered · ${counts.profiled} profiled · ${counts.operationsVerified} operations-verified · ${counts.sellable} sellable · ${counts.postgresEvidence} with postgres evidence · ${counts.browserEvidence} with browser evidence`,
  )
  if (!evidenceFresh) {
    console.log(
      `Evidence is STALE (acceptance ${acceptanceCommit?.slice(0, 7) ?? 'none'} ≠ HEAD ${head?.slice(0, 7) ?? 'unknown'}): no industry can be SELLABLE.`,
    )
  }
  for (const code of limitations) console.log(`  limitation: ${code}`)
}
