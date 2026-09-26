// ============================================
// Per-member page blocks: the owner takes modules away from ONE person.
//
// The rule that makes this safe: a block only ever RESTRICTS (the result is a
// subset of the role's set), it never touches the owner, and "invoices only"
// still reads the stock and customers the invoice form needs.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  BLOCKABLE_MODULES,
  capabilitiesOf,
  restrictByModuleBlocks,
  type Capability,
} from '../services/authorization/authorization.domain'

const managerSet = new Set<Capability>(capabilitiesOf('manager'))
const everythingBut = (keep: string) => BLOCKABLE_MODULES.filter((m) => m !== keep)

describe('restrictByModuleBlocks', () => {
  it('no blocks: exactly the role set', () => {
    expect(restrictByModuleBlocks('manager', managerSet, [])).toEqual(managerSet)
  })

  it('a blocked module loses every capability it owns', () => {
    const out = restrictByModuleBlocks('manager', managerSet, ['accounting'])
    expect(out.has('ledger.read')).toBe(false)
    expect(out.has('ledger.post')).toBe(false)
    expect(out.has('invoice.create')).toBe(true)
  })

  it('⚠️ "invoices only" can still pick stock and customers for the invoice form', () => {
    const out = restrictByModuleBlocks('manager', managerSet, everythingBut('invoices'))
    expect(out.has('invoice.create')).toBe(true)
    for (const read of ['product.read', 'inventory.read', 'customer.read'] as Capability[]) {
      expect(out.has(read)).toBe(true)
    }
    // …but no writes from the modules it depends on, and nothing else at all.
    expect(out.has('product.write')).toBe(false)
    expect(out.has('customer.write')).toBe(false)
    expect(out.has('ledger.read')).toBe(false)
    expect(out.has('payment.record')).toBe(false)
  })

  it('⚠️ never larger than the role: a dependency is not a grant', () => {
    const tiny = new Set<Capability>(['invoice.read', 'invoice.create'])
    const out = restrictByModuleBlocks('seller', tiny, everythingBut('invoices'))
    expect(out).toEqual(tiny)
  })

  it('⚠️ the owner is never restricted', () => {
    const ownerSet = new Set<Capability>(capabilitiesOf('owner'))
    expect(restrictByModuleBlocks('owner', ownerSet, [...BLOCKABLE_MODULES])).toEqual(ownerSet)
  })

  it('a blocked module that others need is readable only through them', () => {
    // inventory blocked, invoices allowed → product.read kept (for the form),
    // product.write gone (the inventory page's own write).
    const out = restrictByModuleBlocks('manager', managerSet, ['inventory'])
    expect(out.has('product.read')).toBe(true)
    expect(out.has('product.write')).toBe(false)
    expect(out.has('inventory.configure')).toBe(false)
  })

  it('when the dependent module is blocked too, its dependencies go', () => {
    const out = restrictByModuleBlocks('manager', managerSet, ['inventory', 'invoices', 'payments'])
    expect(out.has('product.read')).toBe(false)
  })
})

describe('the server applies it on every request', () => {
  it('requireWorkspaceContext restricts the role set by the member blocks', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(__dirname, '..', 'middleware', 'workspace.middleware.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(src).toContain('capabilities: restrictByModuleBlocks(')
    expect(src).toContain('memberModuleBlocks.forMember(resolved.workspaceId, userId)')
  })
})

describe('⚠️ the floor survives any block', () => {
  it('report.operational.read stays, so the app can still ask what is locked', () => {
    const out = restrictByModuleBlocks('manager', managerSet, [...BLOCKABLE_MODULES])
    expect(out.has('report.operational.read')).toBe(true)
    expect(out.has('report.financial.read')).toBe(false)
  })
})

describe('⚠️ every module the owner can lock has a name in all three languages', () => {
  it.each(['fa', 'af', 'en'])('%s', async (locale) => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const messages = JSON.parse(
      readFileSync(
        join(__dirname, '..', '..', '..', 'packages', 'i18n', 'messages', locale, 'common.json'),
        'utf8',
      ),
    ) as { permissions?: { module?: Record<string, string> } }
    for (const key of BLOCKABLE_MODULES) {
      // t() throws on a missing key — the whole page-access panel would fall over.
      expect(
        messages.permissions?.module?.[key],
        `${locale}: permissions.module.${key}`,
      ).toBeTruthy()
    }
  })
})
