// ============================================
// Minor units → the MAJOR amount the ledger books, with the currency's own
// digits — never `/ 100`.
//
// The V61 audit (12 Nov 2026) found `amount_minor / 100` in three posting
// paths. AFN has NO minor unit, so in an Afghan book:
//   - an endorsed 5,000 AFN cheque paid the supplier 50 AFN;
//   - a 5,000 AFN accrual period booked 50;
//   - every depreciation entry booked 1/100 of itself (live since August).
// Each case below fails against `/ 100`. Fixtures use TWO currencies (AFN with
// 0 digits, USD with 2), because one currency hides exactly this bug.
// ============================================
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDatabase } from './helpers/fake-supabase'
import type { TenancyContext } from '../services/tenancy.service'

const holder: { db: FakeDatabase } = { db: new FakeDatabase() }
const recordPayment = vi.fn()
const cancelPayment = vi.fn()
const postDocument = vi.fn()
const reverseJournalEntry = vi.fn()
const book = { currency: 'AFN' }

vi.mock('../db', () => ({
  supabase: { from: (table: string) => holder.db.from(table) },
}))
vi.mock('../services/payments/payments.service', () => ({
  PaymentsService: class {
    recordPayment = recordPayment
    cancelPayment = cancelPayment
  },
}))
vi.mock('../services/accounting', () => ({
  ledger: { postDocument, reverseJournalEntry },
}))
vi.mock('../services/accounting/index', () => ({
  ledger: { postDocument, reverseJournalEntry },
}))
vi.mock('../services/base-currency', () => ({
  baseCurrencyOf: async () => book.currency,
}))

const { ChequesService } = await import('../services/payments/cheques.service')
const { AccrualSchedulesService } = await import('../services/accounting/accrual-schedules.service')
const { AssetsService } = await import('../services/assets/assets.service')

const WS = '11111111-1111-4111-8111-111111111111'
const ctx: TenancyContext = {
  workspaceId: WS,
  userId: '22222222-2222-4222-8222-222222222222',
  role: 'owner',
  timeZone: 'Asia/Kabul',
}
const SUPPLIER = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  holder.db = new FakeDatabase()
  recordPayment.mockReset().mockResolvedValue({ id: 'pay-1' })
  cancelPayment.mockReset().mockResolvedValue({})
  postDocument
    .mockReset()
    .mockResolvedValue({ status: 'posted', entryId: 'je-1', entryNumber: 'JE-1' })
  reverseJournalEntry.mockReset()
  book.currency = 'AFN'
})

function seedCheque(amountMinor: number, currency: string) {
  holder.db.seed('cheques', [
    {
      id: 'chq-1',
      workspace_id: WS,
      direction: 'in',
      status: 'received',
      cheque_number: 'C-100',
      amount_minor: amountMinor,
      currency,
      payment_id: null,
      endorsed_payment_id: null,
      endorsed_to_supplier_id: null,
      note: null,
    },
  ])
}

describe('cheque endorsement pays the supplier the FULL amount', () => {
  it('AFN (0 digits): 5,000 minor → a 5,000 AFN payment, not 50', async () => {
    seedCheque(5_000, 'AFN')
    await new ChequesService().transition(ctx, 'chq-1', {
      status: 'endorsed',
      endorsed_to_supplier_id: SUPPLIER,
    })
    const [, input, options] = recordPayment.mock.calls[0]!
    expect(input.amount).toBe(5_000)
    // One endorsement = one payment, even on retry.
    expect(options).toEqual({ clientRequestId: 'cheque-endorse-chq-1' })
  })

  it('USD (2 digits): 12,345 minor → 123.45', async () => {
    seedCheque(12_345, 'USD')
    await new ChequesService().transition(ctx, 'chq-1', {
      status: 'endorsed',
      endorsed_to_supplier_id: SUPPLIER,
    })
    expect(recordPayment.mock.calls[0]![1].amount).toBe(123.45)
  })

  it('books on the business day, not the UTC date', async () => {
    seedCheque(5_000, 'AFN')
    await new ChequesService().transition(ctx, 'chq-1', {
      status: 'endorsed',
      endorsed_to_supplier_id: SUPPLIER,
    })
    expect(recordPayment.mock.calls[0]![1].entryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('accrual periods book the full amount in the book currency', () => {
  function seedPeriod(amountMinor: number, currency: string) {
    holder.db.seed('accrual_schedule_periods', [
      {
        id: 'per-1',
        workspace_id: WS,
        schedule_id: 'sch-1',
        period_index: 1,
        period_date: '2026-11-01',
        amount_minor: amountMinor,
        status: 'pending',
        accrual_schedules: {
          id: 'sch-1',
          description: 'Prepaid rent',
          debit_account_id: 'acc-expense',
          credit_account_id: 'acc-prepaid',
          status: 'active',
          currency,
        },
      },
    ])
    holder.db.seed('journal_entries', [])
  }

  it('AFN: 5,000 minor → 5,000 on each side of the entry', async () => {
    seedPeriod(5_000, 'AFN')
    await new AccrualSchedulesService().runDue(ctx, '2026-11-30')
    const lines = postDocument.mock.calls[0]![1].lines
    expect(lines).toEqual([
      { accountId: 'acc-expense', debit: 5_000, credit: 0 },
      { accountId: 'acc-prepaid', debit: 0, credit: 5_000 },
    ])
  })

  it('a schedule in a currency other than the book currency is refused', async () => {
    await expect(
      new AccrualSchedulesService().create(ctx, {
        source_document_type: 'invoice',
        source_document_id: '44444444-4444-4444-8444-444444444444',
        description: 'Prepaid',
        total_amount_minor: 120_000,
        currency: 'USD',
        periods_count: 12,
        start_date: '2026-11-01',
        debit_account_id: 'a',
        credit_account_id: 'b',
      }),
    ).rejects.toThrow('ACCRUAL_CURRENCY_MUST_BE_BOOK')
  })
})

describe('depreciation books the full amount of the book currency', () => {
  function seedDepreciation(amountMinor: number) {
    holder.db.seed('asset_depreciation_schedule', [
      {
        id: 'dep-1',
        workspace_id: WS,
        asset_id: 'asset-1',
        period: 1,
        on_date: '2026-11-01',
        amount_minor: amountMinor,
        accumulated_minor: amountMinor,
        book_value_minor: 0,
        posted_at: null,
        cancelled_at: null,
        asset: {
          expense_account_id: 'acc-dep-expense',
          accumulated_account_id: 'acc-accumulated',
          name: 'Generator',
        },
      },
    ])
  }

  it('AFN book: 25,000 minor → 25,000, not 250', async () => {
    seedDepreciation(25_000)
    await new AssetsService().postDue(ctx, '2026-11-30')
    expect(postDocument.mock.calls[0]![1].lines[0].debit).toBe(25_000)
  })

  it('USD book: 25,000 minor → 250.00', async () => {
    book.currency = 'USD'
    seedDepreciation(25_000)
    await new AssetsService().postDue(ctx, '2026-11-30')
    expect(postDocument.mock.calls[0]![1].lines[0].debit).toBe(250)
  })
})
