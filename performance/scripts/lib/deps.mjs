// ============================================================================
// performance/scripts/lib/deps.mjs
//
// The lab runs out of `performance/`, which is NOT a pnpm workspace member —
// on purpose: adding one would touch pnpm-workspace.yaml and the lockfile, and
// the lab must not change the dependency graph of the product to measure it.
//
// So the two packages the lab needs that only `backend/` declares
// (`embedded-postgres`, `@embedded-postgres/windows-x64`) are resolved from
// the backend's own node_modules. Everything the ROOT package declares
// (`pg`, `postgres`) resolves by Node's normal upward walk and is imported
// directly.
// ============================================================================

import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { REPO_ROOT } from './lab-config.mjs'

const backendRequire = createRequire(join(REPO_ROOT, 'backend', 'package.json'))

/**
 * Import a package using backend/ as the resolution root.
 * Returns the module namespace; callers pick `.default` or the named exports.
 */
export async function loadFromBackend(name) {
  const resolved = backendRequire.resolve(name)
  return import(pathToFileURL(resolved).href)
}

/**
 * The Windows x64 Postgres distribution's toolkit — a REAL PostgreSQL 17
 * installed as a devDependency of the backend (the `*.pg.test.ts` suites
 * already run on it). Returns absolute paths to the binaries.
 *
 * Resolves the platform package FROM THE LIBRARY, exactly like
 * embedded-postgres's own binary.js does — never from backend/package.json.
 * Measured reason (status/M1.md): resolving from backend/ walks up out of the
 * repository, because pnpm's strict layout does not put this transitive
 * package in backend/node_modules, and finds a stray
 * `C:\Users\hamed\node_modules\@embedded-postgres\windows-x64` whose
 * postgres.exe is version 18.4 — which cannot open a v17 data directory.
 */
export async function postgresBinaries() {
  const libEntry = backendRequire.resolve('embedded-postgres')
  const libRequire = createRequire(libEntry)
  const resolved = libRequire.resolve('@embedded-postgres/windows-x64')
  const mod = await import(pathToFileURL(resolved).href)
  const paths = mod.default ?? mod
  if (typeof paths.postgres !== 'string') {
    throw new Error(
      `@embedded-postgres/windows-x64 did not expose a postgres path; got keys: ${Object.keys(paths).join(', ')}`,
    )
  }
  const binDir = dirname(paths.postgres)
  return {
    binDir,
    postgres: paths.postgres,
    initdb: paths.initdb,
    pgCtl: join(binDir, 'pg_ctl.exe'),
  }
}

/** The EmbeddedPostgres class itself (for `initialise()` only — see lab-db). */
export async function embeddedPostgresClass() {
  const mod = await loadFromBackend('embedded-postgres')
  return mod.default ?? mod
}
