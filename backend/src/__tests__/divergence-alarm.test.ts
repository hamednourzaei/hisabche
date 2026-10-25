// ============================================
// backend/src/__tests__/divergence-alarm.test.ts
//
// The alarm that now reads `core_divergence`: does it fire on a real divergence
// rate, stay quiet otherwise, respect its boundary, and never let a failed
// notification break anything?
//
// ⚠️ WHAT THIS FILE IS CAREFUL ABOUT.
//
// · `vi.mock` is resolved relative to THIS file, so the paths are `../services/…`
//   and `../workers/…`, not `../../`.
// · The notification double is a PLAIN OBJECT implementing `create`, not a
//   spread of the class (spreading a class drops its methods — the trap that
//   made ten `core-shadow` tests fail).
// · No `%TEMP%`, no Postgres: everything the worker reads is mocked, and the
//   RULE itself is tested against the real `@hisabche/validation` functions, not
//   against a mock of them.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── what the worker reads ───────────────────────────────────────────────────
const state = {
  divergences: [] as { capability: string; detected_at: string; workspace_id: string }[],
  paymentsCount: 0,
  owners: [] as { user_id: string }[],
  thresholdColumn: null as number | null,
  thresholdError: null as { code?: string; message: string } | null,
  readError: null as { message: string } | null,
  notifications: [] as { workspaceId: string; input: Record<string, unknown> }[],
  notificationThrows: false,
}

vi.mock('../db', () => {
  const makeQuery = (table: string) => {
    const query: Record<string, unknown> = {}
    const chain = () => query
    for (const method of ['select', 'gte', 'lt', 'eq', 'is', 'order', 'limit']) {
      query[method] = chain
    }
    // The worker and the alarm service PAGE now (`selectAllPages` → `.range`),
    // because PostgREST truncates at max-rows without saying so. The fake serves
    // the whole fixture in ONE page and reports `count` so the pager stops.
    query.range = () => {
      if (table === 'core_divergence') {
        if (state.readError)
          return Promise.resolve({ data: null, error: state.readError, count: null })
        return Promise.resolve({
          data: state.divergences,
          error: null,
          count: state.divergences.length,
        })
      }
      return Promise.resolve({ data: [], error: null, count: 0 })
    }
    query.maybeSingle = async () => ({
      data: table === 'workspaces' ? { divergence_alarm_percent: state.thresholdColumn } : null,
      error: state.thresholdError,
    })
    // The terminal awaits: supabase returns a thenable builder, so make the
    // builder itself awaitable and resolve by table.
    query.then = (resolve: (value: unknown) => unknown) => {
      if (table === 'core_divergence') {
        if (state.readError) return resolve({ data: null, error: state.readError })
        return resolve({ data: state.divergences, error: null })
      }
      if (table === 'payments') {
        return resolve({ count: state.paymentsCount, error: null })
      }
      if (table === 'workspace_members') {
        return resolve({ data: state.owners, error: null })
      }
      if (table === 'workspaces') {
        return resolve({
          data: { divergence_alarm_percent: state.thresholdColumn },
          error: state.thresholdError,
        })
      }
      return resolve({ data: [], error: null })
    }
    return query
  }
  return { supabase: { from: (table: string) => makeQuery(table) } }
})

vi.mock('../services/notification.service', () => ({
  NotificationService: class {
    async create(workspaceId: string, input: Record<string, unknown>) {
      if (state.notificationThrows) throw new Error('notification backend down')
      state.notifications.push({ workspaceId, input })
      return { id: 'n1' }
    }
  },
}))

const { runDivergenceAlarm } = await import('../workers/divergence-alarm.worker')

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const NOW = new Date('2026-10-25T12:00:00.000Z')

function divergences(count: number, capability = 'payment.record') {
  return Array.from({ length: count }, (_, i) => ({
    capability,
    detected_at: `2026-10-25T11:${String(i % 60).padStart(2, '0')}:00.000Z`,
    workspace_id: WS,
  }))
}

beforeEach(() => {
  state.divergences = []
  state.paymentsCount = 0
  state.owners = [{ user_id: '11111111-1111-4111-8111-111111111111' }]
  state.thresholdColumn = null
  state.thresholdError = null
  state.readError = null
  state.notifications = []
  state.notificationThrows = false
})

describe('the divergence alarm reads, judges, and notifies', () => {
  it('says plainly when nothing diverged', async () => {
    const result = await runDivergenceAlarm(NOW)
    expect(result.firing).toEqual([])
    expect(result.message).toContain('No divergences')
    expect(state.notifications).toHaveLength(0)
  })

  it('with the shipped default (off) it reports the rate but fires nothing', async () => {
    state.divergences = divergences(30)
    state.paymentsCount = 100

    const result = await runDivergenceAlarm(NOW)

    expect(result.firing).toEqual([])
    expect(state.notifications).toHaveLength(0)
    // The window is still measured — off is not «unmeasured».
    expect(result.judged).toHaveLength(1)
    expect(result.judged[0]?.code).toBe('ALARM_OFF')
    expect(result.judged[0]?.ratePercent).toBe(30)
  })

  it('⚠️ fires when the rate crosses the limit', async () => {
    state.thresholdColumn = 5
    state.divergences = divergences(30)
    state.paymentsCount = 100

    const result = await runDivergenceAlarm(NOW)

    expect(result.firing).toEqual(['payment.record'])
    expect(state.notifications).toHaveLength(1)
    expect(state.notifications[0]?.workspaceId).toBe(WS)
    expect(String(state.notifications[0]?.input.title)).toContain('واگرایی')
    expect(String(state.notifications[0]?.input.body)).toContain('payment.record')
  })

  it('⚠️ exactly on the boundary does NOT fire (strictly greater than)', async () => {
    state.thresholdColumn = 5
    state.divergences = divergences(5)
    state.paymentsCount = 100

    const result = await runDivergenceAlarm(NOW)

    expect(result.judged[0]?.ratePercent).toBe(5)
    expect(result.firing).toEqual([])
    expect(state.notifications).toHaveLength(0)
  })

  it('one comparison over the boundary fires', async () => {
    state.thresholdColumn = 5
    state.divergences = divergences(6)
    state.paymentsCount = 100

    const result = await runDivergenceAlarm(NOW)
    expect(result.firing).toEqual(['payment.record'])
  })

  it('a window too small to carry a rate does not fire', async () => {
    state.thresholdColumn = 5
    state.divergences = divergences(1)
    state.paymentsCount = 2

    const result = await runDivergenceAlarm(NOW)
    expect(result.firing).toEqual([])
  })

  it('a notification failure is reported and cannot break the pass', async () => {
    state.thresholdColumn = 5
    state.divergences = divergences(30)
    state.paymentsCount = 100
    state.notificationThrows = true

    const result = await runDivergenceAlarm(NOW)

    // The judgement still happened; only delivery failed, and it says so.
    expect(result.firing).toEqual(['payment.record'])
    expect(result.notified).toBe(0)
    expect(result.errors.some((e) => e.stage.startsWith('notify'))).toBe(true)
  })

  it('a failed read is a failed read, not «no divergence»', async () => {
    state.readError = { message: 'connection reset' }

    const result = await runDivergenceAlarm(NOW)

    expect(result.errors.some((e) => e.stage.startsWith('read'))).toBe(true)
    expect(result.message).not.toContain('No divergences')
  })

  it('a missing threshold column falls back to the shipped default (off)', async () => {
    state.thresholdError = { code: '42703', message: 'column does not exist' }
    state.divergences = divergences(30)
    state.paymentsCount = 100

    const result = await runDivergenceAlarm(NOW)

    expect(result.firing).toEqual([])
    expect(result.judged[0]?.code).toBe('ALARM_OFF')
    expect(result.errors).toEqual([])
  })
})
