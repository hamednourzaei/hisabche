// ============================================
// Local SQLite schema.
//
// Mirrors the server tables from @hisabche/db-schema, narrowed to what the
// desktop actually reads offline. Server-generated ids stay the primary key
// so a pulled row overwrites its local copy verbatim.
//
// Every table carries:
//   updated_at — cursor for incremental pull
//   dirty      — 1 while a local change is still queued for push
// ============================================

export const SCHEMA_VERSION = 1

export const CREATE_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS product (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    barcode TEXT,
    sku TEXT,
    category TEXT,
    quantity REAL NOT NULL DEFAULT 0,
    unit TEXT,
    min_stock_level REAL NOT NULL DEFAULT 0,
    buy_price REAL NOT NULL DEFAULT 0,
    sell_price REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_product_barcode ON product(barcode)`,
  `CREATE INDEX IF NOT EXISTS idx_product_name ON product(name)`,

  `CREATE TABLE IF NOT EXISTS customer (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    opening_balance REAL NOT NULL DEFAULT 0,
    type TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_customer_name ON customer(full_name)`,
  `CREATE INDEX IF NOT EXISTS idx_customer_phone ON customer(phone)`,

  `CREATE TABLE IF NOT EXISTS invoice (
    id TEXT PRIMARY KEY,
    invoice_number TEXT,
    type TEXT NOT NULL DEFAULT 'sale',
    customer_id TEXT,
    customer_name TEXT,
    date TEXT NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0,
    discount_total REAL NOT NULL DEFAULT 0,
    tax_total REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    paid_amount REAL NOT NULL DEFAULT 0,
    payment_method TEXT,
    currency TEXT NOT NULL DEFAULT 'AFN',
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    updated_at TEXT NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_invoice_date ON invoice(date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_invoice_customer ON invoice(customer_id)`,

  `CREATE TABLE IF NOT EXISTS invoice_item (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    product_id TEXT,
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    unit_price REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    total_price REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_invoice_item_invoice ON invoice_item(invoice_id)`,

  `CREATE TABLE IF NOT EXISTS "transaction" (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    supplier_id TEXT,
    type TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'AFN',
    description TEXT,
    reference TEXT,
    date TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_transaction_date ON "transaction"(date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_transaction_customer ON "transaction"(customer_id)`,

  `CREATE TABLE IF NOT EXISTS inventory_movement (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    reference TEXT,
    date TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_movement_product ON inventory_movement(product_id)`,

  `CREATE TABLE IF NOT EXISTS employee (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    role TEXT,
    phone TEXT,
    salary REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS sync_queue (
    client_id TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    last_error TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_queue_status ON sync_queue(status, created_at)`,

  `CREATE TABLE IF NOT EXISTS sync_cursor (
    entity TEXT PRIMARY KEY,
    last_pulled_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
]

/** Columns that may be written per table — anything else in a payload is dropped. */
export const WRITABLE_COLUMNS: Record<string, readonly string[]> = {
  product: [
    'id', 'name', 'barcode', 'sku', 'category', 'quantity', 'unit',
    'min_stock_level', 'buy_price', 'sell_price', 'is_active', 'updated_at', 'dirty',
  ],
  customer: [
    'id', 'full_name', 'phone', 'email', 'address', 'opening_balance',
    'type', 'is_active', 'updated_at', 'dirty',
  ],
  invoice: [
    'id', 'invoice_number', 'type', 'customer_id', 'customer_name', 'date', 'subtotal',
    'discount_total', 'tax_total', 'total', 'paid_amount', 'payment_method', 'currency',
    'status', 'notes', 'updated_at', 'dirty',
  ],
  invoice_item: [
    'id', 'invoice_id', 'product_id', 'product_name', 'quantity', 'unit_price',
    'discount', 'total_price', 'updated_at', 'dirty',
  ],
  transaction: [
    'id', 'customer_id', 'supplier_id', 'type', 'amount', 'currency',
    'description', 'reference', 'date', 'updated_at', 'dirty',
  ],
  inventory_movement: [
    'id', 'product_id', 'type', 'quantity', 'reference', 'date', 'updated_at', 'dirty',
  ],
  employee: ['id', 'full_name', 'role', 'phone', 'salary', 'is_active', 'updated_at', 'dirty'],
}

/** Columns a free-text search may target per table. */
export const SEARCHABLE_COLUMNS: Record<string, readonly string[]> = {
  product: ['name', 'barcode', 'sku'],
  customer: ['full_name', 'phone', 'email'],
  invoice: ['invoice_number', 'customer_name'],
  invoice_item: ['product_name'],
  transaction: ['description', 'reference'],
  inventory_movement: ['reference'],
  employee: ['full_name', 'phone'],
}
