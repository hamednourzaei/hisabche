// Owner, 18 Oct 2026: gearbox (30,000,000 afghani) picked, then «دالر» and
// «1 دالر = 65 افغانی» — the line stayed 30,000,000 and became 60M DOLLARS.
import { describe, expect, it } from 'vitest'

import { repriceAutoFilled } from '../lib/invoices/exchange-rate'

describe('repriceAutoFilled', () => {
  const auto = new Map([['r1', { booksPrice: '30000000', filled: '30000000' }]])

  it('AFN → USD at 65 re-prices the app-filled line: 461,538.46 dollars, not 30M', () => {
    const out = repriceAutoFilled(new Map([['r1', '30000000']]), auto, 'USD', 'AFN', 65)
    expect(out.get('r1')).toBe('461538.46')
  })

  it('USD with no rate yet empties the line rather than keep afghani as dollars', () => {
    const out = repriceAutoFilled(new Map([['r1', '30000000']]), auto, 'USD', 'AFN', null)
    expect(out.get('r1')).toBe('')
  })

  it('a price the person typed is never touched', () => {
    const out = repriceAutoFilled(new Map([['r1', '400000']]), auto, 'USD', 'AFN', 65)
    expect(out.size).toBe(0)
  })

  it('back to the books currency restores the books price', () => {
    const usd = new Map([['r1', { booksPrice: '30000000', filled: '461538.46' }]])
    const out = repriceAutoFilled(new Map([['r1', '461538.46']]), usd, 'AFN', 'AFN', null)
    expect(out.get('r1')).toBe('30000000')
  })
})
