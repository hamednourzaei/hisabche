// ============================================
// packages/local-engine/src/sync/per-user-partition.ts
//
// Per-User Local Database Isolation, Secret-Bound Key Derivation & AEAD Encryption
// Guarantees zero cross-user data leakage on shared devices (POS terminals).
// Derives encryption keys from an OS-protected device master secret + CSPRNG salt
// (never from public IDs alone), provides AES-256-GCM record sealing over LocalDb,
// and drives SQLCipher PRAGMA activation when native cipher support is compiled in.
// ============================================

import { hkdf } from '@noble/hashes/hkdf.js'
import { pbkdf2 } from '@noble/hashes/pbkdf2.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils.js'
import type { LocalDb } from '../db'

export class PartitionSecurityError extends Error {
  public readonly code = 'ERR_PARTITION_SECURITY'
  constructor(message: string) {
    super(message)
    this.name = 'PartitionSecurityError'
  }
}

export interface UserDatabaseConfig {
  readonly deviceId: string
  readonly userId: string
  readonly workspaceId: string
  readonly userRole: string
  readonly baseStoragePath: string
  /** High-entropy OS keychain / safeStorage / Keystore secret (>= 16 chars). */
  readonly deviceMasterSecret: string
  /** 32-byte random per-partition hex salt (generated via CSPRNG if omitted). */
  readonly partitionSaltHex?: string | undefined
}

export interface EncryptedEnvelope {
  readonly v: 1
  readonly alg: 'AES-256-GCM'
  readonly ivB64: string
  readonly ciphertextB64: string
  readonly aad: string
}

export interface PartitionCipherAdapter {
  readonly aadContext: string
  encrypt(plaintext: string): Promise<EncryptedEnvelope>
  decrypt(envelope: EncryptedEnvelope): Promise<string>
}

export interface UserPartitionInfo {
  readonly databaseFileName: string
  readonly fullPath: string
  readonly userHash: string
  readonly partitionSaltHex: string
  readonly encryptionKeyHex: string
  readonly sqlCipherKeyLiteral: string
  createCipher(): PartitionCipherAdapter
}

export interface SqlCipherPragmaTarget {
  pragma(statement: string): unknown
}

export interface SqlCipherActivationResult {
  readonly mode: 'sqlcipher' | 'application_envelope_aead'
  readonly cipherVersion: string | null
  readonly keyApplied: boolean
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function bytesToBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0
    const b2 = i + 2 < bytes.length ? bytes[i + 2]! : 0
    const n = (b0 << 16) | (b1 << 8) | b2
    out += BASE64_ALPHABET[(n >>> 18) & 63]!
    out += BASE64_ALPHABET[(n >>> 12) & 63]!
    out += i + 1 < bytes.length ? BASE64_ALPHABET[(n >>> 6) & 63]! : '='
    out += i + 2 < bytes.length ? BASE64_ALPHABET[n & 63]! : '='
  }
  return out
}

function base64ToBytes(b64: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64) || b64.length % 4 !== 0) {
    throw new PartitionSecurityError('Invalid base64 encoding in cipher envelope.')
  }
  const clean = b64.replace(/=+$/, '')
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let j = 0
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = BASE64_ALPHABET.indexOf(clean[i]!)
    const c1 = BASE64_ALPHABET.indexOf(clean[i + 1]!)
    const c2 = i + 2 < clean.length ? BASE64_ALPHABET.indexOf(clean[i + 2]!) : 0
    const c3 = i + 3 < clean.length ? BASE64_ALPHABET.indexOf(clean[i + 3]!) : 0
    const n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3
    if (j < out.length) out[j++] = (n >>> 16) & 255
    if (i + 2 < clean.length && j < out.length) out[j++] = (n >>> 8) & 255
    if (i + 3 < clean.length && j < out.length) out[j++] = n & 255
  }
  return out
}

interface SubtleAesGcm {
  importKey(
    format: 'raw',
    keyData: ArrayBuffer,
    algorithm: { name: string; length: number },
    extractable: boolean,
    keyUsages: readonly ('encrypt' | 'decrypt')[],
  ): Promise<unknown>
  encrypt(
    algorithm: { name: string; iv: ArrayBuffer; additionalData: ArrayBuffer; tagLength: number },
    key: unknown,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer>
  decrypt(
    algorithm: { name: string; iv: ArrayBuffer; additionalData: ArrayBuffer; tagLength: number },
    key: unknown,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer>
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

function assertHighEntropySecret(config: UserDatabaseConfig): void {
  const secret = config.deviceMasterSecret
  if (typeof secret !== 'string' || secret.trim().length < 16) {
    throw new PartitionSecurityError(
      'deviceMasterSecret (>= 16 chars from OS keystore/safeStorage) is required for partition key derivation.',
    )
  }
  const trimmed = secret.trim()
  if (trimmed === config.userId || trimmed === config.deviceId || trimmed === config.workspaceId) {
    throw new PartitionSecurityError(
      'deviceMasterSecret must not match public identifiers (userId, deviceId, or workspaceId).',
    )
  }
}

function createWebCryptoPartitionCipher(
  rawKeyBytes: Uint8Array,
  aadContext: string,
): PartitionCipherAdapter {
  const subtle = (globalThis as { crypto?: { subtle?: SubtleAesGcm } }).crypto?.subtle
  if (!subtle) {
    throw new PartitionSecurityError(
      'WebCrypto SubtleCrypto (AES-256-GCM) is unavailable in this runtime.',
    )
  }

  let cryptoKeyPromise: Promise<unknown> | null = null
  const getKey = () => {
    if (!cryptoKeyPromise) {
      cryptoKeyPromise = subtle.importKey(
        'raw',
        toArrayBuffer(rawKeyBytes),
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      )
    }
    return cryptoKeyPromise
  }

  const aadBytes = utf8ToBytes(aadContext)

  return {
    aadContext,
    async encrypt(plaintext: string): Promise<EncryptedEnvelope> {
      const key = await getKey()
      const iv = randomBytes(12)
      const cipherBuf = await subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: toArrayBuffer(iv),
          additionalData: toArrayBuffer(aadBytes),
          tagLength: 128,
        },
        key,
        toArrayBuffer(utf8ToBytes(plaintext)),
      )
      return {
        v: 1,
        alg: 'AES-256-GCM',
        ivB64: bytesToBase64(iv),
        ciphertextB64: bytesToBase64(new Uint8Array(cipherBuf)),
        aad: aadContext,
      }
    },

    async decrypt(envelope: EncryptedEnvelope): Promise<string> {
      if (envelope.v !== 1 || envelope.alg !== 'AES-256-GCM') {
        throw new PartitionSecurityError(`Unsupported cipher envelope version/alg: ${envelope.alg}`)
      }
      if (envelope.aad !== aadContext) {
        throw new PartitionSecurityError(
          `Cross-Partition Decryption Refused: envelope AAD '${envelope.aad}' does not match '${aadContext}'.`,
        )
      }
      const key = await getKey()
      try {
        const iv = base64ToBytes(envelope.ivB64)
        const ct = base64ToBytes(envelope.ciphertextB64)
        const plainBuf = await subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: toArrayBuffer(iv),
            additionalData: toArrayBuffer(aadBytes),
            tagLength: 128,
          },
          key,
          toArrayBuffer(ct),
        )
        return new TextDecoder().decode(plainBuf)
      } catch {
        throw new PartitionSecurityError(
          'AES-256-GCM authentication tag verification failed (wrong key or tampered ciphertext).',
        )
      }
    },
  }
}

/**
 * Persists encrypted partition records inside SQLite (`LocalDb`) so sensitive
 * local state on disk is stored strictly as authenticated AES-256-GCM envelopes.
 */
export class EncryptedPartitionStore {
  constructor(
    private readonly db: LocalDb,
    private readonly partition: UserPartitionInfo,
  ) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS encrypted_partition_records (
        record_key TEXT PRIMARY KEY,
        envelope_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)
  }

  async put(recordKey: string, value: unknown): Promise<void> {
    const cipher = this.partition.createCipher()
    const envelope = await cipher.encrypt(JSON.stringify(value))
    this.db.run(
      `INSERT INTO encrypted_partition_records (record_key, envelope_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(record_key) DO UPDATE SET
         envelope_json = excluded.envelope_json,
         updated_at = excluded.updated_at`,
      [recordKey, JSON.stringify(envelope), new Date().toISOString()],
    )
  }

  async get<T = unknown>(recordKey: string): Promise<T | null> {
    const row = this.db.get<{ envelope_json: string }>(
      `SELECT envelope_json FROM encrypted_partition_records WHERE record_key = ?`,
      [recordKey],
    )
    if (!row) return null
    const envelope = JSON.parse(row.envelope_json) as EncryptedEnvelope
    const cipher = this.partition.createCipher()
    const json = await cipher.decrypt(envelope)
    return JSON.parse(json) as T
  }
}

export class PerUserPartitionManager {
  /** Generates a 32-byte cryptographically random secret suitable for OS keystore storage. */
  public static generateDeviceMasterSecret(): string {
    return bytesToHex(randomBytes(32))
  }

  /** Generates a 32-byte cryptographically random salt for a new user SQLite partition. */
  public static generatePartitionSaltHex(): string {
    return bytesToHex(randomBytes(32))
  }

  /**
   * Resolves an isolated database filename, secret-bound 256-bit encryption key
   * (PBKDF2-SHA256 + HKDF-SHA256 over OS device master secret and random salt),
   * SQLCipher key literal, and AES-256-GCM cipher factory.
   */
  public static resolvePartition(config: UserDatabaseConfig): UserPartitionInfo {
    assertHighEntropySecret(config)

    const saltHex = config.partitionSaltHex ?? this.generatePartitionSaltHex()
    if (!/^[0-9a-f]{32,}$/i.test(saltHex)) {
      throw new PartitionSecurityError('partitionSaltHex must be at least 16 random hex bytes.')
    }
    const saltBytes = hexToBytes(saltHex)

    const userHash = bytesToHex(
      sha256(utf8ToBytes(`${config.deviceId}:${config.workspaceId}:${config.userId}`)),
    ).slice(0, 16)

    const databaseFileName = `hisabche_user_${userHash}.sqlite`
    const normalizedBasePath = config.baseStoragePath.replace(/\\/g, '/').replace(/\/$/, '')
    const fullPath = `${normalizedBasePath}/${databaseFileName}`

    const aadContext = `${config.deviceId}:${config.workspaceId}:${config.userId}`
    const ikm = pbkdf2(sha256, utf8ToBytes(config.deviceMasterSecret), saltBytes, {
      c: 100_000,
      dkLen: 32,
    })
    const derivedKey = hkdf(
      sha256,
      ikm,
      saltBytes,
      utf8ToBytes(`hisabche-partition:${aadContext}`),
      32,
    )
    const encryptionKeyHex = bytesToHex(derivedKey)

    return {
      databaseFileName,
      fullPath,
      userHash,
      partitionSaltHex: saltHex,
      encryptionKeyHex,
      sqlCipherKeyLiteral: `"x'${encryptionKeyHex}'"`,
      createCipher: () => createWebCryptoPartitionCipher(derivedKey, aadContext),
    }
  }

  /**
   * Attempts native SQLCipher keying on an opened SQLite database connection and
   * accurately reports whether page-level cipher encryption is active or whether
   * the runtime falls back to application-level AES-256-GCM envelopes.
   */
  public static configureSqliteCipher(
    database: SqlCipherPragmaTarget,
    partition: UserPartitionInfo,
    options?: { requireNativeSqlCipher?: boolean | undefined },
  ): SqlCipherActivationResult {
    if (!/^[0-9a-f]{64}$/i.test(partition.encryptionKeyHex)) {
      throw new PartitionSecurityError('Invalid 256-bit hex encryption key.')
    }

    let cipherVersion: string | null = null
    try {
      const versionResult = database.pragma('cipher_version') as
        Array<{ cipher_version?: string }> | string | undefined
      if (typeof versionResult === 'string' && versionResult.trim()) {
        cipherVersion = versionResult.trim()
      } else if (Array.isArray(versionResult) && versionResult[0]?.cipher_version) {
        cipherVersion = String(versionResult[0].cipher_version)
      }
    } catch {
      cipherVersion = null
    }

    if (cipherVersion) {
      database.pragma(`key = ${partition.sqlCipherKeyLiteral}`)
      database.pragma('cipher_page_size = 4096')
      database.pragma('kdf_iter = 256000')
      return {
        mode: 'sqlcipher',
        cipherVersion,
        keyApplied: true,
      }
    }

    if (options?.requireNativeSqlCipher) {
      throw new PartitionSecurityError(
        'Native SQLCipher driver is unavailable on this runtime; refusing unencrypted SQLite storage.',
      )
    }

    return {
      mode: 'application_envelope_aead',
      cipherVersion: null,
      keyApplied: false,
    }
  }

  /**
   * Asserts that data belonging to User A cannot be accessed under User B's active partition.
   */
  public static assertPartitionIntegrity(activeUserId: string, targetUserId: string): void {
    if (activeUserId !== targetUserId) {
      throw new Error(
        `Cross-User Security Violation: User '${activeUserId}' attempted to access local partition belonging to '${targetUserId}'.`,
      )
    }
  }
}
