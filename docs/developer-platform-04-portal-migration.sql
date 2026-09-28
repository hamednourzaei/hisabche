-- ============================================================================
-- DEVELOPER PLATFORM 04 — customer portal links.
-- Additive, idempotent, re-runnable. Standalone (needs only customers and
-- workspaces).
--
-- ⚠️ NOT YET RUN. Run it in the SQL Editor, then docs/VERIFY-developer-platform-04.sql.
-- Status: PENDING HUMAN CONFIRMATION.
--
-- A portal link lets ONE customer see their own account — invoices, payments,
-- balance and orders — without an account of their own, the way the invoice
-- link already shows one invoice. The owner makes it, can see it again to
-- resend, and can revoke it.
--
-- WHAT THE LINK IS
--
--   The link acts as the member who made it, narrowed to reading ONE
--   customer. On every visit the backend re-verifies that member is still in
--   the workspace: a person who is removed takes their links with them.
--   Nothing on the portal writes anything.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.customer_portal_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  customer_id   uuid NOT NULL,
  -- 256 bits, hex. The same shape as sales_orders.public_token.
  token         text NOT NULL UNIQUE CHECK (token ~ '^[0-9a-f]{64}$'),
  created_by    uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,
  last_used_at  timestamptz,
  revoked_at    timestamptz
);

CREATE INDEX IF NOT EXISTS customer_portal_links_customer_idx
  ON public.customer_portal_links (workspace_id, customer_id, created_at DESC);

ALTER TABLE customer_portal_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.customer_portal_links FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.customer_portal_links TO authenticated;
GRANT ALL ON public.customer_portal_links TO service_role;

-- Members read their workspace's links (the customer screen lists them).
-- No write policy: links are made and revoked through the backend only.
DROP POLICY IF EXISTS customer_portal_links_members_read ON customer_portal_links;
CREATE POLICY customer_portal_links_members_read ON customer_portal_links
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members m
                  WHERE m.workspace_id = customer_portal_links.workspace_id AND m.user_id = auth.uid()
                    AND m.has_access = true AND m.suspended_at IS NULL));

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- Close every portal at once, keeping the history:
--   UPDATE public.customer_portal_links SET revoked_at = now() WHERE revoked_at IS NULL;
--
-- Remove entirely:
--   DROP TABLE IF EXISTS public.customer_portal_links;
-- ============================================================================
