// ============================================
// Capability #68 — escalation of an approval nobody answered: the pass.
//
// The decision itself (`decideEscalation`) has its own tests. These cover what
// the service adds: which documents it reads, that a step is escalated ONCE and
// its people told once, that an empty role is reported rather than escalated
// into, and that an escalation belongs to the step it was made on.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const tables: Record<string, Row[]> = {}
let sequence = 0

function from(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let action: 'select' | 'insert' | 'update' = 'select'
  let payload: Row | null = null
  let limit: number | null = null
  let returning = false

  const rows = () => (tables[table] ??= [])
  const matching = () => rows().filter((row) => filters.every((f) => f(row)))

  const run = () => {
    if (action === 'insert') {
      const row: Row = { id: `id-${(sequence += 1)}`, created_at: `t${sequence}`, ...payload }
      if (
        table === 'workflow_escalations' &&
        rows().some(
          (r) =>
            r.instance_id === row.instance_id &&
            r.step_order === row.step_order &&
            r.to_role === row.to_role &&
            r.outcome === row.outcome,
        )
      ) {
        return { data: null, error: { code: '23505', message: 'duplicate' } }
      }
      rows().push(row)
      return { data: [row], error: null }
    }
    if (action === 'update') {
      const hit = matching()
      for (const row of hit) Object.assign(row, payload)
      return { data: hit, error: null }
    }
    const hit = matching()
    return { data: limit === null ? hit : hit.slice(0, limit), error: null }
  }

  const builder: Record<string, unknown> = {
    select: () => ((returning = true), builder),
    insert: (value: Row) => ((action = 'insert'), (payload = value), builder),
    update: (value: Row) => ((action = 'update'), (payload = value), builder),
    eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), builder),
    is: (column: string, value: unknown) => (
      filters.push((row) => (row[column] ?? null) === value),
      builder
    ),
    not: (column: string, _operator: string, value: unknown) => (
      filters.push((row) => (row[column] ?? null) !== value),
      builder
    ),
    order: () => builder,
    limit: (count: number) => ((limit = count), builder),
    maybeSingle: async () => {
      const result = run()
      return { data: (result.data as Row[] | null)?.[0] ?? null, error: result.error }
    },
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(run()).then((result) =>
        resolve(returning || action === 'select' ? result : { error: result.error }),
      ),
  }
  return builder
}

const { notify, logBusinessEvent } = vi.hoisted(() => ({
  notify: vi.fn(async (..._args: unknown[]) => ({ id: 'n' })),
  logBusinessEvent: vi.fn(async (..._args: unknown[]) => undefined),
}))

vi.mock('../db', () => ({ supabase: { from: (table: string) => from(table) } }))
vi.mock('../services/notification.service', () => ({
  NotificationService: class {
    create = notify
  },
}))
vi.mock('../services/event-log.service', () => ({
  logBusinessEvent: (...args: unknown[]) => logBusinessEvent(...args),
}))

import { EscalationService } from '../services/workflow/escalation.service'

const WS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WF = 'workflow-1'
const NOW = new Date('2026-10-04T12:00:00.000Z')
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString()

const ctx = (role = 'manager') => ({ workspaceId: WS, userId: 'u-manager', role }) as never

function seed(options: {
  policy?: { after: number | null; to: string | null; max?: number }
  stepRole?: string
  waitedHours?: number
  members?: Array<[string, string]>
  instance?: Row
}) {
  const policy = options.policy ?? { after: 24, to: 'manager' }
  tables.workflows = [
    {
      id: WF,
      workspace_id: WS,
      name: 'تأیید فاکتور بزرگ',
      is_active: true,
      escalate_after_hours: policy.after,
      escalate_to_role: policy.to,
      escalate_max_times: policy.max ?? 1,
    },
  ]
  tables.workflow_steps = [
    { workflow_id: WF, step_order: 1, approver_role: options.stepRole ?? 'seller' },
    { workflow_id: WF, step_order: 2, approver_role: 'manager' },
  ]
  tables.workflow_instances = [
    {
      id: 'inst-1',
      workflow_id: WF,
      workspace_id: WS,
      entity_type: 'invoice',
      entity_id: 'inv-1',
      status: 'in_progress',
      current_step: 1,
      started_at: hoursAgo(options.waitedHours ?? 30),
      updated_at: hoursAgo(options.waitedHours ?? 30),
      escalated_role: null,
      escalations: 0,
      escalated_step: null,
      ...options.instance,
    },
  ]
  tables.workspace_members = (
    options.members ?? [
      ['u-seller', 'seller'],
      ['u-manager', 'manager'],
      ['u-manager-2', 'manager'],
      ['u-owner', 'owner'],
    ]
  ).map(([user_id, role]) => ({
    workspace_id: WS,
    user_id,
    role,
    has_access: true,
    suspended_at: null,
  }))
  tables.workflow_escalations = []
}

const instance = () => tables.workflow_instances![0] as Row

let service: EscalationService

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  notify.mockClear()
  logBusinessEvent.mockClear()
  service = new EscalationService()
})

describe('the hourly pass', () => {
  it('a step past its policy gains the higher role, and everyone holding it is told', async () => {
    seed({})
    const totals = await service.runDue(NOW)

    expect(totals).toEqual({ checked: 1, escalated: 1, noOne: 0 })
    expect(instance()).toMatchObject({
      escalated_role: 'manager',
      escalated_step: 1,
      escalations: 1,
    })
    // The document's status and step are untouched: escalation decides nothing.
    expect(instance()).toMatchObject({ status: 'in_progress', current_step: 1 })
    expect(tables.workflow_escalations).toMatchObject([
      { outcome: 'escalated', from_role: 'seller', to_role: 'manager', step_order: 1 },
    ])
    expect(notify.mock.calls.map((call) => (call[1] as Row).user_id).sort()).toEqual([
      'u-manager',
      'u-manager-2',
    ])
  })

  it('does not move the «waiting since» of the step', async () => {
    seed({})
    const before = instance().updated_at
    await service.runDue(NOW)
    expect(instance().updated_at).toBe(before)
  })

  it('a step that has not waited long enough is left alone', async () => {
    seed({ waitedHours: 5 })
    const totals = await service.runDue(NOW)
    expect(totals.escalated).toBe(0)
    expect(instance().escalated_role).toBeNull()
    expect(notify).not.toHaveBeenCalled()
    expect(tables.workflow_escalations).toEqual([])
  })

  it('the next pass does not escalate or notify again', async () => {
    seed({})
    await service.runDue(NOW)
    const again = await service.runDue(new Date(NOW.getTime() + 3_600_000))
    expect(again.escalated).toBe(0)
    expect(instance().escalations).toBe(1)
    expect(notify).toHaveBeenCalledTimes(2)
    expect(tables.workflow_escalations).toHaveLength(1)
  })

  it('a pass that crashed after recording does not tell people twice on retry', async () => {
    seed({})
    await service.runDue(NOW)
    // As if the instance update had not landed.
    Object.assign(instance(), { escalated_role: null, escalated_step: null, escalations: 0 })
    notify.mockClear()
    const failures = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const retry = await service.runDue(NOW)
    expect(retry.escalated).toBe(0)
    expect(notify).not.toHaveBeenCalled()
    // …and it is a quiet no-op, not an error swallowed by the pass: «already
    // recorded» is the expected state of a retry.
    expect(failures).not.toHaveBeenCalled()
    failures.mockRestore()
  })

  it('never escalates into an empty role: reported once, owner told, document unchanged', async () => {
    seed({
      members: [
        ['u-seller', 'seller'],
        ['u-owner', 'owner'],
      ],
    })
    const first = await service.runDue(NOW)
    expect(first).toEqual({ checked: 1, escalated: 0, noOne: 1 })
    expect(instance().escalated_role).toBeNull()
    expect(tables.workflow_escalations).toMatchObject([{ outcome: 'no_one', to_role: 'manager' }])
    expect(notify.mock.calls.map((call) => (call[1] as Row).user_id)).toEqual(['u-owner'])

    notify.mockClear()
    const second = await service.runDue(NOW)
    expect(second.noOne).toBe(0)
    expect(notify).not.toHaveBeenCalled()
  })

  it('a member without access does not count as holding the role', async () => {
    seed({})
    for (const member of tables.workspace_members!) {
      if (member.role === 'manager') member.has_access = false
    }
    const totals = await service.runDue(NOW)
    expect(totals).toMatchObject({ escalated: 0, noOne: 1 })
  })

  it('a policy pointing at the step’s own role, or lower, never fires', async () => {
    seed({ stepRole: 'manager', policy: { after: 1, to: 'manager' } })
    expect((await service.runDue(NOW)).escalated).toBe(0)
    expect(tables.workflow_escalations).toEqual([])
  })

  it('a workflow with no policy is not read at all', async () => {
    seed({ policy: { after: null, to: null } })
    const totals = await service.runDue(NOW)
    expect(totals).toEqual({ checked: 0, escalated: 0, noOne: 0 })
  })

  it('a finished document is not escalated', async () => {
    seed({ instance: { status: 'approved' } })
    expect((await service.runDue(NOW)).checked).toBe(0)
  })

  it('an escalation made on an earlier step does not count against the next step', async () => {
    seed({
      policy: { after: 24, to: 'owner' },
      instance: { current_step: 2, escalated_role: 'manager', escalated_step: 1, escalations: 1 },
    })
    const totals = await service.runDue(NOW)
    expect(totals.escalated).toBe(1)
    expect(instance()).toMatchObject({ escalated_role: 'owner', escalated_step: 2, escalations: 1 })
  })
})

describe('who may act on an escalated step', () => {
  it('the escalated role, on the step it was escalated on', async () => {
    seed({ instance: { escalated_role: 'manager', escalated_step: 1 } })
    expect(await service.escalatedRoleFor(WS, 'inst-1', 1)).toBe('manager')
  })

  it('not on a later step, and not in another workspace', async () => {
    seed({ instance: { escalated_role: 'manager', escalated_step: 1 } })
    expect(await service.escalatedRoleFor(WS, 'inst-1', 2)).toBeNull()
    expect(
      await service.escalatedRoleFor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'inst-1', 1),
    ).toBeNull()
  })

  it('nobody extra when nothing was escalated', async () => {
    seed({})
    expect(await service.escalatedRoleFor(WS, 'inst-1', 1)).toBeNull()
  })
})

describe('the policy', () => {
  it('is off until set, and reads back what was saved', async () => {
    seed({ policy: { after: null, to: null } })
    expect(await service.getPolicy(ctx(), WF)).toEqual({
      afterHours: null,
      toRole: null,
      maxTimes: 1,
    })

    const saved = await service.setPolicy(ctx(), WF, {
      afterHours: 48,
      toRole: 'owner',
      maxTimes: 2,
    })
    expect(saved).toEqual({ afterHours: 48, toRole: 'owner', maxTimes: 2 })
  })

  it('half a policy is refused', async () => {
    seed({})
    await expect(
      service.setPolicy(ctx(), WF, { afterHours: 12, toRole: null, maxTimes: 1 }),
    ).rejects.toThrow('ESCALATION_ROLE_REQUIRED')
  })

  it('switching off clears both fields', async () => {
    seed({})
    await service.setPolicy(ctx(), WF, { afterHours: null, toRole: 'owner', maxTimes: 1 })
    expect(tables.workflows![0]).toMatchObject({
      escalate_after_hours: null,
      escalate_to_role: null,
    })
  })

  it('another workspace cannot read or set it', async () => {
    seed({})
    const stranger = {
      workspaceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      userId: 'x',
      role: 'owner',
    } as never
    await expect(service.getPolicy(stranger, WF)).rejects.toThrow('not found')
    await expect(
      service.setPolicy(stranger, WF, { afterHours: 1, toRole: 'owner', maxTimes: 1 }),
    ).rejects.toThrow('not found')
    expect(tables.workflows![0]).toMatchObject({ escalate_after_hours: 24 })
  })
})
