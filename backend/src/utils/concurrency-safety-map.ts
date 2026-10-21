// ============================================
// Concurrency Safety Layer — the map (#142, 26 Sep 2026)
//
// For every route that moves money or stock: what stops two copies of the same
// request (double-click, client retry, two devices, two API instances) from
// doing the work twice or interleaving. Each claim carries EVIDENCE — a file
// and a piece of text that must be in it — and
// `__tests__/concurrency-safety-map.test.ts` fails if the evidence is gone or a
// new mutating route in a covered file is not listed. A mechanism nobody can
// point to in the code is not a mechanism (CLAUDE.md §7.1).
//
// Mechanisms:
//   idempotency-key     caller-made key, stored under a UNIQUE/PK; a repeat returns the first result
//   db-function         one Postgres function via `.rpc()` — one transaction, row locks inside
//   conditional-update  `UPDATE … WHERE status = <what was read>`: only one caller matches a row
//   unique-constraint   a UNIQUE index refuses the second write (e.g. one ledger entry per source)
//   lease               a time-limited claim on an entity (sync drafts, scheduled jobs)
//   state-idempotent    repeating the request leaves the same state (set status = X)
//   last-write-wins     settings / master data: no money or stock moves; the later edit stands
//   check-then-write    read-then-insert: sequential repeats are refused, a truly simultaneous pair is not
//
// `gap` is a known hazard written down instead of hidden (§13). It is not a
// failure of the guard; removing it without a fix is.
//
// worker_threads: NO route uses them. CPU-heavy work (PDF, backup .xlsx/.md)
// runs inline on the request; the per-instance in-flight counter and
// `/ready` are what shed load. Listed so nobody assumes otherwise.
//
// Background work (not routes): scheduled jobs claim `(task, slot)` via
// `claim_scheduled_run`; job/event/email queues claim with
// `FOR UPDATE SKIP LOCKED` (`claim_background_jobs`, `claim_event_log`,
// `claim_email_outbox`) — see services/distributed-work.ts, email-outbox.ts.
// ============================================

export type Mechanism =
  | 'idempotency-key'
  | 'db-function'
  | 'conditional-update'
  | 'unique-constraint'
  | 'lease'
  | 'state-idempotent'
  | 'last-write-wins'
  | 'check-then-write'

export interface Evidence {
  /** Relative to the repository root. */
  file: string
  /** Text that must appear in that file. */
  text: string
}

export interface RouteSafety {
  /** The route file (backend/src/routes/…) the handler is declared in. */
  routeFile: string
  /** `METHOD path` exactly as declared in that file (prefix not included). */
  route: string
  mechanisms: readonly Mechanism[]
  evidence: readonly Evidence[]
  gap?: string
}

const SVC = 'backend/src/services'
const RT = 'backend/src/routes'
const SQL = 'docs/SETUP-COMPLETE.sql'

export const CONCURRENCY_SAFETY_MAP: readonly RouteSafety[] = [
  // ─── Invoices ────────────────────────────────────────────────────────────
  {
    routeFile: 'invoice.routes.ts',
    route: 'POST /api/invoices',
    mechanisms: ['idempotency-key', 'db-function'],
    evidence: [
      { file: `${RT}/invoice.routes.ts`, text: 'readClientRequestId' },
      { file: `${SVC}/invoice.service.ts`, text: "invoiceError.code === '23505'" },
      // Header, lines, details and stock in one transaction.
      { file: `${SVC}/invoice.service.ts`, text: "supabase.rpc('invoice_write_document'" },
      {
        file: 'docs/invoice-write-document-migration.sql',
        text: 'CREATE OR REPLACE FUNCTION public.invoice_write_document(',
      },
    ],
  },
  {
    routeFile: 'invoice.routes.ts',
    route: 'POST /api/invoices/post-unposted',
    mechanisms: ['unique-constraint'],
    evidence: [{ file: SQL, text: 'journal_entries_source_key' }],
  },
  {
    routeFile: 'invoice.routes.ts',
    route: 'POST /api/invoices/:id/post-to-ledger',
    mechanisms: ['unique-constraint'],
    evidence: [{ file: SQL, text: 'journal_entries_source_key' }],
  },
  {
    // The cost a sale is given late: one ledger entry per sale, keyed by a
    // UUID derived from the invoice, and one consumption per invoice line.
    routeFile: 'invoice.routes.ts',
    route: 'POST /api/invoices/:id/cost',
    mechanisms: ['unique-constraint'],
    evidence: [{ file: SQL, text: 'journal_entries_source_key' }],
  },
  {
    routeFile: 'invoice.routes.ts',
    route: 'PATCH /api/invoices/:id',
    mechanisms: ['conditional-update', 'db-function'],
    evidence: [
      { file: `${SVC}/invoice.service.ts`, text: 'INVOICE_VERSION_REQUIRED' },
      {
        file: `${SVC}/invoice.service.ts`,
        text: "throw new ConflictError('INVOICE_VERSION_CONFLICT')",
      },
      {
        file: 'docs/invoice-write-document-migration.sql',
        text: "RAISE EXCEPTION 'INVOICE_VERSION_CONFLICT' USING ERRCODE = '40001'",
      },
    ],
  },
  {
    routeFile: 'invoice.routes.ts',
    route: 'DELETE /api/invoices/:id',
    mechanisms: ['state-idempotent'],
    evidence: [
      {
        file: `${SVC}/invoice.service.ts`,
        text: "await supabase.from('invoice_items').delete().eq('invoice_id', id)",
      },
    ],
    gap: 'Items and header are two deletes, not one transaction.',
  },

  // ─── Payments (prefix /api/payments) and the transactions list ──────────
  {
    routeFile: 'payments.routes.ts',
    route: 'POST /',
    mechanisms: ['idempotency-key', 'db-function'],
    evidence: [
      { file: `${RT}/payments.routes.ts`, text: 'readClientRequestId' },
      { file: `${SVC}/payments/payments.repository.ts`, text: 'payments_record_keyed' },
    ],
  },
  {
    routeFile: 'payments.routes.ts',
    route: 'POST /:id/cancel',
    mechanisms: ['db-function'],
    evidence: [
      { file: `${SVC}/payments/payments.repository.ts`, text: "supabase.rpc('payments_cancel'" },
    ],
  },
  {
    routeFile: 'transaction.routes.ts',
    route: 'POST /api/transactions',
    mechanisms: ['idempotency-key'],
    evidence: [{ file: `${RT}/transaction.routes.ts`, text: 'readClientRequestId' }],
  },
  {
    routeFile: 'transaction.routes.ts',
    route: 'DELETE /api/transactions/:id',
    mechanisms: ['db-function'],
    evidence: [
      { file: `${RT}/transaction.routes.ts`, text: 'paymentsService.cancelPayment(' },
      { file: `${SVC}/payments/payments.repository.ts`, text: "supabase.rpc('payments_cancel'" },
    ],
  },

  // ─── Till / POS (prefix /api/pos) ────────────────────────────────────────
  {
    routeFile: 'pos.routes.ts',
    route: 'POST /sessions',
    mechanisms: ['unique-constraint'],
    evidence: [{ file: SQL, text: 'pos_sessions_one_open' }],
  },
  {
    routeFile: 'pos.routes.ts',
    route: 'POST /sessions/:id/orders',
    mechanisms: ['idempotency-key', 'db-function'],
    evidence: [
      { file: `${SVC}/pos/pos.service.ts`, text: "supabase.rpc('pos_record_order'" },
      { file: SQL, text: 'pos_orders_ref_key' },
    ],
  },
  {
    routeFile: 'pos.routes.ts',
    route: 'POST /orders/:id/void',
    mechanisms: ['state-idempotent'],
    evidence: [
      { file: `${SVC}/pos/pos.service.ts`, text: ".update({ status: 'voided' })" },
      // Only a completed order moves, so two voids at once are still one.
      { file: `${SVC}/pos/pos.service.ts`, text: ".eq('status', 'completed')" },
    ],
  },
  {
    routeFile: 'pos.routes.ts',
    route: 'POST /sessions/:id/cash',
    mechanisms: ['idempotency-key'],
    evidence: [
      { file: `${RT}/pos.routes.ts`, text: 'movementId: z.string().uuid().optional()' },
      { file: `${SVC}/pos/pos.service.ts`, text: "error?.code === '23505' && input.movementId" },
      // Made once per form fill and kept until the server has recorded the
      // movement — a new id per click made a retry a second movement.
      {
        file: 'packages/ui/src/components/ui/till/till-view.tsx',
        text: 'setMovementRequestId((current) => current || crypto.randomUUID())',
      },
      {
        file: 'packages/ui/src/components/ui/till/till-view.tsx',
        text: 'movementId: movementRequestId,',
      },
    ],
  },
  {
    routeFile: 'pos.routes.ts',
    route: 'POST /sessions/:id/bank-transfer',
    mechanisms: ['idempotency-key'],
    evidence: [
      { file: `${SVC}/pos/pos.service.ts`, text: "{ onConflict: 'id', ignoreDuplicates: true }" },
    ],
  },
  {
    routeFile: 'pos.routes.ts',
    route: 'POST /opening-capital',
    mechanisms: ['idempotency-key'],
    evidence: [{ file: `${SVC}/pos/pos.service.ts`, text: "sourceType: 'opening_capital'," }],
  },
  {
    routeFile: 'pos.routes.ts',
    route: 'POST /sessions/:id/close',
    mechanisms: ['conditional-update'],
    evidence: [
      {
        file: `${SVC}/pos/pos.service.ts`,
        text: ".in('status', ['open', 'closing', 'suspended'])",
      },
    ],
  },
  {
    routeFile: 'pos.routes.ts',
    route: 'POST /sessions/:id/suspend',
    mechanisms: ['conditional-update'],
    evidence: [{ file: `${SVC}/pos/pos.service.ts`, text: ".eq('status', session.status)" }],
  },
  {
    routeFile: 'pos.routes.ts',
    route: 'POST /sessions/:id/resume',
    mechanisms: ['conditional-update'],
    evidence: [{ file: `${SVC}/pos/pos.service.ts`, text: ".eq('status', session.status)" }],
  },
  {
    // The till's NAME: one text column on one row, no money and no derived
    // figure. Two people renaming at once leave the later name — which is the
    // right answer for a label.
    routeFile: 'pos.routes.ts',
    route: 'PATCH /sessions/:id/label',
    mechanisms: ['last-write-wins'],
    evidence: [{ file: `${SVC}/pos/pos.service.ts`, text: '.update({ label })' }],
  },
  {
    // Removing a till that was never used. The status rides in the WHERE, so
    // one closed in the meantime is left alone; an order arriving in the same
    // gap is stopped by the foreign key from `pos_orders`.
    routeFile: 'pos.routes.ts',
    route: 'DELETE /sessions/:id',
    mechanisms: ['conditional-update'],
    evidence: [{ file: `${SVC}/pos/pos.service.ts`, text: ".in('status', ['open', 'suspended'])" }],
  },

  // ─── Offline sync ────────────────────────────────────────────────────────
  {
    routeFile: 'sync.routes.ts',
    route: 'POST /api/sync/push',
    mechanisms: ['idempotency-key'],
    evidence: [
      {
        file: `${SVC}/sync.service.ts`,
        text: 'Idempotency by mutation_id, enforced by a PRIMARY KEY',
      },
    ],
  },
  {
    routeFile: 'sync.routes.ts',
    route: 'POST /api/sync/lease',
    mechanisms: ['lease'],
    evidence: [{ file: `${SVC}/sync.service.ts`, text: 'leaseHeldByOther' }],
  },
  {
    routeFile: 'sync.routes.ts',
    route: 'DELETE /api/sync/lease',
    mechanisms: ['lease'],
    evidence: [{ file: `${RT}/sync.routes.ts`, text: 'syncService.releaseLease(' }],
  },

  // ─── Billing ─────────────────────────────────────────────────────────────
  {
    routeFile: 'billing.routes.ts',
    route: 'POST /api/billing/upgrade',
    mechanisms: ['db-function'],
    evidence: [
      {
        file: `${SVC}/subscription-upgrade.service.ts`,
        text: "rpc('create_subscription_upgrade_request'",
      },
    ],
  },
  {
    routeFile: 'billing.routes.ts',
    route: 'POST /api/billing/upgrade-requests/:id/cancel',
    mechanisms: ['db-function'],
    evidence: [
      {
        file: `${SVC}/subscription-upgrade.service.ts`,
        text: "rpc('cancel_subscription_upgrade_request'",
      },
    ],
  },
  {
    routeFile: 'billing.routes.ts',
    route: 'POST /api/admin/upgrade-requests/:id/approve',
    mechanisms: ['db-function'],
    evidence: [
      {
        file: `${SVC}/subscription-upgrade.service.ts`,
        text: "rpc('approve_subscription_upgrade'",
      },
    ],
  },
  {
    routeFile: 'billing.routes.ts',
    route: 'POST /api/admin/upgrade-requests/:id/reject',
    mechanisms: ['db-function'],
    evidence: [
      { file: `${SVC}/subscription-upgrade.service.ts`, text: "rpc('reject_subscription_upgrade'" },
    ],
  },
  {
    routeFile: 'billing.routes.ts',
    route: 'POST /api/billing/cancel',
    mechanisms: ['state-idempotent'],
    evidence: [{ file: `${RT}/billing.routes.ts`, text: 'billingService.cancel(' }],
  },
  {
    routeFile: 'billing.routes.ts',
    route: 'PUT /api/admin/plan-limits/:plan',
    mechanisms: ['last-write-wins'],
    evidence: [{ file: `${SVC}/plan-limits.service.ts`, text: 'savePlanSettings' }],
  },
  {
    routeFile: 'billing.routes.ts',
    route: 'PUT /api/admin/workspace-limits/:workspaceId',
    mechanisms: ['last-write-wins'],
    evidence: [{ file: `${SVC}/plan-limits.service.ts`, text: 'saveWorkspaceOverride' }],
  },
  {
    routeFile: 'admin-security.routes.ts',
    route: 'POST /api/admin/accounts',
    mechanisms: ['last-write-wins'],
    evidence: [{ file: `${SVC}/admin/admin-security.service.ts`, text: 'upsertAdminAccount' }],
  },
  {
    routeFile: 'admin-security.routes.ts',
    route: 'POST /api/admin/sessions/:userId/revoke',
    mechanisms: ['last-write-wins'],
    evidence: [{ file: `${SVC}/admin/admin-security.service.ts`, text: 'revokeAdminSession' }],
  },
  {
    routeFile: 'admin-security.routes.ts',
    route: 'POST /api/admin/security/step-up',
    mechanisms: ['last-write-wins'],
    evidence: [{ file: `${SVC}/admin/admin-security.service.ts`, text: 'logSecurityEvent' }],
  },
  {
    routeFile: 'admin-customers.routes.ts',
    route: 'POST /api/admin/users/:id/action',
    mechanisms: ['last-write-wins'],
    evidence: [{ file: `${SVC}/admin/admin-customers.service.ts`, text: 'manageUser' }],
  },
  {
    routeFile: 'admin-customers.routes.ts',
    route: 'POST /api/admin/workspaces/:id/support-sessions',
    mechanisms: ['last-write-wins'],
    evidence: [{ file: `${SVC}/admin/admin-customers.service.ts`, text: 'createSupportSession' }],
  },
  {
    routeFile: 'admin-customers.routes.ts',
    route: 'POST /api/admin/workspaces/:id/notes',
    mechanisms: ['last-write-wins'],
    evidence: [{ file: `${SVC}/admin/admin-customers.service.ts`, text: 'addNote' }],
  },
  {
    routeFile: 'admin-customers.routes.ts',
    route: 'POST /api/admin/data-requests',
    mechanisms: ['last-write-wins'],
    evidence: [{ file: `${SVC}/admin/admin-customers.service.ts`, text: 'createDataRequest' }],
  },
  {
    routeFile: 'admin-billing.routes.ts',
    route: 'POST /api/admin/billing/prices',
    mechanisms: ['last-write-wins'],
    evidence: [{ file: `${SVC}/admin/admin-billing.service.ts`, text: 'setPlanPrice' }],
  },
  {
    routeFile: 'admin-billing.routes.ts',
    route: 'POST /api/admin/workspaces/:id/billing-ledger',
    mechanisms: ['check-then-write'],
    evidence: [{ file: `${SVC}/admin/admin-billing.service.ts`, text: 'recordLedgerEntry' }],
  },
  {
    routeFile: 'admin-billing.routes.ts',
    route: 'POST /api/admin/billing/action-requests',
    mechanisms: ['last-write-wins'],
    evidence: [{ file: `${SVC}/admin/admin-billing.service.ts`, text: 'proposeActionRequest' }],
  },
  {
    routeFile: 'admin-billing.routes.ts',
    route: 'POST /api/admin/billing/action-requests/:id/decide',
    mechanisms: ['check-then-write'],
    evidence: [{ file: `${SVC}/admin/admin-billing.service.ts`, text: 'decideActionRequest' }],
  },
  {
    // Each issue is a NEW licence with its own id: a repeated click makes a
    // second licence (revocable), never overwrites the first.
    routeFile: 'admin-offline.routes.ts',
    route: 'POST /api/admin/offline/licences',
    mechanisms: ['unique-constraint'],
    evidence: [
      { file: `${SVC}/offline-license.service.ts`, text: 'issueDeviceLicense' },
      { file: 'docs/entitlement-01-migration.sql', text: 'license_id    uuid PRIMARY KEY' },
    ],
  },
  {
    routeFile: 'admin-offline.routes.ts',
    route: 'POST /api/admin/offline/licences/:id/revoke',
    mechanisms: ['check-then-write'],
    evidence: [{ file: `${SVC}/offline-license.service.ts`, text: 'revokeLicense' }],
  },
  {
    routeFile: 'admin-offline.routes.ts',
    route: 'POST /api/admin/offline/devices/:id/release',
    mechanisms: ['check-then-write'],
    evidence: [{ file: `${SVC}/offline-license.service.ts`, text: 'releaseDevice' }],
  },
  {
    routeFile: 'admin-offline.routes.ts',
    route: 'POST /api/admin/offline/bans/:id/lift',
    mechanisms: ['check-then-write'],
    evidence: [{ file: `${SVC}/offline-license.service.ts`, text: 'unbanLicense' }],
  },
  {
    routeFile: 'admin-offline.routes.ts',
    route: 'POST /api/admin/offline/reviews/:id/decide',
    mechanisms: ['check-then-write'],
    evidence: [{ file: `${SVC}/offline-license.service.ts`, text: 'reportTier1Violation' }],
  },
  {
    routeFile: 'admin-ops.routes.ts',
    route: 'POST /api/admin/ops/flags',
    mechanisms: ['last-write-wins'],
    evidence: [{ file: `${SVC}/admin/admin-ops.service.ts`, text: 'upsertFeatureFlag' }],
  },
  {
    routeFile: 'admin-ops.routes.ts',
    route: 'POST /api/admin/ops/jobs/:id/retry',
    mechanisms: ['last-write-wins'],
    evidence: [{ file: `${SVC}/admin/admin-ops.service.ts`, text: 'retryJob' }],
  },
  {
    routeFile: 'admin-ops.routes.ts',
    route: 'POST /api/admin/ops/announcements',
    mechanisms: ['last-write-wins'],
    evidence: [{ file: `${SVC}/admin/admin-ops.service.ts`, text: 'createAnnouncement' }],
  },
  {
    routeFile: 'admin-ops.routes.ts',
    route: 'POST /api/admin/ops/export-csv',
    mechanisms: ['last-write-wins'],
    evidence: [{ file: `${SVC}/admin/admin-security.service.ts`, text: 'logSecurityEvent' }],
  },
  {
    routeFile: 'billing.routes.ts',
    route: 'POST /api/billing/offline-license',
    mechanisms: ['check-then-write'],
    evidence: [
      {
        file: `${SVC}/offline-license.service.ts`,
        text: "from('offline_licenses')",
      },
    ],
  },
  {
    routeFile: 'billing.routes.ts',
    route: 'POST /api/billing/offline-license/:licenseId/revoke',
    mechanisms: ['state-idempotent'],
    evidence: [
      {
        file: `${SVC}/offline-license.service.ts`,
        text: "from('offline_licenses')",
      },
    ],
  },
  {
    routeFile: 'billing.routes.ts',
    route: 'POST /api/billing/devices/activate',
    mechanisms: ['state-idempotent'],
    evidence: [
      {
        file: `${SVC}/offline-license.service.ts`,
        text: "from('devices')",
      },
    ],
  },
  {
    routeFile: 'billing.routes.ts',
    route: 'POST /api/billing/devices/:deviceId/release',
    mechanisms: ['state-idempotent'],
    evidence: [
      {
        file: `${SVC}/offline-license.service.ts`,
        text: "from('devices')",
      },
    ],
  },
  {
    routeFile: 'billing.routes.ts',
    route: 'POST /api/billing/offline-license/activate-seat',
    mechanisms: ['check-then-write'],
    evidence: [
      {
        file: `${SVC}/offline-license.service.ts`,
        text: 'activateSeat(',
      },
    ],
  },
  {
    routeFile: 'billing.routes.ts',
    route: 'POST /api/billing/offline-license/connect',
    mechanisms: ['state-idempotent'],
    evidence: [
      {
        file: `${SVC}/offline-license.service.ts`,
        text: 'connectDevice(',
      },
    ],
  },
  {
    routeFile: 'billing.routes.ts',
    route: 'POST /api/billing/offline-license/tier1-report',
    mechanisms: ['check-then-write'],
    evidence: [
      {
        file: `${SVC}/offline-license.service.ts`,
        text: 'reportTier2Signal(',
      },
    ],
  },
  {
    routeFile: 'billing.routes.ts',
    route: 'POST /api/billing/offline-license/tier2-report',
    mechanisms: ['check-then-write'],
    evidence: [
      {
        file: `${SVC}/offline-license.service.ts`,
        text: 'reportTier2Signal(',
      },
    ],
  },

  // ─── Warehouses ──────────────────────────────────────────────────────────
  {
    routeFile: 'warehouse.routes.ts',
    route: 'POST /api/warehouses',
    mechanisms: ['last-write-wins'],
    evidence: [{ file: `${RT}/warehouse.routes.ts`, text: "'/api/warehouses'" }],
  },
  {
    routeFile: 'warehouse.routes.ts',
    route: 'PATCH /api/warehouses/:id',
    mechanisms: ['last-write-wins'],
    evidence: [{ file: `${RT}/warehouse.routes.ts`, text: "'/api/warehouses/:id'" }],
  },
  {
    routeFile: 'warehouse.routes.ts',
    route: 'DELETE /api/warehouses/:id',
    mechanisms: ['state-idempotent'],
    evidence: [{ file: `${RT}/warehouse.routes.ts`, text: "'/api/warehouses/:id'" }],
  },
  {
    routeFile: 'warehouse.routes.ts',
    route: 'POST /api/stock-transfers',
    mechanisms: ['idempotency-key', 'db-function'],
    evidence: [
      { file: `${RT}/warehouse.routes.ts`, text: 'idempotencyKey: readClientRequestId(request)' },
      {
        file: `${SVC}/warehouse.service.ts`,
        text: "supabase.rpc('warehouse_transfer_stock_keyed'",
      },
      {
        file: 'docs/stock-transfer-idempotency-migration.sql',
        text: 'EXCEPTION WHEN unique_violation THEN',
      },
    ],
  },
  {
    routeFile: 'warehouse.routes.ts',
    route: 'POST /api/warehouses/:id/assign',
    mechanisms: ['state-idempotent'],
    evidence: [{ file: `${RT}/warehouse.routes.ts`, text: "'/api/warehouses/:id/assign'" }],
  },

  // ─── The map of a warehouse ───────────────────────────────────────────────
  {
    routeFile: 'warehouse-map.routes.ts',
    route: 'POST /api/warehouses/:id/locations',
    // Two people label a shelf `A-01` at the same moment: the unique index
    // refuses the second, and the route answers «this code is taken» rather
    // than storing a duplicate the map could not tell apart.
    mechanisms: ['unique-constraint'],
    evidence: [
      { file: `${RT}/warehouse-map.routes.ts`, text: "'/api/warehouses/:id/locations'" },
      {
        file: 'docs/warehouse-map-01-migration.sql',
        text: 'CREATE UNIQUE INDEX IF NOT EXISTS storage_locations_code_per_warehouse',
      },
      {
        file: `${SVC}/inventory/warehouse-map.service.ts`,
        text: "throw new ConflictError('STORAGE_LOCATION_CODE_TAKEN')",
      },
    ],
  },
  {
    routeFile: 'warehouse-map.routes.ts',
    route: 'PATCH /api/storage-locations/:id',
    // Master data: naming a shelf or moving its rectangle. No money and no
    // stock moves, so the later edit stands — and the location is never
    // deleted, only retired.
    mechanisms: ['last-write-wins'],
    evidence: [
      { file: `${RT}/warehouse-map.routes.ts`, text: "'/api/storage-locations/:id'" },
      {
        file: `${SVC}/inventory/warehouse-map.service.ts`,
        text: 'patch.is_active = input.isActive',
      },
    ],
  },
  {
    routeFile: 'warehouse-map.routes.ts',
    route: 'POST /api/storage-locations/:id/place',
    // One Postgres function, row locks inside: two devices placing the same
    // product cannot both pass «the warehouse holds 12». Repeating the same
    // save leaves the same quantity.
    mechanisms: ['db-function', 'state-idempotent'],
    evidence: [
      { file: `${RT}/warehouse-map.routes.ts`, text: "'/api/storage-locations/:id/place'" },
      {
        file: `${SVC}/inventory/warehouse-map.service.ts`,
        text: "supabase.rpc('storage_place_stock'",
      },
      { file: 'docs/warehouse-map-01-migration.sql', text: 'FOR UPDATE;' },
      {
        file: 'docs/warehouse-map-01-migration.sql',
        text: 'ON CONFLICT (location_id, product_id) DO UPDATE',
      },
    ],
  },

  {
    routeFile: 'warehouse-map.routes.ts',
    route: 'PUT /api/storage-locations/:id/auto-shelf',
    // One setting row per (warehouse, product), upserted on its key: saving
    // the same choice twice leaves the same row; two choices = the last one.
    mechanisms: ['unique-constraint', 'state-idempotent'],
    evidence: [
      { file: `${RT}/warehouse-map.routes.ts`, text: "'/api/storage-locations/:id/auto-shelf'" },
      {
        file: `${SVC}/inventory/warehouse-map.service.ts`,
        text: "{ onConflict: 'warehouse_id,product_id' }",
      },
      {
        file: 'docs/shelf-capacity-01-migration.sql',
        text: 'PRIMARY KEY (warehouse_id, product_id)',
      },
    ],
  },

  // ─── Purchasing ──────────────────────────────────────────────────────────
  {
    routeFile: 'purchasing.routes.ts',
    route: 'POST /api/purchase-orders',
    mechanisms: ['idempotency-key', 'db-function'],
    evidence: [
      { file: `${RT}/purchasing.routes.ts`, text: 'idempotencyKey: readClientRequestId(request)' },
      {
        file: `${SVC}/purchasing.service.ts`,
        text: "sourceIdOf(workspaceId, 'purchase_order', key)",
      },
      { file: `${SVC}/purchasing.service.ts`, text: "supabase.rpc('purchase_order_write'" },
    ],
  },
  {
    routeFile: 'purchasing.routes.ts',
    route: 'PATCH /api/purchase-orders/:id',
    mechanisms: ['conditional-update'],
    evidence: [
      { file: `${SVC}/purchasing.service.ts`, text: "query = query.neq('status', 'received')" },
      {
        file: 'packages/validation/src/schemas/purchasing.schema.ts',
        text: 'settablePurchaseOrderStatusSchema',
      },
    ],
  },
  {
    routeFile: 'purchasing.routes.ts',
    route: 'POST /api/purchase-orders/:id/receive',
    mechanisms: ['conditional-update', 'unique-constraint'],
    evidence: [
      { file: `${SVC}/purchasing.service.ts`, text: ".eq('status', priorStatus)" },
      { file: SQL, text: 'cost_layers_source_key' },
    ],
  },

  // ─── Accounting (prefix /api/accounting) ─────────────────────────────────
  {
    routeFile: 'accounting.routes.ts',
    route: 'POST /accounts',
    mechanisms: ['last-write-wins'],
    evidence: [{ file: `${RT}/accounting.routes.ts`, text: "'/accounts'" }],
  },
  {
    routeFile: 'accounting.routes.ts',
    route: 'PATCH /accounts/:id',
    mechanisms: ['last-write-wins'],
    evidence: [{ file: `${RT}/accounting.routes.ts`, text: "'/accounts/:id'" }],
  },
  {
    routeFile: 'accounting.routes.ts',
    route: 'POST /journal',
    mechanisms: ['idempotency-key', 'db-function', 'unique-constraint'],
    evidence: [
      { file: `${RT}/accounting.routes.ts`, text: 'idempotencyKey: readClientRequestId(request)' },
      {
        file: `${SVC}/accounting/accounting.service.ts`,
        text: "sourceIdOf(ctx.workspaceId, 'manual', options.idempotencyKey)",
      },
      {
        file: `${SVC}/accounting/accounting.repository.ts`,
        text: "supabase.rpc('accounting_post_journal_entry'",
      },
      { file: SQL, text: 'journal_entries_source_key' },
    ],
  },
  {
    routeFile: 'accounting.routes.ts',
    route: 'POST /journal/:id/post',
    mechanisms: ['conditional-update'],
    evidence: [
      {
        file: `${SVC}/accounting/accounting.service.ts`,
        text: "setEntryStatus(ctx.workspaceId, id, 'draft', 'posted'",
      },
    ],
  },
  {
    routeFile: 'accounting.routes.ts',
    route: 'POST /journal/:id/reverse',
    mechanisms: ['unique-constraint'],
    evidence: [
      { file: `${SVC}/accounting/accounting.service.ts`, text: "sourceType: 'reversal'" },
      { file: SQL, text: 'journal_entries_source_key' },
    ],
  },
  {
    routeFile: 'accounting.routes.ts',
    route: 'PUT /period-lock',
    mechanisms: ['last-write-wins'],
    evidence: [{ file: `${SVC}/accounting/accounting.service.ts`, text: 'async setPeriodLock(' }],
  },
  {
    routeFile: 'accounting.routes.ts',
    route: 'POST /year-end/close',
    mechanisms: ['check-then-write', 'unique-constraint'],
    evidence: [
      { file: `${SVC}/accounting/accounting.service.ts`, text: 'YEAR_END_ALREADY_CLOSED' },
      {
        file: `${SVC}/accounting/accounting.service.ts`,
        text: "sourceIdOf(ctx.workspaceId, 'year_end_close', plan.from, plan.to)",
      },
      { file: SQL, text: 'journal_entries_source_key' },
    ],
  },
  {
    // Capability #69 — the month-end package.
    //
    // ⚠️ EVERY STEP IS INDIVIDUALLY IDEMPOTENT, and that is the whole claim
    // here — there is no transaction spanning the five engines, because a
    // transaction across depreciation, revaluation, repost, the year-end close
    // and a period lock is not something Postgres can give across those
    // boundaries. What it has instead:
    //
    //   depreciation   posted_at IS NULL, plus the ledger's already_posted
    //   revaluation    upsert on (workspace_id, as_of); reverses the last run
    //   cost repost    planRepost emits nothing when the recomputation agrees,
    //                  and the source id is stable per document+line+product
    //   year-end       the same check-then-write + unique index as above
    //   period lock    setPeriodLock re-reads the whole set before writing
    //
    // ⚠️ `check-then-write` is listed FIRST and honestly, because it is the
    // weakest of the seven and it is what stops a second caller from opening a
    // run at all. Two genuinely simultaneous runs could still interleave; every
    // individual step above would then find its work already done. That is a
    // materially weaker guarantee than `db-function` gives elsewhere in this
    // map, and the reason is stated rather than glossed (§13).
    routeFile: 'accounting.routes.ts',
    route: 'POST /month-end',
    mechanisms: ['check-then-write', 'state-idempotent'],
    evidence: [
      // The stop condition: a failed step withholds the lock.
      {
        file: `${SVC}/accounting/month-end.domain.ts`,
        text: "code: 'MONTH_END_STEP_FAILED'",
      },
      // Depreciation: the query that makes a second run find nothing to do.
      {
        file: `${SVC}/assets/assets.service.ts`,
        text: ".is('posted_at', null)",
      },
      // Revaluation: one row per workspace+date, so a re-run replaces it.
      { file: SQL, text: 'fx_revaluations' },
      // Repost: an adjustment exists only when the recomputation disagrees.
      {
        file: `${SVC}/inventory-costing/repost.domain.ts`,
        text: 'if (differenceMinor !== 0)',
      },
    ],
  },
  // ─── Activities ──────────────────────────────────────────────────────────
  {
    routeFile: 'activity.routes.ts',
    route: 'PATCH /api/v1/activities/mark-read',
    mechanisms: ['db-function'],
    evidence: [
      {
        file: `${SVC}/activity.service.ts`,
        text: "supabase.rpc('activity_mark_read'",
      },
      {
        file: 'docs/activity-reads-01-migration.sql',
        text: 'CREATE OR REPLACE FUNCTION public.activity_mark_read(',
      },
    ],
  },
  {
    routeFile: 'activity.routes.ts',
    route: 'PATCH /api/v1/activities/mark-all-read',
    mechanisms: ['db-function'],
    evidence: [
      {
        file: `${SVC}/activity.service.ts`,
        text: "supabase.rpc('activity_mark_all_read'",
      },
      {
        file: 'docs/activity-reads-01-migration.sql',
        text: 'CREATE OR REPLACE FUNCTION public.activity_mark_all_read(',
      },
    ],
  },
  {
    routeFile: 'activity.routes.ts',
    route: 'DELETE /api/v1/activities/:id',
    mechanisms: ['state-idempotent'],
    evidence: [
      {
        file: `${SVC}/activity.service.ts`,
        text: '.delete()',
      },
    ],
  },
  // ─── Cloud Migration ──────────────────────────────────────────────────
  {
    routeFile: 'cloud-migration.routes.ts',
    route: 'POST /api/cloud-migration/jobs',
    mechanisms: ['check-then-write'],
    evidence: [
      {
        file: `${SVC}/cloud-migration/cloud-migration.service.ts`,
        text: 'MIGRATION_TARGET_WORKSPACE_NOT_EMPTY',
      },
    ],
  },
  {
    routeFile: 'cloud-migration.routes.ts',
    route: 'POST /api/cloud-migration/jobs/:id/chunk',
    mechanisms: ['lease', 'idempotency-key'],
    evidence: [
      {
        file: `${SVC}/cloud-migration/cloud-migration.service.ts`,
        text: 'claimJob',
      },
      {
        file: `${SVC}/cloud-migration/cloud-migration.service.ts`,
        text: 'makeKey',
      },
    ],
  },
  {
    routeFile: 'cloud-migration.routes.ts',
    route: 'POST /api/cloud-migration/jobs/:id/reconcile',
    mechanisms: ['lease'],
    evidence: [
      {
        file: `${SVC}/cloud-migration/cloud-migration.service.ts`,
        text: 'claimJob',
      },
    ],
  },
  {
    routeFile: 'cloud-migration.routes.ts',
    route: 'POST /api/cloud-migration/jobs/:id/confirm',
    mechanisms: ['state-idempotent'],
    evidence: [
      {
        file: 'docs/cloud-migration-01-migration.sql',
        text: 'fn_cloud_migration_jobs_status_guard',
      },
    ],
  },
]

/** Route files whose every mutating handler must appear above. */
export const COVERED_ROUTE_FILES: readonly string[] = [
  ...new Set(CONCURRENCY_SAFETY_MAP.map((entry) => entry.routeFile)),
]
