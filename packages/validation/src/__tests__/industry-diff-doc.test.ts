// ============================================
// The generated industry-diff document is derived from the REAL registry, and
// the two representative invoice scenarios are executed through the shared
// rules the builder and the server both use.
//
// This is a documentation guard, not a second implementation:
//   · the tables are compared with `PROFILES` / `CAPABILITIES` imported here
//   · the invoice rows go through `rowTotal` / `rowToInvoiceItem` / `validateGrid`
//     (the same functions the invoice builder and API mapper call)
// ============================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  CAPABILITIES,
  CAPABILITY_KEYS,
  DASHBOARD_PART_IDS,
  INDUSTRY_KEYS,
  PROFILES,
  resolveBusinessProfile,
} from '../index'
import {
  COLUMN,
  applyInvoiceDefaults,
  defaultColumns,
  rowToInvoiceItem,
  rowTotal,
  validateGrid,
  type GridMoneyContext,
  type InvoiceGridRow,
} from '../schemas/invoice-grid'

const ROOT = resolve(__dirname, '../../../..')
const DOC = resolve(ROOT, 'docs/architecture/industry/industry-diff.generated.md')
const AFN: GridMoneyContext = { currency: 'AFN', precision: 0, rates: {} }

function section(markdown: string, open: string, close: string): string {
  const from = markdown.indexOf(open)
  const to = markdown.indexOf(close, from + open.length)
  return markdown.slice(from + open.length, to)
}

function rows(table: string): string[][] {
  return table
    .split('\n')
    .filter((line) => line.trim().startsWith('|'))
    .slice(2)
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim()),
    )
}

function list(values: readonly string[]): string {
  return values.length > 0 ? values.join('، ') : '—'
}

/** Throws with the first difference in the generated registry table. */
function assertDocumentMatchesRegistry(markdown: string): void {
  const table = rows(
    section(markdown, '<!-- industry-registry-table -->', '<!-- /industry-registry-table -->'),
  )
  expect(table.length, 'the registry table has one row per industry key').toBe(INDUSTRY_KEYS.length)

  const byKey = new Map(table.map((cells) => [cells[1]!.replaceAll('`', ''), cells]))

  for (const key of INDUSTRY_KEYS) {
    const cells = byKey.get(key)
    expect(cells, `missing registry row for ${key}`).toBeDefined()
    const profile = PROFILES[key]
    const expected = [
      cells![0]!,
      `\`${key}\``,
      cells![2]!,
      cells![3]!,
      profile.kind === 'specialized' ? 'تخصصی' : 'پایه (عمومی)',
      list(profile.capabilities),
      `\`${profile.productDefaults.unit}\``,
      list(profile.invoiceDefaults.extraVisibleColumns),
      profile.invoiceDefaults.priceMultiplierSource
        ? `\`${profile.invoiceDefaults.priceMultiplierSource}\``
        : '—',
      list(profile.productDefaults.emphasizedFields),
      list(profile.dashboard),
      list(Object.entries(profile.vocabulary).map(([name, value]) => `${name}=${value}`)),
    ]
    expect(cells, `registry row for ${key}`).toEqual(expected)
    expect(cells![0], `label for ${key}`).not.toBe('—')
    expect(DASHBOARD_PART_IDS.length, `dashboard for ${key}`).toBeGreaterThan(0)
  }

  const capabilityTable = rows(
    section(markdown, '<!-- industry-capability-table -->', '<!-- /industry-capability-table -->'),
  )
  const capabilities = new Map(
    capabilityTable.map((cells) => [cells[0]!.replaceAll('`', ''), cells]),
  )
  for (const key of CAPABILITY_KEYS) {
    const cells = capabilities.get(key)
    expect(cells, `missing capability row for ${key}`).toBeDefined()
    const status = CAPABILITIES[key].status
    expect(cells![1], `status for ${key}`).toBe(status)
    expect(cells![2], `active column for ${key}`).toBe(
      status === 'available' ? 'فعال' : 'فعال نیست',
    )
  }
}

const row = (values: Record<string, string>, productUnit: string): InvoiceGridRow => ({
  id: 'r1',
  productUnit,
  values,
})

describe('industry-diff.generated.md', () => {
  it('matches the real registry, all 61 industries and all capabilities', () => {
    assertDocumentMatchesRegistry(readFileSync(DOC, 'utf8'))
  })

  it('is protected against a changed generated value', () => {
    const markdown = readFileSync(DOC, 'utf8')
    const lines = markdown.split('\n')
    const index = lines.findIndex((line) => /^\|\s*طلا و جواهر\s*\|/.test(line))
    expect(index, 'jewellery row exists').toBeGreaterThan(-1)
    const mutated = [...lines]
    mutated[index] = mutated[index]!.replace('measurement', 'gold_purity')
    expect(mutated[index]).not.toBe(lines[index])
    expect(() => assertDocumentMatchesRegistry(mutated.join('\n'))).toThrow()
    // The untouched document still passes.
    expect(() => assertDocumentMatchesRegistry(markdown)).not.toThrow()
  })
})

describe('executed invoice scenarios', () => {
  const baseColumns = defaultColumns('AFN')

  it('jewellery — 15 grams at 33,000,000 per gram', () => {
    const profile = resolveBusinessProfile(['jewellery'])
    expect(profile.primary).toBe('jewellery')
    expect(profile.productDefaults.unit).toBe('gram')
    const columns = applyInvoiceDefaults(baseColumns, profile.invoiceDefaults)
    expect(columns.find((column) => column.id === 'weightGrams')?.visible).toBe(true)

    const necklace = row(
      {
        [COLUMN.description]: 'گردنبند',
        [COLUMN.quantity]: '15',
        [COLUMN.unit]: 'gram',
        [COLUMN.unitPrice]: '33000000',
      },
      'gram',
    )

    expect(rowTotal(necklace, columns, AFN)).toBe(495_000_000)
    const item = rowToInvoiceItem(necklace, columns, AFN)
    expect(item?.quantity).toBe(15)
    expect(item?.unit).toBe('gram')
    expect(item?.unitPrice).toBe(33_000_000)
    expect(item?.totalPrice).toBe(495_000_000)
    expect(validateGrid([necklace], columns, AFN)).toEqual([])
  })

  it('glassware — 12 glasses at 25,000 per glass', () => {
    const profile = resolveBusinessProfile(['kitchenware'])
    expect(profile.primary).toBe('kitchenware')
    expect(profile.isGeneric).toBe(true)
    expect(profile.productDefaults.unit).toBe('piece')
    expect(profile.invoiceDefaults.extraVisibleColumns).toEqual([])
    const columns = applyInvoiceDefaults(baseColumns, profile.invoiceDefaults)

    const glasses = row(
      {
        [COLUMN.description]: 'لیوان',
        [COLUMN.quantity]: '12',
        [COLUMN.unit]: 'piece',
        [COLUMN.unitPrice]: '25000',
      },
      'piece',
    )

    expect(rowTotal(glasses, columns, AFN)).toBe(300_000)
    const item = rowToInvoiceItem(glasses, columns, AFN)
    expect(item?.quantity).toBe(12)
    expect(item?.unit).toBe('piece')
    expect(item?.unitPrice).toBe(25_000)
    expect(item?.totalPrice).toBe(300_000)
    expect(validateGrid([glasses], columns, AFN)).toEqual([])
  })

  it('measured product sold as pieces is refused, not repriced silently', () => {
    const profile = resolveBusinessProfile(['jewellery'])
    const columns = applyInvoiceDefaults(baseColumns, profile.invoiceDefaults)
    const wrong = row(
      {
        [COLUMN.description]: 'گردنبند',
        [COLUMN.quantity]: '15',
        [COLUMN.unit]: 'piece',
        [COLUMN.unitPrice]: '33000000',
      },
      'gram',
    )
    expect(validateGrid([wrong], columns, AFN).map((issue) => issue.key)).toContain(
      'invoiceBuilder.errors.unitMismatch',
    )
  })
})
