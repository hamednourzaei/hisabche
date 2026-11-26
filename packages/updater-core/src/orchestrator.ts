/**
 * Pure UpdateOrchestrator implementing Section 8.2 algorithm, Section 8.3 policies,
 * Section 8.4 atomic slot activation & crash-loop rollback, and Section 13.2 crash points.
 */

import { verifySignedPayload } from './canonical-json'
import { validateCoreManifest, type CoreManifest, type SignedHaltDirective } from './manifests'
import type { UpdaterPorts } from './ports'
import { evaluateCoreCompatibility, type InstalledRuntimeContext } from './resolver'
import { compareSemVer } from './semver'
import { transitionUpdateState, type UpdateState } from './state-machine'

export const CRASH_POINTS = [
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
] as const

export type CrashPoint = (typeof CRASH_POINTS)[number]

export type CrashHook = (point: CrashPoint) => Promise<void> | void

export interface UpdatePolicy {
  autoDownload: boolean
  autoActivateWhenSafe: boolean
  activateOnNextRestart: boolean
  askBeforeRestart: boolean
  wifiOnly: boolean
  minFreeSpaceBytes: number
  minBatteryPercent: number
  deferDuringFinancialOps: boolean
  maxBootAttempts: number
  maxRenameRetries: number
}

export const DEFAULT_UPDATE_POLICY: UpdatePolicy = {
  autoDownload: true,
  autoActivateWhenSafe: true,
  activateOnNextRestart: false,
  askBeforeRestart: false,
  wifiOnly: false,
  minFreeSpaceBytes: 20 * 1024 * 1024,
  minBatteryPercent: 15,
  deferDuringFinancialOps: true,
  maxBootAttempts: 3,
  maxRenameRetries: 3,
}

export interface SlotLedger {
  layer: string
  state: UpdateState
  currentVersion: string
  previousVersion: string | null
  lastKnownGoodVersion: string
  pendingVersion: string | null
  bootAttempts: number
  badVersions: string[]
  localSchemaByVersion: Record<string, number>
  lastFailureCode: string | null
  safeMode: boolean
  activeEtag: string | null
  downloadedBytes: number
}

export interface UpdateCycleResult {
  state: UpdateState
  ledger: SlotLedger
  activatedVersion: string | null
  deferredReason?: string | undefined
  failureCode?: string | undefined
  clockSkewWarning?: boolean | undefined
}

const LEDGER_KEY_PREFIX = 'updater:ledger:'

export class UpdateOrchestrator {
  private readonly crashHook?: CrashHook | undefined

  constructor(
    private readonly ports: UpdaterPorts,
    private readonly slotsRoot = 'slots',
    crashHook?: CrashHook | undefined,
  ) {
    this.crashHook = crashHook
  }

  private async hitCrashPoint(point: CrashPoint): Promise<void> {
    if (this.crashHook) {
      await this.crashHook(point)
    }
  }

  async loadLedger(layer: string, initialVersion: string, initialSchema = 1): Promise<SlotLedger> {
    const raw = await this.ports.secureStore.getState(`${LEDGER_KEY_PREFIX}${layer}`)
    if (raw) {
      try {
        return JSON.parse(raw) as SlotLedger
      } catch {
        // Fallback to clean initial ledger
      }
    }
    const ledger: SlotLedger = {
      layer,
      state: 'UP_TO_DATE',
      currentVersion: initialVersion,
      previousVersion: null,
      lastKnownGoodVersion: initialVersion,
      pendingVersion: null,
      bootAttempts: 0,
      badVersions: [],
      localSchemaByVersion: { [initialVersion]: initialSchema },
      lastFailureCode: null,
      safeMode: false,
      activeEtag: null,
      downloadedBytes: 0,
    }
    await this.saveLedger(ledger)
    return ledger
  }

  private async saveLedger(ledger: SlotLedger): Promise<void> {
    await this.ports.secureStore.setState(
      `${LEDGER_KEY_PREFIX}${ledger.layer}`,
      JSON.stringify(ledger),
    )
  }

  private transition(ledger: SlotLedger, event: Parameters<typeof transitionUpdateState>[1]): void {
    const res = transitionUpdateState(ledger.state, event)
    if (res.ok) {
      ledger.state = res.nextState
    }
  }

  private async recordFailure(
    ledger: SlotLedger,
    code: string,
    critical: boolean,
    version?: string | undefined,
  ): Promise<void> {
    ledger.lastFailureCode = code
    await this.ports.telemetry.append({
      id: `${ledger.layer}:${this.ports.clock.monotonicMs()}:${code}`,
      kind: critical ? 'verification_failure' : 'activation_failure',
      critical,
      timestampMs: this.ports.clock.nowMs(),
      version,
      reasonCode: code,
    })
  }

  private async atomicRenameWithRetry(
    fromPath: string,
    toPath: string,
    maxRetries: number,
  ): Promise<void> {
    let lastError: unknown
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        await this.ports.fileStore.atomicRename(fromPath, toPath)
        return
      } catch (err) {
        lastError = err
        const msg = err instanceof Error ? err.message : String(err)
        if (!msg.includes('EBUSY') && !msg.includes('EPERM') && !msg.includes('LOCKED')) {
          throw err
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error('RENAME_RETRY_EXHAUSTED')
  }

  async runCoreUpdate(input: {
    metadataUrl: string
    runtime: InstalledRuntimeContext
    policy?: UpdatePolicy | undefined
    simulateLocalStartupHealth?:
      ((version: string) => Promise<'HEALTHY' | 'LOCAL_CRASH' | 'BACKEND_DOWN'>) | undefined
  }): Promise<UpdateCycleResult> {
    const policy = input.policy ?? DEFAULT_UPDATE_POLICY
    const layer = 'core'
    const ledger = await this.loadLedger(
      layer,
      input.runtime.coreVersion,
      input.runtime.localSchemaVersion,
    )
    ledger.state =
      ledger.state === 'ACTIVE' || ledger.state === 'FAILED' || ledger.state === 'INCOMPATIBLE'
        ? 'UP_TO_DATE'
        : ledger.state

    const locked = await this.ports.process.acquireUpdateLock(`update:${layer}`)
    if (!locked) {
      return {
        state: ledger.state,
        ledger,
        activatedVersion: null,
        deferredReason: 'UPDATE_LOCK_HELD_BY_ANOTHER_INSTANCE',
      }
    }

    try {
      await this.hitCrashPoint('CP_01_BEFORE_METADATA')
      this.transition(ledger, 'START_CHECK')
      await this.saveLedger(ledger)

      let metaRes
      try {
        metaRes = await this.ports.transport.fetchMetadata(input.metadataUrl, 10_000)
      } catch {
        // Section 11 I8: failed update check never disables normal operation
        this.transition(ledger, 'FAIL')
        await this.recordFailure(ledger, 'METADATA_NETWORK_ERROR', false)
        await this.saveLedger(ledger)
        return {
          state: ledger.state,
          ledger,
          activatedVersion: null,
          failureCode: 'METADATA_NETWORK_ERROR',
        }
      }

      if (metaRes.status === 204 || metaRes.status === 304) {
        this.transition(ledger, 'NO_UPDATE')
        await this.saveLedger(ledger)
        return { state: ledger.state, ledger, activatedVersion: null }
      }

      let rawJson: unknown
      try {
        rawJson = JSON.parse(new TextDecoder().decode(metaRes.bodyBytes))
      } catch {
        this.transition(ledger, 'FAIL')
        await this.recordFailure(ledger, 'MANIFEST_JSON_INVALID', true)
        await this.saveLedger(ledger)
        return {
          state: ledger.state,
          ledger,
          activatedVersion: null,
          failureCode: 'MANIFEST_JSON_INVALID',
        }
      }

      const validated = validateCoreManifest(rawJson)
      if (!validated.ok) {
        this.transition(ledger, 'FAIL')
        await this.recordFailure(ledger, validated.code, true)
        await this.saveLedger(ledger)
        return { state: ledger.state, ledger, activatedVersion: null, failureCode: validated.code }
      }

      const manifest: CoreManifest = validated.value
      const { signature: _, ...payloadWithoutSignature } = rawJson as Record<string, unknown>
      const sigCheck = await verifySignedPayload({
        layer,
        payloadWithoutSignature,
        signature: manifest.signature,
        secureStore: this.ports.secureStore,
        verifier: this.ports.verifier,
        clock: this.ports.clock,
        serverTimeMs: metaRes.serverTimeMs,
      })
      if (!sigCheck.ok) {
        this.transition(ledger, 'FAIL')
        await this.recordFailure(ledger, sigCheck.code, true, manifest.version)
        await this.saveLedger(ledger)
        return { state: ledger.state, ledger, activatedVersion: null, failureCode: sigCheck.code }
      }

      await this.hitCrashPoint('CP_02_AFTER_METADATA')

      if (
        compareSemVer(manifest.version, ledger.currentVersion) <= 0 ||
        ledger.badVersions.includes(manifest.version)
      ) {
        this.transition(ledger, 'NO_UPDATE')
        await this.saveLedger(ledger)
        return { state: ledger.state, ledger, activatedVersion: null }
      }

      const compat = evaluateCoreCompatibility(manifest, input.runtime)
      if (compat.outcome === 'REFUSE' || compat.outcome === 'SAFE_MODE') {
        this.transition(ledger, 'INCOMPATIBLE_TARGET')
        await this.recordFailure(
          ledger,
          compat.reasonCode ?? compat.outcome,
          false,
          manifest.version,
        )
        await this.saveLedger(ledger)
        return {
          state: ledger.state,
          ledger,
          activatedVersion: null,
          failureCode: compat.reasonCode ?? compat.outcome,
        }
      }

      this.transition(ledger, 'FOUND_UPDATE')
      ledger.pendingVersion = manifest.version
      await this.saveLedger(ledger)

      // Policy checks before download
      const power = await this.ports.process.getPowerState()
      if (power.isSleepingOrShuttingDown) {
        return {
          state: ledger.state,
          ledger,
          activatedVersion: null,
          deferredReason: 'DEFERRED_POWER_SLEEP_OR_SHUTDOWN',
        }
      }
      if (policy.wifiOnly && !power.isOnWifi) {
        return {
          state: ledger.state,
          ledger,
          activatedVersion: null,
          deferredReason: 'DEFERRED_WIFI_ONLY',
        }
      }
      if (!power.isCharging && power.batteryPercent < policy.minBatteryPercent) {
        return {
          state: ledger.state,
          ledger,
          activatedVersion: null,
          deferredReason: 'DEFERRED_LOW_BATTERY',
        }
      }

      const freeBytes = await this.ports.fileStore.freeSpaceBytes(this.slotsRoot)
      if (freeBytes < manifest.artifact.sizeBytes + policy.minFreeSpaceBytes) {
        this.transition(ledger, 'FAIL')
        await this.recordFailure(ledger, 'INSUFFICIENT_DISK_SPACE', false, manifest.version)
        await this.saveLedger(ledger)
        return {
          state: ledger.state,
          ledger,
          activatedVersion: null,
          failureCode: 'INSUFFICIENT_DISK_SPACE',
        }
      }

      await this.hitCrashPoint('CP_03_BEFORE_DOWNLOAD')
      this.transition(ledger, 'START_DOWNLOAD')
      const partialPath = `${this.slotsRoot}/${layer}/.partial-${manifest.version}.bin`
      await this.ports.fileStore.mkdirp(`${this.slotsRoot}/${layer}`)
      await this.saveLedger(ledger)

      let existingBytes: Uint8Array = new Uint8Array(0)
      if (await this.ports.fileStore.exists(partialPath)) {
        existingBytes = await this.ports.fileStore.readBytes(partialPath)
      }

      const dlRes = await this.ports.transport.downloadRange({
        url: manifest.artifact.url,
        offsetBytes: existingBytes.length,
        expectedEtag: ledger.activeEtag ?? manifest.artifact.etag,
        timeoutMs: 30_000,
      })

      await this.hitCrashPoint('CP_04_MID_DOWNLOAD')

      // If server ETag changed mid-resume (412/200 full restart), discard partial and restart cleanly
      let combinedBytes: Uint8Array
      if (
        existingBytes.length > 0 &&
        dlRes.status === 206 &&
        (!manifest.artifact.etag || !dlRes.etag || dlRes.etag === manifest.artifact.etag)
      ) {
        const merged = new Uint8Array(existingBytes.length + dlRes.bytes.length)
        merged.set(existingBytes, 0)
        merged.set(dlRes.bytes, existingBytes.length)
        combinedBytes = merged
      } else {
        if (dlRes.status !== 200 && dlRes.status !== 206) {
          this.transition(ledger, 'FAIL')
          await this.recordFailure(ledger, `DOWNLOAD_HTTP_${dlRes.status}`, false, manifest.version)
          await this.saveLedger(ledger)
          return {
            state: ledger.state,
            ledger,
            activatedVersion: null,
            failureCode: `DOWNLOAD_HTTP_${dlRes.status}`,
          }
        }
        combinedBytes = new Uint8Array(dlRes.bytes)
      }

      await this.ports.fileStore.writeBytes(partialPath, combinedBytes)
      ledger.activeEtag = dlRes.etag ?? manifest.artifact.etag ?? null
      ledger.downloadedBytes = combinedBytes.length
      await this.hitCrashPoint('CP_05_AFTER_DOWNLOAD')

      this.transition(ledger, 'DOWNLOAD_COMPLETE')
      await this.saveLedger(ledger)

      const actualHash = await this.ports.verifier.sha256Hex(combinedBytes)
      if (actualHash.toLowerCase() !== manifest.artifact.sha256.toLowerCase()) {
        await this.ports.fileStore.remove(partialPath)
        ledger.downloadedBytes = 0
        this.transition(ledger, 'VERIFY_FAIL')
        await this.recordFailure(ledger, 'ARTIFACT_HASH_MISMATCH', true, manifest.version)
        await this.saveLedger(ledger)
        return {
          state: ledger.state,
          ledger,
          activatedVersion: null,
          failureCode: 'ARTIFACT_HASH_MISMATCH',
        }
      }

      await this.hitCrashPoint('CP_06_AFTER_HASH_VERIFY')
      await this.hitCrashPoint('CP_07_AFTER_SIGNATURE_VERIFY')

      this.transition(ledger, 'VERIFY_PASS')
      this.transition(ledger, 'COMPAT_PASS')
      await this.saveLedger(ledger)

      // Stage in inactive slot
      const stagingSlot = `${this.slotsRoot}/${layer}/.staging-${manifest.version}`
      const targetSlot = `${this.slotsRoot}/${layer}/${manifest.version}`
      await this.ports.fileStore.mkdirp(stagingSlot)
      await this.ports.fileStore.writeBytes(`${stagingSlot}/bundle.bin`, combinedBytes)
      await this.ports.fileStore.fsync(`${stagingSlot}/bundle.bin`)
      await this.hitCrashPoint('CP_08_AFTER_STAGING_WRITE')

      // Section 11 I11: defer activation while financial ops are active
      if (policy.deferDuringFinancialOps) {
        const hasActiveTx = await this.ports.localDataProbe.hasActiveFinancialTransaction()
        if (hasActiveTx) {
          return {
            state: ledger.state,
            ledger,
            activatedVersion: null,
            deferredReason: 'DEFERRED_ACTIVE_FINANCIAL_TRANSACTION',
          }
        }
      }

      this.transition(ledger, 'BEGIN_INSTALL')
      await this.hitCrashPoint('CP_09_BEFORE_SLOT_SWAP')

      await this.atomicRenameWithRetry(stagingSlot, targetSlot, policy.maxRenameRetries)
      await this.ports.fileStore.remove(partialPath)

      const prevVersion = ledger.currentVersion
      ledger.previousVersion = prevVersion
      ledger.currentVersion = manifest.version
      ledger.pendingVersion = null
      ledger.bootAttempts = 1
      ledger.localSchemaByVersion[manifest.version] = manifest.maxLocalSchemaVersion
      await this.ports.secureStore.setSequence(layer, sigCheck.sequence)
      this.transition(ledger, 'INSTALL_DONE')
      await this.saveLedger(ledger)
      await this.hitCrashPoint('CP_10_AFTER_SLOT_SWAP')

      await this.hitCrashPoint('CP_11_BEFORE_HEALTH_CONFIRM')
      const healthOutcome = input.simulateLocalStartupHealth
        ? await input.simulateLocalStartupHealth(manifest.version)
        : 'HEALTHY'

      if (healthOutcome === 'LOCAL_CRASH') {
        await this.rollbackToPrevious(ledger, policy, 'STARTUP_HEALTH_LOCAL_CRASH')
        await this.saveLedger(ledger)
        return {
          state: ledger.state,
          ledger,
          activatedVersion: null,
          failureCode: 'STARTUP_HEALTH_LOCAL_CRASH',
        }
      }

      // External failure (BACKEND_DOWN) never triggers rollback of healthy local runtime (8.4 & #14)
      ledger.lastKnownGoodVersion = manifest.version
      ledger.bootAttempts = 0
      ledger.lastFailureCode = null
      this.transition(ledger, 'HEALTH_OK')
      await this.ports.process.reportHealth(true, `core:${manifest.version}`)
      await this.saveLedger(ledger)
      await this.hitCrashPoint('CP_12_AFTER_HEALTH_CONFIRM')

      await this.hitCrashPoint('CP_13_BEFORE_TELEMETRY')
      await this.ports.telemetry.append({
        id: `${layer}:activated:${manifest.version}`,
        kind: 'activation_success',
        critical: false,
        timestampMs: this.ports.clock.nowMs(),
        version: manifest.version,
      })

      await this.hitCrashPoint('CP_14_BEFORE_CLEANUP')
      // Keep previousVersion slot intact for recovery; only remove older obsolete slots
      const existingDirs = await this.ports.fileStore.list(`${this.slotsRoot}/${layer}`)
      for (const dirName of existingDirs) {
        if (
          dirName !== ledger.currentVersion &&
          dirName !== ledger.previousVersion &&
          !dirName.startsWith('.staging-')
        ) {
          await this.ports.fileStore.remove(`${this.slotsRoot}/${layer}/${dirName}`)
        }
      }

      return {
        state: ledger.state,
        ledger,
        activatedVersion: manifest.version,
        clockSkewWarning: sigCheck.clockSkewWarning,
      }
    } finally {
      await this.ports.process.releaseUpdateLock(`update:${layer}`)
    }
  }

  async recordBootAttemptAndGuard(
    layer: string,
    initialVersion: string,
    policy = DEFAULT_UPDATE_POLICY,
  ): Promise<SlotLedger> {
    const ledger = await this.loadLedger(layer, initialVersion)
    if (ledger.currentVersion === ledger.lastKnownGoodVersion) {
      ledger.bootAttempts = 0
      await this.saveLedger(ledger)
      return ledger
    }
    ledger.bootAttempts += 1
    if (ledger.bootAttempts > policy.maxBootAttempts) {
      await this.rollbackToPrevious(ledger, policy, 'CRASH_LOOP_EXCEEDED')
    }
    await this.saveLedger(ledger)
    return ledger
  }

  private async rollbackToPrevious(
    ledger: SlotLedger,
    _policy: UpdatePolicy,
    reasonCode: string,
  ): Promise<void> {
    this.transition(ledger, 'HEALTH_FAIL')
    this.transition(ledger, 'HALT_ROLLBACK')

    const failedVersion = ledger.currentVersion
    if (!ledger.badVersions.includes(failedVersion)) {
      ledger.badVersions.push(failedVersion)
    }

    const target = ledger.previousVersion ?? ledger.lastKnownGoodVersion
    const currentSchema = ledger.localSchemaByVersion[failedVersion] ?? 1
    const targetSchema = ledger.localSchemaByVersion[target] ?? 1
    if (targetSchema < currentSchema) {
      // Section 8.4 / #13: never destructively roll back to an incompatible older schema
      ledger.safeMode = true
      ledger.lastFailureCode = 'ROLLBACK_SCHEMA_INCOMPATIBLE_SAFE_MODE'
      this.transition(ledger, 'FAIL')
      await this.ports.telemetry.append({
        id: `${ledger.layer}:safemode:${this.ports.clock.monotonicMs()}`,
        kind: 'rollback_triggered',
        critical: true,
        timestampMs: this.ports.clock.nowMs(),
        version: failedVersion,
        reasonCode: 'ROLLBACK_SCHEMA_INCOMPATIBLE_SAFE_MODE',
      })
      return
    }

    ledger.currentVersion = target
    ledger.bootAttempts = 0
    ledger.lastFailureCode = reasonCode
    this.transition(ledger, 'ROLLBACK_DONE')
    await this.ports.telemetry.append({
      id: `${ledger.layer}:rollback:${this.ports.clock.monotonicMs()}`,
      kind: 'rollback_triggered',
      critical: true,
      timestampMs: this.ports.clock.nowMs(),
      version: failedVersion,
      reasonCode,
    })
  }

  async applySignedHaltDirective(input: {
    directive: SignedHaltDirective
    currentLocalSchemaVersion: number
    deferDuringFinancialOps?: boolean | undefined
  }): Promise<{ applied: boolean; code: string; safeMode?: boolean | undefined }> {
    const { signature: _, ...payloadWithoutSignature } = input.directive as unknown as Record<
      string,
      unknown
    >
    const sigCheck = await verifySignedPayload({
      layer: input.directive.layer,
      payloadWithoutSignature,
      signature: input.directive.signature,
      secureStore: this.ports.secureStore,
      verifier: this.ports.verifier,
      clock: this.ports.clock,
    })
    if (!sigCheck.ok) {
      return { applied: false, code: sigCheck.code }
    }
    if (input.deferDuringFinancialOps) {
      const busy = await this.ports.localDataProbe.hasActiveFinancialTransaction()
      if (busy) {
        return { applied: false, code: 'DEFERRED_ACTIVE_FINANCIAL_TRANSACTION' }
      }
    }
    const ledger = await this.loadLedger(
      input.directive.layer,
      input.directive.targetVersion,
      input.currentLocalSchemaVersion,
    )
    if (!ledger.badVersions.includes(input.directive.targetVersion)) {
      ledger.badVersions.push(input.directive.targetVersion)
    }
    await this.ports.secureStore.setSequence(input.directive.layer, sigCheck.sequence)
    if (ledger.currentVersion === input.directive.targetVersion && input.directive.rollbackTarget) {
      const targetSchema = ledger.localSchemaByVersion[input.directive.rollbackTarget] ?? 1
      if (targetSchema < input.currentLocalSchemaVersion) {
        ledger.safeMode = true
        ledger.lastFailureCode = 'HALT_TARGET_SCHEMA_INCOMPATIBLE'
        await this.saveLedger(ledger)
        return { applied: false, code: 'HALT_TARGET_SCHEMA_INCOMPATIBLE', safeMode: true }
      }
      ledger.currentVersion = input.directive.rollbackTarget
      ledger.state = 'ACTIVE'
    }
    await this.ports.telemetry.append({
      id: `${input.directive.layer}:halt:${sigCheck.sequence}`,
      kind: 'halt_applied',
      critical: true,
      timestampMs: this.ports.clock.nowMs(),
      version: input.directive.targetVersion,
      reasonCode: input.directive.reason,
    })
    await this.saveLedger(ledger)
    return { applied: true, code: 'HALT_APPLIED' }
  }
}
