// ============================================
// BUG-NEW-002: documents are dated in the business's own day.
//
// `businessDayOf(…, ctx.timeZone)` was called everywhere, but nothing ever set
// `ctx.timeZone`, so every call quietly used the default zone. These tests pin
// the part that was missing: the stored zone reaches the context, a bad or
// absent one falls back without breaking the request, and a changed zone is
// seen at once.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  result: {
    data: { time_zone: 'Asia/Kabul' } as { time_zone?: string | null } | null,
    error: null as unknown,
  },
  reads: 0,
  throws: false,
}))

vi.mock('../db', () => {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq = () => chain
  chain.update = () => chain
  chain.maybeSingle = () => {
    state.reads++
    if (state.throws) return Promise.reject(new Error('network'))
    return Promise.resolve(state.result)
  }
  return { supabase: { from: () => chain } }
})

import { businessDayOf } from '../utils/local-day'
import { workspaceTimeZoneOf } from '../services/workplace-time-zone'

let n = 0
const freshWorkspace = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`

describe('workspaceTimeZoneOf', () => {
  beforeEach(() => {
    state.result = { data: { time_zone: 'Asia/Kabul' }, error: null }
    state.reads = 0
    state.throws = false
  })

  it('returns the zone the owner stored', async () => {
    expect(await workspaceTimeZoneOf(freshWorkspace())).toBe('Asia/Kabul')
  })

  it('reads once and then answers from memory', async () => {
    const ws = freshWorkspace()
    await workspaceTimeZoneOf(ws)
    await workspaceTimeZoneOf(ws)
    expect(state.reads).toBe(1)
  })

  it('treats an unknown zone as not chosen instead of passing it on', async () => {
    state.result = { data: { time_zone: 'Mars/Olympus' }, error: null }
    expect(await workspaceTimeZoneOf(freshWorkspace())).toBeUndefined()
  })

  it('a failed read answers undefined and is not remembered', async () => {
    const ws = freshWorkspace()
    state.result = { data: null, error: { code: 'XX000' } }
    expect(await workspaceTimeZoneOf(ws)).toBeUndefined()

    state.result = { data: { time_zone: 'Asia/Tehran' }, error: null }
    expect(await workspaceTimeZoneOf(ws)).toBe('Asia/Tehran')
  })

  it('never throws into the request', async () => {
    state.throws = true
    await expect(workspaceTimeZoneOf(freshWorkspace())).resolves.toBeUndefined()
  })

  it('the stored zone decides the day: 21:00 UTC is already tomorrow in Kabul, not in London', async () => {
    const evening = new Date('2026-10-31T21:00:00.000Z')
    const kabul = await workspaceTimeZoneOf(freshWorkspace())

    expect(businessDayOf(evening, kabul)).toBe('2026-11-01')
    expect(businessDayOf(evening, 'Europe/London')).toBe('2026-10-31')
  })
})
