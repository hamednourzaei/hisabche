// ============================================
// §39 rollback · §40 import profiles · §41 export symmetry.
//
// The three parts of the migration centre that decide what happens AFTER an
// import — and the three places a careless implementation destroys data.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  EXPORT_COLUMNS,
  applyProfile,
  dispositionOf,
  isRoundTrippable,
  planRollback,
  toCsvRow,
  toProfile,
  type ImportProfile,
  type RollbackCandidate,
} from '../services/migration/migration.recovery'
import { parseDelimited } from '../services/migration/migration.domain'
import { suggestMapping } from '../services/migration/migration.entities'

const created = (id: string, dependentCount = 0): RollbackCandidate => ({
  targetId: id,
  outcome: 'created',
  dependentCount,
})

describe('§39 — rollback never becomes a blanket delete', () => {
  it('removes a created row nothing depends on', () => {
    expect(dispositionOf(created('a'))).toBe('deletable')
  })

  it('KEEPS a created row a real business has built on', () => {
    // The customer the import made is now on three invoices. Deleting them
    // orphans financial records — which is the failure §39 exists to prevent.
    expect(dispositionOf(created('a', 3))).toBe('kept_has_dependents')
  })

  it('never reverts a row the import merely UPDATED', () => {
    // The pre-import values were never recorded, so "undo" would mean writing
    // a guess over something a person may have corrected by hand since.
    expect(dispositionOf({ targetId: 'a', outcome: 'updated', dependentCount: 0 })).toBe(
      'kept_was_update',
    )
  })

  it('sorts a mixed migration into three honest buckets', () => {
    const plan = planRollback('customer', [
      created('free-1'),
      created('free-2'),
      created('busy', 2),
      { targetId: 'touched', outcome: 'updated', dependentCount: 0 },
    ])

    expect(plan.deletable).toEqual(['free-1', 'free-2'])
    expect(plan.keptHasDependents).toEqual(['busy'])
    expect(plan.keptWasUpdate).toEqual(['touched'])
  })

  it('calls a rollback complete only when every CREATED row can go', () => {
    expect(planRollback('customer', [created('a'), created('b')]).complete).toBe(true)
    expect(planRollback('customer', [created('a'), created('b', 1)]).complete).toBe(false)
  })

  it('counts updated rows as outside the question, not as failures', () => {
    // Otherwise a complete rollback would be impossible by definition on any
    // migration that updated anything, and the flag would mean nothing.
    const plan = planRollback('customer', [
      created('a'),
      { targetId: 'b', outcome: 'updated', dependentCount: 0 },
    ])
    expect(plan.complete).toBe(true)
  })

  it('is not complete when the migration created nothing', () => {
    // "Complete" on an empty set would report success for a rollback that did
    // nothing at all.
    expect(planRollback('customer', []).complete).toBe(false)
  })
})

/* ─── §40 ─────────────────────────────────────────────────────────────────── */

const HEADERS = ['Customer Name', 'Mobile', 'Email', 'City']

const profile = (): ImportProfile =>
  toProfile('p1', 'Odoo customers', 'customer', HEADERS, {
    fullName: 0,
    phone: 1,
    email: 2,
    address: 3,
  })

describe('§40 — a profile stores column NAMES, never indexes', () => {
  it('records names', () => {
    // An index is a fact about ONE file. The next export has the same columns
    // in a different order the moment somebody adds one, and a saved index
    // would then map `phone` onto a financial field. Silently.
    expect(profile().columnsByName).toEqual({
      fullName: 'Customer Name',
      phone: 'Mobile',
      email: 'Email',
      address: 'City',
    })
  })

  it('re-resolves indexes when the columns move', () => {
    const reordered = ['City', 'Customer Name', 'Email', 'Mobile']
    const fit = applyProfile(profile(), 'customer', reordered)

    expect(fit.fits).toBe(true)
    if (!fit.fits) return
    expect(fit.mapping).toEqual({ fullName: 1, phone: 3, email: 2, address: 0 })
  })

  it('survives a NEW column being inserted', () => {
    const withExtra = ['Id', 'Customer Name', 'Mobile', 'Email', 'City']
    const fit = applyProfile(profile(), 'customer', withExtra)

    expect(fit.fits).toBe(true)
    if (!fit.fits) return
    expect(fit.drifted).toBe(false)
    expect(fit.mapping['fullName']).toBe(1)
  })

  it('reports drift rather than applying a stale mapping silently', () => {
    // §40 in one test: a column has gone, the profile still mostly works, and
    // the user is TOLD which one is missing.
    const withoutEmail = ['Customer Name', 'Mobile', 'City']
    const fit = applyProfile(profile(), 'customer', withoutEmail)

    expect(fit.fits).toBe(true)
    if (!fit.fits || !fit.drifted) throw new Error('expected drift')
    expect(fit.missing).toEqual(['Email'])
    expect(fit.mapping['email']).toBeUndefined()
  })

  it('refuses a profile built for a different entity', () => {
    expect(applyProfile(profile(), 'product', HEADERS)).toEqual({
      fits: false,
      reason: 'WRONG_ENTITY',
    })
  })

  it('refuses a file with nothing in common', () => {
    expect(applyProfile(profile(), 'customer', ['a', 'b'])).toEqual({
      fits: false,
      reason: 'NO_COLUMNS_MATCH',
    })
  })

  it('ignores surrounding whitespace, which every spreadsheet adds', () => {
    const padded = ['  Customer Name ', 'Mobile', 'Email', 'City']
    const fit = applyProfile(profile(), 'customer', padded)
    expect(fit.fits && !fit.drifted).toBe(true)
  })
})

/* ─── §41 ─────────────────────────────────────────────────────────────────── */

describe('§41 — export and import are complementary', () => {
  it('puts the internal id first, as externalId', () => {
    // This is what makes a round trip MATCH existing rows instead of creating
    // twins. Without it, export-then-import is a duplication machine.
    expect(EXPORT_COLUMNS.customer[0]).toBe('externalId')
    expect(EXPORT_COLUMNS.product[0]).toBe('externalId')
  })

  it('omits openingBalance, because the importer refuses to write it', () => {
    // `updateEntity` never restates an opening balance — transactions have
    // moved it since. Exporting a field the importer will not accept is a
    // promise of a round trip that does not happen.
    expect(isRoundTrippable('customer', 'openingBalance')).toBe(false)
    expect(isRoundTrippable('customer', 'fullName')).toBe(true)
  })

  it('produces a file THIS parser reads back to the same values', () => {
    // The actual round trip, not a claim about one.
    const rows = [
      ['id-1', 'Ahmadi, Karim', '0700123456', '', 'Kabul "old" city', 'notes', 'cash'],
      ['id-2', 'Line\nbreak', '0700999888', 'a@b.com', '', '', 'credit'],
    ]
    const csv = [toCsvRow([...EXPORT_COLUMNS.customer]), ...rows.map(toCsvRow)].join('\n')

    const table = parseDelimited(csv)

    expect(table.headers).toEqual([...EXPORT_COLUMNS.customer])
    expect(table.raggedRows).toEqual([])
    // The comma inside a name, the embedded quotes and the newline all survive.
    expect(table.rows[0]?.[1]).toBe('Ahmadi, Karim')
    expect(table.rows[0]?.[4]).toBe('Kabul "old" city')
    expect(table.rows[1]?.[1]).toBe('Line\nbreak')
  })

  it('exports headers the mapper recognises with no manual work', () => {
    // The point of symmetry: re-importing our own export should need zero
    // mapping. Every exported column must map back to the field it came from.
    const suggestions = suggestMapping('customer', [...EXPORT_COLUMNS.customer])

    for (const column of EXPORT_COLUMNS.customer) {
      const hit = suggestions.find((suggestion) => suggestion.sourceHeader === column)
      expect(hit?.targetField, `${column} did not map back`).toBe(column)
      expect(hit?.status).toBe('matched')
    }
  })

  it('exports product headers that map back too', () => {
    const suggestions = suggestMapping('product', [...EXPORT_COLUMNS.product])

    for (const column of EXPORT_COLUMNS.product) {
      const hit = suggestions.find((suggestion) => suggestion.sourceHeader === column)
      expect(hit?.targetField, `${column} did not map back`).toBe(column)
    }
  })
})
