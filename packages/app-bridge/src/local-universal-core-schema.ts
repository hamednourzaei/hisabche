// ============================================
// packages/app-bridge/src/local-universal-core-schema.ts
//
// Local SQLite schema for Universal Core:
// Variants, Metal Rates, Fitments, Vehicle Attributes (linked to stock_serials),
// Warranties, Invoice Returns, Order Deposits (v9).
//
// Anti-duplicate rule:
// - Pack barcodes use existing `product_barcodes(..., unit)`
// - Serial items use existing `stock_serials`
// - Vehicles store unit attributes in `vehicle_attributes`
// ============================================

export const UNIVERSAL_CORE_STATEMENTS: readonly string[] = [
  // ─── 1. Product Variants (v9) ─────────────────────────────────
  `CREATE TABLE IF NOT EXISTS product_variants (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    template_product_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    barcode TEXT,
    attributes TEXT NOT NULL DEFAULT '[]',
    price_override_minor INTEGER,
    cost_override_minor INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_product_variants_template ON product_variants(workspace_id, template_product_id)`,

  // ─── 2. Metal Rates (v9) ─────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS metal_rates (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    rate_date TEXT NOT NULL,
    rate_24k_minor_per_gram INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_metal_rates_date ON metal_rates(workspace_id, rate_date)`,

  // ─── 3. Auto Fitments (v9) ───────────────────────────────────
  `CREATE TABLE IF NOT EXISTS auto_fitments (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    product_id TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year_start INTEGER NOT NULL,
    year_end INTEGER NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_auto_fitments_search ON auto_fitments(workspace_id, make, model)`,

  // ─── 4. Vehicle Attributes (v9, linked to stock_serials) ───────
  `CREATE TABLE IF NOT EXISTS vehicle_attributes (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    serial_id TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    colour TEXT NOT NULL,
    odometer INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_vehicle_attributes_serial ON vehicle_attributes(workspace_id, serial_id)`,

  // ─── 5. Warranties (v9) ──────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS warranties (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    invoice_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    serial_number TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    warranty_months INTEGER NOT NULL,
    customer_id TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_warranties_invoice ON warranties(workspace_id, invoice_id)`,

  // ─── 6. Invoice Returns (v9) ─────────────────────────────────
  `CREATE TABLE IF NOT EXISTS invoice_returns (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    original_invoice_id TEXT NOT NULL,
    return_type TEXT NOT NULL,
    return_number TEXT NOT NULL,
    return_date TEXT NOT NULL,
    total_subtotal_minor INTEGER NOT NULL,
    total_discount_minor INTEGER NOT NULL DEFAULT 0,
    total_tax_minor INTEGER NOT NULL DEFAULT 0,
    grand_total_minor INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_invoice_returns_orig ON invoice_returns(workspace_id, original_invoice_id)`,

  `CREATE TABLE IF NOT EXISTS invoice_return_lines (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    return_id TEXT NOT NULL,
    original_line_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity REAL NOT NULL,
    restock_choice TEXT NOT NULL,
    reason_code TEXT NOT NULL,
    subtotal_minor INTEGER NOT NULL,
    discount_minor INTEGER NOT NULL DEFAULT 0,
    tax_minor INTEGER NOT NULL DEFAULT 0,
    total_minor INTEGER NOT NULL,
    restored_cost_minor INTEGER,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_return_lines_return ON invoice_return_lines(workspace_id, return_id)`,

  // ─── 7. Order Deposits (v9) ─────────────────────────────────
  `CREATE TABLE IF NOT EXISTS order_deposits (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    order_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    applied_invoice_id TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_order_deposits_order ON order_deposits(workspace_id, order_id)`,
]

export const UNIVERSAL_CORE_ALTERS: readonly string[] = [
  `ALTER TABLE local_workspace ADD COLUMN credit_limit_mode TEXT NOT NULL DEFAULT 'warn'`,
]
