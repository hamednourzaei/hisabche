/**
 * Typed Extension Contract for independently updateable Hisabche Feature Modules (Slice S7).
 * Core depends ONLY on this contract interface — never on concrete optional modules.
 */

import type { ModuleManifest } from './manifests'

export interface ModuleNavigationItem {
  id: string
  path: string
  labelKey: string
  requiredCapability: string
}

export interface ModuleExtensionContract {
  manifest: ModuleManifest
  navigation: readonly ModuleNavigationItem[]
  routes: readonly string[]
  widgets: readonly string[]
  permissions: readonly string[]
  reports: readonly string[]
  workflows: readonly string[]
  forms: readonly string[]
  validationSchemas: readonly string[]
  localizationNamespaces: readonly string[]
  backgroundJobs: readonly string[]
  apiEndpoints: readonly string[]
  syncEntities: readonly string[]
  localTables: readonly string[]
  industryProfiles: readonly string[]
}

export interface RegisteredModuleState {
  contract: ModuleExtensionContract
  enabled: boolean
  disabledReason?: 'NOT_IN_PLAN' | 'ENTITLEMENT_REVOKED' | 'INCOMPATIBLE' | undefined
  dataRetained: true
}

export class CoreModuleRegistry {
  private readonly modules = new Map<string, RegisteredModuleState>()

  register(
    contract: ModuleExtensionContract,
    workspaceCapabilities: readonly string[],
  ): RegisteredModuleState {
    const capSet = new Set(workspaceCapabilities)
    const allowed = contract.manifest.requiredCapabilities.every((c) => capSet.has(c))
    const state: RegisteredModuleState = {
      contract,
      enabled: allowed,
      disabledReason: allowed ? undefined : 'NOT_IN_PLAN',
      dataRetained: true,
    }
    this.modules.set(contract.manifest.id, state)
    return state
  }

  revokeEntitlement(moduleId: string): RegisteredModuleState | null {
    const existing = this.modules.get(moduleId)
    if (!existing) return null
    const updated: RegisteredModuleState = {
      ...existing,
      enabled: false,
      disabledReason: 'ENTITLEMENT_REVOKED',
      // Section 6 & 11 I13: revoking entitlement disables runtime execution, NEVER deletes data
      dataRetained: true,
    }
    this.modules.set(moduleId, updated)
    return updated
  }

  get(moduleId: string): RegisteredModuleState | undefined {
    return this.modules.get(moduleId)
  }
}
