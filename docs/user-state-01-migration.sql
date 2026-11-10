-- ============================================================================
-- docs/user-state-01-migration.sql
--
-- Two things a PERSON keeps that lived only on one device (QA report, 9 Nov
-- 2026), moved into the database — the backend is only a step:
--
--   1. invoice_drafts    — «ذخیره پیش‌نویس» in the invoice builder only said
--                          «saved»: the draft stayed in that browser's
--                          localStorage, never reached the invoice list and
--                          was gone on any other device (QA-005).
--   2. user_preferences  — the dark theme was kept in localStorage only and
--                          was lost on a new device or after a sign-out that
--                          cleared storage (QA-THEME-001).
--
-- A draft is NOT an invoice: it moves no stock, books nothing, has no number.
-- It is the builder's own state (`payload`, shape owned by the client) for
-- one person in one workspace. The server checks its size and kind only.
--
-- Read and written only by the backend for `request.userId` (drafts: inside
-- the caller's own workspace, requireWorkspaceContext). Nothing for anon /
-- authenticated.
--
-- RUN ORDER: any time.
-- ADDITIVE, IDEMPOTENT, SAFE TO RE-RUN.
-- ⚠️ NOT run by the assistant. Run it, then docs/VERIFY-user-state-01.sql.
--    Status: PENDING HUMAN CONFIRMATION
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS public.invoice_drafts;
--   DROP TABLE IF EXISTS public.user_preferences;
--   (the builder then keeps drafts on the device again and says so; the
--   theme falls back to the device copy).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invoice_drafts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL,
  user_id      uuid        NOT NULL,
  kind         text        NOT NULL,
  title        text        NOT NULL DEFAULT '',
  payload      jsonb       NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_drafts DROP CONSTRAINT IF EXISTS invoice_drafts_shape;
ALTER TABLE public.invoice_drafts ADD CONSTRAINT invoice_drafts_shape
  CHECK (
    kind IN ('sale', 'purchase', 'pre_sale', 'pre_purchase')
    AND jsonb_typeof(payload) = 'object'
    AND char_length(title) <= 200
    AND pg_column_size(payload) <= 262144
  );

CREATE INDEX IF NOT EXISTS invoice_drafts_owner_idx
  ON public.invoice_drafts (workspace_id, user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id    uuid        PRIMARY KEY,
  theme      text        NOT NULL DEFAULT 'system',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences DROP CONSTRAINT IF EXISTS user_preferences_theme;
ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_theme
  CHECK (theme IN ('light', 'dark', 'system'));

DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_drafts_user_fk') THEN
      ALTER TABLE public.invoice_drafts
        ADD CONSTRAINT invoice_drafts_user_fk
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_preferences_user_fk') THEN
      ALTER TABLE public.user_preferences
        ADD CONSTRAINT user_preferences_user_fk
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
  END IF;
  IF to_regclass('public.workspaces') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_drafts_workspace_fk') THEN
    ALTER TABLE public.invoice_drafts
      ADD CONSTRAINT invoice_drafts_workspace_fk
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Only the backend touches them. A new Supabase table is born with ALL for
-- anon / authenticated / service_role, so revoke first.
ALTER TABLE public.invoice_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_drafts FROM anon, authenticated, service_role;
-- A draft is thrown away when it becomes an invoice or the person discards
-- it: the one table here the backend deletes from.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_drafts TO service_role;

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_preferences FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_preferences TO service_role;
