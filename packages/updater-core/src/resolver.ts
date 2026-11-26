/**
 * Pure dependency graph, SemVer range, entitlement, and compatibility matrix resolver.
 */

import type { CoreManifest, ModuleManifest, UpdatePlatform } from './manifests'
import { compareSemVer, satisfiesRange } from './semver'

export interface InstalledRuntimeContext {
  platform: UpdatePlatform
  bootstrapVersion: string
  coreVersion: string
  apiVersion: string
  dbSchemaVersion: string
  localSchemaVersion: number
  nativeFingerprint?: string | undefined
  workspaceCapabilities: readonly string[]
  workspacePermissions: readonly string[]
}

export type DependencyResolutionResult =
  | { ok: true; installOrder: readonly ModuleManifest[] }
  | {
      ok: false
      code:
        | 'DUPLICATE_MODULE_ID'
        | 'DEPENDENCY_CYCLE'
        | 'MISSING_DEPENDENCY'
        | 'UNSATISFIED_DEPENDENCY_RANGE'
        | 'INCOMPATIBLE_CORE_RANGE'
        | 'INCOMPATIBLE_PLATFORM'
        | 'INCOMPATIBLE_API_RANGE'
        | 'INCOMPATIBLE_DB_RANGE'
        | 'LOCAL_SCHEMA_TOO_OLD'
        | 'MODULE_SELF_GRANT_FORBIDDEN'
      details: string
    }

export function assertModuleNotGrantingOwnCapabilities(
  moduleManifest: ModuleManifest,
  workspaceCapabilities: readonly string[],
  workspacePermissions: readonly string[],
): { ok: true } | { ok: false; code: 'MODULE_SELF_GRANT_FORBIDDEN'; details: string } {
  const capSet = new Set(workspaceCapabilities)
  for (const cap of moduleManifest.requiredCapabilities) {
    if (!capSet.has(cap)) {
      return {
        ok: false,
        code: 'MODULE_SELF_GRANT_FORBIDDEN',
        details: `Module ${moduleManifest.id} requires ungranted capability ${cap}`,
      }
    }
  }
  const permSet = new Set(workspacePermissions)
  for (const perm of moduleManifest.requiredPermissions) {
    if (!permSet.has(perm)) {
      return {
        ok: false,
        code: 'MODULE_SELF_GRANT_FORBIDDEN',
        details: `Module ${moduleManifest.id} requires ungranted permission ${perm}`,
      }
    }
  }
  return { ok: true }
}

export function resolveModuleDependencies(
  candidates: readonly ModuleManifest[],
  ctx: InstalledRuntimeContext,
): DependencyResolutionResult {
  const byId = new Map<string, ModuleManifest>()
  for (const mod of candidates) {
    if (byId.has(mod.id)) {
      return { ok: false, code: 'DUPLICATE_MODULE_ID', details: mod.id }
    }
    if (!mod.platforms.includes(ctx.platform)) {
      return { ok: false, code: 'INCOMPATIBLE_PLATFORM', details: `${mod.id}:${ctx.platform}` }
    }
    if (!satisfiesRange(ctx.coreVersion, mod.requiredCoreRange)) {
      return {
        ok: false,
        code: 'INCOMPATIBLE_CORE_RANGE',
        details: `${mod.id} requires core ${mod.requiredCoreRange}, got ${ctx.coreVersion}`,
      }
    }
    if (!satisfiesRange(ctx.apiVersion, mod.apiRange)) {
      return { ok: false, code: 'INCOMPATIBLE_API_RANGE', details: mod.id }
    }
    if (!satisfiesRange(ctx.dbSchemaVersion, mod.dbSchemaRange)) {
      return { ok: false, code: 'INCOMPATIBLE_DB_RANGE', details: mod.id }
    }
    if (ctx.localSchemaVersion < mod.minLocalSchemaVersion) {
      return { ok: false, code: 'LOCAL_SCHEMA_TOO_OLD', details: mod.id }
    }
    const permCheck = assertModuleNotGrantingOwnCapabilities(
      mod,
      ctx.workspaceCapabilities,
      ctx.workspacePermissions,
    )
    if (!permCheck.ok) return permCheck
    byId.set(mod.id, mod)
  }

  for (const mod of candidates) {
    for (const [depId, range] of Object.entries(mod.dependencies)) {
      const dep = byId.get(depId)
      if (!dep) {
        return { ok: false, code: 'MISSING_DEPENDENCY', details: `${mod.id}->${depId}` }
      }
      if (!satisfiesRange(dep.version, range)) {
        return {
          ok: false,
          code: 'UNSATISFIED_DEPENDENCY_RANGE',
          details: `${mod.id}->${depId}@${dep.version} (needs ${range})`,
        }
      }
    }
    for (const [optId, range] of Object.entries(mod.optionalDependencies)) {
      const dep = byId.get(optId)
      if (dep && !satisfiesRange(dep.version, range)) {
        return {
          ok: false,
          code: 'UNSATISFIED_DEPENDENCY_RANGE',
          details: `${mod.id}->optional:${optId}@${dep.version} (needs ${range})`,
        }
      }
    }
  }

  const visitState = new Map<string, 'visiting' | 'visited'>()
  const order: ModuleManifest[] = []
  const sortedIds = Array.from(byId.keys()).sort()

  const visit = (id: string): DependencyResolutionResult | null => {
    const state = visitState.get(id)
    if (state === 'visiting') {
      return { ok: false, code: 'DEPENDENCY_CYCLE', details: id }
    }
    if (state === 'visited') return null

    visitState.set(id, 'visiting')
    const mod = byId.get(id)!
    const depIds = [
      ...Object.keys(mod.dependencies),
      ...Object.keys(mod.optionalDependencies).filter((k) => byId.has(k)),
    ].sort()
    for (const depId of depIds) {
      const err = visit(depId)
      if (err) return err
    }
    visitState.set(id, 'visited')
    order.push(mod)
    return null
  }

  for (const id of sortedIds) {
    const err = visit(id)
    if (err) return err
  }

  return { ok: true, installOrder: order }
}

export type MatrixOutcome =
  | 'WORKS'
  | 'REFUSE'
  | 'REFUSE_OR_DISABLE_MODULE'
  | 'MIGRATE_AFTER_SAFETY_CHECK'
  | 'SAFE_MODE'
  | 'STRUCTURED_UPGRADE_REQUIRED'

export function evaluateCoreCompatibility(
  core: CoreManifest,
  ctx: InstalledRuntimeContext,
): { outcome: MatrixOutcome; reasonCode?: string | undefined } {
  if (!core.platforms.includes(ctx.platform)) {
    return { outcome: 'REFUSE', reasonCode: 'UNSUPPORTED_PLATFORM' }
  }
  if (
    compareSemVer(ctx.bootstrapVersion, core.minBootstrapVersion) < 0 ||
    compareSemVer(ctx.bootstrapVersion, core.maxBootstrapVersion) > 0
  ) {
    return { outcome: 'REFUSE', reasonCode: 'BOOTSTRAP_VERSION_INCOMPATIBLE' }
  }
  if (
    core.nativeFingerprint &&
    ctx.nativeFingerprint &&
    core.nativeFingerprint !== ctx.nativeFingerprint
  ) {
    return { outcome: 'REFUSE', reasonCode: 'NATIVE_FINGERPRINT_MISMATCH' }
  }
  if (!satisfiesRange(ctx.apiVersion, core.apiRange)) {
    return { outcome: 'REFUSE', reasonCode: 'API_VERSION_INCOMPATIBLE' }
  }
  if (!satisfiesRange(ctx.dbSchemaVersion, core.dbRange)) {
    return { outcome: 'REFUSE', reasonCode: 'DB_SCHEMA_INCOMPATIBLE' }
  }
  if (ctx.localSchemaVersion > core.maxLocalSchemaVersion) {
    return { outcome: 'SAFE_MODE', reasonCode: 'LOCAL_SCHEMA_NEWER_THAN_RUNTIME' }
  }
  if (ctx.localSchemaVersion < core.minLocalSchemaVersion) {
    return { outcome: 'MIGRATE_AFTER_SAFETY_CHECK' }
  }
  return { outcome: 'WORKS' }
}

export function evaluateApiClientCompatibility(input: {
  clientVersion: string
  minSupportedClientVersion: string
  serverApiVersion: string
  clientRequiredApiRange: string
}): MatrixOutcome {
  if (compareSemVer(input.clientVersion, input.minSupportedClientVersion) < 0) {
    return 'STRUCTURED_UPGRADE_REQUIRED'
  }
  if (!satisfiesRange(input.serverApiVersion, input.clientRequiredApiRange)) {
    return 'REFUSE'
  }
  return 'WORKS'
}
