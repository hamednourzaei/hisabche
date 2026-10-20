// Owner, 18 Oct 2026: «سابقه تغییرات — شعبه نوشته نمی‌شود، خط فاصله است».
// Every business event reaches the audit trail through logBusinessEvent, and
// it never passed a branch. The branch is now read from the record itself.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const auditLog = vi.fn(async (_row: Record<string, unknown>) => undefined)

const ROWS: Record<string, Array<Record<string, unknown>>> = {
  invoices: [{ id: 'inv-1', workspace_id: 'ws', branch_id: 'br-kabul' }],
  payments: [{ id: 'pay-1', workspace_id: 'ws', invoice_id: 'inv-1' }],
}

function query(table: string) {
  const filters: Array<[string, unknown]> = []
  const chain = {
    select: () => chain,
    eq: (column: string, value: unknown) => {
      filters.push([column, value])
      return chain
    },
    is: () => chain,
    order: () => chain,
    in: () => chain,
    maybeSingle: async () => ({
      data: (ROWS[table] ?? []).find((row) => filters.every(([c, v]) => row[c] === v)) ?? null,
      error: null,
    }),
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
  }
  return chain
}

vi.mock('../db', () => ({ supabase: { from: (table: string) => query(table) } }))
vi.mock('../services/audit.service', () => ({
  AuditService: class {
    log = auditLog
  },
}))
vi.mock('../services/activity.service', () => ({
  ActivityService: class {
    createActivity = async () => undefined
  },
}))

const { logBusinessEvent } = await import('../services/event-log.service')

const event = (entityType: string, entityId: string) =>
  logBusinessEvent({
    userId: 'u1',
    workspaceId: 'ws',
    entityType,
    entityId,
    action: 'created',
    title: 'x',
    notify: false,
  })

describe('the branch on an audit row', () => {
  beforeEach(() => auditLog.mockClear())

  it('an invoice’s row carries the invoice’s branch', async () => {
    await event('invoice', 'inv-1')
    expect(auditLog.mock.calls[0]?.[0]).toMatchObject({ branchId: 'br-kabul' })
  })

  it('a payment’s row carries the branch of the invoice it settles', async () => {
    await event('payment', 'pay-1')
    expect(auditLog.mock.calls[0]?.[0]).toMatchObject({ branchId: 'br-kabul' })
  })

  it('a customer has no branch — null, never guessed', async () => {
    await event('customer', 'c-1')
    expect(auditLog.mock.calls[0]?.[0]).toMatchObject({ branchId: null })
  })
})
