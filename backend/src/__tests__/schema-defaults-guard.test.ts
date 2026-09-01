import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The bug this guards against cost a full day, and it was invisible in code
 * review because the defect was an ABSENCE.
 *
 *     workspace.service.ts:  .insert({ workspace_id, user_id, role: 'owner' })
 *     base-schema.sql:       has_access boolean NOT NULL     ← no DEFAULT
 *
 * Neither line is wrong on its own. Together they are a 23502 not-null
 * violation on the first insert, no membership row, and then `403` on every
 * request for the rest of the session — with `userId` set and `workspaceId`
 * null in the logs, which reads like an authorization bug rather than a
 * missing column default.
 *
 * `base-schema-migration.sql` was rebuilt from a dump that recorded names,
 * types and NOT NULL and no defaults. That was the right call at the time —
 * inventing a default is worse than omitting one — but it left every column
 * the database used to fill in as a landmine.
 *
 * ⚠️ This asserts on the SCHEMA FILE, not on a live database. A test that
 * needed a connection would not run in CI, and the whole value here is
 * catching the next one before it is deployed.
 */

const SCHEMA = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'base-schema-migration.sql'),
  'utf8',
)

/** Every NOT NULL column with no DEFAULT, as `table.column`. */
function notNullWithoutDefault(): Array<{ table: string; column: string; type: string }> {
  const found: Array<{ table: string; column: string; type: string }> = []

  for (const block of SCHEMA.split('CREATE TABLE IF NOT EXISTS ').slice(1)) {
    const table = block.slice(0, block.indexOf(' ')).trim()
    const bodyEnd = block.indexOf('\n);')
    if (bodyEnd === -1) continue

    for (const line of block.slice(block.indexOf('(') + 1, bodyEnd).split('\n')) {
      const match = /^\s+([a-z0-9_]+)\s+(.+?)\s*,?\s*$/.exec(line)
      if (!match) continue

      const column = match[1]
      const rest = match[2]
      if (!column || !rest) continue
      if (!/NOT NULL/.test(rest)) continue
      if (/DEFAULT/.test(rest)) continue
      if (/PRIMARY KEY/.test(rest)) continue // NOT NULL by definition

      found.push({ table, column, type: rest.replace(/NOT NULL.*/, '').trim() })
    }
  }

  return found
}

describe('schema defaults', () => {
  it('gives every NOT NULL boolean a default', () => {
    // A boolean the code never sets is the exact shape of the has_access bug:
    // the application treats it as "obviously true by default" and the column
    // rejects the insert instead.
    const offenders = notNullWithoutDefault()
      .filter((c) => c.type.startsWith('boolean'))
      .map((c) => `${c.table}.${c.column}`)

    expect(
      offenders,
      'NOT NULL boolean with no DEFAULT — an insert that omits it raises 23502',
    ).toEqual([])
  })

  it('gives every NOT NULL timestamp column a default', () => {
    // `created_at`, `joined_at`, `updated_at` are never in an insert payload.
    // Without `DEFAULT now()` every one of them fails the same way.
    const offenders = notNullWithoutDefault()
      .filter((c) => /^timestamp/.test(c.type) && c.column.endsWith('_at'))
      .map((c) => `${c.table}.${c.column}`)

    expect(offenders, 'NOT NULL timestamp with no DEFAULT').toEqual([])
  })

  it('keeps workspace_members.has_access defaulting to true', () => {
    // The specific column, asserted by name, because it is the one that takes
    // the whole product down rather than one screen.
    //
    // ⚠️ `true`. A member added by an invite is active immediately —
    // suspension is what `suspended_at` records. Defaulting to `false` would
    // create every member in a state nothing knows how to leave, and the
    // symptom would be identical: 403 everywhere.
    const block = SCHEMA.split('CREATE TABLE IF NOT EXISTS workspace_members ')[1] ?? ''
    const line = block.split('\n').find((l) => /^\s+has_access\b/.test(l)) ?? ''

    expect(line, 'workspace_members.has_access must exist').not.toBe('')
    expect(line, 'has_access must DEFAULT true — every workspace resolution filters on it').toMatch(
      /DEFAULT\s+true/i,
    )
  })
})
