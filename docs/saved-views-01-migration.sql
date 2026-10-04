-- ============================================================================
-- SAVED VIEWS — 01 (capabilities #87 and #89). Additive, idempotent.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running, run docs/VERIFY-saved-views-01.sql.
--
-- A saved view is how a table LOOKS, kept under a name: which columns are
-- hidden, what it is sorted by, what was typed in its search box. It holds no
-- rows and no selection — restoring somebody's selection from last week and
-- then offering «delete selected» is how a saved view becomes a data-loss bug.
--
-- A view belongs to the person who saved it. `shared = true` (#89) lets every
-- member of the same workspace apply it; they still cannot edit or remove it.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.saved_views (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  -- Which table of the application (`invoices`, `products`, …). Not a database
  -- table name and never used as one.
  table_id     text NOT NULL CHECK (table_id ~ '^[a-z0-9][a-z0-9_.-]{0,59}$'),
  name         text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  -- { hiddenIds: string[], sortId: string|null, sortDirection: 'asc'|'desc', search: string }
  state        jsonb NOT NULL DEFAULT '{}'::jsonb,
  shared       boolean NOT NULL DEFAULT false,
  created_by   uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.saved_views IS
  'A named look of one application table (hidden columns, sort, search). Owned by its creator; shared = visible to the workspace.';

-- One name per person per table: saving «مشتریان بدهکار» twice updates nothing
-- by accident and leaves no two rows a person cannot tell apart.
CREATE UNIQUE INDEX IF NOT EXISTS saved_views_owner_name
  ON public.saved_views (workspace_id, table_id, created_by, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS saved_views_table_idx
  ON public.saved_views (workspace_id, table_id);

-- Read and written by the backend only; who may see which view is decided there.
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saved_views FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.saved_views TO service_role;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Removes every saved view. No business data depends on them.
--
--   DROP TABLE IF EXISTS public.saved_views;
