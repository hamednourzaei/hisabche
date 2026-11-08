// ============================================
// V54 5.4 (8 Nov 2026) — a booking deposit is an order deposit whose document
// is a service session. One engine; these guards keep it that way.
// ============================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')
const flat = (rel: string) =>
  readFileSync(join(SRC, rel), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '')
    .split(/\s+/)
    .join(' ')

describe('booking deposit', () => {
  const route = flat('routes/order-deposit.routes.ts')
  const service = flat('services/sales/order-deposit.service.ts')

  it('the route accepts the kind and checks the session belongs to that customer', () => {
    expect(route).toContain("sourceType: z.enum(['sales_order', 'service_session']).optional()")
    expect(route).toContain('const session = await sessions.getById(request.tenancy, id)')
    expect(route).toContain("throw new ValidationError('SESSION_DEPOSIT_CUSTOMER_MISMATCH')")
  })

  it('the service writes the kind only when it is not an order, and says when the column is missing', () => {
    expect(service).toContain("...(kind !== 'sales_order' ? { source_type: kind } : {})")
    expect(service).toContain(
      "isAdvance ? 'ADVANCES_NOT_CONFIGURED' : 'SESSION_DEPOSIT_NOT_CONFIGURED'",
    )
  })

  it('the money is the same entry as any deposit: Dr cash|bank / Cr customer advances', () => {
    expect(service).toContain("sourceType: 'order_deposit'")
    expect(service).toContain('`بیعانه نوبت ${deposit.order_id}`')
  })

  it('no second deposit table or route was made', () => {
    const sessions = flat('routes/service-delivery.routes.ts')
    expect(sessions).not.toContain('deposit')
  })
})
