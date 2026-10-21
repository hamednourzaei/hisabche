// ============================================
// Migrating a cache that is already on somebody's machine.
//
// ⚠️ `CREATE TABLE IF NOT EXISTS` IS NOT A MIGRATION.
//
// It creates a table on a fresh install and does NOTHING on a device that
// already has one — so a column added to the schema exists for new users and
// is missing for everybody else. The app then writes SQL naming a column the
// local database has never heard of, and every read of that table fails on
// exactly the machines that have been running longest.
//
// `schema_version` was already being written to `meta` on both hosts. Nothing
// ever read it back. This is what reads it.
//
// The statements are plain SQL and each host runs them with its own driver,
// the same arrangement as `local-sql.ts`.
// ============================================

import { SCHEMA_VERSION } from './local-schema'

export interface LocalMigration {
  /** The version this migration brings the cache UP TO. */
  to: number
  /**
   * ⚠️ Every statement must be safe to run twice.
   *
   * A migration that fails halfway leaves the version unchanged, so the next
   * launch runs it again from the top — and SQLite has no transactional DDL
   * to lean on for some of these.
   */
  statements: readonly string[]
}

/**
 * v2 — optimistic concurrency.
 *
 * Without a local `version` the client cannot tell the server which copy it
 * edited, so `/api/sync/push` has nothing to compare and every conflicting
 * edit resolves as last-write-wins, silently. Defaulting to 1 is correct for
 * rows already cached: the next pull overwrites it with the server's number.
 */
const V1_TABLES = [
  'product',
  'customer',
  'invoice',
  'invoice_item',
  'transaction',
  'inventory_movement',
  'employee',
] as const

const ADD_VERSION: LocalMigration = {
  to: 2,
  statements: V1_TABLES.map(
    (table) => `ALTER TABLE "${table}" ADD COLUMN version INTEGER NOT NULL DEFAULT 1`,
  ),
}

/**
 * v3 — Offline Edition.
 *
 * 1. Creates all newly introduced tables (local identity, inventory, costing,
 *    payments, ledger, accounts, exchange rates).
 * 2. Adds universal tenancy (workspace_id), soft-delete (deleted_at), and
 *    audit/sync columns to existing tables.
 * 3. Migrates money columns from floating point REAL to INTEGER minor units.
 */
const V3_OFFLINE_SCHEMA: LocalMigration = {
  to: 3,
  statements: [
    // ─── 1. Create New Offline Tables ─────────────────────────────
    `CREATE TABLE IF NOT EXISTS local_user (
      id TEXT PRIMARY KEY,
      email TEXT,
      full_name TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'owner',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS local_workspace (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_currency TEXT NOT NULL,
      time_zone TEXT NOT NULL DEFAULT 'Asia/Kabul',
      logo_url TEXT,
      stamp_url TEXT,
      signature_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS invoice_counter (
      workspace_id TEXT NOT NULL,
      prefix TEXT NOT NULL,
      next INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (workspace_id, prefix)
    )`,

    `CREATE TABLE IF NOT EXISTS warehouse (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      branch_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      origin TEXT NOT NULL DEFAULT 'local',
      sync_state TEXT NOT NULL DEFAULT 'local_only'
    )`,
    `CREATE INDEX IF NOT EXISTS idx_warehouse_workspace ON warehouse(workspace_id)`,

    `CREATE TABLE IF NOT EXISTS product_stock (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      warehouse_id TEXT NOT NULL,
      qty REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      origin TEXT NOT NULL DEFAULT 'local',
      sync_state TEXT NOT NULL DEFAULT 'local_only'
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_product_stock_unique ON product_stock(workspace_id, product_id, warehouse_id)`,

    `CREATE TABLE IF NOT EXISTS branch (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      parent_branch_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      origin TEXT NOT NULL DEFAULT 'local',
      sync_state TEXT NOT NULL DEFAULT 'local_only'
    )`,
    `CREATE INDEX IF NOT EXISTS idx_branch_workspace ON branch(workspace_id)`,

    `CREATE TABLE IF NOT EXISTS shelf (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      warehouse_id TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT,
      kind TEXT NOT NULL DEFAULT 'bin',
      parent_id TEXT,
      capacity TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      origin TEXT NOT NULL DEFAULT 'local',
      sync_state TEXT NOT NULL DEFAULT 'local_only'
    )`,
    `CREATE INDEX IF NOT EXISTS idx_shelf_warehouse ON shelf(warehouse_id)`,

    `CREATE TABLE IF NOT EXISTS cost_layer (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      warehouse_id TEXT,
      source_type TEXT NOT NULL,
      source_id TEXT,
      source_line TEXT,
      received_qty REAL NOT NULL DEFAULT 0,
      remaining_qty REAL NOT NULL DEFAULT 0,
      unit_cost INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      origin TEXT NOT NULL DEFAULT 'local',
      sync_state TEXT NOT NULL DEFAULT 'local_only'
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cost_layer_fifo ON cost_layer(workspace_id, product_id, entry_date, created_at)`,

    `CREATE TABLE IF NOT EXISTS cost_consumption (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      layer_id TEXT,
      product_id TEXT NOT NULL,
      warehouse_id TEXT,
      consumer_type TEXT NOT NULL,
      consumer_id TEXT,
      consumer_line TEXT,
      quantity REAL NOT NULL DEFAULT 0,
      unit_cost INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL,
      is_shortfall INTEGER NOT NULL DEFAULT 0,
      entry_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      origin TEXT NOT NULL DEFAULT 'local',
      sync_state TEXT NOT NULL DEFAULT 'local_only'
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cost_consumption_consumer ON cost_consumption(consumer_type, consumer_id)`,

    `CREATE TABLE IF NOT EXISTS payment (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      payment_number TEXT,
      direction TEXT NOT NULL,
      party_type TEXT NOT NULL,
      party_id TEXT,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'cash',
      entry_date TEXT NOT NULL,
      reference TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'posted',
      journal_entry_id TEXT,
      branch_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      origin TEXT NOT NULL DEFAULT 'local',
      sync_state TEXT NOT NULL DEFAULT 'local_only'
    )`,
    `CREATE INDEX IF NOT EXISTS idx_payment_workspace ON payment(workspace_id, entry_date DESC)`,

    `CREATE TABLE IF NOT EXISTS payment_allocation (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      payment_id TEXT NOT NULL,
      invoice_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      origin TEXT NOT NULL DEFAULT 'local',
      sync_state TEXT NOT NULL DEFAULT 'local_only'
    )`,
    `CREATE INDEX IF NOT EXISTS idx_payment_allocation_payment ON payment_allocation(payment_id)`,
    `CREATE INDEX IF NOT EXISTS idx_payment_allocation_invoice ON payment_allocation(invoice_id)`,

    `CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      role TEXT,
      parent_id TEXT,
      is_group INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      origin TEXT NOT NULL DEFAULT 'local',
      sync_state TEXT NOT NULL DEFAULT 'local_only'
    )`,
    `CREATE INDEX IF NOT EXISTS idx_account_code ON account(workspace_id, code)`,

    `CREATE TABLE IF NOT EXISTS journal_entry (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      entry_number TEXT,
      date TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      reference TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      source_type TEXT,
      source_id TEXT,
      reversal_of TEXT,
      posted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      origin TEXT NOT NULL DEFAULT 'local',
      sync_state TEXT NOT NULL DEFAULT 'local_only'
    )`,
    `CREATE INDEX IF NOT EXISTS idx_journal_entry_date ON journal_entry(workspace_id, date DESC)`,

    `CREATE TABLE IF NOT EXISTS journal_line (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      journal_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      debit INTEGER NOT NULL DEFAULT 0,
      credit INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      origin TEXT NOT NULL DEFAULT 'local',
      sync_state TEXT NOT NULL DEFAULT 'local_only',
      CONSTRAINT chk_journal_line_debit_credit CHECK (debit >= 0 AND credit >= 0 AND NOT (debit > 0 AND credit > 0))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_journal_line_journal ON journal_line(journal_id)`,
    `CREATE INDEX IF NOT EXISTS idx_journal_line_account ON journal_line(workspace_id, account_id)`,

    `CREATE TABLE IF NOT EXISTS exchange_rate (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      currency_code TEXT NOT NULL,
      rate REAL NOT NULL,
      rate_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      origin TEXT NOT NULL DEFAULT 'local',
      sync_state TEXT NOT NULL DEFAULT 'local_only'
    )`,
    `CREATE INDEX IF NOT EXISTS idx_exchange_rate_date ON exchange_rate(workspace_id, currency_code, rate_date DESC)`,

    `CREATE TABLE IF NOT EXISTS inventory_settings (
      workspace_id TEXT PRIMARY KEY,
      costing_method TEXT NOT NULL DEFAULT 'fifo',
      negative_stock TEXT NOT NULL DEFAULT 'block',
      updated_at TEXT NOT NULL
    )`,

    // ─── 2. Add Missing Columns to Existing Tables ────────────────
    `ALTER TABLE product ADD COLUMN workspace_id TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE product ADD COLUMN wholesale_price INTEGER DEFAULT 0`,
    `ALTER TABLE product ADD COLUMN image_url TEXT`,
    `ALTER TABLE product ADD COLUMN created_at TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE product ADD COLUMN deleted_at TEXT`,
    `ALTER TABLE product ADD COLUMN origin TEXT NOT NULL DEFAULT 'local'`,
    `ALTER TABLE product ADD COLUMN sync_state TEXT NOT NULL DEFAULT 'local_only'`,
    `CREATE INDEX IF NOT EXISTS idx_product_workspace ON product(workspace_id)`,

    `ALTER TABLE customer ADD COLUMN workspace_id TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE customer ADD COLUMN notes TEXT`,
    `ALTER TABLE customer ADD COLUMN declared_role TEXT`,
    `ALTER TABLE customer ADD COLUMN created_at TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE customer ADD COLUMN deleted_at TEXT`,
    `ALTER TABLE customer ADD COLUMN origin TEXT NOT NULL DEFAULT 'local'`,
    `ALTER TABLE customer ADD COLUMN sync_state TEXT NOT NULL DEFAULT 'local_only'`,
    `CREATE INDEX IF NOT EXISTS idx_customer_workspace ON customer(workspace_id)`,

    `ALTER TABLE invoice ADD COLUMN workspace_id TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE invoice ADD COLUMN external_number TEXT`,
    `ALTER TABLE invoice ADD COLUMN supplier_id TEXT`,
    `ALTER TABLE invoice ADD COLUMN branch_id TEXT`,
    `ALTER TABLE invoice ADD COLUMN due_date TEXT`,
    `ALTER TABLE invoice ADD COLUMN exchange_rate REAL`,
    `ALTER TABLE invoice ADD COLUMN created_at TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE invoice ADD COLUMN deleted_at TEXT`,
    `ALTER TABLE invoice ADD COLUMN origin TEXT NOT NULL DEFAULT 'local'`,
    `ALTER TABLE invoice ADD COLUMN sync_state TEXT NOT NULL DEFAULT 'local_only'`,
    `CREATE INDEX IF NOT EXISTS idx_invoice_workspace ON invoice(workspace_id)`,
    `CREATE INDEX IF NOT EXISTS idx_invoice_number ON invoice(workspace_id, invoice_number)`,

    `ALTER TABLE invoice_item ADD COLUMN workspace_id TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE invoice_item ADD COLUMN unit TEXT`,
    `ALTER TABLE invoice_item ADD COLUMN unit_label TEXT`,
    `ALTER TABLE invoice_item ADD COLUMN weight_grams REAL DEFAULT 0`,
    `ALTER TABLE invoice_item ADD COLUMN buy_price INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE invoice_item ADD COLUMN notes TEXT`,
    `ALTER TABLE invoice_item ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE invoice_item ADD COLUMN created_at TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE invoice_item ADD COLUMN deleted_at TEXT`,
    `ALTER TABLE invoice_item ADD COLUMN origin TEXT NOT NULL DEFAULT 'local'`,
    `ALTER TABLE invoice_item ADD COLUMN sync_state TEXT NOT NULL DEFAULT 'local_only'`,
    `CREATE INDEX IF NOT EXISTS idx_invoice_item_workspace ON invoice_item(workspace_id)`,

    `ALTER TABLE "transaction" ADD COLUMN workspace_id TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "transaction" ADD COLUMN created_at TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "transaction" ADD COLUMN deleted_at TEXT`,
    `ALTER TABLE "transaction" ADD COLUMN origin TEXT NOT NULL DEFAULT 'local'`,
    `ALTER TABLE "transaction" ADD COLUMN sync_state TEXT NOT NULL DEFAULT 'local_only'`,

    `ALTER TABLE inventory_movement ADD COLUMN workspace_id TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE inventory_movement ADD COLUMN created_at TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE inventory_movement ADD COLUMN deleted_at TEXT`,
    `ALTER TABLE inventory_movement ADD COLUMN origin TEXT NOT NULL DEFAULT 'local'`,
    `ALTER TABLE inventory_movement ADD COLUMN sync_state TEXT NOT NULL DEFAULT 'local_only'`,

    `ALTER TABLE employee ADD COLUMN workspace_id TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE employee ADD COLUMN created_at TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE employee ADD COLUMN deleted_at TEXT`,
    `ALTER TABLE employee ADD COLUMN origin TEXT NOT NULL DEFAULT 'local'`,
    `ALTER TABLE employee ADD COLUMN sync_state TEXT NOT NULL DEFAULT 'local_only'`,

    // ─── 3. Convert Existing Floating Money to Integer Minor Units ─
    // Marker in meta ensures conversion runs at most once even if retried.
    `INSERT OR IGNORE INTO meta (key, value) VALUES ('v3_money_migrated', '0')`,
    `UPDATE product SET buy_price = CAST(ROUND(buy_price * 100) AS INTEGER), sell_price = CAST(ROUND(sell_price * 100) AS INTEGER) WHERE (SELECT value FROM meta WHERE key = 'v3_money_migrated') = '0'`,
    `UPDATE customer SET opening_balance = CAST(ROUND(opening_balance * 100) AS INTEGER) WHERE (SELECT value FROM meta WHERE key = 'v3_money_migrated') = '0'`,
    `UPDATE invoice SET subtotal = CAST(ROUND(subtotal * 100) AS INTEGER), discount_total = CAST(ROUND(discount_total * 100) AS INTEGER), tax_total = CAST(ROUND(tax_total * 100) AS INTEGER), total = CAST(ROUND(total * 100) AS INTEGER), paid_amount = CAST(ROUND(paid_amount * 100) AS INTEGER) WHERE (SELECT value FROM meta WHERE key = 'v3_money_migrated') = '0'`,
    `UPDATE invoice_item SET unit_price = CAST(ROUND(unit_price * 100) AS INTEGER), discount = CAST(ROUND(discount * 100) AS INTEGER), total_price = CAST(ROUND(total_price * 100) AS INTEGER) WHERE (SELECT value FROM meta WHERE key = 'v3_money_migrated') = '0'`,
    `UPDATE "transaction" SET amount = CAST(ROUND(amount * 100) AS INTEGER) WHERE (SELECT value FROM meta WHERE key = 'v3_money_migrated') = '0'`,
    `UPDATE employee SET salary = CAST(ROUND(salary * 100) AS INTEGER) WHERE (SELECT value FROM meta WHERE key = 'v3_money_migrated') = '0'`,
    `UPDATE meta SET value = '1' WHERE key = 'v3_money_migrated'`,
  ],
}

/**
 * v4 — the outbox knows who made the change.
 *
 * A queued row is somebody's work. Without an owner, the next account to sign
 * in on this device sends it under its own token, and the change lands in
 * another business's books.
 *
 * ⚠️ THE COLUMNS ARE NULLABLE ON PURPOSE. The rows already on a device were
 * written before this version, and their owner is NOT GUESSED: they stay
 * "owner unknown" until a person says whose they are.
 */
const V4_OUTBOX_OWNER: LocalMigration = {
  to: 4,
  statements: [
    `ALTER TABLE sync_queue ADD COLUMN user_id TEXT`,
    `ALTER TABLE sync_queue ADD COLUMN workspace_id TEXT`,
  ],
}

export const LOCAL_MIGRATIONS: readonly LocalMigration[] = [
  ADD_VERSION,
  V3_OFFLINE_SCHEMA,
  V4_OUTBOX_OWNER,
]

/**
 * The statements needed to bring a cache at `from` up to the current version.
 *
 * ⚠️ A cache NEWER than this build gets nothing rather than being downgraded:
 * an older app opening a newer cache must not drop a column the newer app is
 * still writing to — the user may launch that one again tomorrow.
 */
export function migrationsFrom(from: number): readonly LocalMigration[] {
  if (from >= SCHEMA_VERSION) return []
  return LOCAL_MIGRATIONS.filter((migration) => migration.to > from)
}

/**
 * `duplicate column name` means the migration already ran — on a device whose
 * version row was lost, or where a half-applied run is being repeated.
 *
 * ⚠️ Recognised and IGNORED, not caught blindly: a genuine failure (a missing
 * table, a locked database) must still surface, or the cache silently stays
 * one version behind and every later migration is skipped too.
 */
export function isAlreadyApplied(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /duplicate column name/i.test(message)
}
