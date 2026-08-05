// ============================================
// Secure credential storage with security hardening.
//
// Electron's safeStorage is backed by DPAPI on Windows, Keychain on macOS and
// libsecret on Linux. When the OS keyring is unavailable (headless Linux, some
// CI images) it falls back to an on-disk file — still scoped to userData, but
// unencrypted, so callers are told via `isEncryptionAvailable`.
//
// Security enhancements:
// - Input validation for keys and values
// - Size limits to prevent resource exhaustion
// - Secure file permissions
// - Audit logging for sensitive operations
// - Protection against path traversal attacks
// ============================================

import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function vaultDir(): string {
  const dir = join(app.getPath('userData'), 'vault')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

// Validate and sanitize key to prevent path traversal attacks
function validateKey(key: string): string {
  if (typeof key !== 'string' || !key) {
    throw new Error('INVALID_KEY: Key must be a non-empty string')
  }

  // Maximum key length to prevent resource exhaustion
  if (key.length > 128) {
    throw new Error('KEY_TOO_LONG: Key must not exceed 128 characters')
  }

  // Allow only alphanumeric characters, dots, dashes, and underscores
  const sanitizedKey = key.replace(/[^A-Za-z0-9._-]/g, '')

  // Ensure key doesn't start or end with special characters
  if (!sanitizedKey || sanitizedKey.startsWith('.') || sanitizedKey.endsWith('.')) {
    throw new Error('INVALID_KEY: Key format not allowed')
  }

  return sanitizedKey
}

const entryPath = (key: string): string => {
  const safeKey = validateKey(key)
  return join(vaultDir(), `${safeKey}.bin`)
}

export function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

export function secureGet(key: string): string | null {
  const safeKey = validateKey(key)
  const path = entryPath(safeKey)
  if (!existsSync(path)) return null

  try {
    const buffer = readFileSync(path)

    // Validate buffer size
    if (buffer.length > 64_000) {
      console.warn(`[secure] Key ${safeKey} has unusually large value, discarding`)
      rmSync(path, { force: true })
      return null
    }

    const result = isEncryptionAvailable() ? safeStorage.decryptString(buffer) : buffer.toString('utf8')

    // Validate decrypted result
    if (typeof result !== 'string' || result.length > 64_000) {
      throw new Error('INVALID_VALUE: Decrypted value has invalid format or size')
    }

    return result
  } catch (error) {
    console.error(`[secure] Key ${safeKey} access failed:`, error)
    // Corrupt or written under a different OS user — drop it rather than loop.
    rmSync(path, { force: true })
    return null
  }
}

export function secureSet(key: string, value: string): void {
  const safeKey = validateKey(key)

  // Validate value
  if (typeof value !== 'string') {
    throw new Error('INVALID_VALUE: Value must be a string')
  }

  // Maximum value size to prevent resource exhaustion
  if (value.length > 64_000) {
    throw new Error('VALUE_TOO_LARGE: Value must not exceed 64KB')
  }

  // Basic content validation
  if (value.includes('\x00')) {
    throw new Error('INVALID_VALUE: Value contains null bytes')
  }

  const payload = isEncryptionAvailable()
    ? safeStorage.encryptString(value)
    : Buffer.from(value, 'utf8')

  // Use safe file path and strict permissions
  const path = entryPath(safeKey)

  // Add audit logging for sensitive operations
  console.log(`[secure] Setting key: ${safeKey}, size: ${value.length} bytes, encrypted: ${isEncryptionAvailable()}`)

  writeFileSync(path, payload, { mode: 0o600 })
}

export function secureDelete(key: string): void {
  const safeKey = validateKey(key)
  const path = entryPath(safeKey)

  console.log(`[secure] Deleting key: ${safeKey}`)
  rmSync(path, { force: true })
}
