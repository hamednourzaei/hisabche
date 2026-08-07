# Hisabche — Database Schema

## Technology

- **Server**: PostgreSQL, accessed via the `postgres` driver + Drizzle ORM.
  Schema source: `backend/src/drizzle-schema.ts`. Migrations via Drizzle Kit:
  `backend/drizzle/migrations/` (currently `0000_loose_bishop.sql`,
  `0001_dry_avengers.sql`).
- **Identity layer**: Supabase (`auth.users` lives in the Supabase-managed
  auth schema; `public.profiles` holds user profile fields such as
  `full_name`, `business_name`, `avatar_url`).
- **Offline (desktop)**: local SQLite (`better-sqlite3`),
  `apps/desktop/electron/main/db/schema.ts` — mirrors a subset of server
  tables with `dirty`/`updated_at` columns.
- **Offline (web/mobile)**: WatermelonDb schema in `packages/db/src/schema/`
  (Invoice, Product, Customer models).
- A secondary shared schema `packages/db-schema/src/drizzle.schema.ts`
  declares a **smaller subset** of tables (invoices, products, customers,
  transactions, workflows*) used by desktop tooling; the authoritative
  full schema is the backend one.

## Enums

| Enum              | Values                                                        |
| ----------------- | ------------------------------------------------------------- |
| `workflow_status` | `pending`, `in_progress`, `approved`, `rejected`, `cancelled` |
| `workflow_action` | `approved`, `rejected`, `forwarded`, `cancelled`              |

(`invoice_type`, `invoice_status`, `payment_method`, `transaction_type` are
declared as enums in `packages/db-schema`, but in the backend schema those
columns are `text` with default values — migration history shows text
columns. See the note at the end.)

## Tables

### workspaces

Multi-tenant root entity; most tables reference it.

| Column     | Type      | Notes                |
| ---------- | --------- | -------------------- |
| id         | uuid PK   | `defaultRandom()`    |
| name       | text      | not null             |
| slug       | text      | not null, **unique** |
| logo       | text      |                      |
| created_at | timestamp | default now          |
| updated_at | timestamp | default now          |

### products

| Column                  | Type          | Notes                                     |
| ----------------------- | ------------- | ----------------------------------------- |
| id                      | uuid PK       |                                           |
| workspace_id            | uuid          | FK → workspaces.id, **not null**, indexed |
| name                    | text          | not null                                  |
| barcode                 | text          | default `''`, indexed                     |
| sku                     | text          | default `''`, indexed                     |
| category                | text          | default `'general'`, indexed              |
| quantity                | integer       | default 0                                 |
| unit                    | text          | default `'piece'`                         |
| buy_price               | numeric(12,2) | default `'0'`                             |
| sell_price              | numeric(12,2) | default `'0'`                             |
| wholesale_price         | numeric(12,2) | default `'0'`                             |
| min_stock_level         | integer       | default 5                                 |
| description             | text          | default `''`                              |
| is_active               | boolean       | default true                              |
| created_at / updated_at | timestamp     |                                           |
| synced_at               | timestamp     | offline sync marker                       |
| user_id                 | uuid          | added for RLS/filtering (migration 0001)  |

Indexes: `products_workspace_idx`, `products_user_id_idx`,
`products_created_at_idx`, `products_category_idx`, `products_sku_idx`,
`products_barcode_idx`.

### customers

| Column                  | Type          | Notes                                 |
| ----------------------- | ------------- | ------------------------------------- |
| id                      | uuid PK       |                                       |
| workspace_id            | uuid          | FK → workspaces.id, not null, indexed |
| full_name               | text          | not null                              |
| phone                   | text          | default `''`, indexed                 |
| email                   | text          | default `''`                          |
| address                 | text          | default `''`                          |
| opening_balance         | numeric(12,2) | default `'0'`                         |
| is_active               | boolean       | default true                          |
| created_at / updated_at | timestamp     |                                       |
| synced_at               | timestamp     |                                       |
| user_id                 | uuid          | RLS/filter                            |

Indexes: `customers_workspace_idx`, `customers_user_id_idx`,
`customers_created_at_idx`, `customers_phone_idx`.

### invoices

| Column                  | Type          | Notes                                                     |
| ----------------------- | ------------- | --------------------------------------------------------- |
| id                      | uuid PK       |                                                           |
| workspace_id            | uuid          | FK → workspaces.id, not null, indexed                     |
| invoice_number          | text          | not null, indexed                                         |
| type                    | text          | default `'sale'` (`'purchase'` = supplier invoice)        |
| customer_id             | uuid          | indexed                                                   |
| supplier_id             | uuid          |                                                           |
| date                    | timestamp     | not null, default now, indexed                            |
| due_date                | timestamp     |                                                           |
| subtotal                | numeric(12,2) | not null, default `'0'`                                   |
| discount_total          | numeric(12,2) | default `'0'`                                             |
| tax_total               | numeric(12,2) | default `'0'`                                             |
| total                   | numeric(12,2) | not null, default `'0'`                                   |
| paid_amount             | numeric(12,2) | default `'0'`                                             |
| currency                | text          | default `'AFN'`                                           |
| payment_method          | text          | default `'cash'`                                          |
| status                  | text          | default `'pending'` (pending/completed/cancelled/partial) |
| notes                   | text          | default `''`                                              |
| created_at / updated_at | timestamp     |                                                           |
| synced_at               | timestamp     |                                                           |
| user_id                 | uuid          | RLS/filter                                                |

Indexes: `invoices_workspace_idx`, `invoices_user_id_idx`,
`invoices_customer_idx`, `invoices_created_at_idx`, `invoices_updated_at_idx`,
`invoices_status_idx`, `invoices_number_idx`, `invoices_date_idx`,
`invoices_user_status_idx (user_id, status)`, `invoices_user_created_idx (user_id, created_at)`.

### invoice_items

| Column       | Type          | Notes                            |
| ------------ | ------------- | -------------------------------- |
| id           | uuid PK       |                                  |
| invoice_id   | uuid          | not null, indexed                |
| product_id   | uuid          | not null, indexed                |
| product_name | text          | not null (denormalized snapshot) |
| quantity     | numeric(12,3) | not null, default `'1'`          |
| unit_price   | numeric(12,2) | not null, default `'0'`          |
| discount     | numeric(5,2)  | default `'0'`                    |
| total_price  | numeric(12,2) | not null, default `'0'`          |
| created_at   | timestamp     |                                  |

### transactions

| Column       | Type          | Notes                                                             |
| ------------ | ------------- | ----------------------------------------------------------------- |
| id           | uuid PK       |                                                                   |
| workspace_id | uuid          | FK → workspaces.id, not null, indexed                             |
| customer_id  | uuid          | indexed                                                           |
| supplier_id  | uuid          |                                                                   |
| type         | text          | not null, default `'sale'` (sale/purchase/payment/receipt/return) |
| amount       | numeric(12,2) | not null                                                          |
| currency     | text          | default `'AFN'`                                                   |
| description  | text          | default `''`                                                      |
| reference    | text          | default `''`                                                      |
| date         | timestamp     | indexed                                                           |
| created_at   | timestamp     |                                                                   |
| synced_at    | timestamp     |                                                                   |
| user_id      | uuid          | RLS/filter                                                        |

Indexes: `transactions_workspace_idx`, `transactions_user_id_idx`,
`transactions_customer_idx`, `transactions_created_at_idx`,
`transactions_date_idx`, `transactions_type_idx`.

### exchange_rates

| Column        | Type          | Notes                |
| ------------- | ------------- | -------------------- |
| id            | uuid PK       |                      |
| currency_code | text          | not null, indexed    |
| rate          | numeric(12,6) | not null             |
| updated_at    | timestamp     | default now, indexed |

### workflows

| Column                  | Type      | Notes                           |
| ----------------------- | --------- | ------------------------------- |
| id                      | uuid PK   |                                 |
| workspace_id            | uuid      | FK → workspaces.id, not null    |
| name                    | text      | not null                        |
| description             | text      |                                 |
| entity_type             | text      | not null, indexed               |
| is_active               | boolean   | not null, default true, indexed |
| created_at / updated_at | timestamp | not null                        |
| deleted_at              | timestamp | soft delete                     |

### workflow_steps

| Column           | Type      | Notes                   |
| ---------------- | --------- | ----------------------- |
| id               | uuid PK   |                         |
| workflow_id      | uuid      | not null, indexed       |
| step_order       | integer   | not null                |
| approver_role    | text      | not null                |
| approver_user_id | uuid      | indexed                 |
| is_final         | boolean   | not null, default false |
| created_at       | timestamp | not null                |

### workflow_instances

| Column                  | Type            | Notes                                    |
| ----------------------- | --------------- | ---------------------------------------- |
| id                      | uuid PK         |                                          |
| workflow_id             | uuid            | not null, indexed                        |
| workspace_id            | uuid            | FK → workspaces.id, not null             |
| entity_type             | text            | not null                                 |
| entity_id               | uuid            | not null, indexed                        |
| status                  | workflow_status | not null, default `in_progress`, indexed |
| current_step            | integer         | not null, default 1                      |
| total_steps             | integer         | not null                                 |
| started_at              | timestamp       | not null, default now                    |
| completed_at            | timestamp       |                                          |
| created_at / updated_at | timestamp       | not null                                 |

### workflow_actions

| Column        | Type            | Notes             |
| ------------- | --------------- | ----------------- |
| id            | uuid PK         |                   |
| instance_id   | uuid            | not null, indexed |
| step_order    | integer         | not null          |
| action        | workflow_action | not null          |
| actor_user_id | uuid            | not null, indexed |
| actor_role    | text            |                   |
| comment       | text            |                   |
| created_at    | timestamp       | not null, indexed |

### Supabase-managed tables

- `auth.users` — identity (Supabase managed).
- `public.profiles` — profile fields: `id` (FK auth.users), `full_name`,
  `business_name`, `avatar_url`, `created_at`.
- `public.sync_queue` — web sync queue items (user_id, entity_type,
  entity_id, action, payload, status, priority, retryCount, maxRetries,
  errorMessage, createdAt, processedAt). Managed from code
  (`packages/db/src/sync-queue.ts`), not present in Drizzle migrations.

## Relations (ER)

```
workspaces 1───* products
workspaces 1───* customers
workspaces 1───* invoices
workspaces 1───* transactions
workspaces 1───* workflows
workspaces 1───* workflow_instances

invoices 1───* invoice_items   (invoice_items.invoice_id)
invoices *───1 customers       (invoices.customer_id)
invoices *───1 products        (via invoice_items.product_id)
invoices *───1 suppliers       (invoices.supplier_id; suppliers not a table —
                                purchase invoices reference a supplier record)

workflows 1───* workflow_steps
workflows 1───* workflow_instances
workflow_instances 1───* workflow_actions
workflow_instances *───1 entity (any business entity: invoice, purchase…)

customers *───* invoices (through transactions: transactions.customer_id,
                          transactions.supplier_id)
```

Foreign keys declared in migrations: every `workspace_id` FK → workspaces.id
(ON DELETE NO ACTION). FKs between invoice_items→invoices and
invoice_items→products are **not** declared as constraints in the current
migrations (only indexes exist); `customer_id`/`supplier_id`/`user_id`
columns are likewise indexed but not FK-constrained. The auth service code
writes `profiles.id = auth.users.id`.

## Migration Strategy

- Drizzle Kit with `drizzle.config.ts` (backend); migrations live in
  `backend/drizzle/migrations/` + `meta/`.
- Migration `0000_loose_bishop.sql` — initial schema (tables above, enums,
  workspace FKs, indexes).
- Migration `0001_dry_avengers.sql` — adds `user_id` columns (products,
  customers, invoices, transactions) + RLS/filter indexes; also
  `exchange_rates_updated_at_idx`, `invoices_updated_at_idx`,
  `invoices_date_idx`, `invoices_user_status_idx`, `invoices_user_created_idx`,
  `transactions_date_idx`, `transactions_type_idx`, workflow action/step indexes.
- Additional SQL migrations in `docs/` (e.g. `workspace-stamp-migration.sql`,
  `task-assignment-migration.sql`, `invoice-public-share-migration.sql`) are
  applied out-of-band to production, outside the Drizzle history.
- Desktop ships its own SQLite schema (SCHEMA_VERSION = 1) created from
  `CREATE_STATEMENTS`; it is a cache, not a source of truth.

## Offline Database Schemas

### Desktop local SQLite (per `apps/desktop/electron/main/db/schema.ts`)

Tables: `product`, `customer`, `invoice`, `invoice_item`, `transaction`,
`inventory_movement`, `employee`, `sync_queue`, `sync_cursor`, `meta`.

Conventions:

- Server ids remain the primary key (a pulled row overwrites its local copy).
- Every data table has `updated_at` (incremental pull cursor) and `dirty`
  (1 = local change pending push).
- `sync_queue` — `client_id` PK, `entity`, `operation`, `payload`,
  `attempts`, `status`, `last_error`, `created_at`; indexed by
  `(status, created_at)`.
- `sync_cursor` — per-entity `last_pulled_at`.
- Write path allow-listed via `WRITABLE_COLUMNS`; free-text search columns
  in `SEARCHABLE_COLUMNS`.

### Web/mobile WatermelonDb (per `packages/db/src/`)

Models: `Invoice`, `Product`, `Customer` (`packages/db/src/models/`,
`packages/db/src/schema/`). Sync via `sync.ts` (`syncDatabase`) — pushes
local changes and pulls server changes; web entry `packages/offline/`.

## Notes / Discrepancies

- `packages/db-schema` declares `invoice_type`, `invoice_status`,
  `payment_method`, `transaction_type` as Postgres enums and uses `decimal`
  for money, but the **backend** schema (the deployed one) uses `text`
  columns with defaults and `numeric(12,2)`. The deployed database follows
  the backend schema; the db-schema package is a subset used by desktop
  tooling and should be treated as stale in places.
- `invoices.type` and `transactions.type` are text columns; their value sets
  are enforced in application code (validation) rather than by the database.
