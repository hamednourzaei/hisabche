// Lean pull payload (#153): every column a pull selects must exist, or every
// pull becomes a 500. Checked against the migrations in docs/ — the source the
// live schema is built from — and against what the desktop client reads.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../db', () => ({ supabase: {} }))

const { PULL_COLUMNS, INVOICE_ITEM_COLUMNS } = await import('../services/sync.service')
const { declaredColumns } = await import('./helpers/declared-columns')

const TABLE: Record<string, string> = {
  product: 'products',
  customer: 'customers',
  invoice: 'invoices',
  transaction: 'transactions',
  time_entry: 'time_entries',
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

  it('every invoice line column exists in the migrations', () => {
    const declared = declaredColumns('invoice_items')
    expect(declared.size).toBeGreaterThan(0)
    expect(INVOICE_ITEM_COLUMNS.filter((c) => !declared.has(c))).toEqual([])
  })

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
