// ============================================
// The four production 500s behind /fa/manufacturing (and the AI quota badge).
//
// Each one was a read that depended on something the live schema does not have,
// or on an error code the client library never delivers:
//
//   1. GET /api/boms              selected `boms.notes` — no migration ever
//                                 created it → 42703, which the PGRST200 embed
//                                 fallback does not catch.
//   2. GET /api/pos/sessions/current
//   3. GET /api/pos/sessions/abandoned
//                                 selected the phase-m-01 handover columns that
//                                 `mapSession` never reads → 42703 on any DB
//                                 where phase-m-01 is not applied.
//   4. GET /api/ai/quota          counted with `head: true`; a failed HEAD comes
//                                 back from postgrest-js as `{ message: '' }`
//                                 with NO code, so the schema tolerance could
//                                 never match and it always rethrew.
//
// Source assertions, comments stripped first so a comment describing the bug
// cannot fail (or pass) the test.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')
}

const SERVICES = join(__dirname, '..', 'services')

function constant(source: string, name: string): string {
  const start = source.indexOf(`const ${name} =`)
  expect(start, `${name} not found`).toBeGreaterThan(-1)
  const open = source.indexOf("'", start)
  return source.slice(open, source.indexOf("'", open + 1) + 1)
}

function method(source: string, name: string): string {
  const start = source.indexOf(`async ${name}(`)
  expect(start, `${name} not found`).toBeGreaterThan(-1)
  const next = source.indexOf('\n  async ', start + 1)
  const nextPrivate = source.indexOf('\n  private async ', start + 1)
  const ends = [next, nextPrivate].filter((i) => i > -1)
  return source.slice(start, ends.length ? Math.min(...ends) : undefined)
}

describe('GET /api/boms', () => {
  const svc = code(join(SERVICES, 'manufacturing.service.ts'))

  it('does not select boms.notes, a column no applied migration created', () => {
    expect(constant(svc, 'BOM_COLUMNS')).not.toContain('notes')
  })

  // `createBom` is gone: a definition is written by the database function
  // manufacturing_save_bom (one transaction, revisions). What must stay true is
  // that the service never goes back to inserting the two tables itself.
  it('a definition is written by the database function, never by two inserts', () => {
    expect(method(svc, 'saveDefinition')).toContain("rpc('manufacturing_save_bom'")
    expect(svc).not.toContain(".from('bom_items').insert")
    expect(svc).not.toContain(".from('bom_items').delete")
  })
})

describe('GET /api/pos/sessions/current and /abandoned', () => {
  const svc = code(join(SERVICES, 'pos', 'pos.service.ts'))
  const HANDOVER = [
    'expected_cash_minor',
    'cash_sales_minor',
    'cash_in_minor',
    'cash_out_minor',
    'variance_minor',
  ]

  it('SESSION_COLUMNS holds only finance-gaps columns', () => {
    const cols = constant(svc, 'SESSION_COLUMNS')
    for (const column of HANDOVER) expect(cols).not.toContain(column)
  })

  it('the current/abandoned reads use SESSION_COLUMNS, not the history set', () => {
    for (const name of ['getOpenSession', 'findAbandonedSessions']) {
      const body = method(svc, name)
      expect(body).toContain('.select(SESSION_COLUMNS)')
      expect(body).not.toContain('HISTORY_COLUMNS')
    }
  })

  it('the history read still selects the frozen handover figures', () => {
    expect(method(svc, 'sessionHistory')).toContain('.select(HISTORY_COLUMNS)')
  })
})

describe('GET /api/ai/quota', () => {
  const svc = code(join(SERVICES, 'ai', 'ai-quota.service.ts'))

  it('counts with a GET so a failure carries a real PostgREST code', () => {
    const body = method(svc, 'usedThisMonth')
    expect(body).not.toContain('head: true')
    expect(body).toContain("count: 'exact'")
  })
})
