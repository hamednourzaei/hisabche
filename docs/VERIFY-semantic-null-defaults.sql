-- VERIFY semantic-null-defaults — read-only. Every row must say ok = true.
--
-- (Run docs/semantic-null-defaults-migration.sql first. In a fresh canonical
--  rebuild this file sorts before its migration — the same queue-order wart as
--  the other VERIFY files — so run it by name after the migration, or accept
--  the skip the bootstrap driver records for read-only diagnostics.)
--
-- 29 claimed columns, one whole-class invariant, and one «must not overreach»
-- check. The invariant is the one that matters most: after this file, NO
-- nullable timestamp column in the database defaults to now() — except
-- created_at / updated_at, which both schemas default on purpose.
SELECT 'workspace_members.suspended_at has no default' AS check,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'workspace_members'
                  AND column_name = 'suspended_at'
                  AND column_default IS NULL) AS ok
UNION ALL
SELECT 'accounts.deleted_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'accounts'
                  AND column_name = 'deleted_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'journal_entries.deleted_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'journal_entries'
                  AND column_name = 'deleted_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'invoices.finalized_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'invoices'
                  AND column_name = 'finalized_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'invoices.lock_expires_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'invoices'
                  AND column_name = 'lock_expires_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'profiles.onboarding_completed_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'profiles'
                  AND column_name = 'onboarding_completed_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'workflows.deleted_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'workflows'
                  AND column_name = 'deleted_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'password_reset_tokens.used_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'password_reset_tokens'
                  AND column_name = 'used_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'password_reset_tokens.revoked_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'password_reset_tokens'
                  AND column_name = 'revoked_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'password_reset_tokens.deleted_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'password_reset_tokens'
                  AND column_name = 'deleted_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'background_jobs.completed_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'background_jobs'
                  AND column_name = 'completed_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'background_jobs.started_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'background_jobs'
                  AND column_name = 'started_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'customers.synced_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'customers'
                  AND column_name = 'synced_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'event_log.completed_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'event_log'
                  AND column_name = 'completed_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'event_log.next_retry_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'event_log'
                  AND column_name = 'next_retry_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'invoices.synced_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'invoices'
                  AND column_name = 'synced_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'leaves.approved_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'leaves'
                  AND column_name = 'approved_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'notifications.read_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'notifications'
                  AND column_name = 'read_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'products.synced_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'products'
                  AND column_name = 'synced_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'project_members.joined_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'project_members'
                  AND column_name = 'joined_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'project_tasks.completed_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'project_tasks'
                  AND column_name = 'completed_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'purchase_orders.received_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'purchase_orders'
                  AND column_name = 'received_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'sync_logs.completed_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'sync_logs'
                  AND column_name = 'completed_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'sync_queue.processed_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'sync_queue'
                  AND column_name = 'processed_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'transactions.synced_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'transactions'
                  AND column_name = 'synced_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'webhook_events.processed_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'webhook_events'
                  AND column_name = 'processed_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'workflow_instances.completed_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'workflow_instances'
                  AND column_name = 'completed_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'workspace_invites.accepted_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'workspace_invites'
                  AND column_name = 'accepted_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'workspace_members.joined_at has no default',
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'workspace_members'
                  AND column_name = 'joined_at'
                  AND column_default IS NULL)
UNION ALL
SELECT 'the whole class: no nullable timestamp column defaults to now()',
       NOT EXISTS (SELECT 1 FROM information_schema.columns c
                    WHERE c.table_schema = 'public'
                      AND c.data_type LIKE 'timestamp%'
                      AND c.is_nullable = 'YES'
                      AND c.column_default = 'now()'
                      AND c.column_name NOT IN ('created_at', 'updated_at'))
UNION ALL
SELECT 'must not overreach: the NOT NULL defaults both schemas share are kept',
       (SELECT count(*) FROM information_schema.columns c
         WHERE c.table_schema = 'public'
           AND c.is_nullable = 'NO'
           AND c.column_default = 'now()'
           AND (c.table_name, c.column_name) IN (
             ('background_jobs', 'scheduled_at'),
             ('member_branches', 'assigned_at'),
             ('password_reset_tokens', 'expires_at'),
             ('subscriptions', 'trial_started_at'),
             ('subscriptions', 'trial_ends_at'),
             ('sync_logs', 'started_at'),
             ('workspace_invites', 'expires_at'))) = 7;

-- ============================================================================
-- REVIEW (informational — expected EMPTY). Any row here is a nullable
-- timestamp that still defaults to now(): either a column this file missed or
-- a new one the schema grew. Show it to a reviewer; do not act on it blindly.
-- ============================================================================
SELECT c.table_name, c.column_name
  FROM information_schema.columns c
 WHERE c.table_schema = 'public'
   AND c.data_type LIKE 'timestamp%'
   AND c.is_nullable = 'YES'
   AND c.column_default = 'now()'
   AND c.column_name NOT IN ('created_at', 'updated_at')
 ORDER BY c.table_name, c.column_name;
