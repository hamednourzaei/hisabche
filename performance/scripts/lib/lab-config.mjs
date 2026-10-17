// ============================================================================
// performance/scripts/lib/lab-config.mjs
//
// One place that knows WHERE the capacity lab lives, and the one rule every
// lab script obeys before it touches anything:
//
//   THE TARGET MUST BE LOOPBACK. There is no override, no flag, no env var
//   that lifts this. The lab exists so that a load test can never mistake a
//   remote database for its own.
//
// The repository's normal local setup points `SUPABASE_URL` at production
// through a proxy (backend/src/db.ts). This lab never reads any `.env*` file
// and never uses `SUPABASE_URL`; it has its own connection string built from
// config/lab.json, and every script that opens a connection passes it through
// `assertLocal` first.
// ============================================================================

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url)) // performance/scripts/lib
export const PERF_ROOT = resolve(HERE, '..', '..') // performance
export const REPO_ROOT = resolve(PERF_ROOT, '..') // repository root

const config = JSON.parse(readFileSync(join(PERF_ROOT, 'config', 'lab.json'), 'utf8'))

const dataRoot = process.env.LAB_DATA_ROOT
  ? resolve(process.env.LAB_DATA_ROOT)
  : config.lab.dataRoot

export const LAB = {
  host: config.lab.host,
  port: config.lab.port,
  database: config.lab.database,
  user: config.lab.user,
  password: config.lab.password,
  dataRoot,
  dataDir: join(dataRoot, 'pgdata'),
  logFile: join(dataRoot, 'postgres.log'),
  maxConnections: Number(config.lab.postgresSettings.max_connections),
  postgresSettings: config.lab.postgresSettings,
}

export const PROFILE_NAMES = ['SMALL', 'MEDIUM', 'TARGET', 'LARGE']
export const profile = (name) => {
  const p = config.profiles[name]
  if (!p) throw new Error(`unknown profile "${name}" — one of ${PROFILE_NAMES.join(', ')}`)
  return p
}
export const SAFETY = config.safety
export const SEED = config.seed

const credentials = `${LAB.user}:${encodeURIComponent(LAB.password)}`

/** Connection to the lab database itself. */
export const LAB_URL = `postgres://${credentials}@${LAB.host}:${LAB.port}/${LAB.database}`

/** Connection to the maintenance database, for CREATE/DROP DATABASE. */
export const ADMIN_URL = `postgres://${credentials}@${LAB.host}:${LAB.port}/postgres`

/** The libpq-style form some tools (pg_ctl is not one, .pgpass is) prefer. */
export const labUrlFor = (database) =>
  `postgres://${credentials}@${LAB.host}:${LAB.port}/${database}`

/**
 * Refuse anything that is not this machine.
 *
 * Throws rather than warns: a lab script that connects somewhere else has
 * already failed, whatever it measures afterwards.
 */
export function assertLocal(url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`REFUSED: "${url}" is not a parseable connection string.`)
  }
  const host = parsed.hostname
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) {
    throw new Error(
      `REFUSED: target host "${host}" is not loopback.\n` +
        'The capacity lab only ever talks to its own local Postgres. ' +
        'If you meant to point at a real database, stop — this tool is not for that.',
    )
  }
  return url
}

/** Pretty bytes for the reports. */
export const mb = (bytes) => Math.round(bytes / 1024 / 1024)
