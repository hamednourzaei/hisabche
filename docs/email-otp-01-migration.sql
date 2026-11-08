-- ============================================================================
-- docs/email-otp-01-migration.sql
--
-- V54 Phase 5.1 — email one-time codes (OTP): the INFRASTRUCTURE only.
-- Sending is switched off until the email subscription is bought
-- (EMAIL_OTP_ENABLED is not 'true' ⇒ the request route answers
-- EMAIL_OTP_DISABLED and nothing is written). Nothing enforces verification
-- yet; signup is unchanged.
--
--   public.email_otp_codes   one row per code sent: WHO, WHICH address, the
--                            SHA-256 of the code (never the code), expiry,
--                            wrong attempts, when it was used.
--   public.email_otp_verify  the ONLY verifier: locks the newest open code of
--                            that person, refuses expired / locked (5 wrong
--                            tries) / wrong — counting the wrong try — and
--                            marks a right one used, all in one transaction,
--                            so a code works once and guessing is capped.
--
-- «Verified» = a used code exists for (person, address). A changed address is
-- therefore unverified until a code is used for it.
--
-- Additive, idempotent, safe to re-run. Prerequisite: none.
-- ⚠️ NOT run by the assistant. Run it, then docs/VERIFY-email-otp-01.sql.
--    Status: PENDING HUMAN CONFIRMATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_otp_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  email       text NOT NULL CHECK (length(email) BETWEEN 3 AND 320),
  code_hash   text NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at  timestamptz NOT NULL,
  attempts    integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_otp_codes_user_open_idx
  ON public.email_otp_codes (user_id, created_at DESC);

-- Born with ALL for the API roles in Supabase: take it back first.
REVOKE ALL ON public.email_otp_codes FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.email_otp_codes TO service_role;
ALTER TABLE public.email_otp_codes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.email_otp_verify(
  p_user_id   uuid,
  p_email     text,
  p_code_hash text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.email_otp_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_row
    FROM public.email_otp_codes
   WHERE user_id = p_user_id
     AND lower(email) = lower(p_email)
     AND consumed_at IS NULL
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND OR v_row.expires_at <= now() THEN
    RETURN 'EXPIRED';
  END IF;
  IF v_row.attempts >= 5 THEN
    RETURN 'LOCKED';
  END IF;
  IF v_row.code_hash <> p_code_hash THEN
    UPDATE public.email_otp_codes SET attempts = attempts + 1 WHERE id = v_row.id;
    RETURN 'WRONG';
  END IF;

  UPDATE public.email_otp_codes SET consumed_at = now() WHERE id = v_row.id;
  RETURN 'VERIFIED';
END $$;

REVOKE EXECUTE ON FUNCTION public.email_otp_verify(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_otp_verify(uuid, text, text) TO service_role;

-- ── ROLLBACK BLOCK (manual) ────────────────────────────────────────────────
-- DROP FUNCTION IF EXISTS public.email_otp_verify(uuid, text, text);
-- DROP TABLE IF EXISTS public.email_otp_codes;
