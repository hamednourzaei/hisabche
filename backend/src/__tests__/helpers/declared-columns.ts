// Columns each table declares in the migrations (docs/*.sql): CREATE TABLE
// bodies plus every ALTER TABLE … ADD COLUMN. Shared by the guards that check
// code against the schema it will run on.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DOCS = join(__dirname, '..', '..', '..', '..', 'docs')

let cached: string | null = null
function migrations(): string {
  cached ??= readdirSync(DOCS)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('_'))
    .map((f) => readFileSync(join(DOCS, f), 'utf8'))
    .join('\n')
  return cached
}

export function declaredColumns(table: string): Set<string> {
  const sql = migrations()
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
