-- ============================================================================
-- performance/scripts/db/probe-semantic-null-defaults.sql
--
-- Proves docs/semantic-null-defaults-migration.sql on the lab database:
-- the same INSERT shapes the application performs now read NULL from every
-- semantic column that previously defaulted to now().
--
-- Everything runs inside one transaction that is ROLLED BACK — the lab is
-- left exactly as it was (no residue, nothing to clean up).
--
-- Expected result on a fixed database: six rows, value = NULL, is_null = true.
-- ============================================================================

BEGIN;

WITH m AS (
  INSERT INTO workspace_members (workspace_id, user_id, role, has_access)
  VALUES ('0387d61d-786c-4884-b355-e8550fcacef6', '2a51e3d6-e3c9-4947-ab4f-5bbc54a8ec8e', 'member', true)
  RETURNING suspended_at AS v
), a AS (
  INSERT INTO accounts (workspace_id, code, name, type, user_id)
  VALUES ('0387d61d-786c-4884-b355-e8550fcacef6', 'PROBE-0000', 'probe account (rolled back)', 'asset', '2a51e3d6-e3c9-4947-ab4f-5bbc54a8ec8e')
  RETURNING deleted_at AS v
), j AS (
  INSERT INTO journal_entries (workspace_id, date, user_id)
  VALUES ('0387d61d-786c-4884-b355-e8550fcacef6', current_date, '2a51e3d6-e3c9-4947-ab4f-5bbc54a8ec8e')
  RETURNING deleted_at AS v
), p AS (
  -- NOTE: the service inserts workspace_id = the zero uuid
  -- (password-reset.service.ts:95) and the FK here refuses it — recorded as an
  -- M2 finding; this probe uses the real workspace to exercise the DEFAULTS,
  -- which are what changed.
  INSERT INTO password_reset_tokens (user_id, workspace_id, token_hash)
  VALUES ('2a51e3d6-e3c9-4947-ab4f-5bbc54a8ec8e', '0387d61d-786c-4884-b355-e8550fcacef6', repeat('a', 64))
  RETURNING used_at AS u, revoked_at AS r, deleted_at AS d
)
SELECT 'workspace_members.suspended_at' AS column_name, (SELECT v FROM m)::text AS value, (SELECT v FROM m) IS NULL AS is_null
UNION ALL
SELECT 'accounts.deleted_at', (SELECT v FROM a)::text, (SELECT v FROM a) IS NULL
UNION ALL
SELECT 'journal_entries.deleted_at', (SELECT v FROM j)::text, (SELECT v FROM j) IS NULL
UNION ALL
SELECT 'password_reset_tokens.used_at', (SELECT u FROM p)::text, (SELECT u FROM p) IS NULL
UNION ALL
SELECT 'password_reset_tokens.revoked_at', (SELECT r FROM p)::text, (SELECT r FROM p) IS NULL
UNION ALL
SELECT 'password_reset_tokens.deleted_at', (SELECT d FROM p)::text, (SELECT d FROM p) IS NULL;

ROLLBACK;
