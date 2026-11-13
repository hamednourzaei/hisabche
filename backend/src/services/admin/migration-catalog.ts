// ============================================
// backend/src/services/admin/migration-catalog.ts
//
// V63 #69 — the migrations that are waiting for a human, and how to tell
// whether each one has been run. READ-ONLY by design: humans run DDL
// (CLAUDE.md §0); this list never runs anything.
//
// Each entry names ONE object the migration creates. The admin route asks the
// database whether that object exists — a table (or a column of one) answers
// through PostgREST; a migration that only adds functions has no probe and is
// reported `unknown`, never guessed.
//
// ⚠️ A probe says «the object exists», not «the migration's VERIFY passed».
// The screen says so; the VERIFY file is still the proof.
//
// Guard: `admin-insights.test.ts` — every file exists in docs/, and every
// probe is created by that very file (a probe copied from another migration
// would report «applied» for the wrong one).
// ============================================

export interface MigrationProbe {
  table: string
  /** Probe a column the migration adds to an existing table. */
  column?: string | undefined
}

export interface MigrationCatalogEntry {
  /** File name in `docs/`, without the folder. */
  file: string
  verify: string
  probe: MigrationProbe | null
}

export const MIGRATION_CATALOG: readonly MigrationCatalogEntry[] = [
  {
    file: 'admin-secrets-01-migration.sql',
    verify: 'VERIFY-admin-secrets-01.sql',
    probe: { table: 'platform_secrets' },
  },
  {
    file: 'admin-action-types-02-migration.sql',
    verify: 'VERIFY-admin-action-types-02.sql',
    probe: null,
  },
  {
    file: 'admin-ip-allowlist-01-migration.sql',
    verify: 'VERIFY-admin-ip-allowlist-01.sql',
    probe: { table: 'admin_ip_allowlist' },
  },
  {
    file: 'admin-monitoring-01-migration.sql',
    verify: 'VERIFY-admin-monitoring-01.sql',
    probe: { table: 'request_metrics_minute' },
  },
  {
    file: 'admin-payment-gateways-01-migration.sql',
    verify: 'VERIFY-admin-payment-gateways-01.sql',
    probe: { table: 'platform_payment_gateways' },
  },
  {
    file: 'ai-usage-01-migration.sql',
    verify: 'VERIFY-ai-usage-01.sql',
    probe: { table: 'ai_query_log', column: 'prompt_tokens' },
  },
  {
    file: 'operational-profile-01-migration.sql',
    verify: 'VERIFY-operational-profile-01.sql',
    probe: { table: 'workspaces', column: 'operational_dna' },
  },
  {
    file: 'workspace-create-01-migration.sql',
    verify: 'VERIFY-workspace-create-01.sql',
    probe: null,
  },
  {
    file: 'custom-units-01-migration.sql',
    verify: 'VERIFY-custom-units-01.sql',
    probe: { table: 'custom_unit_rates' },
  },
  {
    file: 'shelf-capacity-01-migration.sql',
    verify: 'VERIFY-shelf-capacity-01.sql',
    probe: { table: 'storage_auto_shelves' },
  },
  {
    file: 'attendance-02-migration.sql',
    verify: 'VERIFY-attendance-02.sql',
    probe: { table: 'attendance', column: 'ends_next_day' },
  },
  {
    file: 'invoice-exchange-rate-01-migration.sql',
    verify: 'VERIFY-invoice-exchange-rate-01.sql',
    probe: { table: 'invoices', column: 'exchange_rate' },
  },
  {
    file: 'till-payments-01-migration.sql',
    verify: 'VERIFY-till-payments-01.sql',
    probe: { table: 'payments', column: 'pos_session_id' },
  },
  {
    file: 'dashboard-fx-01-migration.sql',
    verify: 'VERIFY-dashboard-fx-01.sql',
    probe: null,
  },
]
