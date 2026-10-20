# Phase 3 — Device Schema v3 (Windows + Android)

> Offline Edition, phase 3 of 10.
> Role: Agent A (Lead / Domain)
> References:
>
> - `docs/offline/01-CAPABILITY-MATRIX.md` (§5.2 owner decisions)
> - `docs/offline/02-RULE-EXTRACTION.md`
> - `packages/app-bridge/src/local-schema.ts` (current SCHEMA_VERSION = 2)

---

## 1. Column List Review against Server Rows

Every table required for local operations (L and L* capability rows from `01-CAPABILITY-MATRIX.md`) is specified below.
Column names and semantics match the server tables (`*_COLUMNS` constants in `backend/src/services/**`), adapted to SQLite types and the offline financial rules.

### 1.1 Universal Tenancy and Sync Columns

Every local entity table carries:

1. `id TEXT PRIMARY KEY`: UUID v4 text.
2. `workspace_id TEXT NOT NULL`: Tenancy security boundary (Rule 1 of AGENTS.md).
3. `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
4. `updated_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
5. `deleted_at TEXT`: ISO 8601 UTC timestamp (soft delete; `NULL` = active).
6. `origin TEXT NOT NULL DEFAULT 'local'`: `'local' | 'cloud'`.
7. `sync_state TEXT NOT NULL DEFAULT 'local_only'`: `'local_only' | 'pending' | 'synced' | 'conflict'`.

### 1.2 Data Types & Scales

- **Money columns**: `INTEGER NOT NULL DEFAULT 0` (minor units — cents, pols, dinars; no floats on money path, AGENTS.md §1.3 and Phase 1 F1-02).
- **Quantities**: `TEXT NOT NULL DEFAULT '0'` (exact decimal representation, scale 4, matching server `numeric(18, 4)` and avoiding IEEE-754 binary floating-point drift).
- **Rates**: `REAL NOT NULL DEFAULT 1.0` or `TEXT NOT NULL DEFAULT '1.0'`.
- **Booleans / Flags**: `INTEGER NOT NULL DEFAULT 0` (0 = false, 1 = true).

---

## 2. Table Specifications

### 2.1 Identity & Setup

- `local_user`:
  - `id TEXT PRIMARY KEY`
  - `email TEXT`
  - `full_name TEXT NOT NULL`
  - `phone TEXT`
  - `role TEXT NOT NULL DEFAULT 'owner'`
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`

- `local_workspace`:
  - `id TEXT PRIMARY KEY`
  - `name TEXT NOT NULL`
  - `base_currency TEXT NOT NULL` (no hardcoded AFN; user-specified on first run)
  - `time_zone TEXT NOT NULL DEFAULT 'Asia/Kabul'`
  - `logo_url TEXT`
  - `stamp_url TEXT`
  - `signature_url TEXT`
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`

- `invoice_counter`:
  - `workspace_id TEXT NOT NULL`
  - `prefix TEXT NOT NULL`
  - `next INTEGER NOT NULL DEFAULT 1`
  - `updated_at TEXT NOT NULL`
  - `PRIMARY KEY (workspace_id, prefix)`

### 2.2 Core Catalog & Contacts (Augmented from v2)

- `product`:
  - `id TEXT PRIMARY KEY`
  - `workspace_id TEXT NOT NULL DEFAULT ''`
  - `name TEXT NOT NULL`
  - `barcode TEXT`
  - `sku TEXT`
  - `category TEXT`
  - `quantity TEXT NOT NULL DEFAULT '0'` (TEXT decimal)
  - `unit TEXT`
  - `min_stock_level TEXT NOT NULL DEFAULT '0'`
  - `buy_price INTEGER NOT NULL DEFAULT 0` (integer minor units)
  - `sell_price INTEGER NOT NULL DEFAULT 0` (integer minor units)
  - `wholesale_price INTEGER DEFAULT 0` (integer minor units)
  - `is_active INTEGER NOT NULL DEFAULT 1`
  - `image_url TEXT`
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`
  - `deleted_at TEXT`
  - `origin TEXT NOT NULL DEFAULT 'local'`
  - `sync_state TEXT NOT NULL DEFAULT 'local_only'`
  - `dirty INTEGER NOT NULL DEFAULT 0`
  - `version INTEGER NOT NULL DEFAULT 1`

- `customer`:
  - `id TEXT PRIMARY KEY`
  - `workspace_id TEXT NOT NULL DEFAULT ''`
  - `full_name TEXT NOT NULL`
  - `phone TEXT`
  - `email TEXT`
  - `address TEXT`
  - `notes TEXT`
  - `opening_balance INTEGER NOT NULL DEFAULT 0` (integer minor units)
  - `type TEXT`
  - `declared_role TEXT`
  - `is_active INTEGER NOT NULL DEFAULT 1`
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`
  - `deleted_at TEXT`
  - `origin TEXT NOT NULL DEFAULT 'local'`
  - `sync_state TEXT NOT NULL DEFAULT 'local_only'`
  - `dirty INTEGER NOT NULL DEFAULT 0`
  - `version INTEGER NOT NULL DEFAULT 1`

### 2.3 Invoicing & Lines (Augmented from v2)

- `invoice`:
  - `id TEXT PRIMARY KEY`
  - `workspace_id TEXT NOT NULL DEFAULT ''`
  - `invoice_number TEXT`
  - `external_number TEXT`
  - `type TEXT NOT NULL DEFAULT 'sale'` ('sale' | 'purchase')
  - `customer_id TEXT`
  - `customer_name TEXT`
  - `supplier_id TEXT`
  - `branch_id TEXT`
  - `date TEXT NOT NULL`
  - `due_date TEXT`
  - `subtotal INTEGER NOT NULL DEFAULT 0` (minor units)
  - `discount_total INTEGER NOT NULL DEFAULT 0` (minor units)
  - `tax_total INTEGER NOT NULL DEFAULT 0` (minor units)
  - `total INTEGER NOT NULL DEFAULT 0` (minor units)
  - `paid_amount INTEGER NOT NULL DEFAULT 0` (minor units)
  - `currency TEXT NOT NULL` (no default 'AFN'!)
  - `exchange_rate REAL NOT NULL DEFAULT 1.0`
  - `payment_method TEXT`
  - `status TEXT NOT NULL DEFAULT 'pending'`
  - `notes TEXT`
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`
  - `deleted_at TEXT`
  - `origin TEXT NOT NULL DEFAULT 'local'`
  - `sync_state TEXT NOT NULL DEFAULT 'local_only'`
  - `dirty INTEGER NOT NULL DEFAULT 0`
  - `version INTEGER NOT NULL DEFAULT 1`

- `invoice_item`:
  - `id TEXT PRIMARY KEY`
  - `workspace_id TEXT NOT NULL DEFAULT ''`
  - `invoice_id TEXT NOT NULL`
  - `product_id TEXT`
  - `product_name TEXT NOT NULL`
  - `quantity TEXT NOT NULL DEFAULT '0'` (TEXT decimal)
  - `unit TEXT`
  - `unit_label TEXT`
  - `weight_grams REAL DEFAULT 0`
  - `unit_price INTEGER NOT NULL DEFAULT 0` (minor units)
  - `buy_price INTEGER NOT NULL DEFAULT 0` (minor units)
  - `discount INTEGER NOT NULL DEFAULT 0` (minor units)
  - `total_price INTEGER NOT NULL DEFAULT 0` (minor units)
  - `notes TEXT`
  - `sort_order INTEGER NOT NULL DEFAULT 0`
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`
  - `deleted_at TEXT`
  - `origin TEXT NOT NULL DEFAULT 'local'`
  - `sync_state TEXT NOT NULL DEFAULT 'local_only'`
  - `dirty INTEGER NOT NULL DEFAULT 0`
  - `version INTEGER NOT NULL DEFAULT 1`

### 2.4 Warehouses, Stock & Locations

- `warehouse`:
  - `id TEXT PRIMARY KEY`
  - `workspace_id TEXT NOT NULL`
  - `name TEXT NOT NULL`
  - `location TEXT NOT NULL DEFAULT ''`
  - `branch_id TEXT`
  - `is_active INTEGER NOT NULL DEFAULT 1`
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`
  - `deleted_at TEXT`
  - `origin TEXT NOT NULL DEFAULT 'local'`
  - `sync_state TEXT NOT NULL DEFAULT 'local_only'`

- `product_stock`:
  - `id TEXT PRIMARY KEY`
  - `workspace_id TEXT NOT NULL`
  - `product_id TEXT NOT NULL`
  - `warehouse_id TEXT NOT NULL`
  - `qty TEXT NOT NULL DEFAULT '0'` (TEXT decimal)
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`
  - `deleted_at TEXT`
  - `origin TEXT NOT NULL DEFAULT 'local'`
  - `sync_state TEXT NOT NULL DEFAULT 'local_only'`

- `branch`:
  - `id TEXT PRIMARY KEY`
  - `workspace_id TEXT NOT NULL`
  - `code TEXT NOT NULL`
  - `name TEXT NOT NULL`
  - `parent_branch_id TEXT`
  - `is_active INTEGER NOT NULL DEFAULT 1`
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`
  - `deleted_at TEXT`
  - `origin TEXT NOT NULL DEFAULT 'local'`
  - `sync_state TEXT NOT NULL DEFAULT 'local_only'`

- `shelf`:
  - `id TEXT PRIMARY KEY`
  - `workspace_id TEXT NOT NULL`
  - `warehouse_id TEXT NOT NULL`
  - `code TEXT NOT NULL`
  - `name TEXT`
  - `kind TEXT NOT NULL DEFAULT 'bin'` ('zone' | 'aisle' | 'rack' | 'shelf' | 'bin')
  - `parent_id TEXT`
  - `position_x REAL NOT NULL DEFAULT 0`
  - `position_y REAL NOT NULL DEFAULT 0`
  - `width REAL NOT NULL DEFAULT 1`
  - `height REAL NOT NULL DEFAULT 1`
  - `capacity TEXT`
  - `is_active INTEGER NOT NULL DEFAULT 1`
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`
  - `deleted_at TEXT`
  - `origin TEXT NOT NULL DEFAULT 'local'`
  - `sync_state TEXT NOT NULL DEFAULT 'local_only'`

### 2.5 Costing Engine

- `cost_layer`:
  - `id TEXT PRIMARY KEY`
  - `workspace_id TEXT NOT NULL`
  - `product_id TEXT NOT NULL`
  - `warehouse_id TEXT`
  - `source_type TEXT NOT NULL`
  - `source_id TEXT`
  - `source_line TEXT`
  - `received_qty TEXT NOT NULL`
  - `remaining_qty TEXT NOT NULL`
  - `unit_cost INTEGER NOT NULL DEFAULT 0` (minor units)
  - `currency TEXT NOT NULL`
  - `entry_date TEXT NOT NULL`
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`
  - `deleted_at TEXT`
  - `origin TEXT NOT NULL DEFAULT 'local'`
  - `sync_state TEXT NOT NULL DEFAULT 'local_only'`

- `cost_consumption`:
  - `id TEXT PRIMARY KEY`
  - `workspace_id TEXT NOT NULL`
  - `layer_id TEXT`
  - `product_id TEXT NOT NULL`
  - `warehouse_id TEXT`
  - `consumer_type TEXT NOT NULL`
  - `consumer_id TEXT`
  - `consumer_line TEXT`
  - `quantity TEXT NOT NULL`
  - `unit_cost INTEGER NOT NULL DEFAULT 0` (minor units)
  - `currency TEXT NOT NULL`
  - `is_shortfall INTEGER NOT NULL DEFAULT 0`
  - `entry_date TEXT NOT NULL`
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`
  - `deleted_at TEXT`
  - `origin TEXT NOT NULL DEFAULT 'local'`
  - `sync_state TEXT NOT NULL DEFAULT 'local_only'`

### 2.6 Payments & Allocations

- `payment`:
  - `id TEXT PRIMARY KEY`
  - `workspace_id TEXT NOT NULL`
  - `payment_number TEXT`
  - `direction TEXT NOT NULL` ('in' | 'out')
  - `party_type TEXT NOT NULL` ('customer' | 'supplier')
  - `party_id TEXT`
  - `amount INTEGER NOT NULL` (minor units)
  - `currency TEXT NOT NULL`
  - `method TEXT NOT NULL DEFAULT 'cash'`
  - `entry_date TEXT NOT NULL`
  - `reference TEXT NOT NULL DEFAULT ''`
  - `notes TEXT NOT NULL DEFAULT ''`
  - `status TEXT NOT NULL DEFAULT 'posted'`
  - `journal_entry_id TEXT`
  - `branch_id TEXT`
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`
  - `deleted_at TEXT`
  - `origin TEXT NOT NULL DEFAULT 'local'`
  - `sync_state TEXT NOT NULL DEFAULT 'local_only'`

- `payment_allocation`:
  - `id TEXT PRIMARY KEY`
  - `workspace_id TEXT NOT NULL`
  - `payment_id TEXT NOT NULL`
  - `invoice_id TEXT NOT NULL`
  - `amount INTEGER NOT NULL` (minor units)
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`
  - `deleted_at TEXT`
  - `origin TEXT NOT NULL DEFAULT 'local'`
  - `sync_state TEXT NOT NULL DEFAULT 'local_only'`

### 2.7 Ledger & Accounting

- `account`:
  - `id TEXT PRIMARY KEY`
  - `workspace_id TEXT NOT NULL`
  - `code TEXT NOT NULL`
  - `name TEXT NOT NULL`
  - `type TEXT NOT NULL` ('asset' | 'liability' | 'equity' | 'revenue' | 'expense')
  - `role TEXT`
  - `parent_id TEXT`
  - `is_group INTEGER NOT NULL DEFAULT 0`
  - `is_active INTEGER NOT NULL DEFAULT 1`
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`
  - `deleted_at TEXT`
  - `origin TEXT NOT NULL DEFAULT 'local'`
  - `sync_state TEXT NOT NULL DEFAULT 'local_only'`

- `journal_entry`:
  - `id TEXT PRIMARY KEY`
  - `workspace_id TEXT NOT NULL`
  - `entry_number TEXT`
  - `date TEXT NOT NULL`
  - `description TEXT NOT NULL DEFAULT ''`
  - `reference TEXT NOT NULL DEFAULT ''`
  - `status TEXT NOT NULL DEFAULT 'draft'` ('draft' | 'posted' | 'reversed' | 'cancelled')
  - `source_type TEXT`
  - `source_id TEXT`
  - `reversal_of TEXT`
  - `posted_at TEXT`
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`
  - `deleted_at TEXT`
  - `origin TEXT NOT NULL DEFAULT 'local'`
  - `sync_state TEXT NOT NULL DEFAULT 'local_only'`

- `journal_line`:
  - `id TEXT PRIMARY KEY`
  - `workspace_id TEXT NOT NULL`
  - `journal_id TEXT NOT NULL`
  - `account_id TEXT NOT NULL`
  - `debit INTEGER NOT NULL DEFAULT 0` (minor units)
  - `credit INTEGER NOT NULL DEFAULT 0` (minor units)
  - `description TEXT`
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`
  - `deleted_at TEXT`
  - `origin TEXT NOT NULL DEFAULT 'local'`
  - `sync_state TEXT NOT NULL DEFAULT 'local_only'`
  - `CONSTRAINT chk_journal_line_debit_credit CHECK (debit >= 0 AND credit >= 0 AND NOT (debit > 0 AND credit > 0))`

### 2.8 Currency & Exchange Rates

- `exchange_rate`:
  - `id TEXT PRIMARY KEY`
  - `workspace_id TEXT NOT NULL`
  - `currency_code TEXT NOT NULL`
  - `rate REAL NOT NULL`
  - `rate_date TEXT NOT NULL`
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`
  - `deleted_at TEXT`
  - `origin TEXT NOT NULL DEFAULT 'local'`
  - `sync_state TEXT NOT NULL DEFAULT 'local_only'`

---

## 3. Migration Strategy (v2 → v3)

1. `SCHEMA_VERSION` advances from 2 to 3.
2. For existing tables (`product`, `customer`, `invoice`, `invoice_item`, `inventory_movement`, `employee`, `"transaction"`):
   - Add new columns using `ALTER TABLE ... ADD COLUMN ...` with safe defaults (`workspace_id`, `created_at`, `deleted_at`, `origin`, `sync_state`, etc.).
   - Convert existing floating-point money columns to INTEGER minor units (e.g. `ROUND(col * 100)`).
   - Ensure `isAlreadyApplied` ignores `duplicate column name`.
3. For new tables:
   - Run `CREATE TABLE IF NOT EXISTS` for all newly introduced tables.
   - Run `CREATE INDEX IF NOT EXISTS` for performance-critical lookups (workspace_id, product_id, dates).
4. Both Windows and Android call the same `runMigrations(db)` before stamping `schema_version = '3'` in `meta`.
