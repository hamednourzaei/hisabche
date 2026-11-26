import { createHash, verify as cryptoVerify } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import type {
  FileStat,
  FileStore,
  ProcessPort,
  RuntimePowerState,
  SecureStore,
  TrustedPublicKey,
  Verifier,
} from '../../../../../packages/updater-core/src'

const WINDOWS_RESERVED_RE = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i

export function resolveSafeDesktopPath(rootDir: string, relPath: string): string {
  const cleanRel = relPath.replace(/\\/g, '/').replace(/^\/+/, '')
  if (
    !cleanRel ||
    cleanRel.includes('\0') ||
    cleanRel.includes('..') ||
    /^[A-Za-z]:/.test(cleanRel)
  ) {
    throw new Error(`PATH_TRAVERSAL_REFUSED:${relPath}`)
  }
  for (const seg of cleanRel.split('/')) {
    if (!seg || seg === '.' || seg === '..' || WINDOWS_RESERVED_RE.test(seg)) {
      throw new Error(`UNSAFE_PATH_SEGMENT:${relPath}`)
    }
  }
  const resolvedRoot = path.resolve(rootDir)
  const target = path.resolve(resolvedRoot, cleanRel)
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`
  if (target !== resolvedRoot && !target.startsWith(prefix)) {
    throw new Error(`PATH_TRAVERSAL_REFUSED:${relPath}`)
  }
  return target
}

export class NodeElectronFileStore implements FileStore {
  constructor(
    private readonly rootDir: string,
    private readonly maxRenameRetries = 3,
  ) {
    fs.mkdirSync(this.rootDir, { recursive: true })
  }

  async readBytes(relPath: string): Promise<Uint8Array> {
    const full = resolveSafeDesktopPath(this.rootDir, relPath)
    return new Uint8Array(await fs.promises.readFile(full))
  }

  async writeBytes(relPath: string, data: Uint8Array): Promise<void> {
    const full = resolveSafeDesktopPath(this.rootDir, relPath)
    await fs.promises.mkdir(path.dirname(full), { recursive: true })
    await fs.promises.writeFile(full, data)
  }

  async atomicRename(fromRelPath: string, toRelPath: string): Promise<void> {
    const from = resolveSafeDesktopPath(this.rootDir, fromRelPath)
    const to = resolveSafeDesktopPath(this.rootDir, toRelPath)
    await fs.promises.mkdir(path.dirname(to), { recursive: true })

    let lastErr: unknown
    for (let attempt = 0; attempt <= this.maxRenameRetries; attempt += 1) {
      try {
        await fs.promises.rename(from, to)
        return
      } catch (err) {
        lastErr = err
        const code = (err as NodeJS.ErrnoException).code
        if (code !== 'EBUSY' && code !== 'EPERM' && code !== 'EACCES') {
          throw err
        }
        await new Promise((r) => setTimeout(r, 25 * (attempt + 1)))
      }
    }
    throw lastErr
  }

  async remove(relPath: string): Promise<void> {
    const full = resolveSafeDesktopPath(this.rootDir, relPath)
    await fs.promises.rm(full, { recursive: true, force: true })
  }

  async exists(relPath: string): Promise<boolean> {
    const full = resolveSafeDesktopPath(this.rootDir, relPath)
    return fs.existsSync(full)
  }

  async list(dirRelPath: string): Promise<readonly string[]> {
    const full = resolveSafeDesktopPath(this.rootDir, dirRelPath)
    if (!fs.existsSync(full)) return []
    return (await fs.promises.readdir(full)).sort()
  }

  async stat(relPath: string): Promise<FileStat | null> {
    const full = resolveSafeDesktopPath(this.rootDir, relPath)
    try {
      const s = await fs.promises.stat(full)
      return { sizeBytes: s.size, isFile: s.isFile(), isDirectory: s.isDirectory() }
    } catch {
      return null
    }
  }

  async freeSpaceBytes(dirRelPath: string): Promise<number> {
    const full = resolveSafeDesktopPath(this.rootDir, dirRelPath)
    await fs.promises.mkdir(full, { recursive: true })
    const statfs = await fs.promises.statfs(full)
    return Number(statfs.bavail) * Number(statfs.bsize)
  }

  async mkdirp(dirRelPath: string): Promise<void> {
    const full = resolveSafeDesktopPath(this.rootDir, dirRelPath)
    await fs.promises.mkdir(full, { recursive: true })
  }

  async fsync(relPath: string): Promise<void> {
    const full = resolveSafeDesktopPath(this.rootDir, relPath)
    const fh = await fs.promises.open(full, 'r+')
    try {
      await fh.sync()
    } finally {
      await fh.close()
    }
  }
}

export class NodeElectronVerifier implements Verifier {
  async sha256Hex(bytes: Uint8Array): Promise<string> {
    return createHash('sha256').update(bytes).digest('hex').toLowerCase()
  }

  async verifyEd25519(
    payloadBytes: Uint8Array,
    signatureBase64: string,
    publicKeyPem: string,
  ): Promise<boolean> {
    try {
      const sig = Buffer.from(signatureBase64.trim(), 'base64')
      if (sig.length !== 64) return false
      return cryptoVerify(null, Buffer.from(payloadBytes), publicKeyPem, sig)
    } catch {
      return false
    }
  }
}

export class FileBackedSecureStore implements SecureStore {
  private readonly storePath: string

  constructor(
    baseDir: string,
    private readonly deviceId: string,
  ) {
    fs.mkdirSync(baseDir, { recursive: true })
    this.storePath = path.join(baseDir, 'updater-secure-state.json')
  }

  private readAll(): {
    sequences: Record<string, number>
    keys: TrustedPublicKey[]
    state: Record<string, string>
  } {
    if (!fs.existsSync(this.storePath)) {
      return { sequences: {}, keys: [], state: {} }
    }
    try {
      return JSON.parse(fs.readFileSync(this.storePath, 'utf8'))
    } catch {
      return { sequences: {}, keys: [], state: {} }
    }
  }

  private writeAll(data: {
    sequences: Record<string, number>
    keys: TrustedPublicKey[]
    state: Record<string, string>
  }): void {
    const tmp = `${this.storePath}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(data), 'utf8')
    fs.renameSync(tmp, this.storePath)
  }

  async getSequence(layer: string): Promise<number> {
    return this.readAll().sequences[layer] ?? 0
  }

  async setSequence(layer: string, sequence: number): Promise<void> {
    const all = this.readAll()
    all.sequences[layer] = sequence
    this.writeAll(all)
  }

  async getTrustedKeys(): Promise<readonly TrustedPublicKey[]> {
    return this.readAll().keys
  }

  async setTrustedKeys(keys: readonly TrustedPublicKey[]): Promise<void> {
    const all = this.readAll()
    all.keys = [...keys]
    this.writeAll(all)
  }

  async getDeviceId(): Promise<string> {
    return this.deviceId
  }

  async getState(key: string): Promise<string | null> {
    return this.readAll().state[key] ?? null
  }

  async setState(key: string, value: string): Promise<void> {
    const all = this.readAll()
    all.state[key] = value
    this.writeAll(all)
  }
}

export class DesktopProcessLockPort implements ProcessPort {
  constructor(
    private readonly lockDir: string,
    private readonly onRestart: (reason: string) => Promise<void>,
  ) {
    fs.mkdirSync(this.lockDir, { recursive: true })
  }

  async requestRestart(reason: string): Promise<void> {
    await this.onRestart(reason)
  }

  async reportHealth(): Promise<void> {
    // Forwarded to monitoring.ts in packaged Electron main process
  }

  async getPowerState(): Promise<RuntimePowerState> {
    return {
      isOnWifi: true,
      batteryPercent: 100,
      isCharging: true,
      isSleepingOrShuttingDown: false,
    }
  }

  async acquireUpdateLock(lockName: string): Promise<boolean> {
    const safeName = lockName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const lockFile = path.join(this.lockDir, `${safeName}.lock`)
    try {
      const fd = fs.openSync(lockFile, 'wx')
      fs.writeSync(fd, String(process.pid))
      fs.closeSync(fd)
      return true
    } catch {
      return false
    }
  }

  async releaseUpdateLock(lockName: string): Promise<void> {
    const safeName = lockName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const lockFile = path.join(this.lockDir, `${safeName}.lock`)
    fs.rmSync(lockFile, { force: true })
  }
}
