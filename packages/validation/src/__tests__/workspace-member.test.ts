// ============================================
// Adding a colleague. The rule that matters: credentials are required only
// when the person will actually sign in. Forcing an email and password on a
// payroll-only record was what made the old invite flow fail so often.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  createMemberDirectBodySchema,
  MAX_WORKSPACE_MEMBERS,
  setMemberSuspensionSchema,
} from '../schemas/workspace.schema'

const MEMBER_ID = '11111111-2222-3333-4444-555555555555'

describe('createMemberDirectBodySchema', () => {
  it('accepts a member with sign-in access and full credentials', () => {
    const parsed = createMemberDirectBodySchema.parse({
      fullName: 'مجید',
      hasAccess: true,
      email: 'majid@example.com',
      password: 'longenough1',
      role: 'member',
    })

    expect(parsed.hasAccess).toBe(true)
    expect(parsed.email).toBe('majid@example.com')
  })

  it('accepts a payroll-only member with no credentials at all', () => {
    const parsed = createMemberDirectBodySchema.parse({
      fullName: 'احمد',
      hasAccess: false,
    })

    expect(parsed.hasAccess).toBe(false)
    expect(parsed.email).toBeUndefined()
    expect(parsed.password).toBeUndefined()
  })

  it('rejects sign-in access with no email', () => {
    expect(() =>
      createMemberDirectBodySchema.parse({
        fullName: 'مجید',
        hasAccess: true,
        password: 'longenough1',
      }),
    ).toThrow()
  })

  it('rejects sign-in access with no password', () => {
    expect(() =>
      createMemberDirectBodySchema.parse({
        fullName: 'مجید',
        hasAccess: true,
        email: 'majid@example.com',
      }),
    ).toThrow()
  })

  it('rejects a password shorter than the minimum', () => {
    expect(() =>
      createMemberDirectBodySchema.parse({
        fullName: 'مجید',
        hasAccess: true,
        email: 'majid@example.com',
        password: 'short',
      }),
    ).toThrow()
  })

  it('defaults to granting access, matching the form default', () => {
    // With no explicit flag the schema must still demand credentials, so a
    // client that forgets the field cannot create an account-less member by
    // accident.
    expect(() => createMemberDirectBodySchema.parse({ fullName: 'مجید' })).toThrow()
  })

  it('defaults the role to member rather than admin', () => {
    const parsed = createMemberDirectBodySchema.parse({
      fullName: 'مجید',
      hasAccess: false,
    })

    expect(parsed.role).toBe('member')
  })

  it('accepts viewer as a role', () => {
    const parsed = createMemberDirectBodySchema.parse({
      fullName: 'مجید',
      hasAccess: false,
      role: 'viewer',
    })

    expect(parsed.role).toBe('viewer')
  })

  it('rejects an unknown role', () => {
    expect(() =>
      createMemberDirectBodySchema.parse({ fullName: 'مجید', hasAccess: false, role: 'owner' }),
    ).toThrow()
  })

  it('carries job title and phone through', () => {
    const parsed = createMemberDirectBodySchema.parse({
      fullName: 'مجید',
      hasAccess: false,
      jobTitle: 'حسابدار',
      phone: '0700123456',
    })

    expect(parsed.jobTitle).toBe('حسابدار')
    expect(parsed.phone).toBe('0700123456')
  })

  it('rejects an empty name', () => {
    expect(() => createMemberDirectBodySchema.parse({ fullName: '', hasAccess: false })).toThrow()
  })
})

describe('setMemberSuspensionSchema', () => {
  it('accepts suspending and restoring', () => {
    expect(
      setMemberSuspensionSchema.parse({ memberId: MEMBER_ID, suspended: true }).suspended,
    ).toBe(true)
    expect(
      setMemberSuspensionSchema.parse({ memberId: MEMBER_ID, suspended: false }).suspended,
    ).toBe(false)
  })

  it('rejects a non-uuid member id', () => {
    expect(() => setMemberSuspensionSchema.parse({ memberId: 'nope', suspended: true })).toThrow()
  })
})

describe('member cap', () => {
  it('is ten', () => {
    expect(MAX_WORKSPACE_MEMBERS).toBe(10)
  })
})
