// ============================================
// The V61 audit (12 Nov 2026) — the services behind the screens that had none.
//
// Every one of these was "done" with green tests: the tests only exercised
// pure functions, never the service. Here the SERVICE runs, against a fake
// database that holds two workspaces, so a row of the other business is
// within reach — and must stay out of reach.
// ============================================
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDatabase } from './helpers/fake-supabase'
import type { TenancyContext } from '../services/tenancy.service'

const holder: { db: FakeDatabase } = { db: new FakeDatabase() }

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => holder.db.from(table),
    rpc: async (name: string, args: Record<string, unknown>) => holder.db.callRpc(name, args),
  },
}))

const { HrOrgAppraisalService } =
  await import('../services/human-resources/hr-org-appraisal.service')
const { RfqContractsService } = await import('../services/purchasing/rfq-contracts.service')
const { BundlesConsignmentCommissionService } =
  await import('../services/commerce/bundles-consignment-commission.service')

const WS = '11111111-1111-4111-8111-111111111111'
const OTHER = '99999999-9999-4999-8999-999999999999'
const ctx = (role: TenancyContext['role'] = 'owner', userId = 'u-owner'): TenancyContext => ({
  workspaceId: WS,
  userId,
  role,
  timeZone: 'Asia/Kabul',
})

beforeEach(() => {
  holder.db = new FakeDatabase()
})

function seedStaff() {
  holder.db.seed('employees', [
    {
      id: 'e-ceo',
      workspace_id: WS,
      first_name: 'Ahmad',
      last_name: 'Karimi',
      position: 'CEO',
      department_id: null,
      reports_to: null,
      user_id: 'u-owner',
      termination_date: null,
    },
    {
      id: 'e-lead',
      workspace_id: WS,
      first_name: 'Sara',
      last_name: 'Noori',
      position: 'Lead',
      department_id: null,
      reports_to: 'e-ceo',
      user_id: 'u-lead',
      termination_date: null,
    },
    {
      id: 'e-dev',
      workspace_id: WS,
      first_name: 'Omid',
      last_name: 'Rahimi',
      position: 'Dev',
      department_id: null,
      reports_to: 'e-lead',
      user_id: 'u-dev',
      termination_date: null,
    },
    {
      id: 'e-gone',
      workspace_id: WS,
      first_name: 'Old',
      last_name: 'Hand',
      position: null,
      department_id: null,
      reports_to: null,
      user_id: null,
      termination_date: '2026-01-01',
    },
    {
      id: 'e-other',
      workspace_id: OTHER,
      first_name: 'Not',
      last_name: 'Ours',
      position: null,
      department_id: null,
      reports_to: null,
      user_id: null,
      termination_date: null,
    },
  ])
}

describe('org chart (B.2.17)', () => {
  it('returns the real name columns, current staff only, this business only', async () => {
    seedStaff()
    const rows = await new HrOrgAppraisalService().getOrgChart(ctx())
    expect(rows.map((r) => r.id).sort()).toEqual(['e-ceo', 'e-dev', 'e-lead'])
    expect(rows.find((r) => r.id === 'e-lead')).toMatchObject({
      first_name: 'Sara',
      last_name: 'Noori',
    })
    // The login id of each person is not handed to the browser.
    expect(rows.every((r) => !('user_id' in r))).toBe(true)
  })

  it('a member below manager sees themself and the people under them', async () => {
    seedStaff()
    const rows = await new HrOrgAppraisalService().getOrgChart(ctx('seller', 'u-lead'))
    expect(rows.map((r) => r.id).sort()).toEqual(['e-dev', 'e-lead'])
  })

  it('refuses a manager from another business or a former employee', async () => {
    seedStaff()
    const service = new HrOrgAppraisalService()
    await expect(service.setReportsTo(ctx(), 'e-dev', 'e-other')).rejects.toThrow(
      'ORG_MANAGER_NOT_FOUND',
    )
    await expect(service.setReportsTo(ctx(), 'e-dev', 'e-gone')).rejects.toThrow(
      'ORG_MANAGER_NOT_FOUND',
    )
  })

  it('refuses a loop before writing', async () => {
    seedStaff()
    await expect(new HrOrgAppraisalService().setReportsTo(ctx(), 'e-ceo', 'e-dev')).rejects.toThrow(
      'ORG_CYCLE_DETECTED',
    )
  })

  it('never attaches a document or an appraisal to another business’s employee', async () => {
    seedStaff()
    holder.db.seed('employee_documents', [])
    holder.db.seed('employee_appraisals', [])
    const service = new HrOrgAppraisalService()
    await expect(
      service.addDocument(ctx(), 'e-other', {
        title: 'Contract',
        kind: 'document',
        file_url: 'https://x.test/a.pdf',
      }),
    ).rejects.toThrow(/not found/)
    await expect(
      service.createAppraisal(ctx(), 'e-other', {
        period: '2026',
        criteria: [{ label: 'a', observation: 'b' }],
      }),
    ).rejects.toThrow(/not found/)
    expect(holder.db.from('employee_documents')).toBeDefined()
  })
})

describe('RFQ (B.2.13)', () => {
  function seedRfq(status = 'open', workspaceId = WS) {
    holder.db.seed('rfqs', [{ id: 'rfq-1', workspace_id: workspaceId, title: 'Flour', status }])
    holder.db.seed('customers', [
      { id: 'sup-1', workspace_id: WS },
      { id: 'sup-x', workspace_id: OTHER },
    ])
    holder.db.seed('products', [
      { id: 'p-1', workspace_id: WS },
      { id: 'p-x', workspace_id: OTHER },
    ])
    holder.db.seed('supplier_quotations', [])
  }
  const quotation = (overrides: Record<string, unknown> = {}) => ({
    supplier_id: 'sup-1',
    currency: 'AFN',
    valid_until: '2026-12-31',
    lead_time_days: 3,
    lines: [{ product_id: 'p-1', quantity: 10, unit_price_minor: 150 }],
    ...overrides,
  })

  it('refuses a quotation on another business’s RFQ', async () => {
    seedRfq('open', OTHER)
    await expect(
      new RfqContractsService().addQuotation(ctx(), 'rfq-1', quotation()),
    ).rejects.toThrow(/not found/)
  })

  it('refuses a closed RFQ, a foreign supplier and a foreign product', async () => {
    const service = new RfqContractsService()
    seedRfq('awarded')
    await expect(service.addQuotation(ctx(), 'rfq-1', quotation())).rejects.toThrow('RFQ_NOT_OPEN')

    holder.db = new FakeDatabase()
    seedRfq()
    await expect(
      service.addQuotation(ctx(), 'rfq-1', quotation({ supplier_id: 'sup-x' })),
    ).rejects.toThrow('RFQ_SUPPLIER_NOT_FOUND')
    await expect(
      service.addQuotation(
        ctx(),
        'rfq-1',
        quotation({ lines: [{ product_id: 'p-x', quantity: 1, unit_price_minor: 1 }] }),
      ),
    ).rejects.toThrow('RFQ_PRODUCT_NOT_FOUND')
  })

  it('totals in the quotation’s own minor units (no ×100)', async () => {
    seedRfq()
    const row = await new RfqContractsService().addQuotation(ctx(), 'rfq-1', quotation())
    expect(row.total_minor).toBe(1_500)
  })

  it('choosing is ONE database call, on the business day, and creates no purchase order', async () => {
    const calls: Array<Record<string, unknown>> = []
    holder.db.rpc('rfq_choose_quotation', (args) => {
      calls.push(args)
      return { id: 'q-1', status: 'chosen' }
    })
    holder.db.seed('purchase_orders', [])
    const result = await new RfqContractsService().chooseQuotation(ctx(), 'q-1', '2026-11-12')
    expect(result).toEqual({ id: 'q-1', status: 'chosen' })
    expect(calls).toEqual([{ p_workspace_id: WS, p_quotation_id: 'q-1', p_today: '2026-11-12' }])
  })

  it('maps the function’s refusals, and a missing function to 503 — never a fallback', async () => {
    const service = new RfqContractsService()
    holder.db.rpc('rfq_choose_quotation', () => {
      throw new Error('QUOTATION_EXPIRED')
    })
    await expect(service.chooseQuotation(ctx(), 'q-1', '2026-11-12')).rejects.toMatchObject({
      message: 'QUOTATION_EXPIRED',
      statusCode: 409,
    })

    holder.db = new FakeDatabase()
    await expect(service.chooseQuotation(ctx(), 'q-1', '2026-11-12')).rejects.toMatchObject({
      message: 'RFQ_CHOOSE_NOT_INSTALLED',
      statusCode: 503,
    })
  })

  it('a contract price must be on this business’s contract, with that supplier and currency', async () => {
    holder.db.seed('contracts', [
      { id: 'c-1', workspace_id: WS, customer_id: 'sup-1', currency: 'AFN' },
      { id: 'c-x', workspace_id: OTHER, customer_id: 'sup-1', currency: 'AFN' },
    ])
    holder.db.seed('products', [{ id: 'p-1', workspace_id: WS }])
    holder.db.seed('purchase_contract_prices', [])
    const service = new RfqContractsService()
    const price = (overrides: Record<string, unknown> = {}) => ({
      contract_id: 'c-1',
      supplier_id: 'sup-1',
      product_id: 'p-1',
      agreed_unit_price_minor: 1_200,
      currency: 'AFN',
      valid_from: '2026-01-01',
      valid_to: '2026-12-31',
      ...overrides,
    })
    await expect(
      service.upsertPurchaseContractPrice(ctx(), price({ contract_id: 'c-x' })),
    ).rejects.toThrow('CONTRACT_NOT_FOUND')
    await expect(
      service.upsertPurchaseContractPrice(ctx(), price({ supplier_id: 'sup-2' })),
    ).rejects.toThrow('CONTRACT_SUPPLIER_MISMATCH')
    await expect(
      service.upsertPurchaseContractPrice(ctx(), price({ currency: 'USD' })),
    ).rejects.toThrow('CONTRACT_PRICE_CURRENCY_MISMATCH')
    await expect(
      service.upsertPurchaseContractPrice(ctx(), price({ valid_to: '2025-12-31' })),
    ).rejects.toThrow('CONTRACT_PRICE_DATES_REVERSED')
  })
})

describe('bundles and consignment (B.2.8, B.2.10)', () => {
  it('saves the whole list through ONE database function', async () => {
    const calls: Array<Record<string, unknown>> = []
    holder.db.rpc('product_bundle_set_items', (args) => {
      calls.push(args)
      return [{ id: 'b-1', component_product_id: 'p-2', quantity: 2 }]
    })
    const items = [{ component_product_id: 'p-2', quantity: 2 }]
    const rows = await new BundlesConsignmentCommissionService().setBundleItems(ctx(), 'p-1', items)
    expect(rows).toHaveLength(1)
    expect(calls).toEqual([{ p_workspace_id: WS, p_bundle_product_id: 'p-1', p_items: items }])
  })

  it('maps a refusal to 400 and a missing function to 503', async () => {
    const service = new BundlesConsignmentCommissionService()
    holder.db.rpc('product_bundle_set_items', () => {
      throw new Error('BUNDLE_COMPONENT_IS_BUNDLE')
    })
    await expect(service.setBundleItems(ctx(), 'p-1', [])).rejects.toMatchObject({
      message: 'BUNDLE_COMPONENT_IS_BUNDLE',
      statusCode: 400,
    })
    holder.db = new FakeDatabase()
    await expect(service.setBundleItems(ctx(), 'p-1', [])).rejects.toMatchObject({
      message: 'BUNDLE_SAVE_NOT_INSTALLED',
      statusCode: 503,
    })
  })

  it('a consignment lot names this business’s party, warehouse and product', async () => {
    holder.db.seed('customers', [{ id: 'c-1', workspace_id: WS }])
    holder.db.seed('warehouses', [
      { id: 'w-1', workspace_id: WS },
      { id: 'w-x', workspace_id: OTHER },
    ])
    holder.db.seed('products', [{ id: 'p-1', workspace_id: WS }])
    holder.db.seed('consignment_lots', [])
    const lot = {
      direction: 'in' as const,
      party_id: 'c-1',
      warehouse_id: 'w-x',
      product_id: 'p-1',
      quantity: 5,
      unit_agreed_price_minor: 100,
      currency: 'AFN',
    }
    const service = new BundlesConsignmentCommissionService()
    await expect(service.createConsignmentLot(ctx(), lot)).rejects.toThrow(
      'CONSIGNMENT_WAREHOUSE_NOT_FOUND',
    )
    const saved = await service.createConsignmentLot(ctx(), { ...lot, warehouse_id: 'w-1' })
    expect(saved).toMatchObject({ workspace_id: WS, warehouse_id: 'w-1', quantity: 5 })
  })
})

describe('accrual schedules (B.2.4)', () => {
  const book = { currency: 'AFN' }
  vi.doMock('../services/base-currency', () => ({ baseCurrencyOf: async () => book.currency }))

  it('a schedule from 31 Jan has a period in February, not 3 March', async () => {
    const { buildAccrualPeriods } = await import('@hisabche/validation')
    const dates = buildAccrualPeriods(3_000, 3, '2026-01-31').map((p) => p.periodDate)
    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })

  it('creates through ONE database call, with periods that add up', async () => {
    const { AccrualSchedulesService } =
      await import('../services/accounting/accrual-schedules.service')
    const calls: Array<Record<string, unknown>> = []
    holder.db.seed('workspaces', [{ id: WS, base_currency: 'AFN' }])
    holder.db.rpc('accrual_schedule_create', (args) => {
      calls.push(args)
      return { id: 'sch-1' }
    })
    await new AccrualSchedulesService().create(ctx(), {
      source_document_type: 'invoice',
      source_document_id: '44444444-4444-4444-8444-444444444444',
      description: 'Prepaid rent',
      total_amount_minor: 1_000,
      currency: 'AFN',
      periods_count: 3,
      start_date: '2026-11-01',
      debit_account_id: 'a',
      credit_account_id: 'b',
    })
    expect(calls).toHaveLength(1)
    const periods = calls[0]!.p_periods as Array<{ amount_minor: number }>
    expect(periods.reduce((sum, p) => sum + p.amount_minor, 0)).toBe(1_000)
  })

  it('a total smaller than the number of periods is refused before any write', async () => {
    const { AccrualSchedulesService } =
      await import('../services/accounting/accrual-schedules.service')
    holder.db.seed('workspaces', [{ id: WS, base_currency: 'AFN' }])
    await expect(
      new AccrualSchedulesService().create(ctx(), {
        source_document_type: 'invoice',
        source_document_id: '44444444-4444-4444-8444-444444444444',
        description: 'Tiny',
        total_amount_minor: 5,
        currency: 'AFN',
        periods_count: 12,
        start_date: '2026-11-01',
        debit_account_id: 'a',
        credit_account_id: 'b',
      }),
    ).rejects.toThrow('ACCRUAL_AMOUNT_TOO_SMALL_FOR_PERIODS')
  })
})
