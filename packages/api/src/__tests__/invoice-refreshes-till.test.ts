// Owner, 18 Oct 2026: after issuing an invoice, the till's «موجودی ثبت‌شده»
// only changed on a hard refresh. Every invoice mutation must invalidate the
// till queries, and the session read must not sit on a long stale window.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const hooks = join(__dirname, '..', 'hooks')
const read = (f: string) => readFileSync(join(hooks, f), 'utf8').split(/\s+/).join(' ')

describe('an invoice refreshes the till', () => {
  it('each invoice mutation that refreshes payments also refreshes the till', () => {
    const src = read('invoices.ts')
    const payments = src.split('queryKey: paymentKeys.all }').length - 1
    const till = src.split("queryKey: ['till'] }").length - 1
    expect(payments).toBeGreaterThan(0)
    expect(till).toBe(payments)
  })

  it('useSession re-reads within seconds', () => {
    const src = read('till.ts')
    const body = src.slice(src.indexOf('export function useSession('))
    expect(body.slice(0, 600)).toContain('staleTime: 5_000')
  })
})
