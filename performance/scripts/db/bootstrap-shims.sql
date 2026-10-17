-- ============================================================================
-- performance/scripts/db/bootstrap-shims.sql
--
-- THE SUPABASE PLATFORM, AS FAR AS THIS REPOSITORY'S SQL CAN SEE IT.
--
-- The migrations in docs/ were written to run on Supabase. They reference
-- four things the platform provides and vanilla PostgreSQL does not:
--
--   1. the roles anon / authenticated / service_role  (RLS is written against
--      them, and `service_role` must BYPASSRLS like it does on Supabase)
--   2. the `auth` schema — `auth.uid()` in 45 files, `auth.users(id)` as an FK
--      target in 10 files
--   3. the `storage` schema — `storage.buckets` rows are inserted by four
--      migrations and `storage.objects` carries a policy
--   4. the `supabase_realtime` publication — three migrations add tables to it
--
-- Plus two platform BEHAVIOURS, not objects:
--
--   * DEFAULTS: on Supabase every new table is born with ALL granted to
--     anon/authenticated/service_role (which is why the migrations all begin
--     by REVOKEing). Reproducing that here is what makes a local RLS probe
--     mean anything — without it, tables would start locked down and a
--     missing REVOKE would look harmless.
--   * The definitions of auth.uid()/auth.jwt()/auth.role() are Supabase's own
--     (read `request.jwt.claims`, which PostgREST sets). Copied rather than
--     invented: a lab that defines auth.uid() differently would test a
--     different system.
--
-- WHAT THIS IS NOT: no GoTrue, no PostgREST, no Storage service. Those are
-- HTTP services this lab cannot run without Docker (see PARITY.md). The shim
-- is the SQL surface only, and every measurement that would need the HTTP
-- services is reported as NOT TESTABLE rather than approximated.
--
-- Safe to run twice (the runner calls it once, but nothing here assumes that).
-- ============================================================================

-- ── 1. Roles ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END $$;

-- ── 2. Default privileges: the Supabase birth-right of every new table ─────
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- ── 3. auth schema ──────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Supabase's own definitions. `request.jwt.claims` is a GUC PostgREST sets
-- per request from the verified JWT; the lab's RLS probes set it the same way
-- (with the same shape) inside a transaction.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT SELECT ON auth.users TO service_role;

-- ── 3b. The account `CREATE-MY-WORKSPACE.sql` names ─────────────────────────
-- That file is a first-class member of the docs/ queue (not in ORDER, so it
-- runs among the alphabetical extras). It refuses to run unless this exact id
-- exists in auth.users — it was written to unblock a real account whose every
-- request was 403. On a real project the account exists; here auth.users is
-- this shim, so the account is created here — otherwise the canonical rebuild
-- would stop on a platform difference rather than a schema one.
INSERT INTO auth.users (id, email)
VALUES ('2a51e3d6-e3c9-4947-ab4f-5bbc54a8ec8e', 'owner@hisabche.lab')
ON CONFLICT (id) DO NOTHING;

-- ── 4. storage schema (the SQL surface the migrations touch) ────────────────
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id                  text PRIMARY KEY,
  name                text NOT NULL,
  owner               uuid,
  public              boolean NOT NULL DEFAULT false,
  avif_autodetection  boolean NOT NULL DEFAULT false,
  file_size_limit     bigint,
  allowed_mime_types  text[],
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id         text REFERENCES storage.buckets (id),
  name              text,
  owner             uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  last_accessed_at  timestamptz,
  metadata          jsonb
);

-- On Supabase, RLS is on for storage.objects and a migration in this repo
-- drops/recreates a policy on it — the policy machinery must exist here too.
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON storage.buckets TO anon, authenticated, service_role;
GRANT ALL ON storage.objects TO anon, authenticated, service_role;

-- ── 5. supabase_realtime publication ────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- ── 6. The one extension the lab itself needs ───────────────────────────────
-- (The server is started with shared_preload_libraries=pg_stat_statements;
-- without this CREATE EXTENSION the statistics views do not exist.)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ── Record it ───────────────────────────────────────────────────────────────
COMMENT ON SCHEMA auth IS 'capacity-lab shim: Supabase-platform surface, see performance/scripts/db/bootstrap-shims.sql';
COMMENT ON SCHEMA storage IS 'capacity-lab shim: Supabase-platform surface, see performance/scripts/db/bootstrap-shims.sql';
