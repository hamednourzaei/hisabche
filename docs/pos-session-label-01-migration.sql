-- ============================================================================
-- docs/pos-session-label-01-migration.sql
--
-- Till page: a NAME for a till («صندوق جلوی مغازه», «صندوق شعبه‌ی دو»).
--
-- A till is a row of pos_sessions and had nothing a person could call it by —
-- the list showed its opening time. This adds one nullable text column. It is
-- the only thing about a till that can be edited: money, counts and status
-- stay what the movements made them.
--
-- Additive and safe to re-run: ADD COLUMN IF NOT EXISTS, and the length check
-- is dropped and re-added under the same name. NULL (no name) stays valid, so
-- no existing row can fail it.
-- ============================================================================

-- LOCK NOTE: ALTER TABLE needs an exclusive lock on a table the live app reads.
-- The whole file is one transaction, so a failed run changes nothing and can be
-- re-run when the app is quiet; lock_timeout makes it give up quickly.

BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS label text;

ALTER TABLE pos_sessions DROP CONSTRAINT IF EXISTS pos_sessions_label_length_check;
ALTER TABLE pos_sessions
  ADD CONSTRAINT pos_sessions_label_length_check
  CHECK (label IS NULL OR (char_length(label) BETWEEN 1 AND 80));

COMMIT;

-- ============================================================================
-- ROLLBACK (loses every till name that was typed):
--   BEGIN;
--   ALTER TABLE pos_sessions DROP CONSTRAINT IF EXISTS pos_sessions_label_length_check;
--   ALTER TABLE pos_sessions DROP COLUMN IF EXISTS label;
--   COMMIT;
--
-- MITIGATION without rollback: the application treats a missing column as
-- «names are not set up» and keeps working; nothing else reads this column.
--
-- VERIFY: docs/VERIFY-pos-session-label-01.sql
-- ============================================================================
