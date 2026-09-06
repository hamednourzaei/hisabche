// ============================================
// backend/src/__tests__/transfer-lifecycle.test.ts
//
// K2 — the four invariants the spec names, checked exhaustively.
//
//   • a transfer cannot be received twice
//   • a cancelled transfer cannot be received
//   • a shipped transfer must remain queryable
//   • a transfer must not silently disappear
//
// The lifecycle is a pure function, so «every state × every action» is a table
// this test can walk end to end. A mocked-database test could only prove a
// query was written.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  canTransition,
  isFullyReceived,
  isTerminal,
  movesStock,
  remainingQuantity,
  validateLines,
  type TransferAction,
  type TransferStatus,
} from '../services/warehouse/transfer.domain'

const ALL_STATUSES: TransferStatus[] = [
  'requested',
  'approved',
  'picking',
  'shipped',
  'in_transit',
  'received',
  'cancelled',
]

const ALL_ACTIONS: TransferAction[] = [
  'approve',
  'pick',
  'ship',
  'mark_in_transit',
  'receive',
  'cancel',
]

describe('a transfer cannot be received twice', () => {
  it('refuses receive on an already-received transfer', () => {
    expect(canTransition('received', 'receive')).toEqual({
      ok: false,
      code: 'TRANSFER_ALREADY_RECEIVED',
    })
  })

  it('refuses EVERY action once received', () => {
    // Not just receive. A received transfer that could still be cancelled
    // would let someone erase a completed movement.
    for (const action of ALL_ACTIONS) {
      expect(canTransition('received', action).ok).toBe(false)
    }
  })
})

describe('a cancelled transfer cannot be received', () => {
  it('refuses receive with the cancellation named', () => {
    expect(canTransition('cancelled', 'receive')).toEqual({
      ok: false,
      code: 'TRANSFER_CANCELLED',
    })
  })

  it('refuses every action once cancelled', () => {
    for (const action of ALL_ACTIONS) {
      expect(canTransition('cancelled', action).ok).toBe(false)
    }
  })
})

describe('cancellation is impossible once the stock has left', () => {
  it.each(['shipped', 'in_transit'] as TransferStatus[])('refuses cancel from %s', (status) => {
    // The goods are on a road. «Cancelled» would say they never moved, which
    // the stock movements would then contradict. The way back is to receive
    // and transfer back — which is what physically happens.
    const verdict = canTransition(status, 'cancel')
    expect(verdict.ok).toBe(false)
  })

  it.each(['requested', 'approved', 'picking'] as TransferStatus[])(
    'allows cancel from %s',
    (status) => {
      expect(canTransition(status, 'cancel')).toEqual({ ok: true, next: 'cancelled' })
    },
  )
})

describe('a shipped transfer stays queryable and receivable', () => {
  it('can be received from shipped or in_transit', () => {
    expect(canTransition('shipped', 'receive')).toEqual({ ok: true, next: 'received' })
    expect(canTransition('in_transit', 'receive')).toEqual({ ok: true, next: 'received' })
  })

  it('is not terminal — it is still in flight', () => {
    expect(isTerminal('shipped')).toBe(false)
    expect(isTerminal('in_transit')).toBe(false)
    expect(isTerminal('received')).toBe(true)
    expect(isTerminal('cancelled')).toBe(true)
  })
})

describe('a transfer must not silently disappear', () => {
  it('every non-terminal state has at least one way forward', () => {
    // A state with no exits is a document stuck forever with stock unaccounted
    // for at both ends. This is the check that catches it.
    for (const status of ALL_STATUSES) {
      if (isTerminal(status)) continue
      const exits = ALL_ACTIONS.filter((action) => canTransition(status, action).ok)
      expect(exits.length, `${status} has no way forward`).toBeGreaterThan(0)
    }
  })

  it('every non-terminal state can reach `received` or `cancelled`', () => {
    // Walk the graph. A state that can only move sideways would strand the
    // goods just as surely as one with no exits.
    for (const start of ALL_STATUSES) {
      const seen = new Set<TransferStatus>([start])
      const queue: TransferStatus[] = [start]
      let reachedTerminal = isTerminal(start)

      while (queue.length > 0 && !reachedTerminal) {
        const current = queue.shift()!
        for (const action of ALL_ACTIONS) {
          const verdict = canTransition(current, action)
          if (!verdict.ok || seen.has(verdict.next)) continue
          if (isTerminal(verdict.next)) {
            reachedTerminal = true
            break
          }
          seen.add(verdict.next)
          queue.push(verdict.next)
        }
      }

      expect(reachedTerminal, `${start} cannot reach a terminal state`).toBe(true)
    }
  })
})

describe('only shipping and receiving move stock', () => {
  it('ship leaves, receive arrives', () => {
    expect(movesStock('ship')).toBe('out')
    expect(movesStock('receive')).toBe('in')
  })

  it.each(['approve', 'pick', 'mark_in_transit', 'cancel'] as TransferAction[])(
    '%s moves nothing',
    (action) => {
      // Running the stock RPC on any of these would move the goods a second
      // time. `mark_in_transit` is the dangerous one: it FOLLOWS shipping and
      // reads like progress, but the stock already left.
      expect(movesStock(action)).toBeNull()
    },
  )
})

describe('what can be raised at all', () => {
  it('refuses an empty transfer', () => {
    expect(validateLines([])).toContain('TRANSFER_NO_LINES')
  })

  it('refuses a non-positive or non-finite quantity', () => {
    expect(validateLines([{ productId: 'p1', quantity: 0 }])).toContain(
      'TRANSFER_LINE_QUANTITY_INVALID',
    )
    expect(validateLines([{ productId: 'p1', quantity: -3 }])).toContain(
      'TRANSFER_LINE_QUANTITY_INVALID',
    )
    expect(validateLines([{ productId: 'p1', quantity: Number.NaN }])).toContain(
      'TRANSFER_LINE_QUANTITY_INVALID',
    )
  })

  it('refuses the same product twice', () => {
    // Summed instead, a partial receipt could be attributed to either line and
    // the document would stop being able to say what arrived.
    expect(
      validateLines([
        { productId: 'p1', quantity: 2 },
        { productId: 'p1', quantity: 3 },
      ]),
    ).toContain('TRANSFER_DUPLICATE_PRODUCT')
  })

  it('allows the same product in two DIFFERENT units', () => {
    // K0 — once L1 exists, «10 boxes» and «10 pieces» are two real lines.
    // Collapsing them here would silently drop one.
    expect(
      validateLines([
        { productId: 'p1', quantity: 2, unitId: 'box' },
        { productId: 'p1', quantity: 3, unitId: 'piece' },
      ]),
    ).toEqual([])
  })

  it('accepts a fractional quantity', () => {
    // Phase C widened quantity to numeric(18,4) for weighed goods. 2.5 kg must
    // survive validation.
    expect(validateLines([{ productId: 'p1', quantity: 2.5 }])).toEqual([])
  })
})

describe('what is still on the road', () => {
  it('an uncounted line is fully in transit, not zero', () => {
    // Reading a null `received` as «0 remaining» would make every unreceived
    // transfer vanish from the in-transit report.
    expect(remainingQuantity(10, null)).toBe(10)
    expect(remainingQuantity(10, undefined)).toBe(10)
  })

  it('a partial receipt leaves the remainder', () => {
    expect(remainingQuantity(10, 4)).toBe(6)
  })

  it('never reports a negative remainder', () => {
    // Receiving MORE than was sent is a real data problem, but it must not
    // make the in-transit total go down by the excess.
    expect(remainingQuantity(10, 12)).toBe(0)
  })

  it('is fully received only when every line is', () => {
    expect(isFullyReceived([{ quantity: 5, receivedQuantity: 5 }])).toBe(true)
    expect(
      isFullyReceived([
        { quantity: 5, receivedQuantity: 5 },
        { quantity: 2, receivedQuantity: 1 },
      ]),
    ).toBe(false)
    expect(isFullyReceived([{ quantity: 5, receivedQuantity: null }])).toBe(false)
  })

  it('an empty transfer is not "fully received"', () => {
    // `every` on an empty array is true. Without the explicit guard, a
    // transfer with no lines would report as complete.
    expect(isFullyReceived([])).toBe(false)
  })
})
