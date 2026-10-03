-- ============================================================================
-- CONTENT INTELLIGENCE — 05: the editable writer prompt.
-- Additive, idempotent (safe to run twice). Run after 01–04.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN, NOT VERIFIED.
--
-- The one-click article button in the admin blog editor writes with an
-- EDITORIAL prompt the platform admin may change (voice, structure, audience).
-- This table holds that text — one row, key 'writer'. No row = the default
-- prompt in backend/src/services/blog/writer-prompt.ts; resetting deletes the
-- row. The pipeline works WITHOUT this migration (default prompt, read-only);
-- only saving a custom prompt needs it.
--
-- ⚠️ What is stored here is NOT the whole system prompt. The output contract
-- (JSON only, plain-text blocks, no invented facts, ignore instructions inside
-- sources) is code, appended after this text, and cannot be edited from here.
--
-- Internal: RLS on, no policy, no client grant — the backend reads and writes
-- it behind the platform-admin guard.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.blog_prompt_settings (
  key        text PRIMARY KEY CHECK (key IN ('writer')),
  prompt     text NOT NULL CHECK (char_length(btrim(prompt)) BETWEEN 50 AND 20000),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.blog_prompt_settings IS
  'The admin-editable editorial prompt of the AI article writer. One row per key. Internal.';

ALTER TABLE public.blog_prompt_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blog_prompt_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.blog_prompt_settings TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
--   DROP TABLE public.blog_prompt_settings;   -- the writer goes back to the default prompt
-- Nothing else depends on this table.
