// ============================================
// Every column a V61 service names exists in some docs/*.sql.
//
// The V61 audit (12 Nov 2026) found three services reading columns that were
// never created — `employees.name` / `.department` / `.is_active` (org chart),
// `invoices.issue_date` (RFM), `invoices.cost_total` (commission),
// `products.cost_price` (redacted list). Each answered 500 on every call, and
// every test stayed green, because no test reads the schema. This one does.
//
// The list of files is CLOSED: a new V61-era service joins it on purpose.
// ============================================
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..', '..')
const DOCS = join(ROOT, 'docs')
const SERVICES = join(ROOT, 'backend', 'src', 'services')

const FILES = [
  'human-resources/hr-org-appraisal.service.ts',
  'human-resources/expense-claims.service.ts',
  'purchasing/rfq-contracts.service.ts',
  'commerce/bundles-consignment-commission.service.ts',
  'payments/cheques.service.ts',
  'payments/customer-gateway.service.ts',
  'accounting/accrual-schedules.service.ts',
  'assets/assets.service.ts',
]

/** table → the columns some migration creates for it. */
function schemaColumns(): Map<string, Set<string>> {
  const sql = readdirSync(DOCS)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => readFileSync(join(DOCS, file), 'utf8'))
    .join('\n')
    .replace(/\r/g, '')
  const cols = new Map<string, Set<string>>()
  const add = (table: string, column: string) => {
    const t = table.replace(/^public\./, '').replace(/"/g, '')
    if (!cols.has(t)) cols.set(t, new Set())
    cols.get(t)!.add(column.replace(/"/g, ''))
  }
  for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?([\w."]+)\s*\(([\s\S]*?)\n\);/gi)) {
    for (const line of m[2]!.split('\n')) {
      const c = line.trim().match(/^"?([a-z_][a-z0-9_]*)"?\s+[a-z]/i)
      if (c && !/^(constraint|primary|unique|check|foreign|exclude)$/i.test(c[1]!))
        add(m[1]!, c[1]!)
    }
  }
  for (const m of sql.matchAll(/ALTER TABLE (?:IF EXISTS )?(?:ONLY )?([\w."]+)([\s\S]*?);/gi)) {
    for (const c of m[2]!.matchAll(/ADD COLUMN (?:IF NOT EXISTS )?"?([a-z_][a-z0-9_]*)"?/gi))
      add(m[1]!, c[1]!)
  }
  return cols
}

/** The columns one `.from('t')…` chain names: select list, filters, written keys. */
function namedColumns(chain: string): string[] {
  const named = new Set<string>()
  const select = chain.match(/\.select\(\s*'([^']*)'/)
  if (select) {
    // Embeds («accrual_schedules(id, currency)», «asset:fixed_assets(...)») belong
    // to ANOTHER table — drop them before splitting the list.
    let list = select[1]!
    while (/\([^()]*\)/.test(list)) list = list.replace(/[\w!:]*\([^()]*\)/g, '')
    for (const raw of list.split(',')) {
      const c = raw.trim()
      if (c && c !== '*' && /^[a-z_][a-z0-9_]*$/.test(c)) named.add(c)
    }
  }
  for (const m of chain.matchAll(/\.(?:eq|neq|is|in|gte|lte|gt|lt|order|not)\(\s*'([a-z_]+)'/g)) {
    named.add(m[1]!)
  }
  return [...named]
}

describe('V61 services name only columns that exist', () => {
  const schema = schemaColumns()

  it('reads the schema at all (a parser that finds nothing proves nothing)', () => {
    expect(schema.get('employees')?.has('first_name')).toBe(true)
    expect(schema.get('invoices')?.has('date')).toBe(true)
  })

  for (const file of FILES) {
    it(file, () => {
      const source = readFileSync(join(SERVICES, file), 'utf8')
      const missing: string[] = []
      for (const part of source.split(/\.from\(/).slice(1)) {
        const table = part.match(/^'([a-z_]+)'\)/)?.[1]
        if (!table) continue
        const known = schema.get(table)
        if (!known) {
          missing.push(`${table} (no CREATE TABLE in docs/*.sql)`)
          continue
        }
        // The chain ends where the next statement starts.
        const chain = part.split(/\n\s*\n|\bawait\b|\breturn\b/)[0]!
        for (const column of namedColumns(chain)) {
          if (!known.has(column)) missing.push(`${table}.${column}`)
        }
      }
      expect(missing).toEqual([])
    })
  }

  it('the RFM route reads `invoices.date`, not the `issue_date` that never existed', () => {
    const route = readFileSync(join(ROOT, 'backend', 'src', 'routes', 'crm.routes.ts'), 'utf8')
    const rfm = route.slice(route.indexOf("'/api/crm/rfm'"))
    expect(rfm).toContain(".select('customer_id, currency, date, total')")
    expect(rfm).toContain(".eq('type', 'sale')")
    expect(rfm.slice(0, 4000)).not.toContain('issue_date')
  })
})
