/** @jest-environment node */
// ============================================
// Desktop SQLite Encryption, Fail-Closed Guards & Migration Tests
// ============================================

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { DatabaseSync } from 'node:sqlite'
import { PerUserPartitionManager, EncryptedPartitionStore } from '@hisabche/local-engine'

const secureMemoryStore = new Map<string, string>()
let mockSafeStorageAvailable = true

jest.mock('electron', () => ({
  app: { getPath: () => tmpdir(), isPackaged: false },
  safeStorage: {
    isEncryptionAvailable: () => mockSafeStorageAvailable,
    encryptString: (v: string) => Buffer.from(v, 'utf8'),
    decryptString: (b: Buffer) => b.toString('utf8'),
  },
}))

jest.mock('../../services/secure-store', () => ({
  isEncryptionAvailable: () => mockSafeStorageAvailable,
  secureGet: (k: string) => secureMemoryStore.get(k) ?? null,
  secureSet: (k: string, v: string) => {
    secureMemoryStore.set(k, v)
  },
  secureDelete: (k: string) => {
    secureMemoryStore.delete(k)
  },
}))

import { TestDriver } from './test-driver'
import {
  cacheFailure,
  closeDatabase,
  detectDatabaseEncryptionStatus,
  getDatabaseEncryptionStatus,
  getLocalDb,
  initDatabaseWith,
  isReady,
  migrateLegacyPlaintextDatabaseWith,
  openUserPartitionWith,
  recoverInterruptedMigration,
  rotateDatabasePartitionKey,
} from '../database'

/**
 * Simulated SQLCipher-capable driver layered over real node:sqlite to prove
 * PRAGMA cipher_version detection, PRAGMA key invocation, wrong-key rejection,
 * and correct-key reopening through the normal initDatabaseWith / openUserPartitionWith entry points.
 */
const keyRegistry = new Map<string, string>()

class SqlCipherSimDriver extends TestDriver {
  private readonly filePath: string
  private appliedKey: string | null = null

  constructor(path: string) {
    super(path)
    this.filePath = path
  }

  override pragma(sql: string): unknown {
    const trimmed = sql.trim()
    if (trimmed === 'cipher_version') {
      return [{ cipher_version: '4.5.6 community' }]
    }
    if (trimmed.startsWith('key =')) {
      const keyLiteral = trimmed.slice('key ='.length).trim()
      const expected = keyRegistry.get(this.filePath)
      if (expected && expected !== keyLiteral) {
        throw new Error('SQLITE_NOTADB: file is not a database (wrong SQLCipher key)')
      }
      if (!expected && this.filePath !== ':memory:') {
        keyRegistry.set(this.filePath, keyLiteral)
      }
      this.appliedKey = keyLiteral
      return []
    }
    return super.pragma(sql)
  }

  getAppliedKey(): string | null {
    return this.appliedKey
  }
}

describe('Desktop SQLite Encryption & Migration Pipeline', () => {
  let dir: string

  beforeEach(() => {
    closeDatabase()
    secureMemoryStore.clear()
    keyRegistry.clear()
    mockSafeStorageAvailable = true
    dir = mkdtempSync(join(tmpdir(), 'hisabche-enc-'))
  })

  afterEach(() => {
    closeDatabase()
    rmSync(dir, { recursive: true, force: true })
  })

  it('activates SQLCipher on normal initDatabaseWith path when driver supports cipher_version and rejects wrong keys', () => {
    const dbPath = join(dir, 'hisabche.db')
    const masterSecret = PerUserPartitionManager.generateDeviceMasterSecret()
    const saltHex = PerUserPartitionManager.generatePartitionSaltHex()

    const opened = initDatabaseWith(SqlCipherSimDriver as never, dbPath, {
      deviceMasterSecret: masterSecret,
      partitionSaltHex: saltHex,
      requireNativeSqlCipher: true,
    })
    expect(opened).toBe(true)
    expect(isReady()).toBe(true)

    const status = getDatabaseEncryptionStatus()
    expect(status.initialized).toBe(true)
    expect(status.mode).toBe('sqlcipher')
    expect(status.nativeSqlCipherSupported).toBe(true)
    expect(status.cipherVersion).toBe('4.5.6 community')
    expect(status.keyApplied).toBe(true)

    closeDatabase()

    // Reopening with wrong key fails closed
    const wrongMaster = PerUserPartitionManager.generateDeviceMasterSecret()
    const reopenedWrong = initDatabaseWith(SqlCipherSimDriver as never, dbPath, {
      deviceMasterSecret: wrongMaster,
      partitionSaltHex: saltHex,
      requireNativeSqlCipher: true,
    })
    expect(reopenedWrong).toBe(false)
    expect(isReady()).toBe(false)
    expect(cacheFailure()).toContain('wrong SQLCipher key')

    // Reopening with the correct key succeeds
    const reopenedRight = initDatabaseWith(SqlCipherSimDriver as never, dbPath, {
      deviceMasterSecret: masterSecret,
      partitionSaltHex: saltHex,
      requireNativeSqlCipher: true,
    })
    expect(reopenedRight).toBe(true)
    expect(isReady()).toBe(true)
  })

  it('fails closed when requireNativeSqlCipher is true on a non-SQLCipher driver (never downgrades silently)', () => {
    const dbPath = join(dir, 'plain.db')
    const masterSecret = PerUserPartitionManager.generateDeviceMasterSecret()
    const saltHex = PerUserPartitionManager.generatePartitionSaltHex()

    const opened = initDatabaseWith(TestDriver as never, dbPath, {
      deviceMasterSecret: masterSecret,
      partitionSaltHex: saltHex,
      requireNativeSqlCipher: true,
    })
    expect(opened).toBe(false)
    expect(isReady()).toBe(false)
    const status = getDatabaseEncryptionStatus()
    expect(status.initialized).toBe(false)
    expect(status.mode).toBe('uninitialized')
    expect(status.lastFailure).toContain('Native SQLCipher driver is unavailable')
    // Secret must never appear in error messages
    expect(status.lastFailure).not.toContain(masterSecret)
  })

  it('fails closed when OS keystore is unavailable and requireOsKeystore is set', () => {
    mockSafeStorageAvailable = false
    const dbPath = join(dir, 'keystore-missing.db')
    const opened = initDatabaseWith(TestDriver as never, dbPath, {
      requireOsKeystore: true,
    })
    expect(opened).toBe(false)
    expect(isReady()).toBe(false)
    expect(cacheFailure()).toContain('OS secure keystore')
  })

  it('detects legacy plaintext SQLite files, preserves backup, and verifies row counts + financial totals during migration', () => {
    const legacyPath = join(dir, 'legacy.db')
    const targetPath = join(dir, 'migrated.db')

    // Create a genuine legacy plaintext SQLite with invoices & payments
    const raw = new DatabaseSync(legacyPath)
    raw.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE invoice (
        id TEXT PRIMARY KEY, invoice_number TEXT, type TEXT DEFAULT 'sale',
        customer_id TEXT, customer_name TEXT, date TEXT NOT NULL,
        subtotal REAL DEFAULT 0, discount_total REAL DEFAULT 0, tax_total REAL DEFAULT 0,
        total REAL DEFAULT 0, paid_amount REAL DEFAULT 0, payment_method TEXT,
        currency TEXT DEFAULT 'AFN', status TEXT DEFAULT 'pending', notes TEXT,
        updated_at TEXT NOT NULL, dirty INTEGER DEFAULT 0, version INTEGER DEFAULT 1
      );
      INSERT INTO meta (key, value) VALUES ('schema_version', '23');
      INSERT INTO invoice (id, invoice_number, date, total, paid_amount, updated_at)
        VALUES ('inv-1', 'INV-001', '2026-11-01', 1500, 500, '2026-11-01T00:00:00Z'),
               ('inv-2', 'INV-002', '2026-11-02', 2500, 2500, '2026-11-02T00:00:00Z');
    `)
    raw.close()

    const detected = detectDatabaseEncryptionStatus(legacyPath)
    expect(detected.exists).toBe(true)
    expect(detected.isPlaintextSqlite).toBe(true)

    const masterSecret = PerUserPartitionManager.generateDeviceMasterSecret()
    const saltHex = PerUserPartitionManager.generatePartitionSaltHex()

    const result = migrateLegacyPlaintextDatabaseWith(
      SqlCipherSimDriver as never,
      legacyPath,
      targetPath,
      {
        deviceMasterSecret: masterSecret,
        partitionSaltHex: saltHex,
        requireNativeSqlCipher: true,
      },
    )

    expect(result.migrated).toBe(true)
    expect(result.sourcePlaintextDetected).toBe(true)
    expect(existsSync(result.backupPath)).toBe(true)
    expect(result.rowCounts.invoice).toBe(2)
    expect(result.financialChecksums.invoiceTotalSum).toBe(4000)
    expect(result.financialChecksums.invoicePaidSum).toBe(3000)
    expect(result.encryption.mode).toBe('sqlcipher')
    expect(existsSync(targetPath)).toBe(true)
  })

  it('recovers cleanly from an interrupted migration without touching or deleting the original plaintext database', () => {
    const legacyPath = join(dir, 'legacy-crash.db')
    const targetPath = join(dir, 'target-crash.db')

    const raw = new DatabaseSync(legacyPath)
    raw.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE invoice (id TEXT PRIMARY KEY, date TEXT NOT NULL, total REAL DEFAULT 0, paid_amount REAL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'AFN', updated_at TEXT NOT NULL);
      INSERT INTO invoice (id, date, total, paid_amount, currency, updated_at) VALUES ('inv-9', '2026-11-01', 900, 900, 'AFN', '2026-11-01');
    `)
    raw.close()

    const masterSecret = PerUserPartitionManager.generateDeviceMasterSecret()
    const saltHex = PerUserPartitionManager.generatePartitionSaltHex()

    expect(() =>
      migrateLegacyPlaintextDatabaseWith(SqlCipherSimDriver as never, legacyPath, targetPath, {
        deviceMasterSecret: masterSecret,
        partitionSaltHex: saltHex,
        requireNativeSqlCipher: true,
        simulateCrashAfterCopy: true,
      }),
    ).toThrow('SIMULATED_MIGRATION_INTERRUPTION')

    // Original database preserved and target not promoted
    expect(existsSync(legacyPath)).toBe(true)
    expect(existsSync(targetPath)).toBe(false)
    expect(existsSync(`${legacyPath}.pre-migration.bak`)).toBe(true)

    // Leave orphan staging file to prove recovery cleans it up
    writeFileSync(`${targetPath}.migrating`, 'partial')
    const recovery = recoverInterruptedMigration(targetPath)
    expect(recovery.interrupted).toBe(true)
    expect(recovery.state).toBe('failed')
    expect(recovery.stagingCleaned).toBe(true)
    expect(existsSync(`${targetPath}.migrating`)).toBe(false)
  })

  it('rotates partition key material cleanly and re-seals AEAD partition records', async () => {
    const master1 = PerUserPartitionManager.generateDeviceMasterSecret()
    const salt1 = PerUserPartitionManager.generatePartitionSaltHex()

    const res1 = openUserPartitionWith(SqlCipherSimDriver as never, {
      deviceId: 'pos-01',
      userId: 'user-1',
      workspaceId: 'ws-1',
      userRole: 'owner',
      baseStoragePath: dir,
      deviceMasterSecret: master1,
      partitionSaltHex: salt1,
      requireNativeSqlCipher: true,
    })
    expect(res1.opened).toBe(true)
    expect(res1.encryption.mode).toBe('sqlcipher')

    const store1 = new EncryptedPartitionStore(getLocalDb(), res1.partition)
    await store1.put('vault-secret', { token: 'refresh-abc-123' })
    const readBack = await store1.get<{ token: string }>('vault-secret')
    expect(readBack?.token).toBe('refresh-abc-123')

    // Rotate master secret + salt and verify secure store updates without leaking full secret
    const rot = rotateDatabasePartitionKey()
    expect(rot.rotated).toBe(true)
    expect(secureMemoryStore.get('hisabche.partition.master')).toBeDefined()
    expect(secureMemoryStore.get('hisabche.partition.salt')).toBeDefined()
    expect(readFileSync(res1.partition.fullPath).toString('utf8')).not.toContain('refresh-abc-123')
  })
})
