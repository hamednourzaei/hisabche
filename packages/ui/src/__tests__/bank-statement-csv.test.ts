// ============================================
// Bank statement CSV → statement lines.
//
// The shapes real exports take: an Iranian bank's Jalali dates with Persian
// digits and separate withdrawal/deposit columns; a foreign bank's one signed
// Amount; quoted cells with commas inside; a BOM; semicolons. And the rule
// that matters most: an unreadable row is reported, never dropped.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  detectDelimiter,
  parseAmountMinor,
  parseBankStatementCsv,
  parseStatementDate,
  splitCsv,
} from '../lib/bank-statement-csv'

describe('amounts are integer minor units', () => {
  it.each([
    ['1,234.50', 123450],
    ['۱٬۲۳۴٫۵', 123450],
    ['-250', -25000],
    ['(1,000.00)', -100000],
    ['500-', -50000],
    ['0.1', 10],
  ])('%s → %i', (raw, minor) => {
    expect(parseAmountMinor(raw, 2)).toBe(minor)
  })

  it('refuses what it would have to round or guess', () => {
    expect(parseAmountMinor('1.234', 2)).toBeNull()
    expect(parseAmountMinor('abc', 2)).toBeNull()
    expect(parseAmountMinor('', 2)).toBeNull()
    expect(parseAmountMinor('1e5', 2)).toBeNull()
  })

  it('never goes through a float: 0.29 is 29, not 28.999…', () => {
    expect(parseAmountMinor('0.29', 2)).toBe(29)
    expect(parseAmountMinor('1.005', 3)).toBe(1005)
  })
})

describe('dates become Gregorian ISO days', () => {
  it.each([
    ['2026-09-27', '2026-09-27'],
    ['27/09/2026', '2026-09-27'],
    ['1405/07/05', '2026-09-27'],
    ['۱۴۰۵/۰۷/۰۵', '2026-09-27'],
    ['2026-09-27 14:30', '2026-09-27'],
  ])('%s → %s', (raw, iso) => {
    expect(parseStatementDate(raw)).toBe(iso)
  })

  it('an impossible date is refused, not rolled over', () => {
    expect(parseStatementDate('2026-02-30')).toBeNull()
    expect(parseStatementDate('13/13/2026')).toBeNull()
    expect(parseStatementDate('yesterday')).toBeNull()
  })
})

describe('CSV cells', () => {
  it('quotes, escaped quotes, CRLF and a BOM', () => {
    expect(splitCsv('﻿a,"b, c","say ""hi"""\r\n1,2,3\r\n', ',')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', '2', '3'],
    ])
  })

  it('the delimiter is the one the header uses', () => {
    expect(detectDelimiter('Date;Amount;Description\n')).toBe(';')
    expect(detectDelimiter('Date\tAmount\n')).toBe('\t')
    expect(detectDelimiter('Date,Amount\n')).toBe(',')
  })
})

describe('a whole statement', () => {
  it('an Iranian export: Jalali dates, Persian digits, withdrawal and deposit columns', () => {
    const csv = [
      'تاریخ,شرح,برداشت,واریز,شماره پیگیری',
      '۱۴۰۵/۰۷/۰۱,کارمزد,۱۲٬۰۰۰,,۹۹۱',
      '۱۴۰۵/۰۷/۰۲,واریز مشتری,,۲٬۵۰۰٬۰۰۰,۹۹۲',
    ].join('\n')
    const result = parseBankStatementCsv(csv, 2)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.problems).toEqual([])
    expect(result.lines).toEqual([
      { onDate: '2026-09-23', amountMinor: -1200000, description: 'کارمزد', externalRef: '991' },
      {
        onDate: '2026-09-24',
        amountMinor: 250000000,
        description: 'واریز مشتری',
        externalRef: '992',
      },
    ])
  })

  it('a foreign export: one signed Amount, semicolons', () => {
    const csv = 'Date;Description;Amount;Reference\n2026-09-01;"Rent; September";-1200.00;TX1\n'
    const result = parseBankStatementCsv(csv, 2)
    expect(result.ok && result.lines).toEqual([
      {
        onDate: '2026-09-01',
        amountMinor: -120000,
        description: 'Rent; September',
        externalRef: 'TX1',
      },
    ])
  })

  it('an unreadable row is reported with its row number — never silently dropped', () => {
    const csv = 'Date,Amount,Description\n2026-09-01,100,ok\nnot a date,50,x\n2026-09-03,abc,y\n'
    const result = parseBankStatementCsv(csv, 2)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.lines.length).toBe(1)
    expect(result.problems.map((p) => [p.row, p.reason])).toEqual([
      [3, 'DATE'],
      [4, 'AMOUNT'],
    ])
  })

  it('a row with both a withdrawal and a deposit is a problem, not a netted guess', () => {
    const csv = 'Date,Debit,Credit\n2026-09-01,10,20\n'
    const result = parseBankStatementCsv(csv, 2)
    expect(result.ok && result.problems.map((p) => p.reason)).toEqual(['BOTH_SIDES'])
  })

  it('without a date or amount column it says which', () => {
    expect(parseBankStatementCsv('Foo,Amount\n1,2\n', 2)).toEqual({
      ok: false,
      reason: 'NO_DATE_COLUMN',
    })
    expect(parseBankStatementCsv('Date,Foo\n2026-01-01,2\n', 2)).toEqual({
      ok: false,
      reason: 'NO_AMOUNT_COLUMN',
    })
    expect(parseBankStatementCsv('Date,Amount\n', 2)).toEqual({ ok: false, reason: 'EMPTY' })
  })
})

describe('the bank screen imports', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const read = (p: string) =>
    strip(readFileSync(join(__dirname, '..', 'components', 'ui', 'bank', p), 'utf8'))

  it('the container calls the import hook it used to leave unused', () => {
    const container = read('containers/bank-container.tsx')
    expect(container).toContain('useImportStatement()')
    expect(container).toContain('importStatement.mutate(input')
  })

  it('the view mounts the importer', () => {
    expect(read('bank-view.tsx')).toContain('<ImportStatementPanel t={t} {...importer} />')
  })

  it('nothing is sent while a row is unreadable', () => {
    expect(read('import-statement-panel.tsx')).toContain('parsed.problems.length === 0 &&')
  })
})
