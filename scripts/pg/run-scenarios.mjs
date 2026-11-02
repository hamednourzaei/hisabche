// ============================================
// scripts/pg/run-scenarios.mjs
//
// Runs a `*-scenarios.ts` file (the SQL scenarios written once against a tiny `run(text, params)` runner) on PGlite -
// real PostgreSQL compiled to WASM - so the migrations and functions are PROVEN BY RUNNING on a machine where the
// embedded Postgres binary cannot start. It is a LOGIC proof: PGlite has one connection, so lock contention between
// two connections is NOT proven by it (that stays BLOCKED_EXTERNAL until a `*.pg.test.ts` ran on a working Postgres).
//
// The repository does not depend on PGlite or esbuild, and this script adds neither. Install them OUTSIDE the repo:
//
//   mkdir <somewhere>/pglite && cd <somewhere>/pglite && npm init -y && npm i @electric-sql/pglite esbuild
//
// then, from the repository root:
//
//   PGLITE_DIR=<somewhere>/pglite SCENARIOS=backend/src/__tests__/helpers/service-delivery-02-scenarios.ts \
//   SETUP=setupServiceDelivery VERIFY="docs/VERIFY-service-delivery-02.sql docs/VERIFY-service-delivery-03.sql" \
//   node scripts/pg/run-scenarios.mjs
//
// A scenarios file exports `scenarios: Array<{ name, run(run) }>` and the setup function named by SETUP (it applies the real
// migrations from `docs/`, twice). Exit code: 0 all passed, 1 a scenario failed, 2 setup (or a VERIFY) failed.
// ============================================

import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const repo = process.cwd()
const pgliteDir = process.env.PGLITE_DIR
const scenariosPath = process.env.SCENARIOS
const setupName = process.env.SETUP ?? 'setupServiceDelivery'
const verifyFiles = (process.env.VERIFY ?? '').split(/\s+/).filter(Boolean)

if (!pgliteDir || !scenariosPath) {
  console.error('PGLITE_DIR and SCENARIOS are required (see the header of this file).')
  process.exit(2)
}

const requireFrom = createRequire(path.join(path.resolve(pgliteDir), 'noop.js'))
let build
let PGlite
try {
  ;({ build } = requireFrom('esbuild'))
  ;({ PGlite } = requireFrom('@electric-sql/pglite'))
} catch (error) {
  console.error(`Cannot load esbuild / @electric-sql/pglite from ${pgliteDir}: ${error.message}`)
  process.exit(2)
}

const out = path.join(path.resolve(pgliteDir), 'scenarios.bundle.cjs')
await build({
  entryPoints: [path.resolve(repo, scenariosPath)],
  outfile: out,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  logLevel: 'error',
})

// the scenario files read their migrations from this folder
process.env.RETURN05_DOCS = path.resolve(repo, 'docs')
const loaded = (await import(pathToFileURL(out).href)).default
const setup = loaded[setupName]
const scenarios = loaded.scenarios
if (typeof setup !== 'function' || !Array.isArray(scenarios)) {
  console.error(`The scenarios file must export "${setupName}" and "scenarios".`)
  process.exit(2)
}

const db = new PGlite()
const run = async (text, params) => {
  if (params && params.length > 0) return (await db.query(text, [...params])).rows
  const results = await db.exec(text)
  return results.at(-1)?.rows ?? []
}

try {
  await setup(run)
  console.log('setup OK')
  for (const file of verifyFiles) {
    const full = path.resolve(repo, file)
    if (!existsSync(full)) throw new Error(`VERIFY file not found: ${file}`)
    const rows = await run(readFileSync(full, 'utf8'))
    console.log(`VERIFY ${path.basename(file)}`, JSON.stringify(rows[0]))
  }
} catch (error) {
  console.error('SETUP FAILED:', error.message)
  process.exit(2)
}

let failed = 0
for (const scenario of scenarios) {
  try {
    await scenario.run(run)
    console.log('PASS', scenario.name)
  } catch (error) {
    failed += 1
    console.log(
      'FAIL',
      scenario.name,
      '\n     ',
      String(error.message).split('\n').slice(0, 6).join('\n      '),
    )
  }
}
console.log(
  failed === 0 ? `ALL ${scenarios.length} PASSED` : `${failed} FAILED of ${scenarios.length}`,
)
process.exit(failed === 0 ? 0 : 1)
