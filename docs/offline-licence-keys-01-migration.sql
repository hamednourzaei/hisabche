-- ============================================================================
-- offline-licence-keys-01 — the offline-licence signing key lives in the
-- database, made by the backend, not in an environment file (owner, 22 Oct 2026).
--
-- · The backend creates the Ed25519 pair the first time it needs one and keeps
--   it here. Only service_role (the backend) can read it; anon/authenticated
--   cannot see the table at all.
-- · One active key (retired_at IS NULL). A key is never deleted and its bytes
--   never change — every licence it signed must stay verifiable. Retiring is
--   the only update.
-- · Additive and idempotent: safe to run twice.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.offline_license_signing_keys (
  key_id          text PRIMARY KEY,
  private_key_hex text NOT NULL CHECK (private_key_hex ~ '^[0-9a-f]{64}$'),
  public_key_hex  text NOT NULL CHECK (public_key_hex ~ '^[0-9a-f]{64}$'),
  created_at      timestamptz NOT NULL DEFAULT now(),
  retired_at      timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS offline_license_signing_keys_one_active
  ON public.offline_license_signing_keys ((true))
  WHERE retired_at IS NULL;

ALTER TABLE public.offline_license_signing_keys ENABLE ROW LEVEL SECURITY;

-- Supabase gives a new table ALL to every role; take it all back first.
REVOKE ALL ON public.offline_license_signing_keys FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.offline_license_signing_keys TO service_role;
GRANT UPDATE (retired_at) ON public.offline_license_signing_keys TO service_role;

DROP POLICY IF EXISTS offline_license_signing_keys_backend ON public.offline_license_signing_keys;
CREATE POLICY offline_license_signing_keys_backend ON public.offline_license_signing_keys
  FOR ALL TO service_role USING (true) WITH CHECK (true);

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

DROP TRIGGER IF EXISTS offline_license_signing_keys_guard_trg ON public.offline_license_signing_keys;
CREATE TRIGGER offline_license_signing_keys_guard_trg
  BEFORE UPDATE OR DELETE ON public.offline_license_signing_keys
  FOR EACH ROW EXECUTE FUNCTION public.offline_license_signing_keys_guard();

-- Rollback / mitigation (only if no licence was ever issued with a key here):
--   DROP TABLE public.offline_license_signing_keys;
--   DROP FUNCTION public.offline_license_signing_keys_guard();
