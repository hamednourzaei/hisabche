// ============================================
// PHASE 3 — the scope check is CALLED, not merely written.
//
// ---------------------------------------------------------------------------
// WHY THIS TEST EXISTS
//
// `scope.domain.ts` was correct and fully tested for an entire session while
// being called by exactly nothing. Every one of its unit tests passed, and a
// seller could still edit another seller's invoice.
//
// That is the failure mode this guards: a security rule that exists, is
// tested, and is not reached. A unit test on the rule cannot see it; only
// reading the call sites can.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SERVICES = join(__dirname, '..', 'services')

function source(file: string): string {
  // Comments first — a mutation explained in prose is not a mutation guarded.
  return readFileSync(join(SERVICES, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

/**
 * The body of one method, bounded at the next method so a guard on the method
 * ABOVE cannot be mistaken for a guard on this one.
 */
function methodBody(text: string, signature: string): string {
  const start = text.indexOf(signature)
  if (start === -1) throw new Error(`method not found: ${signature}`)

  const after = text.slice(start + signature.length)
  const next = after.search(/\n {2}(?:async |private |public )?[a-zA-Z]\w*\s*\(/)
  return next === -1 ? after : after.slice(0, next)
}

describe('mutations on a specific invoice check more than the workspace', () => {
  const invoice = source('invoice.service.ts')

  it.each([
    ['update', '  async update(id: string, ctx: TenancyContext, data: UpdateInvoice) {'],
    // J5 widened this to take an SoD override, so the signature wraps. Pinned
    // to the opening line only — the guard is about what the body does, and a
    // full signature makes it break every time a parameter is added.
    ['delete', '  async delete(\n'],
  ])('%s calls assertMay', (_name, signature) => {
    // Without this, `.eq('workspace_id', …)` alone lets any member of the
    // workspace edit any row in it by id — including one raised by a colleague
    // in a branch they do not hold.
    expect(methodBody(invoice, signature)).toContain('scopes.assertMay')
  })

  it('checks BEFORE deleting the line items', () => {
    // Deleting children first and then refusing the parent leaves an invoice
    // with no lines and no way back.
    const body = methodBody(invoice, '  async delete(\n')
    expect(body.indexOf('scopes.assertMay')).toBeLessThan(body.indexOf("from('invoice_items')"))

    // J5 — same reasoning for the SoD refusal: blocked after the line items
    // are gone is an invoice destroyed by a check that said no.
    expect(body.indexOf('sod.assertAllowed')).toBeLessThan(body.indexOf("from('invoice_items')"))
  })
})

describe('the guard reaches every shared business entity, not just invoices', () => {
  // The four types `scope.service.ts` knows how to read. Each one is a row a
  // colleague can address by id, and each mutating method on it has to ask.
  it.each([
    [
      'customer.service.ts',
      '  async update(id: string, ctx: TenancyContext, data: UpdateCustomer): Promise<Customer> {',
    ],
    ['customer.service.ts', '  async delete(id: string, ctx: TenancyContext): Promise<void> {'],
    [
      'product.service.ts',
      '  async update(id: string, ctx: TenancyContext, data: UpdateProduct) {',
    ],
    ['product.service.ts', '  async delete(id: string, ctx: TenancyContext): Promise<void> {'],
  ])('%s %s', (file, signature) => {
    expect(methodBody(source(file), signature)).toContain('scopes.assertMay')
  })
})

describe('the guard itself fails closed', () => {
  const scope = source('authorization/scope.service.ts')

  it('refuses a resource type it does not know', () => {
    // Adding a table to the guard must be deliberate. A default of "allow"
    // would mean a new guarded call site silently does nothing.
    expect(scope).toContain("throw new ForbiddenError('RESOURCE_NOT_GUARDED')")
  })

  it('turns a cross-workspace hit into NOT FOUND, never FORBIDDEN', () => {
    // "Forbidden" confirms the row exists. The only person who benefits from
    // that confirmation is the one probing for ids.
    expect(scope).toMatch(/WRONG_WORKSPACE'\)\s*throw new NotFoundError/)
  })

  it('reads the row from the database rather than trusting the caller', () => {
    // A claim from the client about which branch the row it is editing belongs
    // to is precisely the claim that must not be trusted.
    expect(scope).toContain(".eq('id', resourceId)")
    expect(scope).toContain('await supabase')
  })

  it('does not cache the branch assignment a second time', () => {
    // A second cache layer over an authorization input is how a REVOKED
    // assignment keeps working for another five minutes.
    expect(scope).not.toMatch(/memoryCache|new Map\(\)/)
  })
})
