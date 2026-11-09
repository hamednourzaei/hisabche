-- ============================================================================
-- offline-licence-keys-02 — rev2 (9 Nov 2026): the private signing key STAYS
-- in the database, and can never be cleared.
--
-- HISTORY:
--   rev1 (8 Nov, run by the owner and VERIFIED on 9 Nov) made private_key_hex
--   nullable and let the guard trigger allow ONE change: value → NULL, so the
--   key could be moved to the backend's environment (audit F-02).
--   Owner decision, 9 Nov 2026: «در دیتابیس بماند» — the key stays in the
--   database; the backend stores nothing («بک‌اند فقط یک پله»). F-02 is an
--   accepted risk. rev2 takes the allowance back.
--
-- WHAT (re-running this file is how the live database gets rev2):
--   1. The guard trigger forbids EVERY change to private_key_hex again — the
--      exact rule of offline-licence-keys-01.
--   2. private_key_hex is NOT NULL again. If any row has already been cleared,
--      this refuses with OFFLINE_SIGNING_KEY_CLEARED instead of guessing a key
--      (§12): a cleared key cannot be recovered from anywhere.
--
-- Additive in effect (restores 01's constraints), idempotent, safe to run twice.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.offline_license_signing_keys WHERE private_key_hex IS NULL) THEN
    RAISE EXCEPTION 'OFFLINE_SIGNING_KEY_CLEARED: a signing key row has no private half; stop and report';
  END IF;
END $$;

ALTER TABLE public.offline_license_signing_keys
  ALTER COLUMN private_key_hex SET NOT NULL;

CREATE OR REPLACE FUNCTION public.offline_license_signing_keys_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'OFFLINE_SIGNING_KEY_PERMANENT';
  END IF;
  IF NEW.key_id IS DISTINCT FROM OLD.key_id
     OR NEW.private_key_hex IS DISTINCT FROM OLD.private_key_hex
     OR NEW.public_key_hex IS DISTINCT FROM OLD.public_key_hex
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (OLD.retired_at IS NOT NULL AND NEW.retired_at IS DISTINCT FROM OLD.retired_at) THEN
    RAISE EXCEPTION 'OFFLINE_SIGNING_KEY_PERMANENT';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.offline_license_signing_keys_guard() FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.offline_license_signing_keys_guard()
  IS 'offline-licence-keys-02:rev2';

COMMIT;

-- ============================================================================
-- ROLLBACK / MITIGATION: none needed — rev2 restores offline-licence-keys-01's
-- rules exactly. Do not reintroduce a way to clear private_key_hex without a
-- new owner decision.
-- ============================================================================
