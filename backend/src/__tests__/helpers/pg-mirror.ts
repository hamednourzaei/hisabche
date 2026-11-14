// ============================================
// backend/src/__tests__/helpers/pg-mirror.ts
//
// The REAL-database half of the write-through journey (see journey-retail.pg.test.ts).
//
// Two things, both driver-free (the caller passes a tiny runner, so the same code
// runs on embedded-postgres in CI and on PGlite where that binary cannot start):
//
//   applyFullSchema   the whole `docs/` migration set, in the order
//                     `scripts/run-migrations.mjs` applies it, on top of the Supabase
//                     objects a migration may name (auth.uid, the three roles, storage).
//   createPgMirror    a DatabaseMirror: each write the services make is replayed as
//                     SQL with the REAL column types, and each rpc calls the REAL
//                     function. Nothing is adapted to make it pass: a column the
//                     schema lacks, a constraint, a RAISE — the route gets the error.
// ============================================

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseMirror, FakeDatabase, FakeResult, MirrorWrite, Row } from './fake-supabase'

export interface PgRunner {
  /** One or many statements, no parameters (a migration file). */
  exec: (text: string) => Promise<void>
  /** One statement with positional parameters; answers the rows. */
  query: (text: string, params?: readonly unknown[]) => Promise<Row[]>
}

const REPO = join(__dirname, '..', '..', '..', '..')
const DOCS = join(REPO, 'docs')

/**
 * Objects Supabase provides and no migration creates. Only what migrations NAME:
 * `auth.uid()` answers null (the backend calls with the service role), and the
 * realtime publication exists so a migration that adds a table to it can run.
 */
const SUPABASE_SURFACE = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb, created_at timestamptz DEFAULT now()
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'service_role'::text $$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text, owner uuid
);
CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array(name, '/') $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;
`

/** The ORDER list of scripts/run-migrations.mjs (read, not re-typed, so the two cannot drift). */
function migrationOrder(): string[] {
  const runner = readFileSync(join(REPO, 'scripts', 'run-migrations.mjs'), 'utf8')
  const start = runner.indexOf('const ORDER = [')
  const block = runner.slice(start, runner.indexOf(']', start))
  return [...block.matchAll(/'([a-z0-9_.-]+\.sql)'/g)].map((match) => match[1] ?? '')
}

export interface SchemaResult {
  applied: string[]
  unapplied: Array<{ file: string; reason: string }>
}

/**
 * The run-migrations queue: ORDER first, then every other `*-migration.sql` by name.
 * A file that fails because a LATER-named file it needs had not run yet is retried
 * after the rest (the ORDER list does not name every dependency — reported, not hidden).
 */
export async function applyFullSchema(runner: PgRunner): Promise<SchemaResult> {
  await runner.exec(SUPABASE_SURFACE)
  const order = migrationOrder()
  const present = readdirSync(DOCS).filter((file) => file.endsWith('.sql') && !file.startsWith('_'))
  const queue = [
    ...order.filter((file) => present.includes(file)),
    ...present.filter((file) => !order.includes(file) && /-migration\.sql$/.test(file)).sort(),
  ]

  const applied: string[] = []
  let pending = queue
  let failures = new Map<string, string>()
  for (let pass = 0; pass < 6 && pending.length > 0; pass++) {
    failures = new Map()
    for (const file of pending) {
      try {
        await runner.exec(readFileSync(join(DOCS, file), 'utf8'))
        applied.push(file)
      } catch (error) {
        failures.set(file, error instanceof Error ? error.message : String(error))
        try {
          await runner.exec('ROLLBACK')
        } catch {
          // no transaction was open
        }
      }
    }
    if (failures.size === pending.length) break
    pending = [...failures.keys()]
  }
  return {
    applied,
    unapplied: [...failures].map(([file, reason]) => ({ file, reason: reason.slice(0, 200) })),
  }
}

// ─── The mirror ───────────────────────────────────────────────────────────────

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`
const literal = (text: string) => `'${text.replace(/'/g, "''")}'`

interface FunctionShape {
  inNames: string[]
  inTypes: string[]
  required: number
  returnsSet: boolean
  returnType: string
}

function errorOf(error: unknown): NonNullable<FakeResult['error']> {
  if (error instanceof Error) {
    const code = (error as Error & { code?: unknown }).code
    return typeof code === 'string' ? { code, message: error.message } : { message: error.message }
  }
  return { message: String(error) }
}

/**
 * Copy every non-empty public table and view of the real database into the fake, as
 * PostgREST would serialise it (to_jsonb: ISO timestamps, numbers as numbers). After this
 * the services read exactly what the real triggers and functions wrote.
 */
export async function syncInto(runner: PgRunner, db: FakeDatabase): Promise<void> {
  const relations = await runner.query(
    `SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'p')`,
  )
  const names = relations.map((row) => String(row.name))
  if (names.length === 0) return
  const counts = await runner.query(
    names
      .map(
        (name) =>
          `SELECT ${literal(name)} AS name, (SELECT count(*) FROM public.${quote(name)}) AS n`,
      )
      .join(' UNION ALL '),
  )
  for (const row of counts) {
    const name = String(row.name)
    if (Number(row.n) === 0) {
      if (db.tables.has(name)) db.tables.set(name, [])
      continue
    }
    const rows = await runner.query(`SELECT to_jsonb(t) AS v FROM public.${quote(name)} AS t`)
    db.tables.set(
      name,
      rows.map((r) => r.v as Row),
    )
  }
}

export function createPgMirror(
  runner: PgRunner,
  afterChange?: () => Promise<void>,
): DatabaseMirror {
  const columnsOf = new Map<string, Set<string>>()
  const primaryKeyOf = new Map<string, string[]>()

  async function columns(table: string): Promise<Set<string>> {
    const known = columnsOf.get(table)
    if (known) return known
    const rows = await runner.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    )
    const found = new Set(rows.map((row) => String(row.column_name)))
    columnsOf.set(table, found)
    return found
  }

  async function primaryKey(table: string): Promise<string[]> {
    const known = primaryKeyOf.get(table)
    if (known) return known
    const rows = await runner.query(
      `SELECT a.attname FROM pg_index i
         JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = ('public.' || quote_ident($1))::regclass AND i.indisprimary`,
      [table],
    )
    const key = rows.map((row) => String(row.attname))
    primaryKeyOf.set(table, key)
    return key
  }

  /** The row as the service meant it: a fake-generated id goes only where the table has one. */
  async function shaped(table: string, row: Row, generated: Set<string>): Promise<Row> {
    const has = await columns(table)
    const out: Row = {}
    for (const [key, value] of Object.entries(row)) {
      if (value === undefined) continue
      if (key === 'id' && generated.has(String(value)) && !has.has('id')) continue
      out[key] = value
    }
    return out
  }

  async function write(change: MirrorWrite): Promise<FakeResult['error']> {
    const target = `public.${quote(change.table)}`
    const generated = new Set(change.generatedIds)
    try {
      if (change.kind === 'insert' || change.kind === 'upsert') {
        for (const original of change.rows) {
          const row = await shaped(change.table, original, generated)
          const names = Object.keys(row).map(quote).join(', ')
          let text = `INSERT INTO ${target} (${names})
            SELECT ${names} FROM json_populate_record(NULL::${target}, $1::json)`
          if (change.kind === 'upsert') {
            const conflict = change.conflict ?? (await primaryKey(change.table))
            const updates = Object.keys(row)
              .filter((name) => !conflict.includes(name))
              .map((name) => `${quote(name)} = EXCLUDED.${quote(name)}`)
            text +=
              change.ignoreDuplicates || updates.length === 0
                ? ` ON CONFLICT (${conflict.map(quote).join(', ')}) DO NOTHING`
                : ` ON CONFLICT (${conflict.map(quote).join(', ')}) DO UPDATE SET ${updates.join(', ')}`
          }
          await runner.query(text, [JSON.stringify(row)])
        }
        return null
      }

      const ids = change.rows.map((row) => row.id).filter((id) => id !== undefined && id !== null)
      if (ids.length === 0) return null
      if (ids.length !== change.rows.length) {
        return { message: `MIRROR_ROW_WITHOUT_ID: ${change.kind} on ${change.table}` }
      }
      const idList = JSON.stringify(ids.map(String))

      if (change.kind === 'update') {
        const values = await shaped(change.table, change.values ?? {}, generated)
        const names = Object.keys(values).map(quote)
        if (names.length === 0) return null
        await runner.query(
          `UPDATE ${target} SET (${names.join(', ')}) =
             (SELECT ${names.join(', ')} FROM json_populate_record(NULL::${target}, $1::json))
           WHERE ${quote('id')}::text = ANY(SELECT jsonb_array_elements_text($2::jsonb))`,
          [JSON.stringify(values), idList],
        )
        return null
      }

      await runner.query(
        `DELETE FROM ${target}
          WHERE ${quote('id')}::text = ANY(SELECT jsonb_array_elements_text($1::jsonb))`,
        [idList],
      )
      return null
    } catch (error) {
      return errorOf(error)
    }
  }

  async function shapesOf(name: string): Promise<FunctionShape[]> {
    const rows = await runner.query(
      `SELECT p.proretset AS returns_set,
              format_type(p.prorettype, NULL) AS return_type,
              p.pronargs AS nargs, p.pronargdefaults AS ndefaults,
              COALESCE(p.proargnames, ARRAY[]::text[]) AS names,
              COALESCE(p.proargmodes::text[], ARRAY[]::text[]) AS modes,
              ARRAY(SELECT format_type(t, NULL)
                      FROM unnest(p.proargtypes) WITH ORDINALITY AS u(t, o) ORDER BY o) AS in_types
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = $1`,
      [name],
    )
    return rows.map((row) => {
      const names = (row.names as string[] | null) ?? []
      const modes = (row.modes as string[] | null) ?? []
      const inNames =
        modes.length === 0
          ? names
          : names.filter((_, index) => ['i', 'b', 'v'].includes(modes[index] ?? 'i'))
      return {
        inNames: inNames.slice(0, Number(row.nargs)),
        inTypes: (row.in_types as string[] | null) ?? [],
        required: Number(row.nargs) - Number(row.ndefaults),
        returnsSet: row.returns_set === true,
        returnType: String(row.return_type),
      }
    })
  }

  async function rpc(name: string, args: Row): Promise<FakeResult> {
    try {
      const supplied = Object.keys(args).filter((key) => args[key] !== undefined)
      const shape = (await shapesOf(name))
        .filter(
          (candidate) =>
            supplied.every((key) => candidate.inNames.includes(key)) &&
            candidate.inNames.slice(0, candidate.required).every((key) => supplied.includes(key)),
        )
        .sort((a, b) => a.inNames.length - b.inNames.length)[0]
      if (!shape) {
        return {
          data: null,
          error: {
            code: 'PGRST202',
            message: `function public.${name} not found for (${supplied.join(', ')})`,
          },
        }
      }

      const params: unknown[] = []
      const named = supplied.map((key) => {
        const type = shape.inTypes[shape.inNames.indexOf(key)] ?? 'text'
        const value = args[key]
        if (value === null) return `${quote(key)} => NULL::${type}`
        if (type === 'json' || type === 'jsonb') {
          params.push(JSON.stringify(value))
          return `${quote(key)} => $${params.length}::${type}`
        }
        if (type.endsWith('[]')) {
          params.push(JSON.stringify(value))
          return `${quote(key)} => ARRAY(SELECT jsonb_array_elements_text($${params.length}::jsonb))::${type}`
        }
        params.push(typeof value === 'object' ? JSON.stringify(value) : String(value))
        return `${quote(key)} => $${params.length}::${type}`
      })
      const call = `public.${quote(name)}(${named.join(', ')})`

      if (shape.returnsSet) {
        const rows = await runner.query(`SELECT to_jsonb(r) AS v FROM ${call} AS r`, params)
        return { data: rows.map((row) => row.v), error: null }
      }
      if (shape.returnType === 'void') {
        await runner.query(`SELECT ${call}`, params)
        return { data: null, error: null }
      }
      const rows = await runner.query(`SELECT to_jsonb(${call}) AS v`, params)
      return { data: rows[0]?.v ?? null, error: null }
    } catch (error) {
      return { data: null, error: errorOf(error) }
    }
  }

  return {
    write: async (change) => {
      const error = await write(change)
      if (!error && afterChange) await afterChange()
      return error
    },
    rpc: async (name, args) => {
      const result = await rpc(name, args)
      if (!result.error && afterChange) await afterChange()
      return result
    },
  }
}
