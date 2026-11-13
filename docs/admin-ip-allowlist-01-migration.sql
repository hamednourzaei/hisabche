-- ==============================================================================
-- docs/admin-ip-allowlist-01-migration.sql
--
-- V63 · S-5 — the optional admin IP allow-list.
--
-- WHY
--   A platform-admin email is one factor. A stolen session cookie is then
--   enough to reach an admin surface that can rotate the AI key, refund
--   customers and change subscription state. Restricting the console to known
--   networks removes most of the value of a stolen cookie.
--
-- ⚠️ EMPTY MEANS OFF.
--   A fresh deployment has no rows: `admin-ip-allowlist.service.ts` treats an
--   empty list as «feature disabled», so nothing changes until the owner adds
--   one. A half-configured list that locked every admin out would be worse
--   than no list.
--
-- ⚠️ BREAK-GLASS.
--   The address in ADMIN_BREAK_GLASS_EMAIL (falling back to the first entry of
--   ADMIN_ALLOWED_EMAILS) may always reach `/api/admin/security/*` — where this
--   table is edited — from an unlisted network. Every use is a security event.
--
-- WHAT
--   1. public.admin_ip_allowlist — one row per CIDR (bare IP allowed as /32
--      or /128), with a label so a range is recognisable months later.
--   2. RLS + REVOKE: born locked, `service_role` only.
--
-- SAFETY
--   - additive and idempotent;
--   - a malformed CIDR is refused by the database, not silently stored;
--   - the application reads it through the service, never from a client.
--
-- POST-MIGRATION VERIFICATION: docs/VERIFY-admin-ip-allowlist-01.sql
--   Post-migration verification query generated — PENDING HUMAN CONFIRMATION
--
-- ROLLBACK
--   DROP TABLE IF EXISTS public.admin_ip_allowlist;
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.admin_ip_allowlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- IPv4 / IPv6 address or CIDR. A bare address is treated as /32 or /128
    -- by the matcher; the stored text is exactly what the owner typed.
    cidr TEXT NOT NULL CHECK (
        length(cidr) BETWEEN 2 AND 64
        AND (
            cidr ~ '^[0-9A-Fa-f:.]+$'
            OR cidr ~ '^[0-9A-Fa-f:.]+/([0-9]|[1-9][0-9]|1[01][0-9]|12[0-8])$'
        )
    ),
    label TEXT NOT NULL DEFAULT '',
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per range: adding the same range twice must fail loudly instead of
-- producing two rows the console then shows twice.
CREATE UNIQUE INDEX IF NOT EXISTS ux_admin_ip_allowlist_cidr
    ON public.admin_ip_allowlist(cidr);

CREATE INDEX IF NOT EXISTS idx_admin_ip_allowlist_created_at
    ON public.admin_ip_allowlist(created_at DESC);

ALTER TABLE public.admin_ip_allowlist ENABLE ROW LEVEL SECURITY;

-- On Supabase every new table is born with ALL granted to anon/authenticated.
-- Lock it first, then grant the one role that needs it.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON public.admin_ip_allowlist FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON public.admin_ip_allowlist FROM authenticated;
    END IF;

    REVOKE ALL ON public.admin_ip_allowlist FROM PUBLIC;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT ALL ON public.admin_ip_allowlist TO service_role;
    END IF;
END $$;
