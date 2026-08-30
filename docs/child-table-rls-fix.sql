-- ============================================================================
-- docs/child-table-rls-fix.sql
--
-- Child rows must derive their tenancy from their PARENT'S WORKSPACE, not from
-- who created the parent.
--
-- WHAT WAS WRONG
--   `invoice_item_details` was protected by:
--
--       EXISTS (... JOIN invoices i ... AND i.user_id = auth.uid())
--
--   Two things follow from that `user_id`:
--
--     1. A manager could not see the line details of an invoice a seller
--        raised — in the same shop, on an invoice they can otherwise open.
--        The header was visible (workspace policy) and its detail rows were
--        not, so the invoice rendered with pieces missing and no error.
--
--     2. It reintroduces user_id as a tenancy boundary at the database layer,
--        which is exactly what the workspace policies elsewhere removed. Two
--        different answers to "who owns this row" in one database is how the
--        wrong one ends up being the one that gets copied.
--
-- The parent's `workspace_id` is the boundary, reached through the same
-- membership chain every other policy uses.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

ALTER TABLE invoice_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_item_details  ENABLE ROW LEVEL SECURITY;

-- ─── invoice_items ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS invoice_items_workspace_members ON invoice_items;
CREATE POLICY invoice_items_workspace_members ON invoice_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
        )
    )
  );

-- ─── invoice_item_details ───────────────────────────────────────────────────
-- Two joins deep: detail → item → invoice → workspace.

DROP POLICY IF EXISTS invoice_item_details_owner ON invoice_item_details;
DROP POLICY IF EXISTS invoice_item_details_workspace_members ON invoice_item_details;
CREATE POLICY invoice_item_details_workspace_members ON invoice_item_details
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM invoice_items ii
      JOIN invoices i ON i.id = ii.invoice_id
      WHERE ii.id = invoice_item_details.invoice_item_id
        AND i.workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM invoice_items ii
      JOIN invoices i ON i.id = ii.invoice_id
      WHERE ii.id = invoice_item_details.invoice_item_id
        AND i.workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
        )
    )
  );

-- The joins above are only fast with these.
CREATE INDEX IF NOT EXISTS invoice_items_invoice_idx
  ON invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS invoice_item_details_item_idx
  ON invoice_item_details (invoice_item_id);

COMMIT;
