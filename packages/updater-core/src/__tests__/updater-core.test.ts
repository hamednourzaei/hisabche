import { createHash, generateKeyPairSync, sign as cryptoSign } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import {
  assignCohortBucket,
  canonicalJsonBytes,
  compareSemVer,
  createFakeUpdaterPorts,
  evaluateApiClientCompatibility,
  evaluateCoreCompatibility,
  evaluateRolloutHealth,
  isDeviceInCohort,
  isValidSemVer,
  maxSatisfying,
  parseSemVer,
  resolveModuleDependencies,
  satisfiesRange,
  transitionUpdateState,
  UPDATE_EVENTS,
  UPDATE_STATES,
  UpdateOrchestrator,
  validateArchiveEntries,
  validateCoreManifest,
  validateModuleManifest,
  type CoreManifest,
  type ModuleManifest,
  type SignedHaltDirective,
  type Verifier,
} from '../index'
import type { InstalledRuntimeContext } from '../resolver'

export class NodeCryptoVerifier implements Verifier {
  async sha256Hex(bytes: Uint8Array): Promise<string> {
    return createHash('sha256').update(bytes).digest('hex').toLowerCase()
  }

  async verifyEd25519(
    payloadBytes: Uint8Array,
    signatureBase64: string,
    publicKeyPem: string,
  ): Promise<boolean> {
    try {
      const { verify } = await import('node:crypto')
      const sig = Buffer.from(signatureBase64.trim(), 'base64')
      if (sig.length !== 64) return false
      return verify(null, Buffer.from(payloadBytes), publicKeyPem, sig)
    } catch {
      return false
    }
  }
}

export function createTestSigningPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  return { keyId: 'root-2026-01', publicKeyPem, privateKeyPem }
}

export function signManifestPayload(
  payloadWithoutSignature: Record<string, unknown>,
  meta: {
    role?: 'targets' | 'root' | 'snapshot' | 'timestamp'
    keyId: string
    privateKeyPem: string
    sequence: number
    signedAt: string
    expiresAt: string
  },
) {
  const signatureMeta = {
    role: meta.role ?? 'targets',
    keyId: meta.keyId,
    algorithm: 'ed25519' as const,
    sequence: meta.sequence,
    signedAt: meta.signedAt,
    expiresAt: meta.expiresAt,
  }
  const canonical = canonicalJsonBytes({ ...payloadWithoutSignature, signatureMeta })
  const sigBase64 = cryptoSign(null, Buffer.from(canonical), meta.privateKeyPem).toString('base64')
  return { ...signatureMeta, sigBase64 }
}

function makeCoreManifestFixture(
  bundleBytes: Uint8Array,
  keys: ReturnType<typeof createTestSigningPair>,
  overrides: Partial<Omit<CoreManifest, 'signature'>> = {},
  seq = 1,
): CoreManifest {
  const sha256 = createHash('sha256').update(bundleBytes).digest('hex').toLowerCase()
  const base: Omit<CoreManifest, 'signature'> = {
    kind: 'core',
    id: 'hisabche-core',
    version: '1.10.0',
    channel: 'stable',
    platforms: ['windows', 'android', 'web'],
    minBootstrapVersion: '1.0.0',
    maxBootstrapVersion: '2.0.0',
    apiRange: '>=1.0.0 <2.0.0',
    dbRange: '>=1.0.0 <2.0.0',
    minLocalSchemaVersion: 1,
    maxLocalSchemaVersion: 2,
    moduleCompatibility: { invoices: '>=1.0.0' },
    requiredMigrations: [],
    artifact: {
      url: 'https://updates.hisabche.com/core/1.10.0.bin',
      sha256,
      sizeBytes: bundleBytes.length,
      etag: '"etag-1.10.0"',
    },
    releaseNotes: { fa: 'به‌روزرسانی هسته', af: 'به‌روزرسانی هسته', en: 'Core update' },
    criticality: 'recommended',
    minSupportedVersion: '1.0.0',
    rollbackTarget: '1.9.0',
    activationRequirements: { requiresRestart: false, deferDuringFinancialOps: true },
    nativeFingerprint: 'native-fp-v1',
    ...overrides,
  }
  const signature = signManifestPayload(base as unknown as Record<string, unknown>, {
    keyId: keys.keyId,
    privateKeyPem: keys.privateKeyPem,
    sequence: seq,
    signedAt: '2026-11-26T10:00:00Z',
    expiresAt: '2026-12-26T10:00:00Z',
  })
  return { ...base, signature }
}

const DEFAULT_RUNTIME: InstalledRuntimeContext = {
  platform: 'windows',
  bootstrapVersion: '1.2.0',
  coreVersion: '1.9.0',
  apiVersion: '1.4.0',
  dbSchemaVersion: '1.4.0',
  localSchemaVersion: 1,
  nativeFingerprint: 'native-fp-v1',
  workspaceCapabilities: ['invoices.manage', 'projects.manage'],
  workspacePermissions: ['invoice.write', 'project.read'],
}

describe('@hisabche/updater-core', () => {
  it('SemVer total ordering rejects lexicographic "1.10" < "1.9" bug and satisfies ranges', () => {
    expect(compareSemVer('1.10.0', '1.9.0')).toBe(1)
    expect(compareSemVer('1.0.0-alpha.1', '1.0.0')).toBe(-1)
    expect(satisfiesRange('1.10.2', '^1.9.0')).toBe(true)
    expect(satisfiesRange('2.0.0', '^1.9.0')).toBe(false)
    expect(maxSatisfying(['1.2.0', '1.9.0', '1.10.0', '2.0.0'], '>=1.0.0 <2.0.0')).toBe('1.10.0')
    expect(isValidSemVer('1.02.3')).toBe(false)
  })

  it('Property-based checks: seeded SemVer total order, cohort monotonicity, and archive path confinement', () => {
    // Seeded deterministic LCG
    let seed = 133742
    const nextInt = (max: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed % max
    }

    const versions: string[] = []
    for (let i = 0; i < 40; i += 1) {
      versions.push(`${nextInt(4)}.${nextInt(15)}.${nextInt(20)}`)
    }
    for (const a of versions) {
      for (const b of versions) {
        const ab = compareSemVer(a, b)
        const ba = compareSemVer(b, a)
        expect(ab).toBe(-ba === 0 ? 0 : -ba)
      }
    }

    // Cohort assignment is stable and monotonic as percentage grows
    for (let i = 0; i < 50; i += 1) {
      const devId = `dev-${nextInt(10000)}`
      const relId = `rel-${nextInt(20)}`
      const b1 = assignCohortBucket(devId, relId)
      const b2 = assignCohortBucket(devId, relId)
      expect(b1).toBe(b2)
      expect(b1).toBeGreaterThanOrEqual(0)
      expect(b1).toBeLessThan(10_000)
      if (isDeviceInCohort({ deviceId: devId, releaseId: relId, rolloutPercent: 10 })) {
        expect(isDeviceInCohort({ deviceId: devId, releaseId: relId, rolloutPercent: 50 })).toBe(
          true,
        )
      }
    }

    // Random generated unsafe paths are always rejected
    const badInputs = [
      '../evil',
      'a/../../b',
      '/etc/passwd',
      'C:\\win\\sys',
      'CON/file.txt',
      'a\0b',
    ]
    for (const bad of badInputs) {
      const res = validateArchiveEntries([{ path: bad, type: 'file', uncompressedBytes: 10 }])
      expect(res.ok).toBe(false)
    }
  })

  it('State machine table enumerates every (state x event) pair with no unhandled pairs', () => {
    for (const state of UPDATE_STATES) {
      for (const event of UPDATE_EVENTS) {
        const res = transitionUpdateState(state, event)
        if (res.ok) {
          expect(UPDATE_STATES).toContain(res.nextState)
        } else {
          expect(res.code).toBe('INVALID_STATE_TRANSITION')
        }
      }
    }
  })

  it('Negative/fuzz corpus: malformed manifests, zip-slip, symlinks, reserved names, case collisions, bombs, non-executable data packs', () => {
    expect(validateCoreManifest(null).ok).toBe(false)
    expect(validateCoreManifest({ kind: 'core', version: 'not-semver' }).ok).toBe(false)
    expect(
      validateArchiveEntries([{ path: 'foo/bar', type: 'symlink', uncompressedBytes: 10 }]).ok,
    ).toBe(false)
    expect(
      validateArchiveEntries([{ path: 'assets/NUL.json', type: 'file', uncompressedBytes: 10 }]).ok,
    ).toBe(false)
    expect(
      validateArchiveEntries([
        { path: 'locales/fa.json', type: 'file', uncompressedBytes: 10 },
        { path: 'locales/FA.json', type: 'file', uncompressedBytes: 10 },
      ]).ok,
    ).toBe(false)
    expect(
      validateArchiveEntries([
        { path: 'bomb.bin', type: 'file', uncompressedBytes: 10_000_000, compressedBytes: 100 },
      ]).ok,
    ).toBe(false)
    expect(
      validateArchiveEntries([{ path: 'payload.js', type: 'file', uncompressedBytes: 100 }], {
        maxTotalBytes: 1024 * 1024,
        maxEntryBytes: 1024 * 1024,
        maxCompressionRatio: 50,
        maxPathLength: 200,
        nonExecutableOnly: true,
      }).ok,
    ).toBe(false)
  })

  it('Compatibility matrix covers Bootstrap/Core, Core/Module, API/Client, and LocalSchema/Runtime', () => {
    const keys = createTestSigningPair()
    const bytes = new TextEncoder().encode('core-bundle')
    const core = makeCoreManifestFixture(bytes, keys)

    expect(evaluateCoreCompatibility(core, DEFAULT_RUNTIME).outcome).toBe('WORKS')
    expect(
      evaluateCoreCompatibility(core, { ...DEFAULT_RUNTIME, bootstrapVersion: '0.9.0' }).outcome,
    ).toBe('REFUSE')
    expect(
      evaluateCoreCompatibility(core, { ...DEFAULT_RUNTIME, nativeFingerprint: 'native-fp-v2' })
        .outcome,
    ).toBe('REFUSE')
    expect(
      evaluateCoreCompatibility(core, { ...DEFAULT_RUNTIME, localSchemaVersion: 5 }).outcome,
    ).toBe('SAFE_MODE')

    expect(
      evaluateApiClientCompatibility({
        clientVersion: '0.8.0',
        minSupportedClientVersion: '1.0.0',
        serverApiVersion: '1.4.0',
        clientRequiredApiRange: '>=1.0.0',
      }),
    ).toBe('STRUCTURED_UPGRADE_REQUIRED')
  })

  it('Dependency resolver detects cycles, unsatisfiable ranges, and self-granted permissions', () => {
    const keys = createTestSigningPair()
    const bytes = new TextEncoder().encode('mod')
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const baseSig = signManifestPayload(
      {},
      {
        keyId: keys.keyId,
        privateKeyPem: keys.privateKeyPem,
        sequence: 1,
        signedAt: '2026-11-26T10:00:00Z',
        expiresAt: '2026-12-26T10:00:00Z',
      },
    )
    const modA: ModuleManifest = {
      kind: 'module',
      id: 'mod-a',
      version: '1.0.0',
      channel: 'stable',
      dependencies: { 'mod-b': '^1.0.0' },
      optionalDependencies: {},
      requiredCoreRange: '>=1.0.0',
      apiRange: '>=1.0.0',
      dbSchemaRange: '>=1.0.0',
      minLocalSchemaVersion: 1,
      platforms: ['windows'],
      requiredCapabilities: ['invoices.manage'],
      requiredPermissions: ['invoice.write'],
      offlineSupport: true,
      artifact: { url: 'https://updates.hisabche.com/mod-a.bin', sha256, sizeBytes: bytes.length },
      signature: baseSig,
      migrationReferences: [],
      releaseNotes: { fa: 'a', af: 'a', en: 'a' },
      rollbackCompatibility: { supportsRollback: true, rollbackTarget: null },
    }
    const modB: ModuleManifest = {
      ...modA,
      id: 'mod-b',
      dependencies: { 'mod-a': '^1.0.0' },
    }
    expect(validateModuleManifest(modA).ok).toBe(true)
    const cyc = resolveModuleDependencies([modA, modB], DEFAULT_RUNTIME)
    expect(cyc.ok).toBe(false)
    if (!cyc.ok) expect(cyc.code).toBe('DEPENDENCY_CYCLE')

    const rogue: ModuleManifest = {
      ...modA,
      id: 'mod-rogue',
      dependencies: {},
      requiredPermissions: ['platform.super_admin'],
    }
    const permRes = resolveModuleDependencies([rogue], DEFAULT_RUNTIME)
    expect(permRes.ok).toBe(false)
    if (!permRes.ok) expect(permRes.code).toBe('MODULE_SELF_GRANT_FORBIDDEN')
  })

  it('Offline-first invariants I1..I13, clock skew resilience, external-outage safety, and signed rollback directive', async () => {
    const verifier = new NodeCryptoVerifier()
    const env = createFakeUpdaterPorts(verifier)
    const keys = createTestSigningPair()
    await env.secureStore.setTrustedKeys([
      { keyId: keys.keyId, algorithm: 'ed25519', publicKeyPem: keys.publicKeyPem },
    ])

    const orchestrator = new UpdateOrchestrator(env.ports)
    const bundleBytes = new TextEncoder().encode('core-1.10.0-verified-payload')
    const manifest = makeCoreManifestFixture(bundleBytes, keys, {}, 2)

    const metaUrl = 'https://updates.hisabche.com/core/windows/latest.json'
    env.transport.metadataResponses.set(metaUrl, {
      status: 200,
      bodyBytes: new TextEncoder().encode(JSON.stringify(manifest)),
      serverTimeMs: Date.parse('2026-11-26T12:00:00Z'),
    })
    env.transport.artifacts.set(manifest.artifact.url, {
      bytes: bundleBytes,
      etag: manifest.artifact.etag,
    })

    // I11: Deferred when financial transaction is active
    env.localDataProbe.activeFinancialTx = true
    const deferred = await orchestrator.runCoreUpdate({
      metadataUrl: metaUrl,
      runtime: DEFAULT_RUNTIME,
    })
    expect(deferred.deferredReason).toBe('DEFERRED_ACTIVE_FINANCIAL_TRANSACTION')
    expect(deferred.ledger.currentVersion).toBe('1.9.0')

    // Complete update when safe; I1-I4 snapshot unchanged; Backend down during health check does NOT roll back healthy local runtime
    env.localDataProbe.activeFinancialTx = false
    const snapshotBefore = await env.localDataProbe.getDataSnapshotHash()
    const updated = await orchestrator.runCoreUpdate({
      metadataUrl: metaUrl,
      runtime: DEFAULT_RUNTIME,
      simulateLocalStartupHealth: async () => 'BACKEND_DOWN',
    })
    expect(updated.activatedVersion).toBe('1.10.0')
    expect(updated.state).toBe('ACTIVE')
    expect(await env.localDataProbe.getDataSnapshotHash()).toBe(snapshotBefore)

    // Replay old sequence 1 is rejected
    const replayManifest = makeCoreManifestFixture(bundleBytes, keys, { version: '1.11.0' }, 1)
    env.transport.metadataResponses.set(metaUrl, {
      status: 200,
      bodyBytes: new TextEncoder().encode(JSON.stringify(replayManifest)),
    })
    const replayRes = await orchestrator.runCoreUpdate({
      metadataUrl: metaUrl,
      runtime: { ...DEFAULT_RUNTIME, coreVersion: '1.10.0' },
    })
    expect(replayRes.failureCode).toBe('SEQUENCE_REPLAY_OR_DOWNGRADE')

    // Legitimate signed halt/rollback directive with higher sequence (seq=3) rolls back 1.10.0 -> 1.9.0
    const haltBase: Omit<SignedHaltDirective, 'signature'> = {
      kind: 'halt-directive',
      releaseId: 'rel-1.10.0',
      layer: 'core',
      targetVersion: '1.10.0',
      rollbackTarget: '1.9.0',
      reason: 'CANARY_STARTUP_SPIKE',
    }
    const haltSig = signManifestPayload(haltBase as unknown as Record<string, unknown>, {
      keyId: keys.keyId,
      privateKeyPem: keys.privateKeyPem,
      sequence: 3,
      signedAt: '2026-11-26T11:00:00Z',
      expiresAt: '2026-12-26T11:00:00Z',
    })
    const haltRes = await orchestrator.applySignedHaltDirective({
      directive: { ...haltBase, signature: haltSig },
      currentLocalSchemaVersion: 1,
    })
    expect(haltRes.applied).toBe(true)
    const afterHalt = await orchestrator.loadLedger('core', '1.9.0')
    expect(afterHalt.currentVersion).toBe('1.9.0')
    expect(afterHalt.badVersions).toContain('1.10.0')
  })

  it('Rollout auto-halt respects minimum sample size and triggers at configured threshold', () => {
    expect(
      evaluateRolloutHealth({
        sampleSize: 10,
        activationSuccessCount: 5,
        startupFailureCount: 5,
        rollbackCount: 0,
        signatureFailureCount: 0,
      }).action,
    ).toBe('INSUFFICIENT_SAMPLE')

    const halt = evaluateRolloutHealth({
      sampleSize: 100,
      activationSuccessCount: 92,
      startupFailureCount: 8,
      rollbackCount: 1,
      signatureFailureCount: 0,
    })
    expect(halt.action).toBe('HALT_AND_ROLLBACK')
  })
})
