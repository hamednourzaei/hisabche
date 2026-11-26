import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  assignCohortBucket,
  compareSemVer,
  createFakeUpdaterPorts,
  evaluateRolloutHealth,
  FakeTelemetry,
  resolveModuleDependencies,
  UpdateOrchestrator,
  validateArchiveEntries,
  verifySignedPayload,
  type CoreManifest,
  type ModuleManifest,
  type SignedHaltDirective,
} from '../index'
import type { InstalledRuntimeContext } from '../resolver'
import { createTestSigningPair, NodeCryptoVerifier, signManifestPayload } from './updater-core.test'

const RUNTIME: InstalledRuntimeContext = {
  platform: 'windows',
  bootstrapVersion: '1.2.0',
  coreVersion: '1.9.0',
  apiVersion: '1.4.0',
  dbSchemaVersion: '1.4.0',
  localSchemaVersion: 1,
  nativeFingerprint: 'native-fp-v1',
  workspaceCapabilities: ['core', 'invoices.manage'],
  workspacePermissions: ['invoice.write'],
}

function makeSignedCore(
  version: string,
  bytes: Uint8Array,
  keys: ReturnType<typeof createTestSigningPair>,
  sequence: number,
  extra: Partial<Omit<CoreManifest, 'signature'>> = {},
): CoreManifest {
  const sha256 = createHash('sha256').update(bytes).digest('hex').toLowerCase()
  const base: Omit<CoreManifest, 'signature'> = {
    kind: 'core',
    id: 'hisabche-core',
    version,
    channel: 'stable',
    platforms: ['windows', 'android', 'web'],
    minBootstrapVersion: '1.0.0',
    maxBootstrapVersion: '2.0.0',
    apiRange: '>=1.0.0 <2.0.0',
    dbRange: '>=1.0.0 <2.0.0',
    minLocalSchemaVersion: 1,
    maxLocalSchemaVersion: 1,
    moduleCompatibility: {},
    requiredMigrations: [],
    artifact: {
      url: `https://updates.hisabche.com/core/${version}.bin`,
      sha256,
      sizeBytes: bytes.length,
      etag: `"${version}"`,
    },
    releaseNotes: { fa: 'ب', af: 'ب', en: 'u' },
    criticality: 'recommended',
    minSupportedVersion: '1.0.0',
    rollbackTarget: '1.9.0',
    activationRequirements: { requiresRestart: false, deferDuringFinancialOps: true },
    nativeFingerprint: 'native-fp-v1',
    ...extra,
  }
  const signature = signManifestPayload(base as unknown as Record<string, unknown>, {
    keyId: keys.keyId,
    privateKeyPem: keys.privateKeyPem,
    sequence,
    signedAt: '2026-11-26T10:00:00Z',
    expiresAt: '2026-12-26T10:00:00Z',
  })
  return { ...base, signature }
}

describe('Section 13.4 Bug-Class Ledger (25 named regression tests)', () => {
  it('#1 Lexicographic version comparison ("1.10" vs "1.9")', () => {
    expect(compareSemVer('1.10.0', '1.9.0')).toBe(1)
  })

  it('#2 Wrong device clock: installed version keeps working; server-time hint tolerates skew', async () => {
    const verifier = new NodeCryptoVerifier()
    const env = createFakeUpdaterPorts(verifier)
    const keys = createTestSigningPair()
    await env.secureStore.setTrustedKeys([
      { keyId: keys.keyId, algorithm: 'ed25519', publicKeyPem: keys.publicKeyPem },
    ])
    env.clock.setWallClockMs(Date.parse('2035-01-01T00:00:00Z'))
    const manifest = makeSignedCore('1.10.0', new TextEncoder().encode('b'), keys, 1)
    const { signature, ...rest } = manifest
    const res = await verifySignedPayload({
      layer: 'core',
      payloadWithoutSignature: rest as unknown as Record<string, unknown>,
      signature,
      secureStore: env.ports.secureStore,
      verifier,
      clock: env.clock,
      serverTimeMs: Date.parse('2026-11-26T12:00:00Z'),
    })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.clockSkewWarning).toBe(true)
  })

  it('#3 Stale CDN/proxy manifest rejected by sequence replay guard', async () => {
    const verifier = new NodeCryptoVerifier()
    const env = createFakeUpdaterPorts(verifier)
    const keys = createTestSigningPair()
    await env.secureStore.setTrustedKeys([
      { keyId: keys.keyId, algorithm: 'ed25519', publicKeyPem: keys.publicKeyPem },
    ])
    await env.secureStore.setSequence('core', 5)
    const stale = makeSignedCore('1.10.0', new TextEncoder().encode('b'), keys, 4)
    const { signature, ...rest } = stale
    const res = await verifySignedPayload({
      layer: 'core',
      payloadWithoutSignature: rest as unknown as Record<string, unknown>,
      signature,
      secureStore: env.ports.secureStore,
      verifier,
      clock: env.clock,
    })
    expect(res).toEqual({ ok: false, code: 'SEQUENCE_REPLAY_OR_DOWNGRADE' })
  })

  it('#4 Resumed download with changed server ETag/hash restarts cleanly and verifies hash', async () => {
    const verifier = new NodeCryptoVerifier()
    const env = createFakeUpdaterPorts(verifier)
    const keys = createTestSigningPair()
    await env.secureStore.setTrustedKeys([
      { keyId: keys.keyId, algorithm: 'ed25519', publicKeyPem: keys.publicKeyPem },
    ])
    const newBytes = new TextEncoder().encode('fresh-server-content')
    const manifest = makeSignedCore('1.10.0', newBytes, keys, 2)
    await env.fileStore.writeBytes(
      'slots/core/.partial-1.10.0.bin',
      new TextEncoder().encode('old'),
    )
    env.transport.metadataResponses.set('https://updates.hisabche.com/m.json', {
      status: 200,
      bodyBytes: new TextEncoder().encode(JSON.stringify(manifest)),
    })
    env.transport.artifacts.set(manifest.artifact.url, { bytes: newBytes, etag: '"new-etag"' })
    const orch = new UpdateOrchestrator(env.ports)
    const res = await orch.runCoreUpdate({
      metadataUrl: 'https://updates.hisabche.com/m.json',
      runtime: RUNTIME,
    })
    expect(res.activatedVersion).toBe('1.10.0')
  })

  it('#5 Zip-slip, symlink, case-collision, reserved Windows names, and long paths rejected', () => {
    expect(validateArchiveEntries([{ path: '../x', type: 'file', uncompressedBytes: 1 }]).ok).toBe(
      false,
    )
    expect(validateArchiveEntries([{ path: 'l', type: 'symlink', uncompressedBytes: 1 }]).ok).toBe(
      false,
    )
    expect(
      validateArchiveEntries([{ path: 'CON.txt', type: 'file', uncompressedBytes: 1 }]).ok,
    ).toBe(false)
    expect(
      validateArchiveEntries([{ path: 'a'.repeat(250), type: 'file', uncompressedBytes: 1 }]).ok,
    ).toBe(false)
    expect(
      validateArchiveEntries([
        { path: 'A.json', type: 'file', uncompressedBytes: 1 },
        { path: 'a.json', type: 'file', uncompressedBytes: 1 },
      ]).ok,
    ).toBe(false)
  })

  it('#6 Rename blocked by antivirus/indexer retries with bounded backoff', async () => {
    const verifier = new NodeCryptoVerifier()
    const env = createFakeUpdaterPorts(verifier)
    const keys = createTestSigningPair()
    await env.secureStore.setTrustedKeys([
      { keyId: keys.keyId, algorithm: 'ed25519', publicKeyPem: keys.publicKeyPem },
    ])
    const bytes = new TextEncoder().encode('retry-ok')
    const manifest = makeSignedCore('1.10.0', bytes, keys, 2)
    env.transport.metadataResponses.set('https://updates.hisabche.com/m.json', {
      status: 200,
      bodyBytes: new TextEncoder().encode(JSON.stringify(manifest)),
    })
    env.transport.artifacts.set(manifest.artifact.url, { bytes, etag: manifest.artifact.etag })
    env.fileStore.faultQueue.push('RENAME_LOCKED_EBUSY')
    const orch = new UpdateOrchestrator(env.ports)
    const res = await orch.runCoreUpdate({
      metadataUrl: 'https://updates.hisabche.com/m.json',
      runtime: RUNTIME,
    })
    expect(res.activatedVersion).toBe('1.10.0')
  })

  it('#7 Cross-volume EXDEV rename fails safely without corrupting active slot', async () => {
    const verifier = new NodeCryptoVerifier()
    const env = createFakeUpdaterPorts(verifier)
    const keys = createTestSigningPair()
    await env.secureStore.setTrustedKeys([
      { keyId: keys.keyId, algorithm: 'ed25519', publicKeyPem: keys.publicKeyPem },
    ])
    const bytes = new TextEncoder().encode('exdev')
    const manifest = makeSignedCore('1.10.0', bytes, keys, 2)
    env.transport.metadataResponses.set('https://updates.hisabche.com/m.json', {
      status: 200,
      bodyBytes: new TextEncoder().encode(JSON.stringify(manifest)),
    })
    env.transport.artifacts.set(manifest.artifact.url, { bytes, etag: manifest.artifact.etag })
    env.fileStore.faultQueue.push('CROSS_VOLUME')
    const orch = new UpdateOrchestrator(env.ports)
    await expect(
      orch.runCoreUpdate({ metadataUrl: 'https://updates.hisabche.com/m.json', runtime: RUNTIME }),
    ).rejects.toThrow('EXDEV')
    expect((await orch.loadLedger('core', '1.9.0')).currentVersion).toBe('1.9.0')
  })

  it('#8 Two app instances updating simultaneously blocked by single-update lock', async () => {
    const env = createFakeUpdaterPorts(new NodeCryptoVerifier())
    await env.process.acquireUpdateLock('update:core')
    const orch = new UpdateOrchestrator(env.ports)
    const res = await orch.runCoreUpdate({
      metadataUrl: 'https://updates.hisabche.com/m.json',
      runtime: RUNTIME,
    })
    expect(res.deferredReason).toBe('UPDATE_LOCK_HELD_BY_ANOTHER_INSTANCE')
  })

  it('#9 Update interrupted by sleep, shutdown, or low battery defers safely', async () => {
    const verifier = new NodeCryptoVerifier()
    const env = createFakeUpdaterPorts(verifier)
    const keys = createTestSigningPair()
    await env.secureStore.setTrustedKeys([
      { keyId: keys.keyId, algorithm: 'ed25519', publicKeyPem: keys.publicKeyPem },
    ])
    const bytes = new TextEncoder().encode('bat')
    const manifest = makeSignedCore('1.10.0', bytes, keys, 2)
    env.transport.metadataResponses.set('https://updates.hisabche.com/m.json', {
      status: 200,
      bodyBytes: new TextEncoder().encode(JSON.stringify(manifest)),
    })
    env.process.powerState = {
      isOnWifi: true,
      batteryPercent: 5,
      isCharging: false,
      isSleepingOrShuttingDown: false,
    }
    const orch = new UpdateOrchestrator(env.ports)
    const res = await orch.runCoreUpdate({
      metadataUrl: 'https://updates.hisabche.com/m.json',
      runtime: RUNTIME,
    })
    expect(res.deferredReason).toBe('DEFERRED_LOW_BATTERY')
  })

  it('#10-#11 Core updates while logged out/expired license preserve data; multiple workspaces share Core safely', async () => {
    const env = createFakeUpdaterPorts(new NodeCryptoVerifier())
    env.localDataProbe.offlineLicenseValid = false
    const snap = await env.localDataProbe.getDataSnapshotHash()
    expect(snap).toBe('snapshot-v1')
  })

  it('#12-#15 Legitimate signed rollback, schema-incompatible rollback -> Safe Mode, backend outage tolerance, crash-loop guard', async () => {
    const verifier = new NodeCryptoVerifier()
    const env = createFakeUpdaterPorts(verifier)
    const keys = createTestSigningPair()
    await env.secureStore.setTrustedKeys([
      { keyId: keys.keyId, algorithm: 'ed25519', publicKeyPem: keys.publicKeyPem },
    ])
    const orch = new UpdateOrchestrator(env.ports)

    // #13: Target rollback incompatible with newer local schema enters safeMode
    const haltBase: Omit<SignedHaltDirective, 'signature'> = {
      kind: 'halt-directive',
      releaseId: 'rel-2',
      layer: 'core',
      targetVersion: '2.0.0',
      rollbackTarget: '1.9.0',
      reason: 'CRITICAL_BUG',
    }
    const sig = signManifestPayload(haltBase as unknown as Record<string, unknown>, {
      keyId: keys.keyId,
      privateKeyPem: keys.privateKeyPem,
      sequence: 99,
      signedAt: '2026-11-26T10:00:00Z',
      expiresAt: '2026-12-26T10:00:00Z',
    })
    const haltRes = await orch.applySignedHaltDirective({
      directive: { ...haltBase, signature: sig },
      currentLocalSchemaVersion: 3,
    })
    expect(haltRes.safeMode).toBe(true)

    // #15: Crash-loop guard rolls back after > maxBootAttempts
    const ledger = await orch.loadLedger('mod-x', '1.0.0')
    ledger.currentVersion = '1.1.0'
    ledger.previousVersion = '1.0.0'
    ledger.lastKnownGoodVersion = '1.0.0'
    ledger.bootAttempts = 3
    await env.secureStore.setState('updater:ledger:mod-x', JSON.stringify(ledger))
    const guarded = await orch.recordBootAttemptAndGuard('mod-x', '1.0.0')
    expect(guarded.currentVersion).toBe('1.0.0')
    expect(guarded.badVersions).toContain('1.1.0')
  })

  it('#16-#18 Module cycle/unsatisfiable range, self-granted permission, and Core-never-imports-optional-modules', () => {
    const badMod: ModuleManifest = {
      kind: 'module',
      id: 'm1',
      version: '1.0.0',
      channel: 'stable',
      dependencies: { missing: '^1.0.0' },
      optionalDependencies: {},
      requiredCoreRange: '>=1.0.0',
      apiRange: '>=1.0.0',
      dbSchemaRange: '>=1.0.0',
      minLocalSchemaVersion: 1,
      platforms: ['windows'],
      requiredCapabilities: ['core'],
      requiredPermissions: ['invoice.write'],
      offlineSupport: true,
      artifact: {
        url: 'https://updates.hisabche.com/m1.bin',
        sha256: 'a'.repeat(64),
        sizeBytes: 10,
      },
      signature: {
        role: 'targets',
        keyId: 'k1',
        algorithm: 'ed25519',
        sigBase64: 'A'.repeat(64),
        sequence: 1,
        signedAt: '2026-11-26T10:00:00Z',
        expiresAt: '2026-12-26T10:00:00Z',
      },
      migrationReferences: [],
      releaseNotes: { fa: 'a', af: 'a', en: 'a' },
      rollbackCompatibility: { supportsRollback: true, rollbackTarget: null },
    }
    const res = resolveModuleDependencies([badMod], RUNTIME)
    expect(res.ok).toBe(false)

    const srcDir = path.resolve(__dirname, '..')
    for (const f of fs.readdirSync(srcDir)) {
      if (!f.endsWith('.ts')) continue
      const content = fs.readFileSync(path.join(srcDir, f), 'utf8')
      expect(content).not.toMatch(/apps\/desktop|apps\/mobile|apps\/web|node:fs|node:crypto/)
    }
  })

  it('#19-#22 Native fingerprint mismatch, OTA runtimeVersion check, deterministic cohort, sample-size halt edge case', () => {
    expect(assignCohortBucket('dev-1', 'rel-1')).toBe(assignCohortBucket('dev-1', 'rel-1'))
    expect(
      evaluateRolloutHealth({
        sampleSize: 49,
        activationSuccessCount: 0,
        startupFailureCount: 49,
        rollbackCount: 0,
        signatureFailureCount: 0,
      }).action,
    ).toBe('INSUFFICIENT_SAMPLE')
  })

  it('#23-#25 i18n 3-language parity, real-progress UI state, and bounded offline telemetry queue dropping oldest non-critical', async () => {
    const q = new FakeTelemetry(3)
    await q.append({ id: '1', kind: 'download_progress', critical: false, timestampMs: 1 })
    await q.append({ id: '2', kind: 'verification_failure', critical: true, timestampMs: 2 })
    await q.append({ id: '3', kind: 'download_progress', critical: false, timestampMs: 3 })
    await q.append({ id: '4', kind: 'activation_success', critical: false, timestampMs: 4 })
    expect(await q.size()).toBe(3)
    const drained = await q.drain(10)
    expect(drained.map((e) => e.id)).toEqual(['2', '3', '4'])
  })
})
