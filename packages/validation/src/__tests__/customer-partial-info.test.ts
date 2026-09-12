// ============================================
// A customer you can save with what you actually know.
//
// ---------------------------------------------------------------------------
// ⚠️ WHAT WAS REJECTED, AND WHY NOBODY COULD SEE IT
//
// Every optional field accepted `undefined` and rejected `null`. Those are the
// same fact in JSON — «nobody filled this in» — and different values in zod.
// A form bound to a database row sends `null`; so does any update that reads a
// row and writes it back. So a shopkeeper who typed only a name was rejected
// because of a field they never touched, and the error named a field the form
// does not even show them.
//
// `address` was worse: the schema wanted an OBJECT while `customers.address`
// is plain `text` in the database, so it could never round-trip at all.
//
// These cases are the probe that found the bug, kept as the guard.
// ============================================

import { describe, expect, it } from 'vitest'

import { createCustomerSchema, updateCustomerSchema } from '../schemas/customer.schema'

describe('what a shopkeeper can actually save', () => {
  const accepted: Array<[string, unknown]> = [
    ['a name and nothing else', { fullName: 'احمد' }],
    ['a name and a phone', { fullName: 'احمد', phone: '0700123456' }],
    ['⚠️ email left null', { fullName: 'احمد', email: null }],
    ['⚠️ phone left null', { fullName: 'احمد', phone: null }],
    ['⚠️ notes left null', { fullName: 'احمد', notes: null }],
    ['⚠️ address as the text the column holds', { fullName: 'احمد', address: 'کابل' }],
    ['⚠️ address left null', { fullName: 'احمد', address: null }],
    ['email left empty', { fullName: 'احمد', email: '' }],
    [
      'every optional field null at once',
      {
        fullName: 'احمد',
        phone: null,
        email: null,
        notes: null,
        address: null,
      },
    ],
  ]

  it.each(accepted)('accepts %s', (_label, payload) => {
    const result = createCustomerSchema.safeParse(payload)
    const why = result.success
      ? ''
      : result.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join(' | ')
    expect(why).toBe('')
  })

  it('⚠️ still requires a name', () => {
    // Not an oversight. A row with no name and no phone cannot be found again
    // by the person who created it. A walk-in with no details is not a
    // customer RECORD — the invoice carries no customer and renders as
    // «مشتری ناشناس», which also keeps the customer count honest.
    expect(createCustomerSchema.safeParse({ phone: '0700123456' }).success).toBe(false)
    expect(createCustomerSchema.safeParse({ fullName: '   ' }).success).toBe(false)
  })

  it('a real email is still validated', () => {
    // Accepting null is not the same as accepting nonsense.
    expect(createCustomerSchema.safeParse({ fullName: 'احمد', email: 'nope' }).success).toBe(false)
  })

  it('an update round-trip survives its own nulls', () => {
    const row = {
      id: '3f19d3ca-b024-4565-b5e3-47a078585c72',
      fullName: 'احمد',
      phone: null,
      email: null,
      address: null,
      notes: null,
    }
    expect(updateCustomerSchema.safeParse(row).success).toBe(true)
  })
})
