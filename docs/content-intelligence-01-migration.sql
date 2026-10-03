-- ============================================================================
-- CONTENT INTELLIGENCE — 01: briefs, research runs, sources.
-- Additive, idempotent (safe to run twice).
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN, NOT VERIFIED.
--
-- WHAT THIS ADDS
--
--   blog_content_briefs   the structured brief a human edits before drafting
--   blog_research_runs    one row per research attempt — retryable, auditable
--   blog_sources          researched sources, deduplicated by normalised URL
--   blog_article_sources  which post cites which source, and for what claim
--
-- WHAT THIS DELIBERATELY DOES NOT ADD
--
--   No new status machine.  `blog_posts.status` stays
--   `draft | scheduled | published` and 36 published rows are not migrated.
--   The AI pipeline's own state lives in `content_intelligence_status`, which
--   describes the PIPELINE and is never read by the public site.
--
--   No `blog_internal_links`, `blog_article_versions` or `blog_quality_reports`
--   yet — they arrive with their own migrations so each is reviewable on its own.
--
-- WHO MAY READ AND WRITE
--
--   ⚠️ NOT A CLIENT READ. The intelligence layer is internal: unpublished
--   research, prompts and drafts must not be readable by a browser key, and the
--   public anon key is a public key.
--
--   So: RLS enabled, and NO read policy at all. That is DENY-ALL, which is the
--   correct state for "the service role reads this and nobody else does" — the
--   same choice `sync_mutations` and `sync_change_log` already make, and the
--   reason `offline-contract.test.ts` documents them as deliberately policy-free.
--
--   ⚠️ The backend connects with `service_role`, which bypasses RLS entirely, so
--   every read and write goes through the authenticated routes. If RLS is
--   DISABLED on any of these tables by accident, the anon key could read
--   unpublished drafts — so the flags below are part of the contract, not a
--   detail.
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- blog_content_briefs
-- ═══════════════════════════════════════════════════════════════════════════
--
-- One brief per research cycle, kept after the article is published. A brief is
-- an editorial record: «why this article exists and what it was meant to answer».
-- That is worth keeping even after the post is live, because the refresh engine
-- (phase 6) compares a new brief against the old one.
CREATE TABLE IF NOT EXISTS public.blog_content_briefs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The topic as the editor typed it. Not normalised: it is a quote of the
  -- request, and normalising it would lose what was actually asked.
  topic          text NOT NULL CHECK (char_length(btrim(topic)) > 0),
  locale         text NOT NULL CHECK (locale IN ('fa', 'af', 'en')),
  search_intent  text,
  target_audience text,
  business_problem text,
  primary_keyword text,
  secondary_keywords text[] NOT NULL DEFAULT '{}',
  entities       text[] NOT NULL DEFAULT '{}',
  article_type   text,
  required_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  questions_to_answer text[] NOT NULL DEFAULT '{}',
  content_gaps   jsonb NOT NULL DEFAULT '[]'::jsonb,
  original_value jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  product_connections jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- ⚠️ The PIPELINE's state, deliberately separate from `blog_posts.status`.
  -- 'none' is the default so a brief nobody has worked on yet is visibly not
  -- ready, rather than indistinguishable from one that passed review.
  intelligence_status text NOT NULL DEFAULT 'none'
    CHECK (intelligence_status IN (
      'none', 'researching', 'brief_ready', 'draft_ready',
      'validation_ready', 'review_ready', 'failed'
    )),
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.blog_content_briefs IS
  'Editorial brief for an article. Internal. Created by the content-intelligence pipeline, edited by a human.';

CREATE INDEX IF NOT EXISTS blog_content_briefs_locale_created
  ON public.blog_content_briefs (locale, created_at DESC);
CREATE INDEX IF NOT EXISTS blog_content_briefs_status
  ON public.blog_content_briefs (intelligence_status)
  WHERE intelligence_status <> 'none';

-- ⚠️ ONE ACTIVE BRIEF PER TOPIC — the double-click guard, at the level where a
-- double-click cannot race past it. Two concurrent POSTs both read "no active
-- brief", both insert, and without this index both enqueue a Tavily run. With
-- it, the second INSERT fails on 23505 and the route returns the first brief.
-- Partial: a finished (brief_ready/failed) brief must NOT block researching the
-- same topic again later — a retry after a failure is a legitimate new brief.
CREATE UNIQUE INDEX IF NOT EXISTS blog_content_briefs_one_active_per_topic
  ON public.blog_content_briefs (locale, lower(btrim(topic)))
  WHERE intelligence_status IN ('none', 'researching');


-- ═══════════════════════════════════════════════════════════════════════════
-- blog_research_runs
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ ONE ROW PER ATTEMPT, INCLUDING FAILED ONES. That is the point of the table:
-- a retried research job that overwrites its previous row leaves no trace that
-- it ever failed, and a content pipeline whose failures are invisible is a
-- content pipeline that quietly degrades.
--
-- `run_key` is the idempotency handle. A double-clicked button sends the same
-- key, the unique index below turns the second into a no-op, and no second
-- Tavily bill is incurred.
CREATE TABLE IF NOT EXISTS public.blog_research_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id      uuid REFERENCES public.blog_content_briefs (id) ON DELETE CASCADE,
  -- What the editor asked for. Kept even when the brief row is later deleted.
  topic         text NOT NULL,
  locale        text NOT NULL CHECK (locale IN ('fa', 'af', 'en')),
  -- ⚠️ The idempotency key. UNIQUE means a retry cannot create a second run.
  run_key        text NOT NULL,
  provider      text,
  model         text,
  status        text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  -- ⚠️ 'skipped' is separate from 'completed': a locale whose search returned
  -- nothing usable must not look like a locale that was searched thoroughly.
  outcome        text,
  error          text,
  -- The search QUERY, so a research run can be explained later. Never the
  -- provider's raw response — that can echo unpublished draft content.
  queries        jsonb NOT NULL DEFAULT '[]'::jsonb,
  result_meta    jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_count   integer NOT NULL DEFAULT 0,
  started_at     timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_research_runs_key_unique UNIQUE (run_key),
  -- A run that claims to have completed must have finished.
  CONSTRAINT blog_research_runs_completed_needs_time CHECK (
    status <> 'completed' OR completed_at IS NOT NULL
  )
);

COMMENT ON TABLE public.blog_research_runs IS
  'One row per research attempt, including failures. run_key is the idempotency handle.';

CREATE INDEX IF NOT EXISTS blog_research_runs_brief
  ON public.blog_research_runs (brief_id, created_at DESC);
CREATE INDEX IF NOT EXISTS blog_research_runs_open
  ON public.blog_research_runs (status)
  WHERE status IN ('pending', 'running');


-- ═══════════════════════════════════════════════════════════════════════════
-- blog_sources
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ DEDUPLICATED ON A NORMALISED URL, NOT ON THE RAW ONE. The same authority is
-- reachable at `http://example.gov.af/x`, `https://example.gov.af/x` and
-- `https://www.example.gov.af/x`, and a research run across three locales will
-- find all three. Storing them as three rows is how a brief ends up citing the
-- same government page three times and looking like it had three sources.
--
-- The normalisation is done in the repository, not by a database expression:
-- PostgreSQL has no portable URL canonicaliser, and a half-correct one written
-- in SQL would be a permanent, invisible source of duplicates.
CREATE TABLE IF NOT EXISTS public.blog_sources (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The normalised form, and the unique key.
  url_normalised text NOT NULL,
  -- The URL as the provider returned it, kept so a person can click it.
  url            text NOT NULL,
  title          text,
  domain         text,
  -- ⚠️ 'competitor' is a first-class value, not an insult. A competitor page is a
  -- legitimate research INPUT and the pipeline must be able to say where an idea
  -- came from. What is forbidden is copying, and that is enforced by the
  -- originality gate — not by pretending the source does not exist.
  source_type    text NOT NULL DEFAULT 'secondary'
    CHECK (source_type IN ('primary', 'secondary', 'competitor')),
  -- 0..1. Null means "not yet judged" and must not read as zero.
  authority_score numeric CHECK (authority_score IS NULL
    OR (authority_score >= 0 AND authority_score <= 1)),
  -- Only a PRIMARY source may back a factual or regulatory claim. A competitor
  -- page must never be cited as evidence; it is a topic lead.
  -- (Implemented in the validation layer, which is the only place that knows
  -- what a claim is. The column exists so the question is answerable at all.)
  retrieved_at   timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_sources_url_unique UNIQUE (url_normalised)
);

COMMENT ON TABLE public.blog_sources IS
  'A researched source, deduplicated on a normalised URL. Internal.';

CREATE INDEX IF NOT EXISTS blog_sources_domain ON public.blog_sources (domain);
CREATE INDEX IF NOT EXISTS blog_sources_type ON public.blog_sources (source_type);


-- ═══════════════════════════════════════════════════════════════════════════
-- blog_article_sources
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ `claim` IS NULLABLE ON PURPOSE. A source can back the article as a whole —
-- "here is our accounting terminology" — without backing one sentence. Forcing
-- a claim on every row would make people write filler to satisfy a NOT NULL.
CREATE TABLE IF NOT EXISTS public.blog_article_sources (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id    uuid NOT NULL REFERENCES public.blog_posts (id) ON DELETE CASCADE,
  source_id     uuid NOT NULL REFERENCES public.blog_sources (id) ON DELETE CASCADE,
  -- What this source backs. Null = the article as a whole.
  claim         text,
  -- 'reference' = listed under sources. 'evidence' = backs a factual claim.
  -- A competitor source can be 'reference' and never 'evidence'.
  relationship text NOT NULL DEFAULT 'reference'
    CHECK (relationship IN ('reference', 'evidence')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_article_sources_unique UNIQUE (article_id, source_id)
);

CREATE INDEX IF NOT EXISTS blog_article_sources_article
  ON public.blog_article_sources (article_id);
CREATE INDEX IF NOT EXISTS blog_article_sources_source
  ON public.blog_article_sources (source_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — ENABLED AND DELIBERATELY POLICY-FREE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ READ THIS BEFORE ADDING A POLICY.
--
-- The public blog is read through the BACKEND with `service_role`, which bypasses
-- RLS. A policy on these tables would therefore buy nothing and risk a great
-- deal: the anon key is a public key, so any SELECT policy that is not exactly
-- right exposes unpublished research and drafts to the internet.
--
-- RLS ON + no policy = every statement denied. The service role is unaffected.
-- That is the correct posture, and it is the one `sync_mutations` and
-- `sync_change_log` already use.
ALTER TABLE public.blog_content_briefs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_research_runs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_sources         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_article_sources ENABLE ROW LEVEL SECURITY;

-- ⚠️ service_role is the only role that writes or reads these. Stated here so a
-- later migration that adds a policy is a DELIBERATE widening, not an
-- accident: this block is the only thing standing between an unpublished brief
-- and the public internet.
REVOKE ALL ON public.blog_content_briefs  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.blog_research_runs   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.blog_sources         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.blog_article_sources FROM PUBLIC, anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Dropping these tables removes research history and briefs. Nothing in the
-- PUBLIC blog depends on them, so this rollback cannot break a published page —
-- but it does destroy the editorial record, which is why it is written down
-- rather than left implicit.
--
--   DROP TABLE public.blog_article_sources;
--   DROP TABLE public.blog_sources;
--   DROP TABLE public.blog_research_runs;
--   DROP TABLE public.blog_content_briefs;
