// ============================================
// BUG-088 — an employee's current branches were always «none».
//
// `currentBranches` selected `started_at` and filtered `ended_at`; the table
// (docs/phase-d-01-employee-branch-assignments-migration.sql) has `starts_at`
// and `ends_at`. PostgREST answered 42703 on every call, the service logged
// it and returned [] — so the profile showed an employee with no branch, and
// nothing failed (§7.3: an error rendered as «empty»).
//
// The column names are checked against the MIGRATION, not against a mock: a
// mocked client returns its fixture whatever columns are asked for.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const service = strip(
  readFileSync(join(__dirname, '..', 'services', 'human-resources.service.ts'), 'utf8'),
)
const migration = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'phase-d-01-employee-branch-assignments-migration.sql'),
  'utf8',
)

describe('employee_branch_assignments: the service reads columns that exist', () => {
  const table = migration.slice(
    migration.indexOf('CREATE TABLE IF NOT EXISTS employee_branch_assignments'),
  )
  const definition = table.slice(0, table.indexOf(');'))
  const columns = new Set(
    [...definition.matchAll(/^\s{2}([a-z_]+)\s+(uuid|boolean|date|text|timestamptz)/gm)].map(
      (m) => m[1]!,
    ),
  )

  it('found the table definition', () => {
    expect(columns.has('starts_at')).toBe(true)
    expect(columns.has('ends_at')).toBe(true)
    expect(columns.has('started_at')).toBe(false)
  })

  const read = service.slice(service.indexOf('private async currentBranches'))
  const body = read.slice(0, read.indexOf('async createEmployee'))

  it('every plain column it selects or filters is in the table', () => {
    const select = /\.select\('([^']+)'\)/.exec(body)![1]!
    // The embedded relation («branch:branches(id, name, code)») is another
    // table's columns; drop it whole before splitting on commas.
    const selected = select
      .replace(/[a-z_]+:[a-z_]+\([^)]*\)/g, '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
    const filtered = [...body.matchAll(/\.(?:eq|is|order)\('([a-z_]+)'/g)].map((m) => m[1]!)
    expect([...selected, ...filtered].filter((column) => !columns.has(column))).toEqual([])
  })
})
