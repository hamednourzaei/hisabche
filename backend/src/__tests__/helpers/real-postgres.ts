// ============================================
// backend/src/__tests__/helpers/real-postgres.ts
//
// A REAL PostgreSQL for the journeys, whichever this machine can start:
//   embedded-postgres  (CI, Ubuntu) — the binary the other *.pg.test.ts files use;
//   PGlite             real PostgreSQL compiled to WASM, where the embedded binary cannot
//                      start (an antivirus removed it on the owner's machine), when
//                      PGLITE_DIR names a folder with @electric-sql/pglite installed.
// Neither: `engine` is null and the caller SKIPS with SKIP_REASON — never passes.
// ============================================

import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Row } from './fake-supabase'
import { freePortSync } from './free-port'
import type { PgRunner } from './pg-mirror'
import { pgTempDir } from './pg-temp-dir'

const localRequire = createRequire(__filename)

/** The embedded binary, if this machine has it. */
function embeddedInitdb(): string | null {
  try {
    const entry = createRequire(localRequire.resolve('embedded-postgres')).resolve(
      `@embedded-postgres/${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`,
    )
    let dir = dirname(entry)
    for (let i = 0; i < 4 && !existsSync(join(dir, 'native')); i++) dir = dirname(dir)
    const bin = join(dir, 'native', 'bin', process.platform === 'win32' ? 'initdb.exe' : 'initdb')
    return existsSync(bin) ? bin : null
  } catch {
    return null
  }
}

const PGLITE_DIR = process.env.PGLITE_DIR
const PGLITE_PACKAGE = PGLITE_DIR ? join(PGLITE_DIR, 'node_modules', '@electric-sql', 'pglite') : ''

export const engine: 'embedded' | 'pglite' | null = embeddedInitdb()
  ? 'embedded'
  : PGLITE_PACKAGE && existsSync(PGLITE_PACKAGE)
    ? 'pglite'
    : null

export const SKIP_REASON =
  'BLOCKED_EXTERNAL: no embedded-postgres binary on this machine and PGLITE_DIR is not set'

export interface RealDatabase {
  runner: PgRunner
  close: () => Promise<void>
}

interface PgliteInstance {
  exec: (text: string) => Promise<unknown>
  query: (text: string, params?: unknown[]) => Promise<{ rows: Row[] }>
  close: () => Promise<void>
}

export async function openRealDatabase(): Promise<RealDatabase> {
  if (engine === 'pglite') {
    const { PGlite } = createRequire(join(PGLITE_DIR ?? '', 'noop.js'))('@electric-sql/pglite') as {
      PGlite: new (options: { extensions: Record<string, unknown> }) => PgliteInstance
    }
    // btree_gist ships with PGlite as a contrib module; Supabase and embedded-postgres have it.
    const contrib = (await import(
      pathToFileURL(join(PGLITE_PACKAGE, 'dist', 'contrib', 'btree_gist.js')).href
    )) as { btree_gist: unknown }
    const db = new PGlite({ extensions: { btree_gist: contrib.btree_gist } })
    return {
      runner: {
        exec: async (text) => {
          await db.exec(text)
        },
        query: async (text, params) => (await db.query(text, params ? [...params] : [])).rows,
      },
      close: () => db.close(),
    }
  }

  if (engine !== 'embedded') throw new Error(SKIP_REASON)
  const { default: EmbeddedPostgres } = await import('embedded-postgres')
  const { default: postgres } = await import('postgres')
  const port = freePortSync()
  const pg = new EmbeddedPostgres({
    databaseDir: pgTempDir('hisabche-pg-journey-'),
    port,
    user: 'postgres',
    password: 'test',
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    createPostgresUser: process.getuid?.() === 0,
  })
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('journey')
  const sql = postgres(`postgres://postgres:test@localhost:${port}/journey`, {
    max: 1,
    onnotice: () => {},
  })
  return {
    runner: {
      exec: async (text) => {
        await sql.unsafe(text)
      },
      query: async (text, params) =>
        [...(await sql.unsafe(text, params ? ([...params] as never) : []))] as Row[],
    },
    close: async () => {
      await sql.end({ timeout: 2 })
      await pg.stop()
    },
  }
}
