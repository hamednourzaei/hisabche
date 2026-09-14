// ============================================
// backend/src/__tests__/role-capabilities-domain.test.ts
// Defaults + per-workspace changes = the effective set every check enforces.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  can,
  capabilitiesOf,
  effectiveCapabilities,
  holds,
  OWNER_LOCKED_CAPABILITIES,
} from '../services/authorization/authorization.domain'

describe('effectiveCapabilities', () => {
  it('no changes → exactly the defaults', () => {
    expect([...effectiveCapabilities('seller', [])].sort()).toEqual(capabilitiesOf('seller').sort())
  })

  it('grant adds, revoke removes, only for the named role', () => {
    const set = effectiveCapabilities('seller', [
      { role: 'seller', capability: 'budget.read', granted: true },
      { role: 'seller', capability: 'invoice.create', granted: false },
      { role: 'manager', capability: 'member.manage', granted: true },
    ])
    expect(set.has('budget.read')).toBe(true)
    expect(set.has('invoice.create')).toBe(false)
    expect(set.has('member.manage')).toBe(false)
  })

  it('⚠️ the owner can never lose member.manage or workspace.manage', () => {
    const set = effectiveCapabilities(
      'owner',
      OWNER_LOCKED_CAPABILITIES.map((capability) => ({
        role: 'owner' as const,
        capability,
        granted: false,
      })),
    )
    for (const c of OWNER_LOCKED_CAPABILITIES) expect(set.has(c)).toBe(true)
  })

  it('holds() uses the resolved set when present, defaults otherwise', () => {
    expect(holds({ role: 'seller' }, 'budget.read')).toBe(can('seller', 'budget.read'))
    expect(holds({ role: 'seller', capabilities: new Set(['budget.read']) }, 'budget.read')).toBe(
      true,
    )
    expect(holds({ role: 'owner', capabilities: new Set() }, 'invoice.read')).toBe(false)
  })
})
