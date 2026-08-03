// ============================================
// Secure credential storage.
//
// Electron's safeStorage is backed by DPAPI on Windows, Keychain on macOS and
// libsecret on Linux. When the OS keyring is unavailable (headless Linux, some
// CI images) it falls back to an on-disk file — still scoped to userData, but
// unencrypted, so callers are told via `isEncryptionAvailable`.
// ============================================

import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function vaultDir(): string {
  const dir = join(app.getPath('userData'), 'vault')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

const entryPath = (key: string): string => join(vaultDir(), `${key}.bin`)

export function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

export function secureGet(key: string): string | null {
  const path = entryPath(key)
  if (!existsSync(path)) return null

  try {
    const buffer = readFileSync(path)
    return isEncryptionAvailable() ? safeStorage.decryptString(buffer) : buffer.toString('utf8')
  } catch {
    // Corrupt or written under a different OS user — drop it rather than loop.
    rmSync(path, { force: true })
    return null
  }
}

export function secureSet(key: string, value: string): void {
  const payload = isEncryptionAvailable()
    ? safeStorage.encryptString(value)
    : Buffer.from(value, 'utf8')

  writeFileSync(entryPath(key), payload, { mode: 0o600 })
}

export function secureDelete(key: string): void {
  rmSync(entryPath(key), { force: true })
}
