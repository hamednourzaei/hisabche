/**
 * Deterministic in-memory port fakes with fault injection for Node tests and
 * shared adapter contract tests. Zero wall-clock or random usage.
 */

import type {
  Clock,
  FileStat,
  FileStore,
  LocalDataProbe,
  MetadataResponse,
  ProcessPort,
  RangeDownloadRequest,
  RangeDownloadResponse,
  RuntimePowerState,
  SecureStore,
  Telemetry,
  TelemetryEvent,
  Transport,
  TrustedPublicKey,
  UpdaterPorts,
  Verifier,
} from './ports'

export class FakeClock implements Clock {
  private now: number
  private mono = 1_000

  constructor(initialMs = Date.parse('2026-11-26T12:00:00Z')) {
    this.now = initialMs
  }

  nowMs(): number {
    return this.now
  }

  monotonicMs(): number {
    this.mono += 1
    return this.mono
  }

  advanceMs(deltaMs: number): void {
    this.now += deltaMs
    this.mono += Math.max(0, deltaMs)
  }

  setWallClockMs(ms: number): void {
    this.now = ms
  }
}

export type FileStoreFault =
  'ENOSPC' | 'EIO' | 'PARTIAL_WRITE' | 'RENAME_LOCKED_EBUSY' | 'CROSS_VOLUME'

export class FakeFileStore implements FileStore {
  private readonly files = new Map<string, Uint8Array>()
  private readonly dirs = new Set<string>(['', 'slots'])
  public freeBytes = 500 * 1024 * 1024
  public faultQueue: FileStoreFault[] = []
  public renameAttempts = 0

  private norm(p: string): string {
    return p.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  }

  private consumeFault(matching: readonly FileStoreFault[]): FileStoreFault | null {
    const idx = this.faultQueue.findIndex((f) => matching.includes(f))
    if (idx < 0) return null
    const [fault] = this.faultQueue.splice(idx, 1)
    return fault ?? null
  }

  async readBytes(path: string): Promise<Uint8Array> {
    const fault = this.consumeFault(['EIO'])
    if (fault) throw new Error(`${fault}: readBytes failed`)
    const data = this.files.get(this.norm(path))
    if (!data) throw new Error(`ENOENT:${path}`)
    return new Uint8Array(data)
  }

  async writeBytes(path: string, data: Uint8Array): Promise<void> {
    const fault = this.consumeFault(['ENOSPC', 'EIO', 'PARTIAL_WRITE'])
    if (fault === 'ENOSPC') throw new Error('ENOSPC: no space left on device')
    if (fault === 'EIO') throw new Error('EIO: disk write error')
    if (fault === 'PARTIAL_WRITE') {
      this.files.set(this.norm(path), data.slice(0, Math.max(1, Math.floor(data.length / 2))))
      throw new Error('EIO: partial write interrupted')
    }
    const np = this.norm(path)
    const parent = np.split('/').slice(0, -1).join('/')
    if (parent) await this.mkdirp(parent)
    this.files.set(np, new Uint8Array(data))
  }

  async atomicRename(fromPath: string, toPath: string): Promise<void> {
    this.renameAttempts += 1
    const fault = this.consumeFault(['RENAME_LOCKED_EBUSY', 'CROSS_VOLUME', 'EIO'])
    if (fault === 'RENAME_LOCKED_EBUSY') throw new Error('EBUSY: file locked by antivirus')
    if (fault === 'CROSS_VOLUME') throw new Error('EXDEV: cross-device link not permitted')
    if (fault === 'EIO') throw new Error('EIO: rename failed')

    const from = this.norm(fromPath)
    const to = this.norm(toPath)
    const movedFiles: Array<[string, Uint8Array]> = []
    for (const [k, v] of this.files.entries()) {
      if (k === from || k.startsWith(`${from}/`)) {
        const suffix = k.slice(from.length)
        movedFiles.push([`${to}${suffix}`, v])
        this.files.delete(k)
      }
    }
    for (const [nk, nv] of movedFiles) {
      this.files.set(nk, nv)
    }
    if (this.dirs.has(from)) {
      this.dirs.delete(from)
      this.dirs.add(to)
    }
  }

  async remove(path: string): Promise<void> {
    const target = this.norm(path)
    for (const k of Array.from(this.files.keys())) {
      if (k === target || k.startsWith(`${target}/`)) {
        this.files.delete(k)
      }
    }
    for (const d of Array.from(this.dirs)) {
      if (d === target || d.startsWith(`${target}/`)) {
        this.dirs.delete(d)
      }
    }
  }

  async exists(path: string): Promise<boolean> {
    const np = this.norm(path)
    return this.files.has(np) || this.dirs.has(np)
  }

  async list(dirPath: string): Promise<readonly string[]> {
    const base = this.norm(dirPath)
    const prefix = base ? `${base}/` : ''
    const names = new Set<string>()
    for (const k of this.files.keys()) {
      if (k.startsWith(prefix)) {
        const rest = k.slice(prefix.length).split('/')[0]
        if (rest) names.add(rest)
      }
    }
    for (const d of this.dirs) {
      if (d.startsWith(prefix) && d !== base) {
        const rest = d.slice(prefix.length).split('/')[0]
        if (rest) names.add(rest)
      }
    }
    return Array.from(names).sort()
  }

  async stat(path: string): Promise<FileStat | null> {
    const np = this.norm(path)
    const f = this.files.get(np)
    if (f) return { sizeBytes: f.length, isFile: true, isDirectory: false }
    if (this.dirs.has(np)) return { sizeBytes: 0, isFile: false, isDirectory: true }
    return null
  }

  async freeSpaceBytes(): Promise<number> {
    return this.freeBytes
  }

  async mkdirp(dirPath: string): Promise<void> {
    const parts = this.norm(dirPath).split('/').filter(Boolean)
    let cur = ''
    for (const part of parts) {
      cur = cur ? `${cur}/${part}` : part
      this.dirs.add(cur)
    }
  }

  async fsync(): Promise<void> {
    // no-op in memory
  }
}

export class FakeTransport implements Transport {
  public metadataResponses = new Map<string, MetadataResponse>()
  public artifacts = new Map<string, { bytes: Uint8Array; etag?: string | undefined }>()
  public failMetadataError: Error | null = null
  public corruptNextDownload = false

  async fetchMetadata(url: string): Promise<MetadataResponse> {
    if (this.failMetadataError) throw this.failMetadataError
    const res = this.metadataResponses.get(url)
    if (!res) return { status: 204, bodyBytes: new Uint8Array(0) }
    return res
  }

  async downloadRange(req: RangeDownloadRequest): Promise<RangeDownloadResponse> {
    const art = this.artifacts.get(req.url)
    if (!art) return { status: 404, bytes: new Uint8Array(0) }
    let bytes = art.bytes
    if (this.corruptNextDownload) {
      this.corruptNextDownload = false
      const mutated = new Uint8Array(bytes)
      if (mutated.length > 0) mutated[0] = (mutated[0]! + 1) % 256
      bytes = mutated
    }
    if (req.offsetBytes > 0 && (!req.expectedEtag || req.expectedEtag === art.etag)) {
      return {
        status: 206,
        bytes: bytes.slice(req.offsetBytes),
        etag: art.etag,
        totalBytes: bytes.length,
      }
    }
    return { status: 200, bytes, etag: art.etag, totalBytes: bytes.length }
  }
}

export class FakeSecureStore implements SecureStore {
  private readonly seqs = new Map<string, number>()
  private keys: TrustedPublicKey[] = []
  private readonly state = new Map<string, string>()
  public deviceId = 'device-test-001'

  async getSequence(layer: string): Promise<number> {
    return this.seqs.get(layer) ?? 0
  }

  async setSequence(layer: string, sequence: number): Promise<void> {
    this.seqs.set(layer, sequence)
  }

  async getTrustedKeys(): Promise<readonly TrustedPublicKey[]> {
    return this.keys
  }

  async setTrustedKeys(keys: readonly TrustedPublicKey[]): Promise<void> {
    this.keys = [...keys]
  }

  async getDeviceId(): Promise<string> {
    return this.deviceId
  }

  async getState(key: string): Promise<string | null> {
    return this.state.get(key) ?? null
  }

  async setState(key: string, value: string): Promise<void> {
    this.state.set(key, value)
  }
}

export class FakeLocalDataProbe implements LocalDataProbe {
  public pendingOutboxCount = 0
  public activeFinancialTx = false
  public localSchemaVersion = 1
  public offlineLicenseValid = true
  public snapshotHash = 'snapshot-v1'

  async getPendingOutboxCount(): Promise<number> {
    return this.pendingOutboxCount
  }

  async hasActiveFinancialTransaction(): Promise<boolean> {
    return this.activeFinancialTx
  }

  async getLocalSchemaVersion(): Promise<number> {
    return this.localSchemaVersion
  }

  async isOfflineLicenseValid(): Promise<boolean> {
    return this.offlineLicenseValid
  }

  async getDataSnapshotHash(): Promise<string> {
    return this.snapshotHash
  }
}

export class FakeTelemetry implements Telemetry {
  private readonly events: TelemetryEvent[] = []
  constructor(public readonly maxCapacity = 100) {}

  async append(event: TelemetryEvent): Promise<void> {
    if (this.events.length >= this.maxCapacity) {
      const nonCritIdx = this.events.findIndex((e) => !e.critical)
      if (nonCritIdx >= 0) {
        this.events.splice(nonCritIdx, 1)
      } else {
        this.events.shift()
      }
    }
    this.events.push(event)
  }

  async drain(maxItems: number): Promise<readonly TelemetryEvent[]> {
    return this.events.splice(0, maxItems)
  }

  async size(): Promise<number> {
    return this.events.length
  }
}

export class FakeProcessPort implements ProcessPort {
  public restarts: string[] = []
  public healthReports: Array<{ healthy: boolean; details?: string | undefined }> = []
  public powerState: RuntimePowerState = {
    isOnWifi: true,
    batteryPercent: 100,
    isCharging: true,
    isSleepingOrShuttingDown: false,
  }
  public locks = new Set<string>()

  async requestRestart(reason: string): Promise<void> {
    this.restarts.push(reason)
  }

  async reportHealth(healthy: boolean, details?: string | undefined): Promise<void> {
    this.healthReports.push({ healthy, details })
  }

  async getPowerState(): Promise<RuntimePowerState> {
    return this.powerState
  }

  async acquireUpdateLock(lockName: string): Promise<boolean> {
    if (this.locks.has(lockName)) return false
    this.locks.add(lockName)
    return true
  }

  async releaseUpdateLock(lockName: string): Promise<void> {
    this.locks.delete(lockName)
  }
}

export function createFakeUpdaterPorts(verifier: Verifier): {
  ports: UpdaterPorts
  clock: FakeClock
  fileStore: FakeFileStore
  transport: FakeTransport
  secureStore: FakeSecureStore
  localDataProbe: FakeLocalDataProbe
  telemetry: FakeTelemetry
  process: FakeProcessPort
} {
  const clock = new FakeClock()
  const fileStore = new FakeFileStore()
  const transport = new FakeTransport()
  const secureStore = new FakeSecureStore()
  const localDataProbe = new FakeLocalDataProbe()
  const telemetry = new FakeTelemetry()
  const process = new FakeProcessPort()
  return {
    ports: {
      clock,
      fileStore,
      transport,
      secureStore,
      verifier,
      localDataProbe,
      telemetry,
      process,
    },
    clock,
    fileStore,
    transport,
    secureStore,
    localDataProbe,
    telemetry,
    process,
  }
}
