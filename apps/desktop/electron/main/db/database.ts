// ============================================
// SQLite access layer.
//
// better-sqlite3 is a native module: if the binding fails to load (version
// mismatch, missing toolchain) the app must still run online-only rather than
// crash on boot. `isReady()` reports which mode we are in.
// ============================================

import { app } from 'electron'
import {
  copyFileSync,
  existsSync,
  openSync,
  readSync,
  closeSync,
  renameSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from 'node:fs'
import { join } from 'node:path'

import { reportError } from '../services/monitoring'

import {
  CREATE_STATEMENTS,
  SCHEMA_VERSION,
  isAlreadyApplied,
  migrationsFrom,
  buildCount,
  buildEnqueue,
  buildSelect,
  WRITABLE_COLUMNS,
  type LocalQueryInput,
  type LocalTable,
  type QueueEntry,
} from '@hisabche/app-bridge'
import {
  PartitionSecurityError,
  PerUserPartitionManager,
  type LocalDb,
  type RunResult,
  type SqlCipherActivationResult,
  type SqlCipherPragmaTarget,
  type UserDatabaseConfig,
  type UserPartitionInfo,
} from '@hisabche/local-engine'
import { isEncryptionAvailable, secureGet, secureSet } from '../services/secure-store'

type SqliteDatabase = {
  prepare(sql: string): {
    all(...params: unknown[]): unknown[]
    get(...params: unknown[]): unknown
    run(...params: unknown[]): { changes: number; lastInsertRowid?: number | bigint | undefined }
  }
  exec(sql: string): void
  pragma(sql: string): unknown
  transaction<T extends (...args: never[]) => unknown>(fn: T): T
  close(): void
}

let db: SqliteDatabase | null = null

/**
 * Why the cache is unavailable, when it is.
 *
 * ⚠️ «No cache» and «no data» must never render the same (راهنمای سشن §۷٫۳),
 * and neither must «no cache» and «working offline fine». The renderer reads
 * this through .
 */
let lastFailure: string | null = null

/** Quote an identifier we have already validated against an allow-list. */
const ident = (name: string): string => `"${name.replace(/"/g, '')}"`

/**
 * Open a database with a caller-supplied driver.
 *
 * ⚠️ TEST SEAM — production always uses `initDatabase()`, which passes
 * better-sqlite3. This exists because better-sqlite3 is a NATIVE module built
 * against Electron's Node ABI (NODE_MODULE_VERSION 125), while jest runs on the
 * system Node (127), so requiring it under test throws. The alternative was a
 * suite whose every test silently early-returned and asserted nothing while
 * reporting green — a worse outcome than no test at all.
 *
 * The seam is a constructor, not a mock: tests pass Node's built-in
 * `node:sqlite`, so the SQL, the transaction and the DELETEs below are really
 * executed against a real SQLite. Only the binding differs.
 */

/**
 * Bring an existing cache up to the current schema.
 *
 * ⚠️ RUNS BEFORE THE VERSION IS STAMPED. The stamp is written after this
 * returns, so a migration that throws leaves the old number in place and is
 * retried on the next launch rather than being skipped forever.
 */
function runMigrations(database: SqliteDatabase): void {
  const row = database.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    { value?: string } | undefined
  // A cache with no stamp is either brand new (CREATE just ran, so it is
  // already current) or predates stamping. Treating it as v1 is safe: every
  // migration is written to be harmless when already applied.
  const from = Number(row?.value ?? 1) || 1

  for (const migration of migrationsFrom(from)) {
    for (const statement of migration.statements) {
      try {
        database.exec(statement)
      } catch (error) {
        if (isAlreadyApplied(error)) continue
        throw error
      }
    }
  }
}

const SQLITE_PLAINTEXT_MAGIC = 'SQLite format 3\0'

export type DatabaseEncryptionMode = 'sqlcipher' | 'application_envelope_aead' | 'uninitialized'

export interface DatabaseEncryptionStatus {
  readonly initialized: boolean
  readonly mode: DatabaseEncryptionMode
  readonly nativeSqlCipherSupported: boolean
  readonly cipherVersion: string | null
  readonly keyApplied: boolean
  readonly osKeystoreAvailable: boolean
  readonly legacyPlaintextDetected: boolean
  readonly migrationState: 'none' | 'in_progress' | 'completed' | 'failed'
  readonly lastFailure: string | null
}

export interface InitDatabaseOptions {
  readonly deviceMasterSecret?: string | undefined
  readonly partitionSaltHex?: string | undefined
  readonly requireNativeSqlCipher?: boolean | undefined
  readonly requireOsKeystore?: boolean | undefined
}

let encryptionStatus: DatabaseEncryptionStatus = {
  initialized: false,
  mode: 'uninitialized',
  nativeSqlCipherSupported: false,
  cipherVersion: null,
  keyApplied: false,
  osKeystoreAvailable: false,
  legacyPlaintextDetected: false,
  migrationState: 'none',
  lastFailure: null,
}

export function getDatabaseEncryptionStatus(): DatabaseEncryptionStatus {
  return { ...encryptionStatus }
}

/**
 * Inspects the first 16 bytes of a SQLite database file without opening it.
 * Standard unencrypted SQLite files always start with `SQLite format 3\0`.
 */
export function detectDatabaseEncryptionStatus(dbPath: string): {
  exists: boolean
  isPlaintextSqlite: boolean
  byteLength: number
} {
  if (!dbPath || dbPath === ':memory:' || !existsSync(dbPath)) {
    return { exists: false, isPlaintextSqlite: false, byteLength: 0 }
  }
  const fd = openSync(dbPath, 'r')
  try {
    const header = Buffer.alloc(16)
    const bytesRead = readSync(fd, header, 0, 16, 0)
    if (bytesRead === 0) {
      return { exists: true, isPlaintextSqlite: false, byteLength: 0 }
    }
    const isPlaintext =
      bytesRead >= 16 && header.subarray(0, 16).toString('latin1') === SQLITE_PLAINTEXT_MAGIC
    return { exists: true, isPlaintextSqlite: isPlaintext, byteLength: bytesRead }
  } finally {
    closeSync(fd)
  }
}

export function getOrCreatePartitionMasterSecret(): string {
  const EXISTING_KEY = 'hisabche.partition.master'
  const existing = secureGet(EXISTING_KEY)
  if (existing && existing.length >= 32) {
    return existing
  }
  const generated = PerUserPartitionManager.generateDeviceMasterSecret()
  secureSet(EXISTING_KEY, generated)
  return generated
}

export function getOrCreatePartitionSaltHex(): string {
  const SALT_KEY = 'hisabche.partition.salt'
  const existing = secureGet(SALT_KEY)
  if (existing && /^[0-9a-f]{32,}$/i.test(existing)) {
    return existing
  }
  const generated = PerUserPartitionManager.generatePartitionSaltHex()
  secureSet(SALT_KEY, generated)
  return generated
}

function resolveDefaultPartitionInfo(options?: InitDatabaseOptions): {
  partition: UserPartitionInfo
  osKeystoreAvailable: boolean
} {
  const osKeystoreAvailable = isEncryptionAvailable()
  if (options?.requireOsKeystore && !osKeystoreAvailable) {
    throw new PartitionSecurityError(
      'OS secure keystore (safeStorage) is unavailable; refusing unauthenticated local key storage.',
    )
  }
  const deviceMasterSecret = options?.deviceMasterSecret ?? getOrCreatePartitionMasterSecret()
  const partitionSaltHex = options?.partitionSaltHex ?? getOrCreatePartitionSaltHex()
  const partition = PerUserPartitionManager.resolvePartition({
    deviceId: 'desktop-default',
    userId: 'desktop-owner',
    workspaceId: 'default-workspace',
    userRole: 'owner',
    baseStoragePath: '.',
    deviceMasterSecret,
    partitionSaltHex,
  })
  return { partition, osKeystoreAvailable }
}

function applyEncryptionOnCandidate(
  candidate: SqliteDatabase,
  dbPath: string,
  options?: InitDatabaseOptions,
): {
  encryption: SqlCipherActivationResult
  osKeystoreAvailable: boolean
  legacyPlaintextDetected: boolean
} {
  const detection = detectDatabaseEncryptionStatus(dbPath)
  const { partition, osKeystoreAvailable } = resolveDefaultPartitionInfo(options)
  const requireNativeSqlCipher =
    options?.requireNativeSqlCipher ?? process.env.HISABCHE_REQUIRE_SQLCIPHER === '1'
  const encryption = PerUserPartitionManager.configureSqliteCipher(
    candidate as SqlCipherPragmaTarget,
    partition,
    { requireNativeSqlCipher },
  )
  return {
    encryption,
    osKeystoreAvailable,
    legacyPlaintextDetected: detection.isPlaintextSqlite,
  }
}

export interface LegacyMigrationResult {
  readonly migrated: boolean
  readonly sourcePlaintextDetected: boolean
  readonly backupPath: string
  readonly tablesCopied: readonly string[]
  readonly rowCounts: Readonly<Record<string, number>>
  readonly financialChecksums: {
    readonly invoiceTotalSum: number
    readonly invoicePaidSum: number
    readonly paymentAmountSum: number
    readonly productStockQtySum: number
  }
  readonly encryption: SqlCipherActivationResult
}

function readFinancialChecksums(database: SqliteDatabase): {
  invoiceTotalSum: number
  invoicePaidSum: number
  paymentAmountSum: number
  productStockQtySum: number
} {
  const tableSet = new Set(
    (
      database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{
        name: string
      }>
    ).map((r) => r.name),
  )
  const sumQuery = (table: string, col: string): number => {
    if (!tableSet.has(table)) return 0
    const cols = new Set(
      (database.prepare(`PRAGMA table_info(${ident(table)})`).all() as Array<{ name: string }>).map(
        (c) => c.name,
      ),
    )
    if (!cols.has(col)) return 0
    const row = database
      .prepare(`SELECT COALESCE(SUM("${col}"), 0) AS s FROM ${ident(table)}`)
      .get() as { s?: number } | undefined
    return Number(row?.s ?? 0)
  }
  return {
    invoiceTotalSum: sumQuery('invoice', 'total'),
    invoicePaidSum: sumQuery('invoice', 'paid_amount'),
    paymentAmountSum: sumQuery('payment', 'amount'),
    productStockQtySum: sumQuery('product', 'quantity'),
  }
}

/**
 * Migrates an existing plaintext SQLite database at `sourcePath` into a new
 * SQLCipher/partition-configured database at `targetPath` with pre-migration
 * backup preservation, checkpointing for crash recovery, row count + financial
 * sum verification, and PRAGMA integrity checks before atomic promotion.
 */
export function migrateLegacyPlaintextDatabaseWith(
  Driver: new (path: string) => SqliteDatabase,
  sourcePath: string,
  targetPath: string,
  options?: InitDatabaseOptions & {
    readonly simulateCrashAfterCopy?: boolean | undefined
  },
): LegacyMigrationResult {
  const detection = detectDatabaseEncryptionStatus(sourcePath)
  if (!detection.exists) {
    throw new PartitionSecurityError(`Source database does not exist at ${sourcePath}`)
  }

  const backupPath = `${sourcePath}.pre-migration.bak`
  const statePath = `${targetPath}.migration-state.json`
  const stagingPath = `${targetPath}.migrating`

  copyFileSync(sourcePath, backupPath)
  writeFileSync(
    statePath,
    JSON.stringify({ state: 'in_progress', startedAt: new Date().toISOString() }),
    'utf8',
  )

  rmSync(stagingPath, { force: true })

  const src = new Driver(sourcePath)
  let dst: SqliteDatabase | null = null
  try {
    const srcChecksums = readFinancialChecksums(src)
    const srcTables = (
      src
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC",
        )
        .all() as Array<{ name: string }>
    ).map((r) => r.name)

    const { partition } = resolveDefaultPartitionInfo(options)
    dst = new Driver(stagingPath)
    const encryption = PerUserPartitionManager.configureSqliteCipher(
      dst as SqlCipherPragmaTarget,
      partition,
      { requireNativeSqlCipher: options?.requireNativeSqlCipher },
    )
    dst.pragma('journal_mode = WAL')
    dst.pragma('foreign_keys = ON')
    CREATE_STATEMENTS.forEach((statement) => dst!.exec(statement))
    runMigrations(dst)

    const dstTableSet = new Set(
      (
        dst.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{
          name: string
        }>
      ).map((r) => r.name),
    )

    const rowCounts: Record<string, number> = {}
    const tablesCopied: string[] = []

    const copyAll = dst.transaction(() => {
      for (const table of srcTables) {
        if (!dstTableSet.has(table)) continue
        const srcCols = (
          src.prepare(`PRAGMA table_info(${ident(table)})`).all() as Array<{ name: string }>
        ).map((c) => c.name)
        const dstCols = new Set(
          (dst!.prepare(`PRAGMA table_info(${ident(table)})`).all() as Array<{ name: string }>).map(
            (c) => c.name,
          ),
        )
        const commonCols = srcCols.filter((c) => dstCols.has(c))
        if (commonCols.length === 0) continue

        const rows = src.prepare(`SELECT * FROM ${ident(table)}`).all() as Array<
          Record<string, unknown>
        >
        const colList = commonCols.map(ident).join(', ')
        const placeholders = commonCols.map(() => '?').join(', ')
        const insertStmt = dst!.prepare(
          `INSERT OR REPLACE INTO ${ident(table)} (${colList}) VALUES (${placeholders})`,
        )
        for (const row of rows) {
          insertStmt.run(...commonCols.map((c) => row[c] ?? null))
        }
        rowCounts[table] = rows.length
        tablesCopied.push(table)
      }
    })
    copyAll()

    if (options?.simulateCrashAfterCopy) {
      throw new Error('SIMULATED_MIGRATION_INTERRUPTION')
    }

    // Verify record counts and critical financial totals match source before atomic switch
    for (const table of tablesCopied) {
      const dstCountRow = dst.prepare(`SELECT COUNT(*) AS n FROM ${ident(table)}`).get() as {
        n: number
      }
      const actualCount = Number(dstCountRow.n)
      const expectedCount = rowCounts[table] ?? 0
      const countValid =
        table === 'meta' ? actualCount >= expectedCount : actualCount === expectedCount
      if (!countValid) {
        throw new PartitionSecurityError(
          `Migration count mismatch for ${table}: expected ${expectedCount}, got ${actualCount}`,
        )
      }
    }

    const dstChecksums = readFinancialChecksums(dst)
    if (
      dstChecksums.invoiceTotalSum !== srcChecksums.invoiceTotalSum ||
      dstChecksums.invoicePaidSum !== srcChecksums.invoicePaidSum ||
      dstChecksums.paymentAmountSum !== srcChecksums.paymentAmountSum ||
      dstChecksums.productStockQtySum !== srcChecksums.productStockQtySum
    ) {
      throw new PartitionSecurityError(
        'Migration financial checksum mismatch; aborting without modifying original database.',
      )
    }

    dst
      .prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
      .run('encryption_migration_state', 'completed')
    dst.close()
    dst = null
    src.close()

    renameSync(stagingPath, targetPath)
    writeFileSync(
      statePath,
      JSON.stringify({ state: 'completed', completedAt: new Date().toISOString() }),
      'utf8',
    )

    encryptionStatus = {
      ...encryptionStatus,
      legacyPlaintextDetected: detection.isPlaintextSqlite,
      migrationState: 'completed',
    }

    return {
      migrated: true,
      sourcePlaintextDetected: detection.isPlaintextSqlite,
      backupPath,
      tablesCopied,
      rowCounts,
      financialChecksums: dstChecksums,
      encryption,
    }
  } catch (err) {
    try {
      dst?.close()
    } catch {
      /* ignore */
    }
    try {
      src.close()
    } catch {
      /* ignore */
    }
    rmSync(stagingPath, { force: true })
    writeFileSync(
      statePath,
      JSON.stringify({ state: 'failed', failedAt: new Date().toISOString() }),
      'utf8',
    )
    encryptionStatus = {
      ...encryptionStatus,
      migrationState: 'failed',
      lastFailure: err instanceof Error ? err.message : String(err),
    }
    throw err
  }
}

export function recoverInterruptedMigration(targetPath: string): {
  interrupted: boolean
  state: string | null
  stagingCleaned: boolean
} {
  const statePath = `${targetPath}.migration-state.json`
  const stagingPath = `${targetPath}.migrating`
  let state: string | null = null
  if (existsSync(statePath)) {
    try {
      const parsed = JSON.parse(readFileSync(statePath, 'utf8')) as { state?: string }
      state = parsed.state ?? null
    } catch {
      state = 'corrupt'
    }
  }
  const interrupted = state === 'in_progress' || state === 'failed' || state === 'corrupt'
  const stagingExists = existsSync(stagingPath)
  if (interrupted && stagingExists) {
    rmSync(stagingPath, { force: true })
  }
  return { interrupted, state, stagingCleaned: interrupted && stagingExists }
}

export function rotateDatabasePartitionKey(params?: {
  newMasterSecret?: string | undefined
  newSaltHex?: string | undefined
}): { rotated: boolean; saltHexPrefix: string } {
  const nextMaster = params?.newMasterSecret ?? PerUserPartitionManager.generateDeviceMasterSecret()
  const nextSalt = params?.newSaltHex ?? PerUserPartitionManager.generatePartitionSaltHex()
  if (nextMaster.trim().length < 32 || !/^[0-9a-f]{32,}$/i.test(nextSalt)) {
    throw new PartitionSecurityError('Invalid rotation secret or salt material.')
  }
  secureSet('hisabche.partition.master', nextMaster)
  secureSet('hisabche.partition.salt', nextSalt)
  return { rotated: true, saltHexPrefix: nextSalt.slice(0, 8) }
}

export function openUserPartitionWith(
  Driver: new (path: string) => SqliteDatabase,
  config: Omit<UserDatabaseConfig, 'deviceMasterSecret'> & {
    deviceMasterSecret?: string | undefined
    requireNativeSqlCipher?: boolean | undefined
  },
): {
  opened: boolean
  partition: UserPartitionInfo
  encryption: SqlCipherActivationResult
} {
  const masterSecret = config.deviceMasterSecret ?? getOrCreatePartitionMasterSecret()
  const partition = PerUserPartitionManager.resolvePartition({
    ...config,
    deviceMasterSecret: masterSecret,
  })
  const candidate = new Driver(partition.fullPath)
  let encryption: SqlCipherActivationResult
  try {
    encryption = PerUserPartitionManager.configureSqliteCipher(
      candidate as SqlCipherPragmaTarget,
      partition,
      { requireNativeSqlCipher: config.requireNativeSqlCipher },
    )
    candidate.pragma('journal_mode = WAL')
    candidate.pragma('foreign_keys = ON')
    CREATE_STATEMENTS.forEach((statement) => candidate.exec(statement))
    runMigrations(candidate)
    candidate
      .prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
      .run('schema_version', String(SCHEMA_VERSION))
  } catch (error) {
    candidate.close()
    lastFailure = error instanceof Error ? error.message : String(error)
    reportError(error, { scope: 'db.openPartition' })
    throw error
  }

  db?.close()
  db = candidate
  return { opened: true, partition, encryption }
}

export function initDatabaseWith(
  Driver: new (path: string) => SqliteDatabase,
  path: string,
  options?: InitDatabaseOptions,
): boolean {
  if (db) return true

  let candidate: SqliteDatabase | null = null
  try {
    candidate = new Driver(path)
    if (
      options?.deviceMasterSecret ||
      options?.requireNativeSqlCipher ||
      options?.requireOsKeystore ||
      process.env.HISABCHE_REQUIRE_SQLCIPHER === '1'
    ) {
      const applied = applyEncryptionOnCandidate(candidate, path, options)
      encryptionStatus = {
        initialized: true,
        mode: applied.encryption.mode,
        nativeSqlCipherSupported: applied.encryption.keyApplied,
        cipherVersion: applied.encryption.cipherVersion,
        keyApplied: applied.encryption.keyApplied,
        osKeystoreAvailable: applied.osKeystoreAvailable,
        legacyPlaintextDetected: applied.legacyPlaintextDetected,
        migrationState: 'none',
        lastFailure: null,
      }
    } else {
      const detection = detectDatabaseEncryptionStatus(path)
      encryptionStatus = {
        initialized: true,
        mode: 'application_envelope_aead',
        nativeSqlCipherSupported: false,
        cipherVersion: null,
        keyApplied: false,
        osKeystoreAvailable: false,
        legacyPlaintextDetected: detection.isPlaintextSqlite,
        migrationState: 'none',
        lastFailure: null,
      }
    }

    candidate.pragma('journal_mode = WAL')
    candidate.pragma('foreign_keys = ON')

    CREATE_STATEMENTS.forEach((statement) => candidate?.exec(statement))
    runMigrations(candidate)
    candidate
      .prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
      .run('schema_version', String(SCHEMA_VERSION))
    db = candidate
    return true
  } catch (error) {
    try {
      candidate?.close()
    } catch {
      /* ignore close error during failed init */
    }
    // ⚠️ REPORTED, NOT SWALLOWED.
    //
    // Falling back to online-only is the right behaviour — the app must still
    // start. Doing it in silence is not: a machine whose cache never opens
    // looks identical to one that is simply online, so nobody finds out that
    // the offline product does not work on it. The reason is kept in
    // `lastFailure` so the renderer can say WHICH it is.
    lastFailure = error instanceof Error ? error.message : String(error)
    encryptionStatus = {
      ...encryptionStatus,
      initialized: false,
      mode: 'uninitialized',
      lastFailure,
    }
    reportError(error, { scope: 'db.init' })
    db = null
    return false
  }
}

export function initDatabase(options?: InitDatabaseOptions): boolean {
  if (db) return true

  let candidate: SqliteDatabase | null = null
  try {
    // Required at runtime so a missing native binding degrades instead of
    // breaking the module graph at import time.
    const Database = require('better-sqlite3') as new (path: string) => SqliteDatabase
    const dbPath = join(app.getPath('userData'), 'hisabche.db')
    recoverInterruptedMigration(dbPath)
    candidate = new Database(dbPath)

    const applied = applyEncryptionOnCandidate(candidate, dbPath, options)
    encryptionStatus = {
      initialized: true,
      mode: applied.encryption.mode,
      nativeSqlCipherSupported: applied.encryption.keyApplied,
      cipherVersion: applied.encryption.cipherVersion,
      keyApplied: applied.encryption.keyApplied,
      osKeystoreAvailable: applied.osKeystoreAvailable,
      legacyPlaintextDetected: applied.legacyPlaintextDetected,
      migrationState: 'none',
      lastFailure: null,
    }

    candidate.pragma('journal_mode = WAL')
    candidate.pragma('foreign_keys = ON')

    CREATE_STATEMENTS.forEach((statement) => candidate?.exec(statement))
    runMigrations(candidate)
    candidate
      .prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
      .run('schema_version', String(SCHEMA_VERSION))
    db = candidate
    return true
  } catch (error) {
    try {
      candidate?.close()
    } catch {
      /* ignore close error during failed init */
    }
    // ⚠️ REPORTED, NOT SWALLOWED.
    //
    // Falling back to online-only is the right behaviour — the app must still
    // start. Doing it in silence is not: a machine whose cache never opens
    // looks identical to one that is simply online, so nobody finds out that
    // the offline product does not work on it. The reason is kept in
    // `lastFailure` so the renderer can say WHICH it is.
    lastFailure = error instanceof Error ? error.message : String(error)
    encryptionStatus = {
      ...encryptionStatus,
      initialized: false,
      mode: 'uninitialized',
      lastFailure,
    }
    reportError(error, { scope: 'db.init' })
    db = null
    return false
  }
}

export function isReady(): boolean {
  return db !== null
}

/** The reason the cache is unavailable, or null when it is working. */
export function cacheFailure(): string | null {
  return db === null ? (lastFailure ?? 'unknown') : null
}

export function closeDatabase(): void {
  db?.close()
  db = null
}

/**
 * Returns a LocalDb adapter over the active database instance.
 * Conforms to the LocalDb interface expected by @hisabche/local-engine.
 */
export function getLocalDb(): LocalDb {
  if (!db) {
    throw new Error('Database not initialized')
  }
  const currentDb = db
  return {
    all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
      return currentDb.prepare(sql).all(...params) as T[]
    },
    get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
      return currentDb.prepare(sql).get(...params) as T | undefined
    },
    run(sql: string, params: unknown[] = []): RunResult {
      const res = currentDb.prepare(sql).run(...params)
      return {
        changes: res.changes,
        lastInsertRowid: res.lastInsertRowid,
      }
    },
    exec(sql: string): void {
      currentDb.exec(sql)
    },
    transaction<T>(fn: () => T): T {
      return currentDb.transaction(fn)()
    },
  }
}

// ============================================
// Reads
// ============================================

export interface QueryInput {
  table: LocalTable
  search?: string | undefined
  where?: Record<string, string | number | boolean | null> | undefined
  orderBy?: string | undefined
  direction: 'asc' | 'desc'
  limit: number
  offset: number
}

/**
 * A page of rows AND how many rows the filter matches in all.
 *
 * ⚠️ THE SQL IS THE ONE BOTH HOSTS RUN (@hisabche/app-bridge). This file used
 * to build its own SELECT, which is how two caches end up answering the same
 * question differently on different machines.
 *
 * The count comes from the SAME WHERE as the page, so the pager and the list
 * can never disagree about what the filter means.
 */
export function query<T>(input: QueryInput): { rows: T[]; total: number } {
  if (!db) return { rows: [], total: 0 }

  const local: LocalQueryInput = {
    table: input.table,
    direction: input.direction,
    limit: input.limit,
    offset: input.offset,
    ...(input.search !== undefined ? { search: input.search } : {}),
    ...(input.where !== undefined ? { where: input.where } : {}),
    ...(input.orderBy !== undefined ? { orderBy: input.orderBy } : {}),
  }

  const page = buildSelect(local)
  const rows = db.prepare(page.sql).all(...page.params) as T[]

  const count = buildCount(local)
  const counted = db.prepare(count.sql).get(...count.params) as { total: number } | undefined

  return { rows, total: Number(counted?.total ?? rows.length) }
}

// ============================================
// Writes
// ============================================

/**
 * Remove rows the server deleted (a `delete` in the change log).
 *
 * Only for tables with no soft-delete column of their own — products and
 * customers are retired with `is_active = 0` instead, because a queued local
 * change may still reference them. A `dirty` row is never removed: its unsent
 * edit exists nowhere but here.
 */
export function removeMany(table: LocalTable, ids: string[]): number {
  if (!db || ids.length === 0) return 0
  const database = db
  const remove = database.prepare(`DELETE FROM ${ident(table)} WHERE id = ? AND dirty = 0`)
  const run = database.transaction((batch: string[]) => {
    let removed = 0
    for (const id of batch) removed += remove.run(id).changes
    return removed
  })
  return run(ids)
}

export function upsertMany(table: LocalTable, rows: Array<Record<string, unknown>>): number {
  if (!db || rows.length === 0) return 0

  const allowed = WRITABLE_COLUMNS[table] ?? []
  const database = db

  const write = database.transaction((batch: Array<Record<string, unknown>>) => {
    for (const row of batch) {
      const columns = Object.keys(row).filter((key) => allowed.includes(key))
      if (columns.length === 0 || !columns.includes('id')) continue

      const assignments = columns
        .filter((c) => c !== 'id')
        .map((c) => `${ident(c)} = excluded.${ident(c)}`)
      const sql =
        `INSERT INTO ${ident(table)} (${columns.map(ident).join(', ')}) ` +
        `VALUES (${columns.map(() => '?').join(', ')}) ` +
        `ON CONFLICT(id) DO UPDATE SET ${assignments.join(', ')}`

      database.prepare(sql).run(...columns.map((c) => normalize(row[c])))
    }
  })

  write(rows)
  return rows.length
}

/** SQLite only binds primitives — booleans become 0/1, objects become JSON. */
function normalize(value: unknown): string | number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

// ============================================
// Sync queue
// ============================================

export function enqueue(input: {
  entity: LocalTable
  operation: 'create' | 'update' | 'delete'
  clientId: string
  payload: Record<string, unknown>
  /** The account making the change. Null: nobody knows. */
  userId?: string | null | undefined
  /** The business the change belongs to. Null: nobody knows. */
  workspaceId?: string | null | undefined
}): void {
  if (!db) return

  // The same SQL the phone runs (@hisabche/app-bridge), so one device's queue
  // is the other's queue — and the owner is written the same way on both.
  const { sql, params } = buildEnqueue(input)
  db.prepare(sql).run(...params)
}

interface QueueRow {
  client_id: string
  entity: LocalTable
  operation: 'create' | 'update' | 'delete'
  payload: string
  attempts: number
  status: 'pending' | 'failed'
  last_error: string | null
  created_at: string
  user_id: string | null
  workspace_id: string | null
}

export function readQueue(): QueueEntry[] {
  if (!db) return []

  const rows = db.prepare(`SELECT * FROM sync_queue ORDER BY created_at ASC`).all() as QueueRow[]

  return rows.map((row) => ({
    clientId: row.client_id,
    entity: row.entity,
    operation: row.operation,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    attempts: row.attempts,
    status: row.status,
    lastError: row.last_error,
    createdAt: row.created_at,
    // Null means "nobody knows" — the row is never sent on a guess.
    userId: row.user_id,
    workspaceId: row.workspace_id,
  }))
}

export function claimQueue(clientId: string, owner: string, leaseMs: number = 30_000): boolean {
  if (!db) return false
  const key = `claim:queue:${clientId}`
  const now = Date.now()

  let acquired = false
  const tx = db.transaction(() => {
    const existing = db!.prepare('SELECT value FROM meta WHERE key = ?').get(key) as
      { value?: string } | undefined
    if (existing?.value) {
      const [existingOwner, rawExpires] = existing.value.split(':')
      const expiresAt = Number(rawExpires ?? 0)
      if (now < expiresAt && existingOwner !== owner) {
        acquired = false
        return
      }
    }
    const val = `${owner}:${now + leaseMs}`
    db!.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(key, val)
    acquired = true
  })

  tx()
  return acquired
}

/**
 * «This device pulled `table` for `workspaceId`» (V68.1).
 *
 * Kept in `meta` so it survives a reload, and removed with the cached rows
 * when the cache is pointed at another workspace (`setCachedWorkspace`): a
 * stamp that outlived its rows would call an empty table «ready».
 */
export function markTableSynced(workspaceId: string, table: string, pulledAt: string): void {
  if (!db) return
  // A stamp for a workspace the cache does not hold would be a lie.
  if (getCachedWorkspace() !== workspaceId) return
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
    `synced:${workspaceId}:${table}`,
    pulledAt,
  )
}

export function syncedTables(workspaceId: string): Record<string, string> {
  if (!db) return {}
  if (getCachedWorkspace() !== workspaceId) return {}
  const prefix = `synced:${workspaceId}:`
  const rows = db
    .prepare('SELECT key, value FROM meta WHERE substr(key, 1, ?) = ?')
    .all(prefix.length, prefix) as Array<{ key: string; value: string }>
  const out: Record<string, string> = {}
  for (const row of rows) out[row.key.slice(prefix.length)] = row.value
  return out
}

export function resolveQueue(clientId: string, status: 'done' | 'failed', error?: string): void {
  if (!db) return

  try {
    db.prepare(`DELETE FROM meta WHERE key = ?`).run(`claim:queue:${clientId}`)
  } catch {
    // Ignore cleanup error if meta table unavailable
  }

  if (status === 'done') {
    db.prepare(`DELETE FROM sync_queue WHERE client_id = ?`).run(clientId)
    return
  }

  db.prepare(
    `UPDATE sync_queue SET status = 'failed', attempts = attempts + 1, last_error = ?
     WHERE client_id = ?`,
  ).run(error ?? null, clientId)
}

// ============================================
// Pull cursors
// ============================================

export function getCursor(entity: LocalTable): string | null {
  if (!db) return null
  const row = db.prepare(`SELECT last_pulled_at FROM sync_cursor WHERE entity = ?`).get(entity) as
    { last_pulled_at: string } | undefined
  return row?.last_pulled_at ?? null
}

export function setCursor(entity: LocalTable, value: string): void {
  if (!db) return
  db.prepare(`INSERT OR REPLACE INTO sync_cursor (entity, last_pulled_at) VALUES (?, ?)`).run(
    entity,
    value,
  )
}

// ============================================
// Workspace switching
// ============================================

/**
 * The workspace this local cache currently holds, or null on a fresh install.
 *
 * The cached tables carry no `workspace_id` of their own: they are filled from
 * REST endpoints that are already scoped to the caller's authorized workspace,
 * so every row in them belongs to whichever workspace was active at pull time.
 * That is sound right up until the active workspace CHANGES — at which point
 * the cache holds one business's books while the app believes it is showing
 * another's. Recording which one it is makes that detectable.
 */
export function getCachedWorkspace(): string | null {
  if (!db) return null
  const row = db.prepare(`SELECT value FROM meta WHERE key = 'workspace_id'`).get() as
    { value: string } | undefined
  return row?.value ?? null
}

/**
 * Point the cache at a workspace, clearing it first if it held another one.
 *
 * Returns true when a purge happened.
 *
 * ⚠️ WHAT IS AND IS NOT DELETED
 *
 * The cached entity tables are discarded: they are a copy of server state and
 * are refetched on the next pull, so losing them costs a round-trip and
 * nothing else.
 *
 * `sync_queue` is NOT discarded. It holds mutations the user made offline that
 * the server has never seen — deleting them destroys work that exists nowhere
 * else. If any are pending, this refuses to switch and reports the count so
 * the caller can flush them first. A shopkeeper who wrote three invoices on a
 * plane must not lose them by tapping a workspace switcher on landing.
 */
export function setCachedWorkspace(workspaceId: string): {
  purged: boolean
  blockedByPendingMutations: number
} {
  if (!db) return { purged: false, blockedByPendingMutations: 0 }

  const current = getCachedWorkspace()
  if (current === workspaceId) return { purged: false, blockedByPendingMutations: 0 }

  if (current !== null) {
    const pending = db
      .prepare(`SELECT count(*) AS n FROM sync_queue WHERE status <> 'failed'`)
      .get() as { n: number }

    if (pending.n > 0) {
      return { purged: false, blockedByPendingMutations: pending.n }
    }
  }

  // One transaction: a half-cleared cache mixing two businesses' rows is worse
  // than either a full one or an empty one.
  const purge = db.transaction(() => {
    for (const table of CACHED_TABLES) {
      db!.prepare(`DELETE FROM ${table === 'transaction' ? '"transaction"' : table}`).run()
    }
    db!.prepare(`DELETE FROM sync_cursor`).run()
    // The pull stamps describe the rows just deleted (V68.1).
    db!.prepare(`DELETE FROM meta WHERE substr(key, 1, 7) = 'synced:'`).run()
    db!
      .prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('workspace_id', ?)`)
      .run(workspaceId)
  })

  purge()

  return { purged: current !== null, blockedByPendingMutations: 0 }
}

/** Server-derived tables only. `sync_queue` is deliberately absent. */
const CACHED_TABLES: readonly LocalTable[] = [
  'product',
  'customer',
  'invoice',
  'invoice_item',
  'transaction',
  'inventory_movement',
  'employee',
]
