// ============================================
// backend/src/__tests__/helpers/journey-server.ts
//
// The REAL backend, listening on a port, for the browser journeys
// (apps/web/e2e/journey-industries.spec.ts): the app's own Fastify server, its routes
// and services unchanged — only `src/db.ts` is swapped for the journey world
// (journey-world.ts): writes and rpcs go WRITE-THROUGH to a real PostgreSQL carrying the
// whole docs/ migration set, Supabase Auth is a local stand-in.
//
//   PGLITE_DIR=<folder with @electric-sql/pglite>  npx tsx src/__tests__/helpers/journey-server.ts
//
// ⚠️ NOTHING HERE MAY REACH PRODUCTION. `backend/.env` is never loaded (DOTENV_CONFIG_PATH
// points at an empty file), every URL is local or unroutable, and no key is real. The
// process prints `JOURNEY_SERVER_READY <port>` when it accepts requests.
// ============================================

import { mkdtempSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Node 22.15+ has module.registerHooks (synchronous, covers import AND require); the
// @types/node in this repository predates it, so its shape is declared here.
declare module 'node:module' {
  interface JourneyResolved {
    url: string
    format?: string | null | undefined
    shortCircuit?: boolean | undefined
  }
  export function registerHooks(hooks: {
    resolve: (
      specifier: string,
      context: object,
      nextResolve: (specifier: string, context: object) => JourneyResolved,
    ) => JourneyResolved
  }): { deregister: () => void }
}

const emptyEnv = join(mkdtempSync(join(tmpdir(), 'journey-env-')), '.env')
writeFileSync(emptyEnv, '')
const FAKE_SERVICE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.journey-not-a-key'
Object.assign(process.env, {
  DOTENV_CONFIG_PATH: emptyEnv,
  NODE_ENV: 'development',
  HOST: '127.0.0.1',
  PORT: process.env.JOURNEY_API_PORT ?? '4100',
  SUPABASE_URL: 'http://127.0.0.1:9',
  SUPABASE_ANON_KEY: 'journey-anon-key',
  SUPABASE_SERVICE_KEY: FAKE_SERVICE_JWT,
  SUPABASE_SERVICE_ROLE_KEY: FAKE_SERVICE_JWT,
  JWT_SECRET: 'journey-jwt-secret',
  REDIS_URL: '',
  // PGlite is PostgreSQL compiled to WASM running ON this thread: every query is event-loop
  // time, so the production overload guard (250 ms of lag) would shed most requests here.
  MAX_EVENT_LOOP_DELAY_MS: process.env.MAX_EVENT_LOOP_DELAY_MS ?? '60000',
  RESEND_API_KEY: '',
})

async function main(): Promise<void> {
  const { engine, openRealDatabase, SKIP_REASON } = await import('./real-postgres')
  if (!engine) throw new Error(SKIP_REASON)
  const { applyFullSchema } = await import('./pg-mirror')
  const { createJourneyWorld } = await import('./journey-world')

  const real = await openRealDatabase()
  const schema = await applyFullSchema(real.runner)
  if (schema.unapplied.length > 0) {
    throw new Error(`MIGRATIONS_UNAPPLIED: ${JSON.stringify(schema.unapplied)}`)
  }
  const world = await createJourneyWorld(real.runner)
  ;(globalThis as typeof globalThis & Record<string, unknown>).__journeyDb = world.dbModule
  ;(globalThis as typeof globalThis & Record<string, unknown>).__journeyRealErrors =
    world.realErrors

  // Every import of src/db.ts resolves to the journey world instead.
  const replacement = pathToFileURL(join(__dirname, 'journey-db-module.ts')).href
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context)
      const file = resolved.url.startsWith('file:') ? fileURLToPath(resolved.url) : ''
      if (/[\\/]backend[\\/]src[\\/]db\.ts$/.test(file)) {
        return { ...resolved, url: replacement, shortCircuit: true }
      }
      return resolved
    },
  })

  console.log(`JOURNEY_SCHEMA ${engine}: ${schema.applied.length} migrations applied`)
  // index.ts starts the server itself when it is not under vitest.
  await import('../../index')
}

main().catch((error: unknown) => {
  console.error('JOURNEY_SERVER_FAILED', error)
  process.exit(1)
})
