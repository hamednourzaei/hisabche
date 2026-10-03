// ============================================
// A sandbox is not a business (developer-platform-08 round, 3 Oct 2026).
//
// Every count of `workspaces` included the developers' sandboxes: platform
// metrics, and a person's plan quota — on the free plan (one business) making
// a sandbox used up the one business allowed.
//
// What is locked here:
//   - the count leaves sandboxes out;
//   - on a database WITHOUT migration 06 (no `is_sandbox` column) it falls
//     back to the plain count — never 0, never an error (§7.3);
//   - any other failure is returned, not swallowed;
//   - the three callers that count businesses use this, and nothing counts
//     `workspaces` by owner on its own.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Answer = { count: number | null; error: { code?: string; message?: string } | null }
let filters: string[][] = []
let answers: Answer[] = []

vi.mock('../db', () => ({
  supabase: {
    from: () => ({
      select: () => {
        const applied: string[] = []
        filters.push(applied)
        const query = {
          eq: (column: string, value: unknown) => {
            applied.push(`${column}=${String(value)}`)
            return query
          },
          then: (resolve: (value: Answer) => unknown) =>
            Promise.resolve(answers.shift() ?? { count: 0, error: null }).then(resolve),
        }
        return query
      },
    }),
  },
}))

const { countBusinesses } = await import('../services/workspace-counts')

beforeEach(() => {
  filters = []
  answers = []
})

describe('countBusinesses', () => {
  it('leaves sandboxes out, keeping the caller’s own filter', async () => {
    answers = [{ count: 2, error: null }]
    const out = await countBusinesses((q) => q.eq('owner_id', 'u1'))
    expect(out).toEqual({ count: 2, error: null })
    expect(filters).toEqual([['owner_id=u1', 'is_sandbox=false']])
  })

  it('no is_sandbox column (migration 06 not run) → the plain count, not 0 and not an error', async () => {
    answers = [
      {
        count: null,
        error: { code: '42703', message: 'column workspaces.is_sandbox does not exist' },
      },
      { count: 3, error: null },
    ]
    const out = await countBusinesses((q) => q.eq('owner_id', 'u1'))
    expect(out).toEqual({ count: 3, error: null })
    expect(filters).toEqual([['owner_id=u1', 'is_sandbox=false'], ['owner_id=u1']])
  })

  it('any other failure is returned — an error is not «none»', async () => {
    answers = [{ count: null, error: { code: '57014', message: 'timeout' } }]
    const out = await countBusinesses()
    expect(out.error).toMatchObject({ code: '57014' })
    expect(filters).toHaveLength(1)
  })
})

describe('who counts businesses', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const read = (file: string) =>
    strip(readFileSync(join(__dirname, '..', 'services', file), 'utf8'))

  it('the plan quota (two places) and the platform metrics use countBusinesses', () => {
    expect(read('billing.service.ts')).toContain(
      "countBusinesses((query) => query.eq('owner_id', userId))",
    )
    expect(read('entitlement.service.ts')).toContain(
      "countBusinesses((query) => query.eq('owner_id', userId))",
    )
    const admin = read('admin.service.ts')
    expect(admin.match(/businesses\(/g)!.length).toBeGreaterThanOrEqual(4)
    expect(admin).not.toContain("countOf('workspaces'")
  })

  it('a thrown read refuses the action rather than allowing it', () => {
    // Whitespace-insensitive: the formatter decides where the line breaks.
    expect(read('billing.service.ts').replace(/\s+/g, ' ')).toContain(
      'if (owned.error) throw new DatabaseError(',
    )
    expect(read('entitlement.service.ts')).toContain(
      'throw new DatabaseError(`Failed to count owned workspaces for usage limit`, error)',
    )
  })

  it('the helper is a leaf — it cannot join a service import cycle', () => {
    const src = readFileSync(join(__dirname, '..', 'services', 'workspace-counts.ts'), 'utf8')
    expect([...src.matchAll(/^import .* from '(.*)'/gm)].map((m) => m[1])).toEqual(['../db'])
  })
})
