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

/**
 * What the shop kept on a return, one row per reason (v10). The same table, columns and meaning as
 * `invoice_return_deductions` on the server — the device records them, it does not re-derive them.
 * (Declared BEFORE `UNIVERSAL_CORE_STATEMENTS`, which spreads it at module load.)
 */
export const RETURN_DEDUCTIONS_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS invoice_return_deductions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    return_id TEXT NOT NULL,
    reason_code TEXT NOT NULL,
    mode TEXT NOT NULL,
    percent REAL,
    amount_minor INTEGER NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_return_deductions_return ON invoice_return_deductions(workspace_id, return_id)`,
]

export const PACKAGE_CREDIT_LEDGER_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS package_credit_ledger (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    customer_id TEXT NOT NULL,
    package_product_id TEXT NOT NULL,
    entry_type TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    unit TEXT,
    source_document_type TEXT,
    source_document_id TEXT,
    source_line_id TEXT,
    reference_entry_id TEXT,
    idempotency_key TEXT,
    notes TEXT,
    expires_at TEXT,
    effective_date TEXT NOT NULL,
    deferred_amount REAL,
    term_months INTEGER,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pkg_credit_customer ON package_credit_ledger(workspace_id, customer_id, package_product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pkg_credit_idempotency ON package_credit_ledger(workspace_id, idempotency_key)`,
  `CREATE INDEX IF NOT EXISTS idx_pkg_credit_ref ON package_credit_ledger(workspace_id, reference_entry_id)`,
  // One consume and one reversal per service session: the ledger itself refuses a second.
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_pkg_credit_service_consume ON package_credit_ledger(workspace_id, source_document_id) WHERE source_document_type = 'service_delivery' AND entry_type = 'CONSUME' AND deleted_at IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_pkg_credit_service_reversal ON package_credit_ledger(workspace_id, source_document_id) WHERE source_document_type = 'service_delivery' AND entry_type = 'REVERSAL' AND deleted_at IS NULL`,
]

/**
 * v17 (M5): the tables the allocation rule needs on the device. Same shape as the server's
 * package_credit_allocations / package_credit_suspensions (docs/package-deferred-revenue-01-migration.sql); append-only by
 * convention here (no route updates or deletes them). Not synced: the server derives its own from the same rule.
 */
export const PACKAGE_ALLOCATION_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS package_credit_allocations (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    entry_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    grant_entry_id TEXT,
    quantity REAL NOT NULL,
    released_amount REAL NOT NULL DEFAULT 0,
    effective_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_pkg_alloc_entry_grant ON package_credit_allocations(entry_id, COALESCE(grant_entry_id, ''))`,
  `CREATE INDEX IF NOT EXISTS idx_pkg_alloc_grant ON package_credit_allocations(workspace_id, grant_entry_id)`,
  `CREATE TABLE IF NOT EXISTS package_credit_suspensions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    grant_entry_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    effective_on TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pkg_susp_grant ON package_credit_suspensions(workspace_id, grant_entry_id)`,
]

/** v17 on an existing v16 cache: the GRANT remembers its deferred amount and term; a package product has a term. */
export const PACKAGE_DEFERRED_REVENUE_ALTERS: readonly string[] = [
  `ALTER TABLE package_credit_ledger ADD COLUMN deferred_amount REAL`,
  `ALTER TABLE package_credit_ledger ADD COLUMN term_months INTEGER`,
  `ALTER TABLE product ADD COLUMN package_term_months INTEGER`,
  ...PACKAGE_ALLOCATION_STATEMENTS,
]

export const SERVICE_DELIVERY_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS service_delivery_sessions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    customer_id TEXT NOT NULL,
    service_offering_id TEXT NOT NULL,
    practitioner_id TEXT,
    branch_id TEXT,
    session_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    settlement_method TEXT NOT NULL,
    package_credit_id TEXT,
    invoice_id TEXT,
    settlement_reason TEXT,
    cancellation_reason TEXT,
    client_notes TEXT,
    internal_notes TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_service_delivery_workspace_date ON service_delivery_sessions(workspace_id, session_date)`,
  `CREATE INDEX IF NOT EXISTS idx_service_delivery_customer ON service_delivery_sessions(workspace_id, customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_service_delivery_practitioner ON service_delivery_sessions(workspace_id, practitioner_id)`,
]

/** v15 on an existing v14 cache: the reason a free session was free, and the one-consume-per-session guard. */
export const SERVICE_DELIVERY_AUDIT_ALTERS: readonly string[] = [
  `ALTER TABLE service_delivery_sessions ADD COLUMN settlement_reason TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_pkg_credit_service_consume ON package_credit_ledger(workspace_id, source_document_id) WHERE source_document_type = 'service_delivery' AND entry_type = 'CONSUME' AND deleted_at IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_pkg_credit_service_reversal ON package_credit_ledger(workspace_id, source_document_id) WHERE source_document_type = 'service_delivery' AND entry_type = 'REVERSAL' AND deleted_at IS NULL`,
]

/** v16 on an existing v15 cache: why a service session was cancelled. */
export const SERVICE_CANCELLATION_REASON_ALTERS: readonly string[] = [
  `ALTER TABLE service_delivery_sessions ADD COLUMN cancellation_reason TEXT`,
]

/**
 * The two tables a deposit movement is recorded in on the device (v18).
 *
 * ⚠️ A MOVEMENT HERE IS A REQUEST, NOT A SETTLEMENT.
 *
 * Applying or refunding a deposit is ONE transaction on the server: it reads
 * the remaining balance under a row lock, then writes the payment, the
 * allocation, the ledger entry and the audit row together
 * (docs/order-deposit-apply-refund-01-migration.sql). A device cannot hold that
 * lock, so it does not pretend to settle anything: it records WHAT was asked
 * for — with the same idempotency key the server deduplicates on — and queues
 * it. `sync_status` stays 'pending' until the server answers; only then do
 * `payment_id` and `journal_entry_id` mean anything.
 *
 * Declared BEFORE `UNIVERSAL_CORE_STATEMENTS`, which spreads it at module load.
 */
export const ORDER_DEPOSIT_MOVEMENT_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS order_deposit_applications (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    deposit_id TEXT NOT NULL,
    invoice_id TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    payment_id TEXT,
    journal_entry_id TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    last_error TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  // A retry with the same key finds its own row — the request is not queued twice.
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_order_deposit_applications_key
     ON order_deposit_applications(workspace_id, deposit_id, idempotency_key)`,
  `CREATE INDEX IF NOT EXISTS idx_order_deposit_applications_deposit
     ON order_deposit_applications(workspace_id, deposit_id)`,

  `CREATE TABLE IF NOT EXISTS order_deposit_refunds (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    deposit_id TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'cash',
    -- WHY the money went back: the same 3..500 rule the server's column enforces.
    reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 500),
    idempotency_key TEXT NOT NULL,
    payment_id TEXT,
    journal_entry_id TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    last_error TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_order_deposit_refunds_key
     ON order_deposit_refunds(workspace_id, deposit_id, idempotency_key)`,
  `CREATE INDEX IF NOT EXISTS idx_order_deposit_refunds_deposit
     ON order_deposit_refunds(workspace_id, deposit_id)`,
]

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
    deduction_minor INTEGER NOT NULL DEFAULT 0,
    reason_code TEXT,
    notes TEXT,
    client_request_id TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_invoice_returns_orig ON invoice_returns(workspace_id, original_invoice_id)`,
  ...RETURN_DEDUCTIONS_STATEMENTS,

  `CREATE TABLE IF NOT EXISTS invoice_return_lines (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    return_id TEXT NOT NULL,
    original_line_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity REAL NOT NULL,
    restock_choice TEXT NOT NULL,
    reason_code TEXT NOT NULL,
    condition_code TEXT,
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

  // ─── 7. Order Deposits (v9, money columns v18) ──────────────
  //
  // `currency`, `posting_status` and `journal_entry_id` arrived with v18, the
  // same three the server added for apply/refund. A deposit whose currency is
  // NULL is UNKNOWN (a row older than the column) and cannot be applied or
  // refunded: guessing the books currency would turn 100 dollars into 100
  // afghani.
  `CREATE TABLE IF NOT EXISTS order_deposits (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    order_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    currency TEXT,
    posting_status TEXT,
    journal_entry_id TEXT,
    applied_invoice_id TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_order_deposits_order ON order_deposits(workspace_id, order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_order_deposits_customer ON order_deposits(workspace_id, customer_id)`,

  // ─── 7b. Deposit movements (v18) ────────────────────────────
  ...ORDER_DEPOSIT_MOVEMENT_STATEMENTS,

  // ─── 8. Package Credit & Entitlement Ledger (v13) ────────────
  ...PACKAGE_CREDIT_LEDGER_STATEMENTS,

  // ─── 9. Service Delivery & Attendance (v14) ───────────────────
  ...SERVICE_DELIVERY_STATEMENTS,

  // ─── 10. Package term, deferred revenue and allocation (v17) ───
  ...PACKAGE_ALLOCATION_STATEMENTS,
]

/** v10 on an existing v9 cache: the same columns a fresh cache is born with. */
export const RETURNS_CORE_ALTERS: readonly string[] = [
  `ALTER TABLE invoice_returns ADD COLUMN deduction_minor INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE invoice_returns ADD COLUMN reason_code TEXT`,
  `ALTER TABLE invoice_returns ADD COLUMN notes TEXT`,
  `ALTER TABLE invoice_returns ADD COLUMN client_request_id TEXT`,
  `ALTER TABLE invoice_return_lines ADD COLUMN condition_code TEXT`,
]

export const UNIVERSAL_CORE_ALTERS: readonly string[] = [
  `ALTER TABLE local_workspace ADD COLUMN credit_limit_mode TEXT NOT NULL DEFAULT 'warn'`,
]

/**
 * v18 — the money columns of a deposit, on a cache that already has the table.
 *
 * The same three columns the server added for apply/refund, plus the two
 * movement tables. A deposit written before this version keeps
 * `currency = NULL`, which every reader treats as UNKNOWN: the move is refused
 * rather than guessed.
 */
export const ORDER_DEPOSIT_ALTERS: readonly string[] = [
  // A cache that never ran the made-to-order module has no deposit table at
  // all; without this the three ALTERs below fail with `no such table` and the
  // upgrade stops half way. The shape here is the PRE-v18 one, so the ALTERs
  // still have something to add; on a cache that already has the table this is
  // a no-op.
  `CREATE TABLE IF NOT EXISTS order_deposits (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    order_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    applied_invoice_id TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `ALTER TABLE order_deposits ADD COLUMN currency TEXT`,
  `ALTER TABLE order_deposits ADD COLUMN posting_status TEXT`,
  `ALTER TABLE order_deposits ADD COLUMN journal_entry_id TEXT`,
]
