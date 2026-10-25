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
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
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

// ---------------------------------------------------------------------------
// ⚠️ A SIGN-IN MUST SURVIVE AN UPDATE OR A REINSTALL (owner, 24 Oct 2026).
//
// What lives here is the session, the licence, the licence key and the edition.
// Losing ANY of them signs the person out — and for the offline edition a lost
// licence key is worse than a sign-out: the licence cannot be re-checked without
// the internet, so the device falls back to the cloud sign-in.
//
// The old store could lose them three ways, all of them around an update:
//
//   1. A read that failed ANYWHERE deleted the file. «Corrupt or written under a
//      different OS user» was the guess; the same failure happens when the OS key
//      service is not ready yet in the first moments after the installer starts
//      the app. One slow start and the session was gone for good.
//   2. Whether an entry was encrypted was decided by whether encryption happened
//      to be available AT READ TIME, not at write time. An entry written plain
//      while the key service was down was later fed to the decryptor, failed, and
//      — see 1 — was deleted.
//   3. A write was truncate-then-write. An app closed by the installer in the
//      middle of one left a half file, which then failed 1.
//
// So: each entry says how it was written (first byte), a write is atomic and
// keeps the previous good value beside it, and a read that cannot be completed
// returns «nothing» WITHOUT touching the file.
// ---------------------------------------------------------------------------

/** First byte of a file: the payload is encrypted by safeStorage (OS user key). */
const ENCRYPTED = 0x01
/** First byte of a file: the payload is plain UTF-8 (the key service was unavailable). */
const PLAIN = 0x02

const backupPath = (path: string): string => `${path}.bak`

function decode(buffer: Buffer): string | null {
  if (buffer.length > 64_000) return null

  const marker = buffer[0]
  if (marker === ENCRYPTED) {
    // Written encrypted. If the key service is not answering right now this is
    // «not yet», never «gone» — the caller gets null and the file stays.
    if (!isEncryptionAvailable()) return null
    return safeStorage.decryptString(buffer.subarray(1))
  }
  if (marker === PLAIN) return buffer.subarray(1).toString('utf8')

  // An entry from before the marker existed: encrypted if the OS can open it,
  // otherwise it was written plain.
  if (isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(buffer)
    } catch {
      /* fall through: it may have been written plain */
    }
  }
  const text = buffer.toString('utf8')
  return text.includes('\u0000') ? null : text
}

function readEntry(path: string): string | null {
  if (!existsSync(path)) return null
  try {
    const value = decode(readFileSync(path))
    return typeof value === 'string' && value.length <= 64_000 ? value : null
  } catch (error) {
    console.warn(`[secure] ${path} could not be read now; leaving it in place:`, error)
    return null
  }
}

export function secureGet(key: string): string | null {
  const safeKey = validateKey(key)
  const path = entryPath(safeKey)
  // The previous good value covers a main file that an update cut short.
  return readEntry(path) ?? readEntry(backupPath(path))
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

  const encrypted = isEncryptionAvailable()
  const payload = Buffer.concat([
    Buffer.from([encrypted ? ENCRYPTED : PLAIN]),
    encrypted ? safeStorage.encryptString(value) : Buffer.from(value, 'utf8'),
  ])

  // Use safe file path and strict permissions
  const path = entryPath(safeKey)

  // Add audit logging for sensitive operations
  console.log(
    `[secure] Setting key: ${safeKey}, size: ${value.length} bytes, encrypted: ${encrypted}`,
  )

  // Atomic: the new value is written beside the old one and renamed over it, and
  // the old one is kept as the backup. A write cut short leaves the previous
  // value readable instead of a half file.
  const pending = `${path}.tmp`
  writeFileSync(pending, payload, { mode: 0o600 })
  if (existsSync(path)) copyFileSync(path, backupPath(path))
  renameSync(pending, path)
}

export function secureDelete(key: string): void {
  const safeKey = validateKey(key)
  const path = entryPath(safeKey)

  console.log(`[secure] Deleting key: ${safeKey}`)
  // A deliberate delete (sign-out) removes the backup too — otherwise a signed-out
  // session would come back from it.
  rmSync(path, { force: true })
  rmSync(backupPath(path), { force: true })
  rmSync(`${path}.tmp`, { force: true })
}
