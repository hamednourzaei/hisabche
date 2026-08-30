// ============================================
// What a marketplace plugin may do to a workspace's books.
//
// The two properties that must hold before any plugin can ever be loaded:
// installing an app cannot grant a permission the installer lacks, and no
// plugin can write the books at all.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  FORBIDDEN_TO_PLUGINS,
  PLUGIN_SCOPES,
  capabilityFor,
  pluginMay,
  resolveGrant,
  validateManifest,
  type PluginScope,
} from '../services/plugins/plugin.domain'
import { can, type WorkspaceRole } from '../services/authorization'

const holderOf = (role: WorkspaceRole) => (capability: Parameters<typeof can>[1]) =>
  can(role, capability)

describe('installing cannot escalate', () => {
  it('refuses a seller the scopes a seller does not hold', () => {
    // Installing an app is not a way to acquire permissions you lack.
    const grant = resolveGrant(['write:products', 'read:invoices'], holderOf('seller'))

    expect(grant.granted).toEqual(['read:invoices'])
    expect(grant.refused.map((r) => r.scope)).toEqual(['write:products'])
  })

  it('grants a manager the same scopes it refused the seller', () => {
    const grant = resolveGrant(['write:products'], holderOf('manager'))
    expect(grant.granted).toEqual(['write:products'])
  })

  it('names the capability that was missing, so the refusal is explainable', () => {
    const grant = resolveGrant(['write:products'], holderOf('seller'))
    expect(grant.refused[0]!.missing).toBe('product.write')
  })

  it('grants nothing at all to a caller who holds nothing', () => {
    const grant = resolveGrant([...PLUGIN_SCOPES], () => false)
    expect(grant.granted).toEqual([])
  })
})

describe('no plugin can write the books', () => {
  it('maps no scope to a forbidden capability', () => {
    // The mapping is the enforcement. If a scope ever pointed at ledger.post,
    // a plugin could change what a business reported to its tax authority.
    for (const scope of PLUGIN_SCOPES) {
      expect(FORBIDDEN_TO_PLUGINS).not.toContain(capabilityFor(scope))
    }
  })

  it('keeps posting, reversing and locking on the forbidden list', () => {
    expect(FORBIDDEN_TO_PLUGINS).toEqual(
      expect.arrayContaining([
        'ledger.post',
        'ledger.reverse',
        'ledger.lock_period',
        'payment.cancel',
        'invoice.delete',
        'workspace.manage',
      ]),
    )
  })

  it('refuses a forbidden capability even to an owner', () => {
    // An owner holds every capability. That is not a reason to let a third
    // party act with them.
    const may = pluginMay(['ui:page'], 'ui:page', () => true)
    expect(may).toBe(true)

    const grant = resolveGrant([...PLUGIN_SCOPES], holderOf('owner'))
    for (const scope of grant.granted) {
      expect(FORBIDDEN_TO_PLUGINS).not.toContain(capabilityFor(scope))
    }
  })
})

describe('a grant is re-checked at use time', () => {
  it('allows an action the installer still holds', () => {
    expect(pluginMay(['read:invoices'], 'read:invoices', holderOf('seller'))).toBe(true)
  })

  it('REFUSES an action after the installer was demoted', () => {
    // A seller promoted and later demoted must not leave a plugin behind
    // holding what they used to be able to do.
    expect(pluginMay(['write:products'], 'write:products', holderOf('seller'))).toBe(false)
  })

  it('refuses a scope that was never granted', () => {
    expect(pluginMay(['read:invoices'], 'write:invoices', () => true)).toBe(false)
  })
})

describe('manifest validation', () => {
  const base = {
    id: 'p1',
    name: 'Loyalty',
    version: '1.2.0',
    publisher: 'acme',
    scopes: ['read:invoices'] as PluginScope[],
    dataEgress: [{ host: 'api.acme.test', purpose: 'points' }],
  }

  it('accepts a well-formed manifest', () => {
    expect(validateManifest(base)).toEqual([])
  })

  it('requires a semantic version', () => {
    expect(validateManifest({ ...base, version: 'latest' })).toContain('PLUGIN_VERSION_INVALID')
  })

  it('rejects an unknown scope', () => {
    expect(validateManifest({ ...base, scopes: ['read:everything' as PluginScope] })).toContain(
      'PLUGIN_SCOPE_UNKNOWN',
    )
  })

  it('rejects a plugin asking for everything', () => {
    // A plugin asking for every scope is a plugin nobody can meaningfully
    // review.
    const greedy = Array.from({ length: 12 }, () => 'read:invoices') as PluginScope[]
    expect(validateManifest({ ...base, scopes: greedy })).toContain('PLUGIN_TOO_MANY_SCOPES')
  })

  it('REQUIRES a plugin that reads data to declare where it sends it', () => {
    // Before installation, not in a privacy policy nobody opens.
    const { dataEgress, ...withoutEgress } = base
    expect(validateManifest(withoutEgress)).toContain('PLUGIN_EGRESS_UNDECLARED')
  })

  it('requires a name', () => {
    expect(validateManifest({ ...base, name: '  ' })).toContain('PLUGIN_NAME_REQUIRED')
  })
})
