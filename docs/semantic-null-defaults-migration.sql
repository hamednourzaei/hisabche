-- ============================================================================
-- docs/semantic-null-defaults-migration.sql
--
-- Nullable timestamps that MEAN something must not default to now().
--
-- (Found by the capacity lab, 2026-10-17: on a freshly rebuilt database the
--  workspace owner is born «suspended», every invoice is born «finalized»,
--  every account and every ledger entry is born «deleted». None of these
--  happen on the live database — see WHY below.)
--
-- 29 columns. Two evidence classes — neither is a guess:
--   CLASS A (10) — a reader in this repository treats NULL as «not yet» and
--                  the writer omits the column; measured on the rebuild.
--   CLASS B (19) — the production schema itself carries no default on the
--                  column (captured 2026-10-17, stored verbatim at
--                  performance/raw/production-schema-dump.sql); the rebuild
--                  diverges from production. No reader depends on a value
--                  appearing by itself.
-- ============================================================================
--
-- WHY
--
-- docs/base-schema-migration.sql (mirrored in docs/SETUP-COMPLETE.sql and
-- docs/_bundle.sql) declares `DEFAULT now()` on these nullable timestamp
-- columns. Both baseline files use `CREATE TABLE IF NOT EXISTS`. On the live
-- database the tables already existed, so those CREATE TABLEs never applied
-- and the defaults were never added — which is why the live product works
-- today. A REBUILT database gets every one of them.
-- docs/module-created-at-default-migration.sql tells the same story in the
-- opposite direction (a default the live database never got).
--
-- CLASS A — WHO READS NULL (backend/src unless noted)
--
--   workspace_members.suspended_at   private.auth_workspace_ids() and
--                                    resolve_workspace_access:
--                                    `suspended_at IS NULL` = an active member.
--                                    workspace.service.ts:133 and :596 never
--                                    set the column on insert — so on a
--                                    rebuild the owner sees no workspace.
--   accounts.deleted_at              accounting.repository.ts:135,151 filter
--                                    `IS NULL`; insertAccount (:158) omits the
--                                    column; accounting_post_journal_entry
--                                    refuses a line whose account has it set.
--   journal_entries.deleted_at       accounting.repository.ts:204,224;
--                                    the RPC’s own INSERT does not name the
--                                    column, so every posted entry would be
--                                    born deleted.
--   invoices.finalized_at            invoice_write_document aborts an item
--                                    replacement with 55000 once set
--                                    (invoice-write-document-migration.sql:167);
--                                    sync.service.ts:480 refuses item
--                                    mutations on a finalized invoice.
--   invoices.lock_expires_at         sync.service.ts:840 sets it when locking,
--                                    :853 sets it back to NULL when unlocking —
--                                    NULL is the canonical «no lock».
--   profiles.onboarding_completed_at auth.routes.ts:260 reads
--                                    Boolean(profile?.onboarding_completed_at);
--                                    the signup upsert (:362) omits it, so a
--                                    rebuild skips every new user’s onboarding.
--   workflows.deleted_at             workflow.service.ts:176 filters `IS NULL`;
--                                    createWorkflow (:133) omits the column.
--   password_reset_tokens.used_at,   password-reset.service.ts:154-156 filters
--   revoked_at, deleted_at           `IS NULL`; the insert (:93) omits all
--                                    three, so a rebuild makes every fresh
--                                    reset token instantly invalid.
--
-- MEASURED on the capacity-lab rebuild (PostgreSQL 17.10, 2026-10-17) with the
-- application’s own INSERT shapes: before the fix they read now(), after it
-- they read NULL — evidence at performance/raw/M2-null-defaults-probe.txt and
-- backend/src/__tests__/semantic-null-defaults.pg.test.ts.
--
-- CLASS B — PRODUCTION PARITY (19 columns)
--
--   background_jobs.completed_at, background_jobs.started_at,
--   customers.synced_at, event_log.completed_at, event_log.next_retry_at,
--   invoices.synced_at, leaves.approved_at, notifications.read_at,
--   products.synced_at, project_members.joined_at, project_tasks.completed_at,
--   purchase_orders.received_at, sync_logs.completed_at,
--   sync_queue.processed_at, transactions.synced_at,
--   webhook_events.processed_at, workflow_instances.completed_at,
--   workspace_invites.accepted_at, workspace_members.joined_at
--
--   Production runs without a default on each of these; the rebuild asserted
--   «happened now» for a row where production says «unknown until written».
--   The application already writes every one of them explicitly when the event
--   happens; before this file, a rebuilt database reported a clock reading the
--   product never had.
--
-- The same fix was applied once before, by hand, for warehouses.deleted_at in
-- docs/multi-warehouse-migration.sql:50 — «every reader filters deleted_at IS
-- NULL — a new warehouse would be born «deleted»». This file extends that
-- decision to the remaining columns of the class.
--
-- KEPT — NOT NULL timestamps that DEFAULT now() in BOTH schemas (do not
-- touch; the database is the actor the product expects):
--   background_jobs.scheduled_at, member_branches.assigned_at,
--   password_reset_tokens.expires_at, subscriptions.trial_started_at,
--   subscriptions.trial_ends_at, sync_logs.started_at,
--   workspace_invites.expires_at — and created_at / updated_at everywhere.
--   (docs/module-created-at-default-migration.sql moves production toward
--   having created_at defaults; the rebuild matching that is the destination,
--   not a divergence.)
--
-- ADDITIVE · IDEMPOTENT · RE-RUNNABLE
--   DROP DEFAULT states a destination on a nullable column: a catalogue-only
--   change, no row is rewritten, no value changes. Where the default is
--   already absent it is a no-op.
--
-- ROLLBACK / MITIGATION
--   Each statement below restores the defect; only do this to compare
--   behaviour. To undo:
--
--     BEGIN;
--       ALTER TABLE public.workspace_members     ALTER COLUMN suspended_at            SET DEFAULT now();
--       ALTER TABLE public.accounts              ALTER COLUMN deleted_at              SET DEFAULT now();
--       ALTER TABLE public.journal_entries       ALTER COLUMN deleted_at              SET DEFAULT now();
--       ALTER TABLE public.invoices              ALTER COLUMN finalized_at            SET DEFAULT now();
--       ALTER TABLE public.invoices              ALTER COLUMN lock_expires_at         SET DEFAULT now();
--       ALTER TABLE public.profiles              ALTER COLUMN onboarding_completed_at SET DEFAULT now();
--       ALTER TABLE public.workflows             ALTER COLUMN deleted_at              SET DEFAULT now();
--       ALTER TABLE public.password_reset_tokens ALTER COLUMN used_at                 SET DEFAULT now();
--       ALTER TABLE public.password_reset_tokens ALTER COLUMN revoked_at              SET DEFAULT now();
--       ALTER TABLE public.password_reset_tokens ALTER COLUMN deleted_at              SET DEFAULT now();
--       ALTER TABLE public.background_jobs       ALTER COLUMN completed_at            SET DEFAULT now();
--       ALTER TABLE public.background_jobs       ALTER COLUMN started_at              SET DEFAULT now();
--       ALTER TABLE public.customers             ALTER COLUMN synced_at               SET DEFAULT now();
--       ALTER TABLE public.event_log             ALTER COLUMN completed_at            SET DEFAULT now();
--       ALTER TABLE public.event_log             ALTER COLUMN next_retry_at           SET DEFAULT now();
--       ALTER TABLE public.invoices              ALTER COLUMN synced_at               SET DEFAULT now();
--       ALTER TABLE public.leaves                ALTER COLUMN approved_at             SET DEFAULT now();
--       ALTER TABLE public.notifications         ALTER COLUMN read_at                 SET DEFAULT now();
--       ALTER TABLE public.products              ALTER COLUMN synced_at               SET DEFAULT now();
--       ALTER TABLE public.project_members       ALTER COLUMN joined_at               SET DEFAULT now();
--       ALTER TABLE public.project_tasks         ALTER COLUMN completed_at            SET DEFAULT now();
--       ALTER TABLE public.purchase_orders       ALTER COLUMN received_at             SET DEFAULT now();
--       ALTER TABLE public.sync_logs             ALTER COLUMN completed_at            SET DEFAULT now();
--       ALTER TABLE public.sync_queue            ALTER COLUMN processed_at            SET DEFAULT now();
--       ALTER TABLE public.transactions          ALTER COLUMN synced_at               SET DEFAULT now();
--       ALTER TABLE public.webhook_events        ALTER COLUMN processed_at            SET DEFAULT now();
--       ALTER TABLE public.workflow_instances    ALTER COLUMN completed_at            SET DEFAULT now();
--       ALTER TABLE public.workspace_invites     ALTER COLUMN accepted_at             SET DEFAULT now();
--       ALTER TABLE public.workspace_members     ALTER COLUMN joined_at               SET DEFAULT now();
--     COMMIT;
--
-- ⚠️ LOCK NOTE: ALTER TABLE needs ACCESS EXCLUSIVE on a table the live app may
-- be reading. The whole file is ONE transaction — a failure changes nothing
-- and it can simply be re-run when the app is quiet. If a statement fails with
-- «column ... does not exist», that database never had the column: remove that
-- one line and re-run; nothing is half-applied.
-- ============================================================================

BEGIN;

-- Give up rather than queue behind (or deadlock with) live queries.
SET LOCAL lock_timeout = '5s';

-- CLASS A — readers treat NULL as «not yet»; the writer omits the column.
ALTER TABLE public.workspace_members     ALTER COLUMN suspended_at            DROP DEFAULT;
ALTER TABLE public.accounts              ALTER COLUMN deleted_at              DROP DEFAULT;
ALTER TABLE public.journal_entries       ALTER COLUMN deleted_at              DROP DEFAULT;
ALTER TABLE public.invoices              ALTER COLUMN finalized_at            DROP DEFAULT;
ALTER TABLE public.invoices              ALTER COLUMN lock_expires_at         DROP DEFAULT;
ALTER TABLE public.profiles              ALTER COLUMN onboarding_completed_at DROP DEFAULT;
ALTER TABLE public.workflows             ALTER COLUMN deleted_at              DROP DEFAULT;
ALTER TABLE public.password_reset_tokens ALTER COLUMN used_at                 DROP DEFAULT;
ALTER TABLE public.password_reset_tokens ALTER COLUMN revoked_at              DROP DEFAULT;
ALTER TABLE public.password_reset_tokens ALTER COLUMN deleted_at              DROP DEFAULT;

-- CLASS B — production carries no default on these; the rebuild must match.
ALTER TABLE public.background_jobs       ALTER COLUMN completed_at            DROP DEFAULT;
ALTER TABLE public.background_jobs       ALTER COLUMN started_at              DROP DEFAULT;
ALTER TABLE public.customers             ALTER COLUMN synced_at               DROP DEFAULT;
ALTER TABLE public.event_log             ALTER COLUMN completed_at            DROP DEFAULT;
ALTER TABLE public.event_log             ALTER COLUMN next_retry_at           DROP DEFAULT;
ALTER TABLE public.invoices              ALTER COLUMN synced_at               DROP DEFAULT;
ALTER TABLE public.leaves                ALTER COLUMN approved_at             DROP DEFAULT;
ALTER TABLE public.notifications         ALTER COLUMN read_at                 DROP DEFAULT;
ALTER TABLE public.products              ALTER COLUMN synced_at               DROP DEFAULT;
ALTER TABLE public.project_members       ALTER COLUMN joined_at               DROP DEFAULT;
ALTER TABLE public.project_tasks         ALTER COLUMN completed_at            DROP DEFAULT;
ALTER TABLE public.purchase_orders       ALTER COLUMN received_at             DROP DEFAULT;
ALTER TABLE public.sync_logs             ALTER COLUMN completed_at            DROP DEFAULT;
ALTER TABLE public.sync_queue            ALTER COLUMN processed_at            DROP DEFAULT;
ALTER TABLE public.transactions          ALTER COLUMN synced_at               DROP DEFAULT;
ALTER TABLE public.webhook_events        ALTER COLUMN processed_at            DROP DEFAULT;
ALTER TABLE public.workflow_instances    ALTER COLUMN completed_at            DROP DEFAULT;
ALTER TABLE public.workspace_invites     ALTER COLUMN accepted_at             DROP DEFAULT;
ALTER TABLE public.workspace_members     ALTER COLUMN joined_at               DROP DEFAULT;

COMMIT;

-- ============================================================================
-- VERIFY (read-only) — run docs/VERIFY-semantic-null-defaults.sql. Every row
-- must say ok = true.
-- ============================================================================
