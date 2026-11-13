// ============================================
// backend/src/__tests__/admin-ip-allowlist.test.ts
//
// V63 · S-5 — the IP allow-list rules, tested pure.
//
// The cases are the ones a wrong implementation gets wrong:
//
//  - an EMPTY list must not lock anybody out (the feature is off);
//  - a /24 must match .7 and must not match .8 of the neighbouring range;
//  - a malformed entry matches NOTHING (a typo cannot quietly allow a /0);
//  - the break-glass email reaches the security routes and nothing else;
//  - a refusal never names the configured ranges.
// ============================================

import { describe, expect, it } from 'vitest'

import { ipInCidr, ipMatchesAny } from '../utils/ip-cidr'
import { breakGlassEmail } from '../middleware/platform-admin.middleware'
import { decideAdminIpAccess } from '../services/admin/admin-ip-allowlist.service'

describe('ipInCidr', () => {
  it('matches an address inside an IPv4 range', () => {
    expect(ipInCidr('203.0.113.7', '203.0.113.0/24')).toBe(true)
    expect(ipInCidr('203.0.113.255', '203.0.113.0/24')).toBe(true)
  })

  it('does not match the neighbouring range', () => {
    expect(ipInCidr('203.0.114.1', '203.0.113.0/24')).toBe(false)
  })

  it('treats a bare address as /32 and /128', () => {
    expect(ipInCidr('203.0.113.7', '203.0.113.7')).toBe(true)
    expect(ipInCidr('203.0.113.8', '203.0.113.7')).toBe(false)
    expect(ipInCidr('2001:db8::1', '2001:db8::1')).toBe(true)
  })

  it('matches IPv6 ranges, including an embedded IPv4 tail', () => {
    expect(ipInCidr('2001:db8:1::5', '2001:db8::/32')).toBe(true)
    expect(ipInCidr('2001:db9::5', '2001:db8::/32')).toBe(false)
    expect(ipInCidr('::ffff:203.0.113.7', '::ffff:203.0.113.0/120')).toBe(true)
  })

  it('matches everything for /0', () => {
    expect(ipInCidr('203.0.113.7', '0.0.0.0/0')).toBe(true)
    expect(ipInCidr('2001:db8::1', '::/0')).toBe(true)
  })

  it('matches nothing for a malformed entry or address', () => {
    expect(ipInCidr('203.0.113.7', 'not-an-ip')).toBe(false)
    expect(ipInCidr('203.0.113.7', '203.0.113.0/99')).toBe(false)
    expect(ipInCidr('not-an-ip', '203.0.113.0/24')).toBe(false)
    // A malformed entry must not widen to «allow all».
    expect(ipMatchesAny('8.8.8.8', ['', 'x/y'])).toBe(false)
  })

  it('never mixes families', () => {
    expect(ipInCidr('203.0.113.7', '2001:db8::/32')).toBe(false)
    expect(ipInCidr('2001:db8::1', '203.0.113.0/24')).toBe(false)
  })
})

describe('decideAdminIpAccess', () => {
  const base = {
    path: '/api/admin/billing/plans',
    email: 'owner@hisabche.com',
    ip: '203.0.113.7',
    entries: ['203.0.113.0/24'],
    breakGlassEmail: 'owner@hisabche.com',
  } as const

  it('allows everything when the list is empty (feature off)', () => {
    expect(decideAdminIpAccess({ ...base, entries: [] })).toEqual({
      allowed: true,
      reason: 'disabled',
    })
  })

  it('allows a listed address', () => {
    expect(decideAdminIpAccess(base)).toEqual({ allowed: true, reason: 'listed' })
  })

  it('refuses an unlisted address', () => {
    expect(decideAdminIpAccess({ ...base, ip: '8.8.8.8' })).toEqual({
      allowed: false,
      reason: 'not_listed',
    })
  })

  it('refuses an unknown address when the list is set (no guessing)', () => {
    expect(decideAdminIpAccess({ ...base, ip: undefined }).allowed).toBe(false)
  })

  it('lets the break-glass admin reach the security routes only', () => {
    expect(
      decideAdminIpAccess({
        ...base,
        ip: '8.8.8.8',
        path: '/api/admin/security/ip-allowlist',
      }),
    ).toEqual({ allowed: true, reason: 'break_glass' })

    expect(
      decideAdminIpAccess({ ...base, ip: '8.8.8.8', path: '/api/admin/billing/refunds' }),
    ).toEqual({ allowed: false, reason: 'not_listed' })
  })

  it('grants break-glass to that email only', () => {
    expect(
      decideAdminIpAccess({
        ...base,
        email: 'someone-else@hisabche.com',
        ip: '8.8.8.8',
        path: '/api/admin/security/ip-allowlist',
      }).allowed,
    ).toBe(false)
  })

  it('is case-insensitive on the email', () => {
    expect(
      decideAdminIpAccess({
        ...base,
        email: 'Owner@Hisabche.com',
        ip: '8.8.8.8',
        path: '/api/admin/security/ip-allowlist',
      }).reason,
    ).toBe('break_glass')
  })
})

describe('breakGlassEmail', () => {
  it('prefers the explicit variable', () => {
    expect(
      breakGlassEmail({
        ADMIN_BREAK_GLASS_EMAIL: 'Security@Hisabche.com',
        ADMIN_ALLOWED_EMAILS: 'owner@hisabche.com',
      } as NodeJS.ProcessEnv),
    ).toBe('security@hisabche.com')
  })

  it('falls back to the first allow-listed admin', () => {
    expect(
      breakGlassEmail({
        ADMIN_ALLOWED_EMAILS: 'owner@hisabche.com,ops@hisabche.com',
      } as NodeJS.ProcessEnv),
    ).toBe('owner@hisabche.com')
  })

  it('has no break-glass address when nothing is configured', () => {
    expect(breakGlassEmail({} as NodeJS.ProcessEnv)).toBeNull()
  })
})
