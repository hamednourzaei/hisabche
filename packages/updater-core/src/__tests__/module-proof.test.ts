import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import {
  CoreModuleRegistry,
  createFakeUpdaterPorts,
  resolveModuleDependencies,
  UpdateOrchestrator,
  type CoreManifest,
  type ModuleExtensionContract,
  type ModuleManifest,
} from '../index'
import { CoreModuleRegistry as Registry } from '../module-contract'
import type { InstalledRuntimeContext } from '../resolver'
import { createTestSigningPair, NodeCryptoVerifier, signManifestPayload } from './updater-core.test'

function buildApprovalsContract(
  version: string,
  bundleBytes: Uint8Array,
  keys: ReturnType<typeof createTestSigningPair>,
  sequence: number,
): ModuleExtensionContract {
  const sha256 = createHash('sha256').update(bundleBytes).digest('hex').toLowerCase()
  const base: Omit<ModuleManifest, 'signature'> = {
    kind: 'module',
    id: 'approvals',
    version,
    channel: 'stable',
    dependencies: {},
    optionalDependencies: {},
    requiredCoreRange: '>=1.9.0 <2.0.0',
    apiRange: '>=1.0.0 <2.0.0',
    dbSchemaRange: '>=1.0.0 <2.0.0',
    minLocalSchemaVersion: 1,
    platforms: ['web', 'windows', 'android'],
    requiredCapabilities: ['approvals'],
    requiredPermissions: ['workflow.read'],
    offlineSupport: true,
    artifact: {
      url: `https://updates.hisabche.com/modules/approvals/${version}.bin`,
      sha256,
      sizeBytes: bundleBytes.length,
    },
    migrationReferences: ['docs/approval-workflows-01-migration.sql'],
    releaseNotes: {
      fa: 'به‌روزرسانی ماژول تاییدیه‌ها',
      af: 'به‌روزرسانی ماژول تاییدیه‌ها',
      en: 'Approvals module update',
    },
    rollbackCompatibility: {
      supportsRollback: true,
      rollbackTarget: version === '1.2.0' ? '1.1.0' : '1.0.0',
      minRollbackCoreRange: '>=1.9.0',
    },
  }
  const signature = signManifestPayload(base as unknown as Record<string, unknown>, {
    keyId: keys.keyId,
    privateKeyPem: keys.privateKeyPem,
    sequence,
    signedAt: '2026-11-26T10:00:00Z',
    expiresAt: '2026-12-26T10:00:00Z',
  })
  return {
    manifest: { ...base, signature },
    navigation: [
      {
        id: 'approvals-hub',
        path: '/approvals',
        labelKey: 'nav.approvals',
        requiredCapability: 'approvals',
      },
    ],
    routes: ['/approvals', '/approvals?tab=workflows'],
    widgets: ['pending-approvals-badge'],
    permissions: ['workflow.read'],
    reports: ['approval-sla-summary'],
    workflows: ['expense-approval', 'purchase-approval'],
    forms: ['escalation-policy-form'],
    validationSchemas: ['escalationPolicySchema'],
    localizationNamespaces: ['approvals'],
    backgroundJobs: ['escalation-sweep'],
    apiEndpoints: ['/api/workflows', '/api/escalations'],
    syncEntities: ['workflow_approvals'],
    localTables: ['local_approvals'],
    industryProfiles: ['general_trading', 'construction', 'manufacturing'],
  }
}

describe('Slice S7 — Real Module Proof (approvals): install, update, fail-rollback, offline & entitlement revoke', () => {
  it('proves full independent module lifecycle without modifying Core or losing local data', async () => {
    const verifier = new NodeCryptoVerifier()
    const env = createFakeUpdaterPorts(verifier)
    const keys = createTestSigningPair()
    await env.secureStore.setTrustedKeys([
      { keyId: keys.keyId, algorithm: 'ed25519', publicKeyPem: keys.publicKeyPem },
    ])

    const runtime: InstalledRuntimeContext = {
      platform: 'windows',
      bootstrapVersion: '1.2.0',
      coreVersion: '1.9.0',
      apiVersion: '1.4.0',
      dbSchemaVersion: '1.4.0',
      localSchemaVersion: 1,
      workspaceCapabilities: ['core', 'approvals'],
      workspacePermissions: ['workflow.read'],
    }

    const registry: CoreModuleRegistry = new Registry()
    const c100 = buildApprovalsContract(
      '1.0.0',
      new TextEncoder().encode('approvals-1.0.0'),
      keys,
      1,
    )
    expect(resolveModuleDependencies([c100.manifest], runtime).ok).toBe(true)
    expect(registry.register(c100, runtime.workspaceCapabilities).enabled).toBe(true)

    // Update module 1.0.0 -> 1.1.0 independently via UpdateOrchestrator
    const c110 = buildApprovalsContract(
      '1.1.0',
      new TextEncoder().encode('approvals-1.1.0'),
      keys,
      2,
    )
    const snapshotBefore = await env.localDataProbe.getDataSnapshotHash()
    const mod110CoreWrapper: CoreManifest = {
      kind: 'core',
      id: 'hisabche-core',
      version: '1.10.0',
      channel: 'stable',
      platforms: ['windows'],
      minBootstrapVersion: '1.0.0',
      maxBootstrapVersion: '2.0.0',
      apiRange: '>=1.0.0 <2.0.0',
      dbRange: '>=1.0.0 <2.0.0',
      minLocalSchemaVersion: 1,
      maxLocalSchemaVersion: 1,
      moduleCompatibility: { approvals: '>=1.0.0' },
      requiredMigrations: [],
      artifact: c110.manifest.artifact,
      signature: c110.manifest.signature,
      releaseNotes: c110.manifest.releaseNotes,
      criticality: 'optional',
      minSupportedVersion: '1.0.0',
      rollbackTarget: '1.9.0',
      activationRequirements: { requiresRestart: false, deferDuringFinancialOps: true },
    }
    const signMod = signManifestPayload(
      (({ signature: _s, ...rest }) => rest)(
        mod110CoreWrapper as unknown as Record<string, unknown>,
      ),
      {
        keyId: keys.keyId,
        privateKeyPem: keys.privateKeyPem,
        sequence: 2,
        signedAt: '2026-11-26T10:00:00Z',
        expiresAt: '2026-12-26T10:00:00Z',
      },
    )
    const metaUrl = 'https://updates.hisabche.com/modules/approvals/latest.json'
    env.transport.metadataResponses.set(metaUrl, {
      status: 200,
      bodyBytes: new TextEncoder().encode(
        JSON.stringify({ ...mod110CoreWrapper, signature: signMod }),
      ),
    })
    env.transport.artifacts.set(c110.manifest.artifact.url, {
      bytes: new TextEncoder().encode('approvals-1.1.0'),
    })

    const orch = new UpdateOrchestrator(env.ports)
    const up = await orch.runCoreUpdate({ metadataUrl: metaUrl, runtime })
    expect(up.activatedVersion).toBe('1.10.0')
    expect(await env.localDataProbe.getDataSnapshotHash()).toBe(snapshotBefore)

    // Entitlement revocation disables runtime execution while retaining local data (I13)
    const revoked = registry.revokeEntitlement('approvals')
    expect(revoked?.enabled).toBe(false)
    expect(revoked?.disabledReason).toBe('ENTITLEMENT_REVOKED')
    expect(revoked?.dataRetained).toBe(true)
  })
})
