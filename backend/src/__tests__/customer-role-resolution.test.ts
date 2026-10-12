import { describe, expect, it } from 'vitest'
import {
  assertDeclaredRole,
  isMissingColumnError,
  mapCustomer,
  matchesRole,
  mergeRole,
  resolveEffectiveRole,
  type CustomerRow,
} from '../services/customer.service'

describe('mergeRole', () => {
  it('promotes none to incoming role', () => {
    expect(mergeRole('none', 'buyer')).toBe('buyer')
    expect(mergeRole('none', 'seller')).toBe('seller')
  })

  it('keeps existing role when incoming matches', () => {
    expect(mergeRole('buyer', 'buyer')).toBe('buyer')
    expect(mergeRole('seller', 'seller')).toBe('seller')
  })

  it('promotes to both when opposite kind arrives', () => {
    expect(mergeRole('buyer', 'seller')).toBe('both')
    expect(mergeRole('seller', 'buyer')).toBe('both')
    expect(mergeRole('both', 'buyer')).toBe('both')
    expect(mergeRole('both', 'seller')).toBe('both')
  })
})

describe('resolveEffectiveRole', () => {
  it('returns derivedRole when declaredRole is null or undefined', () => {
    expect(resolveEffectiveRole(null, 'none')).toBe('none')
    expect(resolveEffectiveRole(undefined, 'none')).toBe('none')
    expect(resolveEffectiveRole(null, 'buyer')).toBe('buyer')
    expect(resolveEffectiveRole(null, 'seller')).toBe('seller')
    expect(resolveEffectiveRole(null, 'both')).toBe('both')
  })

  it('returns declaredRole when derivedRole is none (new party before any invoice)', () => {
    expect(resolveEffectiveRole('buyer', 'none')).toBe('buyer')
    expect(resolveEffectiveRole('seller', 'none')).toBe('seller')
    expect(resolveEffectiveRole('both', 'none')).toBe('both')
  })

  it('merges declared seller with a sale invoice into both', () => {
    expect(resolveEffectiveRole('seller', 'buyer')).toBe('both')
  })

  it('merges declared buyer with a purchase invoice into both', () => {
    expect(resolveEffectiveRole('buyer', 'seller')).toBe('both')
  })

  it('keeps role when declared and derived match', () => {
    expect(resolveEffectiveRole('buyer', 'buyer')).toBe('buyer')
    expect(resolveEffectiveRole('seller', 'seller')).toBe('seller')
  })

  it('returns both when either is both', () => {
    expect(resolveEffectiveRole('both', 'buyer')).toBe('both')
    expect(resolveEffectiveRole('both', 'seller')).toBe('both')
    expect(resolveEffectiveRole('buyer', 'both')).toBe('both')
    expect(resolveEffectiveRole('seller', 'both')).toBe('both')
  })
})

describe('matchesRole', () => {
  it('filters buyer correctly', () => {
    expect(matchesRole('buyer', 'buyer')).toBe(true)
    expect(matchesRole('seller', 'buyer')).toBe(false)
    expect(matchesRole('both', 'buyer')).toBe(true)
    expect(matchesRole('none', 'buyer')).toBe(false)
  })

  it('filters seller correctly', () => {
    expect(matchesRole('seller', 'seller')).toBe(true)
    expect(matchesRole('buyer', 'seller')).toBe(false)
    expect(matchesRole('both', 'seller')).toBe(true)
    expect(matchesRole('none', 'seller')).toBe(false)
  })
})

describe('isMissingColumnError', () => {
  it('detects postgres 42703 (undefined_column) when message names declared_role', () => {
    expect(
      isMissingColumnError({ code: '42703', message: 'column declared_role does not exist' }),
    ).toBe(true)
  })

  it('detects postgrest PGRST204 when message names declared_role', () => {
    expect(
      isMissingColumnError({
        code: 'PGRST204',
        message: 'Could not find the declared_role column',
      }),
    ).toBe(true)
  })

  it('returns false when 42703 is about another column', () => {
    expect(isMissingColumnError({ code: '42703', message: 'column foo does not exist' })).toBe(
      false,
    )
  })

  it('returns false for CHECK violation 23514 even if message names declared_role', () => {
    expect(
      isMissingColumnError({
        code: '23514',
        message:
          'new row for relation "customers" violates check constraint "customers_declared_role_check"',
      }),
    ).toBe(false)
  })

  it('returns false when code is missing or unrelated', () => {
    expect(
      isMissingColumnError({
        message: 'column "declared_role" of relation "customers" does not exist',
      }),
    ).toBe(false)
    expect(
      isMissingColumnError({
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      }),
    ).toBe(false)
    expect(isMissingColumnError(null)).toBe(false)
    expect(isMissingColumnError(undefined)).toBe(false)
    expect(isMissingColumnError('string error')).toBe(false)
  })
})

describe('assertDeclaredRole', () => {
  it('allows valid roles and null/undefined', () => {
    expect(() => assertDeclaredRole('buyer')).not.toThrow()
    expect(() => assertDeclaredRole('seller')).not.toThrow()
    expect(() => assertDeclaredRole('both')).not.toThrow()
    expect(() => assertDeclaredRole(null)).not.toThrow()
    expect(() => assertDeclaredRole(undefined)).not.toThrow()
  })

  it('throws ValidationError for invalid role', () => {
    expect(() => assertDeclaredRole('invalid')).toThrowError('CUSTOMER_DECLARED_ROLE_INVALID')
    expect(() => assertDeclaredRole(123)).toThrowError('CUSTOMER_DECLARED_ROLE_INVALID')
    expect(() => assertDeclaredRole('')).toThrowError('CUSTOMER_DECLARED_ROLE_INVALID')
  })
})

describe('mapCustomer passthrough', () => {
  it('passes null updated_at through as null, not empty string', () => {
    const row: CustomerRow = {
      id: 'cust-1',
      full_name: 'Test Customer',
      phone: '',
      email: '',
      address: null,
      notes: '',
      opening_balance: 0,
      is_active: true,
      type: 'cash',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: null,
    }
    const customer = mapCustomer(row)
    expect(customer.updatedAt).toBeNull()
    expect(customer.declaredRole).toBeNull()
  })

  it('passes declaredRole through when present', () => {
    const row: CustomerRow = {
      id: 'cust-2',
      full_name: 'Seller Party',
      phone: '0700000000',
      email: 's@test.com',
      address: 'Kabul',
      notes: 'Notes',
      opening_balance: 1000,
      is_active: false,
      type: 'credit',
      declared_role: 'seller',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    }
    const customer = mapCustomer(row)
    expect(customer.declaredRole).toBe('seller')
    expect(customer.updatedAt).toBe('2026-01-02T00:00:00Z')
    expect(customer.isActive).toBe(false)
  })
})
