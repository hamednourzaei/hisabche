-- ============================================================================
-- docs/pos-till-currency-01-migration.sql
--
-- Till page: a CURRENCY for a till (e.g. 'AFN', 'USD', 'EUR', 'XAU').
--
-- Every till holds exactly one currency, chosen when it is opened and never
-- changed. Existing rows stay NULL, which the application resolves to the
-- workspace's books currency (no backfill, no guess).
--
-- The unique index pos_sessions_one_open is updated to include the currency,
-- so the same person in the same branch may hold two open tills of DIFFERENT
-- currencies (e.g. an AFN till and a USD till), while refusing a second open
-- till of the SAME currency.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- 1. Add currency column (nullable, no default)
ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS currency text;

-- 2. Add CHECK constraint (3 uppercase ASCII letters or NULL)
ALTER TABLE pos_sessions DROP CONSTRAINT IF EXISTS pos_sessions_currency_check;
ALTER TABLE pos_sessions
  ADD CONSTRAINT pos_sessions_currency_check
  CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');

-- 3. Replace pos_sessions_one_open unique index to distinguish by currency
DROP INDEX IF EXISTS pos_sessions_one_open;
CREATE UNIQUE INDEX IF NOT EXISTS pos_sessions_one_open
  ON pos_sessions (
    workspace_id,
    opened_by,
    COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(currency, '')
  )
  WHERE status = 'open';

COMMIT;

-- ============================================================================
-- ROLLBACK:
--   BEGIN;
--   DROP INDEX IF EXISTS pos_sessions_one_open;
--   CREATE UNIQUE INDEX IF NOT EXISTS pos_sessions_one_open
--     ON pos_sessions (workspace_id, opened_by, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid))
--     WHERE status = 'open';
--   ALTER TABLE pos_sessions DROP CONSTRAINT IF EXISTS pos_sessions_currency_check;
--   ALTER TABLE pos_sessions DROP COLUMN IF EXISTS currency;
--   COMMIT;
--
-- VERIFY: docs/VERIFY-pos-till-currency-01.sql
-- ============================================================================
