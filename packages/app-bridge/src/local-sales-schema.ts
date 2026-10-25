// ============================================
// Local SQLite schema — the sales side that used to be online-only (v5).
//
// Installment plans, late fees, price lists and promotions. Defined ONCE here:
// `CREATE_STATEMENTS` (a fresh install) spreads it and the v5 migration (a
// device that already has a cache) runs the very same statements, so the two
// can never describe different tables.
//
// Every statement is `IF NOT EXISTS` — safe to run twice.
//
// Rules are the same as the rest of the local schema: money is INTEGER minor
// units (an installment, a fee and a list price are kept in HUNDREDTHS exactly
// as the server's tables keep them), every entity table carries workspace_id,
// created_at, updated_at, origin and sync_state.
// ============================================

export const SALES_SIDE_STATEMENTS: readonly string[] = [
  // ─── Installment plans (#123) ────────────────────────────────
  // A schedule only: when the unpaid part of one invoice is due, in parts.
  // Payments stay in payment / payment_allocation.
  `CREATE TABLE IF NOT EXISTS invoice_installment (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    invoice_id TEXT NOT NULL,
    seq INTEGER NOT NULL CHECK (seq >= 1),
    due_date TEXT NOT NULL,
    amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_installment_seq ON invoice_installment(invoice_id, seq)`,
  `CREATE INDEX IF NOT EXISTS idx_invoice_installment_due ON invoice_installment(workspace_id, due_date)`,

  // ─── Late fees (#124) ────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS late_fee_policy (
    workspace_id TEXT PRIMARY KEY,
    is_enabled INTEGER NOT NULL DEFAULT 0,
    basis TEXT NOT NULL CHECK (basis IN ('per_period', 'percentage')),
    amount_minor INTEGER,
    currency TEXT,
    percent REAL,
    grace_days INTEGER NOT NULL DEFAULT 0,
    max_share_percent REAL NOT NULL DEFAULT 100,
    updated_by TEXT,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS late_fee_assessment (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    invoice_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    period_no INTEGER NOT NULL,
    due_date TEXT NOT NULL,
    days_late INTEGER NOT NULL,
    overdue_minor INTEGER NOT NULL,
    fee_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    policy TEXT NOT NULL,
    fee_invoice_id TEXT,
    assessed_by TEXT,
    assessed_at TEXT NOT NULL,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_late_fee_assessment_once ON late_fee_assessment(workspace_id, invoice_id, seq, period_no)`,
  `CREATE INDEX IF NOT EXISTS idx_late_fee_assessment_fee_invoice ON late_fee_assessment(workspace_id, fee_invoice_id)`,

  // ─── Price lists (#19) ───────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS price_list (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    currency TEXT NOT NULL,
    valid_from TEXT,
    valid_to TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  // One live list per name.
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_price_list_name ON price_list(workspace_id, lower(name)) WHERE is_active = 1`,
  `CREATE TABLE IF NOT EXISTS price_list_item (
    price_list_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor > 0),
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_by TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (price_list_id, product_id)
  )`,

  // ─── Promotions (#114–#117) ──────────────────────────────────
  `CREATE TABLE IF NOT EXISTS promotion (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    value REAL NOT NULL,
    currency TEXT,
    stacking TEXT NOT NULL DEFAULT 'exclusive',
    product_ids TEXT,
    customer_ids TEXT,
    valid_from TEXT,
    valid_to TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,

  // ─── The till (pos_sessions / pos_orders / pos_cash_movements) ─
  // Minor units here are the TILL's own (the currency's digits), as on the server.
  // currency NULL = the books currency, exactly as every till before a till had one.
  `CREATE TABLE IF NOT EXISTS pos_session (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    branch_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('open', 'suspended', 'closing', 'closed', 'force_closed')),
    currency TEXT,
    label TEXT CHECK (label IS NULL OR (length(label) BETWEEN 1 AND 80)),
    opening_float_minor INTEGER NOT NULL DEFAULT 0 CHECK (opening_float_minor >= 0),
    opened_at TEXT NOT NULL,
    opened_by TEXT NOT NULL,
    counted_cash_minor INTEGER,
    variance_reason TEXT,
    closed_at TEXT,
    closed_by TEXT,
    was_forced INTEGER NOT NULL DEFAULT 0,
    journal_entry_id TEXT,
    expected_cash_minor INTEGER,
    cash_sales_minor INTEGER,
    cash_in_minor INTEGER,
    cash_out_minor INTEGER,
    variance_minor INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_session_one_open ON pos_session(workspace_id, opened_by, COALESCE(branch_id, ''), COALESCE(currency, '')) WHERE status = 'open'`,
  `CREATE INDEX IF NOT EXISTS idx_pos_session_status ON pos_session(workspace_id, status, opened_at)`,
  `CREATE TABLE IF NOT EXISTS pos_order (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    order_ref TEXT NOT NULL,
    invoice_id TEXT,
    total_minor INTEGER NOT NULL,
    change_minor INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'voided')),
    created_at TEXT NOT NULL,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_order_ref ON pos_order(workspace_id, order_ref)`,
  `CREATE INDEX IF NOT EXISTS idx_pos_order_session ON pos_order(session_id)`,
  `CREATE TABLE IF NOT EXISTS pos_order_payment (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    method TEXT NOT NULL,
    amount_minor INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pos_order_payment_order ON pos_order_payment(order_id)`,
  `CREATE TABLE IF NOT EXISTS pos_cash_movement (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
    reason TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT NOT NULL,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pos_cash_movement_session ON pos_cash_movement(session_id)`,
]

/** Columns the v6 migration adds to tables a v4 cache already has. */
export const SALES_SIDE_ALTERS: readonly string[] = [
  // The list a customer buys on (customers.price_list_id on the server).
  `ALTER TABLE customer ADD COLUMN price_list_id TEXT`,
  // The drawer a payment went into, and what moved in the drawer's own minor units
  // (payments.pos_session_id / till_amount_minor on the server).
  `ALTER TABLE payment ADD COLUMN pos_session_id TEXT`,
  `ALTER TABLE payment ADD COLUMN till_amount_minor INTEGER`,
]
