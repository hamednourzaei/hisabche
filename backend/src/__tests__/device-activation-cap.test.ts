// ============================================
// BUG-NEW-012: a device belongs to ONE workspace.
//
// The earlier version of this file only asserted that two methods exist, which
// stays green however the method behaves. These tests drive the real service
// against a scripted `devices` table and check what is written and where.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Step {
  data: unknown
  error: { code?: string; message?: string } | null
}

const state = vi.hoisted(() => ({
  steps: [] as Array<{ data: unknown; error: { code?: string; message?: string } | null }>,
  calls: [] as Array<{ method: string; args: unknown[] }>,
}))

vi.mock('../db', () => {
  const chain: Record<string, unknown> = {}
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      state.calls.push({ method, args })
      return chain
    }
  for (const method of ['select', 'eq', 'neq', 'update', 'insert', 'order', 'limit']) {
    chain[method] = record(method)
  }
  const next = () => Promise.resolve(state.steps.shift() ?? { data: null, error: null })
  chain.maybeSingle = next
  chain.single = next
  return { supabase: { from: () => chain } }
})

import { ConflictError } from '../errors/database.error'
import { offlineLicenseService } from '../services/offline-license.service'

const WS_A = '11111111-1111-4111-8111-111111111111'
const WS_B = '22222222-2222-4222-8222-222222222222'
const DEVICE = '33333333-3333-4333-8333-333333333333'

function script(...steps: Step[]) {
  state.steps = steps
  state.calls = []
}

const wrote = () => state.calls.some((c) => c.method === 'update' || c.method === 'insert')

describe('BUG-NEW-012: device activation never moves a device between workspaces', () => {
  beforeEach(() => script())

  it('refuses a device that another workspace already holds, and writes nothing', async () => {
    script({ data: { device_id: DEVICE, workspace_id: WS_B }, error: null })

    await expect(offlineLicenseService.activateDevice(WS_A, DEVICE)).rejects.toBeInstanceOf(
      ConflictError,
    )
    await expect(
      (async () => {
        script({ data: { device_id: DEVICE, workspace_id: WS_B }, error: null })
        await offlineLicenseService.activateDevice(WS_A, DEVICE)
      })(),
    ).rejects.toThrow('DEVICE_CLAIMED_BY_ANOTHER_WORKSPACE')
    expect(wrote()).toBe(false)
  })

  it('inserts a new device under the caller workspace', async () => {
    script(
      { data: null, error: null },
      { data: { device_id: DEVICE, workspace_id: WS_A }, error: null },
    )

    const device = await offlineLicenseService.activateDevice(WS_A, DEVICE, 'Till 1')

    expect(device.workspace_id).toBe(WS_A)
    const insert = state.calls.find((c) => c.method === 'insert')
    expect(insert?.args[0]).toMatchObject({
      device_id: DEVICE,
      workspace_id: WS_A,
      label: 'Till 1',
    })
  })

  it('re-activating its own device updates it, scoped by device AND workspace', async () => {
    script(
      {
        data: { device_id: DEVICE, workspace_id: WS_A, label: 'Old', activated_at: 'x' },
        error: null,
      },
      { data: { device_id: DEVICE, workspace_id: WS_A }, error: null },
    )

    await offlineLicenseService.activateDevice(WS_A, DEVICE)

    const eqs = state.calls.filter((c) => c.method === 'eq').map((c) => c.args.join('='))
    expect(eqs).toContain(`device_id=${DEVICE}`)
    expect(eqs).toContain(`workspace_id=${WS_A}`)
    expect(state.calls.some((c) => c.method === 'insert')).toBe(false)
  })

  it('answers a lost first-activation race as a conflict, not a database failure', async () => {
    script(
      { data: null, error: null },
      { data: null, error: { code: '23505', message: 'duplicate key' } },
    )

    await expect(offlineLicenseService.activateDevice(WS_A, DEVICE)).rejects.toBeInstanceOf(
      ConflictError,
    )
  })

  it('invents no seat cap: no device count is read and the activation goes through', async () => {
    script(
      { data: null, error: null },
      { data: { device_id: DEVICE, workspace_id: WS_A }, error: null },
    )

    await offlineLicenseService.activateDevice(WS_A, DEVICE)

    expect(state.calls.some((c) => c.method === 'neq')).toBe(false)
  })
})
