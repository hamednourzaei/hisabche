// Manual journal entries and the year-end close are keyed in the database
// (27 Sep 2026): a retried submit returns the first entry, two simultaneous
// closes cannot both post. Both ride the existing unique index
// journal_entries_source_key (workspace, source_type, source_id), which
// writeEntry already turns into «reuse the entry that won».
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../db', () => ({ supabase: {} }))
vi.mock('../utils/pagination', () => ({
  memoryCache: { get: vi.fn(), set: vi.fn(), invalidate: vi.fn() },
}))

const { sourceIdOf } = await import('../services/accounting/accounting.service')

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('sourceIdOf', () => {
  it('is a valid UUID (source_id is a uuid column)', () => {
    expect(sourceIdOf('ws', 'manual', 'inv_web_123')).toMatch(UUID)
  })

  it('the same request maps to the same source — that is what makes a retry a replay', () => {
    expect(sourceIdOf('ws', 'manual', 'k1')).toBe(sourceIdOf('ws', 'manual', 'k1'))
    expect(sourceIdOf('ws', 'year_end_close', '2025-01-01', '2025-12-31')).toBe(
      sourceIdOf('ws', 'year_end_close', '2025-01-01', '2025-12-31'),
    )
  })

  it('never collides across workspaces, kinds or keys', () => {
    const ids = new Set([
      sourceIdOf('ws-a', 'manual', 'k1'),
      sourceIdOf('ws-b', 'manual', 'k1'),
      sourceIdOf('ws-a', 'manual', 'k2'),
      sourceIdOf('ws-a', 'year_end_close', 'k1'),
      // parts are separated, so ('ab','c') is not ('a','bc')
      sourceIdOf('ws-a', 'x', 'ab', 'c'),
      sourceIdOf('ws-a', 'x', 'a', 'bc'),
    ])
    expect(ids.size).toBe(6)
  })
})

describe('wiring', () => {
  const service = readFileSync(
    join(__dirname, '../services/accounting/accounting.service.ts'),
    'utf8',
  )
  const routes = readFileSync(join(__dirname, '../routes/accounting.routes.ts'), 'utf8')

  it('POST /journal passes the Idempotency-Key through', () => {
    expect(routes).toContain('idempotencyKey: readClientRequestId(request)')
  })

  it('a manual entry with a key gets a source; without one, none (unchanged)', () => {
    expect(service).toContain("sourceIdOf(ctx.workspaceId, 'manual', options.idempotencyKey)")
  })

  it('the year-end close is sourced by its period', () => {
    expect(service).toContain(
      "source: { type: 'year_end_close', id: sourceIdOf(ctx.workspaceId, 'year_end_close', plan.from, plan.to) }",
    )
  })

  it('writeEntry turns the unique violation into «reuse the entry that won»', () => {
    expect(service).toContain('findEntryBySource(')
  })
})
