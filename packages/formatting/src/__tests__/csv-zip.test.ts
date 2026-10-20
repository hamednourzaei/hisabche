import { describe, expect, it } from 'vitest'

import { buildCsvZip } from '../table-export'

// Owner, 18 Oct 2026: «خروجی csv باز بکن» — one CSV per data set, in a zip.
describe('buildCsvZip', () => {
  it('one <name>.csv per table, UTF-8 with a BOM, quoting what needs it', () => {
    const bytes = buildCsvZip([
      { name: 'customers', rows: [{ name: 'علی, احمدی', phone: '0700' }] },
      { name: 'products', rows: [{ name: 'Rice "A"', price: 100 }] },
    ])
    const text = new TextDecoder().decode(bytes)
    expect(text.startsWith('PK')).toBe(true)
    expect(text).toContain('customers.csv')
    expect(text).toContain('products.csv')
    expect(text).toContain('﻿name,phone\r\n"علی, احمدی",0700\r\n')
    expect(text).toContain('"Rice ""A""",100')
  })
})
