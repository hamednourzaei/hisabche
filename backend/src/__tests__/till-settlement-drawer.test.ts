// ============================================
// backend/src/__tests__/till-settlement-drawer.test.ts
//
// Invoice → Payment → Till, without a second entry.
//
// A cash payment recorded on an invoice is money in the drawer. It must be in
// the expected count (or the close reads «over» and the cashier re-enters it
// as a cash_in), and it must NOT be debited to cash again at close (the
// payment already posted its own entry).
// ============================================

import { describe, expect, it } from 'vitest'

import {
  buildDrawerLedger,
  buildPosting,
  expectedCashMinor,
  summarise,
  type CashMovement,
  type CashSettlement,
  type PosOrder,
  type PosSession,
} from '../services/pos/pos.domain'

const session = (over: Partial<PosSession> = {}): PosSession => ({
  id: 's1',
  status: 'open',
  openingFloatMinor: 1_000_000,
  openedAt: '2026-09-14T08:00:00.000Z',
  openedBy: 'u1',
  ...over,
})

const sale: PosOrder = {
  id: 'o1',
  orderRef: 'POS-1',
  totalMinor: 500_000,
  payments: [{ method: 'cash', amountMinor: 500_000 }],
  changeMinor: 0,
  status: 'completed',
  createdAt: '2026-09-14T09:00:00.000Z',
}

const out: CashMovement = {
  id: 'm1',
  kind: 'cash_out',
  amountMinor: 200_000,
  reason: 'کرایه',
  createdAt: '2026-09-14T10:00:00.000Z',
}

// Invoice INV-0052 for 18M; customer pays 10M cash at this drawer.
const invoicePayment: CashSettlement = {
  id: 'p1',
  paymentNumber: 'PMT-2026-000052',
  direction: 'in',
  amountMinor: 1_000_000_000,
  createdAt: '2026-09-14T10:32:00.000Z',
}
const supplierPaid: CashSettlement = {
  ...invoicePayment,
  id: 'p2',
  paymentNumber: 'PMT-2026-000053',
  direction: 'out',
  amountMinor: 400_000,
  createdAt: '2026-09-14T11:15:00.000Z',
}

describe('invoice cash payments are in the drawer', () => {
  it('expected = float + cash sales + movements + settlements', () => {
    expect(expectedCashMinor(session(), [sale], [out], [invoicePayment, supplierPaid])).toBe(
      1_000_000 + 500_000 - 200_000 + 1_000_000_000 - 400_000,
    )
  })

  it('a correct count after an invoice payment has zero variance (no duplicate cash_in needed)', () => {
    const expected = expectedCashMinor(session(), [sale], [], [invoicePayment])
    const totals = summarise(session({ countedCashMinor: expected }), [sale], [], [invoicePayment])
    expect(totals.varianceMinor).toBe(0)
    expect(totals.settlementsMinor).toBe(1_000_000_000)
  })

  it('without settlements (legacy callers) nothing changes', () => {
    expect(expectedCashMinor(session(), [sale], [out])).toBe(1_300_000)
  })
})

describe('the close does not book invoice cash twice', () => {
  it('cash debit excludes settlements; the entry still balances', () => {
    const settlements = [invoicePayment, supplierPaid]
    const expected = expectedCashMinor(session(), [sale], [out], settlements)
    const counted = expected - 5_000 // short by 50 AFN
    const closed = session({ countedCashMinor: counted })
    const totals = summarise(closed, [sale], [out], settlements)
    const posting = buildPosting(closed, totals)

    // Only the till's own cash: sales 500k − out 200k − short 5k.
    expect(posting.cashMinor).toBe(295_000)
    // Balance: cash + card + transfer + credit − variance(neg → debit) = revenue + movements
    const debits =
      posting.cashMinor + posting.cardMinor + posting.transferMinor + posting.creditMinor
    expect(debits - posting.varianceMinor).toBe(posting.revenueMinor + posting.movementsMinor)
  })
})

describe('drawer ledger', () => {
  it('the running balance ends exactly at expected cash', () => {
    const settlements = [invoicePayment, supplierPaid]
    const { entries, expectedCashMinor: end } = buildDrawerLedger(
      session(),
      [sale],
      [out],
      settlements,
    )
    expect(end).toBe(expectedCashMinor(session(), [sale], [out], settlements))
    expect(entries[0]?.kind).toBe('opening_float')
    expect(entries.map((e) => e.kind)).toEqual([
      'opening_float',
      'sale',
      'cash_out',
      'settlement_in',
      'settlement_out',
    ])
    expect(entries.find((e) => e.kind === 'settlement_in')?.reference).toBe('PMT-2026-000052')
    expect(entries.at(-1)?.balanceMinor).toBe(end)
  })

  it('a voided sale is not in the drawer', () => {
    const voided = { ...sale, status: 'voided' as const }
    expect(buildDrawerLedger(session(), [voided], [], []).expectedCashMinor).toBe(1_000_000)
  })
})

import { dailyCashFlow } from '../services/pos/pos.domain'

describe('daily cash flow', () => {
  it('every day present, split in/out, local Kabul day', () => {
    const rows = dailyCashFlow(
      [
        { at: '2026-09-13T20:00:00.000Z', amountMinor: 500 }, // 00:30 on the 14th in Kabul
        { at: '2026-09-14T06:00:00.000Z', amountMinor: -200 },
        { at: '2026-09-01T06:00:00.000Z', amountMinor: 999 }, // outside the window
      ],
      7,
      '2026-09-14',
      270,
    )
    expect(rows).toHaveLength(7)
    expect(rows[0]?.day).toBe('2026-09-08')
    expect(rows.at(-1)).toEqual({ day: '2026-09-14', inMinor: 500, outMinor: 200, netMinor: 300 })
    expect(rows.slice(0, 6).every((r) => r.netMinor === 0)).toBe(true)
  })
})

import { transfersNetMinor } from '../services/pos/pos.domain'

describe('till ↔ bank transfers', () => {
  const toBank: CashMovement = {
    id: 't1',
    kind: 'transfer_to_bank',
    amountMinor: 300_000,
    reason: 'واریز',
    createdAt: '2026-09-14T12:00:00.000Z',
  }
  const fromBank: CashMovement = {
    id: 't2',
    kind: 'transfer_from_bank',
    amountMinor: 100_000,
    reason: 'برداشت',
    createdAt: '2026-09-14T13:00:00.000Z',
  }

  it('are in expected cash', () => {
    expect(transfersNetMinor([toBank, fromBank])).toBe(-200_000)
    expect(expectedCashMinor(session(), [sale], [toBank, fromBank])).toBe(
      1_000_000 + 500_000 - 200_000,
    )
  })

  it('⚠️ are NOT booked again at close, and the close entry still balances', () => {
    const movements = [out, toBank, fromBank]
    const expected = expectedCashMinor(session(), [sale], movements)
    const closed = session({ countedCashMinor: expected })
    const totals = summarise(closed, [sale], movements)
    const posting = buildPosting(closed, totals)

    // movements (booked to purchase at close) are the ordinary cash_out only.
    expect(posting.movementsMinor).toBe(-200_000)
    // cash debit is the till's own cash: sales 500k − out 200k.
    expect(posting.cashMinor).toBe(300_000)
    const debits =
      posting.cashMinor + posting.cardMinor + posting.transferMinor + posting.creditMinor
    expect(debits - posting.varianceMinor).toBe(posting.revenueMinor + posting.movementsMinor)
  })

  it('appear in the drawer ledger with the right sign', () => {
    const { entries, expectedCashMinor: end } = buildDrawerLedger(
      session(),
      [],
      [toBank, fromBank],
      [],
    )
    expect(entries.find((e) => e.kind === 'transfer_to_bank')?.amountMinor).toBe(-300_000)
    expect(entries.find((e) => e.kind === 'transfer_from_bank')?.amountMinor).toBe(100_000)
    expect(end).toBe(800_000)
  })
})
