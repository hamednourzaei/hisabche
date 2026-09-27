// `/api/ai/quota` is asked by every user. Its status read used to SELECT
// `api_key` only to turn it into a boolean, so the product owner's secret
// crossed the wire from the database on every call (27 Sep 2026, seen in the
// Supabase request log). The status now asks «is a key set» as a filter.
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Call {
  columns: string
  filters: string[]
}
const calls: Call[] = []
let rows: { keyed: Record<string, unknown> | null; any: Record<string, unknown> | null }

function builder() {
  const call: Call = { columns: '', filters: [] }
  calls.push(call)
  const q = {
    select(columns: string) {
      call.columns = columns
      return q
    },
    not(col: string, op: string, val: unknown) {
      call.filters.push(`${col} not ${op} ${String(val)}`)
      return q
    },
    neq(col: string, val: unknown) {
      call.filters.push(`${col} neq ${String(val)}`)
      return q
    },
    async maybeSingle() {
      const keyed = call.filters.some((f) => f.startsWith('api_key'))
      return { data: keyed ? rows.keyed : rows.any, error: null }
    },
  }
  return q
}

vi.mock('../db', () => ({ supabase: { from: () => builder() } }))

const { AiSettingsService } = await import('../services/ai/ai-settings.service')

const ROW = {
  provider: 'anthropic',
  base_url: null,
  model: 'm',
  system_prompt: '',
  topup_contact: '@owner',
  is_enabled: true,
  updated_at: null,
}

describe('AiSettingsService.getStatus', () => {
  beforeEach(() => {
    calls.length = 0
  })

  it('never selects the api_key column', async () => {
    rows = { keyed: ROW, any: ROW }
    await new AiSettingsService().getStatus()
    expect(calls.length).toBeGreaterThan(0)
    for (const c of calls) expect(c.columns).not.toContain('api_key')
  })

  it('a stored key → hasApiKey true, in one read', async () => {
    rows = { keyed: ROW, any: ROW }
    const status = await new AiSettingsService().getStatus()
    expect(status?.hasApiKey).toBe(true)
    expect(calls).toHaveLength(1)
  })

  it('no key → the settings still come back, with hasApiKey false', async () => {
    rows = { keyed: null, any: ROW }
    const status = await new AiSettingsService().getStatus()
    expect(status?.hasApiKey).toBe(false)
    expect(status?.topupContact).toBe('@owner')
  })

  it('no settings at all → null', async () => {
    rows = { keyed: null, any: null }
    expect(await new AiSettingsService().getStatus()).toBeNull()
  })
})
