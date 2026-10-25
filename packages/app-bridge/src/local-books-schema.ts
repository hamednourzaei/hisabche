// ============================================
// Local SQLite schema — the books-and-stock sections that used to be
// online-only (v7).
//
// Purchase orders, suppliers and the rest of what the offline endpoint matrix
// moved onto the device. Defined ONCE here: `CREATE_STATEMENTS` (a fresh
// install) spreads it and the v7 migration (a device that already has a cache)
// runs the very same statements, so the two can never describe different tables.
//
// Every statement is `IF NOT EXISTS` — safe to run twice.
//
// Same rules as the rest of the local schema: money is an INTEGER as the
// server's table keeps it, every entity table carries workspace_id, created_at,
// updated_at, deleted_at, origin and sync_state.
// ============================================

export const BOOKS_STOCK_STATEMENTS: readonly string[] = [
  // ─── Suppliers and purchase orders ───────────────────────────
  `CREATE TABLE IF NOT EXISTS supplier (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    address TEXT,
    notes TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_supplier_workspace ON supplier(workspace_id, name)`,

  `CREATE TABLE IF NOT EXISTS purchase_order (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    supplier_id TEXT,
    order_date TEXT NOT NULL,
    expected_delivery_date TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    received_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_purchase_order_workspace ON purchase_order(workspace_id, created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS purchase_order_item (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    purchase_order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    unit_price INTEGER NOT NULL DEFAULT 0,
    total_price INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_purchase_order_item_order ON purchase_order_item(purchase_order_id)`,
]
