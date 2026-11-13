// V60 Slice 9 audit (12 Nov 2026): the contracts service, not just its rules.
//
// Lease return wrote serial statuses the database refuses (`quarantined`, `available`) and
// dropped the error, so a return «succeeded» and the serial never moved. Termination and
// billing dropped their write errors too, and the deposit was logged as «held as liability»
// with nothing posted to the books.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Result = { data: unknown; error: { message: string; code?: string } | null }
const writes: Array<{ table: string; op: 'update' | 'insert'; values: unknown }> = []
let answers: Record<string, Result> = {}

function builder(table: string) {
  let op = 'select'
  const chain = {
    select: () => chain,
    update: (values: unknown) => {
      op = 'update'
      writes.push({ table, op: 'update', values })
      return chain
    },
    insert: (values: unknown) => {
      op = 'insert'
      writes.push({ table, op: 'insert', values })
      return chain
    },
    eq: () => chain,
    maybeSingle: () => Promise.resolve(answers[`${table}:${op}`] ?? { data: null, error: null }),
    single: () => Promise.resolve(answers[`${table}:${op}`] ?? { data: null, error: null }),
    then: (resolve: (r: Result) => unknown) =>
      Promise.resolve(answers[`${table}:${op}`] ?? { data: null, error: null }).then(resolve),
  }
  return chain
}

vi.mock('../db', () => ({ supabase: { from: (table: string) => builder(table) } }))
const logged: Array<{ action: string; title: string }> = []
vi.mock('../services/event-log.service', () => ({
  logBusinessEvent: (event: { action: string; title: string }) => {
    logged.push(event)
    return Promise.resolve()
  },
}))
vi.mock('../services/base-currency', () => ({ baseCurrencyOf: () => Promise.resolve('AFN') }))
vi.mock('../services/salon/salon.service', () => ({
  SalonService: class {
    releaseResourceBooking() {
      return Promise.resolve()
    }
  },
}))
vi.mock('../services/invoice.service', () => ({ InvoiceService: class {} }))
vi.mock('../utils/money-cache', () => ({ invalidateMoneyCaches: () => Promise.resolve() }))

const { ContractsService, leaseReturnSerialStatus } =
  await import('../services/contracts/contracts.service')
const ctx = { workspaceId: 'ws-1', userId: 'u-1', role: 'owner' } as never
const contract = {
  id: 'c-1',
  workspace_id: 'ws-1',
  serial_id: 's-1',
  resource_booking_id: null,
  status: 'active',
}

beforeEach(() => {
  writes.length = 0
  logged.length = 0
  answers = {}
})

describe('lease return', () => {
  it('writes only statuses stock_serials_status_check allows', () => {
    const sql = readFileSync(
      join(__dirname, '..', '..', '..', 'docs', 'retail-ops-01-migration.sql'),
      'utf8',
    )
    const allowed = /CHECK \(status IN \(([^)]*)\)\)/.exec(sql)?.[1] ?? ''
    for (const bucket of ['sellable_stock', 'quarantine', 'scrap'] as const) {
      expect(allowed).toContain(`'${leaseReturnSerialStatus(bucket)}'`)
    }
  })

  it('a damaged rental goes to quarantine («returned»), never to scrap by itself', async () => {
    answers['contracts:select'] = { data: contract, error: null }
    const result = await new ContractsService().returnLeaseAsset(ctx, 'c-1', {
      conditionCode: 'damaged',
    })
    expect(result.disposition.bucket).toBe('quarantine')
    expect(writes).toEqual([
      { table: 'stock_serials', op: 'update', values: { status: 'returned' } },
    ])
  })

  it('a refused serial write is an error, not a quiet success', async () => {
    answers['contracts:select'] = { data: contract, error: null }
    answers['stock_serials:update'] = { data: null, error: { message: 'check violation' } }
    await expect(
      new ContractsService().returnLeaseAsset(ctx, 'c-1', { conditionCode: 'sealed' }),
    ).rejects.toThrow('Failed to update the returned serial')
  })
})

describe('termination', () => {
  it('fails when the pending obligations could not be cancelled', async () => {
    answers['contracts:update'] = { data: { ...contract, status: 'terminated' }, error: null }
    answers['contract_obligations:update'] = { data: null, error: { message: 'boom' } }
    await expect(new ContractsService().terminateContract(ctx, 'c-1')).rejects.toThrow(
      'Failed to cancel pending obligations',
    )
  })
})

describe('billing a period', () => {
  it('a failed read of the period is an error, not «not billed yet»', async () => {
    answers['contracts:select'] = { data: contract, error: null }
    answers['contract_obligations:select'] = { data: null, error: { message: 'timeout' } }
    await expect(
      new ContractsService().billPeriod(ctx, 'c-1', {
        periodKey: '2026-11',
        dueDate: '2026-11-30',
      }),
    ).rejects.toThrow('Failed to read the billing period')
    expect(writes).toEqual([])
  })
})

describe('the deposit', () => {
  it('is said to be recorded on the contract — nothing claims a ledger liability', () => {
    const source = readFileSync(
      join(__dirname, '..', 'services', 'contracts', 'contracts.service.ts'),
      'utf8',
    )
    expect(source).not.toContain('contract_deposit_liability_recorded')
    expect(source).not.toContain('held as liability for')
    expect(source).toContain("action: 'contract_deposit_recorded'")
  })
})
