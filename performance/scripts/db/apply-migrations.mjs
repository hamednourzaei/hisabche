#!/usr/bin/env node
// ============================================================================
// performance/scripts/db/apply-migrations.mjs
//
// Runs the REPOSITORY'S OWN migration runner (scripts/run-migrations.mjs —
// the same one the owner uses, with the same ORDER list) against the capacity
// lab's local database.
//
// WHY A WRAPPER AT ALL
//
// `run-migrations.mjs` fills `DATABASE_URL` from `.env.migrate` / `.env.local`
// when the shell has not set it, and those files point at the REAL Supabase
// (that is what they are for). This wrapper guarantees the shell value is set
// — to the lab — before the runner starts, and refuses to run at all if the
// lab URL is not loopback. `scripts/lib/load-env.mjs` never overwrites an
// already-set variable (verified in its source), so the real URL cannot come
// back through the file path.
//
// USAGE
//   node performance/scripts/db/apply-migrations.mjs          # dry run
//   node performance/scripts/db/apply-migrations.mjs --apply  # apply for real
// ============================================================================

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

import { LAB_URL, assertLocal, REPO_ROOT } from '../lib/lab-config.mjs'

const apply = process.argv.includes('--apply')
// Everything except --apply is forwarded to the repository runner unchanged
// (e.g. `--only <file>` for a deferred maintenance file).
const passthrough = process.argv.slice(2).filter((argument) => argument !== '--apply')
const localUrl = assertLocal(LAB_URL) // throws unless host is loopback

console.log(`target: ${new URL(localUrl).host}/${new URL(localUrl).pathname.slice(1)} (loopback ✓)`)
console.log(apply ? 'mode: APPLY' : 'mode: dry run')

const result = spawnSync(
  process.execPath,
  [join(REPO_ROOT, 'scripts', 'run-migrations.mjs'), ...(apply ? ['--apply'] : []), ...passthrough],
  {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: localUrl, // the shell wins over .env* — by design of load-env.mjs
    },
  },
)

process.exit(result.status ?? 1)
