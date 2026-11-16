// scripts/test-intel/time-generators.mjs
//
// V70.x — what does each generator actually cost, and how much of a guard's
// duration is node start-up rather than work?
//
//   node scripts/test-intel/time-generators.mjs [--repeat N]
//
// Every number is hrtime, measured in this process's own child, and printed
// with the command that produced it. Nothing is cached between rows.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const repeatArg = process.argv.indexOf('--repeat')
const REPEAT = repeatArg > 0 ? Number(process.argv[repeatArg + 1]) : 1

const JOBS = [
  { name: 'node --version (bare start-up)', args: ['--version'] },
  {
    name: 'scripts/api/unused-hooks.mjs --check',
    args: ['scripts/api/unused-hooks.mjs', '--check'],
  },
  {
    name: 'scripts/industry/generate-coverage-table.mjs --check',
    args: ['scripts/industry/generate-coverage-table.mjs', '--check'],
  },
  {
    name: 'scripts/industry/generate-gap-matrix.mjs --check',
    args: ['scripts/industry/generate-gap-matrix.mjs', '--check'],
  },
  {
    name: 'scripts/industry/generate-sellable.mjs --check',
    args: ['scripts/industry/generate-sellable.mjs', '--check'],
  },
  {
    name: 'scripts/migrations/pending-ledger.mjs --check',
    args: ['scripts/migrations/pending-ledger.mjs', '--check'],
  },
  {
    name: 'scripts/capability/wiring-matrix.mjs --check',
    args: ['scripts/capability/wiring-matrix.mjs', '--check'],
  },
]

const rows = []
for (const job of JOBS) {
  const samples = []
  let status = null
  for (let i = 0; i < REPEAT; i += 1) {
    const started = process.hrtime.bigint()
    const result = spawnSync(process.execPath, job.args, { cwd: ROOT, encoding: 'utf8' })
    const ms = Number(process.hrtime.bigint() - started) / 1e6
    samples.push(ms)
    status = result.status
  }
  samples.sort((a, b) => a - b)
  rows.push({
    job: job.name,
    status,
    min: samples[0],
    median: samples[Math.floor(samples.length / 2)],
  })
}

const pad = (s, n) => String(s).padEnd(n)
console.log(pad('job', 54) + pad('exit', 6) + 'ms')
for (const row of rows) console.log(pad(row.job, 54) + pad(row.status, 6) + Math.round(row.median))
