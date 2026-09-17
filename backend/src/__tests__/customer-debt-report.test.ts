// BUG-011: the customer debt report counted cancelled invoices (and purchase
// invoices) as money the customer owes, and read with PostgREST's 1000-row cap.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const code = (s: string) => s.replace(/^\s*\/\/.*$/gm, '')
const report = code(
  readFileSync(join(__dirname, '../services/accounting/operational-reports.ts'), 'utf8'),
)
const body = report.slice(report.indexOf('export async function getCustomerDebtReport'))
const fn = body.slice(0, body.indexOf('\n}\n'))

describe('customer debt report — fallback path', () => {
  it('excludes cancelled and paid invoices', () => {
    expect(fn).toContain(`.not('status', 'in', '("paid","cancelled")')`)
    expect(fn).not.toContain(`.neq('status', 'paid')`)
  })
  it('excludes purchase invoices but keeps legacy rows with no type', () => {
    expect(fn).toContain(`.or('type.is.null,type.neq.purchase')`)
  })
  it('reads every page', () => {
    expect(fn.match(/fetchAllPages/g)?.length).toBe(2)
    expect(fn.match(/\.range\(from, to\)/g)?.length).toBe(2)
  })
})

describe('customer debt report — SQL aggregate migration', () => {
  const sql = readFileSync(
    join(__dirname, '../../../docs/customer-debt-cancelled-fix-migration.sql'),
    'utf8',
  )
  it('same rules as the fallback, grants unchanged', () => {
    expect(sql).toContain(`i.status NOT IN ('paid', 'cancelled')`)
    expect(sql).toContain(`COALESCE(i.type, 'sale') <> 'purchase'`)
    expect(sql).toContain('FROM authenticated;')
    expect(sql).toContain('TO service_role;')
  })
})
