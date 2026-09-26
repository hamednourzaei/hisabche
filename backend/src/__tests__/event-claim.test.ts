// ============================================
// Event processing goes through the atomic claim (proven against real Postgres
// in distributed-work.pg.test.ts); before the migration it keeps the old
// single-instance path. And an emitted event starts unprocessed.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const legacySelect = vi.fn()
vi.mock('../db', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => ({
      select: () => ({
        eq: () => ({ or: () => ({ order: () => ({ limit: () => legacySelect() }) }) }),
      }),
    }),
  },
}))
vi.mock('../utils/pagination', () => ({
  memoryCache: { invalidate: vi.fn(), get: vi.fn(), set: vi.fn() },
}))

const { EventService } = await import('../services/event.service')

beforeEach(() => {
  rpc.mockReset()
  legacySelect.mockReset()
})

describe('processPending', () => {
  it('claims atomically and finishes each claimed event as its holder', async () => {
    const service = new EventService()
    const handler = vi.fn(async () => {})
    service.on('invoice.created', handler)
    rpc.mockImplementation(async (name: string) =>
      name === 'claim_event_log'
        ? {
            data: [
              {
                id: 'e1',
                event_type: 'invoice.created',
                entity_type: 'invoice',
                entity_id: 'x',
                payload: {},
                user_id: 'u',
              },
            ],
            error: null,
          }
        : { data: true, error: null },
    )
    const result = await service.processPending()
    expect(result).toEqual({ processed: 1, failed: 0 })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['claim_event_log', 'complete_event_log'])
    expect(legacySelect).not.toHaveBeenCalled()
  })

  it('a failing handler records the failure through fail_event_log, not completion', async () => {
    const service = new EventService()
    service.on('invoice.created', async () => {
      throw new Error('boom')
    })
    rpc.mockImplementation(async (name: string) =>
      name === 'claim_event_log'
        ? {
            data: [
              {
                id: 'e1',
                event_type: 'invoice.created',
                entity_type: 'invoice',
                entity_id: 'x',
                payload: {},
                user_id: 'u',
              },
            ],
            error: null,
          }
        : { data: 'retry', error: null },
    )
    expect(await service.processPending()).toEqual({ processed: 0, failed: 1 })
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(['claim_event_log', 'fail_event_log'])
  })

  it('before the migration: the old path runs instead of failing', async () => {
    const service = new EventService()
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } })
    legacySelect.mockResolvedValue({ data: [] })
    await service.processPending()
    expect(legacySelect).toHaveBeenCalledTimes(1)
  })
})

describe('source guards', () => {
  const code = readFileSync(join(__dirname, '..', 'services', 'event.service.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

  it('⚠️ an emitted event is inserted as unprocessed (the column defaults to TRUE)', () => {
    expect(code).toMatch(/idempotency_key: idempotencyKey,\s*processed: false,/)
  })

  it('historical processed=true rows are never rewritten: every `processed: true` write targets one event id', () => {
    const writes = code.match(/\.update\(\{ processed: true[^}]*\}\)\s*\.eq\('[a-z_]+'/g) ?? []
    expect(writes.length).toBeGreaterThan(0)
    for (const w of writes) expect(w).toMatch(/\.eq\('id'$/)
    expect(code).not.toMatch(/\.update\(\{\s*processed: false/)
  })

  it('immediate processing on emit also goes through the claim', () => {
    expect(code).toMatch(
      /private async processEvent\(eventId: string\): Promise<void> \{\s*const claimed = await this\.claimEvents\(1, eventId\)/,
    )
  })
})
