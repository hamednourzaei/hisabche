// ============================================
// backend/src/__tests__/perf-aggregates.test.ts
//
// Database-side aggregates (docs/perf-aggregates-*-migration.sql).
//
//   1. «Function not installed» (PGRST202 / 42883) falls back to the old
//      row path — nothing breaks before a human runs the migration.
//   2. ANY other RPC error throws, and is not cached. «Broken» must never be
//      served as «zero» (§7 #3).
//   3. The migrations: every SECURITY DEFINER function is REVOKEd from
//      PUBLIC / anon / authenticated (it trusts p_workspace_id and bypasses
//      RLS), and no `reporting.` function anywhere takes a workspace id.
// ============================================

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb } from './helpers/fake-supabase'

const hoisted = vi.hoisted(() => ({ fake: undefined as unknown }))
vi.mock('../db', () => hoisted.fake)

const db = new FakeDatabase()
hoisted.fake = createFakeDb(db, new Map())

const { callAggregate, isMissingFunctionError } =
  await import('../services/aggregates/aggregate-rpc')
const { getCustomerDebtReport } = await import('../services/accounting/operational-reports')
const { dashboardKpisFromAggregate } = await import('../services/aggregates/analytics-aggregates')
const { z } = await import('zod')

const DOCS = join(__dirname, '..', '..', '..', 'docs')
const SERVICES = join(__dirname, '..', 'services')

let counter = 0
const newWorkspace = () => `ws-perf-${++counter}`
const ctx = (workspaceId: string) =>
  ({ workspaceId, userId: 'u1', role: 'owner' }) as unknown as Parameters<
    typeof getCustomerDebtReport
  >[0]

function seedDebt(workspaceId: string) {
  db.seed('customers', [
    {
      id: `${workspaceId}-c1`,
      workspace_id: workspaceId,
      full_name: 'Ali',
      opening_balance: 0,
      is_active: true,
    },
  ])
  db.seed('invoices', [
    {
      id: `${workspaceId}-i1`,
      workspace_id: workspaceId,
      customer_id: `${workspaceId}-c1`,
      total: 150,
      paid_amount: 50,
      status: 'pending',
    },
  ])
}

beforeEach(() => {
  db.rpcs.clear()
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

// ══════════════════════════════════════════════ callAggregate

describe('callAggregate', () => {
  const schema = z.object({ n: z.number() })

  it.each(['PGRST202', '42883'])(
    'returns null (fallback) when the function is missing: %s',
    async (code) => {
      const client = (
        hoisted.fake as { supabase: { rpc: (name: string, args: object) => Promise<unknown> } }
      ).supabase
      vi.spyOn(client, 'rpc').mockResolvedValueOnce({
        data: null,
        error: { code, message: 'missing' },
      })
      await expect(callAggregate('some_fn', {}, schema)).resolves.toBeNull()
      expect(console.warn).toHaveBeenCalled()
    },
  )

  it('⚠️ throws on any other error — never an empty result', async () => {
    db.rpc('some_fn', () => {
      throw new Error('permission denied for function some_fn')
    })
    await expect(callAggregate('some_fn', {}, schema)).rejects.toThrow('Aggregate some_fn failed')
  })

  it('⚠️ throws when the payload has the wrong shape', async () => {
    db.rpc('some_fn', () => ({ n: 'not a number' }))
    await expect(callAggregate('some_fn', {}, schema)).rejects.toThrow('unexpected shape')
  })

  it('returns the parsed value', async () => {
    db.rpc('some_fn', () => ({ n: 3 }))
    await expect(callAggregate('some_fn', {}, schema)).resolves.toEqual({ n: 3 })
  })

  it('only the two «missing function» codes count as missing', () => {
    expect(isMissingFunctionError({ code: 'PGRST202' })).toBe(true)
    expect(isMissingFunctionError({ code: '42883' })).toBe(true)
    expect(isMissingFunctionError({ code: '42501' })).toBe(false)
    expect(isMissingFunctionError({ code: undefined })).toBe(false)
    expect(isMissingFunctionError(null)).toBe(false)
  })
})

// ══════════════════════════════════════════════ a service, end to end

describe('customer debt report', () => {
  it('falls back to the row path while the function is not installed', async () => {
    const ws = newWorkspace()
    seedDebt(ws)
    // No rpc registered → the fake answers PGRST202, like PostgREST.
    const report = await getCustomerDebtReport(ctx(ws))
    expect(report).toMatchObject({
      totalDebt: 100,
      debtors: [{ name: 'Ali', balance: 100, totalInvoices: 1 }],
    })
  })

  it('uses the aggregate when installed, with the same response shape', async () => {
    const ws = newWorkspace()
    seedDebt(ws)
    db.rpc('accounting_customer_debt', (args) => {
      expect(args).toEqual({ p_workspace_id: ws })
      return {
        debtors: [{ name: 'Ali', balance: 2500.5, total_invoices: 1200 }],
        creditors: [{ name: 'Sara', balance: -10, total_invoices: 0 }],
      }
    })
    const report = await getCustomerDebtReport(ctx(ws))
    expect(report).toEqual({
      debtors: [{ name: 'Ali', balance: 2500.5, totalInvoices: 1200 }],
      creditors: [{ name: 'Sara', balance: -10, totalInvoices: 0 }],
      totalDebt: 2500.5,
      totalCredit: 10,
    })
  })

  it('⚠️ a failing aggregate throws and is NOT cached', async () => {
    const ws = newWorkspace()
    seedDebt(ws)
    db.rpc('accounting_customer_debt', () => {
      throw new Error('statement timeout')
    })
    await expect(getCustomerDebtReport(ctx(ws))).rejects.toThrow()

    db.rpc('accounting_customer_debt', () => ({ debtors: [], creditors: [] }))
    await expect(getCustomerDebtReport(ctx(ws))).resolves.toMatchObject({ totalDebt: 0 })
  })
})

describe('dashboard mapping', () => {
  it('sums across currencies for the flat fields and flags mixed currency', () => {
    const row = (currency: string, v: number) => ({
      currency,
      total_sales: v,
      total_purchases: 0,
      customer_debt: v / 2,
      supplier_payable: 0,
      today_sales: 0,
      today_invoices: 1,
      monthly_revenue: v,
      prev_month_revenue: v / 2,
      pending_payments: 0,
      pending_payments_count: 0,
      purchase_count: 0,
    })
    const out = dashboardKpisFromAggregate({
      currencies: [row('AFN', 100), row('USD', 10)],
      active_customers: 3,
      low_stock_alerts: 1,
      warehouse_value: 12.345,
    })
    expect(out.totalSales).toBe(110)
    expect(out.monthlyGrowth).toBe(100)
    expect(out.todayInvoices).toBe(2)
    expect(out.mixedCurrency).toBe(true)
    expect(out.byCurrency.USD?.customerDebt).toBe(5)
    expect(out.warehouseValue).toBe(12.35)
  })
})

describe('invoice-list summary no longer drops its read errors (§7 #3)', () => {
  it('checks both errors on the row path', () => {
    const source = readFileSync(join(SERVICES, 'invoice.service.ts'), 'utf8')
    const body = source.slice(
      source.indexOf('async getSummary('),
      source.indexOf('Invoice Item Details'),
    )
    expect(body).toContain('fetchInvoiceSummaryAggregate')
    expect(body).toContain('if (invoicesError) throw')
    expect(body).toContain('if (productsError) throw')
  })
})

// ══════════════════════════════════════════════ migration guards

/** Strip `-- …` comments so prose about a REVOKE is not a REVOKE. */
const sql = (file: string) => readFileSync(join(DOCS, file), 'utf8').replace(/--[^\n]*/g, '')

const PERF_MIGRATIONS = readdirSync(DOCS).filter((f) =>
  /^perf-aggregates-.*-migration\.sql$/.test(f),
)

/** RLS helpers must stay executable by `authenticated` — policies call them. */
const RLS_HELPERS = new Set([
  'auth_workspace_ids',
  'is_workspace_member',
  'auth_owned_workspace_ids',
])

interface DeclaredFunction {
  name: string
  types: string
  params: string
  definer: boolean
}

function declaredFunctions(text: string): DeclaredFunction[] {
  const found: DeclaredFunction[] = []
  const re =
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w.]+)\s*\(([^)]*)\)([\s\S]*?)\$(\w*)\$[\s\S]*?\$\4\$/gi
  for (const m of text.matchAll(re)) {
    const params = m[2] ?? ''
    const types = params
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => (p.split(/\s+/)[1] ?? '').toLowerCase())
      .join(',')
    found.push({ name: m[1] ?? '', types, params, definer: /SECURITY\s+DEFINER/i.test(m[3] ?? '') })
  }
  return found
}

describe('perf-aggregate migrations', () => {
  it('exist', () => {
    expect(PERF_MIGRATIONS.length).toBeGreaterThanOrEqual(2)
  })

  it.each(PERF_MIGRATIONS)('%s declares PENDING HUMAN CONFIRMATION and a rollback', (file) => {
    const raw = readFileSync(join(DOCS, file), 'utf8')
    expect(raw).toContain('PENDING HUMAN CONFIRMATION')
    expect(raw).toContain('ROLLBACK')
  })

  it.each(PERF_MIGRATIONS)(
    '⚠️ %s: every SECURITY DEFINER function is revoked from PUBLIC, anon and authenticated',
    (file) => {
      const text = sql(file)
      const fns = declaredFunctions(text).filter((f) => f.definer)
      expect(fns.length).toBeGreaterThan(0)
      const compact = text.replace(/\s+/g, ' ')

      for (const fn of fns) {
        const bare = fn.name.replace(/^public\./, '')
        if (RLS_HELPERS.has(bare)) continue
        const sig = `(?:public\\.)?${bare} ?\\(${fn.types.split(',').join(' ?, ?')}\\)`
        for (const role of ['PUBLIC', 'anon', 'authenticated']) {
          expect(compact, `${fn.name}: missing REVOKE … FROM ${role}`).toMatch(
            new RegExp(`REVOKE EXECUTE ON FUNCTION ${sig} FROM ${role};`, 'i'),
          )
        }
        expect(compact, `${fn.name}: missing GRANT … TO service_role`).toMatch(
          new RegExp(`GRANT EXECUTE ON FUNCTION ${sig} TO service_role;`, 'i'),
        )
      }
    },
  )

  it.each(PERF_MIGRATIONS)('%s: nothing is created in the AI `reporting` schema', (file) => {
    for (const fn of declaredFunctions(sql(file))) {
      expect(fn.name.startsWith('reporting.'), fn.name).toBe(false)
    }
  })

  it('⚠️ no `reporting.` function anywhere in docs takes a workspace parameter', () => {
    const files = readdirSync(DOCS).filter((f) => f.endsWith('.sql'))
    for (const file of files) {
      for (const fn of declaredFunctions(sql(file))) {
        if (!fn.name.startsWith('reporting.')) continue
        expect(fn.params, `${file}: ${fn.name}`).not.toMatch(/workspace/i)
      }
    }
  })
})
