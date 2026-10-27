import { describe, expect, it } from 'vitest'
import { toCSV, UTF8_BOM, type CsvColumn } from '../csv'

describe('toCSV with footer support (Option 38)', () => {
  interface Row {
    id: string
    name: string
    amount: number
  }

  const columns: CsvColumn<Row>[] = [
    { key: 'name', label: 'Item' },
    { key: 'amount', label: 'Amount' },
  ]

  const rows: Row[] = [
    { id: '1', name: 'Product A', amount: 100 },
    { id: '2', name: 'Product B', amount: 200 },
  ]

  it('renders CSV with UTF-8 BOM and rows', () => {
    const csv = toCSV(rows, columns)
    expect(csv.startsWith(UTF8_BOM)).toBe(true)
    expect(csv).toContain('"Item","Amount"')
    expect(csv).toContain('"Product A","100"')
    expect(csv).toContain('"Product B","200"')
  })

  it('appends footer row when provided', () => {
    const csv = toCSV(rows, columns, { footer: ['Total', 300] })
    expect(csv.endsWith('"Total","300"')).toBe(true)
  })

  it('returns empty string for empty rows', () => {
    expect(toCSV([], columns)).toBe('')
  })
})
