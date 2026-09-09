-- ============================================================================
-- MODULE AUTH — session invalidation line
--
-- WHAT THIS IS FOR
--
-- Changing a password did not put anyone out. Only the password-reset tokens
-- were revoked; active sign-in sessions kept working until each token expired
-- on its own. Someone who resets their password because they believe another
-- person is inside their account did not remove that person.
--
-- Supabase exposes no "revoke every session for this user id" call —
-- `auth.admin.signOut()` takes one specific JWT — and this backend caches its
-- token verifications keyed BY TOKEN, so the other tokens of a user cannot be
-- enumerated to drop them.
--
-- So instead of revoking, a line in time: every access token carries an `iat`
-- (issued-at) claim, and `auth.middleware.ts` rejects any token issued before
-- this column's value. ERPNext and Odoo achieve the same by deleting session
-- rows; this reaches it without a session table.
--
-- ----------------------------------------------------------------------------
-- ADDITIVE AND RE-RUNNABLE
--
-- One nullable column. NULL means "no invalidation has ever been requested for
-- this account", which is the correct reading for every existing row — not
-- "reject everything". Running this file twice changes nothing.
--
-- ----------------------------------------------------------------------------
-- ROLLBACK / MITIGATION
--
-- The application is SCHEMA-TOLERANT in both directions:
--
--   · Before this runs, `getSessionEpochSeconds()` sees error 42703/PGRST204,
--     treats it as "no lock recorded", and authentication behaves exactly as it
--     does today. Deploying the code before the migration is safe.
--   · After this runs, dropping the column returns the system to that state.
--
-- To undo:
--     ALTER TABLE public.profiles DROP COLUMN IF EXISTS sessions_valid_from;
--
-- To release one account that was locked out by mistake (this re-admits every
-- token that account still holds — only do it deliberately):
--     UPDATE public.profiles SET sessions_valid_from = NULL WHERE id = '<uuid>';
--
-- No data is read, rewritten or deleted by this migration.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sessions_valid_from timestamptz;

COMMENT ON COLUMN public.profiles.sessions_valid_from IS
  'Access tokens issued before this instant are rejected. Set on password reset. NULL = never invalidated.';

-- PostgREST caches the table shape; without this the new column stays invisible
-- to the API until the service restarts.
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- VERIFICATION — run this AFTER the statements above and report the output.
--
-- Expected:
--   column_exists      : true
--   is_nullable        : YES
--   rows_locked_out    : 0     (nothing is invalidated by adding the column)
-- ============================================================================

SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND column_name  = 'sessions_valid_from'
  )                                                              AS column_exists,
  (SELECT is_nullable
     FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND column_name  = 'sessions_valid_from')                  AS is_nullable,
  (SELECT count(*)
     FROM public.profiles
    WHERE sessions_valid_from IS NOT NULL)                       AS rows_locked_out;
