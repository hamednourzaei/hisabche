// ============================================
// The importer, against the files real businesses actually send.
//
// Every case here is a shape that has broken an importer somewhere: a
// semicolon CSV from a comma-decimal locale, a name with a comma in it, a
// price written `1.234,50`, a date that means two different days, a phone
// number written four ways, and an xlsx renamed to .csv.
//
// The point of testing the pure layer this hard is that the alternative is
// finding out from a customer whose four thousand products all imported at a
// hundredth of their price.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  checkIntake,
  checkParsed,
  comparisonKey,
  detectDelimiter,
  normalizePhone,
  parseBoolean,
  parseDateIso,
  parseDelimited,
  parseMoneyMinor,
} from '../services/migration/migration.domain'
import {
  businessKeys,
  detectSource,
  suggestMapping,
} from '../services/migration/migration.entities'
import { dryRun, reconcile, validateRows } from '../services/migration/migration.validate'

describe('intake refuses what it cannot read', () => {
  it('refuses an empty file', () => {
    expect(checkIntake('')?.code).toBe('FILE_EMPTY')
  })

  it('refuses a zip container renamed to .csv', () => {
    // Every xlsx is a zip. A user who picks the wrong file gets a sentence,
    // not eleven thousand customers named after zip headers.
    expect(checkIntake('PKrest')?.code).toBe('BINARY_CONTENT')
  })

  it('refuses binary content anywhere in the file', () => {
    expect(checkIntake('name,phone\nAli,\u0000700')?.code).toBe('BINARY_CONTENT')
  })

  it('accepts ordinary Persian text', () => {
    expect(checkIntake('نام,تلفن\nاحمدی,0700123456')).toBeNull()
  })

  it('refuses a file with no header row', () => {
    expect(checkParsed(parseDelimited(''))?.code).toBe('NO_HEADER_ROW')
  })
})

describe('delimiter detection', () => {
  it('finds the semicolon a comma-decimal locale writes', () => {
    expect(detectDelimiter('name;price;qty')).toBe(';')
  })

  it('ignores delimiters inside quotes', () => {
    // The header is one quoted field containing three commas. Counting them
    // would turn a one-column file into a four-column one.
    expect(detectDelimiter('"name, with, commas";price')).toBe(';')
  })

  it('falls back to a comma when nothing separates anything', () => {
    expect(detectDelimiter('name')).toBe(',')
  })
})

describe('parsing', () => {
  it('keeps a comma that lives inside a quoted name', () => {
    const table = parseDelimited('name,phone\n"Ahmadi, Karim",0700123456')
    expect(table.rows[0]).toEqual(['Ahmadi, Karim', '0700123456'])
  })

  it('reads a doubled quote as one quote', () => {
    const table = parseDelimited('name\n"He said ""hello"""')
    expect(table.rows[0]?.[0]).toBe('He said "hello"')
  })

  it('reads a newline inside a quoted field', () => {
    const table = parseDelimited('name,address\nAli,"Kabul\nStreet 4"')
    expect(table.rows).toHaveLength(1)
    expect(table.rows[0]?.[1]).toBe('Kabul\nStreet 4')
  })

  it('strips a BOM so the first header still matches', () => {
    const table = parseDelimited('﻿name,phone\nAli,0700')
    expect(table.headers[0]).toBe('name')
  })

  it('handles CRLF', () => {
    const table = parseDelimited('name,phone\r\nAli,0700\r\n')
    expect(table.rows).toEqual([['Ali', '0700']])
  })

  it('does not invent a row from a trailing newline', () => {
    expect(parseDelimited('name\nAli\n').rows).toHaveLength(1)
  })

  it('RECORDS a ragged row rather than dropping it', () => {
    // Silently skipping records is the forbidden behaviour. The row is padded
    // so the mapping can read it, and reported so the user can fix it.
    const table = parseDelimited('a,b,c\n1,2,3\n4,5')
    expect(table.raggedRows).toEqual([1])
    expect(table.rows[1]).toEqual(['4', '5', ''])
  })
})

describe('money — the case that silently loses two decimal places', () => {
  it('reads a plain amount', () => {
    expect(parseMoneyMinor('1234.50')).toEqual({ ok: true, minor: 123450 })
  })

  it('reads the European form', () => {
    // `1.234,50` through parseFloat is 1.234. This is the bug that imports a
    // whole catalogue at a thousandth of its price.
    expect(parseMoneyMinor('1.234,50')).toEqual({ ok: true, minor: 123450 })
  })

  it('reads the Anglo form', () => {
    expect(parseMoneyMinor('1,234.50')).toEqual({ ok: true, minor: 123450 })
  })

  it('treats a lone three-digit group as thousands, not decimals', () => {
    expect(parseMoneyMinor('1,500')).toEqual({ ok: true, minor: 150000 })
  })

  it('reads Persian digits', () => {
    expect(parseMoneyMinor('۱۲۳۴')).toEqual({ ok: true, minor: 123400 })
  })

  it('reads parentheses as negative', () => {
    expect(parseMoneyMinor('(250.00)').minor).toBe(-25000)
  })

  it('REFUSES an amount it cannot read rather than guessing zero', () => {
    expect(parseMoneyMinor('about 500').ok).toBe(true) // digits are present
    expect(parseMoneyMinor('n/a').ok).toBe(false)
    expect(parseMoneyMinor('').reason).toBe('EMPTY')
  })

  it('refuses a number too large to stay exact', () => {
    expect(parseMoneyMinor('9'.repeat(20)).reason).toBe('TOO_LARGE')
  })
})

describe('dates — ambiguity is refused, not guessed', () => {
  it('reads ISO', () => {
    expect(parseDateIso('2024-12-31').iso).toBe('2024-12-31')
  })

  it('settles dd/mm when no month can be 31', () => {
    expect(parseDateIso('31/12/2024').iso).toBe('2024-12-31')
  })

  it('settles mm/dd when the second number cannot be a month', () => {
    expect(parseDateIso('12/31/2024').iso).toBe('2024-12-31')
  })

  it('REFUSES 03/04/2024 when the source order is unknown', () => {
    // Two different days. The roadmap forbids interpreting this silently.
    expect(parseDateIso('03/04/2024').reason).toBe('AMBIGUOUS_ORDER')
  })

  it('accepts it once the source declares its order', () => {
    expect(parseDateIso('03/04/2024', true).iso).toBe('2024-04-03')
    expect(parseDateIso('03/04/2024', false).iso).toBe('2024-03-04')
  })

  it('rejects a day that does not exist', () => {
    expect(parseDateIso('2024-02-31').reason).toBe('OUT_OF_RANGE')
  })
})

describe('phone normalisation decides whether a duplicate is seen', () => {
  it('reduces every written form to one', () => {
    const forms = ['0700123456', '+93700123456', '0093700123456', '93700123456', '070 012 3456']
    const normalised = new Set(forms.map(normalizePhone))
    expect(normalised.size).toBe(1)
    expect([...normalised][0]).toBe('0700123456')
  })
})

describe('comparison keys see through invisible characters', () => {
  it('matches a name written with and without a zero-width non-joiner', () => {
    // Persian writes ZWNJ inside ordinary words. One export having it and
    // another not is the commonest reason a duplicate is missed.
    expect(comparisonKey('علی‌احمدی')).toBe(comparisonKey('علیاحمدی'))
  })
})

describe('booleans', () => {
  it('reads both languages and returns null for anything else', () => {
    expect(parseBoolean('بله')).toBe(true)
    expect(parseBoolean('no')).toBe(false)
    expect(parseBoolean('maybe')).toBeNull()
  })
})

describe('mapping suggestions', () => {
  it('matches exact headers in either language', () => {
    const suggestions = suggestMapping('customer', ['نام', 'phone', 'nonsense'])
    expect(suggestions[0]).toMatchObject({ targetField: 'fullName', status: 'matched' })
    expect(suggestions[1]).toMatchObject({ targetField: 'phone', status: 'matched' })
    expect(suggestions[2]).toMatchObject({ targetField: null, status: 'unsupported' })
  })

  it('marks a contained match as needing review rather than applying it', () => {
    const [suggestion] = suggestMapping('customer', ['customer_phone_number'])
    expect(suggestion?.targetField).toBe('phone')
    expect(suggestion?.status).toBe('needs_review')
  })

  it('never maps two columns onto one field', () => {
    const suggestions = suggestMapping('product', ['price', 'sell price'])
    const fields = suggestions.map((suggestion) => suggestion.targetField).filter(Boolean)
    expect(new Set(fields).size).toBe(fields.length)
  })

  it('gives the exact header the field, not the partial one', () => {
    const suggestions = suggestMapping('product', ['price', 'sell price'])
    expect(suggestions.find((s) => s.sourceHeader === 'sell price')?.targetField).toBe('sellPrice')
  })
})

describe('source detection claims nothing it cannot show', () => {
  it('names a system only on two independent markers', () => {
    const guess = detectSource(['External ID', 'Display Name', 'name'])
    expect(guess.system).toBe('odoo')
    expect(guess.confidence).toBe('high')
  })

  it('admits it does not know', () => {
    const guess = detectSource(['name', 'phone', 'address'])
    expect(guess.system).toBe('generic_spreadsheet')
    expect(guess.confidence).toBe('low')
    expect(guess.evidence).toEqual([])
  })
})

describe('validation', () => {
  const headers = ['name', 'phone', 'balance']
  const mapping = { fullName: 0, phone: 1, openingBalance: 2 }

  it('is fatal when a required field has no column at all', () => {
    const result = validateRows('customer', headers, [['Ali', '0700', '10']], { phone: 1 })
    expect(result.findings.some((f) => f.code === 'REQUIRED_FIELD_UNMAPPED')).toBe(true)
    expect(result.counts.valid).toBe(0)
  })

  it('is fatal on unreadable money even though the field is optional', () => {
    // A price the importer quietly zeroed is a product sold at a loss.
    const result = validateRows('customer', headers, [['Ali', '0700', 'n/a']], mapping)
    expect(result.findings.some((f) => f.code === 'MONEY_UNREADABLE')).toBe(true)
    expect(result.counts.valid).toBe(0)
  })

  it('warns rather than fails on an unreadable phone', () => {
    const result = validateRows('customer', headers, [['Ali', 'call the shop', '0']], mapping)
    expect(result.counts.valid).toBe(1)
    expect(result.findings.some((f) => f.severity === 'warning')).toBe(true)
  })

  it('names the source column so the user can go and fix it', () => {
    const result = validateRows('customer', headers, [['', '0700', '0']], mapping)
    const fatal = result.findings.find((f) => f.severity === 'fatal')
    expect(fatal?.column).toBe('name')
    expect(fatal?.row).toBe(1)
  })

  it('flags the SECOND of two rows sharing a phone, not the first', () => {
    const result = validateRows(
      'customer',
      headers,
      [
        ['Ali', '0700123456', '0'],
        ['Ali Ahmadi', '+93700123456', '0'],
      ],
      mapping,
    )
    const duplicate = result.findings.find((f) => f.code === 'DUPLICATE_IN_FILE')
    expect(duplicate?.row).toBe(2)
    expect(duplicate?.detail).toBe('1')
    expect(result.counts.valid).toBe(1)
  })

  it('counts every row it scanned, so the report adds up', () => {
    const result = validateRows(
      'customer',
      headers,
      [
        ['Ali', '0700123456', '0'],
        ['', '0700999999', '0'],
      ],
      mapping,
    )
    expect(result.counts.scanned).toBe(2)
    expect(result.counts.valid + result.counts.fatal).toBe(2)
  })
})

describe('business keys', () => {
  it('ranks a source id above a phone and a name below both', () => {
    const keys = businessKeys('customer', {
      externalId: 'C-1',
      phone: '0700123456',
      fullName: 'Ali',
    })
    expect(keys.find((k) => k.kind === 'external')?.strength).toBe('strong')
    expect(keys.find((k) => k.kind === 'name')?.strength).toBe('weak')
  })
})

describe('dry run', () => {
  const build = (values: Record<string, string | number>, row = 1) => ({
    row,
    values,
    keys: businessKeys(
      'customer',
      Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])),
    ),
    importable: true,
  })

  it('says it changed nothing', () => {
    const summary = dryRun('customer', [], new Set())
    expect(summary.productionDataChanged).toBe(false)
  })

  it('counts a row whose phone already exists as an update', () => {
    const summary = dryRun(
      'customer',
      [build({ fullName: 'Ali', phone: '0700123456' })],
      new Set(['phone:0700123456']),
    )
    expect(summary.toUpdate).toBe(1)
    expect(summary.toCreate).toBe(0)
  })

  it('flags a row identified only by name as needing review', () => {
    // Two shops in one town genuinely share a name, and merging them is not
    // recoverable — so it is a review item, never an automatic match.
    const summary = dryRun('customer', [build({ fullName: 'Ali' })], new Set())
    expect(summary.needsReview).toBe(1)
    expect(summary.toCreate).toBe(1)
  })

  it('totals the money that would be written, in minor units', () => {
    const summary = dryRun(
      'customer',
      [
        build({ fullName: 'A', phone: '0700000001', openingBalance: 123450 }),
        build({ fullName: 'B', phone: '0700000002', openingBalance: 76550 }, 2),
      ],
      new Set(),
    )
    expect(summary.financialImpactMinor['openingBalance']).toBe(200000)
  })

  it('never counts an unimportable row as something it will write', () => {
    const summary = dryRun(
      'customer',
      [{ ...build({ fullName: 'A' }), importable: false }],
      new Set(),
    )
    expect(summary.toCreate).toBe(0)
    expect(summary.toSkip).toBe(1)
  })
})

describe('reconciliation', () => {
  it('matches when the totals agree', () => {
    const result = reconcile({ created: 10, updated: 2 }, { created: 10, updated: 2 })
    expect(result.matched).toBe(true)
  })

  it('reports the difference rather than rounding it away', () => {
    const result = reconcile({ created: 10 }, { created: 9 })
    expect(result.matched).toBe(false)
    expect(result.lines[0]?.differenceValue).toBe(-1)
  })

  it('treats a measure missing from one side as zero, not as agreement', () => {
    const result = reconcile({ created: 5 }, {})
    expect(result.matched).toBe(false)
  })
})
