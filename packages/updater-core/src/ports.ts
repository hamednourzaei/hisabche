/**
 * Pure platform-independent ports for @hisabche/updater-core.
 * Adapters (Electron, Android/Expo, Web, In-Memory Fakes) implement these
 * interfaces and contain zero update decision logic.
 */

export interface Clock {
  nowMs(): number
  monotonicMs(): number
}

export interface FileStat {
  sizeBytes: number
  isFile: boolean
  isDirectory: boolean
}

export interface FileStore {
  readBytes(path: string): Promise<Uint8Array>
  writeBytes(path: string, data: Uint8Array): Promise<void>
  atomicRename(fromPath: string, toPath: string): Promise<void>
  remove(path: string): Promise<void>
  exists(path: string): Promise<boolean>
  list(dirPath: string): Promise<readonly string[]>
  stat(path: string): Promise<FileStat | null>
  freeSpaceBytes(dirPath: string): Promise<number>
  mkdirp(dirPath: string): Promise<void>
  fsync(path: string): Promise<void>
}

export interface MetadataResponse {
  status: number
  bodyBytes: Uint8Array
  etag?: string | undefined
  serverTimeMs?: number | undefined
}

export interface RangeDownloadRequest {
  url: string
  offsetBytes: number
  expectedEtag?: string | undefined
  timeoutMs: number
}

export interface RangeDownloadResponse {
  status: number
  bytes: Uint8Array
  etag?: string | undefined
  totalBytes?: number | undefined
}

export interface Transport {
  fetchMetadata(url: string, timeoutMs: number): Promise<MetadataResponse>
  downloadRange(req: RangeDownloadRequest): Promise<RangeDownloadResponse>
}

export interface TrustedPublicKey {
  keyId: string
  algorithm: 'ed25519'
  publicKeyPem: string
  revoked?: boolean | undefined
}

export interface SecureStore {
  getSequence(layer: string): Promise<number>
  setSequence(layer: string, sequence: number): Promise<void>
  getTrustedKeys(): Promise<readonly TrustedPublicKey[]>
  setTrustedKeys(keys: readonly TrustedPublicKey[]): Promise<void>
  getDeviceId(): Promise<string>
  getState(key: string): Promise<string | null>
  setState(key: string, value: string): Promise<void>
}

export interface Verifier {
  sha256Hex(bytes: Uint8Array): Promise<string>
  verifyEd25519(
    payloadBytes: Uint8Array,
    signatureBase64: string,
    publicKeyPem: string,
  ): Promise<boolean>
}

export interface LocalDataProbe {
  getPendingOutboxCount(): Promise<number>
  hasActiveFinancialTransaction(): Promise<boolean>
  getLocalSchemaVersion(): Promise<number>
  isOfflineLicenseValid(): Promise<boolean>
  getDataSnapshotHash(): Promise<string>
}

export interface TelemetryEvent {
  id: string
  kind:
    | 'update_check'
    | 'download_progress'
    | 'verification_failure'
    | 'activation_success'
    | 'activation_failure'
    | 'rollback_triggered'
    | 'halt_applied'
  critical: boolean
  timestampMs: number
  releaseId?: string | undefined
  version?: string | undefined
  reasonCode?: string | undefined
}

export interface Telemetry {
  append(event: TelemetryEvent): Promise<void>
  drain(maxItems: number): Promise<readonly TelemetryEvent[]>
  size(): Promise<number>
}

export interface RuntimePowerState {
  isOnWifi: boolean
  batteryPercent: number
  isCharging: boolean
  isSleepingOrShuttingDown: boolean
}

export interface ProcessPort {
  requestRestart(reason: string): Promise<void>
  reportHealth(healthy: boolean, details?: string | undefined): Promise<void>
  getPowerState(): Promise<RuntimePowerState>
  acquireUpdateLock(lockName: string): Promise<boolean>
  releaseUpdateLock(lockName: string): Promise<void>
}

export interface UpdaterPorts {
  clock: Clock
  fileStore: FileStore
  transport: Transport
  secureStore: SecureStore
  verifier: Verifier
  localDataProbe: LocalDataProbe
  telemetry: Telemetry
  process: ProcessPort
}
