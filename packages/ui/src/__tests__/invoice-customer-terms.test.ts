// Customer 360 phase 3 on the invoice form: payment terms fill an EMPTY due
// date; a sale past the credit limit is warned about (not blocked).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { creditBreach, dueDateFromTerms } from '../components/ui/invoice-builder/use-customer-terms'

const dir = join(__dirname, '../components/ui/invoice-builder')
const code = (s: string) => s.replace(/^\s*\/\/.*$/gm, '')

describe('dueDateFromTerms', () => {
  it('adds the terms to the invoice day (UTC, month rollover)', () => {
    expect(dueDateFromTerms('2026-09-17T10:30:00.000Z', 30)).toBe('2026-10-17T00:00:00.000Z')
    expect(dueDateFromTerms('2026-01-31', 1)).toBe('2026-02-01T00:00:00.000Z')
    expect(dueDateFromTerms('2026-09-17', 0)).toBe('2026-09-17T00:00:00.000Z')
  })
  it('no terms / bad input → nothing', () => {
    expect(dueDateFromTerms('2026-09-17', null)).toBeNull()
    expect(dueDateFromTerms('garbage', 30)).toBeNull()
    expect(dueDateFromTerms('2026-09-17', -1)).toBeNull()
  })
})

describe('creditBreach', () => {
  it('warns only when used + this invoice exceeds the limit', () => {
    expect(creditBreach({ creditLimit: 1000, used: 600 }, 400)).toBeNull()
    expect(creditBreach({ creditLimit: 1000, used: 600 }, 401)).toEqual({
      creditLimit: 1000,
      used: 600,
      after: 1001,
    })
    expect(creditBreach({ creditLimit: 0, used: 0 }, 1)).toMatchObject({ after: 1 })
  })
  it('no limit or empty invoice → no warning', () => {
    expect(creditBreach(null, 5000)).toBeNull()
    expect(creditBreach({ creditLimit: 10, used: 50 }, 0)).toBeNull()
  })
})

describe('wiring', () => {
  const container = readFileSync(join(dir, 'containers/invoice-builder-container.tsx'), 'utf8')
  const hook = readFileSync(join(dir, 'use-customer-terms.ts'), 'utf8')

  it('the form uses the terms hook for the invoice customer and shows the warning', () => {
    expect(code(container)).toContain('useCustomerTerms({')
    expect(code(container)).toContain('customerId: draft.customers[0]?.id')
    expect(code(container)).toContain('<CreditLimitWarning')
  })

  it('never overwrites a due date the user chose, and only for sales', () => {
    expect(code(hook)).toContain('dueDate !== null) return')
    expect(code(hook)).toContain("input.transactionType === 'sale'")
  })

  it('warning strings exist in every locale', () => {
    for (const locale of ['fa', 'af', 'en']) {
      const bundle = JSON.parse(
        readFileSync(join(__dirname, `../../../i18n/messages/${locale}/common.json`), 'utf8'),
      )
      for (const key of ['creditLimitTitle', 'creditAfter', 'creditLimitHint']) {
        expect(bundle.invoiceBuilder[key], `${locale}.invoiceBuilder.${key}`).toBeTruthy()
      }
    }
  })
})
