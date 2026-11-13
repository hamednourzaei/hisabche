// The recurring-expense template's ledger lines (13 Nov 2026).
//
// The template stores minor units; the ledger's DraftLine is major. The lines used to be
// built as `{ debitMinor, creditMinor }`, which `postDocument` never reads — every line
// posted as 0. Typing the payload (instead of `any`) is what exposed it.
import { describe, expect, it } from 'vitest'
import { normaliseLines } from '@hisabche/validation'
import { journalTemplateLines } from '../services/automation/automation.service'

describe('journalTemplateLines', () => {
  const payload = {
    journal: {
      lines: [
        { accountId: 'rent', debitMinor: 1_250_050, description: 'اجاره' },
        { accountId: 'cash', creditMinor: '1250050' },
      ],
    },
  }

  it('gives the ledger major amounts, not the minor ones', () => {
    const lines = journalTemplateLines(payload, 'هزینه‌ی ماهانه')
    expect(lines).toEqual([
      { accountId: 'rent', debit: 12_500.5, credit: 0, description: 'اجاره' },
      { accountId: 'cash', debit: 0, credit: 12_500.5, description: 'هزینه‌ی ماهانه' },
    ])
  })

  it('survives the ledger normalisation with the amounts intact (it read 0 before)', () => {
    const normalised = normaliseLines(journalTemplateLines(payload, 'x'))
    expect(normalised.map((line) => line.debit + line.credit)).toEqual([12_500.5, 12_500.5])
    const debit = normalised.reduce((sum, line) => sum + line.debit, 0)
    const credit = normalised.reduce((sum, line) => sum + line.credit, 0)
    expect(debit).toBe(credit)
  })

  it('reads an older row whose lines sit at the top of the payload', () => {
    const lines = journalTemplateLines({ lines: [{ accountId: 'a', debitMinor: 100 }] }, 'x')
    expect(lines[0]?.debit).toBe(1)
  })

  it('posts nothing for a payload with no lines', () => {
    expect(journalTemplateLines({}, 'x')).toEqual([])
    expect(journalTemplateLines(null, 'x')).toEqual([])
  })
})
