// Lean pull payload (#153): every column a pull selects must exist, or every
// pull becomes a 500. Checked against the migrations in docs/ — the source the
// live schema is built from — and against what the desktop client reads.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../db', () => ({ supabase: {} }))

const { PULL_COLUMNS } = await import('../services/sync.service')

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const sql = readdirSync(DOCS)
  .filter((f) => f.endsWith('.sql') && !f.startsWith('_'))
  .map((f) => readFileSync(join(DOCS, f), 'utf8'))
  .join('\n')

const TABLE: Record<string, string> = {
  product: 'products',
  customer: 'customers',
  invoice: 'invoices',
  transaction: 'transactions',
  time_entry: 'time_entries',
}

/** Every column declared for a table: CREATE TABLE bodies + ALTER … ADD COLUMN. */
function declaredColumns(table: string): Set<string> {
  const out = new Set<string>()
  const create = new RegExp(
    `CREATE TABLE (?:IF NOT EXISTS )?(?:public\\.)?${table}\\s*\\(([\\s\\S]*?)\\n\\);`,
    'gi',
  )
  for (const m of sql.matchAll(create)) {
    for (const line of m[1]!.split('\n')) {
      const col = /^\s*"?([a-z_][a-z0-9_]*)"?\s+[a-z]/i.exec(line)?.[1]
      if (col && !/^(constraint|primary|unique|foreign|check)$/i.test(col))
        out.add(col.toLowerCase())
    }
  }
  const alter = new RegExp(
    `ALTER TABLE (?:IF EXISTS )?(?:ONLY )?(?:public\\.)?${table}\\b([^;]*);`,
    'gi',
  )
  for (const m of sql.matchAll(alter)) {
    for (const c of m[1]!.matchAll(/ADD COLUMN (?:IF NOT EXISTS )?"?(\w+)"?/gi))
      out.add(c[1]!.toLowerCase())
  }
  return out
}

describe('sync pull columns', () => {
  it.each(Object.entries(PULL_COLUMNS).filter(([, cols]) => cols !== null))(
    'every %s column exists in the migrations',
    (entity, cols) => {
      const declared = declaredColumns(TABLE[entity]!)
      expect(declared.size, `no DDL found for ${TABLE[entity]}`).toBeGreaterThan(0)
      expect(cols!.filter((c) => !declared.has(c))).toEqual([])
    },
  )

  it('every entity carries id, workspace_id and version', () => {
    for (const cols of Object.values(PULL_COLUMNS)) {
      if (cols === null) continue
      expect(cols).toEqual(expect.arrayContaining(['id', 'workspace_id', 'version']))
    }
  })

  it('desktop reads nothing the pull no longer sends', () => {
    const engine = readFileSync(
      join(__dirname, '..', '..', '..', 'packages/app-shell/src/features/sync/sync-engine.ts'),
      'utf8',
    )
    const block = /const FROM_LOG[\s\S]*?\n}\n/.exec(engine)?.[0] ?? ''
    for (const [entity, cols] of Object.entries(PULL_COLUMNS)) {
      if (cols === null) continue
      const mapper = new RegExp(`\\n  ${entity}: \\(r\\) => \\(\\{([\\s\\S]*?)\\n  \\}\\),`).exec(
        block,
      )?.[1]
      if (!mapper) continue // this entity is not pulled by desktop
      const read = [...mapper.matchAll(/\br\.([a-z_]+)/g)].map((m) => m[1]!)
      expect(
        read.filter((c) => !cols.includes(c)),
        `${entity} mapper reads a column the pull does not send`,
      ).toEqual([])
    }
  })
})
