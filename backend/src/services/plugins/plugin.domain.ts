// ============================================
// backend/src/services/plugins/plugin.domain.ts
//
// What a third-party extension may do to a workspace's books.
//
// ---------------------------------------------------------------------------
// THE SHAPE OF THE PROBLEM
//
// A marketplace means running somebody else's code against a shopkeeper's
// financial data. The interesting question is not how to load a plugin, it is
// what a plugin may NEVER do — and that has to be decided before anything can
// be loaded, because a capability granted by accident cannot be taken back
// from an installed base.
//
// So this file is the contract, and it is deliberately restrictive:
//
//   * a plugin declares its scopes up front and the workspace grants them
//   * a plugin can never exceed the INSTALLING USER's own authorization —
//     installing an app is not a way to acquire permissions you lack
//   * a plugin cannot post to the ledger, consume cost layers, cancel a
//     payment, or resolve a conflict; those write the books, and the books
//     belong to the domain
//   * every plugin action is attributed to the plugin, not to a user
//
// A plugin extends the product. It does not become the product.
// ============================================

import type { Capability } from '../authorization'

/** What a plugin can ask for. A closed set; adding one is a code change. */
export const PLUGIN_SCOPES = [
  'read:invoices',
  'read:customers',
  'read:products',
  'read:reports',
  'write:customers',
  'write:products',
  'write:invoices',
  'subscribe:events',
  'ui:widget',
  'ui:page',
] as const

export type PluginScope = (typeof PLUGIN_SCOPES)[number]

/**
 * The capability a scope requires of the INSTALLER.
 *
 * A seller installing an app cannot grant it `write:products`, because they
 * cannot write products themselves. This mapping is what makes installation
 * incapable of privilege escalation.
 */
const SCOPE_REQUIRES: Record<PluginScope, Capability> = {
  'read:invoices': 'invoice.read',
  'read:customers': 'customer.read',
  'read:products': 'product.read',
  'read:reports': 'report.operational.read',
  'write:customers': 'customer.write',
  'write:products': 'product.write',
  'write:invoices': 'invoice.create',
  'subscribe:events': 'report.operational.read',
  'ui:widget': 'invoice.read',
  'ui:page': 'invoice.read',
}

export function capabilityFor(scope: PluginScope): Capability {
  return SCOPE_REQUIRES[scope]
}

/**
 * Things no scope grants, at any level, to any plugin.
 *
 * These are the acts that write or rewrite the books. A plugin that could post
 * a journal entry could change what a business reported to its tax authority,
 * and no marketplace review process is a substitute for it being impossible.
 */
export const FORBIDDEN_TO_PLUGINS: Capability[] = [
  'ledger.post',
  'ledger.reverse',
  'ledger.lock_period',
  'account.manage',
  'payment.cancel',
  'inventory.configure',
  'invoice.delete',
  'member.manage',
  'workspace.manage',
]

export interface PluginManifest {
  id: string
  name: string
  version: string
  publisher: string
  scopes: PluginScope[]
  /** Where the workspace's data would go, if anywhere. */
  dataEgress?: { host: string; purpose: string }[]
}

export type PluginRuleCode =
  | 'PLUGIN_SCOPE_UNKNOWN'
  | 'PLUGIN_SCOPE_FORBIDDEN'
  | 'PLUGIN_VERSION_INVALID'
  | 'PLUGIN_NAME_REQUIRED'
  | 'PLUGIN_TOO_MANY_SCOPES'
  | 'PLUGIN_EGRESS_UNDECLARED'

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/
const MAX_SCOPES = 8

export function validateManifest(manifest: Partial<PluginManifest>): PluginRuleCode[] {
  const problems: PluginRuleCode[] = []

  if (!manifest.name || manifest.name.trim().length === 0) problems.push('PLUGIN_NAME_REQUIRED')
  if (!manifest.version || !SEMVER.test(manifest.version)) problems.push('PLUGIN_VERSION_INVALID')

  const scopes = manifest.scopes ?? []

  // A plugin asking for everything is a plugin nobody can meaningfully review.
  if (scopes.length > MAX_SCOPES) problems.push('PLUGIN_TOO_MANY_SCOPES')

  for (const scope of scopes) {
    if (!(PLUGIN_SCOPES as readonly string[]).includes(scope)) {
      problems.push('PLUGIN_SCOPE_UNKNOWN')
      continue
    }

    if (FORBIDDEN_TO_PLUGINS.includes(SCOPE_REQUIRES[scope])) {
      problems.push('PLUGIN_SCOPE_FORBIDDEN')
    }
  }

  // A plugin that sends data somewhere must say where, before it is installed
  // and not in a privacy policy nobody opens.
  const writesOrReads = scopes.some((scope) => scope.startsWith('read:'))
  if (writesOrReads && manifest.dataEgress === undefined) {
    problems.push('PLUGIN_EGRESS_UNDECLARED')
  }

  return [...new Set(problems)]
}

export interface GrantDecision {
  granted: PluginScope[]
  /** Scopes refused because the installer does not hold them themselves. */
  refused: Array<{ scope: PluginScope; missing: Capability }>
}

/**
 * What a given installer may actually grant this plugin.
 *
 * The intersection of what the plugin asks for and what the installer holds.
 * Installing an app is never a way to acquire a permission you lack — which is
 * exactly the escalation a marketplace invites if nobody writes this down.
 */
export function resolveGrant(
  requested: PluginScope[],
  installerHolds: (capability: Capability) => boolean,
): GrantDecision {
  const granted: PluginScope[] = []
  const refused: GrantDecision['refused'] = []

  for (const scope of requested) {
    const needed = SCOPE_REQUIRES[scope]
    if (!needed) continue

    if (FORBIDDEN_TO_PLUGINS.includes(needed)) {
      refused.push({ scope, missing: needed })
      continue
    }

    if (installerHolds(needed)) granted.push(scope)
    else refused.push({ scope, missing: needed })
  }

  return { granted, refused }
}

/** Whether an installed plugin may perform one action right now. */
export function pluginMay(
  granted: PluginScope[],
  scope: PluginScope,
  installerStillHolds: (capability: Capability) => boolean,
): boolean {
  if (!granted.includes(scope)) return false

  const needed = SCOPE_REQUIRES[scope]
  if (FORBIDDEN_TO_PLUGINS.includes(needed)) return false

  // Re-checked at USE time, not only at install time. A seller promoted and
  // later demoted must not leave a plugin behind holding what they used to be
  // able to do.
  return installerStillHolds(needed)
}
