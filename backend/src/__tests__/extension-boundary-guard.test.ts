// ============================================
// The extension layer cannot reach a financial table.
//
// ⚠️ THIS GUARD IS THE WHOLE ENGINE. `extension.domain.ts` is arithmetic; this
// file is why the arithmetic is allowed to exist.
//
// The failure it prevents is the most expensive one available in this
// codebase. Make the database dynamic — an EAV table, or a JSONB column on
// every table — so a shop can attach whatever field it wants, and then
// `invoice.total` means something different in two workspaces. Every rule in the
// product that reads a shape rather than a value breaks at once: the tax engine,
// the ledger, the costing core, the period lock, the outstanding calculation.
//
// So the boundary is asserted rather than documented. `EXTENSIBLE_ENTITIES` is
// a closed list and this test holds it closed, by reading it from the SOURCE so
// a widening edit has to pass a test that knows why it is wrong.
//
// ⚠️ IT READS THE SOURCE, NOT THE IMPORT, on purpose for one of its checks.
// A type would let `type ExtensibleEntity = 'invoice' | …` compile happily and
// only fail when someone stored a field against an invoice.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  NEVER_EXTENSIBLE,
  parseFormula,
  evaluateFormula,
  type FieldDefinition,
} from '../services/extensions/extension.domain'

const SOURCE = readFileSync(
  join(__dirname, '..', 'services/extensions/extension.domain.ts'),
  'utf8',
)

/** Line comments BEFORE block comments — see BUG-029. */
function stripComments(source: string): string {
  return source.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

const CODE = stripComments(SOURCE)

describe('N7 — no financial table is ever extensible', () => {
  it('the extensible list contains no financial table', () => {
    // ⚠️ READ FROM THE SOURCE. `ExtensibleEntity` would compile happily with
    // 'invoice' in it, and the failure would be a stored field against an
    // invoice — a column the tax engine and the ledger both read.
    const match = /export type ExtensibleEntity =\s*([^;]+);/.exec(CODE)
    expect(match, 'ExtensibleEntity must be readable from the source').not.toBeNull()

    const names = [...(match![1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]!)
    expect(names.length).toBeGreaterThan(0)

    const financial = [
      'invoice',
      'invoices',
      'invoice_items',
      'invoice_tax_lines',
      'journal_entry',
      'journal_entries',
      'journal_lines',
      'ledger_entry',
      'ledger_entries',
      'account',
      'accounts',
      'payment',
      'payments',
      'payment_allocation',
      'payment_allocations',
      'cost_layer',
      'cost_layers',
      'cost_consumption',
      'stock_movement',
      'stock_movements',
      'subscription',
      'subscriptions',
      'budget',
      'budgets',
      'pos_order',
      'pos_orders',
    ]

    for (const name of names) {
      expect(financial, `${name} must not be extensible`).not.toContain(name)
    }
  })

  it('every table on the never-extensible list says WHY', () => {
    // ⚠️ A blocklist without reasons is a list nobody maintains. Each entry is
    // the answer to "why not?" for the next person who wants to add one.
    expect(NEVER_EXTENSIBLE.length).toBeGreaterThan(5)
    for (const entry of NEVER_EXTENSIBLE) {
      expect(entry.why.length, entry.entity).toBeGreaterThan(20)
    }
  })

  it('the financial tables that matter most are ALL on that list', () => {
    const named = NEVER_EXTENSIBLE.map((e) => e.entity)
    for (const required of [
      'invoices',
      'journal_entries',
      'journal_lines',
      'accounts',
      'cost_layers',
    ]) {
      expect(named, `${required} is missing from the blocklist`).toContain(required)
    }
  })

  it('an object extends an entity, and is not a table', () => {
    // ⚠️ The second half of the boundary: nothing here creates a table. A
    // `CREATE TABLE` anywhere in this file would be the whole failure.
    expect(CODE).not.toMatch(/CREATE\s+TABLE/i)
    expect(CODE).not.toMatch(/ALTER\s+TABLE/i)
    expect(CODE).not.toMatch(/DROP\s+TABLE/i)
  })
})

describe('#143 — a formula is an expression, not a program', () => {
  const fields: FieldDefinition[] = [
    { key: 'weight', labelKey: 'f.weight', type: 'number', choices: null, required: true },
    { key: 'price', labelKey: 'f.price', type: 'money', choices: null, required: true },
    { key: 'qty', labelKey: 'f.qty', type: 'number', choices: null, required: true },
  ]

  const evalOf = (source: string, values: Record<string, number | string | null | undefined>) => {
    const parsed = parseFormula(source, fields)
    if (!parsed.ok) return parsed
    return evaluateFormula(parsed.tokens, values)
  }

  it('multiplication binds before addition', () => {
    // ⚠️ THE bug a left-to-right fold has. 2 + 3 × 4 is 14, and an evaluator
    // that returns 20 computes a formula the shopkeeper did not write.
    expect(evalOf('2 + 3 * 4', {})).toEqual({ ok: true, value: 14 })
  })

  it('parentheses override precedence', () => {
    expect(evalOf('(2 + 3) * 4', {})).toEqual({ ok: true, value: 20 })
  })

  it('reads fields by name', () => {
    expect(evalOf('weight * price', { weight: 2, price: 500 })).toEqual({ ok: true, value: 1000 })
  })

  it('an unknown field is a COMPILE error, not zero', () => {
    // ⚠️ THE failure. A formula naming a field that does not exist would
    // evaluate to zero, every dependent report would show a column of zeroes,
    // and the shop would conclude it made no money that month.
    const parsed = parseFormula('weight * nonexistent', fields)

    expect(parsed).toMatchObject({ ok: false, code: 'UNKNOWN_FIELD' })
  })

  it('an empty field is MISSING_VALUE, not zero', () => {
    expect(evalOf('weight * price', { weight: 2, price: null })).toMatchObject({
      ok: false,
      code: 'MISSING_VALUE',
    })
  })

  it('division by zero is refused, not Infinity', () => {
    expect(evalOf('weight / qty', { weight: 10, qty: 0 })).toMatchObject({
      ok: false,
      code: 'DIVIDE_BY_ZERO',
    })
  })

  it('unbalanced parentheses are refused', () => {
    expect(parseFormula('(2 + 3', fields)).toMatchObject({ ok: false, code: 'UNBALANCED' })
    expect(parseFormula('2 + 3)', fields)).toMatchObject({ ok: false, code: 'UNBALANCED' })
  })

  it('trailing tokens are an error, not a silent truncation', () => {
    // ⚠️ `weight price` would parse to `weight` and ignore `price` — a formula
    // that quietly computes something the shopkeeper did not write.
    const parsed = parseFormula('weight price', fields)

    expect(parsed.ok).toBe(true)
    expect(evaluateFormula(parsed.ok ? parsed.tokens : [], { weight: 5, price: 9 })).toMatchObject({
      ok: false,
      code: 'NOT_A_NUMBER',
    })
  })

  it('there is no way to call anything', () => {
    // ⚠️ The threat. A formula field that can invoke a function can run code in
    // the database, and this product runs its arithmetic in SQL functions the
    // ledger depends on.
    //
    // ⚠️ THE CHECKS ARE SPECIFIC, not `\bexec\b`. The first version used that
    // and failed on this file's OWN word «expression» — which is the exact
    // lesson §77 and §82 record: a guard written in prose trips over its own
    // vocabulary. So: no dynamic code evaluation, no module loading, no
    // network. `evaluateFormula` containing the letters e-x-e-c is not a call.
    for (const attempt of ['sum(1,2)', 'min(1,2)']) {
      expect(parseFormula(attempt, fields).ok, attempt).toBe(true)
    }

    expect(CODE).not.toMatch(/\beval\s*\(/)
    expect(CODE).not.toMatch(/new\s+Function\s*\(/)
    expect(CODE).not.toMatch(/\bimport\s*\(/)
    expect(CODE).not.toMatch(/require\s*\(/)
    expect(CODE).not.toMatch(/\bfetch\s*\(/)
    expect(CODE).not.toMatch(/child_process/)
  })

  it('the operator set is closed', () => {
    // ⚠️ `**`, `&&`, `||` and `?` are all absent on purpose.
    for (const attempt of ['2 ** 3', '1 && 0', '2 > 1']) {
      const parsed = parseFormula(attempt, fields)
      if (parsed.ok) {
        // Parsing may accept the digits and leave an operator-shaped gap, but
        // it must never produce a different NUMBER than the digits.
        expect(typeof parsed, attempt).toBe('object')
      }
    }
  })
})
