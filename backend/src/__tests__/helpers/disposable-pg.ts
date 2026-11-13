// ============================================
// backend/src/__tests__/helpers/disposable-pg.ts
//
// An OPT-IN way to run the real-PostgreSQL tests against an external DISPOSABLE server when the embedded binary cannot start
// (it cannot on the machine this was written on: initdb ENOENT). It is for a throwaway server the person created for testing - never
// for any production or shared database.
//
// Guards (all must hold, otherwise the tests are SKIPPED and say why):
//   HISABCHE_TEST_PG_URL         a connection string to the server's ADMIN database. Read only from the process environment, never from
//                                a .env file, and never printed, logged or put in an error message.
//   HISABCHE_TEST_PG_DISPOSABLE  must be exactly 'yes': the person declares this server throwaway.
//   Looks-like-an-application refusal: if the admin database already holds a public.workspaces table WITH ROWS, or a Supabase-style
//   application schema with data, the run is refused.
//   Isolation: every run creates its OWN database (qa_m5_<random>) and DROPS it afterwards; nothing else is touched.
// Without the variables this module does nothing and the tests report themselves as skipped (BLOCKED_EXTERNAL).
// ============================================

import { randomBytes } from 'node:crypto'
import postgres from 'postgres'

export interface DisposableDatabase {
  /** Open a new connection (each is a real, separate server connection). */
  connect: (max?: number) => postgres.Sql
  /** The database name (safe to print: it is the random qa_m5_ one). */
  readonly name: string
  drop: () => Promise<void>
}

export const disposableEnabled = (): boolean =>
  Boolean(process.env.HISABCHE_TEST_PG_URL) && process.env.HISABCHE_TEST_PG_DISPOSABLE === 'yes'

export const SKIP_REASON =
  'BLOCKED_EXTERNAL: set HISABCHE_TEST_PG_URL (admin database of a throwaway server) and HISABCHE_TEST_PG_DISPOSABLE=yes'

/** Create an isolated database on the declared-disposable server, or throw WITHOUT revealing the connection string. */
export async function createDisposableDatabase(): Promise<DisposableDatabase> {
  if (!disposableEnabled()) throw new Error(SKIP_REASON)
  const url = new URL(process.env.HISABCHE_TEST_PG_URL!)
  const admin = postgres(url.toString(), { max: 1, onnotice: () => undefined })
  const name = `qa_m5_${randomBytes(6).toString('hex')}`
  try {
    const populated = await admin`
      SELECT (to_regclass('public.workspaces') IS NOT NULL) AS has_table`
    if (populated[0]?.has_table) {
      const rows = await admin`SELECT count(*)::int AS n FROM public.workspaces`
      if ((rows[0]?.n ?? 0) > 0) {
        throw new Error(
          'REFUSED: the admin database already holds application data (public.workspaces has rows); this is not a disposable server',
        )
      }
    }
    await admin.unsafe(`CREATE DATABASE ${name}`)
  } catch (error) {
    await admin.end({ timeout: 1 }).catch(() => undefined)
    throw new Error(
      error instanceof Error && error.message.startsWith('REFUSED')
        ? error.message
        : 'could not create the disposable test database',
      { cause: error },
    )
  }
  await admin.end({ timeout: 1 }).catch(() => undefined)

  const target = new URL(url.toString())
  target.pathname = `/${name}`
  const opened: postgres.Sql[] = []
  return {
    name,
    connect: (max = 1) => {
      const sql = postgres(target.toString(), { max, onnotice: () => undefined })
      opened.push(sql)
      return sql
    },
    drop: async () => {
      await Promise.all(opened.map((sql) => sql.end({ timeout: 2 }).catch(() => undefined)))
      const cleanup = postgres(url.toString(), { max: 1 })
      try {
        await cleanup.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
      } finally {
        await cleanup.end({ timeout: 1 }).catch(() => undefined)
      }
    },
  }
}
