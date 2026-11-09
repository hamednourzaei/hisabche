// Owner, 18 Oct 2026: «سابقه تغییرات — شعبه نوشته نمی‌شود، خط فاصله است».
// Every business event reaches the audit trail through logBusinessEvent, and
// it never passed a branch. The branch is now read from the record itself.
//
// ⚠️ 8 Nov 2026: this fixture used to give `payments` an `invoice_id` column.
// The live table has none (FINDING-schema-drift-2026-11-08.sql), so in
// production every payment row read «—» while this test was green. A payment
// reaches its invoices through `payment_allocations` — the fixture now has the
// real shape.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const auditLog = vi.fn(async (_row: Record<string, unknown>) => undefined)

const ROWS: Record<string, Array<Record<string, unknown>>> = {
  invoices: [
    { id: 'inv-1', workspace_id: 'ws', branch_id: 'br-kabul' },
    { id: 'inv-2', workspace_id: 'ws', branch_id: 'br-kabul' },
    { id: 'inv-3', workspace_id: 'ws', branch_id: 'br-herat' },
  ],
  payments: [
    { id: 'pay-1', workspace_id: 'ws' },
    { id: 'pay-2', workspace_id: 'ws' },
    { id: 'pay-3', workspace_id: 'ws' },
  ],
  payment_allocations: [
    { workspace_id: 'ws', payment_id: 'pay-1', invoice_id: 'inv-1' },
    // One payment over two invoices of the SAME branch: that branch.
    { workspace_id: 'ws', payment_id: 'pay-2', invoice_id: 'inv-1' },
    { workspace_id: 'ws', payment_id: 'pay-2', invoice_id: 'inv-2' },
    // One payment over two branches: no single branch.
    { workspace_id: 'ws', payment_id: 'pay-3', invoice_id: 'inv-1' },
    { workspace_id: 'ws', payment_id: 'pay-3', invoice_id: 'inv-3' },
  ],
}

function query(table: string) {
  const filters: Array<(row: Record<string, unknown>) => boolean> = []
  const rows = () => (ROWS[table] ?? []).filter((row) => filters.every((f) => f(row)))
  const chain = {
    select: () => chain,
    eq: (column: string, value: unknown) => {
      filters.push((row) => row[column] === value)
      return chain
    },
    in: (column: string, values: unknown[]) => {
      filters.push((row) => values.includes(row[column]))
      return chain
    },
    is: () => chain,
    order: () => chain,
    maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: rows(), error: null }).then(resolve),
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

  it('a payment’s row carries the branch of the invoice it settles (through its allocation)', async () => {
    await event('payment', 'pay-1')
    expect(auditLog.mock.calls[0]?.[0]).toMatchObject({ branchId: 'br-kabul' })
  })

  it('a payment over several invoices of one branch carries that branch', async () => {
    await event('payment', 'pay-2')
    expect(auditLog.mock.calls[0]?.[0]).toMatchObject({ branchId: 'br-kabul' })
  })

  it('a payment across two branches has no single branch — null, never guessed', async () => {
    await event('payment', 'pay-3')
    expect(auditLog.mock.calls[0]?.[0]).toMatchObject({ branchId: null })
  })

  it('the payment is never read for an invoice_id column it does not have', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(
      join(__dirname, '..', 'services', 'event-log.service.ts'),
      'utf8',
    ).replace(/^[ \t]*\/\/.*\r?\n/gm, '')
    expect(src).not.toMatch(/from\('payments'\)\s*\.select\('invoice_id'\)/)
  })

  it('a customer has no branch — null, never guessed', async () => {
    await event('customer', 'c-1')
    expect(auditLog.mock.calls[0]?.[0]).toMatchObject({ branchId: null })
  })
})
