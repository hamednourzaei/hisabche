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
    evidence: [{ file: `${SVC}/pos/pos.service.ts`, text: ".update({ status: 'voided' })" }],
  },
  {
    routeFile: 'pos.routes.ts',
    route: 'POST /sessions/:id/cash',
    mechanisms: ['idempotency-key'],
    evidence: [
      { file: `${RT}/pos.routes.ts`, text: 'movementId: z.string().uuid().optional()' },
      { file: `${SVC}/pos/pos.service.ts`, text: "error?.code === '23505' && input.movementId" },
      {
        file: 'packages/ui/src/components/ui/till/containers/till-container.tsx',
        text: 'movementId: crypto.randomUUID()',
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
]

/** Route files whose every mutating handler must appear above. */
export const COVERED_ROUTE_FILES: readonly string[] = [
  ...new Set(CONCURRENCY_SAFETY_MAP.map((entry) => entry.routeFile)),
]
