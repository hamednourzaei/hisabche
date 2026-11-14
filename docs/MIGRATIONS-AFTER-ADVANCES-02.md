# Migrations to run after `VERIFY-advances-02.sql` (14 Nov 2026)

The owner's last confirmed run was `docs/VERIFY-advances-02.sql`. These are every
`docs/*-migration.sql` added after it (git first-add date), in the order to run them.

## How each was checked

On a real PostgreSQL (PGlite 0.5.16, with btree_gist) holding every migration from BEFORE
advances-02, each file below was run **twice** (idempotent) in this order, then its VERIFY.
Result: **58 / 58 apply twice without error; every VERIFY row is true**
(the one exception is the Vault row of admin-secrets-01, which only Supabase can make true).

Fixed in this round, before you run them:

- `credit-concurrency-02` — NEW. `assert_customer_credit` (credit-concurrency-01, likely live)
  returned integer/untyped NULL into bigint columns: PostgreSQL refuses it (42804), so the
  DEFAULT case — a customer with no credit limit — failed every sale. It also fell through
  after `RETURN QUERY` and granted EXECUTE to `authenticated`. Run it FIRST.
- `purchase-variant-binding-01` — indexed `purchase_order_items.workspace_id`, a column that
  table does not have: it failed on every database. Its VERIFY read the same column.
- `VERIFY-admin-ip-allowlist-01`, `-monitoring-01`, `-payment-gateways-01`, `-secrets-01` —
  `SELECT check …`: `check` is a reserved word and the CTE named no columns (syntax error).
- `VERIFY-repair-parts-01` — expected a client policy the migration deliberately drops (V61 lockdown).

⚠️ Before advances-02 and NOT re-run here: `VERIFY-admin-02-security.sql` has the same
`AS check` syntax error.

Each VERIFY says `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`
until you report its result.

## Order

| #   | Migration                                            | VERIFY                                            | Note                                                                                              |
| --- | ---------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | `credit-concurrency-02-migration.sql`                | `VERIFY-credit-concurrency-02.sql`                | FIX for credit-concurrency-01 (live): a sale to a customer with no credit limit failed with 42804 |
| 2   | `email-otp-01-migration.sql`                         | `VERIFY-email-otp-01.sql`                         | same commit as advances-02 — skip if you already ran it                                           |
| 3   | `provider-commission-01-migration.sql`               | `VERIFY-provider-commission-01.sql`               | same commit as advances-02 — skip if you already ran it                                           |
| 4   | `session-deposit-01-migration.sql`                   | `VERIFY-session-deposit-01.sql`                   | same commit as advances-02 — skip if you already ran it                                           |
| 5   | `user-guide-progress-01-migration.sql`               | `VERIFY-user-guide-progress-01.sql`               |                                                                                                   |
| 6   | `cycle-count-04-migration.sql`                       | `VERIFY-cycle-count-04.sql`                       |                                                                                                   |
| 7   | `offline-licence-keys-02-migration.sql`              | `VERIFY-offline-licence-keys-02.sql`              |                                                                                                   |
| 8   | `role-permissions-atomic-01-migration.sql`           | `VERIFY-role-permissions-atomic-01.sql`           |                                                                                                   |
| 9   | `advances-03-migration.sql`                          | `VERIFY-advances-03.sql`                          |                                                                                                   |
| 10  | `user-dashboard-kpis-01-migration.sql`               | `VERIFY-user-dashboard-kpis-01.sql`               |                                                                                                   |
| 11  | `dashboard-stock-value-01-migration.sql`             | `VERIFY-dashboard-stock-value-01.sql`             |                                                                                                   |
| 12  | `user-state-01-migration.sql`                        | `VERIFY-user-state-01.sql`                        |                                                                                                   |
| 13  | `exchange-01-migration.sql`                          | `VERIFY-exchange-01.sql`                          |                                                                                                   |
| 14  | `retail-ops-01-migration.sql`                        | `VERIFY-retail-ops-01.sql`                        |                                                                                                   |
| 15  | `salon-01-migration.sql`                             | `VERIFY-salon-01.sql`                             |                                                                                                   |
| 16  | `variant-stock-01-migration.sql`                     | `VERIFY-variant-stock-01.sql`                     |                                                                                                   |
| 17  | `purchase-variant-binding-01-migration.sql`          | `VERIFY-purchase-variant-binding-01.sql`          | FIXED this round: indexed a workspace_id the table does not have                                  |
| 18  | `leave-policy-01-migration.sql`                      | `VERIFY-leave-policy-01.sql`                      |                                                                                                   |
| 19  | `stock-reservations-01-migration.sql`                | `VERIFY-stock-reservations-01.sql`                |                                                                                                   |
| 20  | `storage-bin-transfer-01-migration.sql`              | `VERIFY-storage-bin-transfer-01.sql`              |                                                                                                   |
| 21  | `exchange-02-migration.sql`                          | `VERIFY-exchange-02.sql`                          |                                                                                                   |
| 22  | `exchange-03-migration.sql`                          | `VERIFY-exchange-03.sql`                          |                                                                                                   |
| 23  | `gold-01-migration.sql`                              | `VERIFY-gold-01.sql`                              |                                                                                                   |
| 24  | `mobile-serial-01-migration.sql`                     | `VERIFY-mobile-serial-01.sql`                     |                                                                                                   |
| 25  | `quality-events-01-migration.sql`                    | `VERIFY-quality-events-01.sql`                    |                                                                                                   |
| 26  | `repair-parts-01-migration.sql`                      | `VERIFY-repair-parts-01.sql`                      |                                                                                                   |
| 27  | `resource-capacity-01-migration.sql`                 | `VERIFY-resource-capacity-01.sql`                 | needs btree_gist (Supabase: Database → Extensions; the file creates it)                           |
| 28  | `contracts-01-migration.sql`                         | `VERIFY-contracts-01.sql`                         | after resource-capacity-01 (needs resource_bookings)                                              |
| 29  | `salon-02-migration.sql`                             | `VERIFY-salon-02.sql`                             |                                                                                                   |
| 30  | `accrual-schedules-01-migration.sql`                 | `VERIFY-accrual-schedules-01.sql`                 |                                                                                                   |
| 31  | `approval-policy-01-migration.sql`                   | `VERIFY-approval-policy-01.sql`                   |                                                                                                   |
| 32  | `bundles-consignment-commission-01-migration.sql`    | `VERIFY-bundles-consignment-commission-01.sql`    |                                                                                                   |
| 33  | `cheques-01-migration.sql`                           | `VERIFY-cheques-01.sql`                           |                                                                                                   |
| 34  | `customer-payment-gateway-01-migration.sql`          | `VERIFY-customer-payment-gateway-01.sql`          |                                                                                                   |
| 35  | `data-translations-01-migration.sql`                 | `VERIFY-data-translations-01.sql`                 |                                                                                                   |
| 36  | `document-revisions-01-migration.sql`                | `VERIFY-document-revisions-01.sql`                |                                                                                                   |
| 37  | `hr-org-appraisal-01-migration.sql`                  | `VERIFY-hr-org-appraisal-01.sql`                  |                                                                                                   |
| 38  | `journal-lines-currency-memorandum-01-migration.sql` | `VERIFY-journal-lines-currency-memorandum-01.sql` |                                                                                                   |
| 39  | `messaging-outbox-01-migration.sql`                  | `VERIFY-messaging-outbox-01.sql`                  |                                                                                                   |
| 40  | `overhead-allocation-01-migration.sql`               | `VERIFY-overhead-allocation-01.sql`               |                                                                                                   |
| 41  | `rfq-purchase-contracts-01-migration.sql`            | `VERIFY-rfq-purchase-contracts-01.sql`            |                                                                                                   |
| 42  | `role-timeouts-01-migration.sql`                     | `VERIFY-role-timeouts-01.sql`                     |                                                                                                   |
| 43  | `sales-orders-02-migration.sql`                      | `VERIFY-sales-orders-02.sql`                      |                                                                                                   |
| 44  | `sync-scope-01-migration.sql`                        | `VERIFY-sync-scope-01.sql`                        |                                                                                                   |
| 45  | `tenancy-02-migration.sql`                           | `VERIFY-tenancy-02.sql`                           |                                                                                                   |
| 46  | `time-entries-unify-01-migration.sql`                | `VERIFY-time-entries-unify-01.sql`                |                                                                                                   |
| 47  | `workspace-2fa-01-migration.sql`                     | `VERIFY-workspace-2fa-01.sql`                     |                                                                                                   |
| 48  | `accrual-schedules-02-migration.sql`                 | `VERIFY-accrual-schedules-02.sql`                 |                                                                                                   |
| 49  | `admin-action-types-02-migration.sql`                | `VERIFY-admin-action-types-02.sql`                |                                                                                                   |
| 50  | `admin-action-types-03-migration.sql`                | `VERIFY-admin-action-types-03.sql`                |                                                                                                   |
| 51  | `admin-ip-allowlist-01-migration.sql`                | `VERIFY-admin-ip-allowlist-01.sql`                |                                                                                                   |
| 52  | `admin-monitoring-01-migration.sql`                  | `VERIFY-admin-monitoring-01.sql`                  |                                                                                                   |
| 53  | `admin-payment-gateways-01-migration.sql`            | `VERIFY-admin-payment-gateways-01.sql`            |                                                                                                   |
| 54  | `admin-secrets-01-migration.sql`                     | `VERIFY-admin-secrets-01.sql`                     | VERIFY row «Supabase Vault installed» is true only on Supabase                                    |
| 55  | `ai-usage-01-migration.sql`                          | `VERIFY-ai-usage-01.sql`                          |                                                                                                   |
| 56  | `bundles-consignment-commission-02-migration.sql`    | `VERIFY-bundles-consignment-commission-02.sql`    |                                                                                                   |
| 57  | `invoices-seller-01-migration.sql`                   | `VERIFY-invoices-seller-01.sql`                   |                                                                                                   |
| 58  | `rfq-purchase-contracts-02-migration.sql`            | `VERIFY-rfq-purchase-contracts-02.sql`            |                                                                                                   |
