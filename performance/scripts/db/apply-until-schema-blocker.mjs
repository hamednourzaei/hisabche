#!/usr/bin/env node
// ============================================================================
// performance/scripts/db/apply-until-schema-blocker.mjs
//
// Drive the repository's own migration runner to completion against the lab,
// through the ONE kind of failure that has a mechanical, safe answer — and
// stop dead at every other kind.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
//
// The runner's queue (scripts/run-migrations.mjs) is every non-underscore .sql
// in docs/, applied in the order the repository canonically uses. It includes
// ~104 files that are READ-ONLY DIAGNOSTICS (FINDING-*, VERIFY-*, DUMP,
// reports) alongside the schema. On a FRESH database some diagnostics cannot
// run — they query a table that a later file in the queue creates, or they
// contain a query bug that fails on any database. The runner stops at the
// first one (correctly: continuing past a broken migration is worse).
//
// This script automates exactly one decision, with a deliberately paranoid
// test:  if the failed file contains NO create/alter/drop/grant/revoke/
// truncate/insert/update/delete/copy/execute/call and no DO block — i.e. it is
// physically incapable of changing the database — it is recorded in
// schema_migrations as SKIPPED (with the runner's own checksum, so the runner
// itself reports `skip (already applied)` afterwards), the error message is
// kept, and the run continues. Every other failure stops the loop for a human
// decision.
//
// Everything is appended to performance/raw/M1-bootstrap-<timestamp>.log and
// summarised in performance/raw/M1-bootstrap-skips.json.
// ============================================================================

import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

import { LAB_URL, assertLocal, PERF_ROOT, REPO_ROOT } from '../lib/lab-config.mjs'
import pg from 'pg'

const { Client } = pg

const RUNNER = join(REPO_ROOT, 'scripts', 'run-migrations.mjs')
const DOCS = join(REPO_ROOT, 'docs')
const RAW = join(PERF_ROOT, 'raw')
mkdirSync(RAW, { recursive: true })

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const LOG = join(RAW, `M1-bootstrap-${stamp}.log`)

/**
 * A file that cannot change the database contains none of these, anywhere.
 * `DO $` catches anonymous blocks (dynamic DDL hides inside them — e.g.
 * WIPE-ALL-BUSINESS-DATA.sql builds its DELETEs with EXECUTE). A file that
 * matches goes to a human.
 */
const CANNOT_BE_READ_ONLY =
  /\b(CREATE|ALTER|DROP|GRANT|REVOKE|TRUNCATE|INSERT|UPDATE|DELETE|COPY|EXECUTE|CALL|VACUUM|REINDEX|CLUSTER|INTO)\b|(^|[;\s(])DO\s/im

/**
 * Comments do not execute, and neither do string literals — but both caused
 * false stops here. FINDING-7 discusses writes in prose; VERIFY files name
 * privileges as strings (`privilege_type = 'DELETE'`). Strip comments, single-
 * quoted strings and dollar-quoted bodies, THEN ask whether anything that can
 * change a database is left. A `DO` block is caught by its own keyword, so
 * blanking its body hides no statement that could not also appear alone.
 */
function stripNonCode(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n\r]*/g, ' ')
    .replace(/'(?:[^'\n\r]|'')*'/g, ' ')
    .replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, ' ')
}

const localUrl = assertLocal(LAB_URL)

const skipped = []
const prereqRuns = new Set()
const prerequisites = []
const objectPrereqs = []
let round

// ── The dependency oracle for "relation X does not exist" ───────────────────
// Every docs file is read once. `tableCreators(name)` answers which files
// create a given table; the loop only acts when that answer is EXACTLY ONE
// file and that file is not applied yet — anything else is ambiguous and goes
// to a human. (Functions are deliberately excluded: several files replace the
// same function, so "the" creator does not exist and the choice needs a
// person.)
const allDocs = readdirSync(DOCS).filter((f) => f.endsWith('.sql') && !f.startsWith('_'))
const codeTexts = new Map(
  allDocs.map((f) => [f, stripNonCode(readFileSync(join(DOCS, f), 'utf8'))]),
)

function tableCreators(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?"?${escaped}"?\\b`,
    'i',
  )
  return [...codeTexts].filter(([, text]) => pattern.test(text)).map(([f]) => f)
}

async function loadApplied() {
  const client = new Client({
    connectionString: localUrl,
    application_name: 'lab-db:applied-check',
  })
  await client.connect()
  const rows = await client.query('SELECT name FROM schema_migrations')
  await client.end()
  return new Set(rows.rows.map((row) => row.name))
}

function runOnly(file) {
  const result = spawnSync(process.execPath, [RUNNER, '--apply', '--only', file], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, DATABASE_URL: localUrl },
  })
  appendFileSync(
    LOG,
    `\n── prerequisite --only ${file} (exit ${result.status}) ──\n${result.stdout ?? ''}${result.stderr ?? ''}`,
  )
  return result
}

let appliedNames = await loadApplied()

for (round = 1; round <= 80; round++) {
  const result = spawnSync(process.execPath, [RUNNER, '--apply'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, DATABASE_URL: localUrl },
  })
  const out = `${result.stdout ?? ''}${result.stderr ?? ''}`
  appendFileSync(
    LOG,
    `\n\n════════════ round ${round} (exit ${result.status}) ════════════\n${out}`,
  )

  const lines = out.trimEnd().split('\n')
  console.log(`round ${round}: exit ${result.status} — ${lines.at(-1)}`)

  if (result.status === 0) {
    console.log(
      `\nDONE — every runnable file applied after ${round} round(s); ${skipped.length} diagnostic skip(s).`,
    )
    break
  }

  const failedIndex = lines.findIndex((line) => /^\s+apply\s+\S+\s+\.\.\. FAILED\s*$/.test(line))
  if (failedIndex === -1) {
    console.error(`\nno "apply … FAILED" line found — human review. Full output: ${LOG}`)
    process.exit(1)
  }
  const file = /^\s+apply\s+(\S+)\s+\.\.\. FAILED\s*$/.exec(lines[failedIndex])[1]
  const errorText = lines
    .slice(failedIndex + 1)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('Stopped.'))

  // ── A prerequisite the migration itself declares ──────────────────────────
  // Several migrations open with a guard: `RAISE EXCEPTION 'Run docs/X first.'`
  // The runner's alphabetical order for the extras does not always satisfy
  // that (e.g. `attendance-02-…` sorts before `attendance-self-01-…`;
  // `developer-platform-02-…` sorts before `developer-platform-migration.sql`).
  // The instruction comes from the file, so the loop follows it: apply X alone
  // with `--only`, then let the queue continue. Recursive — the next round
  // reports the next missing prerequisite, if any.
  const prereq = /Run docs\/(\S+?) first/.exec(errorText ?? '')
  if (prereq) {
    const pre = prereq[1]
    if (prereqRuns.has(pre)) {
      console.error(
        `\nBLOCKED — ${file} still demands ${pre} after it was applied once; human review.`,
      )
      process.exit(1)
    }
    prereqRuns.add(pre)
    prerequisites.push({ round, neededBy: file, prerequisite: pre })
    console.log(`   prerequisite declared by ${file}: ${pre} — applying with --only`)
    const preResult = runOnly(pre)
    if (preResult.status !== 0) {
      console.error(`\nBLOCKED — prerequisite ${pre} itself failed; human review. Log: ${LOG}`)
      process.exit(1)
    }
    appliedNames = await loadApplied()
    continue
  }

  // ── A table the file needs, created by exactly one other file ─────────────
  // e.g. patch-03-leaves-gaps reads employee_branch_assignments, which
  // phase-d-01 creates — and `patch-…` sorts before `phase-…`. When exactly
  // one docs file creates the missing table and has not run yet, the ordering
  // correction is forced; the object cannot exist any other way.
  const missingRelation = /relation\s+"?([A-Za-z_][\w.]*)"?\s+does not exist/.exec(errorText ?? '')
  if (missingRelation) {
    const name = missingRelation[1].replace(/^public\./, '')
    const creators = tableCreators(name)
    const pendingCreators = creators.filter((candidate) => !appliedNames.has(candidate))
    if (creators.length === 1 && pendingCreators.length === 1) {
      objectPrereqs.push({ round, neededBy: file, object: name, prerequisite: creators[0] })
      console.log(
        `   ${file} needs table ${name} — created solely by ${creators[0]}; applying with --only`,
      )
      const preResult = runOnly(creators[0])
      if (preResult.status !== 0) {
        console.error(`\nBLOCKED — creator ${creators[0]} itself failed; human review. Log: ${LOG}`)
        process.exit(1)
      }
      appliedNames = await loadApplied()
      continue
    }
    console.error(
      `\nBLOCKED — ${file} needs table "${name}"; creators: ${creators.join(', ') || 'none'}; ` +
        `pending: ${pendingCreators.join(', ') || 'none'} — human decides the order.`,
    )
    console.error(`Full output: ${LOG}`)
    process.exit(1)
  }

  const sql = readFileSync(join(DOCS, file), 'utf8')
  const riskyMatch = CANNOT_BE_READ_ONLY.exec(stripNonCode(sql))
  if (riskyMatch) {
    console.error(
      `\nBLOCKED — ${file} is not a pure diagnostic; a human decides (matched "${riskyMatch[0]}").`,
    )
    console.error(`error: ${errorText}`)
    console.error(`Full output: ${LOG}`)
    process.exit(1)
  }

  const checksum = createHash('sha256').update(sql).digest('hex').slice(0, 16)
  const reason = `read-only diagnostic fails on a fresh canonical rebuild: ${errorText}`
  const client = new Client({ connectionString: localUrl, application_name: 'lab-db:auto-skip' })
  await client.connect()
  await client.query(
    `INSERT INTO schema_migrations (name, checksum, applied_by) VALUES ($1, $2, $3)
     ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum, applied_by = EXCLUDED.applied_by`,
    [file, checksum, `capacity-lab:SKIPPED (${reason})`],
  )
  await client.end()

  skipped.push({ round, file, error: errorText, checksum })
  appliedNames.add(file)
  console.log(`   SKIPPED (cannot change the database): ${file}\n     ${errorText}`)
}

writeFileSync(
  join(RAW, 'M1-bootstrap-skips.json'),
  JSON.stringify({ log: LOG, skipped, prerequisites, objectPrereqs }, null, 2),
)

// The authoritative, cumulative record is schema_migrations itself — dump the
// lab-recorded rows after every run so the audit never depends on one log file.
{
  const client = new Client({ connectionString: localUrl, application_name: 'lab-db:skip-audit' })
  await client.connect()
  const rows = await client.query(
    `SELECT name, checksum, applied_by, applied_at FROM schema_migrations
      WHERE applied_by LIKE 'capacity-lab:%' ORDER BY name`,
  )
  await client.end()
  writeFileSync(
    join(RAW, 'M1-db-skips-from-schema-migrations.json'),
    JSON.stringify(rows.rows, null, 2),
  )
}

console.log(
  `\n${skipped.length} skip(s), ${prerequisites.length} declared-prerequisite run(s) · audit: performance/raw/M1-bootstrap-skips.json · log: ${LOG}`,
)
