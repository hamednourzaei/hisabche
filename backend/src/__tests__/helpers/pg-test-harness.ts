import EmbeddedPostgres from 'embedded-postgres'
import postgres, { type Sql } from 'postgres'
import { freePortSync } from './free-port'
import { pgTempDir } from './pg-temp-dir'

export interface PgTestHandle {
  pg: EmbeddedPostgres
  sql: Sql
  port: number
}

export async function startPg(): Promise<PgTestHandle> {
  const port = freePortSync()
  const dir = pgTempDir('hisabche-pg-')
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'postgres',
    password: 'pw',
    port,
    persistent: false,
  })
  await pg.initialise()
  await pg.start()
  const sql = postgres(`postgres://postgres:pw@127.0.0.1:${port}/postgres`, {
    max: 5,
    onnotice: () => {},
  })
  return { pg, sql, port }
}

export async function stopPg(handle: PgTestHandle | undefined): Promise<void> {
  if (!handle) return
  try {
    await handle.sql.end({ timeout: 2 })
  } finally {
    await handle.pg.stop()
  }
}
