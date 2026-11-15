// ============================================
// POST /api/customers without a name is a 400 that names the field, never a 500.
// ============================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const route = readFileSync(join(__dirname, '..', 'routes', 'customer.routes.ts'), 'utf8')

describe('customer name is required at the route', () => {
  it('refuses a missing or blank fullName before the service is called', () => {
    const post = route.slice(route.indexOf("fastify.post(\n    '/api/customers',"))
    const check = post.indexOf("code: 'CUSTOMER_NAME_REQUIRED'")
    const create = post.indexOf('customerService.create(')
    expect(check).toBeGreaterThan(-1)
    expect(check).toBeLessThan(create)
    expect(post).toContain("typeof fullName !== 'string' || fullName.trim() === ''")
    expect(post).toContain("details: [{ path: ['fullName'], message: 'validation.required' }]")
  })
})
