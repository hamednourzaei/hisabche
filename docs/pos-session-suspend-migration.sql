-- ============================================================================
-- docs/pos-session-suspend-migration.sql
--
-- Till page: «تعلیق» (suspend) a till from its row (request #92).
--
-- Adds the status value 'suspended' to pos_sessions. A suspended till takes no
-- sales, cash movements or transfers (those require status 'open'), keeps its
-- money and history, and can be resumed or closed.
--
-- Replaces the CHECK constraint with a WIDER one — every value allowed before
-- is still allowed, so no existing row can fail it. Safe to re-run.
--
-- The unique index pos_sessions_one_open stays `WHERE status = 'open'`: while
-- a till is suspended its person may open another; resuming the first then
-- answers POS_SESSION_ALREADY_OPEN instead of creating two open drawers.
-- ============================================================================

BEGIN;

ALTER TABLE pos_sessions DROP CONSTRAINT IF EXISTS pos_sessions_status_check;
ALTER TABLE pos_sessions
  ADD CONSTRAINT pos_sessions_status_check
  CHECK (status IN ('open', 'suspended', 'closing', 'closed', 'force_closed'));

COMMIT;

-- ============================================================================
-- ROLLBACK (only when no row is 'suspended'; resume or close those first):
--   BEGIN;
--   ALTER TABLE pos_sessions DROP CONSTRAINT IF EXISTS pos_sessions_status_check;
--   ALTER TABLE pos_sessions ADD CONSTRAINT pos_sessions_status_check
--     CHECK (status IN ('open', 'closing', 'closed', 'force_closed'));
--   COMMIT;
--
-- VERIFY (read-only) — should return true:
--   SELECT pg_get_constraintdef(oid) LIKE '%suspended%' AS ok
--   FROM pg_constraint WHERE conname = 'pos_sessions_status_check';
-- ============================================================================
