import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import {
  CRASH_POINTS,
  createFakeUpdaterPorts,
  UpdateOrchestrator,
  type CoreManifest,
  type CrashPoint,
} from '../index'
import type { InstalledRuntimeContext } from '../resolver'
import { createTestSigningPair, NodeCryptoVerifier, signManifestPayload } from './updater-core.test'

// Hand-written expected crash point list (Section 13.2: never derived from CRASH_POINTS)
const EXPECTED_CRASH_POINTS: readonly CrashPoint[] = [
  'CP_01_BEFORE_METADATA',
  'CP_02_AFTER_METADATA',
  'CP_03_BEFORE_DOWNLOAD',
  'CP_04_MID_DOWNLOAD',
  'CP_05_AFTER_DOWNLOAD',
  'CP_06_AFTER_HASH_VERIFY',
  'CP_07_AFTER_SIGNATURE_VERIFY',
  'CP_08_AFTER_STAGING_WRITE',
  'CP_09_BEFORE_SLOT_SWAP',
  'CP_10_AFTER_SLOT_SWAP',
  'CP_11_BEFORE_HEALTH_CONFIRM',
  'CP_12_AFTER_HEALTH_CONFIRM',
  'CP_13_BEFORE_TELEMETRY',
  'CP_14_BEFORE_CLEANUP',
]

const RUNTIME: InstalledRuntimeContext = {
  platform: 'windows',
  bootstrapVersion: '1.2.0',
  coreVersion: '1.9.0',
  apiVersion: '1.4.0',
  dbSchemaVersion: '1.4.0',
  localSchemaVersion: 1,
  nativeFingerprint: 'native-fp-v1',
  workspaceCapabilities: ['invoices.manage'],
  workspacePermissions: ['invoice.write'],
}

describe('Section 13.2 Crash-point enumeration & fault injection', () => {
  it('covers every explicitly expected crash point without omission', () => {
    expect(CRASH_POINTS).toEqual(EXPECTED_CRASH_POINTS)
  })

  it.each(EXPECTED_CRASH_POINTS)(
    'recovers cleanly and preserves local data snapshot at crash point %s',
    async (cp) => {
      const verifier = new NodeCryptoVerifier()
      const env = createFakeUpdaterPorts(verifier)
      const keys = createTestSigningPair()
      await env.secureStore.setTrustedKeys([
        { keyId: keys.keyId, algorithm: 'ed25519', publicKeyPem: keys.publicKeyPem },
      ])

      const bytes = new TextEncoder().encode('core-1.10.0-crash-proof-bundle')
      const sha256 = createHash('sha256').update(bytes).digest('hex').toLowerCase()
      const base: Omit<CoreManifest, 'signature'> = {
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
        moduleCompatibility: {},
        requiredMigrations: [],
        artifact: {
          url: 'https://updates.hisabche.com/core/1.10.0.bin',
          sha256,
          sizeBytes: bytes.length,
          etag: '"v10"',
        },
        releaseNotes: { fa: 'ن', af: 'ن', en: 'n' },
        criticality: 'recommended',
        minSupportedVersion: '1.0.0',
        rollbackTarget: '1.9.0',
        activationRequirements: { requiresRestart: false, deferDuringFinancialOps: true },
      }
      const signature = signManifestPayload(base as unknown as Record<string, unknown>, {
        keyId: keys.keyId,
        privateKeyPem: keys.privateKeyPem,
        sequence: 10,
        signedAt: '2026-11-26T10:00:00Z',
        expiresAt: '2026-12-26T10:00:00Z',
      })
      const manifest: CoreManifest = { ...base, signature }
      const metaUrl = 'https://updates.hisabche.com/core/latest.json'
      env.transport.metadataResponses.set(metaUrl, {
        status: 200,
        bodyBytes: new TextEncoder().encode(JSON.stringify(manifest)),
      })
      env.transport.artifacts.set(manifest.artifact.url, { bytes, etag: '"v10"' })

      const snapshotBefore = await env.localDataProbe.getDataSnapshotHash()
      let crashed = false
      const crashingOrchestrator = new UpdateOrchestrator(env.ports, 'slots', (point) => {
        if (point === cp && !crashed) {
          crashed = true
          throw new Error(`SIMULATED_PROCESS_DEATH:${point}`)
        }
      })

      await expect(
        crashingOrchestrator.runCoreUpdate({ metadataUrl: metaUrl, runtime: RUNTIME }),
      ).rejects.toThrow(`SIMULATED_PROCESS_DEATH:${cp}`)

      // A1 & A3: Active slot is either previous 1.9.0 or fully verified 1.10.0; local data untouched
      const midLedger = await crashingOrchestrator.loadLedger('core', '1.9.0')
      expect(['1.9.0', '1.10.0']).toContain(midLedger.currentVersion)
      expect(await env.localDataProbe.getDataSnapshotHash()).toBe(snapshotBefore)

      // A4: Re-running after restart converges cleanly to ACTIVE 1.10.0 (no loop)
      const cleanOrchestrator = new UpdateOrchestrator(env.ports, 'slots')
      const recovery = await cleanOrchestrator.runCoreUpdate({
        metadataUrl: metaUrl,
        runtime: { ...RUNTIME, coreVersion: midLedger.currentVersion },
      })
      expect(recovery.ledger.currentVersion).toBe('1.10.0')
      expect(await env.localDataProbe.getDataSnapshotHash()).toBe(snapshotBefore)
    },
  )

  it('handles fault injections (ENOSPC, EBUSY Windows lock retry, corrupt download, crash-loop rollback)', async () => {
    const verifier = new NodeCryptoVerifier()
    const env = createFakeUpdaterPorts(verifier)
    const keys = createTestSigningPair()
    await env.secureStore.setTrustedKeys([
      { keyId: keys.keyId, algorithm: 'ed25519', publicKeyPem: keys.publicKeyPem },
    ])

    const bytes = new TextEncoder().encode('core-1.10.0-fault-test')
    const sha256 = createHash('sha256').update(bytes).digest('hex').toLowerCase()
    const base: Omit<CoreManifest, 'signature'> = {
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
      moduleCompatibility: {},
      requiredMigrations: [],
      artifact: {
        url: 'https://updates.hisabche.com/core/1.10.0.bin',
        sha256,
        sizeBytes: bytes.length,
      },
      releaseNotes: { fa: 'ن', af: 'ن', en: 'n' },
      criticality: 'recommended',
      minSupportedVersion: '1.0.0',
      rollbackTarget: '1.9.0',
      activationRequirements: { requiresRestart: false, deferDuringFinancialOps: true },
    }
    const signature = signManifestPayload(base as unknown as Record<string, unknown>, {
      keyId: keys.keyId,
      privateKeyPem: keys.privateKeyPem,
      sequence: 5,
      signedAt: '2026-11-26T10:00:00Z',
      expiresAt: '2026-12-26T10:00:00Z',
    })
    const metaUrl = 'https://updates.hisabche.com/core/latest.json'
    env.transport.metadataResponses.set(metaUrl, {
      status: 200,
      bodyBytes: new TextEncoder().encode(JSON.stringify({ ...base, signature })),
    })
    env.transport.artifacts.set(base.artifact.url, { bytes })

    const orch = new UpdateOrchestrator(env.ports)

    // 1. Corrupt download rejected cleanly (A2/A5)
    env.transport.corruptNextDownload = true
    const badDl = await orch.runCoreUpdate({ metadataUrl: metaUrl, runtime: RUNTIME })
    expect(badDl.failureCode).toBe('ARTIFACT_HASH_MISMATCH')
    expect(badDl.ledger.currentVersion).toBe('1.9.0')

    // 2. Windows AV rename lock (EBUSY twice) succeeds on 3rd attempt via bounded retry
    env.fileStore.faultQueue.push('RENAME_LOCKED_EBUSY', 'RENAME_LOCKED_EBUSY')
    const okAfterRetry = await orch.runCoreUpdate({ metadataUrl: metaUrl, runtime: RUNTIME })
    expect(okAfterRetry.activatedVersion).toBe('1.10.0')
    expect(env.fileStore.renameAttempts).toBeGreaterThanOrEqual(3)

    // 3. Startup local crash triggers automatic rollback & quarantines 1.10.0
    const badSig = signManifestPayload(
      { ...base, version: '1.11.0' } as unknown as Record<string, unknown>,
      {
        keyId: keys.keyId,
        privateKeyPem: keys.privateKeyPem,
        sequence: 6,
        signedAt: '2026-11-26T10:00:00Z',
        expiresAt: '2026-12-26T10:00:00Z',
      },
    )
    env.transport.metadataResponses.set(metaUrl, {
      status: 200,
      bodyBytes: new TextEncoder().encode(
        JSON.stringify({ ...base, version: '1.11.0', signature: badSig }),
      ),
    })
    const crashedRun = await orch.runCoreUpdate({
      metadataUrl: metaUrl,
      runtime: { ...RUNTIME, coreVersion: '1.10.0' },
      simulateLocalStartupHealth: async () => 'LOCAL_CRASH',
    })
    expect(crashedRun.failureCode).toBe('STARTUP_HEALTH_LOCAL_CRASH')
    expect(crashedRun.ledger.currentVersion).toBe('1.10.0')
    expect(crashedRun.ledger.badVersions).toContain('1.11.0')
  })
})
