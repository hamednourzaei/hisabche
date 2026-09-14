// ============================================
// backend/src/__tests__/pos-payments-columns.test.ts
//
// Every /api/pos/* route answered 500 in production because the till read
// `payments.user_id` and `payments.deleted_at` — columns the live `payments`
// table does not have (docs/payments-ar-ap-migration.sql: the actor is
// `created_by`; a payment is cancelled by status, never soft-deleted).
// The fake database accepts any column, so only a source check catches this.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(join(__dirname, '..', 'services', 'pos', 'pos.service.ts'), 'utf8')

function paymentChains(code: string): string[] {
  const chains: string[] = []
  const re = /\.from\('payments'\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) {
    const rest = code.slice(m.index)
    const next = rest.indexOf(".from('", 5)
    chains.push(next === -1 ? rest : rest.slice(0, next))
  }
  return chains
}

describe('the till reads only columns payments actually has', () => {
  const chains = paymentChains(source)

  it('finds the payment reads', () => {
    expect(chains.length).toBeGreaterThanOrEqual(2)
  })

  it('never uses payments.user_id or payments.deleted_at', () => {
    for (const chain of chains) {
      expect(chain).not.toContain('deleted_at')
      expect(chain).not.toMatch(/\buser_id\b/)
    }
  })
})
