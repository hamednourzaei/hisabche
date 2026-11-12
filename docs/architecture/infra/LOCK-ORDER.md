# LOCK-ORDER.md — Canonical Database Lock Acquisition Order

To prevent deadlocks (`40P01`) across concurrent POS checkouts, inventory reservations, manufacturing completions, and payment allocations, every multi-row transaction and Postgres RPC MUST acquire row locks (`SELECT ... FOR UPDATE`) in the following strict ascending hierarchy.

## Global Lock Hierarchy (Top to Bottom)

1. **`workspaces`** (only if workspace-level settings/sequence counters are mutated)
2. **`fiscal_periods` / `accounts`** (GL period lock / chart of accounts)
3. **`warehouses`** (warehouse-level configuration if needed)
4. **`products`** (sorted by `id ASC`)
5. **`inventory_stock` / `stock_batches` / `serial_numbers`** (sorted by `(warehouse_id, product_id, id) ASC`)
6. **`sales_orders` / `purchase_orders` / `work_orders`** (sorted by `id ASC`)
7. **`invoices` / `bills` / `cheques` / `payments`** (sorted by `id ASC`)
8. **`journal_entries` -> `journal_lines`** (always posted last via `ledger.postDocument`)

## Mandatory Rules

1. **Always sort UUID arrays before `FOR UPDATE`:** When locking multiple `product_id`s or `batch_id`s in an invoice/transfer, sort IDs lexicographically (`ORDER BY id ASC`) before locking.
2. **Never lock `journal_entries` before inventory:** Stock movements calculate COGS layers first, then post the balanced journal entry.
3. **Never hold locks across network I/O:** External HTTP calls (webhooks, SMS, payment gateways) MUST happen outside Postgres transactions using the outbox pattern (`messaging_outbox` / idempotency keys).
4. **Short lock timeout:** Web-facing roles enforce `lock_timeout = '3s'` (`docs/role-timeouts-01-migration.sql`) so a blocked transaction fails cleanly instead of piling up connections.
