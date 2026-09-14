import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { stockStateOf } from '../lib/warehouse/stock-state'

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

describe('BUG-003 — one stock-state rule', () => {
  it('negative and zero are out of stock; at or under the minimum is low', () => {
    expect(stockStateOf(-98, 5)).toBe('out')
    expect(stockStateOf(0, 5)).toBe('out')
    expect(stockStateOf(5, 5)).toBe('low')
    expect(stockStateOf(6, 5)).toBe('ok')
  })

  it.each([
    '../hooks/warehouse/use-warehouse.ts',
    '../components/ui/warehouse-detail/containers/warehouse-detail-container.tsx',
  ])('%s uses the shared rule, no local `=== 0`', (file) => {
    const src = strip(readFileSync(join(__dirname, file), 'utf8'))
    expect(src).toContain('stockStateOf(')
    expect(src).not.toMatch(/quantity === 0/)
  })
})
