// «Cannot read properties of undefined (reading 'productCount')» on the
// warehouse page, offline (24 Oct 2026).
//
// The offline engine used to answer /warehouses/overview without a `summary`
// for each warehouse (fixed in the engine — see local-engine server-shapes),
// but an app built before that fix, or an answer cached on the device, still
// carries the old shape. A type annotation is not a runtime check: the list
// must read a row's figures defensively, and show «—» rather than «۰».
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  join(__dirname, '..', 'components', 'ui', 'warehouse', 'warehouse-list-table.tsx'),
  'utf8',
)
  .split('\n')
  .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
  .join('\n')

describe('the warehouse list reads a row without a summary', () => {
  it('never dereferences row.summary directly', () => {
    expect(source).not.toMatch(/row\.summary\.[a-zA-Z]/)
  })

  it('takes a missing summary as null, not as zero', () => {
    expect(source).toContain('summary: StockSummary | null')
    expect(source).toContain('.summary ?? null')
    expect(source).toContain("'—'")
  })
})
