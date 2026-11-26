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

/**
 * Who is in a session (v37, M4.5) — the device's copy of
 * `service_delivery_session_participants`. The primary person always has a row
 * here too. Declared BEFORE `SERVICE_DELIVERY_STATEMENTS`, which spreads it.
 */
export const SESSION_PARTICIPANT_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS service_delivery_session_participants (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    session_id TEXT NOT NULL,
    participant_type TEXT NOT NULL CHECK (participant_type IN ('customer', 'employee')),
    customer_id TEXT,
    employee_id TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    created_by TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only',
    CHECK (
      (participant_type = 'customer' AND customer_id IS NOT NULL AND employee_id IS NULL)
      OR
      (participant_type = 'employee' AND employee_id IS NOT NULL AND customer_id IS NULL)
    )
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_sd_participant_customer ON service_delivery_session_participants(session_id, customer_id) WHERE customer_id IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_sd_participant_employee ON service_delivery_session_participants(session_id, employee_id) WHERE employee_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_sd_participant_session ON service_delivery_session_participants(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sd_participant_customer ON service_delivery_session_participants(workspace_id, customer_id) WHERE customer_id IS NOT NULL`,
]

export const SERVICE_DELIVERY_STATEMENTS: readonly string[] = [
  // customer_id stays NOT NULL in SQLite (the column cannot be widened by
  // ALTER): an EMPLOYEE session stores '' here and every reader maps '' back
  // to null — the domain never sees a fake customer id. The server's column is
  // nullable (docs/service-delivery-05-session-subject-participants-migration.sql).
  `CREATE TABLE IF NOT EXISTS service_delivery_sessions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    customer_id TEXT NOT NULL,
    subject_type TEXT NOT NULL DEFAULT 'customer',
    employee_id TEXT,
    session_type TEXT,
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
  ...SESSION_PARTICIPANT_STATEMENTS,
  `CREATE TABLE IF NOT EXISTS service_delivery_status_audit (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    session_id TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    actor_id TEXT,
    changed_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_service_delivery_audit_session ON service_delivery_status_audit(workspace_id, session_id, changed_at DESC)`,
]

/**
 * v37 on an existing cache: the session subject, the free-text type, and the
 * participant relation — the same facts the server's service-delivery-05 adds.
 * The backfill id is derived from (session, person), so a second run converges.
 */
export const SESSION_SUBJECT_PARTICIPANT_ALTERS: readonly string[] = [
  `ALTER TABLE service_delivery_sessions ADD COLUMN subject_type TEXT NOT NULL DEFAULT 'customer'`,
  `ALTER TABLE service_delivery_sessions ADD COLUMN employee_id TEXT`,
  `ALTER TABLE service_delivery_sessions ADD COLUMN session_type TEXT`,
  ...SESSION_PARTICIPANT_STATEMENTS,
  `INSERT OR IGNORE INTO service_delivery_session_participants
     (id, workspace_id, session_id, participant_type, customer_id, created_at)
   SELECT id || ':customer:' || customer_id, workspace_id, id, 'customer', customer_id, created_at
     FROM service_delivery_sessions
    WHERE customer_id IS NOT NULL AND customer_id <> ''`,
]

export const COURIER_DELIVERY_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS courier_deliveries (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    tracking_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    destination_address TEXT NOT NULL,
    driver_employee_id TEXT,
    status TEXT NOT NULL,
    cod_amount_minor INTEGER NOT NULL DEFAULT 0,
    cod_stage TEXT NOT NULL,
    planned_on TEXT,
    vehicle_id TEXT,
    pod_method TEXT,
    pod_recipient_name TEXT,
    pod_photo_ref TEXT,
    pod_code TEXT,
    pod_recorded_at TEXT,
    pod_actor_user_id TEXT,
    delivery_timestamp TEXT,
    cod_collected_minor INTEGER,
    cod_shortfall_minor INTEGER NOT NULL DEFAULT 0,
    failure_reason TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TEXT,
    client_request_id TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_courier_deliveries_request ON courier_deliveries(workspace_id, client_request_id) WHERE client_request_id IS NOT NULL`,
]

export const DELIVERY_VEHICLE_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS delivery_vehicles (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    plate_number TEXT,
    asset_id TEXT,
    capacity_parcels INTEGER,
    active INTEGER NOT NULL DEFAULT 1,
    last_service_on TEXT,
    next_service_due_on TEXT,
    odometer_km INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_vehicles_plate ON delivery_vehicles(workspace_id, plate_number) WHERE plate_number IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_delivery_vehicles_workspace ON delivery_vehicles(workspace_id, active)`,
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

/**
 * WP-13 gap A — offline sales-order drafts.
 *
 * A draft is NOT a committed sale: no stock and no money move on the device.
 * It exists so a rep can write an order without signal; the server still
 * confirms price and availability when the draft is submitted.
 */
export const SALES_ORDER_DRAFT_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS sales_order_drafts (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    order_number TEXT,
    customer_id TEXT,
    customer_name TEXT,
    status TEXT NOT NULL DEFAULT 'quoted',
    currency TEXT NOT NULL,
    notes TEXT,
    total_minor INTEGER NOT NULL DEFAULT 0,
    client_request_id TEXT,
    submitted_at TEXT,
    server_confirmed_at TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sales_order_drafts_request ON sales_order_drafts(workspace_id, client_request_id) WHERE client_request_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_sales_order_drafts_status ON sales_order_drafts(workspace_id, status)`,
  `CREATE TABLE IF NOT EXISTS sales_order_draft_items (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    order_id TEXT NOT NULL,
    product_id TEXT,
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT,
    unit_price_minor INTEGER NOT NULL,
    total_minor INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sales_order_draft_items_order ON sales_order_draft_items(workspace_id, order_id)`,
]

export const FX_TRADE_DRAFT_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS fx_trade_drafts (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    trade_number TEXT,
    side TEXT NOT NULL CHECK (side IN ('buy','sell')),
    currency TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    rate TEXT NOT NULL,
    rate_micro TEXT NOT NULL,
    book_currency TEXT NOT NULL,
    book_amount_minor INTEGER NOT NULL,
    customer_id TEXT,
    identity_name TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'quoted',
    needs_review INTEGER NOT NULL DEFAULT 0,
    client_request_id TEXT,
    submitted_at TEXT,
    server_confirmed_at TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fx_trade_drafts_request ON fx_trade_drafts(workspace_id, client_request_id) WHERE client_request_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_fx_trade_drafts_status ON fx_trade_drafts(workspace_id, status)`,
]

/**
 * WP-17 — OFFLINE recurring contracts and billing periods.
 *
 * The device records the contract and proposes a billable period with an
 * idempotency key; the SERVER still issues the invoice. No money moves here.
 */
export const CONTRACT_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS local_contracts (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    customer_id TEXT NOT NULL,
    title TEXT NOT NULL,
    contract_type TEXT NOT NULL,
    cadence TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    amount_minor INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL,
    kyc_note TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_local_contracts_ws ON local_contracts(workspace_id, status)`,
  `CREATE TABLE IF NOT EXISTS local_contract_bills (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    contract_id TEXT NOT NULL,
    period_key TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'proposed',
    invoice_id TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    UNIQUE(workspace_id, idempotency_key)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_local_contract_bills_contract ON local_contract_bills(workspace_id, contract_id)`,
]

/**
 * WP-15 — OFFLINE project/work packages.
 *
 * A project manager records time and a milestone on the device without signal.
 * An APPROVED entry is the only one that may be billed; the server still issues
 * the invoice through the existing /api/projects/:id/bill route.
 */
export const PROJECT_TIME_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS local_projects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    customer_id TEXT,
    currency TEXT NOT NULL,
    budget_minor INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    client_request_id TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_local_projects_request ON local_projects(workspace_id, client_request_id) WHERE client_request_id IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS project_time_entries (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    project_id TEXT NOT NULL,
    hours REAL NOT NULL,
    rate_minor INTEGER NOT NULL,
    billable INTEGER NOT NULL DEFAULT 1,
    approved INTEGER NOT NULL DEFAULT 0,
    work_date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_project_time_entries_project ON project_time_entries(workspace_id, project_id)`,
  `CREATE TABLE IF NOT EXISTS project_milestones (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    required_hours REAL NOT NULL DEFAULT 0,
    amount_minor INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'planned',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON project_milestones(workspace_id, project_id)`,
]

/**
 * WP-04 — OFFLINE roll identity, cutting, waste and return.
 *
 * A roll is a stock batch measured in meters. The device records every cut and
 * return against the SAME roll; the shared rule decides the split into
 * sellable length and waste. Writes carry a client_request_id so a repeated
 * sync cannot consume the same length twice.
 */
export const ROLL_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS local_rolls (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    roll_number TEXT NOT NULL,
    initial_length REAL NOT NULL,
    remaining_length REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'm',
    location TEXT,
    cost_minor INTEGER NOT NULL DEFAULT 0,
    custom_conversion_factor REAL,
    client_request_id TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_local_rolls_request ON local_rolls(workspace_id, client_request_id) WHERE client_request_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_local_rolls_workspace ON local_rolls(workspace_id)`,
  `CREATE TABLE IF NOT EXISTS roll_movements (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    roll_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    length REAL NOT NULL,
    waste_length REAL NOT NULL DEFAULT 0,
    client_request_id TEXT,
    created_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_roll_movements_request ON roll_movements(workspace_id, client_request_id) WHERE client_request_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_roll_movements_roll ON roll_movements(workspace_id, roll_id)`,
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
    customer_id TEXT,
    supplier_id TEXT,
    -- The kind of deposit (v39): a customer's order deposit, a booking deposit,
    -- or a supplier advance. Without it a pulled pre_purchase row looked like a
    -- plain sales deposit with no customer, and the customer screen then offered
    -- it to a walk-in invoice (null = null).
    source_type TEXT NOT NULL DEFAULT 'sales_order',
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

  // ─── 10. Courier Deliveries & Fleet (WP-19) ────────────────────
  ...COURIER_DELIVERY_STATEMENTS,

  // ─── 10b. Delivery Vehicles (WP-19 Fleet) ──────────────────────
  ...DELIVERY_VEHICLE_STATEMENTS,

  // ─── 11. Package term, deferred revenue and allocation (v17) ───
  ...PACKAGE_ALLOCATION_STATEMENTS,

  // ─── 12. Offline sales-order drafts (WP-13) ───────────────────
  ...SALES_ORDER_DRAFT_STATEMENTS,

  // ─── 13. Offline project time and milestones (WP-15) ───────────
  ...PROJECT_TIME_STATEMENTS,

  // ─── 14. Offline roll cutting (WP-04) ───────────────────────────
  ...ROLL_STATEMENTS,

  // ─── 15. Offline FX trade drafts (WP-07) ────────────────────────
  ...FX_TRADE_DRAFT_STATEMENTS,

  // ─── 16. Offline recurring contracts (WP-17) ────────────────────
  ...CONTRACT_STATEMENTS,
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
    customer_id TEXT,
    supplier_id TEXT,
    -- The kind of deposit (v39): a customer's order deposit, a booking deposit,
    -- or a supplier advance. Without it a pulled pre_purchase row looked like a
    -- plain sales deposit with no customer, and the customer screen then offered
    -- it to a walk-in invoice (null = null).
    source_type TEXT NOT NULL DEFAULT 'sales_order',
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

// ─── 5. Unit-serial tracking (v21, V55 P2) ──────────────────────────────────
//
// The device's copy of the server's `stock_serials` (docs/SETUP-COMPLETE.sql).
// A phone shop offline sells THIS unit: the rows carry the IMEI, what that
// unit cost, and — once sold — WHICH invoice took it. Its own export (NOT
// spread into UNIVERSAL_CORE_STATEMENTS): the base schema creates it for new
// devices and v21 creates it for caches that already exist.
export const SERIALS_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS stock_serials (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    product_id TEXT NOT NULL,
    serial_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_stock'
      CHECK (status IN ('in_stock', 'sold', 'returned', 'scrapped')),
    batch_id TEXT,
    cost_layer_id TEXT,
    unit_cost_minor INTEGER NOT NULL DEFAULT 0,
    warehouse_id TEXT,
    received_on TEXT NOT NULL,
    invoice_id TEXT,
    sold_on TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_serials_number
     ON stock_serials(workspace_id, product_id, serial_number)`,
  `CREATE INDEX IF NOT EXISTS idx_stock_serials_status
     ON stock_serials(workspace_id, product_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_stock_serials_invoice
     ON stock_serials(invoice_id) WHERE invoice_id IS NOT NULL`,
]

// ─── 6. Expiry batches (v22, V55 final completion) ──────────────────────────
//
// The device's copy of the server's `stock_batches` + `lot_allocations`
// (docs/SETUP-COMPLETE.sql). A pharmacy offline sells FROM the batch whose
// expiry comes first: the rows carry the batch number, the expiry, what
// remains, and — once sold — WHICH invoice took how much. Column-for-column
// the server's tables with TEXT ids and the sync columns every local table
// carries. Its own export (NOT spread into UNIVERSAL_CORE_STATEMENTS): the
// base schema creates both for new devices and v22 creates them for caches
// that already exist.
export const BATCHES_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS stock_batches (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    product_id TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    -- NULL means this batch does not expire. Distinct from a far-future date:
    -- one is a fact about the goods, the other is a guess somebody typed.
    expiry_date TEXT,
    manufactured_date TEXT,
    received_qty REAL NOT NULL,
    remaining_qty REAL NOT NULL,
    cost_layer_id TEXT,
    warehouse_id TEXT,
    received_on TEXT NOT NULL,
    -- WP-05: a recalled / failed carton keeps its quantity and loses its
    -- sellability. The shared allocation core refuses it on both sides.
    recalled_at TEXT,
    recalled_reason TEXT,
    recalled_by TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only',
    -- What the server's CHECK constraint keeps: what remains can be neither
    -- negative nor more than what arrived.
    CHECK (received_qty > 0 AND remaining_qty >= 0 AND remaining_qty <= received_qty)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_batches_number
     ON stock_batches(workspace_id, product_id, batch_number)`,
  // The FEFO queue: open batches for one product, soonest expiry first. Nulls
  // last, because a batch that does not expire is the one that can wait.
  `CREATE INDEX IF NOT EXISTS idx_stock_batches_fefo
     ON stock_batches(workspace_id, product_id, expiry_date, received_on)
     WHERE remaining_qty > 0`,
  `CREATE INDEX IF NOT EXISTS idx_stock_batches_warehouse
     ON stock_batches(workspace_id, product_id, warehouse_id)`,

  `CREATE TABLE IF NOT EXISTS lot_allocations (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    consumer_type TEXT NOT NULL,
    consumer_id TEXT NOT NULL,
    consumer_line TEXT,
    product_id TEXT NOT NULL,
    batch_id TEXT,
    serial_id TEXT,
    quantity REAL NOT NULL,
    entry_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only',
    -- Exactly one of the two: a row names a batch or a serial, never both and
    -- never neither.
    CHECK (
      (batch_id IS NOT NULL AND serial_id IS NULL) OR
      (batch_id IS NULL AND serial_id IS NOT NULL)
    )
  )`,
  `CREATE INDEX IF NOT EXISTS idx_lot_allocations_consumer
     ON lot_allocations(workspace_id, consumer_type, consumer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_lot_allocations_batch
     ON lot_allocations(workspace_id, batch_id)`,
]

export const REPAIR_TICKETS_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS repair_tickets (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    number INTEGER NOT NULL DEFAULT 0,
    customer_id TEXT NOT NULL,
    serial_id TEXT,
    device_label TEXT NOT NULL,
    problem TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received'
      CHECK (status IN ('received', 'diagnosing', 'waiting_parts', 'repairing', 'ready', 'delivered', 'cancelled')),
    under_warranty INTEGER NOT NULL DEFAULT 0,
    customer_approved INTEGER NOT NULL DEFAULT 0,
    estimate_minor INTEGER,
    currency TEXT,
    technician_employee_id TEXT,
    promised_on TEXT,
    invoice_id TEXT,
    created_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    closed_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_repair_tickets_workspace_status ON repair_tickets(workspace_id, status, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS repair_ticket_events (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    ticket_id TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    note TEXT,
    actor_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_repair_ticket_events_ticket ON repair_ticket_events(ticket_id, created_at)`,
]

// ─── 8. Extended Local Ops (v40, X10 + Offline Assets / Agriculture / BOM / Approvals) ───
export const EXTENDED_LOCAL_OPS_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS local_payment_gateway_states (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    payment_id TEXT NOT NULL,
    processor_state TEXT NOT NULL
      CHECK (processor_state IN ('queued_offline', 'pending_capture', 'captured', 'declined', 'voided')),
    gateway_name TEXT,
    external_ref TEXT,
    fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
    currency TEXT NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_local_proc_state_payment
    ON local_payment_gateway_states(workspace_id, payment_id)`,
  `CREATE TABLE IF NOT EXISTS local_assets (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    cost_minor INTEGER NOT NULL CHECK (cost_minor > 0),
    salvage_minor INTEGER NOT NULL DEFAULT 0 CHECK (salvage_minor >= 0),
    method TEXT NOT NULL CHECK (method IN ('straight_line', 'declining', 'declining_then_straight')),
    periods INTEGER NOT NULL CHECK (periods >= 1),
    period_months INTEGER NOT NULL DEFAULT 1,
    first_period_on TEXT NOT NULL,
    acquired_on TEXT NOT NULL,
    currency TEXT NOT NULL,
    disposed_on TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_local_assets_ws ON local_assets(workspace_id, acquired_on DESC)`,
  `CREATE TABLE IF NOT EXISTS local_crop_cycles (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    land_unit_id TEXT NOT NULL,
    crop_name TEXT NOT NULL,
    planting_date TEXT NOT NULL,
    expected_harvest_date TEXT,
    status TEXT NOT NULL DEFAULT 'planted',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_local_crop_cycles_ws ON local_crop_cycles(workspace_id, planting_date DESC)`,
  `CREATE TABLE IF NOT EXISTS local_livestock_groups (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    head_count INTEGER NOT NULL CHECK (head_count >= 0),
    birth_or_acquisition_date TEXT NOT NULL,
    location_barn TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_local_livestock_ws ON local_livestock_groups(workspace_id, category)`,
  `CREATE TABLE IF NOT EXISTS local_manufacturing_defs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    product_id TEXT NOT NULL,
    definition_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_local_mfg_def ON local_manufacturing_defs(workspace_id, product_id)`,
  `CREATE TABLE IF NOT EXISTS local_approval_queue (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    document_type TEXT NOT NULL,
    document_id TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_offline'
      CHECK (status IN ('pending_offline', 'approved_offline', 'rejected_offline')),
    note TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    origin TEXT NOT NULL DEFAULT 'local',
    sync_state TEXT NOT NULL DEFAULT 'local_only'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_local_approval_queue_ws ON local_approval_queue(workspace_id, status)`,
]

// ─── 9. Append-only Payment Gateway Event Trail (v41, X10) ───
export const PAYMENT_GATEWAY_EVENTS_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS local_payment_gateway_events (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    payment_id TEXT NOT NULL,
    from_state TEXT,
    to_state TEXT NOT NULL
      CHECK (to_state IN ('queued_offline', 'pending_capture', 'captured', 'declined', 'voided')),
    gateway_name TEXT,
    external_ref TEXT,
    fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
    signature_verified INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_local_pg_events_ws_pay
    ON local_payment_gateway_events(workspace_id, payment_id, created_at ASC)`,
]

// ─── 10. Local Personal Invoice Drafts (v42, CORE 01 parity) ──
export const INVOICE_DRAFTS_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS local_invoice_drafts (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT '',
    user_id TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'sale',
    title TEXT NOT NULL DEFAULT '',
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_local_invoice_drafts_ws_user
    ON local_invoice_drafts(workspace_id, user_id, updated_at DESC)`,
]
