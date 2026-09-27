import { describe, expect, it } from 'vitest'

import type { QueueEntry } from '../contract'
import { createPushGate, referencedIds } from '../push-order'

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const entry = (
  clientId: string,
  entity: QueueEntry['entity'],
  operation: QueueEntry['operation'],
  payload: Record<string, unknown>,
): QueueEntry => ({
  clientId,
  entity,
  operation,
  payload,
  attempts: 0,
  status: 'pending',
  lastError: null,
  createdAt: '2026-09-27T00:00:00Z',
})

const customer = entry('m1', 'customer', 'create', { id: u(1), full_name: 'احمد' })
const invoice = entry('m2', 'invoice', 'create', {
  id: u(2),
  customerId: u(1),
  items: [{ productId: u(9), quantity: 1 }],
})
const payment = entry('m3', 'transaction', 'create', { id: u(3), invoice_id: u(2), amount: 500 })

describe('push order', () => {
  it('finds ids at any depth, whatever the field is called', () => {
    expect([...referencedIds(invoice.payload)].sort()).toEqual([u(1), u(2), u(9)].sort())
  })

  it('customer → invoice → payment: each waits for the one before, then goes', () => {
    const gate = createPushGate([customer, invoice, payment])
    expect(gate.blockedBy(customer)).toBeNull()
    expect(gate.blockedBy(invoice)).toBe(u(1))
    expect(gate.blockedBy(payment)).toBe(u(2))
    gate.markSent(customer)
    expect(gate.blockedBy(invoice)).toBeNull()
    expect(gate.blockedBy(payment)).toBe(u(2))
    gate.markSent(invoice)
    expect(gate.blockedBy(payment)).toBeNull()
  })

  it('⚠️ a failed customer create keeps its invoice WAITING, not failed', () => {
    const gate = createPushGate([customer, invoice])
    // the customer attempt fails → markSent is never called
    expect(gate.blockedBy(invoice)).toBe(u(1))
  })

  it('an update of a record whose create is still queued waits for it', () => {
    const rename = entry('m4', 'customer', 'update', { id: u(1), full_name: 'احمد کریمی' })
    const gate = createPushGate([customer, rename])
    expect(gate.blockedBy(rename)).toBe(u(1))
    gate.markSent(customer)
    expect(gate.blockedBy(rename)).toBeNull()
  })

  it('a reference to something that already exists on the server never blocks', () => {
    const gate = createPushGate([invoice])
    expect(gate.blockedBy(invoice)).toBeNull() // u(1) and u(9) are not queued creates
  })

  it('a create is never blocked by itself', () => {
    const gate = createPushGate([customer])
    expect(gate.blockedBy(customer)).toBeNull()
  })
})
