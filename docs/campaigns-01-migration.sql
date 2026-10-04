-- ============================================================================
-- CUSTOMER CAMPAIGNS + NPS — 01 (capabilities #106, #112). Additive, idempotent.
--
-- ⚠️ PENDING HUMAN CONFIRMATION — NOT RUN ON THE LIVE DATABASE.
--    After running, run docs/VERIFY-campaigns-01.sql.
--    Needs docs/email-outbox-migration.sql (the outbox the emails go through).
--
-- A campaign is one message to a group of the business's own customers, sent by
-- email through the existing outbox. Two kinds:
--
--   message   an announcement;
--   nps       the same, plus «how likely are you to recommend us, 0–10?» —
--             answered from a link, with no account.
--
-- What is stored, and why:
--
--   customer_campaigns        what was written and to which group
--   campaign_recipients       ONE row per customer per campaign: where their
--                             email went (the outbox row), or why it was not
--                             sent; their answer; and the unguessable token
--                             their link carries
--   customer_contact_optouts  a customer who asked not to be written to. An
--                             opted-out customer is skipped by every later
--                             campaign, and the skip is recorded.
--
-- ⚠️ LAUNCHING IS ONE TRANSACTION (campaign_launch): the recipients and their
-- outbox emails are written together or not at all, and a campaign launches
-- once. Delivery is then the outbox's job, with its own retries.
--
-- ⚠️ «SENT» IS READ FROM THE OUTBOX, never assumed: a recipient's state is the
-- state of its outbox row.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customer_campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  name          text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  kind          text NOT NULL CHECK (kind IN ('message', 'nps')),
  subject       text NOT NULL CHECK (char_length(btrim(subject)) BETWEEN 1 AND 150),
  body          text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  language      text NOT NULL CHECK (language IN ('fa', 'af', 'en')),
  segment       text NOT NULL CHECK (segment IN ('all', 'overdue', 'recent_buyers', 'inactive')),
  -- Days for `recent_buyers` / `inactive`; NULL for the others.
  segment_days  integer CHECK (segment_days IS NULL OR segment_days BETWEEN 1 AND 730),
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'cancelled')),
  created_by    uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz,
  sent_by       uuid,

  CONSTRAINT customer_campaigns_days_when_needed
    CHECK ((segment IN ('recent_buyers', 'inactive')) = (segment_days IS NOT NULL)),
  CONSTRAINT customer_campaigns_sent_has_sender
    CHECK (status <> 'sent' OR (sent_at IS NOT NULL AND sent_by IS NOT NULL))
);

COMMENT ON TABLE public.customer_campaigns IS
  'A message (or an NPS question) sent by email to a group of the business''s own customers.';

CREATE INDEX IF NOT EXISTS customer_campaigns_workspace_idx
  ON public.customer_campaigns (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.campaign_recipients (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES public.customer_campaigns(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  customer_id  uuid NOT NULL,
  -- The address the email went to, as it was at that moment. NULL when skipped
  -- for having none.
  email        text,
  -- What the customer's link carries. Unguessable; it identifies one recipient
  -- of one campaign and nothing else.
  token        uuid NOT NULL DEFAULT gen_random_uuid(),
  -- The outbox row that carries this email. NULL = not sent (see skip_reason).
  outbox_id    uuid,
  skip_reason  text CHECK (skip_reason IN ('NO_EMAIL', 'OPTED_OUT', 'INVALID_EMAIL')),
  nps_score    integer CHECK (nps_score BETWEEN 0 AND 10),
  nps_comment  text CHECK (nps_comment IS NULL OR char_length(nps_comment) <= 1000),
  responded_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),

  -- Sent XOR skipped: a row is one or the other, never both, never neither.
  CONSTRAINT campaign_recipients_sent_xor_skipped
    CHECK ((outbox_id IS NOT NULL) <> (skip_reason IS NOT NULL)),
  -- An answer has its time, and only a recipient who was sent to can answer.
  CONSTRAINT campaign_recipients_answer_is_whole
    CHECK ((nps_score IS NULL) = (responded_at IS NULL)),
  CONSTRAINT campaign_recipients_answer_needs_send
    CHECK (nps_score IS NULL OR outbox_id IS NOT NULL)
);

COMMENT ON TABLE public.campaign_recipients IS
  'One row per customer per campaign: the outbox email (or why none), the link token, and the NPS answer.';

CREATE UNIQUE INDEX IF NOT EXISTS campaign_recipients_one_per_customer
  ON public.campaign_recipients (campaign_id, customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS campaign_recipients_token
  ON public.campaign_recipients (token);
CREATE INDEX IF NOT EXISTS campaign_recipients_workspace_idx
  ON public.campaign_recipients (workspace_id, campaign_id);

CREATE TABLE IF NOT EXISTS public.customer_contact_optouts (
  workspace_id uuid NOT NULL,
  customer_id  uuid NOT NULL,
  channel      text NOT NULL CHECK (channel IN ('email')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, customer_id, channel)
);

COMMENT ON TABLE public.customer_contact_optouts IS
  'Customers who asked not to be written to on a channel. Every later campaign skips them.';

ALTER TABLE public.customer_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_contact_optouts ENABLE ROW LEVEL SECURITY;

-- On Supabase a new table arrives with ALL privileges already granted to the
-- three API roles; every one is revoked before the backend is granted back.
REVOKE ALL ON public.customer_campaigns FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.campaign_recipients FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.customer_contact_optouts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.customer_campaigns TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.campaign_recipients TO service_role;
GRANT SELECT, INSERT ON public.customer_contact_optouts TO service_role;

-- ─── Launching a campaign ───────────────────────────────────────────────────
-- p_lines: [{ customer_id, email, token, html, skip_reason }]
--   · a line with `skip_reason` is recorded and sends nothing;
--   · every other line gets ONE outbox email and a recipient pointing at it.
--
-- The campaign is locked and must still be a draft, so two people pressing
-- «send» at once produce one launch and one refusal — never two emails each.

CREATE OR REPLACE FUNCTION public.campaign_launch(
  p_workspace_id uuid,
  p_user_id      uuid,
  p_campaign_id  uuid,
  p_lines        jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status  text;
  v_subject text;
  v_line    jsonb;
  v_outbox  uuid;
  v_sent    integer := 0;
  v_skipped integer := 0;
BEGIN
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
    RAISE EXCEPTION 'CAMPAIGN_LINES_INVALID' USING ERRCODE = 'P0001';
  END IF;

  SELECT c.status, c.subject INTO v_status, v_subject
    FROM public.customer_campaigns c
   WHERE c.id = p_campaign_id AND c.workspace_id = p_workspace_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CAMPAIGN_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'CAMPAIGN_ALREADY_SENT' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'CAMPAIGN_NO_RECIPIENTS' USING ERRCODE = 'P0001';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    IF v_line->>'skip_reason' IS NOT NULL THEN
      INSERT INTO public.campaign_recipients
        (campaign_id, workspace_id, customer_id, email, token, skip_reason)
      VALUES
        (p_campaign_id, p_workspace_id, (v_line->>'customer_id')::uuid,
         NULLIF(v_line->>'email', ''), (v_line->>'token')::uuid, v_line->>'skip_reason');
      v_skipped := v_skipped + 1;
    ELSE
      INSERT INTO public.email_outbox (to_email, subject, html)
      VALUES (v_line->>'email', v_subject, v_line->>'html')
      RETURNING id INTO v_outbox;

      INSERT INTO public.campaign_recipients
        (campaign_id, workspace_id, customer_id, email, token, outbox_id)
      VALUES
        (p_campaign_id, p_workspace_id, (v_line->>'customer_id')::uuid,
         v_line->>'email', (v_line->>'token')::uuid, v_outbox);
      v_sent := v_sent + 1;
    END IF;
  END LOOP;

  UPDATE public.customer_campaigns
     SET status = 'sent', sent_at = now(), sent_by = p_user_id
   WHERE id = p_campaign_id;

  RETURN jsonb_build_object('queued', v_sent, 'skipped', v_skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.campaign_launch(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_launch(uuid, uuid, uuid, jsonb) TO service_role;

-- What a sent campaign said and to whom is a record: it does not change, and
-- the only thing a recipient row gains afterwards is its answer — once.
CREATE OR REPLACE FUNCTION public.campaigns_keep_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'customer_campaigns' THEN
    IF OLD.status <> 'draft' AND (
         NEW.subject IS DISTINCT FROM OLD.subject OR NEW.body IS DISTINCT FROM OLD.body
      OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.segment IS DISTINCT FROM OLD.segment
      OR NEW.status IS DISTINCT FROM OLD.status) THEN
      RAISE EXCEPTION 'CAMPAIGN_ALREADY_SENT' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    IF NEW.campaign_id IS DISTINCT FROM OLD.campaign_id
       OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
       OR NEW.token IS DISTINCT FROM OLD.token
       OR NEW.outbox_id IS DISTINCT FROM OLD.outbox_id
       OR NEW.skip_reason IS DISTINCT FROM OLD.skip_reason THEN
      RAISE EXCEPTION 'CAMPAIGN_RECIPIENT_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;
    IF OLD.nps_score IS NOT NULL AND NEW.nps_score IS DISTINCT FROM OLD.nps_score THEN
      RAISE EXCEPTION 'NPS_ALREADY_ANSWERED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_campaigns_history_trg ON public.customer_campaigns;
CREATE TRIGGER customer_campaigns_history_trg
  BEFORE UPDATE ON public.customer_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.campaigns_keep_history();

DROP TRIGGER IF EXISTS campaign_recipients_history_trg ON public.campaign_recipients;
CREATE TRIGGER campaign_recipients_history_trg
  BEFORE UPDATE ON public.campaign_recipients
  FOR EACH ROW EXECUTE FUNCTION public.campaigns_keep_history();

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════
-- Removes campaigns, their recipients, the answers and the opt-outs. Emails
-- already written to the outbox stay there (and may still be sent).
--
--   DROP FUNCTION IF EXISTS public.campaign_launch(uuid, uuid, uuid, jsonb);
--   DROP TABLE IF EXISTS public.campaign_recipients;
--   DROP TABLE IF EXISTS public.customer_campaigns;
--   DROP TABLE IF EXISTS public.customer_contact_optouts;
--   DROP FUNCTION IF EXISTS public.campaigns_keep_history();
